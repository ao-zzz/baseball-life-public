import { describe, expect, it } from 'vitest'
import { createLife, endYear, planYear, resolveDecision, type Sim } from './life.ts'
import { defaultParams } from './params.ts'
import { hashSeed } from './rng.ts'
import { FA_AFTER_USE, FA_OVERSEAS, contractRuns, faSeasons, faStatus, seasonShare, stayTerms, suitorCount, suitorTerms } from './freeAgent.ts'
import type { Decision, LifeState, StatLine } from './types.ts'

// Free agency (PROJECT_PLAN §11.28): who has the right, the choice on screen, the offers, the contract that follows.

const headless: Sim = { params: defaultParams(), headless: true }
const screen: Sim = { params: defaultParams() }
const line = (o: Partial<StatLine>): StatLine => ({ games: 0, pa: 0, ab: 0, h: 0, hr: 0, rbi: 0, sb: 0, outs: 0, k: 0, er: 0, w: 0, l: 0, ...o })
type Pending = { pending?: { id: string; data: Record<string, number | boolean | string> } }

function step(s: LifeState, sim: Sim, choose?: (d: Decision) => number | undefined): Decision[] {
  const asked: Decision[] = []
  const plan = planYear(s, sim)
  let d = plan.decision?.decision
  while (d && s.alive) {
    asked.push(d)
    d = resolveDecision(s, choose?.(d) ?? d.autoIndex, sim).followUp?.decision
  }
  return asked
}

/** a pro life at the start of a year (before its plan), given `n` earlier first-team seasons in the record */
function proLife(skip: number, n: number, from = '高校'): LifeState | undefined {
  let found = 0
  for (let i = 0; i < 12000; i++) {
    const s = createLife({ seed: hashSeed(i + 7_300_000), country: 'JP', pace: 'p15', mode: 'potential', stars: 10 })
    for (let g = 0; g < 40 && s.alive; g++) {
      if (s.career.phase === 'pro' && s.career.proDebut && s.bb?.rec && !(s as Pending).pending) {
        if (found++ < skip) break
        const c = structuredClone(s)
        c.career.draftedFrom = from
        for (let k = 1; k <= n; k++) c.bb!.rec!.tournaments.push({ age: c.age - k, name: 'pro', result: '', line: line({ games: 130, pa: 500, ab: 450, h: 120, hr: 12 }), level: 'pro' })
        return c
      }
      step(s, headless)
      endYear(s)
    }
  }
  return undefined
}

/** a crafted life whose plan asks the FA decision (the year's own events and the season may ask something else first: next one) */
function asking(n: number, from = '高校', setup?: (s: LifeState) => void): { s: LifeState; d: Decision } {
  for (let skip = 0; skip < 400; skip++) {
    const s = proLife(skip, n, from)
    if (!s) break
    setup?.(s)
    const probe = structuredClone(s)
    const plan = planYear(probe, screen)
    if (plan.decision?.decision.id === 'fa.declare') return { s, d: plan.decision.decision }
  }
  throw new Error('no life asks the FA decision')
}

describe('who has the right', () => {
  const base = (rows: Partial<StatLine>[], from: string, age = 30, flags?: Record<string, number>): LifeState => {
    const s = createLife({ seed: 1, country: 'JP', pace: 'p15' })
    s.age = age
    s.career.draftedFrom = from
    s.person.position = 'IF'
    s.bb = { rec: { tournaments: [], official: {}, practice: {}, marks: [] } } as unknown as LifeState['bb']
    rows.forEach((r, i) => s.bb!.rec!.tournaments.push({ age: age - rows.length + 1 + i, name: 'pro', result: '', line: line(r), level: 'pro' }))
    if (flags) s.flags = flags
    return s
  }
  const full = (n: number) => Array.from({ length: n }, () => ({ games: 120 }))

  it('a high-school player needs 8 seasons, one from a university or a company team 7, and the day count is added up across seasons', () => {
    expect(faStatus(base(full(7), '高校')).domestic).toBe(false)
    expect(faStatus(base(full(8), '高校')).domestic).toBe(true)
    expect(faStatus(base(full(6), '大学')).domestic).toBe(false)
    expect(faStatus(base(full(7), '大学')).domestic).toBe(true)
    expect(faStatus(base(full(7), '社会人')).domestic).toBe(true)
    // seasons of half the games add up: 16 halves are 8, 15 are 7
    const half = (n: number) => Array.from({ length: n }, () => ({ games: 30 }))
    expect(faSeasons(base(half(16), '高校'))).toBe(8)
    expect(faSeasons(base(half(15), '高校'))).toBe(7)
    // one season never adds more than one (145 days is the most)
    expect(faSeasons(base([{ games: 600 }], '高校'))).toBe(1)
    // the pitcher's measures differ
    expect(seasonShare(line({ games: 60 }), 'reliever')).toBe(1)
    expect(seasonShare(line({ outs: 75 }), 'starter')).toBe(0.5)
  })

  it('the overseas right comes at 9 seasons (or 4 seasons after using the domestic one), and the domestic right is used once', () => {
    expect(faStatus(base(full(FA_OVERSEAS - 1), '高校')).overseas).toBe(false)
    expect(faStatus(base(full(FA_OVERSEAS), '高校')).overseas).toBe(true)
    // used at 8 seasons: the overseas right at 12, and no second domestic right
    const used = (n: number) => faStatus(base(full(n), '高校', 34, { 'fa.seasons': 8 }))
    expect(used(8 + FA_AFTER_USE - 1).overseas).toBe(false)
    expect(used(8 + FA_AFTER_USE).overseas).toBe(true)
    expect(used(10).domestic).toBe(false)
  })

  it('a contract that still runs next season has no right to use; one that ends this year has', () => {
    const s = base(full(8), '高校')
    s.career.team = 'A'
    s.career.contract = { salary: 20000, untilAge: s.age + 1, team: 'A' }
    expect(contractRuns(s)).toBe(true)
    s.career.contract.untilAge = s.age
    expect(contractRuns(s)).toBe(false)
    s.career.contract = { salary: 20000, untilAge: s.age + 3, team: 'B' }
    expect(contractRuns(s)).toBe(false)
  })
})

describe('the terms', () => {
  it('the old club offers a little above the renewal, for fewer years with age; other clubs a spread and a promise only rarely', () => {
    expect(stayTerms(10000, 26)).toEqual({ years: 3, salary: 10500 })
    expect(stayTerms(10000, 31).years).toBe(2)
    expect(stayTerms(10000, 36).years).toBe(1)
    expect(suitorCount(0.1, false)).toBe(0)
    expect(suitorCount(0.5, false)).toBe(1)
    expect(suitorCount(0.9, false)).toBe(2)
    expect(suitorCount(1.5, false)).toBe(3)
    expect(suitorCount(1.5, true)).toBe(2)
    expect(suitorTerms(10000, 26, false, [0, 0, 0]).salary).toBe(10000)
    expect(suitorTerms(10000, 26, false, [0.99, 0.99, 0.5]).salary).toBeLessThanOrEqual(14000)
    expect(suitorTerms(10000, 26, false, [0.5, 0.99, 0.5]).years).toBe(4)
    expect(suitorTerms(10000, 36, false, [0.5, 0.99, 0.5]).years).toBe(2)
    // the promise: only below 3% of the draws and never when hurt
    expect(suitorTerms(10000, 26, false, [0.5, 0.5, 0.02]).guarantee).toBe(true)
    expect(suitorTerms(10000, 26, false, [0.5, 0.5, 0.5]).guarantee).toBe(false)
    expect(suitorTerms(10000, 26, true, [0.5, 0.5, 0.02]).guarantee).toBe(false)
  })
})

describe('the choice on screen', () => {
  const key = (d: Decision, re: RegExp) => d.choices.findIndex((c) => re.test(c.label))

  it('is asked once the right is earned, and not in headless lives', () => {
    const { s, d } = asking(8)
    expect(d.autoIndex).toBe(0)
    expect(d.choices[0].label).toContain('任せる')
    // headless: the same life asks nothing and keeps the usual renewal
    expect(step(structuredClone(s), headless).some((x) => x.id === 'fa.declare')).toBe(false)
  }, 120_000)

  it('a contract that runs into next season stops the question; one that ends this year does not', () => {
    for (let skip = 0; skip < 25; skip++) {
      const s = proLife(skip, 8)
      if (!s) break
      s.career.contract = { salary: 20000, untilAge: s.age + 2, team: s.career.team }
      expect(step(s, screen).some((x) => x.id === 'fa.declare'), `life ${skip}`).toBe(false)
    }
    const { d } = asking(8, '高校', (c) => { c.career.contract = { salary: 20000, untilAge: c.age, team: c.career.team } })
    expect(d.id).toBe('fa.declare')
  }, 120_000)

  it('without enough seasons nothing is asked', () => {
    for (let skip = 0; skip < 30; skip++) {
      const s = proLife(skip, 5)
      if (!s) break
      expect(step(s, screen).some((x) => x.id === 'fa.declare')).toBe(false)
    }
  }, 120_000)

  it('the おまかせ answer changes nothing: the life goes on as the headless one', () => {
    const { s } = asking(8)
    const a = structuredClone(s)
    const b = structuredClone(s)
    for (let g = 0; g < 5 && a.alive; g++) {
      step(a, headless)
      endYear(a)
      step(b, screen)
      endYear(b)
    }
    expect(b.career.salaryHist).toEqual(a.career.salaryHist)
    expect(b.career.orgId).toBe(a.career.orgId)
    expect(b.career.phase).toBe(a.career.phase)
    expect(b.career.endedAge).toBe(a.career.endedAge)
    expect(b.career.contract).toEqual(a.career.contract)
  }, 120_000)

  it('staying signs the old club\'s offer: its years, pay and club, from next season', () => {
    const { s, d } = asking(8)
    const x = structuredClone(s)
    const team = s.career.team
    step(x, screen, (q) => (q.id === 'fa.declare' ? key(q, /^残留する/) : undefined))
    const c = x.career.contract!
    expect(c.team).toBe(team)
    expect(x.career.team).toBe(team)
    expect(x.career.nextSalary).toBe(c.salary)
    expect(c.untilAge).toBe(x.age + stayTerms(0, x.age).years)
    void d
    // the pay of next season is the offer, and the contract holds it to its last year
    const years = c.untilAge - x.age
    for (let k = 0; k < years; k++) {
      endYear(x)
      step(x, screen)
      if (x.career.phase !== 'pro') return
      expect(x.career.salaryHist!.at(-1)!.salary, `year ${k + 1} of ${years}`).toBe(c.salary)
    }
  }, 120_000)

  it('using the right shows the offers; a club is chosen and the contract, the team and the pay follow; with no other offer the old club signs', () => {
    let withOffers = 0
    let alone = 0
    for (let skip = 0; skip < 400 && (withOffers < 2 || alone < 1); skip++) {
      const s = proLife(skip, 8)
      if (!s) break
      const probe = structuredClone(s)
      if (planYear(probe, screen).decision?.decision.id !== 'fa.declare') continue
      const x = structuredClone(s)
      const asked: Decision[] = []
      const oldTeam = x.career.team
      const oldOrg = x.career.orgId
      step(x, screen, (q) => {
        asked.push(q)
        if (q.id === 'fa.declare') return key(q, /国内FA権を行使/)
        // the first other club
        if (q.id === 'fa.pick') return q.choices.findIndex((c) => !/^残留/.test(c.label))
        return undefined
      })
      expect(x.flags!['fa.used']).toBe(x.age)
      const pick = asked.find((q) => q.id === 'fa.pick')
      if (pick) {
        withOffers++
        expect(pick.choices.length).toBeGreaterThanOrEqual(2)
        expect(pick.choices[0].label).toContain('残留')
        // other clubs: every offer has years, a pay and a club
        for (const c of pick.choices) expect(c.label).toMatch(/\d年・年俸[\d,]+万円/)
        expect(x.career.orgId).not.toBe(oldOrg)
        expect(x.career.team).not.toBe(oldTeam)
        expect(x.career.contract!.team).toBe(x.career.team)
        expect(x.career.nextSalary).toBe(x.career.contract!.salary)
        endYear(x)
        step(x, screen)
        if (x.career.phase === 'pro') {
          expect(x.career.salaryHist!.at(-1)!.salary).toBe(x.career.contract?.salary ?? x.career.salaryHist!.at(-1)!.salary)
          expect(x.career.salaryHist!.at(-1)!.team).toBe(x.career.team)
        }
      } else {
        alone++
        expect(x.career.team).toBe(oldTeam)
        expect(x.career.orgId).toBe(oldOrg)
        expect(x.career.contract!.team).toBe(oldTeam)
      }
    }
    expect(withOffers).toBeGreaterThan(0)
    expect(alone).toBeGreaterThan(0)
  }, 180_000)

  it('the overseas right goes to the major leagues and ends any NPB contract; the domestic right is then used up', () => {
    const { s } = asking(9)
    const x = structuredClone(s)
    x.career.contract = { salary: 1, untilAge: 0, team: 'none' }
    const d = step(x, screen, (q) => (q.id === 'fa.declare' ? key(q, /海外FA/) : undefined))
    expect(d.some((q) => q.id === 'fa.declare' && key(q, /海外FA/) >= 0)).toBe(true)
    expect(x.career.phase).toBe('abroad')
    expect(x.career.contract).toBeUndefined()
    expect(x.flags!['fa.used']).toBe(x.age)
    expect(faStatus(x).domestic).toBe(false)
  }, 120_000)
})
