// The count of lives begun, shown on the title page (PROJECT_PLAN §11.51). The browser sends ONE thing: a random id made for the life
// (no name, no seed, no state of the life, nothing about the player). The server (counter/, Cloudflare Worker + D1) counts each id once.
// Everything here fails silently: the game never waits for it and never depends on it.
//
// The address is set at build time by VITE_COUNTER_URL (e.g. https://baseball-life-counter.<account>.workers.dev). Without it nothing is
// sent and nothing is shown: there is no placeholder number.

const PENDING = 'bl12.counter.pending.v1'
const MAX_PENDING = 20
const TIMEOUT_MS = 5000
/** the number read is kept for this long (ms) and used again when the title page is shown again: no new GET /api/count in between */
export const TOTAL_TTL_MS = 60_000
const TOTAL_KEY = 'bl12.counter.total.v1'

export const COUNTER_URL: string = ((import.meta.env?.VITE_COUNTER_URL as string | undefined) ?? '').replace(/\/+$/, '')

export interface CounterEnv {
  url: string
  fetchFn: typeof fetch
  storage: Pick<Storage, 'getItem' | 'setItem'> | null
  /** where the number read is kept for TOTAL_TTL_MS (sessionStorage: it goes with the tab; absent: not kept) */
  session?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
  /** the clock (ms), for tests */
  now?: () => number
}

function defaultEnv(): CounterEnv {
  let storage: CounterEnv['storage'] = null
  try {
    storage = localStorage
  } catch {
    /* unavailable (private mode): ids that fail are not kept for a retry */
  }
  let session: CounterEnv['session'] = null
  try {
    session = sessionStorage
  } catch {
    /* unavailable: the number is read again each time */
  }
  return { url: COUNTER_URL, fetchFn: (...a) => fetch(...a), storage, session, now: () => Date.now() }
}

/** a random id for one life (a UUID v4: what the server accepts) */
export function newLifeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = new Uint8Array(16)
  for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

function readPending(e: CounterEnv): string[] {
  try {
    const v = JSON.parse(e.storage?.getItem(PENDING) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, MAX_PENDING) : []
  } catch {
    return []
  }
}

function writePending(e: CounterEnv, ids: string[]) {
  try {
    e.storage?.setItem(PENDING, JSON.stringify(ids.slice(-MAX_PENDING)))
  } catch {
    /* storage full or unavailable */
  }
}

async function call(e: CounterEnv, path: string, init?: RequestInit): Promise<Response | null> {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = ctl ? setTimeout(() => ctl.abort(), TIMEOUT_MS) : null
  try {
    return await e.fetchFn(`${e.url}${path}`, { ...init, ...(ctl ? { signal: ctl.signal } : {}) })
  } catch {
    return null
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function post(e: CounterEnv, id: string): Promise<boolean> {
  const r = await call(e, '/api/lives', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) })
  // (a refusal for a bad id is not retried; a busy or unavailable server is)
  return !!r && (r.ok || r.status === 400)
}

/**
 * Counts a life that has just begun. The id is kept until the server has taken it, so a failed request is sent again later
 * (`flushPending`); the server counts an id once, so a retry never counts twice. Returns whether it was taken now.
 */
export async function registerLife(id: string, env: CounterEnv = defaultEnv()): Promise<boolean> {
  if (!env.url) return false
  forgetTotal(env) // a life has begun: the next title page reads the number again
  const pending = readPending(env)
  if (!pending.includes(id)) writePending(env, [...pending, id])
  const ok = await post(env, id)
  if (ok) writePending(env, readPending(env).filter((x) => x !== id))
  return ok
}

/** sends again the ids that were not taken (called when the title page is shown) */
export async function flushPending(env: CounterEnv = defaultEnv()): Promise<void> {
  if (!env.url) return
  for (const id of readPending(env)) {
    if (await post(env, id)) writePending(env, readPending(env).filter((x) => x !== id))
    else break
  }
}

function forgetTotal(e: CounterEnv) {
  try {
    e.session?.removeItem(TOTAL_KEY)
  } catch {
    /* ignore */
  }
}

/** a number kept less than TOTAL_TTL_MS ago, or undefined (never a number from a failed read: only a good answer is kept) */
function keptTotal(e: CounterEnv): number | undefined {
  try {
    const v = JSON.parse(e.session?.getItem(TOTAL_KEY) ?? 'null') as { total?: unknown; at?: unknown } | null
    const age = (e.now ?? Date.now)() - Number(v?.at)
    if (v && typeof v.total === 'number' && Number.isFinite(v.total) && v.total >= 0 && age >= 0 && age < TOTAL_TTL_MS) return Math.floor(v.total)
  } catch {
    /* unreadable: read again */
  }
  return undefined
}

/**
 * the number of lives begun so far, or null when it cannot be read. A number read in the last 60 seconds is used again without a request
 * (the title page shown again, a reload); a failed read is never kept and never replaced by a number of any kind. The server's own cache
 * (15 s, counter/worker.ts) stays as it was, and the registration (POST) is not cached.
 */
export async function fetchTotal(env: CounterEnv = defaultEnv()): Promise<number | null> {
  if (!env.url) return null
  const kept = keptTotal(env)
  if (kept !== undefined) return kept
  const r = await call(env, '/api/count')
  if (!r || !r.ok) return null
  try {
    const v = (await r.json()) as { total?: unknown }
    if (typeof v.total !== 'number' || !Number.isFinite(v.total) || v.total < 0) return null
    const total = Math.floor(v.total)
    try {
      env.session?.setItem(TOTAL_KEY, JSON.stringify({ total, at: (env.now ?? Date.now)() }))
    } catch {
      /* not kept */
    }
    return total
  } catch {
    return null
  }
}