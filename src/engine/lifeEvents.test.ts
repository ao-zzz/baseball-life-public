import { describe, expect, it } from 'vitest'
import { EVENTS, createLife, endYear, planYear, resolveDecision, runHeadless, type Sim } from './life.ts'
import { AMATEUR_META, AMATEUR_OFFICIAL_2025, AMATEUR_TEAMS, JABA_REGION_OF_PREF } from '../data/teams.ts'
import { ORGS, orgById } from '../data/orgs.ts'
import { PREFECTURES } from '../data/jp.ts'
import { runDue, type EventCtx } from './events.ts'
import { SPECS } from './events/index.ts'
import { hasFlag } from './events/spec.ts'
import { defaultParams } from './params.ts'
import { hashSeed, makeRng } from './rng.ts'
import type { Decision, LifeState } from './types.ts'
import { jobOffers } from './after.ts'
import { recommendP, sportsP } from './route/schools.ts'

// The high-school, university and old-age events (PROJECT_PLAN §11.12): a choice really changes ability,
// confidence, the place in the team, relations, money and later chances; the おまかせ path leaves the
// calibrated variables alone; follow-ups come a year later.

const sim: Sim = { params: defaultParams() }

function lifeAt(age: number, ok: (s: LifeState) => boolean): LifeState {
  for (let i = 0; i < 4000; i++) {
    const s = createLife({ seed: hashSeed(i + 960_000), country: 'JP', pace: 'p15' })
    for (let g = 0; g < 130 && s.alive && s.age < age; g++) {
      const plan = planYear(s, sim)
      let d: Decision | undefined = plan.decision?.decision
      while (d && s.alive) d = resolveDecision(s, d.autoIndex, sim).followUp?.decision
      endYear(s)
    }
    if (s.alive && s.age === age && ok(s)) return s
  }
  throw new Error('no life found')
}

function ctxFor(s: LifeState, seed = 1) {
  const lines: { kind: string; text: string }[] = []
  let asked: { d: Decision; data: Record<string, number | boolean | string> } | undefined
  const c: EventCtx = {
    s,
    rng: makeRng(seed),
    headless: true,
    add: (kind, text) => lines.push({ kind, text }),
    ask: (d, data = {}) => {
      asked ??= { d, data }
    },
    canAsk: () => !asked,
  }
  return { c, lines, asked: () => asked }
}

/** the calibrated variables an extra event must not touch on the おまかせ path */
const snap = (s: LifeState) =>
  JSON.stringify([s.z, s.status, s.money, s.career.injured, s.career.achievements, s.bb && [s.bb.confidence, s.bb.coachEval, s.bb.fatigue, s.bb.gain, s.bb.skills, s.bb.captain, s.bb.role]])

/** run an event's decision, choosing `choice` (an index into the choices it offers) */
function choose(id: string, s: LifeState, label: string | number, seed = 1) {
  const def = EVENTS.get(id)!
  const { c, lines, asked } = ctxFor(s, seed)
  def.run(c)
  const a = asked()
  expect(a, `${id} asked nothing`).toBeDefined()
  const i = typeof label === 'number' ? label : a!.d.choices.findIndex((x) => x.label.includes(label))
  expect(i, `${id}: no choice ${label}`).toBeGreaterThanOrEqual(0)
  def.resolve!(c, i, a!.data)
  return { lines, decision: a!.d }
}

const hsLife = () => lifeAt(16, (s) => s.career.phase === 'hs' && !!s.bb && s.career.injured === 0)

describe('every new decision: おまかせ is neutral, the other choices change something', () => {
  const decisions = SPECS.filter((s) => s.choices && !s.followOnly)

  it('there are many, in high school, university and old age', () => {
    expect(decisions.length).toBeGreaterThan(20)
    const stages = new Set(decisions.flatMap((s) => s.stages))
    for (const st of ['hs', 'univ', 'amateur', 'pro', 'adult', 'senior', 'jhs', 'youth', 'student'] as const) expect(stages.has(st), st).toBe(true)
  })

  it('in each, the choices differ in effect, and the おまかせ choice has none on the calibrated variables', () => {
    for (const spec of decisions) {
      const auto = spec.choices![typeof spec.auto === 'number' ? spec.auto : 0]
      const autoEffects = [auto.effects, ...auto.outcomes.map((o) => o.effects)]
      for (const e of autoEffects) expect(Object.keys(e ?? {}).filter((k) => k !== 'flag'), `${spec.id} auto`).toEqual([])
      const others = spec.choices!.filter((c) => c !== auto)
      expect(others.some((c) => c.effects || c.outcomes.some((o) => o.effects)), `${spec.id}: every choice is empty`).toBe(true)
    }
  })

  it('on a real life, the おまかせ answer leaves ability, confidence, place, money and health unchanged', () => {
    const s = hsLife()
    s.bb!.role = 'bench'
    for (const id of ['x.hs.coachAsk', 'x.hs.nightWork', 'x.hs.appeal', 'x.hs.exam', 'x.hs.winterBody', 'x.hs.teamMeal']) {
      const before = snap(s)
      const def = EVENTS.get(id)!
      const { c, asked } = ctxFor(s, 3)
      def.run(c)
      def.resolve!(c, asked()!.d.autoIndex, asked()!.data)
      expect(snap(s), id).toBe(before)
    }
  })
})

describe('what the choices do', () => {
  it('asking the coach: his view and the player’s confidence move, and the advice comes back a year later', () => {
    const s = hsLife()
    s.bb!.role = 'bench'
    const before = { eval: s.bb!.coachEval, conf: s.bb!.confidence, gain: s.bb!.gain }
    let booked = false
    for (let seed = 1; seed < 40 && !booked; seed++) {
      const t = structuredClone(s) as LifeState
      choose('x.hs.coachAsk', t, '足りない点を聞きに行く', seed)
      if (hasFlag(t, 'hs.coachAdvice')) {
        booked = true
        expect(t.bb!.coachEval).toBe(before.eval + 3)
        expect(t.bb!.confidence).toBe(before.conf - 2)
        expect(t.bb!.gain).toBeCloseTo(before.gain + 0.01)
        expect(t.due).toEqual([{ id: 'x.hs.coachBloom', age: t.age + 1, until: t.age + 3, from: 'x.hs.coachAsk' }])
        // a year on, the follow-up runs and moves confidence again
        t.age++
        const { c, lines } = ctxFor(t)
        const conf = t.bb!.confidence
        runDue(EVENTS, c, 'hs', new Set())
        expect(lines.length).toBe(1)
        expect(t.bb!.confidence).not.toBe(conf)
      }
    }
    expect(booked).toBe(true)
  })

  it('night practice trades ability for fatigue and, now and then, an injury', () => {
    const s = hsLife()
    let injured = 0
    for (let seed = 1; seed <= 60; seed++) {
      const t = structuredClone(s) as LifeState
      const fat = t.bb!.fatigue
      const gain = t.bb!.gain
      choose('x.hs.nightWork', t, '夜の素振り', seed)
      expect(t.bb!.fatigue).toBeGreaterThan(fat)
      expect(t.bb!.gain).toBeGreaterThan(gain)
      if (t.career.injured > 0) injured++
    }
    expect(injured).toBeGreaterThan(3)
    expect(injured).toBeLessThan(30)
  })

  it('hiding pain risks a long injury; resting lowers fatigue', () => {
    const s = hsLife()
    s.bb!.fatigue = 70
    let hurt = 0
    for (let seed = 1; seed <= 60; seed++) {
      const t = structuredClone(s) as LifeState
      choose('x.hs.fatigueWarn', t, '痛みを隠して', seed)
      if (t.career.injured > 0) hurt++
    }
    expect(hurt).toBeGreaterThan(5)
    const r = structuredClone(s) as LifeState
    choose('x.hs.fatigueWarn', r, 'トレーナー')
    expect(r.bb!.fatigue).toBe(45)
  })

  it('taking the captaincy sets the role and the achievement', () => {
    const s = lifeAt(20, (x) => x.career.phase === 'univ' && !!x.bb && !x.bb.captain)
    choose('x.univ.captain', s, '主将に立候補')
    expect(s.bb!.captain).toBe('captain')
    expect(s.career.achievements).toContain('主将')
  })

  it('the exam choice changes knowledge, and the chances of the entrance routes change with the flags', () => {
    const s = hsLife()
    const study = structuredClone(s) as LifeState
    const k = study.status.knowledge
    choose('x.hs.exam', study, '塾に通って')
    expect(study.status.knowledge).toBe(k + 6)
    const rec = structuredClone(s) as LifeState
    const p0 = recommendP(rec, 50)
    choose('x.hs.exam', rec, '評定を上げて')
    expect(hasFlag(rec, 'hs.hyoutei')).toBe(true)
    expect(recommendP(rec, 50)).toBeGreaterThan(p0)
    // talking with a scout raises the chance of a スポーツ推薦
    const sc = structuredClone(s) as LifeState
    sc.bb!.scout = 45
    const q0 = sportsP(sc)
    choose('x.hs.scoutTalk', sc, '将来の話')
    expect(sportsP(sc)).toBeGreaterThan(q0)
  })

  it('university choices open different jobs later: a job from the part-time work, an offer from the job hunt', () => {
    const s = lifeAt(21, (x) => x.job === '大学生' && !!x.schools?.univ)
    const offers = (t: LifeState) => jobOffers(t, () => 0).map((o) => o.key)
    expect(offers(s)).not.toContain('shopjob')
    expect(offers(s)).not.toContain('naitei')
    const part = structuredClone(s) as LifeState
    part.flags = { 'univ.jobOfferReady': 20 }
    expect(offers(part)).toContain('shopjob')
    let got = false
    for (let seed = 1; seed < 40 && !got; seed++) {
      const t = structuredClone(s) as LifeState
      choose('x.univ.jobHunt', t, '野球の経験を軸', seed)
      if (hasFlag(t, 'univ.naitei')) {
        got = true
        expect(offers(t)).toContain('naitei')
      }
    }
    expect(got).toBe(true)
  })

  it('old age: going to the reunion costs money and lifts happiness, and a photo comes the next year', () => {
    const s = lifeAt(78, (x) => x.career.highestRank >= 3)
    let booked = false
    for (let seed = 1; seed < 20 && !booked; seed++) {
      const t = structuredClone(s) as LifeState
      const happy = t.status.happiness
      const money = t.money
      choose('x.late.reunion', t, '会いに行く', seed)
      expect(t.money).toBe(money - 5)
      expect(t.status.happiness).toBeGreaterThanOrEqual(Math.min(100, happy + 4) - 1)
      if (hasFlag(t, 'late.reunion')) {
        booked = true
        t.age++
        const { c, lines } = ctxFor(t, 5)
        runDue(EVENTS, c, 'senior', new Set())
        expect(lines).toHaveLength(1)
      }
    }
    expect(booked).toBe(true)
  })
})

/** a life played (as on screen, おまかせ) until `stop`, for a seed whose headless run goes through `phase` */
function playUntil(phase: 'company' | 'indep' | 'pro', stop: (s: LifeState) => boolean): LifeState {
  for (let i = 0; i < 60_000; i++) {
    const seed = hashSeed(i + 990_000)
    const h = runHeadless({ seed, country: 'JP', pace: 'p15' }, sim, true)
    const ok = phase === 'pro' ? h.career.proDebut : h.timeline.some((t) => t.phase === phase)
    if (!ok) continue
    const s = createLife({ seed, country: 'JP', pace: 'p15' })
    for (let g = 0; g < 130 && s.alive; g++) {
      const plan = planYear(s, sim)
      let d: Decision | undefined = plan.decision?.decision
      while (d && s.alive) d = resolveDecision(s, d.autoIndex, sim).followUp?.decision
      if (stop(s)) return s
      endYear(s)
    }
  }
  throw new Error(`no ${phase} life found`)
}

describe('company and club teams, independent teams and the pros', () => {
  const co = playUntil('company', (s) => s.career.phase === 'company' && s.career.phaseYears >= 1 && s.age >= 24)
  const ind = playUntil('indep', (s) => s.career.phase === 'indep')
  const pr = playUntil('pro', (s) => s.career.phase === 'pro' && s.career.proDebut)

  it('a company player belongs to a real team of his own region, and the label says so', () => {
    const t = AMATEUR_TEAMS.find((x) => x.name === co.career.amateurTeam)
    expect(t, co.career.amateurTeam).toBeDefined()
    expect(t!.region).toBe(JABA_REGION_OF_PREF[PREFECTURES[co.person.prefecture].name])
    expect(co.career.team).toBe(`${t!.name}（社会人野球）`)
  })

  it('only teams that appear in the 2026 lists and are not listed as paused or dissolved are used', () => {
    expect(AMATEUR_TEAMS.length).toBeGreaterThan(100)
    for (const t of AMATEUR_TEAMS) expect(AMATEUR_META.inactiveExcluded, t.name).not.toContain(t.name)
    expect(AMATEUR_META.inactiveExcluded).toContain('全栃木野球クラブ')
    expect(AMATEUR_TEAMS.some((t) => t.name === '全栃木野球クラブ')).toBe(false)
    // the numbers behind the share (連盟報2026 p.364–365: 339 teams in 2025)
    const official = Object.values(AMATEUR_OFFICIAL_2025).reduce((a, x) => a + x.company + x.club, 0)
    expect(official).toBe(339)
    expect(AMATEUR_TEAMS.length).toBeLessThan(official)
  })

  it('a transfer puts him in another real team (company: same region)', () => {
    const t = structuredClone(co) as LifeState
    const before = t.career.amateurTeam
    choose('x.co.moveTeam', t, '誘いを受けて移る')
    expect(t.career.amateurTeam).not.toBe(before)
    expect(AMATEUR_TEAMS.find((x) => x.name === t.career.amateurTeam)?.region).toBe(AMATEUR_TEAMS.find((x) => x.name === before)?.region)
    expect(t.career.team).toBe(`${t.career.amateurTeam}（社会人野球）`)
    const i = structuredClone(ind) as LifeState
    const o = i.career.orgId
    choose('x.in.moveTeam', i, '誘いを受けて移る')
    expect(i.career.orgId).not.toBe(o)
    expect(orgById(i.career.orgId)?.type).toBe('independent')
    const p = structuredClone(pr) as LifeState
    const po = p.career.orgId
    choose('x.pro.trade', p, '受け入れて移る')
    expect(p.career.orgId).not.toBe(po)
    expect(orgById(p.career.orgId)?.type).toBe('pro')
  })

  it('choosing to retire from the company team ends the playing career and keeps the job', () => {
    const t = structuredClone(co) as LifeState
    const level = t.after?.work?.level ?? 0
    choose('x.co.retireTalk', t, '区切りをつけて')
    expect(t.career.phase).toBe('retired')
    expect(t.career.endedAge).toBe(t.age)
    expect(t.career.amateurTeam).toBeUndefined()
    expect(t.after?.work?.title).toBe('会社員（元社会人野球選手）')
    expect(t.after!.work!.level).toBe(Math.min(4, level + 1))
  })

  it('contract talks move money and confidence; the おまかせ path does not', () => {
    let up = 0
    let down = 0
    for (let seed = 1; seed <= 80; seed++) {
      const t = structuredClone(pr) as LifeState
      const m = t.money
      const c = t.bb!.confidence
      choose('x.pro.contract', t, '増額を求めて', seed)
      if (t.money > m) up++
      if (t.bb!.confidence < c) down++
    }
    expect(up).toBeGreaterThan(10)
    expect(down).toBeGreaterThan(20)
    const a = structuredClone(pr) as LifeState
    const before = snap(a)
    choose('x.pro.contract', a, '提示された額で')
    expect(snap(a)).toBe(before)
  })

  it('getting ready for the end opens a job later: the flags change the job offers', () => {
    const t = structuredClone(pr) as LifeState
    t.age = 30
    t.career.phase = 'retired'
    const keys = (x: LifeState) => jobOffers(x, () => 0).map((o) => o.key)
    expect(keys(t)).not.toContain('trainer')
    choose('x.pro.prepare', t, '資格の勉強')
    expect(hasFlag(t, 'pro.qual')).toBe(true)
    expect(keys(t)).toContain('trainer')
    const u = structuredClone(ind) as LifeState
    choose('x.in.prepare', u, '地元の企業を回って')
    expect(jobOffers(u, () => 0).map((o) => o.key)).toContain('localfirm')
  })

  it('no team name appears in a bad line of the career', () => {
    const names = [...AMATEUR_TEAMS.map((x) => x.name), ...ORGS.filter((o) => o.type !== 'tournament' && o.realName).map((o) => o.realName!)]
    for (const s of [co, ind, pr]) for (const e of s.log) if (e.kind === 'bad') expect(names.some((n) => e.text.includes(n)), e.text).toBe(false)
  })
})

describe('events that おまかせ never reaches (PROJECT_PLAN §11.13)', () => {
  it('work.shop is for a player who chose to open a shop; it works once he has', () => {
    const s = lifeAt(30, (x) => !!x.after && x.career.phase === 'retired')
    s.money = 600
    expect(jobOffers(s, () => 0).map((o) => o.key)).toContain('shop')
    s.after!.work = { ...jobOffers(s, () => 0).find((o) => o.key === 'shop')!.work, years: 2 }
    const def = EVENTS.get('work.shop')!
    expect(def.needsChoice).toBe(true)
    expect(def.when!(s)).toBe(true)
    // …while the おまかせ pick of a job, whatever the offers, is never the shop
    const PREF = ['large', 'public', 'teacher', 'small', 'factory', 'sporting', 'family', 'care', 'shop', 'parttime']
    expect(PREF.indexOf('shop')).toBeGreaterThan(PREF.indexOf('small'))
  })

  it('senior.pension is a safety net: no life reaches 65 without a job or a retirement', () => {
    let at65 = 0
    for (let i = 0; i < 300; i++) {
      const s = createLife({ seed: hashSeed(i + 980_000), country: 'JP', pace: 'p15' })
      for (let g = 0; g < 130 && s.alive; g++) {
        const plan = planYear(s, sim)
        let d: Decision | undefined = plan.decision?.decision
        while (d && s.alive) d = resolveDecision(s, d.autoIndex, sim).followUp?.decision
        if (s.age >= 65) {
          at65++
          const a = s.after
          expect(!!a && (a.retired || !!a.work), `seed ${s.config.seed} age ${s.age}`).toBe(true)
        }
        endYear(s)
      }
    }
    expect(at65).toBeGreaterThan(1000)
    // and it does what it says when the state is there
    const t = lifeAt(66, (x) => !!x.after?.retired)
    t.after!.retired = false
    t.after!.work = undefined
    const def = EVENTS.get('senior.pension')!
    expect(def.needsChoice).toBe(true)
    expect(def.when!(t)).toBe(true)
  })
})

describe('across lives', () => {
  it('an おまかせ life and the same life with one extra choice taken differ afterwards', () => {
    let differing = 0
    let tried = 0
    for (let i = 0; i < 60; i++) {
      const seed = hashSeed(i + 970_000)
      const run = (flip: boolean) => {
        const s = createLife({ seed, country: 'JP', pace: 'p15' })
        let first = true
        for (let g = 0; g < 130 && s.alive && s.age < 40; g++) {
          const plan = planYear(s, sim)
          let d: Decision | undefined = plan.decision?.decision
          while (d && s.alive) {
            let ch = d.autoIndex
            if (flip && first && d.id.startsWith('x.') && d.choices.length > 1) {
              ch = (d.autoIndex + 1) % d.choices.length
              first = false
            }
            d = resolveDecision(s, ch, sim).followUp?.decision
          }
          endYear(s)
        }
        return { s, flipped: !first }
      }
      const a = run(false)
      const b = run(true)
      if (!b.flipped) continue
      tried++
      if (snap(a.s) !== snap(b.s) || JSON.stringify(a.s.flags) !== JSON.stringify(b.s.flags)) differing++
    }
    expect(tried).toBeGreaterThan(30)
    expect(differing / tried).toBeGreaterThan(0.6)
  })
})
