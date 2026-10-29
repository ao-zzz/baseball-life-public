import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createLife, endYear, planYear, resolveDecision, runHeadless, type Sim } from './life.ts'
import { defaultParams } from './params.ts'
import { hashSeed } from './rng.ts'
import type { LifeState } from './types.ts'
import { ProYears } from '../ui/ProPanels.tsx'
import { RecordsPanel } from '../ui/Records.tsx'

// A Japanese player's MLB years (phase 'abroad') are kept as his NPB seasons are (careerSeason.ts mlbSeason): a row of games for each
// year in the majors, an MLB total apart from the NPB 1軍's, and the pro table shows them. The calibrated draws are guarded by the
// fingerprint (scripts/fingerprint.ts); this file checks the record and the screen.

const sim: Sim = { params: defaultParams(), headless: true }
const mlbYears = (s: LifeState) => (s.career.salaryHist ?? []).filter((h) => h.kind === 'mlb')

/** the same life played as on screen (おまかせ answers), its lines kept in the log as the screen keeps them */
function onScreen(seed: number): LifeState {
  const screen: Sim = { params: defaultParams() }
  const s = createLife({ seed, country: 'JP', pace: 'p15', mode: 'potential', stars: 10 })
  for (let g = 0; g < 130 && s.alive; g++) {
    const plan = planYear(s, screen)
    for (const e of plan.events) s.log.push(e.entry)
    let d = plan.decision?.decision
    while (d && s.alive) {
      const r = resolveDecision(s, d.autoIndex, screen)
      for (const e of r.events) s.log.push(e.entry)
      d = r.followUp?.decision
    }
    endYear(s)
  }
  return s
}

describe('a Japanese player in the MLB', () => {
  // found without a screen (quick), then played as on screen for the lines
  const lives: LifeState[] = []
  for (let i = 0; i < 6000 && lives.length < 12; i++) {
    const seed = hashSeed(i + 9_400_000)
    if (mlbYears(runHeadless({ seed, country: 'JP', pace: 'p15', mode: 'potential', stars: 10 }, sim)).length >= 2) lives.push(onScreen(seed))
  }

  it('every MLB year has its games in the record, or a line that he did not play in the majors that year', () => {
    expect(lives.length).toBeGreaterThan(5)
    let rows = 0
    for (const s of lives) {
      const mlb = s.bb!.rec!.tournaments.filter((t) => t.level === 'mlb')
      rows += mlb.length
      for (const h of mlbYears(s)) {
        const row = mlb.find((t) => t.age === h.age)
        const none = s.log.some((e) => e.age === h.age && /メジャーの試合には出場できませんでした/.test(e.text))
        expect(!!row !== none, `${s.config.seed} age ${h.age}`).toBe(true)
        if (row) expect(s.log.some((e) => e.age === h.age && e.text.startsWith('メジャー') && e.text.includes('MLBで'))).toBe(true)
      }
      // no MLB games in a year he was not in the majors
      for (const t of mlb) expect(mlbYears(s).some((h) => h.age === t.age)).toBe(true)
    }
    expect(rows).toBeGreaterThan(10)
  })

  it('the MLB total is the sum of the MLB years, and the NPB 1軍 total keeps only the NPB years', () => {
    for (const s of lives) {
      const rec = s.bb!.rec!
      const sum = (level: 'pro' | 'mlb', k: 'games' | 'h' | 'outs' | 'hr') => rec.tournaments.filter((t) => t.level === level).reduce((a, t) => a + t.line[k], 0)
      for (const k of ['games', 'h', 'outs', 'hr'] as const) {
        expect(rec.official.mlb?.[k] ?? 0).toBe(sum('mlb', k))
        expect(rec.official.pro?.[k] ?? 0).toBe(sum('pro', k))
      }
    }
  })

  it('the pro table has an MLB row for each year in the majors and an MLB total; the record panel shows MLB apart', () => {
    for (const s of lives.filter((x) => x.bb!.rec!.official.mlb)) {
      const html = renderToStaticMarkup(<ProYears life={s} />)
      const rows = s.bb!.rec!.tournaments.filter((t) => t.level === 'mlb')
      expect(html.match(/<td>MLB<\/td>/g)?.length ?? 0).toBe(rows.length + 1)
      expect(html).not.toContain('MLBの試合はモデルで再現していません')
      expect(html).toContain('NPBより強い相手を想定したゲーム上の仮定で生成しています。実在のMLBの記録ではありません。')
      expect(renderToStaticMarkup(<RecordsPanel life={s} />)).toContain('MLB')
    }
  })
})

describe('a Cuban player in the MLB', () => {
  it('his MLB and minor league seasons are named so in the table (they used to show as 1軍 and 2軍)', () => {
    let met = 0
    for (let i = 0; i < 3000 && met < 3; i++) {
      const s = runHeadless({ seed: hashSeed(i + 9_500_000), country: 'CU', pace: 'p15' }, sim)
      const rows = (s.bb?.rec?.tournaments ?? []).filter((t) => t.level === 'pro' || t.level === 'farm')
      const majors = rows.filter((t) => t.name === 'MLBのシーズン').length
      const minors = rows.filter((t) => t.name === 'マイナーのシーズン').length
      if (!majors && !minors) continue
      met++
      const html = renderToStaticMarkup(<ProYears life={s} />)
      // (a year paid in the majors without games shows MLB too)
      expect(html.match(/<td>MLB<\/td>/g)?.length ?? 0).toBeGreaterThanOrEqual(majors)
      expect(html.match(/<td>マイナー<\/td>/g)?.length ?? 0).toBeGreaterThanOrEqual(minors)
    }
    expect(met).toBeGreaterThan(0)
  }, 60_000)
})
