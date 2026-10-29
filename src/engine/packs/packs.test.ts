import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { EVENTS, createLife, endYear, planYear, resolveDecision, runHeadless, type Sim } from '../life.ts'
import { defaultParams } from '../params.ts'
import { hashSeed, makeRng, type Rng } from '../rng.ts'
import type { LifeState } from '../types.ts'
import type { CountryCode } from '../../data/types.ts'
import { EventRegistry, eligibleExtra, runDue, runExtraEvents, runLifePass, runResidentPass, runYearEvents, stageOf, type EventCtx, type EventDef } from '../events.ts'
import { SPECS } from '../events/index.ts'
import { US_SPECS } from '../countries/us/events.ts'
import { US_DAILY_SPECS } from '../countries/us/daily.ts'
import { LEAGUE_SPECS } from '../countries/league/events.ts'
import { SPENDING_SPECS } from '../events/spending.ts'
import { PUBLIC_SPECS } from '../events/publicLife.ts'
import { DEFAULT_STAGES, compilePack, definePack, type Pack, type PackInput, type PackKit } from './kit.ts'
import { PACKS, PACK_COUNTRIES, PACK_ENTRIES, PACK_EVENTS, runPackPass, setPacksForTests } from './index.ts'
import { PACK_PER_YEAR, packFits, packRoll, runPacks } from './pass.ts'
import { setResidence } from '../countries/index.ts'
import { catalogTexts, validatePacks } from './validate.ts'

// The event packs (packs/kit.ts): the checks of a pack, its separation from the existing draws, the rules of its own pass, and a whole
// life with packs in play against the same life without them. The packs used here are this file's own (a test pack, never in the game).

/** the existing catalog, before this file registers its test pack */
const BASE: EventDef[] = EVENTS.all().filter((d) => d.pack === undefined)
const KNOWN = new Set(BASE.map((d) => d.id))
const EXISTING = catalogTexts([...SPECS, ...US_SPECS, ...US_DAILY_SPECS, ...LEAGUE_SPECS, ...SPENDING_SPECS, ...PUBLIC_SPECS])
const COUNTRIES = Object.keys(PACK_COUNTRIES) as CountryCode[]
const ALL_ON = Object.fromEntries(COUNTRIES.map((c) => [c, true])) as Record<CountryCode, boolean>
const ALL_OFF = Object.fromEntries(COUNTRIES.map((c) => [c, false])) as Record<CountryCode, boolean>
const isPk = (id: string | undefined) => !!id && id.startsWith('pk.')
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T

/** a test pack: lines, endings, a question and a continuation, flags only (impact 'log') */
const TEST_PACK: Pack = definePack({
  id: 'fixture',
  countries: ['JP', 'US', 'KR', 'CU'],
  impact: 'log',
  events: (k) => [
    k.log({ id: 'line', text: ['〔試験〕青い封筒が一通、机の上に置かれていました。', '〔試験〕窓の外を、赤い風船がひとつ流れていきました。'], weight: 3, cooldown: 1, maxPerLife: 6, flag: 'seen' }),
    k.happen({
      id: 'ends',
      category: 'ends',
      cooldown: 2,
      maxPerLife: 3,
      outcomes: [
        { text: '〔試験〕古い時計が、急に動き出しました。', flag: 'clock' },
        { text: '〔試験〕棚の上の鉢植えに、白い花が咲きました。', flag: 'flower' },
      ],
    }),
    k.choice({
      id: 'ask',
      category: 'ask',
      stages: DEFAULT_STAGES.filter((st) => st !== 'hs'),
      cooldown: 1,
      maxPerLife: 4,
      title: '〔試験〕質問',
      body: '〔試験〕仕組みを確かめるための質問です。',
      auto: 0,
      choices: [
        { label: '何もしない', outcomes: [{ text: '〔試験〕何もせず、そのまま一日を終えました。' }] },
        { label: '印をつける', flag: 'marked', outcomes: [{ text: '〔試験〕手帳の隅に、小さな星の印を描きました。' }] },
      ],
    }),
    k.later({ flag: 'seen', years: [2, 6] }, k.log({ id: 'echo', category: 'echo', cooldown: 1, maxPerLife: 2, text: '〔試験〕数年前の青い封筒のことを、ふと思い出しました。' })),
  ],
})

/** a pack of one event, for the checks */
const one = (o: Partial<PackInput> & Pick<PackInput, 'events'>): Pack => definePack({ id: 'probe', countries: ['US'], impact: 'log', ...o })
const errs = (p: Pack, known: ReadonlySet<string> = KNOWN) => validatePacks([p], known, EXISTING)
const hasErr = (xs: string[], part: string) => xs.some((x) => x.includes(part))

/** an Rng that counts its draws */
function counting(r: Rng): { rng: Rng; calls: () => number } {
  let n = 0
  const rng: Rng = {
    seed: r.seed,
    next: () => {
      n++
      return r.next()
    },
    normal: () => {
      n++
      return r.normal()
    },
    int: (lo: number, hi: number) => {
      n++
      return r.int(lo, hi)
    },
    chance: (p: number) => {
      n++
      return r.chance(p)
    },
    pick: <T>(items: readonly T[]): T => {
      n++
      return r.pick(items)
    },
    weighted: <T>(items: readonly T[], weights: readonly number[]): T => {
      n++
      return r.weighted(items, weights)
    },
    fork: (salt: number) => {
      n++
      return r.fork(salt)
    },
  }
  return { rng, calls: () => n }
}

function fakeCtx(s: LifeState, rng: Rng, canAsk = true, headless = true) {
  const lines: unknown[] = []
  const asks: unknown[] = []
  const c: EventCtx = {
    s,
    rng,
    headless,
    add: (kind, text, o) => lines.push([kind, text, o?.eventId ?? '', o?.category ?? '', o?.key ?? false]),
    ask: (d, data) => asks.push([d.id, d.title, d.body, d.choices.map((x) => x.label), d.autoIndex, data]),
    canAsk: () => canAsk,
  }
  return { c, lines, asks }
}

/** states of lives of a country, every few years (headless, おまかせ) */
function snapshots(cc: CountryCode, seeds: number[], every = 4): LifeState[] {
  const out: LifeState[] = []
  const sim: Sim = { params: defaultParams(), headless: true }
  for (const seed of seeds) {
    const s = createLife({ seed, country: cc, pace: 'p15' })
    for (let g = 0; g < 130 && s.alive; g++) {
      if (g % every === 1) out.push(clone(s))
      const plan = planYear(s, sim)
      let d = plan.decision?.decision
      while (d && s.alive) d = resolveDecision(s, d.autoIndex, sim).followUp?.decision
      endYear(s)
    }
  }
  return out
}

/** an adult of a country who left baseball (for the rules of the pass) */
function adult(cc: CountryCode, age = 30): LifeState {
  const s = createLife({ seed: 4242, country: cc, pace: 'p15' })
  s.age = age
  s.career.phase = 'retired'
  return s
}

describe('the list of packs', () => {
  it('passes the checks, and every event of it is registered in the catalog with its pack', () => {
    expect(validatePacks(PACKS, KNOWN, EXISTING)).toEqual([])
    expect(PACK_EVENTS.length).toBe(PACK_ENTRIES.length)
    for (const d of PACK_EVENTS) {
      expect(d.pack, d.id).toBeDefined()
      expect(EVENTS.get(d.id), d.id).toBe(d)
    }
  })

  it('names every country, and the pass has a rate for every stage', () => {
    expect(Object.keys(PACK_COUNTRIES).sort()).toEqual(['CU', 'DO', 'JP', 'KR', 'MX', 'TW', 'US', 'VE'])
    for (const st of ['child', 'youth', 'jhs', 'hs', 'univ', 'amateur', 'pro', 'student', 'adult', 'senior'] as const) {
      const [p1, p2] = PACK_PER_YEAR[st]
      expect(p1).toBeGreaterThanOrEqual(0)
      expect(p1).toBeLessThanOrEqual(1)
      expect(p2).toBeLessThanOrEqual(p1)
    }
  })
})

describe('the kit', () => {
  it('puts ids, flags and categories under the pack, and the test pack passes the checks', () => {
    expect(validatePacks([TEST_PACK], KNOWN, EXISTING)).toEqual([])
    const ids = TEST_PACK.events.map((e) => e.spec.id)
    expect(ids).toEqual(['pk.fixture.line', 'pk.fixture.ends', 'pk.fixture.ask', 'pk.fixture.echo'])
    expect(TEST_PACK.events.map((e) => e.spec.category)).toEqual(['pk.fixture', 'pk.fixture.ends', 'pk.fixture.ask', 'pk.fixture.echo'])
    expect(TEST_PACK.events[0].spec.outcomes![0].effects!.flag).toEqual(['pk.fixture.seen'])
    expect(TEST_PACK.events[2].spec.choices![1].flag).toEqual(['pk.fixture.marked'])
    expect(TEST_PACK.events[3].after).toEqual({ flag: 'pk.fixture.seen', years: [2, 6] })
    for (const e of compilePack(TEST_PACK)) expect(e.def.pack).toBe('fixture')
  })

  it('a continuation comes only within its window of years', () => {
    const echo = compilePack(TEST_PACK)[3].def
    const s = adult('US', 40)
    expect(echo.when!(s)).toBe(false)
    s.flags = { 'pk.fixture.seen': 39 }
    expect(echo.when!(s)).toBe(false)
    for (const set of [38, 36, 34]) {
      s.flags = { 'pk.fixture.seen': set }
      expect(echo.when!(s), `set at ${set}`).toBe(true)
    }
    s.flags = { 'pk.fixture.seen': 33 }
    expect(echo.when!(s)).toBe(false)
  })
})

describe('the checks of a pack find', () => {
  const line = (text = '〔検査〕灰色の猫が、塀の上で大きなあくびをしました。') => (k: PackKit) => [k.log({ id: 'a', stages: ['adult'], text })]

  it('a bad id, an unknown country, a duplicate id', () => {
    expect(hasErr(errs(one({ id: 'Bad-Id', events: line() })), "a pack's id")).toBe(true)
    expect(hasErr(errs(one({ countries: ['ZZ' as CountryCode], events: line() })), 'unknown country')).toBe(true)
    expect(hasErr(errs(one({ events: line() }), new Set([...KNOWN, 'pk.probe.a'])), 'duplicate id')).toBe(true)
  })

  it('an effect beyond the pack, and career or health without an approval', () => {
    const money = one({ events: (k) => [k.log({ id: 'a', stages: ['adult'], text: '〔検査〕道で百円玉を拾い、交番に届けました。', effects: { money: 10 } })] })
    expect(hasErr(errs(money), "'money' (life) is beyond the pack's impact 'log'")).toBe(true)
    expect(hasErr(errs(one({ impact: 'career', events: line() })), 'needs an approval')).toBe(true)
    expect(hasErr(errs(one({ impact: 'health', approved: '2026-10-21 test', events: line() })), 'needs an approval')).toBe(false)
  })

  it('a change on the おまかせ path while he plays, unless declared and approved', () => {
    const q = (autoEffects: boolean) => (k: PackKit) => [
      k.choice({ id: 'q', stages: ['pro'], title: '〔検査〕質問', body: '〔検査〕確かめるための質問です。', auto: 0, autoEffects, choices: [
        { label: '喜ぶ', effects: { happy: 2 }, outcomes: [{ text: '〔検査〕思わず小さく飛び跳ねました。' }] },
        { label: '何もしない', outcomes: [{ text: '〔検査〕いつもどおりに過ごしました。' }] },
      ] }),
    ]
    expect(hasErr(errs(one({ impact: 'life', events: q(false) })), 'おまかせ path changes happy')).toBe(true)
    expect(hasErr(errs(one({ impact: 'life', events: q(true) })), 'おまかせ path')).toBe(true)
    expect(hasErr(errs(one({ impact: 'life', approved: '2026-10-21 test', events: q(true) })), 'おまかせ path')).toBe(false)
  })

  it('a continuation from a flag no event sets, a flag of another pack, a booked follow-up, a field of the catalog', () => {
    expect(hasErr(errs(one({ events: (k) => [...line()(k), k.later({ flag: 'nowhere', years: [1, 3] }, k.log({ id: 'b', category: 'b', text: '〔検査〕遠い町から、差出人のない葉書が届きました。' }))] })), 'which no event of the pack sets')).toBe(true)
    const foreign = one({ events: line() })
    foreign.events[0].spec.outcomes![0].effects = { flag: ['x.other'] }
    expect(hasErr(errs(foreign), "the flag x.other is not the pack's")).toBe(true)
    const booked = one({ events: line() })
    booked.events[0].spec.outcomes![0].follow = [{ id: 'x.somewhere', after: 1 }]
    expect(hasErr(errs(booked), 'not by follow-ups')).toBe(true)
    const extra = one({ events: line() })
    extra.events[0].spec.extra = true
    expect(hasErr(errs(extra), "'extra' is not for a pack's event")).toBe(true)
  })

  it('a question of high school whose choices move nothing, a line too long, a near-repeat of the catalog', () => {
    const hs = one({ events: (k) => [
      k.choice({ id: 'q', stages: ['hs'], title: '〔検査〕質問', body: '〔検査〕高校での質問です。', auto: 0, choices: [
        { label: 'しない', outcomes: [{ text: '〔検査〕何もしないまま放課後になりました。' }] },
        { label: '印だけ', flag: 'm', outcomes: [{ text: '〔検査〕ノートの端に印をつけました。' }] },
      ] }),
    ] })
    expect(hasErr(errs(hs), 'question of high school')).toBe(true)
    expect(hasErr(errs(one({ events: line('〔検査〕' + 'あ'.repeat(130)) })), 'a line is longer than 120')).toBe(true)
    expect(hasErr(errs(one({ events: line(EXISTING[0]) })), 'near-repeat of an existing text')).toBe(true)
  })
})

describe('the existing draws never meet a pack', () => {
  const fixtureDefs = compilePack(TEST_PACK).map((e) => e.def)
  const R0 = new EventRegistry()
  R0.register([...BASE])
  const R1 = new EventRegistry()
  R1.register([...BASE, ...fixtureDefs])
  const states = (['JP', 'US', 'KR', 'CU'] as const).flatMap((cc, i) => snapshots(cc, [hashSeed(8_100 + i), hashSeed(8_200 + i), hashSeed(8_300 + i)]))

  it('no pool of events.ts holds a pack event', () => {
    expect(states.length).toBeGreaterThan(150)
    expect(R1.residentDefs().some((d) => d.pack)).toBe(false)
    expect(R1.lifeDefs().some((d) => d.pack)).toBe(false)
    for (const s of states) {
      const st = stageOf(s)
      expect(R1.eligible(s, st, true).some((d) => d.pack)).toBe(false)
      expect(R1.eligible(s, st, false).some((d) => d.pack)).toBe(false)
      expect(eligibleExtra(R1, s, st).some((d) => d.pack)).toBe(false)
    }
  })

  it('the four passes draw, write and ask the same with a pack registered or not', () => {
    const passes = [runYearEvents, runExtraEvents, runLifePass, runResidentPass]
    states.forEach((s, i) => {
      for (const [k, pass] of passes.entries()) {
        for (const canAsk of [true, false]) {
          const a = clone(s)
          const b = clone(s)
          const fa = fakeCtx(a, makeRng(hashSeed(i * 31 + k)), canAsk, i % 2 === 0)
          const fb = fakeCtx(b, makeRng(hashSeed(i * 31 + k)), canAsk, i % 2 === 0)
          const ra = pass(R0, fa.c)
          const rb = pass(R1, fb.c)
          expect(JSON.stringify([rb, fb.lines, fb.asks, b]), `${pass.name} state ${i}`).toBe(JSON.stringify([ra, fa.lines, fa.asks, a]))
        }
      }
    })
  })

  it('a pack event booked as a follow-up is never run by the catalog', () => {
    const s = clone(states[40])
    s.due = [{ id: 'pk.fixture.line', age: s.age, until: s.age + 1, from: 'test' }]
    const f = fakeCtx(s, makeRng(1))
    expect(runDue(R1, f.c, stageOf(s), new Set())).toEqual([])
    expect(s.evHist?.['pk.fixture.line']).toBeUndefined()
    expect(f.lines).toEqual([])
  })
})

describe('the packs\' pass', () => {
  const entries = compilePack(TEST_PACK)

  it('with no pack, it draws, writes and asks nothing, and the state is untouched', () => {
    setPacksForTests({ entries: [], countries: ALL_ON })
    for (const cc of ['JP', 'US', 'KR', 'CU'] as const) {
      for (const age of [10, 16, 20, 30, 70]) {
        const s = adult(cc, age)
        const before = JSON.stringify(s)
        const r = counting(makeRng(age))
        const f = fakeCtx(s, r.rng)
        expect(runPackPass(f.c)).toEqual([])
        expect(runPacks([], ALL_ON, f.c)).toEqual([])
        expect(r.calls()).toBe(0)
        expect(f.lines).toEqual([])
        expect(f.asks).toEqual([])
        expect(JSON.stringify(s)).toBe(before)
      }
    }
    setPacksForTests()
  })

  it('with the country switched off, or a country the pack does not name, it draws nothing', () => {
    for (const [cc, enabled] of [['US', ALL_OFF], ['DO', ALL_ON]] as const) {
      const s = adult(cc as CountryCode)
      const before = JSON.stringify(s)
      const r = counting(makeRng(3))
      const f = fakeCtx(s, r.rng)
      expect(runPacks(entries, enabled, f.c)).toEqual([])
      expect(r.calls()).toBe(0)
      expect(JSON.stringify(s)).toBe(before)
    }
  })

  it('over a life: only the pack\'s events, within their limits and windows, one question a year, none without room', () => {
    for (const cc of ['US', 'KR', 'CU', 'JP'] as const) {
      for (const seed of [1, 2, 3]) {
        const s = adult(cc, 18)
        const seen = new Map<string, number[]>()
        for (let age = 18; age <= 80; age++) {
          s.age = age
          const canAsk = age % 5 !== 0
          const f = fakeCtx(s, makeRng(hashSeed(seed * 1000 + age)), canAsk)
          const ran = runPacks(entries, ALL_ON, f.c)
          expect(ran.every((id) => id.startsWith('pk.fixture.'))).toBe(true)
          expect(f.asks.length).toBeLessThanOrEqual(1)
          if (!canAsk) expect(f.asks.length).toBe(0)
          // one event of a category a year
          expect(new Set(ran.map((id) => entries.find((e) => e.def.id === id)!.def.category)).size).toBe(ran.length)
          for (const id of ran) seen.set(id, [...(seen.get(id) ?? []), age])
          // (the question is answered as おまかせ would: no flag)
        }
        for (const [id, ages] of seen) {
          const d = entries.find((e) => e.def.id === id)!.def
          expect(ages.length, `${id} in ${cc}`).toBeLessThanOrEqual(d.maxPerLife ?? 1)
          for (let i = 1; i < ages.length; i++) expect(ages[i] - ages[i - 1], id).toBeGreaterThanOrEqual(d.cooldown ?? 3)
        }
        for (const age of seen.get('pk.fixture.echo') ?? []) {
          const set = (seen.get('pk.fixture.line') ?? []).filter((a) => a < age)
          expect(set.some((a) => age - a >= 2 && age - a <= 6), `echo at ${age}`).toBe(true)
        }
        expect(seen.size).toBeGreaterThan(1)
      }
    }
  })
})

describe('with a pack in play, everything else of a life is as it was', () => {
  const entries = compilePack(TEST_PACK)
  beforeAll(() => EVENTS.register(entries.map((e) => e.def)))
  afterEach(() => setPacksForTests())

  /**
   * the life without its pack traces (flags, history, the questions taken, lines). The state's own keys are put in order: a pack that
   * sets the first flag of a life creates `flags` earlier than the life without it would, which moves that key among the others (the
   * order of an object's keys, nothing the game reads); the keys inside each field keep their order and are compared as they are.
   */
  function strip(s: LifeState): unknown {
    const x = stripped(s)
    return Object.fromEntries(Object.keys(x).sort().map((k) => [k, (x as unknown as Record<string, unknown>)[k]]))
  }
  function stripped(s: LifeState): LifeState {
    const x = clone(s)
    const keep = <T>(o: Record<string, T> | undefined) => {
      const r = Object.fromEntries(Object.entries(o ?? {}).filter(([k]) => !isPk(k)))
      return Object.keys(r).length ? r : undefined
    }
    x.flags = keep(x.flags)
    if (!x.flags) delete x.flags
    x.evHist = keep(x.evHist)
    if (!x.evHist) delete x.evHist
    x.taken = x.taken.filter((t) => !isPk(t))
    x.log = x.log.filter((e) => !isPk(e.eventId))
    return x
  }

  /** a life played as on screen (おまかせ answers): the lines with their times, the questions, and the state, without the packs */
  function screen(cc: CountryCode, seed: number) {
    const sim: Sim = { params: defaultParams() }
    const s = createLife({ seed, country: cc, pace: 'p15' })
    const rest: unknown[] = []
    let pkLines = 0
    let pkAsks = 0
    let alone = 0
    let last = true
    for (let g = 0; g < 130 && s.alive; g++) {
      const plan = planYear(s, sim)
      rest.push(plan.events.filter((e) => !isPk(e.entry.eventId)).map((e) => [e.at, e.entry.kind, e.entry.text, e.entry.eventId ?? '']))
      pkLines += plan.events.filter((e) => isPk(e.entry.eventId)).length
      if (plan.decision && isPk(plan.decision.decision.id)) {
        alone++
        if (plan.decision.at !== 0.97) last = false
      }
      let d = plan.decision?.decision
      let pkSeen = false
      while (d && s.alive) {
        const pk = isPk(d.id)
        if (pk) {
          pkAsks++
          pkSeen = true
        } else {
          if (pkSeen) last = false
          rest.push(['D', d.id, d.title, d.body, d.choices.map((c) => `${c.label}|${c.hint ?? ''}`), d.autoIndex])
        }
        const r = resolveDecision(s, d.autoIndex, sim)
        if (!pk) rest.push(r.events.filter((e) => !isPk(e.entry.eventId)).map((e) => [e.at, e.entry.kind, e.entry.text, e.entry.eventId ?? '']))
        d = r.followUp?.decision
      }
      endYear(s)
    }
    rest.push(strip(s))
    return { rest: JSON.stringify(rest), pkLines, pkAsks, alone, last }
  }

  function headless(cc: CountryCode, seed: number) {
    const tally: string[] = []
    const sim: Sim = { params: defaultParams(), headless: true, tally: (k, ok) => tally.push(`${k}${ok ? 1 : 0}`) }
    const s = runHeadless({ seed, country: cc, pace: 'p15' }, sim)
    return { rest: JSON.stringify([tally, strip(s)]), pk: Object.keys(s.evHist ?? {}).filter(isPk).length }
  }

  it('on screen: the same lines at the same times, the same questions (the wished position too), the same life; the pack\'s question last', () => {
    let pkLines = 0
    let pkAsks = 0
    let alone = 0
    for (const cc of ['JP', 'US', 'KR', 'CU'] as const) {
      for (let i = 0; i < 12; i++) {
        const seed = hashSeed(i + 8_500_000)
        setPacksForTests({ entries: [], countries: ALL_OFF })
        const off = screen(cc, seed)
        setPacksForTests({ entries, countries: ALL_ON })
        const on = screen(cc, seed)
        expect(on.rest, `${cc} seed ${seed}`).toBe(off.rest)
        expect(on.last, `${cc} seed ${seed}: a pack's question after the others, at the end of its year`).toBe(true)
        expect(off.pkLines + off.pkAsks).toBe(0)
        pkLines += on.pkLines
        pkAsks += on.pkAsks
        alone += on.alone
      }
    }
    // (the test is worth something only if the pack did meet these lives)
    expect(pkLines).toBeGreaterThan(50)
    expect(pkAsks).toBeGreaterThan(10)
    expect(alone).toBeGreaterThan(3)
  })

  it('headless: the same calibrated draws and the same life', () => {
    let met = 0
    for (const cc of ['JP', 'US', 'KR', 'CU'] as const) {
      for (let i = 0; i < 25; i++) {
        const seed = hashSeed(i + 8_600_000)
        setPacksForTests({ entries: [], countries: ALL_OFF })
        const off = headless(cc, seed)
        setPacksForTests({ entries, countries: ALL_ON })
        const on = headless(cc, seed)
        expect(on.rest, `${cc} seed ${seed}`).toBe(off.rest)
        met += on.pk
      }
    }
    expect(met).toBeGreaterThan(100)
  })

  it('the save: a pending question of a pack survives saving and loading; one of a pack no longer there is let go', () => {
    setPacksForTests({ entries, countries: ALL_ON })
    const sim: Sim = { params: defaultParams() }
    let found: LifeState | undefined
    for (let i = 0; i < 40 && !found; i++) {
      const s = createLife({ seed: hashSeed(i + 8_700_000), country: 'US', pace: 'p15' })
      for (let g = 0; g < 130 && s.alive && !found; g++) {
        const plan = planYear(s, sim)
        let d = plan.decision?.decision
        while (d && s.alive && !found) {
          if (isPk(d.id)) {
            found = s
            break
          }
          d = resolveDecision(s, d.autoIndex, sim).followUp?.decision
        }
        if (!found) endYear(s)
      }
    }
    expect(found, 'no pack question met').toBeDefined()
    // (the question waiting for an answer is kept in the saved life: life.ts StateWithPending)
    type Saved = LifeState & { pending?: { id: string; data: Record<string, number | boolean | string> } }
    const s = found! as Saved
    expect(isPk(s.pending?.id)).toBe(true)
    // saved as persist.ts saves it (JSON), loaded, answered: the same as answering the life in memory
    const loaded = clone(s)
    const a = resolveDecision(s, 1, sim)
    const b = resolveDecision(loaded, 1, sim)
    expect(JSON.stringify(b)).toBe(JSON.stringify(a))
    expect(JSON.stringify(loaded)).toBe(JSON.stringify(s))
    expect(s.flags?.['pk.fixture.marked']).toBe(s.age)
    // a question of a pack that has been taken out of the list: answered, nothing happens
    const gone: Saved = clone(s)
    gone.pending = { id: 'pk.removed.question', data: {} }
    const before = JSON.stringify({ ...gone, pending: undefined, taken: undefined })
    expect(() => resolveDecision(gone, 0, sim)).not.toThrow()
    expect(JSON.stringify({ ...gone, pending: undefined, taken: undefined })).toBe(before)
  })

  it('with the game\'s packs (usTown, krTown, cuTown): everything else of a life is as it was, on screen and headless, in every country', () => {
    let met = 0
    for (const cc of ['JP', 'US', 'KR', 'CU'] as const) {
      let here = 0
      for (let i = 0; i < 8; i++) {
        const seed = hashSeed(i + 8_800_000)
        setPacksForTests({ entries: [], countries: ALL_OFF })
        const off = screen(cc, seed)
        setPacksForTests()
        const on = screen(cc, seed)
        expect(on.rest, `${cc} seed ${seed} (screen)`).toBe(off.rest)
        expect(on.last, `${cc} seed ${seed}: a pack's question after the others`).toBe(true)
        here += on.pkLines + on.pkAsks
      }
      for (let i = 0; i < 20; i++) {
        const seed = hashSeed(i + 8_900_000)
        setPacksForTests({ entries: [], countries: ALL_OFF })
        const off = headless(cc, seed)
        setPacksForTests()
        const on = headless(cc, seed)
        expect(on.rest, `${cc} seed ${seed} (headless)`).toBe(off.rest)
        here += on.pk
      }
      if (cc === 'JP') expect(here, 'a Japanese life meets no pack').toBe(0)
      else expect(here, `${cc}: its pack is met`).toBeGreaterThan(10)
      met += here
    }
    expect(met).toBeGreaterThan(30)
  }, 60_000)

  it('the game\'s packs: the same events on screen (おまかせ) as headless', () => {
    setPacksForTests()
    const pkOf = (s: LifeState) => JSON.stringify([Object.entries(s.evHist ?? {}).filter(([k]) => isPk(k)).sort(), Object.entries(s.flags ?? {}).filter(([k]) => isPk(k)).sort()])
    let met = 0
    for (const cc of ['US', 'KR', 'CU'] as const) {
      for (let i = 0; i < 12; i++) {
        const seed = hashSeed(i + 9_000_000)
        const sim: Sim = { params: defaultParams() }
        const s = createLife({ seed, country: cc, pace: 'p15' })
        for (let g = 0; g < 130 && s.alive; g++) {
          const plan = planYear(s, sim)
          let d = plan.decision?.decision
          while (d && s.alive) d = resolveDecision(s, d.autoIndex, sim).followUp?.decision
          endYear(s)
        }
        const h = runHeadless({ seed, country: cc, pace: 'p15' }, { params: defaultParams(), headless: true })
        expect(pkOf(s), `${cc} seed ${seed}`).toBe(pkOf(h))
        met += Object.keys(h.evHist ?? {}).filter(isPk).length
      }
    }
    expect(met).toBeGreaterThan(30)
  }, 60_000)
})

describe('the packs of the game (usTown, krTown, cuTown; approved 2026-10-21)', () => {
  /** the chance a year of each event, as approved: daily lines 0.1, starts of a later story 0.25, continuations 0.2, baseball 0.5 (the rookie's radio 0.6) */
  const CHANCE: Record<string, number> = {
    'pk.usTown.dogDay': 0.5,
    'pk.usTown.quiz': 0.1,
    'pk.usTown.glove': 0.25,
    'pk.usTown.gloveOwner': 0.2,
    'pk.usTown.teamName': 0.1,
    'pk.krTown.busDriver': 0.5,
    'pk.krTown.eggRoll': 0.5,
    'pk.krTown.eggWedding': 0.2,
    'pk.krTown.elevator': 0.1,
    'pk.krTown.taxi': 0.1,
    'pk.cuTown.radioName': 0.6,
    'pk.cuTown.chess': 0.1,
    'pk.cuTown.videoCall': 0.5,
    'pk.cuTown.wall': 0.25,
    'pk.cuTown.wallLater': 0.2,
  }
  const entryOf = (id: string) => PACK_ENTRIES.find((e) => e.def.id === id)!
  /** a life of a country at an age (left baseball unless `set` says otherwise) */
  const at = (cc: CountryCode, age: number, set: (s: LifeState) => void = () => {}, seed = 77) => {
    const s = createLife({ seed, country: cc, pace: 'p15' })
    s.age = age
    s.career.phase = 'retired'
    set(s)
    return s
  }
  const fits = (id: string, s: LifeState) => packFits(entryOf(id), s, PACK_COUNTRIES)

  it('fifteen events with their chances; lines and flags of their own pack only; the US, Korea and Cuba on, Japan off', () => {
    expect(PACKS.map((p) => p.id)).toEqual(['usTown', 'krTown', 'cuTown'])
    expect(PACK_ENTRIES.map((e) => e.def.id).sort()).toEqual(Object.keys(CHANCE).sort())
    for (const e of PACK_ENTRIES) expect(e.chance, e.def.id).toBe(CHANCE[e.def.id])
    expect(COUNTRIES.filter((c) => PACK_COUNTRIES[c]).sort()).toEqual(['CU', 'KR', 'US'])
    for (const p of PACKS) {
      expect([p.impact, p.where, p.countries.length]).toEqual(['log', 'born', 1])
      for (const e of p.events) {
        const outcomes = [...(e.spec.outcomes ?? []), ...(e.spec.choices ?? []).flatMap((c) => c.outcomes)]
        for (const x of [...outcomes.map((o) => o.effects), ...(e.spec.choices ?? []).map((c) => c.effects)]) {
          for (const [k, v] of Object.entries(x ?? {})) {
            expect(k, `${e.spec.id}: only flags`).toBe('flag')
            for (const f of [v].flat() as string[]) expect(f.startsWith(`pk.${p.id}.`), f).toBe(true)
          }
        }
        for (const c of e.spec.choices ?? []) for (const f of [c.flag ?? []].flat()) expect(f.startsWith(`pk.${p.id}.`), f).toBe(true)
      }
    }
    expect(validatePacks(PACKS, KNOWN, EXISTING)).toEqual([])
    // the glove's owner is a key line (among the main events of the life)
    expect(PACKS[0].events.find((e) => e.spec.id === 'pk.usTown.gloveOwner')!.spec.outcomes![0].key).toBe(true)
  })

  it('a chance is rolled on the event\'s own stream: the same each time, the pass\'s stream untouched, and another pack never changes it', () => {
    const both = [...PACK_ENTRIES, ...compilePack(TEST_PACK)]
    // (states of lives played without the packs, so that the packs' events have not been met yet)
    setPacksForTests({ entries: [], countries: ALL_OFF })
    const states = (['US', 'KR', 'CU'] as const).flatMap((cc, i) => snapshots(cc, [hashSeed(8_150 + i), hashSeed(8_250 + i)], 3))
    setPacksForTests()
    const game = (lines: unknown[]) => lines.filter((l) => !String((l as unknown[])[2]).startsWith('pk.fixture.'))
    let ran = 0
    states.forEach((s, i) => {
      const a = clone(s)
      const b = clone(s)
      const r = counting(makeRng(i))
      const fa = fakeCtx(a, r.rng)
      const fb = fakeCtx(b, makeRng(i))
      const ra = runPacks(PACK_ENTRIES, PACK_COUNTRIES, fa.c)
      expect(r.calls(), "the pass's own stream is not drawn for events with a chance").toBe(0)
      const rb = runPacks(both, PACK_COUNTRIES, fb.c).filter((id) => !id.startsWith('pk.fixture.'))
      expect(rb, `state ${i}`).toEqual(ra)
      expect(game(fb.lines), `state ${i}`).toEqual(fa.lines)
      expect(packRoll(s, 'pk.usTown.quiz')).toBe(packRoll(clone(s), 'pk.usTown.quiz'))
      ran += ra.length
    })
    expect(states.length).toBeGreaterThan(80)
    expect(ran).toBeGreaterThan(5)
  })

  it('a continuation comes only after its start, inside its window, and once (lives of the US and Cuba)', () => {
    for (const [cc, start, cont, lo, hi] of [
      ['US', 'pk.usTown.glove', 'pk.usTown.gloveOwner', 30, 55],
      ['CU', 'pk.cuTown.wall', 'pk.cuTown.wallLater', 20, 40],
    ] as const) {
      let starts = 0
      let conts = 0
      for (let i = 0; i < 250; i++) {
        const s = runHeadless({ seed: hashSeed(i + 9_100_000), country: cc, pace: 'p15' }, { params: defaultParams(), headless: true })
        const a = s.evHist?.[start]
        const b = s.evHist?.[cont]
        if (a) {
          starts++
          expect(a[1]).toBe(1)
        }
        if (b) {
          conts++
          expect(a, `${cont} without ${start}`).toBeDefined()
          expect(b[1]).toBe(1)
          expect(b[0] - a![0]).toBeGreaterThanOrEqual(lo)
          expect(b[0] - a![0]).toBeLessThanOrEqual(hi)
        }
      }
      expect(starts, cc).toBeGreaterThan(100)
      expect(conts, cc).toBeGreaterThan(80)
    }
  }, 60_000)

  it('Korea: the dish only in the two years of the service, its wedding 12 to 25 years after; Cuba: the wall\'s ending follows where he lives', () => {
    const svc = (age: number) => at('KR', age, (s) => {
      s.career.phase = 'pro'
      s.flags = { 'kr.mil': 24 }
    })
    expect([24, 25, 26].map((a) => fits('pk.krTown.eggRoll', svc(a)))).toEqual([true, true, false])
    expect(fits('pk.krTown.eggRoll', at('KR', 24, (s) => (s.career.phase = 'pro')))).toBe(false)
    const wed = (age: number) => at('KR', age, (s) => (s.flags = { 'pk.krTown.egg': 24 }))
    expect([35, 36, 49, 50].map((a) => fits('pk.krTown.eggWedding', wed(a)))).toEqual([false, true, true, false])
    expect(fits('pk.krTown.eggWedding', at('KR', 40)), 'without the dish, never').toBe(false)
    for (const [home, flag] of [
      [true, 'pk.cuTown.wallSeen'],
      [false, 'pk.cuTown.wallPhoto'],
    ] as const) {
      const s = at('CU', 35, (x) => {
        x.flags = { 'pk.cuTown.wall': 10 }
        if (!home) {
          x.flags['cu.mlb'] = 20
          setResidence(x, 'US')
        }
      })
      expect(fits('pk.cuTown.wallLater', s)).toBe(true)
      entryOf('pk.cuTown.wallLater').def.run(fakeCtx(s, makeRng(1)).c)
      expect(s.flags?.[flag], flag).toBe(35)
      expect(Object.keys(s.flags ?? {}).filter((k) => k.startsWith('pk.cuTown.wall')).length).toBe(2)
    }
  })

  it('the baseball events happen in the lives they are for, and only there, once each', () => {
    const pro = (cc: CountryCode, age: number, phase: 'pro' | 'proMinor', set: (s: LifeState) => void = () => {}, seed = 77) =>
      at(cc, age, (s) => {
        s.career.phase = phase
        set(s)
      }, seed)
    expect(fits('pk.usTown.dogDay', pro('US', 22, 'proMinor'))).toBe(true)
    expect(fits('pk.usTown.dogDay', pro('US', 22, 'pro'))).toBe(false)
    expect(fits('pk.krTown.busDriver', pro('KR', 20, 'proMinor'))).toBe(true)
    expect(fits('pk.krTown.busDriver', pro('KR', 20, 'pro'))).toBe(false)
    expect([1, 2, 3].map((n) => fits('pk.cuTown.radioName', pro('CU', 20, 'pro', (s) => (s.career.proSeasons = n))))).toEqual([true, true, false])
    expect(fits('pk.cuTown.radioName', pro('CU', 20, 'pro', (s) => {
      s.career.proSeasons = 1
      s.flags = { 'cu.mlb': 19 }
    }))).toBe(false)
    const abroad = (age: number, alive = true, seed = 77) =>
      pro('CU', age, 'proMinor', (s) => {
        s.flags = { 'cu.mlb': 22 }
        setResidence(s, 'US')
        if (!alive) {
          s.family.father = null
          s.family.mother = null
        }
      }, seed)
    expect(fits('pk.cuTown.videoCall', abroad(25))).toBe(true)
    expect(fits('pk.cuTown.videoCall', abroad(25, false))).toBe(false)
    // over the years they hold, each comes at most once, and in most lives (chances 0.5 and 0.6 a year)
    const cases: [string, number[], (seed: number) => LifeState, number][] = [
      ['pk.usTown.dogDay', [20, 21, 22, 23, 24], (seed) => pro('US', 20, 'proMinor', () => {}, seed), 0.85],
      ['pk.krTown.busDriver', [19, 20, 21, 22, 23], (seed) => pro('KR', 19, 'proMinor', () => {}, seed), 0.85],
      ['pk.krTown.eggRoll', [24, 25], (seed) => pro('KR', 24, 'pro', (s) => (s.flags = { 'kr.mil': 24 }), seed), 0.55],
      ['pk.cuTown.radioName', [19, 20], (seed) => pro('CU', 19, 'pro', () => {}, seed), 0.65],
      ['pk.cuTown.videoCall', [23, 24, 25, 26, 27, 28], (seed) => abroad(23, true, seed), 0.9],
    ]
    for (const [id, ages, make, floor] of cases) {
      let lives = 0
      for (let seed = 1; seed <= 60; seed++) {
        const s = make(seed)
        let met = 0
        for (const a of ages) {
          s.age = a
          // (the rookie's seasons: 1 in the first year, 2 in the second)
          if (id === 'pk.cuTown.radioName') s.career.proSeasons = a - 18
          if (runPacks(PACK_ENTRIES, PACK_COUNTRIES, fakeCtx(s, makeRng(a)).c).includes(id)) met++
        }
        expect(met, `${id} seed ${seed}`).toBeLessThanOrEqual(1)
        lives += met
      }
      expect(lives / 60, id).toBeGreaterThan(floor)
    }
  })

  it('how often in lives: the daily events in most lives that live through their years, and every event is its own country\'s', () => {
    const lives: Record<'US' | 'KR' | 'CU', LifeState[]> = { US: [], KR: [], CU: [] }
    for (const cc of ['US', 'KR', 'CU'] as const) {
      for (let i = 0; i < 300; i++) lives[cc].push(runHeadless({ seed: hashSeed(i + 9_200_000), country: cc, pace: 'p15' }, { params: defaultParams(), headless: true }))
    }
    const share = (cc: 'US' | 'KR' | 'CU', id: string, past: number) => {
      const xs = lives[cc].filter((s) => s.age > past)
      return xs.filter((s) => s.evHist?.[id]).length / xs.length
    }
    expect(share('US', 'pk.usTown.quiz', 70)).toBeGreaterThan(0.8)
    expect(share('US', 'pk.usTown.teamName', 50)).toBeGreaterThan(0.75)
    expect(share('US', 'pk.usTown.glove', 15)).toBeGreaterThan(0.6)
    expect(share('KR', 'pk.krTown.elevator', 80)).toBeGreaterThan(0.8)
    expect(share('KR', 'pk.krTown.taxi', 70)).toBeGreaterThan(0.8)
    expect(share('CU', 'pk.cuTown.chess', 85)).toBeGreaterThan(0.75)
    expect(share('CU', 'pk.cuTown.wall', 14)).toBeGreaterThan(0.6)
    for (const cc of ['US', 'KR', 'CU'] as const) {
      const prefix = { US: 'pk.usTown.', KR: 'pk.krTown.', CU: 'pk.cuTown.' }[cc]
      let n = 0
      for (const s of lives[cc]) {
        const ids = Object.keys(s.evHist ?? {}).filter(isPk)
        for (const id of ids) expect(id.startsWith(prefix), `${id} in a life of ${cc}`).toBe(true)
        n += ids.length
      }
      expect(n / lives[cc].length, cc).toBeGreaterThan(1)
      expect(n / lives[cc].length, cc).toBeLessThan(5)
    }
  }, 60_000)
})
