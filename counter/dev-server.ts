// A LOCAL stand-in for the counter, for trying the game against it without Cloudflare (PROJECT_PLAN §11.51): the same `handle` as the
// Worker, over node:sqlite in a file (or in memory). Not the deployed service. Run:
//   node counter/dev-server.ts [port] [database file]        (default 8787, in memory)
// then build the game with VITE_COUNTER_URL=http://localhost:8787 (see README.md).
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { handle, type D1Like } from './worker.ts'

const port = Number(process.argv[2] ?? 8787)
const raw = new DatabaseSync(process.argv[3] ?? ':memory:')
raw.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'))

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

createServer(async (req, res) => {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v)
  const body = chunks.length ? Buffer.concat(chunks) : undefined
  const r = await handle(new Request(`http://localhost:${port}${req.url}`, { method: req.method, headers, ...(body && req.method !== 'GET' ? { body } : {}) }), { DB: db })
  res.writeHead(r.status, Object.fromEntries(r.headers))
  res.end(Buffer.from(await r.arrayBuffer()))
}).listen(port, () => console.log(`counter (local stand-in) on http://localhost:${port}`))
