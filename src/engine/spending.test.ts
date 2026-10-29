import { describe, expect, it } from 'vitest'
import { EVENTS, createLife, endYear, planYear, resolveDecision, type Sim } from './life.ts'
import { defaultParams } from './params.ts'
import { ensureAfter } from './after.ts'
import { languageRows } from './language.ts'
import { EventRegistry, runResidentPass, type EventCtx } from './events.ts'
import { applyEffect, compileSpec, validateSpecs, type EventSpec } from './events/spec.ts'
import { SPENDING_SPECS, spendingSpecsOf } from './events/spending.ts'
import { PUBLIC_SPECS, PUBLIC_SPECS_JP, PUBLIC_SPECS_US } from './events/publicLife.ts'
import { IMMERSION_CEILING, LANG_OF, STUDY_CEILING, immerseYear, initBackground, levelOf, studyLang } from './language.ts'
import { makeRng, hashSeed } from './rng.ts'
import { setResidence } from './countries/index.ts'
import type { LifeState } from './types.ts'

// Spending and investing, languages and a second background, the news and the offices (PROJECT_PLAN §11.41).

const mk = (country: 'JP' | 'US', seed = 5): LifeState => createLife({ seed, country, pace: 'p15' })
const spec = (id: string): EventSpec => SPENDING_SPECS.find((s) => s.id === id) ?? PUBLIC_SPECS.find((s) => s.id === id)!

interface Asked {
  labels: string[]
  auto: number
  data: Record<string, number | boolean | string>
}
function ctx(s: LifeState, seed = 1) {
  const asked: Asked[] = []
  const log: { kind: string; text: string }[] = []
  const c: EventCtx = {
    s,
    rng: makeRng(seed),
    headless: true,
    add: (kind, text) => log.push({ kind, text }),
    ask: (d, data = {}) => asked.push({ labels: d.choices.map((x) => x.label), auto: d.autoIndex, data }),
    canAsk: () => true,
  }
  return { c, asked, log }
}
/** ask a decision of the spec as the game does, return what is open and the おまかせ answer */
function open(id: string, s: LifeState) {
  const def = compileSpec(spec(id))
  const { c, asked } = ctx(s)
  def.run(c)
  return { def, asked: asked[0] }
}
function answer(id: string, s: LifeState, choice: number, seed = 1) {
  const def = compileSpec(spec(id))
  const { c, asked, log } = ctx(s, seed)
  def.run(c)
  const q = asked[0]
  def.resolve!(c, choice, q.data)
  return { log, q }
}
const snapshot = (s: LifeState) => JSON.stringify([s.money, s.status, s.family, s.flags, s.languages, s.taken, s.due, s.after?.home])

/** a man playing in the pros with money, a home he rents, no car */
function rich(country: 'JP' | 'US', money: number): LifeState {
  const s = mk(country)
  s.age = 30
  s.career.phase = 'pro'
  s.career.highestRank = 8
  s.money = money
  s.after = { edu: 'hs', jobless: 0, home: 'rent', loan: 0, baseballLife: [], community: false, care: false, retired: false }
  return s
}

describe('the sets are well formed', () => {
  it('one set per country: no padding, follow-ups booked, nothing that moves the calibrated career without saying so', () => {
    const known = new Set(EVENTS.all().map((d) => d.id))
    expect(validateSpecs([...spendingSpecsOf('JP'), ...PUBLIC_SPECS_JP], known)).toEqual([])
    expect(validateSpecs([...spendingSpecsOf('US'), ...PUBLIC_SPECS_US], known)).toEqual([])
  })

  it('are tied to where he lives, and counted by kind', () => {
    const all = [...SPENDING_SPECS, ...PUBLIC_SPECS]
    for (const s of all) expect(s.lives, s.id).toBeTruthy()
    const news = all.filter((s) => !s.followOnly && !s.choices && (s.outcomes ?? []).every((o) => !o.effects && !o.follow))
    expect(news.length).toBeGreaterThanOrEqual(14)
    expect(all.length).toBeGreaterThanOrEqual(60)
    // every decision has a "do nothing" answer that is the おまかせ one and is always open
    for (const s of all.filter((x) => x.choices)) {
      const last = s.choices![s.choices!.length - 1]
      expect(last.when, s.id).toBeUndefined()
      expect(last.effects ?? {}, s.id).toEqual({})
      expect(s.auto, s.id).toBe(s.choices!.length - 1)
    }
  })
})

describe('what he can choose depends on what he has', () => {
  it('a car: not with too little money, not twice; the free answer is always open and is the おまかせ one', () => {
    const poor = rich('US', 30)
    const q = open('sp.car.us', poor).asked
    expect(q.labels.length).toBe(1)
    expect(q.auto).toBe(0)
    const well = rich('US', 600)
    const r = open('sp.car.us', well).asked
    expect(r.labels.length).toBe(3)
    expect(r.auto).toBe(2)
    // already owns one: the event does not come
    const owner = rich('US', 600)
    owner.flags = { 'own.car': 28 }
    expect(compileSpec(spec('sp.car.us')).when!(owner)).toBe(false)
  })

  it('buying costs the price once and sets the fact', () => {
    const s = rich('JP', 600)
    const before = s.money
    answer('sp.car.jp', s, 0)
    expect(before - s.money).toBe(180)
    expect(s.flags?.['own.car']).toBeDefined()
    expect(compileSpec(spec('sp.car.jp')).when!(s)).toBe(false)
  })

  it('investing: the risks open with the money (a monthly saving, stocks, a venture, a rented room)', () => {
    const labels = (m: number) => open('sp.invest.us', rich('US', m)).asked.labels.length
    // saving only (+ study + nothing), stocks, a venture, a rented room appear one after another
    expect([labels(100), labels(400), labels(700), labels(1500)]).toEqual([3, 4, 5, 6])
    expect(compileSpec(spec('sp.invest.us')).when!(rich('US', 50))).toBe(false)
  })

  it('an investment is paid once, follows up, and the result is booked once (no double count)', () => {
    const s = rich('US', 1000)
    const before = s.money
    answer('sp.invest.us', s, 1) // stocks: 200 in
    expect(before - s.money).toBe(200)
    expect(s.flags?.['inv.stocks']).toBeDefined()
    expect(s.flags?.['invest.started']).toBeDefined()
    expect(s.due?.length).toBe(1)
    // while it is out, no second investment is offered
    expect(compileSpec(spec('sp.invest.us')).when!(s)).toBe(false)
    // the result: one of the stock outcomes, once, and the fact is cleared
    const back = compileSpec(spec('sp.investBack.us'))
    const mid = s.money
    back.run(ctx(s, 3).c)
    expect(s.flags?.['inv.stocks']).toBeUndefined()
    expect(s.flags?.['inv.pending']).toBeUndefined()
    expect([80, 240, 650]).toContain(s.money - mid)
    // the next time the choice is open again
    expect(compileSpec(spec('sp.invest.us')).when!(s)).toBe(true)
  })

  it('one investment system with the old one: this one takes the flag of x.life.invest', () => {
    const s = rich('JP', 1000)
    answer('sp.invest.jp', s, 0)
    expect(EVENTS.get('x.life.invest')!.when!(s)).toBe(false)
  })

  it('family and home conditions: a trip needs a family; a home is bought while playing only where the profile says so', () => {
    const single = rich('US', 500)
    expect(compileSpec(spec('sp.trip.us')).when!(single)).toBe(false)
    single.family.spouse = { name: 'Emily', years: 2 }
    expect(compileSpec(spec('sp.trip.us')).when!(single)).toBe(true)
    expect(SPENDING_SPECS.some((s) => s.id === 'sp.home.us')).toBe(false)
    const jp = rich('JP', 700)
    expect(compileSpec(spec('sp.home.jp')).when!(jp)).toBe(true)
    jp.after!.home = 'own'
    expect(compileSpec(spec('sp.home.jp')).when!(jp)).toBe(false)
    jp.after!.home = 'rent'
    jp.money = 300
    expect(compileSpec(spec('sp.home.jp')).when!(jp)).toBe(false)
  })

  it('baseball spending needs a playing career, and the おまかせ answer spends nothing', () => {
    const retired = rich('US', 900)
    retired.career.phase = 'retired'
    for (const id of ['sp.training.us', 'sp.coach.us', 'sp.gear.us', 'sp.body.us']) expect(compileSpec(spec(id)).when!(retired), id).toBe(false)
    const playing = rich('US', 900)
    for (const id of ['sp.training.us', 'sp.coach.us', 'sp.gear.us', 'sp.body.us']) {
      expect(compileSpec(spec(id)).when!(playing), id).toBe(true)
      const before = snapshot(playing)
      const q = open(id, playing).asked
      answer(id, playing, q.auto)
      expect(snapshot(playing), id).toBe(before)
    }
    // the choices that cost move the game's own states (a little)
    const t = rich('US', 900)
    expect(spec('sp.training.us').career).toBe(true)
    const before = t.money
    answer('sp.training.us', t, 0)
    expect(t.money).toBeLessThan(before)
  })

  it('the おまかせ answer of every spending and public decision changes nothing in the life', () => {
    for (const cc of ['JP', 'US'] as const) {
      for (const sp of [...spendingSpecsOf(cc), ...(cc === 'JP' ? PUBLIC_SPECS_JP : PUBLIC_SPECS_US)].filter((x) => x.choices && !x.followOnly)) {
        const s = rich(cc, 5000)
        s.age = 38
        s.career.phase = 'retired'
        s.career.endedAge = 34
        s.family.spouse = { name: 'X', years: 5 }
        s.family.kids = [4]
        s.family.children = 1
        s.person.heritage = cc === 'JP' ? 'US' : 'MX'
        // a state in which most of the events can be asked
        const def = compileSpec(sp)
        const { c, asked } = ctx(s)
        def.run(c)
        if (asked.length === 0) continue
        const before = snapshot(s)
        def.resolve!(ctx(s, 2).c, asked[0].auto, asked[0].data)
        expect(snapshot(s), sp.id).toBe(before)
      }
    }
  })
})

describe('which country\'s events a man meets', () => {
  const ids = (s: LifeState) => {
    const found = new Set<string>()
    for (let seed = 1; seed <= 150; seed++) {
      s.evHist = {}
      for (const id of runResidentPass(EVENTS, ctx(s, seed).c)) found.add(id)
    }
    return found
  }
  it('a resident of Japan meets Japan\'s, a resident of the US meets the US\'s, a Japanese in the MLB meets the US\'s', () => {
    const jp = rich('JP', 800)
    jp.career.phase = 'pro'
    const a = ids(jp)
    expect(a.size).toBeGreaterThan(3)
    for (const id of a) expect(id.endsWith('.us') || id.startsWith('us.'), id).toBe(false)
    const us = rich('US', 800)
    for (const id of ids(us)) expect(id.endsWith('.jp') || id.startsWith('jp.'), id).toBe(false)
    const away = rich('JP', 800)
    away.career.phase = 'abroad'
    setResidence(away, 'US')
    const c = ids(away)
    expect(c.size).toBeGreaterThan(3)
    for (const id of c) expect(id.endsWith('.jp') || id.startsWith('jp.'), id).toBe(false)
  })
})

describe('languages', () => {
  it('study gives a share of what is left, once a year per language, and stops at the ceiling', () => {
    const s = mk('JP')
    s.age = 25
    expect(levelOf(s, 'ja')).toBe(100)
    expect(levelOf(s, 'en')).toBe(0)
    const g1 = studyLang(s, 'en', 25)
    expect(g1).toBeGreaterThan(0)
    // a second lesson the same year adds nothing
    expect(studyLang(s, 'en', 25)).toBe(0)
    const afterOne = levelOf(s, 'en')
    for (let year = 1; year <= 40; year++) {
      s.age++
      studyLang(s, 'en', 25)
    }
    expect(levelOf(s, 'en')).toBeGreaterThan(afterOne)
    expect(levelOf(s, 'en')).toBeLessThanOrEqual(STUDY_CEILING)
    // the gains shrink: the first is larger than the last
    const t = mk('JP')
    t.age = 20
    const first = studyLang(t, 'en', 25)
    t.age = 21
    for (let i = 0; i < 12; i++) {
      t.age++
      studyLang(t, 'en', 25)
    }
    t.age++
    const late = studyLang(t, 'en', 25)
    expect(first).toBeGreaterThan(late)
  })

  it('study through an event cannot be repeated for more in a year', () => {
    const s = rich('US', 500)
    s.person.heritage = 'MX'
    s.languages = { en: 100, es: 35 }
    const a = levelOf(s, 'es')
    applyEffect(s, { lang: ['heritage', 25] })
    const b = levelOf(s, 'es')
    expect(b).toBeGreaterThan(a)
    applyEffect(s, { lang: ['heritage', 25] })
    expect(levelOf(s, 'es')).toBe(b)
  })

  it('living abroad teaches a little each year up to a ceiling that only study passes; at home it teaches nothing', () => {
    const away = mk('JP')
    away.age = 25
    setResidence(away, 'US')
    for (let i = 0; i < 80; i++) immerseYear(away)
    expect(levelOf(away, 'en')).toBe(IMMERSION_CEILING)
    away.flags = {}
    away.age = 30
    studyLang(away, 'en', 50)
    expect(levelOf(away, 'en')).toBeGreaterThan(IMMERSION_CEILING)
    const home = mk('JP')
    home.age = 25
    for (let i = 0; i < 10; i++) immerseYear(home)
    expect(levelOf(home, 'en')).toBe(0)
    expect(LANG_OF.JP).toBe('ja')
  })

  it('a language changes how a move abroad turns out, not the ability: the contract talk by level', () => {
    const run = (level: number) => {
      const s = mk('JP')
      s.age = 28
      s.career.phase = 'abroad'
      s.career.highestRank = 10
      s.languages = { ja: 100, en: level }
      const def = EVENTS.get('life.abroad.contractTalk')!
      const z = s.z
      const m = s.money
      def.resolve!(ctx(s).c, 1, {})
      return { dm: s.money - m, z: s.z - z }
    }
    expect(run(70).dm).toBeGreaterThan(run(40).dm)
    expect(run(40).dm).toBeGreaterThan(run(5).dm)
    for (const l of [5, 40, 70]) expect(run(l).z).toBe(0)
  })
})

describe('a second background', () => {
  const sample = (country: 'JP' | 'US', n: number) => {
    let withIt = 0
    for (let i = 0; i < n; i++) {
      const s = mk(country, hashSeed(i + 21_000_000))
      if (s.person.heritage) withIt++
    }
    return withIt / n
  }
  it('is rare, set from the country of birth, and gives a second language to start from, nothing else', () => {
    const jp = sample('JP', 4000)
    const us = sample('US', 4000)
    expect(jp).toBeGreaterThan(0.015)
    expect(jp).toBeLessThan(0.05)
    expect(us).toBeGreaterThan(0.07)
    expect(us).toBeLessThan(0.14)
    for (let i = 0; i < 300; i++) {
      const s = mk('US', hashSeed(i + 22_000_000))
      if (!s.person.heritage) {
        expect(Object.keys(s.languages ?? {})).toEqual(['en'])
        continue
      }
      expect(s.person.heritage).not.toBe('US')
      expect(levelOf(s, 'en')).toBe(100)
      const lang = LANG_OF[s.person.heritage]
      expect(levelOf(s, lang)).toBe(lang === 'en' ? 100 : 35)
    }
  })

  it('does not touch the life\'s other draws: the same seed gives the same person with or without it', () => {
    for (let i = 0; i < 200; i++) {
      const seed = hashSeed(i + 23_000_000)
      const a = mk('JP', seed)
      const b = mk('JP', seed)
      delete b.person.heritage
      b.languages = undefined
      initBackground(b)
      expect(JSON.stringify({ ...a, languages: undefined, person: { ...a.person, heritage: undefined } })).toBe(JSON.stringify({ ...b, languages: undefined, person: { ...b.person, heritage: undefined } }))
      expect(a.z).toBe(b.z)
    }
  })

  it('its events need it: the team choice and the visit, once, and only for a man with a second background', () => {
    const s = rich('US', 500)
    const team = compileSpec(spec('her.team.us'))
    const visit = compileSpec(spec('her.visit.us'))
    expect(team.when!(s)).toBe(false)
    expect(visit.when!(s)).toBe(false)
    s.person.heritage = 'MX'
    expect(team.when!(s)).toBe(true)
    expect(visit.when!(s)).toBe(true)
    answer('her.team.us', s, 0)
    expect(s.flags?.['her.teamHeritage']).toBeDefined()
    expect(team.when!(s)).toBe(false)
    // his ability and his character are untouched by a background
    const z = s.z
    answer('her.visit.us', s, 0)
    expect(s.z).toBe(z)
    expect(levelOf(s, 'es')).toBeGreaterThan(0)
  })
})

describe('offices and the large turns', () => {
  const retired = (cc: 'JP' | 'US', rank = 8): LifeState => {
    const s = rich(cc, 3000)
    s.career.phase = 'retired'
    s.career.endedAge = 36
    s.career.highestRank = rank
    s.age = 60
    return s
  }
  /** whether the scheduler would offer it: the age range and the conditions */
  const on = (id: string, s: LifeState) => {
    const sp = spec(id)
    const ok = !sp.ages || (s.age >= sp.ages[0] && s.age <= sp.ages[1])
    return ok && compileSpec(sp).when!(s)
  }

  it('each step needs the one before, and a man who is still playing does not stand', () => {
    const s = retired('JP')
    expect(on('jp.pub.council', s)).toBe(true)
    expect(on('jp.pub.diet', s)).toBe(false)
    expect(on('jp.pub.minister', s)).toBe(false)
    expect(on('jp.pub.pm', s)).toBe(false)
    const playing = retired('JP')
    playing.career.phase = 'pro'
    expect(on('jp.pub.council', playing)).toBe(false)
    // the council seat opens the diet after four years, the diet the cabinet after six, the cabinet the leadership after three
    s.flags = { 'pol.council': s.age - 3 }
    expect(on('jp.pub.diet', s)).toBe(false)
    s.flags = { 'pol.council': s.age - 4 }
    expect(on('jp.pub.diet', s)).toBe(true)
    s.flags = { 'pol.diet': s.age - 6 }
    expect(on('jp.pub.minister', s)).toBe(true)
    s.flags = { 'pol.minister': s.age - 3 }
    expect(on('jp.pub.pm', s)).toBe(true)
    // once done, not again
    s.flags = { 'pol.minister': s.age - 3, 'pol.pm': s.age }
    expect(on('jp.pub.pm', s)).toBe(false)
  })

  it('the prime ministership is nearly out of reach: one in ten at best, and it costs a fortune', () => {
    const pm = spec('jp.pub.pm')
    const outcomes = pm.choices![0].outcomes
    expect((outcomes[0].weight as number) / ((outcomes[0].weight as number) + (outcomes[1].weight as number))).toBeLessThanOrEqual(0.1)
    expect(pm.choices![0].when!({ ...retired('JP'), money: 1000 } as LifeState)).toBe(false)
    expect(pm.choices![0].when!({ ...retired('JP'), money: 3000 } as LifeState)).toBe(true)
  })

  it('winning an office needs a man of a name more than anyone, never a sure thing', () => {
    const council = spec('jp.pub.council').choices![0].outcomes
    const win = (rank: number) => (council[0].weight as (s: LifeState) => number)(retired('JP', rank))
    expect(win(8)).toBeGreaterThan(win(5))
    expect(win(5)).toBeGreaterThan(win(0))
    expect(win(8) / (win(8) + (council[1].weight as number))).toBeLessThan(0.7)
  })

  it('the US has its own offices and a uniform, and Japan has neither', () => {
    const us = retired('US')
    expect(on('us.pub.local', us)).toBe(true)
    expect(on('us.pub.state', us)).toBe(false)
    us.flags = { 'pol.local': us.age - 3 }
    expect(on('us.pub.state', us)).toBe(true)
    // a resident of Japan does not meet a US office, nor the reverse
    const jp = retired('JP')
    expect(on('us.pub.local', jp)).toBe(false)
    expect(on('jp.pub.council', us)).toBe(false)
    // the uniform: a young man of the US who is out of baseball, once
    const young = retired('US', 4)
    young.age = 20
    young.career.endedAge = 18
    expect(on('us.mil.enlist', young)).toBe(true)
    young.career.phase = 'pro'
    expect(on('us.mil.enlist', young)).toBe(false)
    const older = retired('US', 4)
    older.age = 35
    expect(on('us.mil.enlist', older)).toBe(false)
    const star = retired('US', 9)
    star.age = 22
    expect(on('us.mil.enlist', star)).toBe(false)
    // the veteran's day only for a man who served
    expect(on('us.mil.veterans', retired('US'))).toBe(false)
    const vet = retired('US')
    vet.flags = { 'mil.served': 20 }
    expect(on('us.mil.veterans', vet)).toBe(true)
    expect(on('us.mil.veterans', Object.assign(retired('JP'), { flags: { 'mil.served': 20 } }))).toBe(false)
  })

  it('enlisting sets the fact once and books the service; the news of a place changes nothing', () => {
    const young = retired('US', 4)
    young.age = 20
    young.career.endedAge = 18
    answer('us.mil.enlist', young, 0)
    expect(young.flags?.['mil.served']).toBeDefined()
    expect(young.due?.length).toBe(1)
    const before = snapshot(young)
    for (const n of PUBLIC_SPECS.filter((x) => x.id.startsWith('nw.') && x.lives === 'US')) {
      const { c, log } = ctx(young)
      compileSpec(n).run(c)
      expect(log.length, n.id).toBe(1)
    }
    expect(snapshot(young)).toBe(before)
    // a registry of its own: the news is never a decision
    const reg = new EventRegistry()
    reg.register(PUBLIC_SPECS.filter((x) => x.id.startsWith('nw.')).map(compileSpec))
    expect(reg.all().every((d) => !d.resolve)).toBe(true)
  })
})

// ---- through the real yearly code and the dialog's own list of choices (PROJECT_PLAN §11.42)

const headless: Sim = { params: defaultParams(), headless: true }
const screen: Sim = { params: defaultParams() }

/** a retired man of 40 with money, no spouse, through the game's own planYear (the adult stage, where the resident pass runs) */
function fixture(country: 'JP' | 'US', seed: number): LifeState {
  const s = createLife({ seed, country, pace: 'p15' })
  s.age = 40
  s.career.phase = 'retired'
  s.career.endedAge = 36
  s.career.highestRank = 8
  s.job = ''
  s.money = 5000
  const a = ensureAfter(s)
  a.retired = false
  a.home = 'rent'
  return s
}

describe('the decisions as the screen receives them', () => {
  it('a purchase is taken once from the savings, with its log line, through planYear and resolveDecision', () => {
    for (const [country, id, cost, word] of [['JP', 'sp.car.jp', 180, '契約'], ['US', 'sp.car.us', 260, '契約'], ['JP', 'sp.invest.jp', 60, '証券口座'], ['US', 'sp.invest.us', 60, '証券口座']] as const) {
      let found = false
      for (let seed = 1; seed <= 600 && !found; seed++) {
        const s = fixture(country, seed)
        for (let g = 0; g < 12 && s.alive && !found; g++) {
          const plan = planYear(s, screen)
          const d = plan.decision?.decision
          if (d?.id === id) {
            // the dialog's list: the first choice is the purchase, and every label is one he can afford
            expect(d.choices.length).toBeGreaterThanOrEqual(2)
            const before = s.money
            const r = resolveDecision(s, 0, screen)
            expect(before - s.money, `${id} seed ${seed}`).toBe(cost)
            expect(r.events.some((e) => e.entry.text.includes(word)), `${id} log`).toBe(true)
            found = true
            break
          }
          let q = d
          while (q && s.alive) q = resolveDecision(s, q.autoIndex, screen).followUp?.decision
          endYear(s)
        }
      }
      expect(found, `${id}: a decision of it was met`).toBe(true)
    }
  })

  it('the choices on the dialog are all affordable: a poor man is offered only the free one', () => {
    for (const id of ['sp.car.us', 'sp.hobby.us', 'sp.invest.us', 'sp.academy.us']) {
      const s = rich('US', 30)
      s.age = 40
      const q = open(id, s).asked
      expect(q.labels.length, id).toBe(id === 'sp.invest.us' || id === 'sp.hobby.us' ? 2 : 1)
    }
  })

  it('a choice that costs money is never offered to a man who cannot pay it: every costly choice has a condition on the savings', () => {
    const bad: string[] = []
    for (const sp of [...SPENDING_SPECS, ...PUBLIC_SPECS]) {
      for (const ch of sp.choices ?? []) {
        const cost = Math.min(0, ch.effects?.money ?? 0)
        if (cost < 0 && !ch.when) bad.push(sp.id + ' / ' + ch.label)
      }
    }
    expect(bad).toEqual([])
  })

  it('the おまかせ answers leave the same life on the screen as without one: money, family, languages and facts', () => {
    for (const country of ['JP', 'US'] as const) {
      for (let seed = 1; seed <= 8; seed++) {
        const a = fixture(country, seed)
        const b = fixture(country, seed)
        for (let g = 0; g < 10 && a.alive && b.alive; g++) {
          for (const [s, sim] of [[a, headless], [b, screen]] as const) {
            let d = planYear(s, sim).decision?.decision
            while (d && s.alive) d = resolveDecision(s, d.autoIndex, sim).followUp?.decision
          }
          endYear(a)
          endYear(b)
        }
        expect(b.money, `${country} ${seed}`).toBe(a.money)
        expect(b.family).toEqual(a.family)
        expect(b.languages).toEqual(a.languages)
        expect(b.flags).toEqual(a.flags)
        expect(b.age).toBe(a.age)
      }
    }
  })
})

describe('the language rows of the screens', () => {
  it('list only the languages he speaks: his own first, then by level; a language never learned is not shown', () => {
    const s = mk('JP')
    s.age = 30
    expect(languageRows(s).map((r) => r.lang)).toEqual(['ja'])
    s.languages = { ja: 100, en: 40, es: 70, ko: 0 }
    const rows = languageRows(s)
    expect(rows.map((r) => `${r.lang}:${r.band}`)).toEqual(['ja:母語', 'es:仕事ができる', 'en:日常会話'])
    expect(rows.find((r) => r.lang === 'ko')).toBeUndefined()
    s.languages.en = 12
    expect(languageRows(s).find((r) => r.lang === 'en')!.band).toBe('片言')
    s.languages.en = 90
    expect(languageRows(s).find((r) => r.lang === 'en')!.band).toBe('流暢')
  })

  it('read the state without changing it', () => {
    const s = mk('US')
    s.languages = { en: 100, es: 35 }
    const before = JSON.stringify(s)
    languageRows(s)
    languageRows(s)
    expect(JSON.stringify(s)).toBe(before)
    // a life saved before languages: only his own
    const old = mk('JP')
    delete old.languages
    expect(languageRows(old).map((r) => r.label)).toEqual(['日本語'])
  })

  it('the Taiwan language is named for what it is', () => {
    const s = mk('JP')
    s.languages = { ja: 100, zh: 20 }
    expect(languageRows(s).map((r) => r.label)).toContain('台湾華語')
  })
})