import { describe, expect, it } from 'vitest'
import { createLife, endYear, planYear, playToEnd, resolveDecision, runHeadless, type Sim } from './life.ts'
import { defaultParams } from './params.ts'
import { hashSeed } from './rng.ts'
import type { LifeConfig, LifeState } from './types.ts'

const sim: Sim = { params: defaultParams() }
const cfg = (seed: number, prefecture?: number): LifeConfig => ({ seed, country: 'JP', pace: 'p15', prefecture })

/** One year the way the UI plays it (breath screens and decorative lines included). */
function stepYear(s: LifeState, pick: (choices: number, auto: number) => number) {
  const plan = planYear(s, sim)
  for (const e of plan.events) s.log.push(e.entry)
  let d = plan.decision?.decision
  while (d && s.alive) {
    expect(d.choices.length).toBeGreaterThan(0)
    expect(d.autoIndex).toBeGreaterThanOrEqual(0)
    expect(d.autoIndex).toBeLessThan(d.choices.length)
    const r = resolveDecision(s, pick(d.choices.length, d.autoIndex), sim)
    for (const e of r.events) s.log.push(e.entry)
    d = r.followUp?.decision
  }
  // a child's own savings do not move: household money is the parents' until 18
  if (s.age < 18) expect(s.money).toBe(0)
  endYear(s)
}

function playUi(s: LifeState, pick: (choices: number, auto: number) => number) {
  for (let guard = 0; guard < 130 && s.alive; guard++) stepYear(s, pick)
}

describe('reproducibility (seeded RNG)', () => {
  it('the same seed gives the same life', () => {
    for (const seed of [1, 42, 123456789]) {
      const a = runHeadless(cfg(seed), sim)
      const b = runHeadless(cfg(seed), sim)
      expect(JSON.stringify(b)).toBe(JSON.stringify(a))
    }
  })

  it('the same seed gives the same life when played through the UI path', () => {
    const a = createLife(cfg(777))
    const b = createLife(cfg(777))
    playUi(a, (_, auto) => auto)
    playUi(b, (_, auto) => auto)
    expect(JSON.stringify(b)).toBe(JSON.stringify(a))
  })

  it('different seeds give different lives', () => {
    const names = new Set<string>()
    for (let i = 0; i < 50; i++) {
      const s = runHeadless(cfg(hashSeed(i + 1)), sim)
      names.add(`${s.person.family}${s.person.given}${s.age}${s.career.highestRank}`)
    }
    expect(names.size).toBeGreaterThan(40)
  })

  it('a saved life resumes exactly where it left off', () => {
    const pick = (n: number, auto: number) => (auto + 1) % n
    const straight = createLife(cfg(2024))
    const resumed = createLife(cfg(2024))
    for (let i = 0; i < 25 && resumed.alive; i++) stepYear(resumed, pick)
    // what persist.ts does: JSON round trip
    const restored = JSON.parse(JSON.stringify(resumed)) as LifeState
    playUi(restored, pick)
    playUi(straight, pick)
    expect(JSON.stringify(restored)).toBe(JSON.stringify(straight))
  })

  it('「結果だけ」 reaches the same ending as おまかせ played year by year', () => {
    const fast = createLife(cfg(31337))
    playToEnd(fast, sim)
    const headless = runHeadless(cfg(31337), sim)
    expect(fast.age).toBe(headless.age)
    expect(fast.career.highestRank).toBe(headless.career.highestRank)
    expect(fast.causeOfDeath).toBe(headless.causeOfDeath)
  })
})

describe('lives run to the end', () => {
  it('500 おまかせ lives finish without errors and with a consistent record', () => {
    for (let i = 0; i < 500; i++) {
      const s = runHeadless(cfg(hashSeed(i + 900_000)), sim)
      expect(s.alive).toBe(false)
      expect(s.age).toBeGreaterThanOrEqual(8)
      expect(s.age).toBeLessThan(125)
      expect(s.causeOfDeath).toBeTruthy()
      expect(s.timeline.length).toBe(s.age + 1)
      expect(s.career.highestRank).toBeGreaterThanOrEqual(0)
      expect(s.career.highestRank).toBeLessThanOrEqual(10)
      // the highest rank never goes down along the timeline
      for (let t = 1; t < s.timeline.length; t++) expect(s.timeline[t].rank).toBeGreaterThanOrEqual(s.timeline[t - 1].rank)
      expect(Number.isFinite(s.money)).toBe(true)
      expect(Number.isFinite(s.lifetimeIncome)).toBe(true)
    }
  }, 30_000)

  it('every choice can be taken (first, last, おまかせ) through the UI path', () => {
    const pickers: ((n: number, auto: number) => number)[] = [() => 0, (n) => n - 1, (_, auto) => auto]
    for (let i = 0; i < 60; i++) {
      const s = createLife(cfg(hashSeed(i + 70_000)))
      playUi(s, pickers[i % 3])
      expect(s.alive).toBe(false)
      expect(s.log.at(-1)?.kind).toBe('death')
      for (const e of s.log) expect(e.text.length).toBeGreaterThan(0)
    }
  })
})

describe('male players only (PROJECT_PLAN §2-4)', () => {
  it('every protagonist is born a boy', () => {
    for (let i = 0; i < 300; i++) {
      const s = createLife(cfg(hashSeed(i + 400_000)))
      const plan = planYear(s, sim)
      const birth = plan.events.map((e) => e.entry.text).join('')
      expect(birth).toContain('男の子')
      expect(birth).not.toContain('女の子')
    }
  })

  it('no girls’ or women’s baseball appears in a career', () => {
    for (let i = 0; i < 300; i++) {
      const s = runHeadless(cfg(hashSeed(i + 410_000)), sim)
      const text = s.log.map((e) => e.text).join('\n')
      expect(text).not.toMatch(/女子野球|女子硬式|女子チーム|女子選手/)
    }
  })
})
