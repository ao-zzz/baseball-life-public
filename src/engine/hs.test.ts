import { describe, expect, it } from 'vitest'
import { EVENTS, createLife, endYear, planYear, resolveDecision, type Sim } from './life.ts'
import { defaultParams } from './params.ts'
import { hashSeed, makeRng } from './rng.ts'
import type { LifeState } from './types.ts'
import type { EventCtx } from './events.ts'
import { MEXT_BOYS_2024, heightAt, weightAt } from './body.ts'
import { SKILLS, skillScore, velocityKmh } from './ability.ts'

// Stage 2 (PROJECT_PLAN §11.2): body growth, abilities, high-school team life.

const sim: Sim = { params: defaultParams() }

function playUi(seed: number, until = 130, pick?: (n: number, auto: number) => number): LifeState {
  const s = createLife({ seed, country: 'JP', pace: 'p15' })
  for (let g = 0; g < 130 && s.alive && s.age < until; g++) {
    const plan = planYear(s, sim)
    for (const e of plan.events) s.log.push(e.entry)
    let d = plan.decision?.decision
    while (d && s.alive) {
      const r = resolveDecision(s, pick ? pick(d.choices.length, d.autoIndex) : d.autoIndex, sim)
      for (const e of r.events) s.log.push(e.entry)
      d = r.followUp?.decision
    }
    endYear(s)
  }
  return s
}

describe('body growth (文部科学省 学校保健統計 2024, boys)', () => {
  it('follows the average curve scaled to the adult height', () => {
    const s = createLife({ seed: 5, country: 'JP', pace: 'p15' })
    s.person.heightCm = 170.8
    for (let a = 5; a <= 17; a++) expect(heightAt(s, a)).toBeCloseTo(MEXT_BOYS_2024[a][0], 0)
    let prevH = 0
    let prevW = 0
    for (let a = 0; a <= 17; a++) {
      expect(heightAt(s, a)).toBeGreaterThanOrEqual(prevH)
      expect(weightAt(s, a)).toBeGreaterThanOrEqual(prevW)
      prevH = heightAt(s, a)
      prevW = weightAt(s, a)
    }
    expect(heightAt(s, 30)).toBe(170.8)
  })
})

const LIVES = Array.from({ length: 300 }, (_, i) => playUi(hashSeed(i + 820_000), 19))

describe('abilities', () => {
  it('stay in range and centred around the overall ability', () => {
    for (const s of LIVES) {
      if (!s.bb) continue
      const all = [...SKILLS.P, ...SKILLS.F, ...SKILLS.C]
      const mean = all.reduce((a, k) => a + s.bb!.skills[k], 0) / all.length
      expect(Math.abs(mean)).toBeLessThan(1e-9)
      for (const k of all) {
        expect(Number.isFinite(s.bb.skills[k])).toBe(true)
        const v = skillScore(s, k)
        expect(v).toBeGreaterThanOrEqual(1)
        expect(v).toBeLessThanOrEqual(99)
      }
      const kmh = velocityKmh(s)
      expect(kmh).toBeGreaterThan(70)
      expect(kmh).toBeLessThan(175)
      for (const x of [s.bb.fatigue, s.bb.confidence, s.bb.coachEval]) {
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThanOrEqual(100)
      }
      expect(s.bb.condition).toBeGreaterThanOrEqual(-2)
      expect(s.bb.condition).toBeLessThanOrEqual(2)
    }
  })
})

describe('high-school squad', () => {
  it('announcements are consistent: numbers, injuries, Koshien', () => {
    let announcements = 0
    for (const s of LIVES) {
      for (const e of s.log.filter((x) => x.eventId === 'hs.roster')) {
        announcements++
        const m = /背番号(\d+)/.exec(e.text)
        if (m) {
          const n = Number(m[1])
          expect(n).toBeGreaterThanOrEqual(1)
          expect(n).toBeLessThanOrEqual(20)
          if (e.text.includes('レギュラーです') || e.text.includes('レギュラーとして')) expect(n).toBeLessThanOrEqual(9)
        }
      }
      // a player injured out of the squad never stands on the Koshien bench in the same year
      const injuredAges = new Set(s.log.filter((e) => e.text.includes('けがのため外れました')).map((e) => e.age))
      for (const e of s.log) if (e.text.startsWith('甲子園の土を踏みました')) expect(injuredAges.has(e.age), `seed ${s.config.seed}`).toBe(false)
      // the last summer line agrees with Koshien
      const last = s.log.find((e) => e.text.startsWith('最後の夏は、甲子園で'))
      if (last) expect(s.career.achievements).toContain('甲子園')
    }
    expect(announcements).toBeGreaterThan(300)
  })

  it('team sizes are plausible', () => {
    for (const s of LIVES) if (s.bb && s.bb.teamSize) {
      expect(s.bb.teamSize).toBeGreaterThanOrEqual(10)
      expect(s.bb.teamSize).toBeLessThanOrEqual(140)
    }
  })
})

describe('choices change the outcome', () => {
  // a high-school player in his 2nd year
  function hsPlayer(): LifeState {
    for (let i = 0; i < 500; i++) {
      const s = playUi(hashSeed(i + 900_100), 16)
      if (s.career.phase === 'hs' && s.bb) return s
    }
    throw new Error('no high-school player found')
  }
  const base = hsPlayer()

  function ctxFor(s: LifeState): { c: EventCtx; asked: { id: string; n: number; data: Record<string, number | boolean | string> }[] } {
    const asked: { id: string; n: number; data: Record<string, number | boolean | string> }[] = []
    const c: EventCtx = {
      s,
      rng: makeRng(1),
      headless: true,
      add: () => {},
      ask: (d, data = {}) => asked.push({ id: d.id, n: d.choices.length, data }),
      canAsk: () => true,
    }
    return { c, asked }
  }
  const snapshot = (s: LifeState) => JSON.stringify([s.bb, s.status, s.person.position, s.career.injured, s.career.achievements])

  for (const def of EVENTS.all().filter((d) => d.resolve && d.stages.includes('hs'))) {
    it(def.id, () => {
      const s0 = JSON.parse(JSON.stringify(base)) as LifeState
      s0.bb!.coachEval = 62
      s0.status.relations = 70
      s0.bb!.role = 'bench'
      const { c, asked } = ctxFor(s0)
      def.run(c)
      expect(asked.length, `${def.id} opens a decision`).toBe(1)
      const outcomes = new Set<string>()
      for (let k = 0; k < asked[0].n; k++) {
        const s1 = JSON.parse(JSON.stringify(s0)) as LifeState
        def.resolve!(ctxFor(s1).c, k, asked[0].data)
        outcomes.add(snapshot(s1))
      }
      expect(outcomes.size, `${def.id}: choices lead to different states`).toBeGreaterThanOrEqual(2)
    })
  }
})

describe('every choice can be taken in high school', () => {
  it('first, last and おまかせ choices all run to the end of high school', () => {
    for (let i = 0; i < 90; i++) {
      const pick = [() => 0, (n: number) => n - 1, (_: number, a: number) => a][i % 3]
      const s = playUi(hashSeed(i + 930_000), 19, pick)
      expect(s.age).toBeGreaterThan(0)
    }
  })
})
