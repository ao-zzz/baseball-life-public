import { describe, expect, it, vi } from 'vitest'
import type * as CoachingModule from './coaching.ts'
import type { EventRegistry, EventCtx } from './events.ts'

// The coach's road after playing (coaching.ts). In this file alone (vi.mock) its pass can be switched off, which is the game before
// the change: a life answered おまかせ must be the same apart from the offer's question and its flag. Lives of the potential mode (★10)
// reach the NPB 1軍 often enough to meet the offer.

const ctl = vi.hoisted(() => ({ off: false }))

vi.mock('./coaching.ts', async (importOriginal) => {
  const real = await importOriginal<typeof CoachingModule>()
  return { ...real, runCoachingPass: (reg: EventRegistry, c: EventCtx) => (ctl.off ? [] : real.runCoachingPass(reg, c)) }
})

import { createLife, endYear, EVENTS, planYear, resolveDecision, runHeadless, type Sim } from './life.ts'
import { defaultParams } from './params.ts'
import { hashSeed } from './rng.ts'
import { COACHING_SPECS, coachingSummary } from './coaching.ts'
import { NEUTRAL_FORBIDDEN, validateSpecs } from './events/spec.ts'
import type { LifeConfig, LifeState } from './types.ts'

const sim: Sim = { params: defaultParams(), headless: true }
const config = (i: number): LifeConfig => ({ seed: hashSeed(i + 4_000_000), country: 'JP', pace: 'p15', mode: 'potential', stars: 10 })

/** a life without what the offer leaves in it: its question's flag and record, and the queue it waited in */
function strip(s: LifeState) {
  const flags = { ...(s.flags ?? {}) }
  delete flags['cy.retireOffer']
  const evHist = { ...(s.evHist ?? {}) }
  delete evHist['x.cy.retireOffer']
  const taken = s.taken.filter((t) => t !== 'x.cy.retireOffer')
  return structuredClone({ ...s, flags, evHist, taken, log: s.log.filter((e) => e.eventId !== 'x.cy.retireOffer' && !/ユニフォームを脱ぐ|野球から離れて、これからのことを/.test(e.text)) }) as LifeState
}

/** a life played on screen that says yes to every coaching offer and every step up, every other question as おまかせ */
const YES = /二軍のコーチとして球団に残る|母校の高校の監督になる|一軍のコーチになる|ヘッドコーチを引き受ける|監督を引き受ける|強豪校の監督になる|大学の野球部の監督になる/
function playYes(i: number): LifeState {
  const s = createLife(config(i))
  const screen: Sim = { params: defaultParams() }
  for (let g = 0; g < 130 && s.alive; g++) {
    let d = planYear(s, screen).decision?.decision
    while (d && s.alive) {
      const k = d.choices.findIndex((c) => YES.test(c.label))
      d = resolveDecision(s, k >= 0 ? k : d.autoIndex, screen).followUp?.decision
    }
    endYear(s)
  }
  return s
}

describe('the coach’s road after playing', () => {
  it('its scenes are well formed, and the offer’s おまかせ answer only sets a flag', () => {
    const known = new Set(EVENTS.all().map((d) => d.id))
    expect(validateSpecs(COACHING_SPECS, known)).toEqual([])
    const offer = COACHING_SPECS.find((x) => x.id === 'x.cy.retireOffer')!
    const auto = offer.choices![offer.auto as number]
    for (const e of [auto.effects, ...auto.outcomes.map((o) => o.effects)]) for (const k of NEUTRAL_FORBIDDEN) expect(e?.[k], k).toBeUndefined()
    // every other scene comes only after his own choice to coach
    for (const x of COACHING_SPECS.filter((y) => y.id !== 'x.cy.retireOffer')) expect(x.needsChoice, x.id).toBe(true)
  })

  it('おまかせ lives are the same with and without it, apart from the offer, and never coach', () => {
    let asked = 0
    for (let i = 0; i < 30; i++) {
      ctl.off = false
      const on = runHeadless(config(i), sim)
      ctl.off = true
      const off = runHeadless(config(i), sim)
      if (on.evHist?.['x.cy.retireOffer']) asked++
      expect(on.coaching).toBeUndefined()
      expect(strip(on)).toEqual(strip(off))
    }
    ctl.off = false
    expect(asked).toBeGreaterThan(5)
  })

  it('a first-team player who says yes coaches, and the seasons of his teams add up', () => {
    ctl.off = false
    let coaches = 0
    let managed = 0
    for (let i = 0; i < 24; i++) {
      const s = playYes(i)
      if (s.career.highestRank < 8) continue
      // (asked the year after he retired, whatever else that year asked)
      expect(s.evHist?.['x.cy.retireOffer'] ?? (s.career.endedAge === null ? [] : undefined), `life ${i}`).toBeDefined()
      if (s.coaching) managed++
      if (Object.keys(s.evHist ?? {}).some((k) => k.startsWith('x.cy.') && k !== 'x.cy.retireOffer')) coaches++
      for (const x of s.coaching?.seasons ?? []) {
        if (x.level === 'pro') {
          expect(x.finish).toBeGreaterThanOrEqual(1)
          expect(x.finish).toBeLessThanOrEqual(6)
          expect((x.w ?? 0) + (x.l ?? 0) + (x.d ?? 0)).toBe(143)
          if (x.result === 'league') expect(x.finish).toBe(1)
          if (x.result === 'series' || x.result === 'champion') expect(x.finish).toBeLessThanOrEqual(3)
        }
        if (x.level === 'hs') expect(x.wins).toBeLessThanOrEqual(6)
      }
      const sum = coachingSummary(s)
      if (sum?.pro) expect(sum.pro.w + sum.pro.l + sum.pro.d).toBe(143 * sum.pro.years)
      // one season a year at most for each level
      const keys = (s.coaching?.seasons ?? []).map((x) => `${x.age}-${x.level}`)
      expect(new Set(keys).size).toBe(keys.length)
    }
    expect(coaches).toBeGreaterThan(3)
    expect(managed).toBeGreaterThan(3)
  })
})
