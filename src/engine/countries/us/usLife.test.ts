import { describe, expect, it } from 'vitest'
import { createLife, endYear, planYear, resolveDecision, runHeadless, type Sim } from '../../life.ts'
import { defaultParams } from '../../params.ts'
import { hashSeed } from '../../rng.ts'
import type { Decision, LifeState } from '../../types.ts'
import { US_RESOLVERS } from './year.ts'
import { usRng } from './checks.ts'

// Everyday life of a US player during the playing years (PROJECT_PLAN §11.34): meeting someone, a proposal, a place of his own, a
// house. It goes on for the おまかせ and headless lives (own streams `us.life.*`), the steps a player could take differently are
// decisions, and none of it reaches the career.

const headless: Sim = { params: defaultParams(), headless: true }
const screen: Sim = { params: defaultParams() }
const us = (seed: number) => ({ seed, country: 'US' as const, pace: 'p15' as const })
const PLAYING = new Set(['hs', 'univ', 'proMinor', 'pro'])

interface Year {
  age: number
  playing: boolean
  partner?: string
  spouse: boolean
  children: number
  home?: string
}
interface Run {
  s: LifeState
  years: Year[]
  asked: { age: number; id: string }[]
  log: string[]
}

function play(seed: number, sim: Sim, choose?: (d: Decision) => number | undefined): Run {
  const s = createLife(us(seed))
  const out: Run = { s, years: [], asked: [], log: [] }
  for (let g = 0; g < 130 && s.alive; g++) {
    const plan = planYear(s, sim)
    for (const e of plan.events) out.log.push(e.entry.text)
    let d = plan.decision?.decision
    while (d && s.alive) {
      out.asked.push({ age: s.age, id: d.id })
      const r = resolveDecision(s, choose?.(d) ?? d.autoIndex, sim)
      for (const e of r.events) out.log.push(e.entry.text)
      d = r.followUp?.decision
    }
    out.years.push({ age: s.age, playing: PLAYING.has(s.career.phase), partner: s.family.partner, spouse: !!s.family.spouse, children: s.family.children, home: s.after?.home })
    endYear(s)
  }
  return out
}

/** US lives that are still playing at 22 or later (the minors and the majors) */
function pros(n: number): number[] {
  const out: number[] = []
  for (let i = 0; out.length < n && i < 40_000; i++) {
    const seed = hashSeed(i + 14_000_000)
    // (only the playing years matter here: stop when baseball ends)
    const s = runHeadless(us(seed), headless, true)
    if (s.timeline.some((t) => t.age >= 22 && PLAYING.has(t.phase))) out.push(seed)
  }
  return out
}

const SEEDS = pros(40)
const AUTO = SEEDS.map((seed) => play(seed, headless))

describe('everyday life while playing (US)', () => {
  it('there are players to look at', () => {
    expect(SEEDS.length).toBeGreaterThanOrEqual(20)
  })

  it('goes on without any choice: a partner, a marriage, children, a place of his own, while still playing', () => {
    const playing = AUTO.flatMap((r) => r.years.filter((y) => y.playing && y.age >= 20))
    expect(playing.some((y) => y.partner)).toBe(true)
    expect(playing.some((y) => y.spouse)).toBe(true)
    expect(playing.some((y) => y.children > 0)).toBe(true)
    expect(playing.some((y) => y.home === 'rent')).toBe(true)
  })

  it('the proposal is a decision whose おまかせ answer is the headless life; a marriage is told once', () => {
    expect(AUTO.some((r) => r.asked.some((a) => a.id === 'us.propose'))).toBe(true)
    for (const r of AUTO) {
      // (a divorce, us.divorce of §11.35, allows a second marriage)
      const ended = r.log.filter((x) => /さんと離婚しました|先立たれました/.test(x)).length
      expect(r.log.filter((x) => /さんと結婚しました。/.test(x)).length, `seed ${r.s.config.seed}`).toBeLessThanOrEqual(1 + ended)
    }
    for (const seed of SEEDS.slice(0, 12)) {
      const ui = play(seed, screen).s
      const fast = runHeadless(us(seed), headless)
      expect(ui.age).toBe(fast.age)
      expect(ui.money).toBe(fast.money)
      expect(ui.family).toEqual(fast.family)
      expect(ui.after?.home).toBe(fast.after?.home)
      expect(ui.career.highestRank).toBe(fast.career.highestRank)
    }
  })

  it('a different answer on screen makes a different life at home, and the career is the same', () => {
    let differed = 0
    for (const seed of SEEDS) {
      const base = play(seed, screen)
      const other = play(seed, screen, (d) => (d.id === 'us.propose' ? d.choices.length - 1 : d.id === 'us.home' ? 1 : undefined))
      // the career (what the checks and the seasons decide) does not know the family
      expect(other.s.career.highestRank).toBe(base.s.career.highestRank)
      expect(other.s.career.endedAge).toBe(base.s.career.endedAge)
      // (the years of the career; how long he lives afterwards is mortality, which the family's happiness may move)
      const phases = (r: Run) => r.s.timeline.filter((t) => t.phase !== 'retired').map((t) => t.phase).join()
      expect(phases(other)).toBe(phases(base))
      expect(other.s.career.achievements.filter((a) => a !== '孫')).toEqual(base.s.career.achievements.filter((a) => a !== '孫'))
      if (JSON.stringify(other.s.family) !== JSON.stringify(base.s.family)) differed++
    }
    expect(differed).toBeGreaterThan(0)
  })

  it('uses streams of its own: the same life has the same chances whatever else happened', () => {
    const s = createLife(us(5))
    const a = usRng(s, 'us.life.meet').next()
    s.money += 12345
    s.status.happiness = 50
    expect(usRng(s, 'us.life.meet').next()).toBe(a)
    expect(usRng(s, 'us.life.breakup').next()).not.toBe(a)
    s.age++
    expect(usRng(s, 'us.life.meet').next()).not.toBe(a)
  })
})

describe('the decisions guard the state', () => {
  /** a decision waiting for its answer (as planYear leaves it) */
  const withPending = (s: LifeState, p: { id: string; data: Record<string, string> }) => {
    ;(s as unknown as { pending: unknown }).pending = p
  }

  it('no second marriage, no proposal to nobody; a house only from a rented home', () => {
    const run = play(SEEDS[0], screen)
    const s = run.s
    // a married man answering a proposal that is no longer there changes nothing
    const married = createLife(us(9))
    married.family.spouse = { name: 'Emily', years: 3 }
    married.family.partner = 'Grace'
    married.family.everMarried = true
    withPending(married, { id: 'us.propose', data: { name: 'Grace' } })
    const before = JSON.stringify(married.family)
    resolveDecision(married, 0, screen)
    expect(JSON.stringify(married.family)).toBe(before)
    // no home change from a house he already owns
    const owner = createLife(us(10))
    owner.after = { home: 'own', loan: 0 } as unknown as LifeState['after']
    withPending(owner, { id: 'us.home', data: {} })
    resolveDecision(owner, 0, screen)
    expect(owner.after?.home).toBe('own')
    expect(US_RESOLVERS['us.propose']).toBeDefined()
    expect(US_RESOLVERS['us.home']).toBeDefined()
    expect(s.family.spouse === null || typeof s.family.spouse.name === 'string').toBe(true)
  })

  it('the Japanese lives never meet these questions', () => {
    for (let i = 0; i < 40; i++) {
      const s = runHeadless({ seed: hashSeed(i + 15_000_000), country: 'JP', pace: 'p15' }, headless)
      expect(s.taken).not.toContain('us.propose')
      expect(s.taken).not.toContain('us.home')
      expect(s.flags?.['us.dating']).toBeUndefined()
    }
  })
})
