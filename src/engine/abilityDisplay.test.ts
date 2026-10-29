import { describe, expect, it } from 'vitest'
import { makeRng } from './rng.ts'
import { abilityOverall, abilityScore, initBaseball, skillsFor, velocityKmh, velocityScore, VELOCITY_REF_KMH, VELOCITY_WEIGHT } from './ability.ts'
import { createLife } from './life.ts'
import { evaluate } from './route/rating.ts'
import type { LifeState, SkillKey } from './types.ts'

// The shown speed and the shown overall of a pitcher (PROJECT_PLAN §11.51): 150 km/h is 50, speed counts double in a pitcher's overall.
// For the screen only: the draft's evaluation and the stage checks read z and are not touched.

function pitcher(age = 25): LifeState {
  const s = createLife({ seed: 5, country: 'JP', pace: 'p15' })
  s.person.position = 'P'
  s.bb = initBaseball(s, makeRng(5))
  s.age = age
  return s
}

/** a pitcher whose shown speed is as near `kmh` as the speed profile can make it */
function throwing(kmh: number, age = 25): LifeState {
  const s = pitcher(age)
  let lo = -6
  let hi = 6
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    s.bb!.skills.velocity = mid
    if (velocityKmh(s) < kmh) lo = mid
    else hi = mid
  }
  s.bb!.skills.velocity = hi
  return s
}

describe('the shown speed: 150 km/h is 50', () => {
  it('150 km/h is 50, 2 points a km/h, and the score is monotone in the speed', () => {
    expect(velocityScore(throwing(150))).toBe(50)
    expect(abilityScore(throwing(150), 'velocity')).toBe(50)
    expect(velocityScore(throwing(160))).toBe(70)
    expect(velocityScore(throwing(140))).toBe(30)
    let last = -1
    for (const kmh of [120, 130, 135, 140, 145, 148, 150, 152, 155, 160, 165]) {
      const sc = velocityScore(throwing(kmh))
      expect(sc, `${kmh}`).toBeGreaterThanOrEqual(last)
      last = sc
    }
    expect(VELOCITY_REF_KMH).toBe(150)
  })

  it('the score is read from the km/h the screen shows, at every age', () => {
    for (const age of [14, 17, 20, 25, 33]) {
      const s = throwing(145, age)
      expect(velocityScore(s)).toBe(Math.max(1, Math.min(99, Math.round(50 + 2 * (velocityKmh(s) - 150)))))
    }
  })
})

describe('the shown overall', () => {
  it('a pitcher\'s speed counts double; the others\' overall is the plain mean', () => {
    const p = throwing(155)
    const keys = skillsFor('P')
    const w = (k: SkillKey) => (k === 'velocity' ? VELOCITY_WEIGHT : 1)
    const want = Math.round(keys.reduce((a, k) => a + w(k) * abilityScore(p, k), 0) / keys.reduce((a, k) => a + w(k), 0))
    expect(abilityOverall(p)).toBe(want)
    // faster at the same other skills: a higher overall; speed moves it more than another skill of the same score change does
    const slow = throwing(140)
    slow.bb!.skills = { ...p.bb!.skills, velocity: slow.bb!.skills.velocity }
    expect(abilityOverall(p)).toBeGreaterThan(abilityOverall(slow))
    // a fielder: no speed in it, the plain mean as before
    const f = pitcher()
    f.person.position = 'IF'
    const ks = skillsFor('IF').filter((k) => k !== 'velocity')
    expect(abilityOverall(f)).toBe(Math.round(ks.reduce((a, k) => a + abilityScore(f, k), 0) / ks.length))
  })

  it('a pitcher with only speed and weak control is not rated far above the same pitcher with the same overall skills', () => {
    const fast = throwing(160)
    const slowAll = throwing(140)
    // speed 160 (70) with the others at their own level is higher than speed 140 (30) with the same others, by (70-30)*2/5 = 16 at most
    const d = abilityOverall(fast) - abilityOverall(slowAll)
    expect(d).toBeGreaterThan(0)
    expect(d).toBeLessThanOrEqual(17)
  })
})

describe('what is not touched', () => {
  it('showing the speed and the overall changes nothing in the state, and the draft\'s evaluation is the same before and after', () => {
    const a = throwing(135)
    const before = structuredClone(a)
    const ev = evaluate(a).total
    for (const k of skillsFor('P')) abilityScore(a, k)
    abilityOverall(a)
    velocityScore(a)
    expect(a).toEqual(before)
    expect(evaluate(a).total).toBe(ev)
    // (the evaluation reads z and the skills as they were: a faster pitcher is evaluated by the old rules, not by the shown number)
    expect(typeof ev).toBe('number')
  })
})
