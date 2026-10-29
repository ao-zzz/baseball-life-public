import { describe, expect, it } from 'vitest'
import { createLife, endYear, isPlaying, planYear, resolveDecision, type Sim } from './life.ts'
import { defaultParams } from './params.ts'
import { hashSeed } from './rng.ts'
import type { Decision, LifeState } from './types.ts'

// The end of playing by injury or leaving the team (high school, university) offers a way back, a helper's role or the end
// (screen only: the headless life, and so the fingerprint, keeps the calibrated end).

interface Run {
  s: LifeState
  asked: { age: number; d: Decision; data: Record<string, unknown> }[]
}

function play(seed: number, until: number, headless: boolean, choose?: (d: Decision) => number | undefined): Run {
  const s = createLife({ seed, country: 'JP', pace: 'p15' })
  const sim: Sim = { params: defaultParams(), headless }
  const asked: Run['asked'] = []
  for (let g = 0; g < 130 && s.alive && s.age < until; g++) {
    const plan = planYear(s, sim)
    let d = plan.decision?.decision
    while (d && s.alive) {
      if (d.id === 'jp.quitCross') asked.push({ age: s.age, d, data: { ...(s as unknown as { pending: { data: Record<string, unknown> } }).pending.data } })
      const r = resolveDecision(s, choose?.(d) ?? d.autoIndex, sim)
      d = r.followUp?.decision
    }
    endYear(s)
  }
  return { s, asked }
}

const SEEDS = Array.from({ length: 1500 }, (_, i) => hashSeed(i + 5_200_000))
const found = SEEDS.map((seed) => ({ seed, run: play(seed, 23, false) })).filter((x) => x.run.asked.length > 0)
const keysOf = (r: Run) => String(r.asked[0].data.keys).split(',')

describe('the crossroads at the end of playing', () => {
  it('appears for injury and for leaving, at high school and at university', () => {
    expect(found.length).toBeGreaterThan(20)
    const kinds = new Set(found.map((x) => `${x.run.asked[0].data.from}-${x.run.asked[0].data.injury}`))
    expect(kinds.has('hs-true') || kinds.has('hs-false')).toBe(true)
    expect(kinds.has('univ-true') || kinds.has('univ-false')).toBe(true)
    for (const { run } of found) {
      expect(run.asked.length).toBe(1)
      const d = run.asked[0].d
      expect(d.stop).toBe(true)
      expect(keysOf(run)[d.autoIndex]).toBe('quit')
      expect(keysOf(run)).toContain('back')
      expect(keysOf(run)).toContain('helper')
    }
  })

  it('is not asked in headless lives, and おまかせ gives the same life as the headless one', () => {
    for (const { seed, run } of found.slice(0, 25)) {
      const h = play(seed, 23, true)
      expect(h.asked.length).toBe(0)
      expect(run.s.career.endedAge).toBe(h.s.career.endedAge)
      expect(run.s.career.phase).toBe(h.s.career.phase)
      expect(run.s.career.highestRank).toBe(h.s.career.highestRank)
      expect(run.s.career.yearsPlaying).toBe(h.s.career.yearsPlaying)
    }
  })

  it('"back" puts the team back (or ends again after a relapse), and the injury year has no season', () => {
    let stayed = 0
    let relapsed = 0
    for (const { seed, run } of found) {
      const k = keysOf(run).indexOf('back')
      const r = play(seed, run.asked[0].age + 1, false, (d) => (d.id === 'jp.quitCross' ? k : undefined))
      const isBack = isPlaying(r.s)
      if (isBack) {
        stayed++
        expect(r.s.career.endedAge).toBeNull()
        // (one who comes back in the last year of high school graduates in the same year: the route may already have moved him on)
        if (!(run.asked[0].data.from === 'hs' && run.asked[0].age >= 17)) {
          expect(r.s.career.phase).toBe(run.asked[0].data.from)
          expect(r.s.career.team).toBe(run.asked[0].data.team)
        }
        if (run.asked[0].data.injury === true) expect(r.s.flags?.['quit.back']).toBe(run.asked[0].age)
      } else {
        relapsed++
        expect(r.s.career.endedAge).toBe(run.asked[0].age)
      }
    }
    expect(stayed).toBeGreaterThan(0)
    expect(relapsed).toBeGreaterThan(0)
    expect(stayed).toBeGreaterThan(relapsed)
  })

  it('who comes back does not start working; who ends for good gets the year\'s events in the same year as the headless life', () => {
    const takenOf = (s: LifeState) => s.taken.filter((t) => !/^(jp\.quitCross|jp\.wish|wish\.|jp\.credits|breath|note\.trend)/.test(t)).sort() // (screen-only items left out)
    let back = 0
    for (const { seed, run } of found) {
      const at = run.asked[0].age
      const pick = (key: string) => (d: Decision) => (d.id === 'jp.quitCross' ? keysOf(run).indexOf(key) : undefined)
      const b = play(seed, at + 1, false, pick('back'))
      if (isPlaying(b.s)) {
        back++
        expect(b.s.taken, `seed ${seed}`).not.toContain('work.started')
        expect(b.s.after?.work, `seed ${seed}`).toBeUndefined()
      }
      const q = play(seed, at + 1, false, pick('quit'))
      const h = play(seed, at + 1, true)
      expect(takenOf(q.s), `seed ${seed}`).toEqual(takenOf(h.s))
      expect(q.s.job).toBe(h.s.job)
    }
    expect(back).toBeGreaterThan(0)
  })

  it('who comes back still graduates: no one is left in high school or university for years', () => {
    let graduatedAfterBack = 0
    for (const { seed, run } of found) {
      const k = keysOf(run).indexOf('back')
      const r = play(seed, 26, false, (d) => (d.id === 'jp.quitCross' ? k : undefined))
      expect(['hs', 'univ'], `seed ${seed} ${r.s.career.team}`).not.toContain(r.s.career.phase)
      if (r.s.flags?.['quit.back'] !== undefined && run.asked[0].age >= 17) graduatedAfterBack++
    }
    expect(graduatedAfterBack).toBeGreaterThan(0)
  })

  it('"helper" keeps baseball ended but records the role; "quit" is the calibrated end', () => {
    for (const { seed, run } of found.slice(0, 40)) {
      const k = keysOf(run).indexOf('helper')
      const r = play(seed, run.asked[0].age + 1, false, (d) => (d.id === 'jp.quitCross' ? k : undefined))
      expect(isPlaying(r.s)).toBe(false)
      expect(r.s.career.endedAge).toBe(run.asked[0].age)
      expect(r.s.flags?.['quit.helper']).toBe(run.asked[0].age)
    }
  })
})
