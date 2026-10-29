import { describe, expect, it } from 'vitest'
import { createLife, endYear, planYear, resolveDecision, runHeadless, type Sim } from './life.ts'
import { defaultParams } from './params.ts'
import { hashSeed, makeRng } from './rng.ts'
import type { LifeState } from './types.ts'
import type { EventCtx } from './events.ts'
import { ensureAfter, jobOffers } from './after.ts'
import { AFTER_EVENTS } from './afterEvents.ts'
import { lifeMetrics } from './metrics.ts'
import { statValue } from '../data/stats.ts'

// Stage 5 (PROJECT_PLAN §11.6): life after baseball. Money stays consistent, nothing is compulsory,
// the playing years open or close doors, choices change what happens, and lives last as long as the
// life table says.

const sim: Sim = { params: defaultParams() }
const PLAYING = ['child', 'youth', 'jhs', 'hs', 'univ', 'company', 'indep', 'proMinor', 'pro', 'abroad']

interface Played {
  s: LifeState
  minMoney: number
  /** ages (18+) that ended with savings below zero */
  negAges: number[]
  decisions: { age: number; id: string; choices: number }[]
  problems: string[]
  /** savings at the end of the year he turned 65 */
  money65?: number
}

function playUi(seed: number, pick?: (n: number, auto: number) => number, until = 200): Played {
  const s = createLife({ seed, country: 'JP', pace: 'p15' })
  const out: Played = { s, minMoney: 0, negAges: [], decisions: [], problems: [] }
  for (let g = 0; g < 130 && s.alive && s.age < until; g++) {
    const plan = planYear(s, sim)
    for (const e of plan.events) s.log.push(e.entry)
    let d = plan.decision?.decision
    while (d && s.alive) {
      out.decisions.push({ age: s.age, id: d.id, choices: d.choices.length })
      const r = resolveDecision(s, pick ? pick(d.choices.length, d.autoIndex) : d.autoIndex, sim)
      for (const e of r.events) s.log.push(e.entry)
      d = r.followUp?.decision
    }
    // consistency at the end of every year
    const at = `seed ${seed} age ${s.age}`
    if (!Number.isFinite(s.money) || !Number.isInteger(s.money)) out.problems.push(`${at}: money ${s.money}`)
    if (!Number.isFinite(s.income) || s.income < 0) out.problems.push(`${at}: income ${s.income}`)
    const a = s.after
    if (a) {
      if (a.loan < 0 || a.loan > 2800) out.problems.push(`${at}: loan ${a.loan}`)
      if (a.home !== 'own' && a.loan > 0) out.problems.push(`${at}: a loan without a house`)
      if (a.retired && a.work) out.problems.push(`${at}: retired but working as ${a.work.title}`)
      if (!PLAYING.includes(s.career.phase) && a.work && s.job !== a.work.title) out.problems.push(`${at}: job ${s.job} ≠ ${a.work.title}`)
      if (a.work && (a.work.level < 0 || a.work.level > 4 || a.work.years < 0)) out.problems.push(`${at}: work ${JSON.stringify(a.work)}`)
    }
    if (s.family.spouse && s.family.partner) out.problems.push(`${at}: a spouse and a partner`)
    if ((s.family.kids?.length ?? 0) !== s.family.children) out.problems.push(`${at}: kids ${s.family.kids?.length} ≠ children ${s.family.children}`)
    if (s.age >= 18) {
      out.minMoney = Math.min(out.minMoney, s.money)
      if (s.money < 0) out.negAges.push(s.age)
    }
    if (s.age === 65) out.money65 = s.money
    endYear(s)
  }
  return out
}

const AUTO = Array.from({ length: 400 }, (_, i) => playUi(hashSeed(i + 3_100_000)))

describe('money and the household stay consistent', () => {
  it('no inconsistency in おまかせ lives, or when always taking the first or the last choice', () => {
    const others = Array.from({ length: 80 }, (_, i) => playUi(hashSeed(i + 3_200_000), i % 2 ? (n) => n - 1 : () => 0))
    for (const p of [...AUTO, ...others]) expect(p.problems, p.problems.slice(0, 3).join(' / ')).toEqual([])
  })

  it('deficits are limited', () => {
    for (const p of AUTO) expect(p.minMoney, `seed ${p.s.config.seed}`).toBeGreaterThan(-1500)
    const ever = AUTO.filter((p) => p.negAges.length > 0).length / AUTO.length
    expect(ever).toBeLessThan(0.3)
  })

  it('a lasting deficit leads to a decision about it', () => {
    let lasting = 0
    for (const p of AUTO) {
      const run = p.negAges.some((a) => p.negAges.includes(a + 1) && p.negAges.includes(a + 2))
      if (!run) continue
      lasting++
      expect(p.decisions.some((d) => d.id === 'money.tight'), `seed ${p.s.config.seed}`).toBe(true)
    }
    // (lasting deficits are rare; the count is reported, not required)
    expect(lasting).toBeLessThan(AUTO.length * 0.15)
  })

  it('savings at 65 are in a plausible range for the model', () => {
    const at65 = AUTO.map((p) => p.money65).filter((x): x is number => x !== undefined)
    expect(at65.length).toBeGreaterThan(100)
    const sorted = [...at65].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    expect(median).toBeGreaterThan(300)
    expect(median).toBeLessThan(8000)
  })
})

describe('nothing is compulsory', () => {
  it('declining every time: no marriage, no children, no coaching, and life still has events', () => {
    for (let i = 0; i < 40; i++) {
      const p = playUi(hashSeed(i + 3_300_000), (n) => n - 1)
      const s = p.s
      expect(s.family.everMarried, `seed ${s.config.seed}`).toBe(false)
      expect(s.family.children).toBe(0)
      expect(s.career.achievements).not.toContain('少年野球の指導')
      expect(s.after?.baseballLife ?? []).toEqual([])
      if (s.age >= 30) expect(lifeMetrics(s, p.decisions).maxGapAdult, `seed ${s.config.seed}`).toBeLessThanOrEqual(10)
    }
  })

  it('おまかせ lives differ: some never marry, some couples have no children, most do not coach', () => {
    const adults = AUTO.filter((p) => p.s.age >= 50)
    const married = adults.filter((p) => p.s.family.everMarried)
    expect(married.length / adults.length).toBeGreaterThan(0.4)
    expect(married.length / adults.length).toBeLessThan(0.95)
    expect(married.filter((p) => p.s.family.children === 0).length).toBeGreaterThan(0)
    const coach = adults.filter((p) => p.s.career.achievements.includes('少年野球の指導')).length
    expect(coach / adults.length).toBeLessThan(0.6)
  })
})

describe('the playing years open doors', () => {
  function adult(o: { edu: 'jhs' | 'hs' | 'univ'; knowledge: number; rank: number; captain?: boolean; money?: number; age?: number }): LifeState {
    const s = createLife({ seed: 77, country: 'JP', pace: 'p15' })
    s.age = o.age ?? 23
    const a = ensureAfter(s)
    a.edu = o.edu
    s.status.knowledge = o.knowledge
    s.career.highestRank = o.rank
    s.career.achievements = o.captain ? ['主将'] : []
    s.money = o.money ?? 0
    s.person.wealth = 3
    return s
  }
  const keys = (s: LifeState) => jobOffers(s, () => 0).map((o) => o.key)

  it('a university graduate who studied can join a large company, public service or teaching', () => {
    const k = keys(adult({ edu: 'univ', knowledge: 62, rank: 2 }))
    expect(k).toEqual(expect.arrayContaining(['large', 'public', 'teacher']))
  })
  it('without the background those doors stay closed', () => {
    const k = keys(adult({ edu: 'hs', knowledge: 40, rank: 2 }))
    for (const x of ['large', 'public', 'teacher', 'sporting', 'shop']) expect(k).not.toContain(x)
  })
  it('a high-school captain with a long career is valued by large companies and baseball firms', () => {
    const k = keys(adult({ edu: 'hs', knowledge: 40, rank: 4, captain: true }))
    expect(k).toEqual(expect.arrayContaining(['large', 'sporting']))
  })
  it('savings make starting a shop possible', () => {
    expect(keys(adult({ edu: 'hs', knowledge: 40, rank: 2, money: 300, age: 30 }))).toContain('shop')
  })
})

describe('choices after baseball change the outcome', () => {
  const base = (() => {
    for (let i = 0; i < 300; i++) {
      const p = playUi(hashSeed(i + 3_400_000), undefined, 40)
      if (p.s.alive && p.s.after?.work) return p.s
    }
    throw new Error('no working adult found')
  })()

  function rich(): LifeState {
    const s = JSON.parse(JSON.stringify(base)) as LifeState
    const a = ensureAfter(s)
    a.work = { title: '会社員（大手）', industry: 'office', employer: 'large', level: 1, years: 10, satisfaction: 50, regular: true, baseball: false }
    s.job = a.work.title
    a.home = 'rent'
    a.loan = 0
    a.baseballLife = []
    a.community = false
    a.goal = undefined
    a.retired = false
    a.care = false
    s.family.spouse = { name: '真理', years: 5 }
    s.family.partner = '真理'
    s.family.kids = [8, 5]
    s.family.children = 2
    s.family.father = 80
    s.family.mother = 78
    s.money = 500
    s.status.relations = 60
    s.status.knowledge = 60
    s.career.highestRank = Math.max(5, s.career.highestRank)
    return s
  }
  function ctx(s: LifeState, seed: number) {
    const asked: { n: number; data: Record<string, number | boolean | string> }[] = []
    const c: EventCtx = {
      s,
      rng: makeRng(seed),
      headless: true,
      add: () => {},
      ask: (d, data = {}) => asked.push({ n: d.choices.length, data }),
      canAsk: () => true,
    }
    return { c, asked }
  }
  const snapshot = (s: LifeState) => JSON.stringify([s.status, s.money, s.after, s.family, s.taken, s.career.achievements, s.job])

  for (const def of AFTER_EVENTS.filter((d) => d.resolve)) {
    it(def.id, () => {
      // some events only ask in some cases (a bad year for the shop, a talk with parents): try a few draws
      let s0: LifeState | undefined
      let q: { n: number; data: Record<string, number | boolean | string> } | undefined
      for (let seed = 1; seed <= 30 && !q; seed++) {
        s0 = rich()
        // a proposal is made to a partner he is not yet married to (love.propose refuses a second marriage)
        if (def.id === 'love.propose') s0.family.spouse = null
        const { c, asked } = ctx(s0, seed)
        def.run(c)
        q = asked[0]
      }
      expect(q, `${def.id} opens a decision`).toBeDefined()
      const outcomes = new Set<string>()
      for (let k = 0; k < q!.n; k++) {
        // outcomes over a few draws, so that a chance inside the outcome does not hide the difference
        const per: string[] = []
        for (let seed = 1; seed <= 6; seed++) {
          const s1 = JSON.parse(JSON.stringify(s0)) as LifeState
          def.resolve!(ctx(s1, seed).c, k, q!.data)
          per.push(snapshot(s1))
        }
        outcomes.add(per.sort().join('|'))
      }
      expect(outcomes.size, `${def.id}: choices lead to different states`).toBeGreaterThanOrEqual(2)
    })
  }
})

describe('decisions have consequences later in life', () => {
  const has = (p: Played, id: string) => p.s.log.some((e) => e.eventId === id)
  it('joining a 草野球 team brings games; a child in baseball brings his games', () => {
    const kusa = AUTO.filter((p) => p.s.log.some((e) => e.eventId === 'bbl.kusayakyu' && e.kind === 'good' && e.age < 60) && p.s.age >= 66)
    if (kusa.length >= 10) expect(kusa.filter((p) => has(p, 'bbl.kusaGame')).length / kusa.length).toBeGreaterThan(0.5)
    const kid = AUTO.filter((p) => p.s.taken.includes('family.kidPlays') && p.s.age >= 70)
    if (kid.length >= 10) expect(kid.filter((p) => has(p, 'family.kidGame')).length / kid.length).toBeGreaterThan(0.5)
  })
  it('wanting a child usually leads to a birth', () => {
    const want = AUTO.filter((p) => p.s.log.some((e) => e.text === '子どもを望むことにしました。' && e.age <= 40))
    expect(want.length).toBeGreaterThan(20)
    expect(want.filter((p) => p.s.family.children > 0).length / want.length).toBeGreaterThan(0.7)
  })
})

describe('general-population statistics (men)', () => {
  const lives = Array.from({ length: 4000 }, (_, i) => runHeadless({ seed: hashSeed(i + 3_500_000), country: 'JP', pace: 'p15' }, { params: defaultParams(), headless: true }))

  it('おまかせ lives die on average at the life-table age for men alive at 10 (令和7年簡易生命表)', () => {
    const at10 = lives.filter((s) => s.age >= 10)
    const mean = at10.reduce((a, s) => a + s.age, 0) / at10.length
    // the standard error of the mean of 4,000 lives is about 0.2 years
    expect(Math.abs(mean - statValue('jpLifeMaleAt10'))).toBeLessThan(1)
  })

  it('the share never married at 50 is near the statistic (人口統計資料集 表6-23, 2020)', () => {
    const at50 = lives.filter((s) => s.age > 50)
    const never = at50.filter((s) => s.family.marriedAge === undefined || s.family.marriedAge >= 50).length / at50.length
    // the standard error with about 3,800 lives is under 1 point
    expect(Math.abs(never - statValue('jpNeverMarried50Male'))).toBeLessThan(0.03)
  })
})
