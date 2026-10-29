import { describe, expect, it } from 'vitest'
import { STATS } from './stats.ts'
import { SOURCES } from './sources.ts'
import { PREF_WEIGHT_STAT, PREFECTURES } from './jp.ts'
import { CHECKS, defaultParams } from '../engine/params.ts'
import { createLife, endYear, planYear, resolveDecision, type Sim } from '../engine/life.ts'
import { hashSeed } from '../engine/rng.ts'

// Provenance rules (PROJECT_PLAN §6.1): every number carries its definition, population, time,
// kind and source; values without a recorded check are `unverified` and never shown as fact;
// values without a sex breakdown are `sex: 'unstated'` reference values.

const ALL = [...Object.values(STATS), PREF_WEIGHT_STAT]

describe('every statistic carries its provenance', () => {
  it.each(ALL.map((s) => [s.id, s] as const))('%s', (id, s) => {
    if (id !== PREF_WEIGHT_STAT.id) expect(STATS[id]).toBe(s)
    expect(['measured', 'estimate', 'assumption']).toContain(s.kind)
    expect(['population', 'baseball', 'model']).toContain(s.domain)
    expect(['male', 'all', 'unstated', 'unknown']).toContain(s.sex)
    expect(s.population.trim()).not.toBe('')
    expect(s.definition.trim()).not.toBe('')
    expect(s.asOf.trim()).not.toBe('')
    expect(Number.isFinite(s.value)).toBe(true)
    for (const sid of s.sourceIds) expect(SOURCES[sid], `${id} → unknown source ${sid}`).toBeDefined()
    // a "none" source type means no source, and the other way round
    expect(s.sourceType === 'none').toBe(s.sourceIds.length === 0)
    // measured values must point at a source
    if (s.kind === 'measured') expect(s.sourceIds.length).toBeGreaterThan(0)
    // without a recorded check date on every source, a value cannot count as verified
    const checked = s.sourceIds.length > 0 && s.sourceIds.every((sid) => SOURCES[sid].accessed)
    if (!checked) expect(s.unverified).toBe(true)
    // a value whose sex breakdown is unknown cannot count as verified for a male-only game
    if (s.sex === 'unknown') expect(s.unverified).toBe(true)
  })

  it('sources have a publisher, a link, and a dated check note when opened', () => {
    for (const s of Object.values(SOURCES)) {
      expect(s.publisher.trim()).not.toBe('')
      expect(s.url).toMatch(/^https?:\/\//)
      if (s.accessed) expect(s.accessed).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      // every source says what was (or could not be) confirmed
      expect(s.checkNote?.trim(), s.id).toBeTruthy()
    }
  })

  it.each(ALL.filter((s) => !s.unverified).map((s) => [s.id, s] as const))('%s is shown as fact only with full provenance', (_, s) => {
    expect(s.kind).not.toBe('assumption')
    expect(s.sex).not.toBe('unknown')
    expect(s.sourceIds.length).toBeGreaterThan(0)
    for (const sid of s.sourceIds) expect(SOURCES[sid].accessed).toBeTruthy()
  })

  it('values that stay unverified say why', () => {
    for (const s of ALL) if (s.unverified && s.kind !== 'assumption') expect(s.verifyNote?.trim(), s.id).toBeTruthy()
  })

  // 2026-10-17 decision (§6.1): sex coverage is recorded as the source states it
  it('a figure is male only when the source says so, and the basis is recorded', () => {
    for (const s of ALL) {
      if (s.sex !== 'male' || s.kind === 'assumption') continue
      expect(s.unverified, s.id).toBe(false)
      expect(s.verifyNote, s.id).toMatch(/男/)
    }
  })

  it('a figure without a sex breakdown is a reference value with its population and source stated', () => {
    const refs = ALL.filter((s) => s.sex === 'unstated')
    expect(refs.length).toBeGreaterThan(0)
    for (const s of refs) {
      expect(s.kind, s.id).not.toBe('assumption')
      expect(s.population.trim(), s.id).not.toBe('')
      expect(s.sourceIds.length, s.id).toBeGreaterThan(0)
      expect(s.verifyNote, s.id).toMatch(/集計対象/)
      // confirming the value does not confirm the sex breakdown
      if (!s.unverified) for (const sid of s.sourceIds) expect(SOURCES[sid].accessed, `${s.id} → ${sid}`).toBeTruthy()
    }
  })

  it('the general-population life expectancy is the male value', () => {
    expect(STATS.jpLifeMale.domain).toBe('population')
    expect(STATS.jpLifeMale.sex).toBe('male')
  })

  it('prefecture weights are a model setting, not a fact', () => {
    expect(PREF_WEIGHT_STAT.kind).toBe('assumption')
    expect(PREFECTURES).toHaveLength(47)
  })
})

describe('the model uses statistics by reference', () => {
  it('every stage check points at existing baseball statistics', () => {
    for (const [key, c] of Object.entries(CHECKS)) {
      expect(c.statIds.length, key).toBeGreaterThan(0)
      for (const id of c.statIds) {
        expect(STATS[id], `${key} → ${id}`).toBeDefined()
        expect(STATS[id].domain, `${key} → ${id}`).not.toBe('population')
      }
      const t = c.target()
      expect(t).toBeGreaterThan(0)
      expect(t).toBeLessThan(1)
    }
  })

  it('every statistic quoted in a life log or a decision exists', () => {
    const sim: Sim = { params: defaultParams() }
    const seen = new Set<string>()
    for (let i = 0; i < 400; i++) {
      const s = createLife({ seed: hashSeed(i + 123_000), country: 'JP', pace: 'p15' })
      for (let guard = 0; guard < 130 && s.alive; guard++) {
        const plan = planYear(s, sim)
        for (const e of plan.events) e.entry.statIds?.forEach((id) => seen.add(id))
        let d = plan.decision?.decision
        while (d && s.alive) {
          d.factStatIds?.forEach((id) => seen.add(id))
          const r = resolveDecision(s, d.autoIndex, sim)
          for (const e of r.events) e.entry.statIds?.forEach((id) => seen.add(id))
          d = r.followUp?.decision
        }
        endYear(s)
      }
    }
    expect(seen.size).toBeGreaterThan(0)
    for (const id of seen) expect(STATS[id], id).toBeDefined()
  }, 30_000)
})
