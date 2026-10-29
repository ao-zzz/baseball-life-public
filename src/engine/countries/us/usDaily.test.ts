import { describe, expect, it } from 'vitest'
import { EVENTS, createLife, runHeadless, type Sim } from '../../life.ts'
import { compileSpec, validateSpecs } from '../../events/spec.ts'
import { defaultParams } from '../../params.ts'
import { hashSeed, makeRng } from '../../rng.ts'
import type { EventCtx } from '../../events.ts'
import { US_DAILY_KINDS, US_DAILY_SPECS } from './daily.ts'

// Daily life of a US player (PROJECT_PLAN §11.36): news lines change nothing, life events change money, relations, happiness or knowledge
// and never the calibrated career, and they are met by US lives that live in the US only.

const headless: Sim = { params: defaultParams(), headless: true }
const mk = (country: 'JP' | 'US', seed = 4) => createLife({ seed, country, pace: 'p15' })

describe('the US daily-life events', () => {
  it('are well formed (no padding, follow-ups booked, no effect on the career or the death rate in the playing stages)', () => {
    const known = new Set(EVENTS.all().map((d) => d.id))
    expect(validateSpecs(US_DAILY_SPECS, known)).toEqual([])
    expect(new Set(US_DAILY_SPECS.map((s) => s.id)).size).toBe(US_DAILY_SPECS.length)
    // (tied to where he lives, not to a birth country's table: PROJECT_PLAN §11.37)
    for (const s of US_DAILY_SPECS) {
      expect(s.lives, s.id).toBe('US')
      expect(s.country, s.id).toBeUndefined()
    }
    expect(US_DAILY_SPECS.length).toBeGreaterThanOrEqual(35)
  })

  it('are told apart: news lines and life events', () => {
    const kinds = Object.values(US_DAILY_KINDS)
    expect(kinds.filter((k) => k === 'news').length).toBeGreaterThanOrEqual(10)
    expect(kinds.filter((k) => k === 'life').length).toBeGreaterThanOrEqual(20)
  })

  it('a news line changes nothing in the life', () => {
    for (const spec of US_DAILY_SPECS.filter((s) => US_DAILY_KINDS[s.id] === 'news')) {
      const s = mk('US')
      const before = JSON.stringify([s.status, s.money, s.family, s.flags, s.after, s.bb?.confidence, s.bb?.coachEval])
      const log: string[] = []
      const c: EventCtx = { s, rng: makeRng(1), headless: true, add: (_k, t) => log.push(t), ask: () => { throw new Error(`${spec.id} asks`) }, canAsk: () => true }
      compileSpec(spec).run(c)
      expect(log.length, spec.id).toBe(1)
      expect(JSON.stringify([s.status, s.money, s.family, s.flags, s.after, s.bb?.confidence, s.bb?.coachEval]), spec.id).toBe(before)
    }
  })

  it('are met by a man who lives in the US, not by one who lives elsewhere or was born in Japan', () => {
    const us = mk('US')
    us.age = 30
    us.career.phase = 'pro'
    const open = (s: typeof us) => US_DAILY_SPECS.filter((d) => compileSpec(d).when!(s)).length
    expect(open(us)).toBeGreaterThan(5)
    us.residence = 'JP'
    expect(open(us)).toBe(0)
    const jp = mk('JP')
    jp.age = 30
    jp.career.phase = 'pro'
    expect(EVENTS.eligible(jp, 'pro', true).filter((d) => d.id.startsWith('us.'))).toEqual([])
  })

  it('happen in US lives, in the playing years and after, with the news and the life events both met', () => {
    const met = new Map<string, number>()
    const stages = new Set<string>()
    for (let i = 0; i < 120; i++) {
      const s = runHeadless({ seed: hashSeed(i + 17_000_000), country: 'US', pace: 'p15' }, headless)
      for (const [id, [age]] of Object.entries(s.evHist ?? {})) {
        if (!(id in US_DAILY_KINDS)) continue
        met.set(id, (met.get(id) ?? 0) + 1)
        stages.add(age >= 22 ? 'later' : 'young')
      }
    }
    const ids = [...met.keys()]
    expect(ids.length).toBeGreaterThanOrEqual(20)
    expect(ids.some((id) => US_DAILY_KINDS[id] === 'news')).toBe(true)
    expect(ids.some((id) => US_DAILY_KINDS[id] === 'life')).toBe(true)
    expect(stages.has('young')).toBe(true)
    expect(stages.has('later')).toBe(true)
  })
})
