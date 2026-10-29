import { Fragment, cloneElement, type ReactElement, type ReactNode } from 'react'
import { t, type Key, type Params } from './index.ts'

/**
 * A text of the screens (src/i18n) with parts drawn as elements: `<x>…</x>` becomes the screen's element `tags.x` holding that part,
 * `<x/>` the element alone. Each language orders its parts as it needs; the elements (their class, link and so on) stay the screen's.
 */
export function Rich({ k, params, tags = {} }: { k: Key; params?: Params; tags?: Record<string, ReactElement<{ children?: ReactNode }>> }) {
  const text = t(k, params)
  const root: ReactNode[] = []
  const stack: { name: string; children: ReactNode[] }[] = []
  const here = () => (stack.length ? stack[stack.length - 1].children : root)
  let at = 0
  let n = 0
  for (const m of text.matchAll(/<(\/?)(\w+)(\/?)>/g)) {
    if (m.index > at) here().push(text.slice(at, m.index))
    at = m.index + m[0].length
    const [, close, name, selfClose] = m
    const el = tags[name]
    if (!el) here().push(m[0])
    else if (selfClose) here().push(cloneElement(el, { key: n++ }))
    else if (!close) stack.push({ name, children: [] })
    else {
      const open = stack.pop()
      if (open) here().push(cloneElement(tags[open.name], { key: n++ }, ...open.children))
    }
  }
  if (at < text.length) here().push(text.slice(at))
  return <Fragment>{root}</Fragment>
}
