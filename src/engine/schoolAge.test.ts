import { describe, expect, it } from 'vitest'
import { createLife, endYear, planYear, resolveDecision, univRepeatP, type Sim } from './life.ts'
import { defaultParams } from './params.ts'
import { hashSeed } from './rng.ts'
import type { Decision, LifeState } from './types.ts'

// Ages, stages, 浪人 and 留年 (PROJECT_PLAN §11.25). The model's age is the age at the start of the school year, so the stages
// run (school-year-end ages in brackets): 小学 6〜11 [7〜12], 中学 12〜14 [13〜15], 高校 15〜17 [16〜18], 大学 18〜21 [19〜22].
// 浪人 and 留年 exist on screen only: the headless lives (and so the fingerprint) keep every calibrated year.

function play(seed: number, until: number, headless: boolean, choose?: (d: Decision) => number | undefined): { s: LifeState; asked: { age: number; id: string }[] } {
  const s = createLife({ seed, country: 'JP', pace: 'p15' })
  const sim: Sim = { params: defaultParams(), headless }
  const asked: { age: number; id: string }[] = []
  for (let g = 0; g < 130 && s.alive && s.age < until; g++) {
    const plan = planYear(s, sim)
    let d = plan.decision?.decision
    while (d && s.alive) {
      asked.push({ age: s.age, id: d.id })
      d = resolveDecision(s, choose?.(d) ?? d.autoIndex, sim).followUp?.decision
    }
    endYear(s)
  }
  return { s, asked }
}

const RANGE: Record<string, [number, number]> = { child: [0, 11], youth: [0, 11], jhs: [12, 14], hs: [15, 17] }
const SEEDS = Array.from({ length: 2500 }, (_, i) => hashSeed(i + 6_300_000))

function stageProblems(s: LifeState): string[] {
  const out: string[] = []
  // (an entry is written at the end of its year, after the year's choices: the stage played in a year is the previous entry's)
  const played = s.timeline.map((t, i) => ({ age: t.age, phase: i > 0 ? s.timeline[i - 1].phase : 'child' }))
  for (const t of played) {
    const r = RANGE[t.phase]
    if (r && (t.age < r[0] || t.age > r[1])) out.push(`${t.phase} at ${t.age}`)
    if (t.phase === 'univ' && t.age < 18) out.push(`univ at ${t.age}`)
  }
  const univ = played.filter((t) => t.phase === 'univ')
  // (4 years, plus a 浪人 year and a repeated year at most)
  if (univ.length > 4 + 2) out.push(`${univ.length} university years`)
  if (s.career.endedAge !== null && s.career.endedAge < s.career.startedAge) out.push('ended before started')
  return out
}

describe('the stages and their ages', () => {
  it('every calibrated (headless) life keeps its stages within the ages, with no 浪人 and no 留年', () => {
    for (const seed of SEEDS.slice(0, 600)) {
      const { s } = play(seed, 30, true)
      expect(stageProblems(s), `seed ${seed}`).toEqual([])
      expect(s.flags?.['univ.ronin']).toBeUndefined()
      expect(s.flags?.['univ.repeat']).toBeUndefined()
      // (the university lasts four years exactly in these lives)
      expect(s.timeline.filter((t) => t.phase === 'univ').length).toBeLessThanOrEqual(4 + 1)
    }
  })

  it('screen lives, with every choice of their own, stay within the stages too', () => {
    for (const seed of SEEDS.slice(0, 600)) {
      const { s } = play(seed, 30, false)
      expect(stageProblems(s), `seed ${seed}`).toEqual([])
    }
  })
})

describe('浪人', () => {
  // the player walks the road that meets the general exam: a university with a tryout, aiming at the hardest school
  const idx = (d: Decision, re: RegExp) => {
    const i = d.choices.findIndex((c) => re.test(c.label))
    return i >= 0 ? i : undefined
  }
  const road = (answer: number) => (d: Decision) =>
    d.id === 'jp.route' ? idx(d, /入部テスト/) : d.id === 'jp.univPick' ? idx(d, /挑戦校/) : d.id === 'jp.ronin' ? answer : undefined
  const ronin = SEEDS.map((seed) => ({ seed, run: play(seed, 30, false, road(1)) })).filter((x) => x.run.asked.some((a) => a.id === 'jp.ronin'))

  it('is offered after a missed first choice at the general exam, and not more than once', () => {
    expect(ronin.length).toBeGreaterThan(3)
    for (const { seed, run } of ronin) {
      expect(run.asked.filter((a) => a.id === 'jp.ronin').length, `seed ${seed}`).toBe(1)
      expect(run.s.flags?.['univ.ronin']).toBeDefined()
    }
  })

  it('costs exactly one year: a year outside the university, then year 1 a year later, then the university is left on time', () => {
    for (const { seed, run } of ronin) {
      const at = run.asked.find((a) => a.id === 'jp.ronin')!.age
      expect(at, `seed ${seed}`).toBe(17)
      // the 浪人 year is age 18 (no school yet), the school is entered at age 19
      const ent = run.s.schools?.univ
      if (ent) {
        // year 1 is played at age 19 (a year later than the calibrated 18)
        const y1 = play(seed, 20, false, road(1))
        // (a failed tryout ends the playing: the team is then empty)
        if (y1.s.career.endedAge === null) expect(y1.s.career.team, `seed ${seed}`).toMatch(/^大学1年/)
        // (the exam is sat again at the end of the 浪人 year, age 18)
        expect(y1.s.career.endedAge === null || y1.s.career.endedAge >= 18, `seed ${seed}`).toBe(true)
      }
      expect(stageProblems(run.s), `seed ${seed}`).toEqual([])
    }
  })

  it('"go to the safe school" is the おまかせ answer and enters the same year as before', () => {
    for (const { seed } of ronin.slice(0, 10)) {
      const r = play(seed, 19, false, road(0))
      expect(r.s.flags?.['univ.ronin'], `seed ${seed}`).toBeUndefined()
      if (r.s.career.endedAge === null) expect(r.s.career.team, `seed ${seed}`).toMatch(/^大学1年/)
      expect(r.s.schools?.univ).toBeDefined()
    }
  })
})

describe('留年', () => {
  it('is rarer for a sports recommendation (an assumption), and bounded', () => {
    expect(univRepeatP('sports')).toBeLessThan(univRepeatP('general'))
    expect(univRepeatP('sports')).toBeLessThan(univRepeatP('recommend'))
    expect(univRepeatP('general')).toBeGreaterThan(0)
    expect(univRepeatP('general')).toBeLessThan(0.5)
  })

  // a player who goes to a university team and puts baseball before his credits
  const risky = (d: Decision) => (d.id === 'jp.route' ? d.choices.findIndex((c) => /大学で野球を続ける|入部テスト/.test(c.label)) : d.id === 'jp.credits' ? 1 : undefined)
  const all = SEEDS.map((seed) => ({ seed, run: play(seed, 32, false, (d) => { const i = risky(d); return i !== undefined && i >= 0 ? i : undefined }) }))
  const repeated = all.filter((x) => x.run.s.flags?.['univ.repeat'] !== undefined)

  it('is only the result of a choice: the おまかせ answer (study) is never held back', () => {
    const asked = all.filter((x) => x.run.asked.some((a) => a.id === 'jp.credits'))
    expect(asked.length).toBeGreaterThan(10)
    for (const { seed } of asked.slice(0, 30)) {
      const r = play(seed, 32, false, (d) => { const i = risky(d); return d.id === 'jp.credits' ? 0 : i !== undefined && i >= 0 ? i : undefined })
      expect(r.s.flags?.['univ.repeat'], `seed ${seed}`).toBeUndefined()
    }
  })

  it('holds a year once, shifts the later years by one, and still graduates and chooses a route', () => {
    expect(repeated.length).toBeGreaterThan(3)
    for (const { seed, run } of repeated) {
      const s = run.s
      expect(s.flags!['univ.repeat']).toBe(2)
      expect(run.asked.filter((a) => a.id === 'jp.credits').length, `seed ${seed}`).toBe(1)
      const univ = s.timeline.filter((t) => t.phase === 'univ')
      // (a player who left the team in between has fewer years)
      expect(univ.length >= 5 || (s.career.endedAge !== null && s.career.endedAge < 22), `seed ${seed}`).toBe(true)
      expect(stageProblems(s), `seed ${seed}`).toEqual([])
      // nobody is left at the university: by 32 he has moved on or ended baseball
      expect(s.career.phase, `seed ${seed}`).not.toBe('univ')
      expect(s.career.endedAge === null || s.career.endedAge >= 19).toBe(true)
    }
  })
})
