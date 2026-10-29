import { describe, expect, it } from 'vitest'
import { EVENTS, createLife, endYear, planYear, resolveDecision, type Sim } from './life.ts'
import { defaultParams } from './params.ts'
import { hashSeed, makeRng } from './rng.ts'
import type { Decision, LifeState, Phase } from './types.ts'
import { initBaseball, velocityKmh } from './ability.ts'
import { aceShare, emptyLine, knockout, participationHs, playGame, practiceCountHs } from './games.ts'
import { addLine } from './games.ts'
import { INDEP_LEAGUE_LEVELS, evaluate, indepRating } from './route/rating.ts'
import { hsShortlist, type Option } from './route/schools.ts'
import { SPECS } from './events/index.ts'
import type { EventCtx } from './events.ts'

// High school records and speed (PROJECT_PLAN §11.16): an ordinary player has an ordinary line, the best have
// the best, a strong school plays more and shares its pitching, the independent leagues differ in level, and
// the entrance to a school is decided before anything that happens in it. The calibrated careers are guarded by
// scripts/fingerprint.ts.

const sim: Sim = { params: defaultParams(), headless: true }
const q = (v: number[], p: number) => [...v].sort((a, b) => a - b)[Math.floor(p * (v.length - 1))]

function player(o: { z?: number; pos?: 'P' | 'IF'; team?: number; role?: 'starter' | 'bench' | 'outside'; phase?: Phase; age?: number; seed?: number } = {}): LifeState {
  const s = createLife({ seed: o.seed ?? 11, country: 'JP', pace: 'p15' })
  s.age = o.age ?? 17
  s.z = o.z ?? 0.4
  s.person.position = o.pos ?? 'IF'
  s.career.phase = o.phase ?? 'hs'
  s.bb = initBaseball(s, makeRng(2))
  for (const k of Object.keys(s.bb.skills) as (keyof typeof s.bb.skills)[]) s.bb.skills[k] = 0
  s.bb.teamStrength = o.team ?? 0
  s.bb.role = o.role ?? 'starter'
  return s
}

describe('the records of a high school player', () => {
  // 1,500 lives to the end of high school, decisions by おまかせ
  const batters: number[] = []
  const hrCareer: number[] = []
  const pitchersIp: number[] = []
  const pitchersEra: number[] = []
  const velocity: number[] = []
  for (let i = 0; i < 2500; i++) {
    const s = createLife({ seed: hashSeed(i + 6_100_000), country: 'JP', pace: 'p15' })
    let v17: number | undefined
    for (let g = 0; g < 20 && s.alive && s.age <= 18; g++) {
      const plan = planYear(s, sim)
      if (s.age === 17 && s.career.phase === 'hs' && s.person.position === 'P') v17 = velocityKmh(s)
      let d: Decision | undefined = plan.decision?.decision
      while (d && s.alive) d = resolveDecision(s, d.autoIndex, sim).followUp?.decision
      endYear(s)
    }
    const rec = s.bb?.rec
    if (!rec || !s.timeline.some((t) => t.phase === 'hs')) continue
    const all = addLine(rec.official.hs ?? emptyLine(), rec.practice.hs ?? emptyLine())
    const yrs = Math.max(1, new Set((rec.tournaments ?? []).filter((t) => (t.level ?? 'hs') === 'hs').map((t) => t.age)).size)
    if (s.person.position === 'P') {
      if (v17) velocity.push(v17)
      if (s.bb!.role === 'starter') {
        pitchersIp.push(all.outs / 3 / yrs)
        if (all.outs >= 30) pitchersEra.push((all.er * 27) / all.outs)
      }
    } else if (s.bb!.role === 'starter' && all.ab >= 20) {
      batters.push(all.h / all.ab)
      hrCareer.push(all.hr)
    }
  }

  it('batting: a regular hits about .260, the best about .330, and the very best a little over .380', () => {
    expect(batters.length).toBeGreaterThan(200)
    expect(q(batters, 0.5)).toBeGreaterThan(0.235)
    expect(q(batters, 0.5)).toBeLessThan(0.29)
    expect(q(batters, 0.9)).toBeGreaterThan(0.3)
    expect(q(batters, 0.9)).toBeLessThan(0.37)
    expect(q(batters, 0.99)).toBeLessThan(0.45)
    // the best are clearly better than the ordinary
    expect(q(batters, 0.9) - q(batters, 0.5)).toBeGreaterThan(0.04)
  })

  it('home runs over a high school career: a few for most, tens for the few', () => {
    expect(q(hrCareer, 0.5)).toBeLessThanOrEqual(8)
    expect(q(hrCareer, 0.99)).toBeGreaterThan(15)
    expect(q(hrCareer, 0.99)).toBeLessThan(90)
  })

  it('pitching: an ordinary starter has an ERA near four, a year of 50 innings, and no one pitches 250', () => {
    expect(pitchersIp.length).toBeGreaterThan(60)
    expect(q(pitchersEra, 0.5)).toBeGreaterThan(3.2)
    expect(q(pitchersEra, 0.5)).toBeLessThan(4.8)
    expect(q(pitchersIp, 0.5)).toBeLessThan(75)
    expect(q(pitchersIp, 0.99)).toBeLessThan(200)
    expect(Math.max(...pitchersIp)).toBeLessThan(240)
  })

  it('speed: a third-year pitcher’s median is 127 km/h, the lowest tenth about 117 and the top one in a hundred about 143', () => {
    expect(velocity.length).toBeGreaterThan(100)
    expect(q(velocity, 0.5)).toBeGreaterThanOrEqual(126)
    expect(q(velocity, 0.5)).toBeLessThanOrEqual(128)
    expect(q(velocity, 0.1)).toBeGreaterThanOrEqual(116)
    expect(q(velocity, 0.1)).toBeLessThanOrEqual(119)
    expect(q(velocity, 0.99)).toBeGreaterThanOrEqual(140)
    expect(q(velocity, 0.99)).toBeLessThanOrEqual(146)
  })

  it('speed follows ability and the pitcher’s training, so a better pitcher is faster at every age', () => {
    for (const age of [14, 16, 17, 18]) {
      const slow = player({ pos: 'P', z: -0.5, age })
      const fast = player({ pos: 'P', z: 2.0, age })
      expect(velocityKmh(fast), `age ${age}`).toBeGreaterThan(velocityKmh(slow) + 12)
      const trained = player({ pos: 'P', z: 0.5, age })
      trained.bb!.skills.velocity = 0.8
      expect(velocityKmh(trained)).toBeGreaterThan(velocityKmh(player({ pos: 'P', z: 0.5, age })))
    }
    // growing up: the same ability throws faster each year to the early twenties
    const speeds = [14, 15, 16, 17, 18, 20].map((age) => velocityKmh(player({ pos: 'P', z: 0.5, age })))
    expect(speeds).toEqual([...speeds].sort((x, y) => x - y))
  })
})

describe('school strength: games, places and the staff', () => {
  it('a strong school plays far more practice games than a weak one', () => {
    const n = (team: number) => {
      const s = player({ team })
      let t = 0
      for (let i = 0; i < 300; i++) t += practiceCountHs(s, makeRng(i + 1))
      return t / 300
    }
    expect(n(0.9)).toBeGreaterThan(n(-0.15) * 1.5)
    expect(n(0.9)).toBeGreaterThan(40)
    expect(n(-0.15)).toBeLessThan(36)
  })

  it('a good pitcher of a weak school pitches nearly every game; the same pitcher in a strong school shares it', () => {
    expect(aceShare(player({ pos: 'P', z: 0.6, team: -0.15 }))).toBeGreaterThan(aceShare(player({ pos: 'P', z: 0.6, team: 0.9 })) + 0.2)
    let weak = 0
    let strong = 0
    for (let i = 0; i < 400; i++) {
      weak += participationHs(player({ pos: 'P', z: 0.6, team: -0.15 }), makeRng(i + 1)).outs
      strong += participationHs(player({ pos: 'P', z: 0.6, team: 0.9 }), makeRng(i + 1)).outs
    }
    expect(weak).toBeGreaterThan(strong * 1.3)
  })

  it('a regular of a weak school bats more than a bench player of a strong one, who may be the better player', () => {
    const pa = (role: 'starter' | 'bench', team: number, z: number) => {
      let t = 0
      for (let i = 0; i < 300; i++) t += participationHs(player({ role, team, z }), makeRng(i + 3)).pa
      return t / 300
    }
    expect(pa('starter', -0.15, 0.2)).toBeGreaterThan(pa('bench', 0.9, 1.4) * 2)
  })

  it('the same ability gives a better line in a weaker team’s league after high school, and a poorer one in a stronger', () => {
    const avg = (phase: Phase, team: number) => {
      let l = emptyLine()
      for (let i = 0; i < 600; i++) l = addLine(l, playGame(player({ phase, age: 21, z: 1.0, team }), makeRng(i + 7), 'univ', 4, 0))
      return l.h / l.ab
    }
    expect(avg('univ', 0.05)).toBeGreaterThan(avg('univ', 1.15))
  })

  it('what a high school tournament does to confidence is drawn from the earlier model (so the calibrated lives do not move)', () => {
    const s = player({ team: 0.2 })
    const r = knockout(s, makeRng(5), 'hs', 5, 0.6)
    expect(r.feel).toBeDefined()
    // the shown line and the felt line are both real lines of the same games, drawn apart
    expect(r.line.games).toBe(r.feel!.games)
  })
})

describe('the entrance to a high school is decided before anything in it', () => {
  it('the offers for the sports recommendation do not change with what happens after entering', () => {
    const strip = (os: Option[]) => os.map((o) => [o.id, Math.round(o.p * 1000)])
    for (let i = 0; i < 30; i++) {
      const base = player({ z: 1.5, age: 15, phase: 'jhs', seed: 40 + i, team: 1.0 })
      base.person.prefecture = i % 47
      const after = structuredClone(base)
      after.career.achievements = ['甲子園', '主将']
      after.flags = { 'coach.trust': 16, 'hs.visitUniv': 17, 'rep.youth': 16 }
      after.bb!.injuries = 0
      after.bb!.rec = { official: { hs: { ...emptyLine(), ab: 200, h: 90, hr: 12, pa: 220, games: 40 } }, practice: {}, tournaments: [{ age: 16, name: 'x', result: '優勝', line: emptyLine(), level: 'hs' }], marks: [] }
      const a = hsShortlist(base, 'strong', makeRng(i + 1))
      const b = hsShortlist(after, 'strong', makeRng(i + 1))
      expect(strip(b)).toEqual(strip(a))
      expect(evaluate(after, { beforeHs: true }).total).toBeCloseTo(evaluate(base, { beforeHs: true }).total, 6)
    }
  })

  it('only the sports recommendation and the entrance examination exist at this age', () => {
    for (let i = 0; i < 100; i++) {
      const s = player({ seed: 200 + i, age: 15, phase: 'jhs', team: i % 2 ? 1 : -0.1 })
      s.person.prefecture = i % 47
      for (const kind of ['strong', 'public', 'quit'] as const) for (const o of hsShortlist(s, kind, makeRng(i + 1))) expect(['sports', 'general']).toContain(o.method)
    }
  })

  it('the sports recommendation is judged on baseball (the evaluation), never on 偏差値', () => {
    const s1 = player({ z: 1.5, age: 15, phase: 'jhs', team: 1.0 })
    const s2 = structuredClone(s1)
    s1.status.knowledge = 20
    s2.status.knowledge = 90
    const a = hsShortlist(s1, 'strong', makeRng(3)).filter((o) => o.method === 'sports')
    const b = hsShortlist(s2, 'strong', makeRng(3)).filter((o) => o.method === 'sports')
    expect(a.map((o) => [o.id, o.p])).toEqual(b.map((o) => [o.id, o.p]))
  })
})

describe('independent leagues differ in level', () => {
  it('each league has a level made from the NPB drafts (official), stated as an estimate where the data are thin', () => {
    expect(INDEP_LEAGUE_LEVELS.length).toBe(3)
    const by = Object.fromEntries(INDEP_LEAGUE_LEVELS.map((l) => [l.league, l]))
    expect(by['四国アイランドリーグplus'].perTeamYear).toBeGreaterThan(by['ルートインBCリーグ'].perTeamYear * 2)
    expect(by['四国アイランドリーグplus'].offset).toBeGreaterThan(by['ルートインBCリーグ'].offset + 0.2)
    for (const l of INDEP_LEAGUE_LEVELS) expect(Math.abs(l.offset)).toBeLessThanOrEqual(0.3)
    expect(indepRating('il-tokushima')!.value).toBeGreaterThan(indepRating('il-kagawa')!.value)
    expect(indepRating('il-tokushima')!.note).toContain('NPBドラフト')
  })

  it('a better player is taken by the higher leagues more often; the same ability is judged against a higher bar there', () => {
    const top = indepRating('il-tokushima')!
    const low = indepRating('bc-chiba')!
    expect(top.value).toBeGreaterThan(low.value)
    const strong = evaluate(player({ z: 2.0, age: 21, phase: 'univ' }))
    const weak = evaluate(player({ z: 0.0, age: 21, phase: 'univ' }))
    expect(strong.total).toBeGreaterThan(weak.total + 1.5)
  })
})

describe('outside trainers: rare, paid for by the family or the player, never a sure thing', () => {
  const offer = SPECS.find((s) => s.id === 'x.trainer.offer')!
  const open = (s: LifeState) => {
    let asked: Decision | undefined
    const c = { s, rng: makeRng(1), headless: true, add: () => {}, ask: (d: Decision) => (asked ??= d), canAsk: () => true } as unknown as EventCtx
    EVENTS.get('x.trainer.offer')!.run(c)
    return asked!
  }

  it('the paid choice is shown only when the family can pay (before 18) or he has the savings (after)', () => {
    const poor = player({ age: 14, phase: 'jhs' })
    poor.person.wealth = 1
    const rich = structuredClone(poor)
    rich.person.wealth = 5
    expect(open(poor).choices.length).toBe(2)
    expect(open(rich).choices.length).toBe(3)
    expect(open(rich).choices[0].label).toContain('専門のトレーナー')
    const broke = player({ age: 22, phase: 'univ' })
    broke.money = 5
    const saver = structuredClone(broke)
    saver.money = 300
    expect(open(broke).choices.length).toBe(2)
    expect(open(saver).choices.length).toBe(3)
  })

  it('it is rare and the おまかせ answer is the free one', () => {
    expect(offer.weight).toBeLessThanOrEqual(3)
    expect(offer.maxPerLife).toBeLessThanOrEqual(2)
    expect(offer.choices![offer.auto as number].effects).toBeUndefined()
    // it can go wrong: some outcome of the paid choice lowers confidence
    const paid = offer.choices![0]
    expect(paid.outcomes.some((o) => (o.effects?.conf ?? 0) < 0)).toBe(true)
    expect(paid.outcomes.some((o) => (o.effects?.gain ?? 0) > 0)).toBe(true)
    expect(paid.effects?.money).toBeLessThan(0)
  })

  it('a history of injuries makes a relapse likelier, and the expert’s care takes part of the history off the evaluation', () => {
    const relapse = SPECS.find((s) => s.id === 'x.health.relapse')!
    const w = relapse.outcomes![0].weight as (s: LifeState) => number
    const a = player()
    a.bb!.injuries = 0
    const b = player()
    b.bb!.injuries = 3
    expect(w(b)).toBeGreaterThan(w(a) + 1)
    const hurt = player()
    hurt.bb!.injuries = 2
    const cared = structuredClone(hurt)
    cared.flags = { 'rehab.expert': 17 }
    expect(evaluate(cared).total).toBeGreaterThan(evaluate(hurt).total)
  })
})
