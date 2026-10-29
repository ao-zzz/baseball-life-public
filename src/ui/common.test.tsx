import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { STATS } from '../data/stats.ts'
import { FactBox, KindBadge, SourceLine } from './common.tsx'
import { Intro } from './Intro.tsx'
import { statusOf } from './statStatus.ts'

// Unverified values are never presented as fact (PROJECT_PLAN §6.1): wherever a statistic is shown,
// its kind is labelled; unverified data carries 「未確認」, and data without a sex breakdown carries 「参考値」.

describe('labels on displayed statistics', () => {
  for (const s of Object.values(STATS)) {
    it(s.id, () => {
      const html = renderToStaticMarkup(<KindBadge stat={s} />)
      expect(html).toContain({ measured: '実測', estimate: '推定', assumption: '仮定' }[s.kind])
      const st = statusOf(s)
      if (st === 'unverified') expect(html).toContain('未確認')
      if (st === 'reference') {
        expect(html).toContain('参考値')
        expect(html).not.toContain('未確認')
      }
      // a figure without a sex breakdown never shows as a plain (confirmed) figure
      if (s.sex === 'unstated' && s.kind !== 'assumption') expect(st).not.toBeNull()
      if (s.sex === 'unknown' && s.kind !== 'assumption') expect(st).toBe('unverified')
    })
  }

  it('fact boxes carry the source and the 未確認 label', () => {
    const html = renderToStaticMarkup(<FactBox text="t" ids={['elbowYouth']} />)
    expect(html).toContain('出典')
    expect(html).toContain('未確認')
  })

  it('fact boxes built on figures without a sex breakdown say so', () => {
    const html = renderToStaticMarkup(<FactBox text="t" ids={['jpTeamsTotal']} />)
    expect(html).toContain('参考値')
    expect(html).toContain('男女の区分の記載がない')
  })

  it('fact boxes built on assumptions say so', () => {
    const html = renderToStaticMarkup(<FactBox text="t" ids={['jpJhsContinue']} />)
    expect(html).toContain('仮定')
  })

  it('log source lines carry the label', () => {
    const html = renderToStaticMarkup(<SourceLine ids={['jpHsComplete']} />)
    expect(html).toContain('資料')
    expect(html).toContain('参考値')
  })

  it('the title page labels the denominator and every funnel stage', () => {
    const noop = () => {}
    const html = renderToStaticMarkup(
      <Intro settings={{ pace: 'p15', prefecture: -1, theme: 'auto', mode: 'normal', stars: 1 }} onSettings={noop} onStart={noop} resume={null} onResume={noop} onDiscard={noop} past={[]} onTheme={noop} />,
    )
    expect(html).toContain('124,116')
    expect(html).toContain('プロになる確率でも、成功する確率でもありません')
    // one badge per funnel row plus the denominator
    const badges = html.match(/class="badge (measured|estimate|assumption)"/g) ?? []
    expect(badges.length).toBeGreaterThanOrEqual(7)
    expect(html).toContain('参考値')
    expect(html).not.toMatch(/約\d+(万)?人に1人/)
  })
})
