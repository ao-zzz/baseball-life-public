import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { STATS } from '../data/stats.ts'
import { createLife, endYear, planYear, resolveDecision, type Sim } from '../engine/life.ts'
import { defaultParams } from '../engine/params.ts'
import { hashSeed } from '../engine/rng.ts'
import type { LifeState, LogEntry } from '../engine/types.ts'
import { LifeScreen } from './LifeScreen.tsx'
import { usedStatIds } from './usedStats.ts'

// The panel 「この人生に出てきた統計」 with a save that names statistics this version does not know (a save made by another
// version, or an id since removed): the unknown ids are skipped, the known ones show as before, in the same order.

const sim: Sim = { params: defaultParams() }
const noop = () => {}
// ids a later version could add, and names an object already has (not statistics either)
const UNKNOWN = ['futureStat2027', 'npbSomethingNew', 'toString', '__proto__', 'constructor']
const UNKNOWN_PLAIN = UNKNOWN.slice(0, 2)

/** the panel's ids as they were worked out before unknown ids were skipped (the code of 1.0.0) */
const before = (log: LogEntry[]) => {
  const ids = new Set<string>()
  for (const e of log) e.statIds?.forEach((id) => ids.add(id))
  return [...ids].slice(-8)
}

/** a life played by おまかせ as on screen for some years, saved and read back as the browser does (persist.ts: JSON) */
function savedLife(seed: number, years: number): LifeState {
  const s = createLife({ seed: hashSeed(seed), country: 'JP', pace: 'p15' })
  for (let g = 0; g < years && s.alive; g++) {
    const plan = planYear(s, sim)
    for (const e of plan.events) s.log.push(e.entry)
    let d = plan.decision?.decision
    while (d && s.alive) {
      const r = resolveDecision(s, d.autoIndex, sim)
      for (const e of r.events) s.log.push(e.entry)
      d = r.followUp?.decision
    }
    endYear(s)
  }
  return JSON.parse(JSON.stringify(s)) as LifeState
}

/** the same save with unknown ids among its lines: beside known ids, alone, and in the last line */
function withUnknown(s: LifeState, unknown = UNKNOWN): LifeState {
  const t = JSON.parse(JSON.stringify(s)) as LifeState
  t.log.forEach((e, i) => {
    if (i % 3 === 0) e.statIds = [...(e.statIds ?? []), unknown[i % unknown.length]]
  })
  t.log.at(-1)!.statIds = [unknown[0], ...(t.log.at(-1)!.statIds ?? []), unknown[1]]
  return t
}

const screen = (life: LifeState) =>
  renderToStaticMarkup(<LifeScreen life={life} sim={sim} cohort={null} cohortProgress={0} onDeath={noop} onQuit={noop} onTheme={noop} />)

describe('the statistics a life has used (unknown ids)', () => {
  it('a save of known ids only: the same ids in the same order as before', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = savedLife(seed, 30)
      const ids = usedStatIds(s.log)
      expect(ids.length).toBeGreaterThan(0)
      expect(ids).toEqual(before(s.log))
    }
  })

  it('unknown ids are skipped, and the known ones keep their place', () => {
    for (const seed of [1, 2, 3]) {
      const s = savedLife(seed, 30)
      const t = withUnknown(s)
      // the code of 1.0.0 put them in the panel and read their date: the crash of a save from a newer version
      expect(before(t.log).some((id) => !Object.hasOwn(STATS, id))).toBe(true)
      expect(() => before(t.log).map((id) => STATS[id].asOf.slice(0, 7))).toThrow()
      expect(usedStatIds(t.log)).toEqual(usedStatIds(s.log))
      for (const id of usedStatIds(t.log)) expect(STATS[id].asOf).toBeTruthy()
    }
  })

  it('only unknown ids: no statistic, so no panel', () => {
    expect(usedStatIds([{ statIds: ['futureStat2027'] }, {}, { statIds: ['toString', '__proto__'] }])).toEqual([])
  })

  it('more than 8 known ids with unknown ones between them: the last 8 known', () => {
    const known = Object.keys(STATS).slice(0, 12)
    const log = known.flatMap((id, i) => [{ statIds: [id] }, { statIds: [`futureStat${i}`] }])
    expect(usedStatIds(log)).toEqual(known.slice(-8))
  })

  // (the whole screen with the ids a later version could add; the lines' 資料 rows read ids through common.tsx SourceLine, which
  // this round does not touch)
  it('the life screen opens such a save without an error and shows what it shows without the unknown ids', () => {
    const s = savedLife(2, 30)
    const html = screen(s)
    expect(html).toContain('この人生に出てきた統計')
    const esc = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
    for (const id of usedStatIds(s.log)) expect(html).toContain(esc(STATS[id].definition))
    const t = withUnknown(s, UNKNOWN_PLAIN)
    expect(() => screen(t)).not.toThrow()
    expect(screen(t)).toBe(html)
    expect(screen(t)).not.toContain('futureStat2027')
  })
})
