import { describe, expect, it } from 'vitest'
import { createLife, endYear, planYear, resolveDecision, type Sim } from '../life.ts'
import { defaultParams } from '../params.ts'
import { hashSeed } from '../rng.ts'
import { rehireProb } from './rehire.ts'
import type { LifeState } from '../types.ts'

// Another team of the same league after a release (PROJECT_PLAN §11.47): the chance follows the record and the age, the offer is a
// decision, a refusal retires him, an acceptance keeps him playing, and no life offers it without end.

const sim: Sim = { params: defaultParams() }

const base = (age: number, z: number): LifeState => {
  const s = createLife({ seed: 9, country: 'US', pace: 'p15' })
  s.age = age
  s.z = z
  s.career.injured = 0
  if (s.bb) s.bb.hurt = false
  return s
}

describe('the chance of an offer', () => {
  it('grows with the record, falls with age (a star keeps part of it), and is nil when hurt, too old or after three offers', () => {
    const young = rehireProb(base(26, 0), 'first', 1.5)
    expect(young).toBeGreaterThan(rehireProb(base(26, 0), 'first', 0))
    expect(rehireProb(base(35, 0), 'first', 0.5)).toBeLessThan(rehireProb(base(26, 0), 'first', 0.5))
    expect(rehireProb(base(35, 0), 'first', 2)).toBeGreaterThan(rehireProb(base(35, 0), 'first', 0.5))
    expect(rehireProb(base(35, 0), 'first', 0)).toBeGreaterThan(0)
    expect(rehireProb(base(40, 0), 'first', 2)).toBe(0)
    const hurt = base(26, 0)
    hurt.career.injured = 1
    expect(rehireProb(hurt, 'first', 2)).toBe(0)
    const many = base(26, 0)
    many.flags = { 'rehire.n': 3 }
    expect(rehireProb(many, 'first', 2)).toBe(0)
  })
})

describe('in the lives', () => {
  for (const country of ['US', 'KR', 'CU'] as const) {
    it(`${country}: offers happen, a refusal retires, an acceptance plays on, and at most three come to one life`, () => {
      let offers = 0
      let accepted = 0
      let refused = 0
      for (let i = 0; i < 30000 && (accepted < 2 || refused < 2); i++) {
        const s = createLife({ seed: hashSeed(i + 4_700_000), country, pace: 'p15' })
        // (Korea's pros are about 5 in 1000: a first-team man is put at 27 so that the test meets enough releases)
        if (country === 'KR') {
          s.age = 27
          s.z = 0.3
          Object.assign(s.career, { phase: 'pro', team: 'KBO球団（1軍）', proDebut: true, proSeasons: 3, highestRank: 8, startedAge: 7 })
          ;(s.flags ??= {})['kr.mil'] = 20
        }
        let n = 0
        for (let g = 0; g < 110 && s.alive; g++) {
          let d = planYear(s, sim).decision?.decision
          while (d && s.alive) {
            let pick = d.autoIndex
            if (d.id === 'rehire.offer') {
              n++
              offers++
              // (alternate, so that both answers are seen)
              pick = offers % 2 === 0 ? 1 : 0
              if (pick === 0) accepted++
              else refused++
              const before = s.career.phase
              d = resolveDecision(s, pick, sim).followUp?.decision
              if (pick === 1) expect(s.career.phase, 'retired after a refusal').toBe('retired')
              else expect(['pro', 'proMinor', 'abroad'].includes(s.career.phase) && before !== 'retired').toBe(true)
              continue
            }
            d = resolveDecision(s, pick, sim).followUp?.decision
          }
          endYear(s)
        }
        expect(n).toBeLessThanOrEqual(3)
        expect(Number.isFinite(s.money)).toBe(true)
      }
      expect(offers, `${country} offers`).toBeGreaterThan(0)
      expect(accepted).toBeGreaterThan(0)
      expect(refused).toBeGreaterThan(0)
    }, 120_000)
  }

  it('Japan never gets this decision (its tryout is its own way back)', () => {
    for (let i = 0; i < 150; i++) {
      const s = createLife({ seed: hashSeed(i + 4_800_000), country: 'JP', pace: 'p15' })
      for (let g = 0; g < 80 && s.alive; g++) {
        let d = planYear(s, sim).decision?.decision
        while (d && s.alive) {
          expect(d.id).not.toBe('rehire.offer')
          d = resolveDecision(s, d.autoIndex, sim).followUp?.decision
        }
        endYear(s)
      }
    }
  }, 120_000)
})
