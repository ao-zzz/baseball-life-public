import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { BUCKET_MS, MAX_BODY, MAX_PER_MINUTE, handle, type D1Like, type Env } from './worker.ts'

// The counter's server logic (PROJECT_PLAN §11.51), run against a real SQLite database (node:sqlite) made from schema.sql. The D1 service
// itself is not reached: its transactions are only as tested here (SQLite's), and the deployed Worker is NOT tested.

const SCHEMA = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8')

/** a D1-shaped wrapper over an in-memory SQLite database */
function memoryD1(): { db: D1Like; raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:')
  raw.exec(SCHEMA)
  const db: D1Like = {
    prepare(sql) {
      const make = (values: unknown[]) => ({
        bind: (...v: unknown[]) => make(v),
        run: async () => ({ meta: { changes: Number(raw.prepare(sql).run(...(values as never[])).changes) } }),
        first: async <T>() => ((raw.prepare(sql).get(...(values as never[])) as T | undefined) ?? null),
      })
      return make([])
    },
  }
  return { db, raw }
}

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const post = (body: unknown, origin?: string) =>
  new Request('https://counter.example/api/lives', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers: origin ? { origin } : {} })
const get = (path = '/api/count', origin?: string) => new Request(`https://counter.example${path}`, { headers: origin ? { origin } : {} })
const total = async (env: Env) => ((await (await handle(get(), env)).json()) as { total: number }).total

describe('counting a life', () => {
  it('a new id adds one; the same id again (a retry, a double click) adds nothing', async () => {
    const { db } = memoryD1()
    const env: Env = { DB: db }
    expect(await total(env)).toBe(0)
    const a = await handle(post({ id: id(1) }), env)
    expect(a.status).toBe(200)
    expect(((await a.json()) as { total: number }).total).toBe(1)
    for (let i = 0; i < 5; i++) expect((await handle(post({ id: id(1) }), env)).status).toBe(200)
    expect(await total(env)).toBe(1)
    // the same id in capitals is the same life
    await handle(post({ id: id(1).toUpperCase().replace('4000', '4000') }), env)
    expect(await total(env)).toBe(1)
    await handle(post({ id: id(2) }), env)
    expect(await total(env)).toBe(2)
  })

  it('many lives at once are all counted, and the same life sent many times at once is counted once', async () => {
    const { db } = memoryD1()
    const env: Env = { DB: db }
    await Promise.all(Array.from({ length: 60 }, (_, i) => handle(post({ id: id(100 + i) }), env)))
    expect(await total(env)).toBe(60)
    await Promise.all(Array.from({ length: 60 }, () => handle(post({ id: id(999) }), env)))
    expect(await total(env)).toBe(61)
  })

  it('the number and the rows agree (the trigger counts in the same statement as the insert)', async () => {
    const { db, raw } = memoryD1()
    const env: Env = { DB: db }
    for (let i = 0; i < 20; i++) await handle(post({ id: id(i % 7) }), env)
    const rows = (raw.prepare('SELECT COUNT(*) AS n FROM lives').get() as { n: number }).n
    expect(rows).toBe(7)
    expect(await total(env)).toBe(rows)
  })

  it('stores only a random id and the time: nothing about the player or the life', async () => {
    const { db, raw } = memoryD1()
    await handle(post({ id: id(5), name: '田中', seed: 123, country: 'JP' }), { DB: db })
    const cols = (raw.prepare('PRAGMA table_info(lives)').all() as { name: string }[]).map((c) => c.name)
    expect(cols.sort()).toEqual(['created_at', 'id'])
    const row = raw.prepare('SELECT * FROM lives').get() as Record<string, unknown>
    expect(Object.keys(row).sort()).toEqual(['created_at', 'id'])
  })
})

describe('the reads of the limit (PROJECT_PLAN §11.64)', () => {
  it('the limit reads the 10-second buckets by their key: a handful of rows however many lives came in the minute', async () => {
    const { db, raw } = memoryD1()
    const env: Env = { DB: db }
    const t0 = 1_800_000_000_000
    for (let i = 0; i < 300; i++) await handle(post({ id: id(i) }), env, t0 + i * 150)
    // 300 lives over 45 seconds: 5 buckets, not 300 rows
    const buckets = (raw.prepare('SELECT COUNT(*) AS n FROM rate').get() as { n: number }).n
    expect(buckets).toBeLessThanOrEqual(5)
    expect((raw.prepare('SELECT SUM(n) AS n FROM rate').get() as { n: number }).n).toBe(300)
    const plan = (raw.prepare('EXPLAIN QUERY PLAN SELECT COALESCE(SUM(n), 0) AS n FROM rate WHERE bucket >= ?').all(1) as { detail: string }[]).map((r) => r.detail).join(' ')
    expect(plan).toMatch(/SEARCH rate USING INTEGER PRIMARY KEY/)
    // the number and the rows still agree
    expect(await total(env)).toBe(300)
  })

  it('a retried id is counted once and enters no bucket twice; a duplicate does not push the limit', async () => {
    const { db, raw } = memoryD1()
    const env: Env = { DB: db }
    const t0 = 1_800_000_000_000
    for (let i = 0; i < 50; i++) await handle(post({ id: id(1) }), env, t0 + i)
    expect((raw.prepare('SELECT SUM(n) AS n FROM rate').get() as { n: number }).n).toBe(1)
    expect(await total(env)).toBe(1)
  })

  it('a database made before the rate table (the production one) is migrated without losing a row or a count', async () => {
    const raw = new DatabaseSync(':memory:')
    // the schema as it was deployed on 2026-10-19
    raw.exec(`CREATE TABLE lives (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL);
CREATE INDEX lives_created_at ON lives (created_at);
CREATE TABLE counter (name TEXT PRIMARY KEY, value INTEGER NOT NULL);
INSERT INTO counter VALUES ('lives', 0);
CREATE TRIGGER lives_counted AFTER INSERT ON lives BEGIN UPDATE counter SET value = value + 1 WHERE name = 'lives'; END;`)
    for (let i = 0; i < 40; i++) raw.prepare('INSERT INTO lives (id, created_at) VALUES (?, ?)').run(id(i), 1_700_000_000_000 + i)
    const before = raw.prepare("SELECT value FROM counter WHERE name = 'lives'").get() as { value: number }
    raw.exec(readFileSync(new URL('./migrate-2026-10-20.sql', import.meta.url), 'utf8'))
    raw.exec(readFileSync(new URL('./migrate-2026-10-20-index.sql', import.meta.url), 'utf8'))
    expect(before.value).toBe(40)
    expect((raw.prepare('SELECT COUNT(*) AS n FROM lives').get() as { n: number }).n).toBe(40)
    expect((raw.prepare("SELECT value FROM counter WHERE name = 'lives'").get() as { value: number }).value).toBe(40)
    // the new Worker on it: a new id counts, an old one does not
    const db: D1Like = {
      prepare(sql) {
        const make = (values: unknown[]) => ({
          bind: (...v: unknown[]) => make(v),
          run: async () => ({ meta: { changes: Number(raw.prepare(sql).run(...(values as never[])).changes) } }),
          first: async <T>() => ((raw.prepare(sql).get(...(values as never[])) as T | undefined) ?? null),
        })
        return make([])
      },
    }
    const env: Env = { DB: db }
    expect(await total(env)).toBe(40)
    await handle(post({ id: id(7) }), env, 1_800_000_000_000)
    await handle(post({ id: id(500) }), env, 1_800_000_000_000)
    expect(await total(env)).toBe(41)
    // running the migration again changes nothing
    raw.exec(readFileSync(new URL('./migrate-2026-10-20.sql', import.meta.url), 'utf8'))
    expect(await total(env)).toBe(41)
  })
})

describe('what is refused', () => {
  it('a bad id, a bad body, a large body: not counted', async () => {
    const { db } = memoryD1()
    const env: Env = { DB: db }
    expect((await handle(post({ id: 'abc' }), env)).status).toBe(400)
    expect((await handle(post({ id: 12345 }), env)).status).toBe(400)
    expect((await handle(post('not json'), env)).status).toBe(400)
    expect((await handle(post({ nothing: 1 }), env)).status).toBe(400)
    expect((await handle(post({ id: id(1), pad: 'x'.repeat(MAX_BODY) }), env)).status).toBe(413)
    expect(await total(env)).toBe(0)
    expect((await handle(new Request('https://counter.example/other'), env)).status).toBe(404)
  })

  it('more than the cap in a minute are answered 429 and not counted; a minute later it goes on', async () => {
    const { db } = memoryD1()
    const env: Env = { DB: db }
    const t0 = 1_800_000_000_000
    for (let i = 0; i < MAX_PER_MINUTE; i++) expect((await handle(post({ id: id(1000 + i) }), env, t0)).status).toBe(200)
    const over = await handle(post({ id: id(5000) }), env, t0 + 10)
    expect(over.status).toBe(429)
    expect(await total(env)).toBe(MAX_PER_MINUTE)
    // (the window is 60–70 seconds, whole buckets of 10 seconds: still busy at 61 s, free at 70 s)
    expect((await handle(post({ id: id(5000) }), env, t0 + 61_000)).status).toBe(429)
    expect((await handle(post({ id: id(5000) }), env, t0 + 60_000 + BUCKET_MS)).status).toBe(200)
    expect(await total(env)).toBe(MAX_PER_MINUTE + 1)
  })

  it('an origin that is not allowed is refused; an allowed one gets its own header back', async () => {
    const { db } = memoryD1()
    const env: Env = { DB: db, ALLOWED_ORIGINS: 'https://game.example, http://localhost:5173' }
    expect((await handle(post({ id: id(1) }, 'https://evil.example'), env)).status).toBe(403)
    const ok = await handle(post({ id: id(1) }, 'https://game.example'), env)
    expect(ok.status).toBe(200)
    expect(ok.headers.get('access-control-allow-origin')).toBe('https://game.example')
    const pre = await handle(new Request('https://counter.example/api/lives', { method: 'OPTIONS', headers: { origin: 'http://localhost:5173' } }), env)
    expect(pre.status).toBe(204)
    expect(await total(env)).toBe(1)
  })
})

describe('when the database fails', () => {
  it('answers 503 and throws nothing, in both calls', async () => {
    const broken: D1Like = {
      prepare() {
        throw new Error('D1 is down')
      },
    }
    const env: Env = { DB: broken }
    expect((await handle(post({ id: id(1) }), env)).status).toBe(503)
    expect((await handle(get(), env)).status).toBe(503)
  })

  it('a failure of the insert leaves the number as it was', async () => {
    const { db, raw } = memoryD1()
    await handle(post({ id: id(1) }), { DB: db })
    const failing: D1Like = {
      prepare(sql) {
        if (sql.startsWith('INSERT')) throw new Error('write failed')
        return db.prepare(sql)
      },
    }
    expect((await handle(post({ id: id(2) }), { DB: failing })).status).toBe(503)
    expect((raw.prepare("SELECT value FROM counter WHERE name = 'lives'").get() as { value: number }).value).toBe(1)
  })
})
