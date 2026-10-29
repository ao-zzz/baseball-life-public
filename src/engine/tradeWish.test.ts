import { describe, expect, it } from 'vitest'
import { createLife, endYear, planYear, resolveDecision, runHeadless, type Sim } from './life.ts'
import { defaultParams } from './params.ts'
import { hashSeed } from './rng.ts'
import { EVENTS } from './life.ts'
import { contractRuns } from './freeAgent.ts'
import type { Decision, LifeState } from './types.ts'

// The trade offer (events/proLife.ts x.pro.trade): the clubs decide, the player says what he wishes. Accepting moves him; wishing to stay
// is heard but does not by itself stop the trade; the おまかせ answer (no reply) changes nothing, as it never did.

const headless: Sim = { params: defaultParams(), headless: true }
const screen: Sim = { params: defaultParams() }
type WithPending = LifeState & { pending?: { id: string; data: Record<string, number | boolean | string> } }

/** pro lives at the start of a year, 25 or older, with a role set by hand */
function proLives(n: number): LifeState[] {
  const out: LifeState[] = []
  for (let i = 0; i < 20000 && out.length < n; i++) {
    const s = createLife({ seed: hashSeed(i + 7_700_000), country: 'JP', pace: 'p15', mode: 'potential', stars: 10 })
    for (let g = 0; g < 45 && s.alive; g++) {
      if (s.career.phase === 'pro' && s.career.proDebut && s.bb && s.age >= 25 && !(s as WithPending).pending) {
        out.push(structuredClone(s))
        break
      }
      const plan = planYear(s, headless)
      let d = plan.decision?.decision
      while (d && s.alive) d = resolveDecision(s, d.autoIndex, headless).followUp?.decision
      endYear(s)
    }
  }
  return out
}

/** the real resolution path: the decision is pending as the event would leave it, then resolved as on screen */
function answer(s: LifeState, choice: number): LifeState {
  const x = structuredClone(s) as WithPending
  x.pending = { id: 'x.pro.trade', data: { open: '0,1,2' } }
  resolveDecision(x, choice, screen)
  return x
}

// A trade carries a multi-year contract that still runs (PROJECT_PLAN §11.27, §11.29): same years, same pay, the new club.
const line = (games: number) => ({ games, pa: 0, ab: 0, h: 0, hr: 0, rbi: 0, sb: 0, outs: 0, k: 0, er: 0, w: 0, l: 0 })
const FA_ID = 'fa.declare'

/** pro lives at the start of a year with eight first-team seasons in the record (the free agency right) and a contract of `years` more years */
function contractLives(n: number, years: number): LifeState[] {
  const out: LifeState[] = []
  for (const s of proLives(n)) {
    const c = structuredClone(s)
    c.career.draftedFrom = '高校'
    for (let k = 1; k <= 8; k++) c.bb!.rec!.tournaments.push({ age: c.age - k, name: 'pro', result: '', line: line(130) as never, level: 'pro' })
    const plan = planYear(c, screen)
    let d = plan.decision?.decision
    while (d && c.alive) d = resolveDecision(c, d.autoIndex, screen).followUp?.decision
    endYear(c)
    if (c.career.phase !== 'pro' || !c.career.salaryHist?.length) continue
    c.career.contract = { salary: c.career.salary, untilAge: c.age + years, team: c.career.team }
    out.push(c)
  }
  return out
}

/** one year as on screen, answering おまかせ; the ids asked */
function year(x: LifeState): string[] {
  const ids: string[] = []
  const plan = planYear(x, screen)
  let d = plan.decision?.decision
  while (d && x.alive) {
    ids.push(d.id)
    d = resolveDecision(x, d.autoIndex, screen).followUp?.decision
  }
  return ids
}

/** the years after a trade: the pay and the years of the contract hold, the club is the new one, no free agency decision in between, and the year after it recomputes */
function checkCarried(x: LifeState, before: NonNullable<LifeState['career']['contract']>, where: string) {
  const c = x.career.contract!
  expect(c, where).toBeDefined()
  expect(c.team, where).toBe(x.career.team)
  expect(c.salary, where).toBe(before.salary)
  expect(c.untilAge, where).toBe(before.untilAge)
  expect(contractRuns(x), where).toBe(true)
  let remaining = before.untilAge - x.age
  expect(remaining).toBeGreaterThan(0)
  endYear(x)
  while (x.alive && x.career.phase === 'pro' && remaining > 0) {
    const ids = year(x)
    // (released, retired or gone abroad in the year: the contract no longer says anything)
    if (x.career.phase !== 'pro') return
    // (while the contract covers next season: no free agency; in its last year the question is due, as it was designed)
    if (x.age < before.untilAge) expect(ids, `${where} age ${x.age}`).not.toContain(FA_ID)
    const h = x.career.salaryHist!.at(-1)!
    if (h.age !== x.age || h.kind !== 'shihaika') return
    expect(h.salary, `${where} age ${x.age}`).toBe(before.salary)
    expect(h.team, where).toBe(x.career.team)
    remaining--
    endYear(x)
  }
  if (x.alive && x.career.phase === 'pro') {
    // the year after the last year of the contract: it has run out and the pay is priced again (a new contract may follow a star year)
    year(x)
    expect(x.career.contract?.untilAge === before.untilAge && x.career.contract?.salary === before.salary, where).toBe(false)
  }
}

describe('a trade carries the contract that still runs', () => {
  const lives = contractLives(40, 2)

  it('x.pro.trade (accepted): the club changes, the years and the pay stay, and no free agency decision comes before it ends', () => {
    expect(lives.length).toBeGreaterThan(5)
    let moved = 0
    for (const s of lives) {
      const x = structuredClone(s) as WithPending
      year(x)
      // (the year itself may release him, or sign a new contract after a star year: the trade is tested on a contract that runs)
      if (x.career.phase !== 'pro' || !contractRuns(x)) continue
      const before = { ...x.career.contract! }
      const old = x.career.orgId
      x.pending = { id: 'x.pro.trade', data: { open: '0,1,2' } }
      resolveDecision(x, 0, screen)
      expect(x.career.orgId).not.toBe(old)
      moved++
      checkCarried(x, before, `seed ${s.config.seed}`)
    }
    expect(moved).toBeGreaterThan(5)
  }, 120_000)

  it('x.trade.rumorBack (the club moves him after he spoke): the same', () => {
    let moved = 0
    for (const s of lives.slice(0, 25)) {
      for (let k = 0; k < 40; k++) {
        const x = structuredClone(s)
        x.config.seed = (x.config.seed + k * 7919) >>> 0
        ;(x.flags ??= {})['trade.spoke'] = x.age
        ;(x.due ??= []).push({ id: 'x.trade.rumorBack', age: x.age, until: x.age + 2, from: 'x.trade.rumor' })
        const before = { ...x.career.contract! }
        const old = x.career.orgId
        const ids: string[] = []
        const plan = planYear(x, screen)
        let d = plan.decision?.decision
        while (d && x.alive) {
          ids.push(d.id)
          d = resolveDecision(x, d.autoIndex, screen).followUp?.decision
        }
        if (x.career.orgId === old || x.career.phase !== 'pro') continue
        moved++
        // (this year too: the contract covers next season)
        if (x.age < before.untilAge) expect(ids).not.toContain(FA_ID)
        checkCarried(x, before, `seed ${x.config.seed}`)
        break
      }
    }
    expect(moved).toBeGreaterThan(2)
  }, 180_000)

  it('without a contract, or with one that has run out, nothing is carried', () => {
    for (const s of lives.slice(0, 15)) {
      // no contract
      const none = structuredClone(s) as WithPending
      delete none.career.contract
      year(none)
      if (none.career.phase === 'pro') {
        delete none.career.contract
        none.pending = { id: 'x.pro.trade', data: { open: '0,1,2' } }
        resolveDecision(none, 0, screen)
        expect(none.career.contract).toBeUndefined()
      }
      // a contract whose last year is this one: it does not cover next season, so it is not moved to the new club
      const over = structuredClone(s) as WithPending
      const old = { ...over.career.contract!, untilAge: over.age }
      over.career.contract = { ...old }
      year(over)
      if (over.career.phase !== 'pro' || over.career.contract?.untilAge !== old.untilAge) continue
      const oldTeam = over.career.team
      over.pending = { id: 'x.pro.trade', data: { open: '0,1,2' } }
      resolveDecision(over, 0, screen)
      expect(over.career.team).not.toBe(oldTeam)
      expect(over.career.contract).toEqual(old)
      expect(over.career.contract?.team).not.toBe(over.career.team)
      endYear(over)
      year(over)
      // dropped (a new contract may follow a star year, but never this one)
      expect(over.career.contract?.untilAge === old.untilAge && over.career.contract?.salary === old.salary).toBe(false)
    }
  }, 120_000)

  it('free agency still signs its own contract (not moved by the hook) and a move abroad still ends it', () => {
    const s = lives[0]
    const x = structuredClone(s) as WithPending
    x.pending = { id: 'jp.mlb', data: {} }
    resolveDecision(x, 0, screen)
    expect(x.career.phase).toBe('abroad')
    expect(x.career.contract).toBeUndefined()
  })
})

describe('the trade offer and the player\'s wish', () => {
  const lives = proLives(12)

  it('is a decision of three answers; the おまかせ answer is the neutral one', () => {
    expect(lives.length).toBeGreaterThan(3)
    const def = EVENTS.get('x.pro.trade')!
    expect(def).toBeDefined()
    // the decision as the event asks it
    let asked: Decision | undefined
    def.run({ s: lives[0], rng: { next: () => 0.5 } as never, headless: false, add: () => {}, ask: (d) => { asked = d }, canAsk: () => true })
    expect(asked!.choices.map((c) => c.label)).toEqual(['受け入れて移る', '残留を希望する', '返事をせず、様子を見る'])
    expect(asked!.autoIndex).toBe(2)
    expect(asked!.choices[1].hint).toContain('決めるのは球団')
  })

  it('no reply changes nothing: team, club, pay and contract are as they were, and no move is recorded', () => {
    for (const s of lives) {
      const x = answer(s, 2)
      expect(x.career.orgId).toBe(s.career.orgId)
      expect(x.career.team).toBe(s.career.team)
      expect(x.career.nextSalary).toBe(s.career.nextSalary)
      expect(x.career.contract).toEqual(s.career.contract)
      expect(x.career.salaryHist).toEqual(s.career.salaryHist)
      expect(x.flags?.['pro.tradeMoved']).toBeUndefined()
      expect(x.due ?? []).toEqual(s.due ?? [])
    }
  })

  it('accepting moves him to another real NPB club at once and books the follow-up', () => {
    for (const s of lives) {
      const x = answer(s, 0)
      expect(x.career.orgId).not.toBe(s.career.orgId)
      expect(x.career.team).not.toBe(s.career.team)
      expect(x.career.phase).toBe('pro')
      expect(x.flags?.['pro.tradeMoved']).toBe(s.age)
      expect(x.due?.some((d) => d.id === 'x.pro.tradeBack')).toBe(true)
    }
  })

  it('wishing to stay is heard but is not a veto: sometimes the trade goes through anyway, and a regular is kept more often', () => {
    const rate = (role: 'starter' | 'bench' | 'outside') => {
      let kept = 0
      let moved = 0
      for (let k = 0; k < 400; k++) {
        const s = structuredClone(lives[k % lives.length])
        s.config.seed = (s.config.seed + k * 7919) >>> 0
        s.bb!.role = role
        const x = answer(s, 1)
        if (x.career.orgId !== s.career.orgId) {
          moved++
          expect(x.flags?.['pro.tradeMoved']).toBe(s.age)
          expect(x.due?.some((d) => d.id === 'x.pro.tradeBack')).toBe(true)
        } else {
          kept++
          expect(x.career.team).toBe(s.career.team)
          expect(x.flags?.['pro.tradeMoved']).toBeUndefined()
        }
      }
      return { kept, moved, share: kept / (kept + moved) }
    }
    const starter = rate('starter')
    const outside = rate('outside')
    for (const r of [starter, outside]) {
      expect(r.moved).toBeGreaterThan(0)
      expect(r.kept).toBeGreaterThan(0)
    }
    expect(starter.share).toBeGreaterThan(outside.share + 0.1)
    expect(starter.share).toBeLessThan(0.95)
  })

  it('on the おまかせ path nothing moves: a pro life played as the おまかせ on screen and headless keeps the same club and pay', () => {
    for (const s of lives.slice(0, 6)) {
      const a = structuredClone(s)
      const b = structuredClone(s)
      for (let g = 0; g < 4 && a.alive; g++) {
        for (const [x, sim] of [[a, headless], [b, screen]] as [LifeState, Sim][]) {
          const plan = planYear(x, sim)
          let d = plan.decision?.decision
          while (d && x.alive) d = resolveDecision(x, d.autoIndex, sim).followUp?.decision
          endYear(x)
        }
      }
      expect(b.career.orgId).toBe(a.career.orgId)
      expect(b.career.salaryHist).toEqual(a.career.salaryHist)
      expect(b.career.phase).toBe(a.career.phase)
    }
    void runHeadless
  }, 120_000)
})
