import { describe, expect, it } from 'vitest'
import { createLife, endYear, planYear, resolveDecision, type Sim } from './life.ts'
import { defaultParams } from './params.ts'
import { hashSeed } from './rng.ts'
import type { LifeState } from './types.ts'
import { CELEB_JOBS, drawPartner, isCeleb } from './family.ts'
import { CELEB, celebShare, honourPoints } from './lifeLoveEvents.ts'

// A known pro meets people in the public eye (announcers, TV personalities, idols, models, actresses), more often with titles and
// awards, and a first date is likelier for him (stat celebPartner). Everyone else meets the same people as before.

const sim: Sim = { params: defaultParams() }

/** a pro in the first team (rank 8), with honours if given */
function pro(seed: number, rank = 8, honours: string[] = []): LifeState {
  const s = createLife({ seed, country: 'JP', pace: 'p15' })
  s.age = 26
  s.career.phase = 'pro'
  s.career.highestRank = rank
  s.bb ??= { skills: {}, rec: { official: {}, practice: {}, tournaments: [], marks: [] } } as unknown as LifeState['bb']
  s.bb!.rec ??= { official: {}, practice: {}, tournaments: [], marks: [] }
  s.bb!.rec.honours = honours.map((id) => ({ age: 25, id: id as never }))
  return s
}

describe('people in the public eye for a known pro', () => {
  it('leave everyone else as before: the same partner without the chance, and the same age with it', () => {
    for (let i = 0; i < 300; i++) {
      const s = pro(hashSeed(i + 7_000_000))
      const before = drawPartner(s, '葵')
      expect(drawPartner(s, '葵', 0, 0)).toEqual(before)
      const star = drawPartner(s, '葵', 0, 0.5)
      expect(star.gap).toBe(before.gap)
      if (!isCeleb(star.job)) expect(star.job).toBe(before.job)
    }
  })

  it('are a share of 10% in the first team, rising with the honours up to 50%, and none outside the pros', () => {
    expect(celebShare(pro(1))).toBeCloseTo(CELEB.base)
    expect(celebShare(pro(1, 10))).toBeCloseTo(CELEB.base + 2 * CELEB.perRung)
    expect(celebShare(pro(1, 8, ['avg', 'best9']))).toBeCloseTo(CELEB.base + 0.08 + 0.04)
    expect(celebShare(pro(1, 10, Array(12).fill('mvp')))).toBe(CELEB.max)
    const company = pro(1)
    company.career.phase = 'company'
    expect(celebShare(company)).toBe(0)
    expect(honourPoints(pro(1, 8, ['jseries', 'allstar']))).toBeCloseTo(0.02)
  })

  it('are met about as often as the share says', () => {
    let celeb = 0
    const N = 4000
    for (let i = 0; i < N; i++) if (isCeleb(drawPartner(pro(hashSeed(i + 7_100_000)), '葵', 0, 0.3).job)) celeb++
    expect(celeb / N).toBeGreaterThan(0.26)
    expect(celeb / N).toBeLessThan(0.34)
    expect(CELEB_JOBS).toContain('アナウンサー')
  })

  it('in lives played on screen, a star who asks people out can marry one, and the result screen keeps who she is', () => {
    let stars = 0
    let celebPartners = 0
    let celebWives = 0
    for (let i = 0; i < 120; i++) {
      const s = createLife({ seed: hashSeed(i + 4_000_000), country: 'JP', pace: 'p15', mode: 'potential', stars: 10 })
      const lines: string[] = []
      for (let g = 0; g < 130 && s.alive && s.age < 45; g++) {
        const plan = planYear(s, sim)
        lines.push(...plan.events.map((e) => e.entry.text))
        let d = plan.decision?.decision
        // ask everyone out and propose; every other question as おまかせ
        while (d && s.alive) {
          const r = resolveDecision(s, d.id === 'life.meet' || d.id === 'life.proposal' ? 0 : d.autoIndex, sim)
          lines.push(...r.events.map((e) => e.entry.text))
          d = r.followUp?.decision
        }
        if (s.family.partner && isCeleb(s.family.partnerInfo?.job)) celebPartners++
        endYear(s)
      }
      if (honourPoints(s) > 0) stars++
      if (isCeleb(s.family.wifeJob)) {
        celebWives++
        // (in the pros or after them: the wedding line names who she is; the record keeps it after her death)
        expect(s.family.everMarried).toBe(true)
        expect(lines.some((x) => x.startsWith(`${s.family.wifeJob}の`) && x.includes('さんと結婚しました。'))).toBe(true)
      }
    }
    expect(stars).toBeGreaterThan(0)
    expect(celebPartners).toBeGreaterThan(0)
    expect(celebWives).toBeGreaterThan(0)
  })
})
