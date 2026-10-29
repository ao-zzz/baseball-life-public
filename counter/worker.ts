// The counter of lives begun: a Cloudflare Worker with a D1 database (PROJECT_PLAN §11.51). Written against the minimal D1 interface
// below (no dependency added); `schema.sql` makes the tables; README.md says how to set it up. Nothing is collected but a random id.
//
//   POST /api/lives  {"id": "<uuid v4>"}   count one life (idempotent per id)  → {"total": n}
//   GET  /api/count                         the number so far                  → {"total": n}
//
// Abuse: there is no sign-in, so the count can be pushed up by anyone who writes a script; this cannot be prevented completely. What
// it does: the id must be a UUID v4, the body is tiny, the origin must be one of ALLOWED_ORIGINS, and at most MAX_PER_MINUTE new lives
// are counted in any minute in all (more are answered 429 and not counted). A per-address limit belongs in Cloudflare's own rate
// limiting rules (README), which keep no data in this database.

export interface D1Statement {
  bind(...values: unknown[]): D1Statement
  run(): Promise<{ meta?: { changes?: number } }>
  first<T = Record<string, unknown>>(): Promise<T | null>
}
export interface D1Like {
  prepare(sql: string): D1Statement
}
export interface Env {
  DB: D1Like
  /** comma-separated origins that may call (e.g. https://example.pages.dev); empty: any origin (development) */
  ALLOWED_ORIGINS?: string
}

// (2000: raised from 600 on 2026-10-21 for the lives that came after the game went around social media; the largest minute seen was 460)
export const MAX_PER_MINUTE = 2000
/** the width of a bucket of the rate table (ms): the window of MAX_PER_MINUTE is 60–70 seconds long */
export const BUCKET_MS = 10_000
export const bucketOf = (t: number) => Math.floor(t / BUCKET_MS)
export const MAX_BODY = 200
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const json = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } })

function corsHeaders(req: Request, env: Env): Record<string, string> | null {
  const origin = req.headers.get('origin')
  const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((x) => x.trim()).filter(Boolean)
  if (allowed.length === 0) return { 'access-control-allow-origin': origin ?? '*', vary: 'origin' }
  if (origin && allowed.includes(origin)) return { 'access-control-allow-origin': origin, vary: 'origin' }
  return origin ? null : {}
}

async function total(db: D1Like): Promise<number> {
  const row = await db.prepare("SELECT value FROM counter WHERE name = 'lives'").first<{ value: number }>()
  return row?.value ?? 0
}

export async function handle(req: Request, env: Env, now: number = Date.now()): Promise<Response> {
  const url = new URL(req.url)
  const cors = corsHeaders(req, env)
  if (cors === null) return json({ error: 'origin not allowed' }, 403)
  const extra = { ...cors, 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' }
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: extra })
  try {
    if (req.method === 'GET' && url.pathname === '/api/count') {
      // (the game keeps the number 60 seconds itself; a browser may keep the answer as long, so a reload is not another request)
      return json({ total: await total(env.DB) }, 200, { ...extra, 'cache-control': 'public, max-age=60' })
    }
    if (req.method === 'POST' && url.pathname === '/api/lives') {
      const text = await req.text()
      if (text.length > MAX_BODY) return json({ error: 'too large' }, 413, extra)
      let id: unknown
      try {
        id = (JSON.parse(text) as { id?: unknown }).id
      } catch {
        return json({ error: 'bad request' }, 400, extra)
      }
      if (typeof id !== 'string' || !UUID.test(id)) return json({ error: 'bad id' }, 400, extra)
      // the new lives of the last 60–70 seconds, from the buckets of 10 seconds (at most 7 rows read; it used to count the rows of
      // `lives` of the last minute, up to MAX_PER_MINUTE rows read by every request: PROJECT_PLAN §11.64)
      const recent = await env.DB.prepare('SELECT COALESCE(SUM(n), 0) AS n FROM rate WHERE bucket >= ?').bind(bucketOf(now - 60_000)).first<{ n: number }>()
      if ((recent?.n ?? 0) >= MAX_PER_MINUTE) return json({ error: 'busy' }, 429, { ...extra, 'retry-after': '60' })
      // (one statement: a known id is ignored, a new one is stored and counted by the trigger in the same transaction)
      const stored = await env.DB.prepare('INSERT OR IGNORE INTO lives (id, created_at) VALUES (?, ?)').bind(id.toLowerCase(), now).run()
      if ((stored.meta?.changes ?? 0) > 0) {
        // only a NEW life enters its bucket (a retry of a counted id does not); if this fails the life is still counted, only the limit
        // sees one life fewer
        try {
          await env.DB.prepare('INSERT INTO rate (bucket, n) VALUES (?, 1) ON CONFLICT (bucket) DO UPDATE SET n = n + 1').bind(bucketOf(now)).run()
        } catch {
          /* the limit is an aid, not the count */
        }
      }
      return json({ total: await total(env.DB) }, 200, { ...extra, 'cache-control': 'no-store' })
    }
    return json({ error: 'not found' }, 404, extra)
  } catch {
    // the database failed: the game does not depend on it, the caller will try again later
    return json({ error: 'unavailable' }, 503, extra)
  }
}

export default { fetch: (req: Request, env: Env) => handle(req, env) }