import { describe, expect, it } from 'vitest'
import { EventRegistry, runDue, runExtraEvents, runYearEvents, type EventCtx } from './events.ts'
import { compileSpec, flagAge, hasFlag, similarity, validateSpecs, type EventSpec } from './events/spec.ts'
import { SPECS } from './events/index.ts'
import { EVENTS, createLife, runHeadless, type Sim } from './life.ts'
import { ensureAfter } from './after.ts'
import { makeRng } from './rng.ts'
import { defaultParams } from './params.ts'
import { hashSeed } from './rng.ts'
import { diversityReport, eventReach, phaseGaps, playRecorded, reachProblems, type Recorded } from './diversity.ts'
import type { Decision, LifeState } from './types.ts'

// E0 (PROJECT_PLAN §11.10): declarative events, follow-ups, the checks against padding, and the
// measures of reach and diversity.

function adult(age = 30): LifeState {
  const s = createLife({ seed: 42, country: 'JP', pace: 'p15' })
  s.age = age
  s.career.phase = 'retired'
  s.career.highestRank = 4
  ensureAfter(s)
  return s
}

function ctxFor(s: LifeState, seed = 1) {
  const lines: { kind: string; text: string; eventId?: string }[] = []
  let asked: { d: Decision; data: Record<string, number | boolean | string> } | undefined
  const c: EventCtx = {
    s,
    rng: makeRng(seed),
    headless: true,
    add: (kind, text, o) => lines.push({ kind, text, eventId: o?.eventId }),
    ask: (d, data = {}) => {
      if (!asked) asked = { d, data }
    },
    canAsk: () => !asked,
  }
  return { c, lines, asked: () => asked }
}

const happening: EventSpec = {
  id: 't.happen',
  category: 't1',
  stages: ['adult'],
  weight: 1000,
  outcomes: [{ text: '近所の祭りで、焼きそばの屋台を手伝いました。', effects: { rel: 5, flag: 't.helped' }, follow: [{ id: 't.thanks', after: 2 }] }],
}
const thanks: EventSpec = {
  id: 't.thanks',
  category: 't2',
  stages: ['adult'],
  followOnly: true,
  when: (s) => hasFlag(s, 't.helped'),
  outcomes: [{ text: '祭りの実行委員から、来年は世話役をと頼まれました。', effects: { happy: 4 } }],
}
const choice: EventSpec = {
  id: 't.choice',
  category: 't3',
  stages: ['adult'],
  title: '週末の使い方',
  body: '休みの日をどう過ごしますか。',
  auto: 2,
  choices: [
    { label: '家で休む', effects: { health: 2 }, outcomes: [{ text: '一日、家でゆっくり過ごしました。' }] },
    { label: '旅に出る', when: (s) => s.money > 1e9, effects: { money: -10 }, outcomes: [{ text: '思い切って遠くの町へ出かけました。' }] },
    {
      label: '草野球に行く',
      effects: { rel: 2 },
      outcomes: [
        { text: '久しぶりの試合で、二塁打を打ちました。', effects: { happy: 5 }, weight: 1 },
        { text: '守備で転んで、膝をすりむきました。', effects: { happy: -2 }, weight: 0 },
        { text: '雨で中止になり、皆で食事をしました。', effects: { rel: 3 }, when: () => false },
      ],
    },
  ],
}

describe('declarative events compile to ordinary events', () => {
  const reg = new EventRegistry()
  reg.register([happening, thanks, choice].map(compileSpec))

  it('keeps the scheduler settings, and a follow-up is never drawn on its own', () => {
    const d = reg.get('t.happen')!
    expect(d.stages).toEqual(['adult'])
    expect(reg.get('t.thanks')!.followOnly).toBe(true)
    expect(reg.eligible(adult(), 'adult', true).map((x) => x.id)).not.toContain('t.thanks')
  })

  it('a happening applies its effects and flags, and books its follow-up', () => {
    const s = adult()
    const before = s.status.relations
    const { c, lines } = ctxFor(s)
    reg.get('t.happen')!.run(c)
    expect(s.status.relations).toBe(before + 5)
    expect(hasFlag(s, 't.helped')).toBe(true)
    expect(flagAge(s, 't.helped')).toBe(0)
    expect(s.due).toEqual([{ id: 't.thanks', age: 32, until: 34, from: 't.happen' }])
    expect(lines[0].text).toContain('屋台')
  })

  it('a decision offers only the choices whose conditions hold, and おまかせ points at the intended one', () => {
    const s = adult()
    const { c, asked } = ctxFor(s)
    reg.get('t.choice')!.run(c)
    const a = asked()!
    expect(a.d.choices.map((x) => x.label)).toEqual(['家で休む', '草野球に行く'])
    expect(a.d.autoIndex).toBe(1)
  })

  it('the chosen option applies its own effects and one of its outcomes (never a weight-0 or ruled-out one)', () => {
    for (let k = 0; k < 50; k++) {
      const s = adult()
      const rel = s.status.relations
      const happy = s.status.happiness
      const { c, lines, asked } = ctxFor(s, k + 1)
      const d = reg.get('t.choice')!
      d.run(c)
      d.resolve!(c, 1, asked()!.data)
      expect(s.status.relations).toBe(rel + 2)
      expect(s.status.happiness).toBe(happy + 5)
      expect(lines.at(-1)!.text).toContain('二塁打')
    }
  })
})

describe('follow-ups', () => {
  const reg = new EventRegistry()
  reg.register([happening, thanks].map(compileSpec))
  // (booked follow-ups run in the extra pass; the draw itself is not under test here)
  const year = (s: LifeState) => {
    const { c, lines } = ctxFor(s, s.age)
    runDue(reg, c, 'adult', new Set())
    return lines
  }

  it('run in the year they are due, not before, and survive saving', () => {
    let s = adult()
    reg.get('t.happen')!.run(ctxFor(s).c)
    expect(s.due).toHaveLength(1)
    s.age++
    expect(year(s).some((l) => l.eventId === 't.thanks')).toBe(false)
    s = JSON.parse(JSON.stringify(s)) as LifeState
    s.age++
    expect(year(s).some((l) => l.eventId === 't.thanks')).toBe(true)
    expect(s.due).toBeUndefined()
  })

  it('wait while their conditions fail, and are dropped after their window', () => {
    // only the follow-up is registered, so nothing else books one in the meantime
    const only = new EventRegistry()
    only.register([compileSpec(thanks)])
    const run = (s: LifeState) => runDue(only, ctxFor(s, s.age).c, 'adult', new Set())
    const s = adult()
    s.due = [{ id: 't.thanks', age: 30, until: 31, from: 'test' }]
    run(s)
    expect(s.due).toHaveLength(1)
    s.age = 32
    run(s)
    expect(s.due).toBeUndefined()
    expect(s.evHist?.['t.thanks']).toBeUndefined()
  })

  it('a life without bookings is left as it was', () => {
    const s = adult()
    const reg2 = new EventRegistry()
    reg2.register([compileSpec({ ...choice, id: 't.quiet', choices: choice.choices!.slice(0, 1).concat({ label: '本を読む', outcomes: [{ text: '図書館で一日を過ごしました。', effects: { know: 2 } }] }) })])
    const { c } = ctxFor(s)
    runDue(reg2, c, 'adult', new Set())
    runExtraEvents(reg2, c)
    runYearEvents(reg2, c)
    expect(s.due).toBeUndefined()
  })
})

describe('checks against padding', () => {
  const known = new Set(EVENTS.all().map((d) => d.id))

  it('accepts well-formed specs', () => {
    expect(validateSpecs([happening, thanks, choice], known)).toEqual([])
  })

  it('rejects choices with the same effects, outcomes that differ only in wording, and repeated texts', () => {
    const same: EventSpec = { ...choice, id: 't.same', choices: [{ label: 'A', outcomes: [{ text: '朝の公園を一周走りました。' }] }, { label: 'B', outcomes: [{ text: '夜の川沿いをゆっくり歩きました。' }] }] }
    expect(validateSpecs([same], known).join('\n')).toMatch(/same effects/)
    const wording: EventSpec = { ...happening, id: 't.wording', follow: undefined, outcomes: [{ text: '雨の日に、傘を貸しました。' }, { text: '晴れた日に、自転車を貸しました。' }] } as EventSpec
    expect(validateSpecs([wording], known).join('\n')).toMatch(/only in wording/)
    const near: EventSpec = { ...happening, id: 't.near', outcomes: [{ text: '近所の祭りで、焼きそばの屋台を手伝いました！', effects: { happy: 1 } }] }
    expect(validateSpecs([happening, thanks, near], known).join('\n')).toMatch(/near-repeated/)
  })

  it('rejects follow-ups that lead nowhere or are drawn on their own, and unbooked follow-only events', () => {
    const bad: EventSpec = { ...happening, id: 't.bad', outcomes: [{ text: '町内会の名簿を新しく作りました。', follow: [{ id: 'no.such', after: 1 }] }] }
    expect(validateSpecs([bad], known).join('\n')).toMatch(/does not exist/)
    const notFollow: EventSpec = { ...happening, id: 't.nf', outcomes: [{ text: '回覧板を隣の家に届けました。', follow: [{ id: 't.choice', after: 1 }] }] }
    expect(validateSpecs([notFollow, choice], known).join('\n')).toMatch(/not followOnly/)
    expect(validateSpecs([thanks], known).join('\n')).toMatch(/nothing books it/)
  })

  it('keeps the calibrated career safe: ability, injury and health effects in playing stages need career: true', () => {
    const prac: EventSpec = { id: 't.prac', category: 'practice', stages: ['univ'], outcomes: [{ text: '朝練で、坂道ダッシュを20本走りました。', effects: { gain: 0.02 } }] }
    expect(validateSpecs([prac], known).join('\n')).toMatch(/needs career: true/)
    expect(validateSpecs([{ ...prac, career: true }], known)).toEqual([])
  })

  it('the registered specs pass', () => {
    expect(validateSpecs(SPECS, known)).toEqual([])
  }, 60_000)

  it('similarity is 1 for the same text and low for different ones', () => {
    expect(similarity('監督に呼ばれました。', '監督に呼ばれました。')).toBe(1)
    expect(similarity('監督に呼ばれました。', '雨で試合が流れました。')).toBeLessThan(0.3)
  })
})

describe('reach, gaps and diversity (measured; PROJECT_PLAN §11.10)', () => {
  const sim: Sim = { params: defaultParams() }
  // random lives, plus lives that go past high school (the stages where few random lives arrive)
  const recs: Recorded[] = []
  for (let i = 0; i < 300; i++) recs.push(playRecorded(hashSeed(i + 8_800_000), sim, { eligibility: true }))
  let past = 0
  for (let i = 0; i < 20_000 && past < 40; i++) {
    const seed = hashSeed(i + 8_900_000)
    if (runHeadless({ seed, country: 'JP', pace: 'p15' }, sim, true).career.highestRank < 5) continue
    past++
    recs.push(playRecorded(seed, sim, { eligibility: true }))
  }
  // lives of the rarer playing careers, so that company, independent and pro events are judged on enough lives
  const want = { pro: 35, company: 35, indep: 35 }
  const got = { pro: 0, company: 0, indep: 0 }
  for (let i = 0; i < 40_000 && Object.entries(want).some(([k, n]) => got[k as keyof typeof got] < n); i++) {
    const seed = hashSeed(i + 9_700_000)
    const h = runHeadless({ seed, country: 'JP', pace: 'p15' }, sim, true)
    const ph = new Set(h.timeline.map((t) => t.phase))
    const kinds = [h.career.highestRank >= 6 && 'pro', ph.has('company') && 'company', ph.has('indep') && 'indep'].filter(Boolean) as (keyof typeof got)[]
    if (!kinds.some((k) => got[k] < want[k])) continue
    for (const k of kinds) got[k]++
    recs.push(playRecorded(seed, sim, { eligibility: true }))
  }
  const reach = eventReach(recs)
  const problems = reachProblems(reach, recs.length)

  it('no event goes over its per-life limit', () => {
    expect(problems.overLimit).toEqual([])
  })

  it('declarative events are possible in some lives, and drawn in a fair share of the lives where they are', () => {
    const ids = new Set(SPECS.filter((s) => !s.followOnly).map((s) => s.id))
    expect(problems.neverEligible.filter((id) => ids.has(id))).toEqual([])
    expect(problems.rare.filter((x) => ids.has(x.split(' ')[0]))).toEqual([])
    // the conditions are met in some lives at all, and where they are the event is drawn in a good share of them
    // (measured 2026-10-18: 13–100% of the lives where it could happen; a place on the bench is held for a few
    // months of a year only, so the fight for it is met by about one in seven of the lives that have one.
    // After the 40 events of PROJECT_PLAN §11.14 joined the same draws: 8–100%, the rarest being events tied
    // to a state that holds for a part of a year (a slump, a bench place); the floor is 5%, and 2% is the
    // line below which reachProblems calls an event rare)
    // (PROJECT_PLAN §11.16: with some 150 events drawn from the same few slots a year, a single life meets only a few
    // of the events it could: the measure is the spread over all of them. No event under 2% of the lives where it could
    // happen, and half of them in at least one life in ten.)
    const judged = reach.filter((x) => ids.has(x.id) && !EVENTS.get(x.id)?.needsChoice)
    const shares: number[] = []
    for (const r of judged) {
      expect(r.livesEligible, `${r.id}: its conditions are met in too few lives`).toBeGreaterThanOrEqual(3)
      if (r.livesEligible >= 15) {
        expect(r.livesReached / r.livesEligible, `${r.id}: drawn too rarely`).toBeGreaterThan(0.02)
        shares.push(r.livesReached / r.livesEligible)
      }
    }
    shares.sort((x, y) => x - y)
    expect(shares.length).toBeGreaterThan(80)
    expect(shares[Math.floor(shares.length / 2)], 'the median event').toBeGreaterThan(0.1)
  })

  it('the events that need an earlier choice are reachable: the choice makes them eligible', () => {
    const def = EVENTS.get('x.pro.rehab')!
    expect(def.needsChoice).toBe(true)
    const s = createLife({ seed: 5, country: 'JP', pace: 'p15' })
    s.career.phase = 'pro'
    s.bb = { ...(s.bb ?? ({} as never)), skills: {} as never, confidence: 50, coachEval: 50, fatigue: 20, condition: 0, role: 'bench', teamSize: 70, teamStrength: 2, menu: 'balanced', gain: 0, build: 1, muscleKg: 0 } as never
    s.career.injured = 0
    expect(def.when!(s)).toBe(false)
    s.career.injured = 1
    expect(def.when!(s)).toBe(true)
  })

  it('no phase of a playing career goes quiet, and life after baseball keeps its target', () => {
    const gaps: Record<string, number[]> = {}
    for (const r of recs) for (const [ph, g] of Object.entries(phaseGaps(r))) (gaps[ph] ??= []).push(g)
    const p95 = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(0.95 * (v.length - 1))]
    // measured 2026-10-18 over 3,000 lives: p95 0–2 years in every playing phase, 5 after baseball
    for (const ph of ['youth', 'jhs', 'hs', 'univ', 'company', 'indep', 'pro']) if (gaps[ph]) expect(p95(gaps[ph]), ph).toBeLessThanOrEqual(2)
    expect(p95(gaps.retired)).toBeLessThanOrEqual(5)
  })

  it('a different choice changes what follows', () => {
    const flips = recs.slice(0, 120).map((base) => ({ base, flipped: playRecorded(base.s.config.seed, sim, { flip: (base.s.config.seed >>> 0) % 8 }) }))
    const rep = diversityReport(recs, flips)
    // measured 2026-10-18 over 300 lives: 18% of the next ten years' events differ
    expect(rep.flips!.eventDistance10y).toBeGreaterThan(0.08)
    expect(rep.trajectories.distinctPaths).toBeGreaterThan(20)
  })
})
