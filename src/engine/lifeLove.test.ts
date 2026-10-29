import { describe, expect, it } from 'vitest'
import { createLife, endYear, planYear, resolveDecision, runHeadless, type Sim } from './life.ts'
import { defaultParams } from './params.ts'
import { hashSeed, makeRng } from './rng.ts'
import type { LifeState } from './types.ts'
import { LIFE_PASS_STAGES, stageOf, type EventCtx, weightOf } from './events.ts'
import { LIFE_LOVE_EVENTS, fameOf } from './lifeLoveEvents.ts'

// Everyday life during the playing years (PROJECT_PLAN §11.33): love, marriage, children, divorce, bereavement, a new start, rumours.

const sim: Sim = { params: defaultParams() }
const def = (id: string) => LIFE_LOVE_EVENTS.find((d) => d.id === id)!

interface Trace {
  s: LifeState
  /** decisions of the life pass met while playing */
  asked: { age: number; id: string }[]
  /** the family at the end of every year spent playing */
  playingFamily: { age: number; partner?: string; spouse: boolean; children: number }[]
  log: string[]
}

type Pick = (id: string, n: number, auto: number) => number

function play(seed: number, pick: Pick = (_i, _n, auto) => auto): Trace {
  const s = createLife({ seed, country: 'JP', pace: 'p15' })
  const t: Trace = { s, asked: [], playingFamily: [], log: [] }
  for (let g = 0; g < 130 && s.alive; g++) {
    const plan = planYear(s, sim)
    for (const e of plan.events) {
      s.log.push(e.entry)
      t.log.push(e.entry.text)
    }
    let d = plan.decision?.decision
    while (d && s.alive) {
      if (d.id.startsWith('life.') && LIFE_PASS_STAGES.includes(stageOf(s))) t.asked.push({ age: s.age, id: d.id })
      const r = resolveDecision(s, pick(d.id, d.choices.length, d.autoIndex), sim)
      for (const e of r.events) {
        s.log.push(e.entry)
        t.log.push(e.entry.text)
      }
      d = r.followUp?.decision
    }
    if (LIFE_PASS_STAGES.includes(stageOf(s))) t.playingFamily.push({ age: s.age, partner: s.family.partner, spouse: !!s.family.spouse, children: s.family.children })
    endYear(s)
  }
  return t
}

/** a life that goes on after high school, found by running the seeds headless */
function playersPastHighSchool(n: number, from = 3_100_000): number[] {
  const out: number[] = []
  for (let i = 0; out.length < n && i < 4000; i++) {
    const seed = hashSeed(i + from)
    if (runHeadless({ seed, country: 'JP', pace: 'p15' }, sim, true).career.highestRank >= 5) out.push(seed)
  }
  return out
}

const SEEDS = playersPastHighSchool(200)

describe('everyday life during the playing years', () => {
  const auto = SEEDS.map((seed) => play(seed))

  it('happens: the questions of love and family reach players who answer おまかせ', () => {
    const ids = new Set(auto.flatMap((t) => t.asked.map((a) => a.id)))
    expect(ids.has('life.meet')).toBe(true)
    // about one question every few playing years (an assumption), not every year
    const per = auto.map((t) => t.asked.length / Math.max(1, t.playingFamily.length))
    const mean = per.reduce((a, b) => a + b, 0) / per.length
    expect(mean).toBeGreaterThan(0.05)
    expect(mean).toBeLessThan(0.5)
  })

  it('おまかせ changes no state: nobody has a partner, a spouse or a child while playing', () => {
    for (const t of auto) for (const f of t.playingFamily) expect(f, `seed ${t.s.config.seed} age ${f.age}`).toMatchObject({ partner: undefined, spouse: false, children: 0 })
  })

  it('a screen life that answers おまかせ is the headless life', () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const ui = play(seed).s
      const fast = runHeadless({ seed, country: 'JP', pace: 'p15' }, sim)
      expect(ui.age).toBe(fast.age)
      expect(ui.money).toBe(fast.money)
      expect(ui.lifetimeIncome).toBe(fast.lifetimeIncome)
      expect(ui.career.highestRank).toBe(fast.career.highestRank)
      expect(ui.family).toEqual(fast.family)
    }
  })
})

describe('a chosen love life: dating, marriage, children, no repeats', () => {
  // the player takes the step each time it is offered
  const bold: Pick = (id, _n, auto) => (id === 'life.meet' ? 0 : id === 'life.strain' ? 0 : auto)
  const lives = SEEDS.map((seed) => play(seed, bold))

  it('choices lead from meeting to a partner, a marriage and children', () => {
    expect(lives.some((t) => t.playingFamily.some((f) => f.partner))).toBe(true)
    expect(lives.some((t) => t.playingFamily.some((f) => f.spouse))).toBe(true)
    expect(lives.some((t) => t.playingFamily.some((f) => f.children > 0))).toBe(true)
  })

  it('a marriage is told once, a child is counted once, and nobody is asked to propose to a wife', () => {
    for (const t of lives) {
      const wed = t.log.filter((x) => /さんと結婚しました。/.test(x)).length
      const ends = t.log.filter((x) => /先立たれました|さんと離婚しました/.test(x)).length
      expect(wed, `seed ${t.s.config.seed}`).toBeLessThanOrEqual(1 + ends)
      expect(t.s.family.kids?.length ?? 0).toBe(t.s.family.children)
      // (the line names the child since PROJECT_PLAN §11.61: 「第一子の○○が生まれました」「2人目の子ども、○○が生まれました」)
      const births = t.log.filter((x) => /第一子(の.+)?が生まれました|人目の子ども(、.+)?が生まれました/.test(x)).length
      expect(births, `seed ${t.s.config.seed}`).toBe(t.s.family.children)
      // a spouse at the end is never also a partner
      if (t.s.family.spouse) expect(t.s.family.partner).toBeUndefined()
    }
  })

  it('no question of the life pass is asked twice in the same year', () => {
    for (const t of lives) {
      const seen = new Set<string>()
      for (const a of t.asked) {
        expect(seen.has(`${a.age}.${a.id}`)).toBe(false)
        seen.add(`${a.age}.${a.id}`)
      }
    }
  })
})

function proState(over: (s: LifeState) => void = () => {}): LifeState {
  const s = createLife({ seed: 11, country: 'JP', pace: 'p15' })
  s.career.phase = 'pro'
  s.career.highestRank = 9
  s.career.proSeasons = 6
  s.age = 28
  s.status.relations = 60
  over(s)
  return s
}

function ctxOf(s: LifeState, seed = 1) {
  const log: { kind: string; text: string }[] = []
  const asked: { id: string; n: number; auto: number }[] = []
  const c: EventCtx = {
    s,
    rng: makeRng(seed),
    headless: true,
    add: (kind, text) => log.push({ kind, text }),
    ask: (d) => asked.push({ id: d.id, n: d.choices.length, auto: d.autoIndex }),
    canAsk: () => true,
  }
  return { c, log, asked }
}

describe('the state transitions', () => {
  it('meeting: only a single man, and a second chance after a divorce (a year) or a bereavement (two years)', () => {
    const meet = def('life.meet')
    expect(meet.when!(proState())).toBe(true)
    expect(meet.when!(proState((s) => (s.family.partner = '恵')))).toBe(false)
    expect(meet.when!(proState((s) => (s.family.spouse = { name: '恵', years: 3 })))).toBe(false)
    const divorced = (gap: number) => proState((s) => { s.family.everMarried = true; s.family.ended = 'divorce'; s.family.endedAge = s.age - gap })
    expect(meet.when!(divorced(0))).toBe(false)
    expect(meet.when!(divorced(1))).toBe(true)
    const widowed = (gap: number) => proState((s) => { s.family.everMarried = true; s.family.ended = 'death'; s.family.endedAge = s.age - gap })
    expect(meet.when!(widowed(1))).toBe(false)
    expect(meet.when!(widowed(2))).toBe(true)
  })

  it('the question asks for 食事 or not, and おまかせ is "not now"', () => {
    const { c, asked } = ctxOf(proState())
    def('life.meet').run(c)
    expect(asked[0].auto).toBe(1)
  })

  it('from a partner to a marriage, a child, a divorce and a second marriage', () => {
    const s = proState()
    // meeting (chosen): a partner
    let x = ctxOf(s, 3)
    def('life.meet').run(x.c)
    const name = '真由'
    let tries = 0
    for (; tries < 30 && !s.family.partner; tries++) {
      x = ctxOf(s, tries + 1)
      def('life.meet').resolve!(x.c, 0, { name })
    }
    expect(s.family.partner).toBe(name)
    // the proposal needs two years of dating
    expect(def('life.proposal').when!(s)).toBe(false)
    s.age += 2
    expect(def('life.proposal').when!(s)).toBe(true)
    def('life.proposal').resolve!(ctxOf(s).c, 0, {})
    expect(s.family.spouse?.name).toBe(name)
    expect(s.family.everMarried).toBe(true)
    expect(s.family.partner).toBeUndefined()
    // married: no proposal, no meeting, and a second "結婚しました" cannot be made
    expect(def('life.proposal').when!(s)).toBe(false)
    expect(def('life.meet').when!(s)).toBe(false)
    const before = JSON.stringify(s.family)
    s.family.partner = '別の人'
    const again = ctxOf(s)
    def('life.proposal').resolve!(again.c, 0, {})
    expect(again.log).toEqual([])
    expect(s.family.spouse?.name).toBe(name)
    s.family.partner = undefined
    expect(JSON.stringify(s.family)).toBe(before)
    // a child
    s.family.spouse!.years = 2
    def('life.childTalk').resolve!(ctxOf(s).c, 0, {})
    expect(s.taken).toContain('family.wantKid')
    s.evHist = { 'life.childTalk': [s.age - 1, 1] }
    expect(def('life.birth').when!(s)).toBe(true)
    for (let k = 1; k < 30 && s.family.children === 0; k++) def('life.birth').run(ctxOf(s, k).c)
    expect(s.family.children).toBe(1)
    expect(s.family.kids).toEqual([0])
    expect(s.taken).not.toContain('family.wantKid')
    // a divorce
    def('life.divorce').resolve!(ctxOf(s).c, 1, {})
    expect(s.family.spouse).toBeNull()
    expect(s.family.ended).toBe('divorce')
    expect(s.family.endedAge).toBe(s.age)
    expect(s.family.children).toBe(1)
    expect(s.family.everMarried).toBe(true)
    // a new start: a year later he may meet someone and marry again
    s.age += 1
    expect(def('life.meet').when!(s)).toBe(true)
    s.family.partner = '美奈'
    s.flags = { 'life.dating': s.age - 2 }
    expect(def('life.proposal').when!(s)).toBe(true)
    def('life.proposal').resolve!(ctxOf(s).c, 0, {})
    expect(s.family.spouse?.name).toBe('美奈')
    expect(s.family.ended).toBeUndefined()
  })

  it('the divorce question: a wife is needed, and rebuilding the marriage changes nothing of the state of the marriage', () => {
    const d = def('life.divorce')
    expect(d.when!(proState())).toBe(false)
    const s = proState((x) => (x.family.spouse = { name: '恵', years: 3 }))
    expect(d.when!(s)).toBe(true)
    expect(d.when!(proState((x) => (x.family.spouse = { name: '恵', years: 1 })))).toBe(false)
    d.resolve!(ctxOf(s).c, 0, {})
    expect(s.family.spouse?.name).toBe('恵')
    expect(s.family.ended).toBeUndefined()
    // strained relations make a divorce likelier
    const weak = proState((x) => { x.family.spouse = { name: '恵', years: 3 }; x.status.relations = 30 })
    const strong = proState((x) => { x.family.spouse = { name: '恵', years: 3 }; x.status.relations = 80 })
    expect(weightOf(d, weak)).toBeGreaterThan(weightOf(d, strong))
  })

  it('a bereavement leaves the man able to meet someone again', () => {
    const s = proState((x) => (x.family.spouse = { name: '恵', years: 10 }))
    s.family.spouse = null
    s.family.everMarried = true
    s.family.ended = 'death'
    s.family.endedAge = s.age
    expect(def('life.meet').when!(s)).toBe(false)
    s.age += 2
    expect(def('life.meet').when!(s)).toBe(true)
  })

  it('children need a wife: no wish, no birth, no childhood question for a single man', () => {
    const s = proState()
    expect(def('life.childTalk').when!(s)).toBe(false)
    expect(def('life.birth').when!(s)).toBe(false)
    expect(def('life.parenting').when!(s)).toBe(false)
    const m = proState((x) => { x.family.spouse = { name: '恵', years: 2 }; x.family.children = 1; x.family.kids = [3] })
    expect(def('life.parenting').when!(m)).toBe(true)
  })
})

describe('rumours follow fame', () => {
  const rumor = def('life.rumor')

  it('only a known pro: not in the minors, not at university, not in the company teams', () => {
    expect(fameOf(proState())).toBeGreaterThan(0)
    expect(rumor.when!(proState())).toBe(true)
    expect(rumor.when!(proState((s) => (s.career.highestRank = 7)))).toBe(false)
    expect(rumor.when!(proState((s) => (s.career.phase = 'proMinor')))).toBe(false)
    expect(rumor.when!(proState((s) => (s.career.phase = 'univ')))).toBe(false)
    expect(rumor.when!(proState((s) => (s.career.phase = 'company')))).toBe(false)
    expect(rumor.stages).toEqual(['pro'])
  })

  it('the better known, the likelier; a married man has none', () => {
    const rising = proState((s) => { s.career.highestRank = 8; s.career.proSeasons = 1 })
    const star = proState((s) => { s.career.highestRank = 10; s.career.proSeasons = 12 })
    expect(weightOf(rumor, star)).toBeGreaterThan(weightOf(rumor, rising))
    expect(rumor.when!(proState((s) => (s.family.spouse = { name: '恵', years: 1 })))).toBe(false)
  })

  it('a single man gets a line and no change; a man with a partner is asked how to answer', () => {
    const single = proState()
    const before = JSON.stringify([single.family, single.status, single.money])
    const x = ctxOf(single)
    rumor.run(x.c)
    expect(x.log.length).toBe(1)
    expect(x.asked).toEqual([])
    expect(JSON.stringify([single.family, single.status, single.money])).toBe(before)
    const dating = proState((s) => (s.family.partner = '恵'))
    const y = ctxOf(dating)
    rumor.run(y.c)
    expect(y.asked[0]).toMatchObject({ id: 'life.rumor', n: 3 })
  })
})

describe('the plain family events still hold after retirement', () => {
  it('a man married in the pros is not asked to propose again once he has retired', () => {
    const bold: Pick = (id, _n, auto) => (id === 'life.meet' ? 0 : auto)
    for (const seed of SEEDS) {
      const t = play(seed, bold)
      const wed = t.log.filter((x) => /さんと結婚しました。/.test(x)).length
      const ends = t.log.filter((x) => /先立たれました|さんと離婚しました/.test(x)).length
      expect(wed, `seed ${seed}`).toBeLessThanOrEqual(1 + ends)
    }
  })
})
