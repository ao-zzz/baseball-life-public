import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { fetchTotal, flushPending, newLifeId, registerLife, type CounterEnv } from './liveCounter.ts'
import { CounterLine, LifeCounter } from '../ui/LifeCounter.tsx'

// The browser's side of the counter of lives begun (PROJECT_PLAN §11.51): what is sent, when, and that a failure never matters.

function memory(): Pick<Storage, 'getItem' | 'setItem'> {
  const m = new Map<string, string>()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) }
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

function server(fail = false) {
  const calls: { url: string; method: string; body: string }[] = []
  const taken = new Set<string>()
  const fetchFn = (async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? 'GET', body: String(init?.body ?? '') })
    if (fail) throw new TypeError('network')
    if (url.endsWith('/api/count')) return new Response(JSON.stringify({ total: taken.size }), { status: 200 })
    taken.add((JSON.parse(String(init?.body)) as { id: string }).id)
    return new Response(JSON.stringify({ total: taken.size }), { status: 200 })
  }) as unknown as typeof fetch
  return { calls, taken, fetchFn }
}
const envOf = (srv: ReturnType<typeof server>, storage = memory()): CounterEnv => ({ url: 'https://c.example', fetchFn: srv.fetchFn, storage })

describe('counting a new life', () => {
  it('sends one random id and nothing else', async () => {
    const srv = server()
    const id = newLifeId()
    expect(id).toMatch(UUID)
    expect(newLifeId()).not.toBe(id)
    expect(await registerLife(id, envOf(srv))).toBe(true)
    expect(srv.calls).toHaveLength(1)
    expect(srv.calls[0].method).toBe('POST')
    expect(srv.calls[0].url).toBe('https://c.example/api/lives')
    expect(JSON.parse(srv.calls[0].body)).toEqual({ id })
  })

  it('without an address nothing is sent and nothing is shown', async () => {
    const srv = server()
    expect(await registerLife(newLifeId(), { ...envOf(srv), url: '' })).toBe(false)
    expect(await fetchTotal({ ...envOf(srv), url: '' })).toBeNull()
    await flushPending({ ...envOf(srv), url: '' })
    expect(srv.calls).toHaveLength(0)
    expect(renderToStaticMarkup(<LifeCounter url="" />)).toBe('')
  })

  it('a failure does not throw; the id is kept and sent again later, and the server takes it once', async () => {
    const storage = memory()
    const down = server(true)
    const id = newLifeId()
    expect(await registerLife(id, envOf(down, storage))).toBe(false)
    expect(storage.getItem('bl12.counter.pending.v1')).toContain(id)
    const up = server()
    await flushPending(envOf(up, storage))
    await flushPending(envOf(up, storage))
    expect([...up.taken]).toEqual([id])
    expect(up.calls).toHaveLength(1)
    expect(JSON.parse(storage.getItem('bl12.counter.pending.v1') ?? '[]')).toEqual([])
  })

  it('a life that was taken is not sent again', async () => {
    const srv = server()
    const storage = memory()
    const id = newLifeId()
    await registerLife(id, envOf(srv, storage))
    await flushPending(envOf(srv, storage))
    expect(srv.calls).toHaveLength(1)
  })
})

describe('reading the number', () => {
  it('reads the total; a failure or a bad answer is null', async () => {
    const srv = server()
    await registerLife(newLifeId(), envOf(srv))
    expect(await fetchTotal(envOf(srv))).toBe(1)
    expect(await fetchTotal(envOf(server(true)))).toBeNull()
    const bad = { ...envOf(srv), fetchFn: (async () => new Response('{"total":"x"}', { status: 200 })) as unknown as typeof fetch }
    expect(await fetchTotal(bad)).toBeNull()
    const err = { ...envOf(srv), fetchFn: (async () => new Response('{}', { status: 503 })) as unknown as typeof fetch }
    expect(await fetchTotal(err)).toBeNull()
  })

  it('the line says what is known: the number, 「集計中」, or that it cannot be read', () => {
    expect(renderToStaticMarkup(<CounterLine state={{ status: 'ok', total: 12345 }} />)).toContain('12,345')
    expect(renderToStaticMarkup(<CounterLine state={{ status: 'ok', total: 12345 }} />)).toContain('人の野球人生が始まりました')
    expect(renderToStaticMarkup(<CounterLine state={{ status: 'loading' }} />)).toContain('集計中')
    expect(renderToStaticMarkup(<CounterLine state={{ status: 'error' }} />)).toContain('取得できませんでした')
  })
})


describe('the number is kept for 60 seconds (PROJECT_PLAN §11.57)', () => {
  function sessionMemory() {
    const m = new Map<string, string>()
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), keys: () => [...m.keys()] }
  }
  const counting = () => {
    const srv = server()
    const session = sessionMemory()
    let t = 1_000_000
    const env: CounterEnv = { ...envOf(srv), session, now: () => t }
    return { srv, session, env, at: (ms: number) => (t = ms), count: () => srv.calls.filter((c) => c.method === 'GET').length }
  }

  it('shows the title page again within 60 s without a new GET, and reads again after 60 s', async () => {
    const x = counting()
    expect(await fetchTotal(x.env)).toBe(0)
    expect(x.count()).toBe(1)
    x.at(1_000_000 + 59_999)
    expect(await fetchTotal(x.env)).toBe(0)
    expect(await fetchTotal(x.env)).toBe(0)
    expect(x.count()).toBe(1)
    x.at(1_000_000 + 60_000)
    await fetchTotal(x.env)
    expect(x.count()).toBe(2)
  })

  it('a failed read is never kept and never becomes a number; the next read tries again', async () => {
    const down = server(true)
    const session = sessionMemory()
    const env: CounterEnv = { ...envOf(down), session, now: () => 5 }
    expect(await fetchTotal(env)).toBeNull()
    expect(session.keys()).toEqual([])
    expect(await fetchTotal(env)).toBeNull()
    expect(down.calls.filter((c) => c.method === 'GET')).toHaveLength(2)
    // (a bad answer is not kept either)
    const bad = { ...env, fetchFn: (async () => new Response('{"total":-3}', { status: 200 })) as unknown as typeof fetch }
    expect(await fetchTotal(bad)).toBeNull()
    expect(session.keys()).toEqual([])
  })

  it('a kept number from the future or an unreadable one is ignored', async () => {
    const x = counting()
    x.session.setItem('bl12.counter.total.v1', JSON.stringify({ total: 99, at: 1_000_000 + 10_000 }))
    expect(await fetchTotal(x.env)).toBe(0)
    x.session.setItem('bl12.counter.total.v1', 'not json')
    expect(await fetchTotal(x.env)).toBe(0)
    expect(x.count()).toBe(2)
  })

  it('without a place to keep it, every title page reads again (nothing breaks)', async () => {
    const srv = server()
    const env: CounterEnv = { ...envOf(srv), session: null }
    await fetchTotal(env)
    await fetchTotal(env)
    expect(srv.calls.filter((c) => c.method === 'GET')).toHaveLength(2)
  })

  it('a life that begins is registered as before (POST, one id, kept until taken) and the kept number is forgotten', async () => {
    const x = counting()
    await fetchTotal(x.env)
    expect(x.session.keys()).toEqual(['bl12.counter.total.v1'])
    const id = newLifeId()
    expect(await registerLife(id, x.env)).toBe(true)
    expect(x.session.keys()).toEqual([])
    const posts = x.srv.calls.filter((c) => c.method === 'POST')
    expect(posts).toHaveLength(1)
    expect(JSON.parse(posts[0].body)).toEqual({ id })
    // the number is read again (the server has one more) and then kept
    expect(await fetchTotal(x.env)).toBe(1)
    expect(x.count()).toBe(2)
  })

  it('a refused or failed registration still leaves its id for a retry, with the number cache present', async () => {
    const down = server(true)
    const storage = memory()
    const env: CounterEnv = { ...envOf(down, storage), session: sessionMemory(), now: () => 1 }
    const id = newLifeId()
    expect(await registerLife(id, env)).toBe(false)
    expect(storage.getItem('bl12.counter.pending.v1')).toContain(id)
  })
})


describe('when the server cannot take a life (PROJECT_PLAN §11.58): the id is kept, sent again on a later title page, never in a loop', () => {
  const PENDING = 'bl12.counter.pending.v1'
  const pendingOf = (s: Pick<Storage, 'getItem'>): string[] => JSON.parse(s.getItem(PENDING) ?? '[]')
  /** a fake server that answers each request with the next of `answers`: a status number, 'network' (rejects), or 'hang' (never answers, until aborted) */
  function scripted(answers: (number | 'network' | 'hang')[]) {
    const calls: { url: string; method: string; body: string }[] = []
    const taken = new Set<string>()
    let i = 0
    const fetchFn = ((url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? 'GET', body: String(init?.body ?? '') })
      const a = answers[Math.min(i++, answers.length - 1)]
      if (a === 'network') return Promise.reject(new TypeError('network'))
      if (a === 'hang')
        return new Promise((_res, rej) => {
          init?.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')))
        })
      if (a === 200 && init?.method === 'POST') taken.add((JSON.parse(String(init.body)) as { id: string }).id)
      return Promise.resolve(new Response(JSON.stringify({ total: taken.size }), { status: a }))
    }) as unknown as typeof fetch
    return { calls, taken, fetchFn }
  }
  const env = (srv: { fetchFn: typeof fetch }, storage = memory()): CounterEnv => ({ url: 'https://c.example', fetchFn: srv.fetchFn, storage, session: null })

  it('429 (busy), 503 (the database or the Worker is down), 500, 403 (origin), 404, 413 and a network error all keep the id', async () => {
    for (const answer of [429, 503, 500, 403, 404, 413, 'network'] as const) {
      const storage = memory()
      const srv = scripted([answer])
      const id = newLifeId()
      expect(await registerLife(id, env(srv, storage)), String(answer)).toBe(false)
      expect(pendingOf(storage), String(answer)).toEqual([id])
      expect(srv.calls.filter((c) => c.method === 'POST')).toHaveLength(1)
    }
  })

  it('a request that never answers is given up after 5 seconds and the id is kept', async () => {
    vi.useFakeTimers()
    try {
      const storage = memory()
      const srv = scripted(['hang'])
      const id = newLifeId()
      const done = registerLife(id, env(srv, storage))
      await vi.advanceTimersByTimeAsync(4999)
      expect(pendingOf(storage)).toEqual([id])
      await vi.advanceTimersByTimeAsync(2)
      expect(await done).toBe(false)
      expect(pendingOf(storage)).toEqual([id])
    } finally {
      vi.useRealTimers()
    }
  })

  it('200 removes the id; 400 (a bad id) also drops it, so a refused id is not sent for ever', async () => {
    for (const [answer, gone] of [[200, true], [400, true]] as const) {
      const storage = memory()
      const id = newLifeId()
      await registerLife(id, env(scripted([answer]), storage))
      expect(pendingOf(storage).includes(id), String(answer)).toBe(!gone)
    }
  })

  it('the next title page (a day later too: the id is in localStorage) sends the kept id again, and a success removes it', async () => {
    const storage = memory()
    const id = newLifeId()
    await registerLife(id, env(scripted([503]), storage))
    expect(pendingOf(storage)).toEqual([id])
    // (a later visit: the same storage, the server is back)
    const back = scripted([200])
    await flushPending(env(back, storage))
    expect(back.calls).toHaveLength(1)
    expect(JSON.parse(back.calls[0].body)).toEqual({ id })
    expect(back.taken.has(id)).toBe(true)
    expect(pendingOf(storage)).toEqual([])
    // and nothing is sent on the visit after
    await flushPending(env(back, storage))
    expect(back.calls).toHaveLength(1)
  })

  it('while the server is down a title page sends ONE request, not one for each kept id, and nothing runs by itself in between (no loop)', async () => {
    vi.useFakeTimers()
    try {
      const storage = memory()
      const ids = [newLifeId(), newLifeId(), newLifeId()]
      storage.setItem(PENDING, JSON.stringify(ids))
      const down = scripted([503])
      await flushPending(env(down, storage))
      expect(down.calls).toHaveLength(1)
      expect(pendingOf(storage)).toEqual(ids)
      await vi.advanceTimersByTimeAsync(10 * 60_000)
      expect(down.calls).toHaveLength(1)
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('when the server comes back in the middle, the ones sent are removed and the rest wait for the next visit', async () => {
    const storage = memory()
    const ids = [newLifeId(), newLifeId(), newLifeId()]
    storage.setItem(PENDING, JSON.stringify(ids))
    const srv = scripted([200, 503])
    await flushPending(env(srv, storage))
    expect(srv.calls).toHaveLength(2)
    expect(pendingOf(storage)).toEqual([ids[1], ids[2]])
    const back = scripted([200])
    await flushPending(env(back, storage))
    expect(back.calls).toHaveLength(2)
    expect(pendingOf(storage)).toEqual([])
  })

  it('at most 20 ids are kept (the oldest are let go), so a long outage cannot grow the storage or the next burst', async () => {
    const storage = memory()
    const srv = scripted([503])
    const all: string[] = []
    for (let i = 0; i < 25; i++) {
      const id = newLifeId()
      all.push(id)
      await registerLife(id, env(srv, storage))
    }
    expect(pendingOf(storage)).toEqual(all.slice(-20))
  })

  it('the same id sent twice is one life for the server (the double-count guard is the server\'s; here the client sends the id until it is taken)', async () => {
    const storage = memory()
    const id = newLifeId()
    // the answer is lost (a network error after the server took it): the id stays, the retry sends the same id
    const srv = scripted(['network', 200])
    expect(await registerLife(id, env(srv, storage))).toBe(false)
    await flushPending(env(srv, storage))
    expect(srv.calls.map((c) => JSON.parse(c.body).id)).toEqual([id, id])
    expect(pendingOf(storage)).toEqual([])
  })

  it('without an address nothing is stored and nothing is sent, as before', async () => {
    const storage = memory()
    const srv = scripted([200])
    const e: CounterEnv = { ...env(srv, storage), url: '' }
    expect(await registerLife(newLifeId(), e)).toBe(false)
    await flushPending(e)
    expect(await fetchTotal(e)).toBeNull()
    expect(srv.calls).toHaveLength(0)
    expect(storage.getItem(PENDING)).toBeNull()
  })
})