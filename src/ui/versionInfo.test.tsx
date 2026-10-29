import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { APP_VERSION, CHANGELOG } from '../data/changelog.ts'
import { VersionInfo } from './VersionInfo.tsx'
import { Intro } from './Intro.tsx'

// The version in the corner of the title page, and its update history: closed at first, a button that says whether it is open, every
// entry of the history inside (opened in the browser by the button; checked there), and no other version written on the page.

describe('the version in the corner', () => {
  it('a button with the version, closed at first, that controls the history', () => {
    const html = renderToStaticMarkup(<VersionInfo />)
    expect(html).toContain(`Ver. ${APP_VERSION}`)
    expect(html).toMatch(/<button[^>]*aria-expanded="false"/)
    const controls = /aria-controls="([^"]+)"/.exec(html)?.[1]
    expect(controls).toBeTruthy()
    expect(html).toMatch(new RegExp(`<section[^>]*id="${controls}"[^>]*hidden`))
    expect(html).toContain('aria-label="更新履歴"')
  })

  it('the history: every version, its day and its changes, newest first', () => {
    const html = renderToStaticMarkup(<VersionInfo />)
    let at = -1
    for (const r of CHANGELOG) {
      const i = html.indexOf(`Ver. ${r.version}</b>`)
      expect(i, r.version).toBeGreaterThan(at)
      at = i
      expect(html).toContain(`dateTime="${r.date}"`)
      for (const c of r.changes) expect(html).toContain(c.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'))
    }
  })

  it('the title page shows it, and no other version', () => {
    const settings = { pace: 'p15' as const, prefecture: -1, theme: 'light' as const, mode: 'normal' as const, stars: 1 }
    const html = renderToStaticMarkup(<Intro settings={settings} onSettings={() => {}} onStart={() => {}} resume={null} onResume={() => {}} onDiscard={() => {}} past={[]} onTheme={() => {}} />)
    expect(html).toContain(`Ver. ${APP_VERSION}`)
    expect(html).not.toMatch(/\bv\d+\.\d+\b/)
  })
})
