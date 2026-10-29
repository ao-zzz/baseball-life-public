import { useEffect, useState } from 'react'
import { COUNTER_URL, fetchTotal, flushPending } from '../game/liveCounter.ts'
import { num, t } from '../i18n/index.ts'
import { Rich } from '../i18n/Rich.tsx'

// 「これまでに何人の野球人生が始まったか」 on the title page (PROJECT_PLAN §11.51). Nothing is shown when no counter is set up
// (no VITE_COUNTER_URL): there is no stand-in number. While it is read: 「集計中…」; when it cannot be read: a plain line.

export type CounterState = { status: 'loading' } | { status: 'ok'; total: number } | { status: 'error' }

export function CounterLine({ state }: { state: CounterState }) {
  return (
    <p className="lifecount" aria-live="polite">
      {state.status === 'ok' ? (
        <Rich k="counter.ok" params={{ n: num(state.total) }} tags={{ n: <b className="num" /> }} />
      ) : state.status === 'loading' ? (
        <span className="muted">{t('counter.loading')}</span>
      ) : (
        <span className="muted">{t('counter.error')}</span>
      )}
    </p>
  )
}

export function LifeCounter({ url = COUNTER_URL }: { url?: string }) {
  const [state, setState] = useState<CounterState>({ status: 'loading' })
  useEffect(() => {
    if (!url) return
    let live = true
    // (ids that were not taken the last time are sent again first)
    void flushPending().then(() => fetchTotal()).then((n) => live && setState(n === null ? { status: 'error' } : { status: 'ok', total: n }))
    return () => {
      live = false
    }
  }, [url])
  if (!url) return null
  return <CounterLine state={state} />
}
