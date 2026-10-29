import { describe, expect, it } from 'vitest'
import { EVENTS, createLife, endYear, planYear, resolveDecision, runHeadless, type Sim } from './life.ts'
import { defaultParams } from './params.ts'
import { hashSeed } from './rng.ts'
import type { LifeState } from './types.ts'
import type { EventStage } from './events.ts'
import { lifeMetrics, type LifeMetrics } from './metrics.ts'

// Event catalog and scheduler (PROJECT_PLAN §11.2, stage 1).

const sim: Sim = { params: defaultParams() }
/** event ids the engine writes itself (tournament squads etc.), not drawn by the scheduler */
const ENGINE_TAGS = ['hs.roster']
const STAGES: EventStage[] = ['child', 'youth', 'jhs', 'hs', 'univ', 'amateur', 'pro', 'student', 'adult', 'senior']

function playUi(seed: number): { s: LifeState; m: LifeMetrics } {
  const s = createLife({ seed, country: 'JP', pace: 'p15' })
  const decisions: { age: number; id: string; choices: number }[] = []
  for (let g = 0; g < 130 && s.alive; g++) {
    const plan = planYear(s, sim)
    for (const e of plan.events) s.log.push(e.entry)
    let d = plan.decision?.decision
    while (d && s.alive) {
      decisions.push({ age: s.age, id: d.id, choices: d.choices.length })
      const r = resolveDecision(s, d.autoIndex, sim)
      for (const e of r.events) s.log.push(e.entry)
      d = r.followUp?.decision
    }
    endYear(s)
  }
  return { s, m: lifeMetrics(s, decisions) }
}

const LIVES = Array.from({ length: 400 }, (_, i) => playUi(hashSeed(i + 610_000)))

describe('event catalog', () => {
  it('every event is well formed', () => {
    for (const d of EVENTS.all()) {
      expect(d.id).toMatch(/^[\w.-]+$/)
      expect(d.category.trim(), d.id).not.toBe('')
      expect(d.stages.length, d.id).toBeGreaterThan(0)
      for (const st of d.stages) expect(STAGES, d.id).toContain(st)
      if (d.ages) expect(d.ages[0], d.id).toBeLessThanOrEqual(d.ages[1])
      if (d.maxPerLife !== undefined) expect(d.maxPerLife, d.id).toBeGreaterThan(0)
    }
  })
})

describe('scheduler', () => {
  it('respects per-life limits and cooldowns', () => {
    for (const { s } of LIVES) {
      const seen = new Map<string, number[]>()
      for (const e of s.log) if (e.eventId) seen.set(e.eventId, [...(seen.get(e.eventId) ?? []), e.age])
      for (const [id, ages] of seen) {
        const d = EVENTS.get(id)
        // lines tagged by the engine itself (not drawn from the catalog)
        if (!d) {
          expect(ENGINE_TAGS, id).toContain(id)
          continue
        }
        const distinctAges = [...new Set(ages)]
        expect(distinctAges.length, `${id} in seed ${s.config.seed}`).toBeLessThanOrEqual(d.maxPerLife ?? 1)
        for (let i = 1; i < distinctAges.length; i++) expect(distinctAges[i] - distinctAges[i - 1]).toBeGreaterThanOrEqual(d.cooldown ?? 3)
      }
    }
  })

  it('never draws two events of the same category in one year', () => {
    for (const { s } of LIVES) {
      const byAge = new Map<number, string[]>()
      for (const e of s.log) {
        if (!e.eventId || !e.category) continue
        // events that happen whenever their conditions hold (a birth, a child starting school, a job
        // search) are not drawn, so they may share a category with another event of the year
        // (follow-ups booked by an earlier outcome are not drawn either, and the extra pass, which has its own
        // stream, avoids the year's main events but not the decorative lines of the screen, which a headless
        // life does not have)
        if (EVENTS.get(e.eventId)?.priority || EVENTS.get(e.eventId)?.followOnly || EVENTS.get(e.eventId)?.extra) continue
        const list = byAge.get(e.age) ?? []
        // lines of one event share its id; count each event once
        if (!list.includes(`${e.eventId}|${e.category}`)) list.push(`${e.eventId}|${e.category}`)
        byAge.set(e.age, list)
      }
      for (const [age, list] of byAge) {
        const cats = list.map((x) => x.split('|')[1])
        expect(new Set(cats).size, `seed ${s.config.seed} age ${age}: ${cats.join(',')}`).toBe(cats.length)
      }
    }
  })

  it('everyday lines do not change the course of a life', () => {
    for (let i = 0; i < 60; i++) {
      const seed = hashSeed(i + 620_000)
      const ui = playUi(seed).s
      const fast = runHeadless({ seed, country: 'JP', pace: 'p15' }, sim)
      expect(ui.age).toBe(fast.age)
      expect(ui.career.highestRank).toBe(fast.career.highestRank)
      expect(ui.causeOfDeath).toBe(fast.causeOfDeath)
    }
  })

  it('every catalog line carries its event id and category', () => {
    for (const { s } of LIVES) for (const e of s.log) if (e.eventId) expect(e.category, e.eventId).toBeTruthy()
  })
})

describe('repetition and density (measured; tightened as stages add content)', () => {
  it('no line is repeated more than 3 times in a life', () => {
    for (const { m, s } of LIVES) expect(m.maxRepeat, `seed ${s.config.seed}: ${m.maxRepeatText}`).toBeLessThanOrEqual(3)
  })

  // sparse lives: the longest stretch of years after school or baseball without an event or a decision
  // (target PROJECT_PLAN §11.6: 5 years or less in 95% of lives; 2026-10-17 measurement over 3,000
  // lives: median 2, p90 3, p99 5, max 7)
  it('no life goes quiet for long after 18', () => {
    const gaps = LIVES.map(({ m }) => m.maxGapAdult).sort((a, b) => a - b)
    expect(gaps[Math.floor(gaps.length * 0.95)]).toBeLessThanOrEqual(5)
    for (const { m, s } of LIVES) expect(m.maxGapAdult, `seed ${s.config.seed}`).toBeLessThanOrEqual(12)
  })

  it('every adult year band has events, and decisions do not stop life every year', () => {
    for (const band of ['23-34', '35-49', '50-64', '65-79']) {
      const years = LIVES.reduce((a, { m }) => a + m.years[band], 0)
      const events = LIVES.reduce((a, { m }) => a + m.substantive[band], 0)
      const decisions = LIVES.reduce((a, { m }) => a + m.decisions[band], 0)
      expect(events / years, band).toBeGreaterThan(0.6)
      expect(decisions / years, band).toBeLessThan(1.2)
    }
  })
})
