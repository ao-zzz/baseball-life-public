import { describe, expect, it } from 'vitest'
import { EVENTS, createLife, endYear, planYear, resolveDecision, type Sim } from './life.ts'
import { defaultParams } from './params.ts'
import { hashSeed, makeRng } from './rng.ts'
import { TRENDS } from './trendLog.ts'
import { hasFamily, hasGrandkids, holdsJob, youngKin } from './events/spec.ts'
import { jobOffers } from './after.ts'
import { hsPrefecture } from './season.ts'
import { PREFECTURES } from '../data/jp.ts'
import { HIGH_SCHOOLS } from '../data/schools/index.ts'
import type { EventCtx } from './events.ts'
import type { CountryCode } from '../data/types.ts'
import type { Decision, LifeState } from './types.ts'

// A line speaks of his family, his children, his grandchildren, his wife or his workplace only when his life has them: a single man
// with no one left is not asked to gather "the family", a childless man is not offered his child's house, a man without a job does not
// hear of his colleagues. The fix is in the words only (the same events, the same draws): the words follow the state.

interface Facts {
  family: boolean
  kids: boolean
  grand: boolean
  spouse: boolean
  job: boolean
}
const facts = (s: LifeState): Facts => ({
  family: hasFamily(s),
  kids: s.family.children > 0,
  grand: hasGrandkids(s),
  spouse: !!s.family.spouse,
  job: holdsJob(s) || s.career.phase === 'company',
})
/** what a line takes for granted, and the fact it needs ("家族や友人", other people's families and a family yet to come name no one of his) */
const RULES: [string, RegExp, (f: Facts) => boolean][] = [
  ['家族', /家族(?!や|連れ|の姿|が増え)/, (f) => f.family],
  ['子ども', /子どもの家|子どもたち[はをにの]|子どもから|子どもの学費|子どもや孫|子や孫|子どもと孫/, (f) => f.kids],
  ['孫', /孫/, (f) => f.grand],
  ['妻', /妻/, (f) => f.spouse],
  ['職場', /職場(?!や)|同僚|会社の補助|会社の定期|通勤|異動|昼休み|午後の会議/, (f) => f.job],
]
const broken = (text: string, ...states: Facts[]) => RULES.filter(([, re, ok]) => re.test(text) && !states.some(ok)).map(([name]) => name)

/** the events whose words follow the family */
const FAMILY_EVENTS = [
  'x.late.driving', 'x.late.hospital', 'x.late.homeMove', 'x.late.letter', 'x.late.letterEcho', 'x.late.celebration', 'x.late.memoirDone',
  'x.life.lastWill', 'x.life.travel', 'x.life.parentsHouse', 'x.life.parentsHouseBack', 'x.life.petAdopt', 'x.life.smoke', 'x.late.retire',
  'senior.endPlan', 'senior.life', 'senior.milestone',
  'sp.trip.jp', 'sp.trip.us', 'sp.trip.kr', 'sp.trip.cu', 'sp.allowance.jp', 'sp.allowance.us', 'sp.allowance.kr', 'sp.allowance.cu', 'sp.fixup.jp', 'cu.daily.blackout',
]
/** the events whose words follow the job */
const WORK_EVENTS = ['nw.sendoff.jp', 'nw.superbowl.us', 'hobby.adult', 'bbl.kusayakyu', 'love.meet', 'x.life.invest', 'x.life.marathon', 'x.life.dock', 'x.life.moveHouse', 'sp.moving.jp', 'sp.moving.us']
const TARGETS = new Set([...FAMILY_EVENTS, ...WORK_EVENTS])

type Kin = 'alone' | 'couple' | 'kids' | 'grand'
type Work = 'work' | 'none' | 'retired'

/** a man of `age` with that family (no parents left; the children 30 and 33 years younger) and that job, living in his country */
function person(age: number, kin: Kin, work: Work, country: CountryCode = 'JP'): LifeState {
  const s = createLife({ seed: 11, country, pace: 'p15' })
  s.age = age
  s.alive = true
  s.career.highestRank = 4
  s.money = 1000
  s.status.health = 70
  const kids = kin === 'kids' || kin === 'grand' ? [Math.max(1, age - 30), Math.max(1, age - 33)] : []
  s.family = { ...s.family, father: null, mother: null, spouse: kin === 'alone' ? null : { name: '恵子', years: 20 }, everMarried: kin !== 'alone', children: kids.length, kids }
  if (kin === 'grand') s.career.achievements.push('孫')
  s.after = {
    edu: 'hs',
    ...(work === 'work' ? { work: { title: '会社員', industry: 'office' as const, employer: 'small' as const, level: 0, years: 5, satisfaction: 50, regular: true, baseball: false } } : {}),
    jobless: work === 'none' ? 1 : 0,
    home: 'rent',
    loan: 0,
    baseballLife: [],
    community: false,
    care: false,
    retired: work === 'retired',
  }
  return s
}

/** every line the event can show for that state: the line, or the question (title, body, choices) and what each answer says */
function shown(id: string, s: LifeState): string[] {
  const def = EVENTS.get(id)!
  const out: string[] = []
  let asked: { d: Decision; data: Record<string, number | boolean | string> } | undefined
  const ctx = (x: LifeState, seed: number): EventCtx => ({
    s: x,
    rng: makeRng(seed),
    headless: false,
    add: (_k, t) => out.push(t),
    ask: (d, data = {}) => {
      asked = { d, data }
    },
    canAsk: () => true,
  })
  for (let seed = 1; seed <= 8; seed++) {
    const x = structuredClone(s)
    // (each of the lines an event uses in turn)
    x.evHist = { ...(x.evHist ?? {}), [id]: [x.age, ((seed - 1) % 4) + 1] }
    asked = undefined
    def.run(ctx(x, seed))
    const q = asked as { d: Decision; data: Record<string, number | boolean | string> } | undefined
    if (!q) continue
    out.push(q.d.title, q.d.body, ...q.d.choices.map((c) => c.label))
    for (let i = 0; i < q.d.choices.length; i++) def.resolve!(ctx(structuredClone(x), seed * 31 + i), i, q.data)
  }
  return out
}

/** the age it is met at: inside its ages (70 without them, the age of 古希) */
const ageOf = (id: string) => {
  const a = EVENTS.get(id)!.ages
  return a ? Math.min(a[1], a[0] + 10) : 70
}
/** the country whose lives meet it (the spending and news of a country are met by those who live there) */
const countryOf = (id: string): CountryCode => (/\.us$/.test(id) ? 'US' : /\.kr$/.test(id) ? 'KR' : /\.cu$|^cu\./.test(id) ? 'CU' : 'JP')

describe('the words follow his family and his job', () => {
  it('each event, for each family and job it can meet, speaks only of what he has', () => {
    const bad: string[] = []
    for (const id of TARGETS) {
      const def = EVENTS.get(id)
      expect(def, id).toBeDefined()
      let met = 0
      for (const kin of ['alone', 'couple', 'kids', 'grand'] as const) {
        for (const work of ['work', 'none', 'retired'] as const) {
          const s = person(ageOf(id), kin, work, countryOf(id))
          // (only a state the event can meet, in a rented home or his own; a follow-up is met whatever its booking was)
          const fits = () => def!.followOnly || !def!.when || def!.when(s)
          if (!fits()) s.after!.home = 'own'
          if (!fits()) continue
          met++
          for (const t of shown(id, s)) for (const name of broken(t, facts(s))) bad.push(`${id} (${kin}, ${work}): ${name}: ${t}`)
        }
      }
      expect(met, `${id} is checked in some state`).toBeGreaterThan(0)
    }
    expect(bad).toEqual([])
  })

  it('with the family or the job, the lines still say so', () => {
    const has = (id: string, s: LifeState, re: RegExp) => expect(shown(id, s).some((t) => re.test(t)), `${id}: ${re}`).toBe(true)
    has('x.late.hospital', person(90, 'kids', 'retired'), /子どもの家の一室/)
    has('x.late.homeMove', person(90, 'kids', 'retired'), /子どもの家の近く/)
    has('x.late.letterEcho', person(90, 'kids', 'retired'), /子どもから電話/)
    has('x.late.driving', person(85, 'couple', 'retired'), /家族から/)
    has('x.life.lastWill', person(78, 'grand', 'retired'), /子や孫を前に/)
    has('x.life.lastWill', person(78, 'alone', 'retired'), /親しい友人たちを前に/)
    has('senior.milestone', person(70, 'grand', 'retired'), /子どもや孫に祝って/)
    has('senior.milestone', person(70, 'kids', 'retired'), /子どもたちに祝って/)
    has('senior.endPlan', person(80, 'couple', 'retired'), /家族に話しておく/)
    has('sp.trip.jp', person(34, 'kids', 'work'), /子どもたちは眠って/)
    has('sp.trip.jp', person(34, 'couple', 'work'), /妻は助手席で眠って/)
    has('nw.sendoff.jp', person(28, 'alone', 'work'), /異動する人/)
    has('love.meet', person(31, 'alone', 'work'), /職場で/)
    // (a question written when the year is planned says nothing of a job he may lose later in that year: the same words with or without one)
    has('x.life.invest', person(38, 'alone', 'work'), /知人から/)
    has('x.life.dock', person(50, 'alone', 'work'), /健康保険の補助/)
    has('bbl.kusayakyu', person(32, 'alone', 'work'), /昔の野球仲間/)
  })

  it('questions about money, health, care and time read right whether he still has his job, never had one or has retired', () => {
    // the question (title, body, choices, hints): the same for all of them; it may be shown after he lost the job earlier in the same year
    const question = (id: string, s: LifeState): string[] => {
      let q: Decision | undefined
      EVENTS.get(id)!.run({ s: structuredClone(s), rng: makeRng(1), headless: false, add: () => {}, ask: (d) => void (q = d), canAsk: () => true })
      const d = q as Decision | undefined
      return d ? [d.title, d.body, ...d.choices.flatMap((c) => [c.label, c.hint ?? ''])] : []
    }
    const WORKPLACE = /職場|同僚|会社の補助|ボーナス|働きながら|仕事と家|仕事を理由|仕事を調整|仕事を辞めて|仕事を休んで|時短勤務|今の仕事|野球と仕事|練習と仕事|休みの日に副業|給与/
    const ids = ['bbl.kusayakyu', 'x.life.invest', 'x.life.dock', 'x.life.savings', 'x.life.marathon', 'x.life.hobby', 'x.life.neighbors', 'x.after.parentCare', 'x.life.careLeave', 'after.learn', 'x.life.loanChoice', 'after.club', 'sp.course.jp', 'sp.hobby.jp', 'her.study.jp', 'money.tight', 'health.illness']
    for (const id of ids) {
      expect(EVENTS.get(id), id).toBeDefined()
      for (const work of ['work', 'none', 'retired'] as const) {
        const s = person(45, 'couple', work)
        s.money = work === 'none' ? -10 : 300
        const q = question(id, s)
        expect(q.length, `${id} asks`).toBeGreaterThan(0)
        for (const t of q) expect(t, `${id} (${work})`).not.toMatch(WORKPLACE)
        // the answers are written when he answers: without a job, none of them speaks of one
        if (work !== 'work') for (const t of shown(id, s)) expect(t, `${id} (${work})`).not.toMatch(WORKPLACE)
      }
    }
    // with the job, the answers still say so
    expect(shown('x.life.careLeave', person(50, 'couple', 'work')).some((t) => t.includes('退職届を出した日'))).toBe(true)
    expect(shown('x.after.parentCare', person(50, 'couple', 'work')).some((t) => t.includes('休暇を取り'))).toBe(true)
  })

  it('the other lines found: a boy is not yet a grown-up, the family business, the relatives, a widower, an older save', () => {
    // the window broken as a boy, told again at 14 (not a grown-up, no boss) and at 25 with a job (as before)
    const boy = person(14, 'alone', 'none')
    boy.flags = { 'kid.honest': 10 }
    const hid = person(14, 'alone', 'none')
    hid.flags = { 'kid.hid': 10 }
    for (const s of [boy, hid]) expect(shown('x.kid.honestBack', s).join('')).not.toMatch(/大人になってから|上司/)
    const man = person(25, 'alone', 'work')
    man.flags = { 'kid.honest': 10 }
    expect(shown('x.kid.honestBack', man).some((t) => t.includes('大人になってからも') && t.includes('上司や仲間'))).toBe(true)
    // the family business: inherited from living parents with the family, or started again alone after them
    const offer = (s: LifeState) => jobOffers(s, () => 0).find((o) => o.key === 'family')!
    const heir = person(40, 'alone', 'none')
    heir.person.wealth = 5
    expect(offer(heir)).toMatchObject({ label: '親が営んでいた家業を、自分で再開する', hint: '一人で切り盛りする' })
    heir.family.father = 70
    expect(offer(heir)).toMatchObject({ label: '実家の家業を継ぐ', hint: '家族と働く' })
    // the long-life party: relatives only with a family of his own
    expect(shown('x.late.celebration', person(98, 'alone', 'retired')).join('')).not.toMatch(/親戚/)
    expect(shown('x.late.celebration', person(98, 'kids', 'retired')).some((t) => t.includes('親戚と遠くの旧友'))).toBe(true)
    // money for the family: "our old age" is not a widower's
    expect(shown('sp.allowance.jp', person(65, 'kids', 'retired')).join('')).not.toMatch(/自分たち/)
    // an older save: children without the list of their ages are still children
    const old = person(70, 'kids', 'retired')
    old.family.kids = undefined
    expect(youngKin(old)).toBe('子ども')
    expect(shown('senior.milestone', old).some((t) => t.includes('子どもたちに祝って'))).toBe(true)
    const older = person(92, 'kids', 'retired')
    older.family.kids = undefined
    expect(shown('x.late.letter', older).some((t) => t.includes('子どもたちのそれぞれに'))).toBe(true)
    expect(shown('x.life.lastWill', { ...older, age: 78 }).some((t) => t.includes('子どもたちを前に'))).toBe(true)
  })

  it('the care of the grandchildren is asked only of a man the life records with grandchildren', () => {
    const when = EVENTS.get('x.life.grandRole')!.when!
    const s = person(70, 'kids', 'retired')
    expect(s.family.kids!.some((k) => k >= 25)).toBe(true)
    expect(when(s)).toBe(false)
    s.career.achievements.push('孫')
    expect(when(s)).toBe(true)
  })

  it('a question about the job is never shown once the job has ended earlier in the year (the first of the year too)', () => {
    const sim: Sim = { params: defaultParams() }
    let stale = 0
    let jobQuestions = 0
    for (let i = 0; i < 160; i++) {
      const seed = hashSeed(i + 8_400_000)
      const s = createLife({ seed, country: 'JP', pace: 'p15' })
      let step = 0
      for (let g = 0; g < 130 && s.alive; g++) {
        const plan = planYear(s, sim)
        let d = plan.decision?.decision
        while (d && s.alive) {
          const req = EVENTS.get(d.id)?.requires
          if (req) {
            jobQuestions++
            if (!req(s)) stale++
          }
          d = resolveDecision(s, i % 2 && !d.stop ? hashSeed(seed ^ ++step) % d.choices.length : d.autoIndex, sim).followUp?.decision
        }
        endYear(s)
      }
    }
    expect(stale).toBe(0)
    expect(jobQuestions).toBeGreaterThan(100)
  }, 60_000)

  it('leaving the job to care for a parent leaves it, and the search for a new one waits while that parent lives', () => {
    const s = person(55, 'couple', 'work')
    s.family.mother = 82
    s.after!.care = true
    const def = EVENTS.get('x.life.careLeave')!
    const lines: string[] = []
    let q: { d: Decision; data: Record<string, number | boolean | string> } | undefined
    const c: EventCtx = { s, rng: makeRng(3), headless: false, add: (_k, t) => lines.push(t), ask: (d, data = {}) => void (q = { d, data }), canAsk: () => true }
    def.run(c)
    def.resolve!(c, 0, q!.data)
    expect(holdsJob(s)).toBe(false)
    expect(s.job).toBe('')
    expect(lines.join('')).toContain('退職届を出した日')
    const search = EVENTS.get('work.search')!.when!
    s.taken.push('work.started')
    expect(search(s)).toBe(false)
    s.family.mother = null
    expect(search(s)).toBe(true)
    // (without a job, the same answer leaves none: the line says so)
    const free = person(55, 'couple', 'none')
    free.family.mother = 82
    expect(shown('x.life.careLeave', free).join('')).not.toMatch(/退職届|上司|会社/)
  })

  it('a brother only for a man who has one; the parents, the school and the away games only when they are there', () => {
    const SIBLING = /きょうだい|兄弟|弟/
    for (const id of ['parents.care', 'x.after.parentCare', 'x.life.careLeave']) {
      const s = person(55, 'couple', 'work')
      s.family.mother = 82
      expect(shown(id, s).join(''), id).not.toMatch(SIBLING)
      s.evHist = { 'x.life.siblings': [10, 1] }
      expect(shown(id, s).some((x) => x.includes('弟')), id).toBe(true)
    }
    // the car: the away games only for a player
    const player = person(25, 'alone', 'none')
    player.career.phase = 'pro'
    expect(shown('sp.car.jp', player).join('')).toContain('遠征')
    expect(shown('sp.car.jp', person(45, 'couple', 'work')).join('')).not.toContain('遠征')
    // the PTA only while a child is of school age
    const young = person(45, 'kids', 'work')
    young.family.kids = [10]
    expect(shown('community.role', young).join('')).toContain('PTA')
    expect(shown('community.role', person(65, 'kids', 'retired')).join('')).not.toContain('PTA')
    // 定年, 再雇用 and the boss are an employee's
    const owner = person(62, 'couple', 'work')
    owner.after!.work!.employer = 'self'
    expect(EVENTS.get('x.late.retire')!.when!(owner)).toBe(false)
    const shopkeeper = person(50, 'couple', 'work')
    shopkeeper.after!.work!.employer = 'self'
    expect(shown('x.life.midlife', shopkeeper).join('')).not.toMatch(/定年|上司|退職願/)
    expect(shown('x.life.midlife', person(50, 'couple', 'work')).join('')).not.toMatch(/退職願/)
  })

  it('the summer tournament is the one of the prefecture of his high school', () => {
    const born = PREFECTURES.findIndex((p) => p.name === '東京都')
    const school = HIGH_SCHOOLS.find((x) => x.pref === '鳥取県')!
    const s = person(16, 'alone', 'none')
    s.person.prefecture = born
    expect(hsPrefecture(s)).toBe(born)
    s.schools = { hs: { id: school.id, name: school.name, method: 'general' } }
    expect(PREFECTURES[hsPrefecture(s)].name).toBe('鳥取県')
  })

  it('a US life meets grandchildren only once its life records one', () => {
    const s = person(70, 'kids', 'retired', 'US')
    const noGrand = shown('us.familyVisit', s).join('') + shown('us.retireMove', s).join('')
    expect(noGrand).not.toContain('孫')
    const t = structuredClone(s)
    EVENTS.get('us.grandchild')!.run({ s: t, rng: makeRng(1), headless: false, add: () => {}, ask: () => {}, canAsk: () => true })
    expect(hasGrandkids(t)).toBe(true)
    expect(shown('us.familyVisit', t).join('')).toContain('孫')
  })

  it('the four lines reviewed: the ballpark kept for a player, no relative or new person taken for granted, two answers that read apart', () => {
    // the move: the ballpark stays in the choice; a player and a worker commute, the others are near the station
    const player = person(25, 'alone', 'none')
    player.career.phase = 'pro'
    for (const s of [player, person(30, 'alone', 'work'), person(30, 'alone', 'none')]) expect(shown('sp.moving.jp', s).some((t) => t.includes('球場'))).toBe(true)
    expect(shown('sp.moving.jp', player).some((t) => t.includes('通勤の時間が短く'))).toBe(true)
    expect(shown('sp.moving.jp', person(30, 'alone', 'none')).some((t) => t.includes('駅が近くなり'))).toBe(true)
    // after the hospital: without children, no relative's house; with them, the child's
    for (const kin of ['alone', 'couple'] as const) expect(shown('x.late.hospital', person(90, kin, 'retired')).join('')).not.toMatch(/親戚|身内|子ども/)
    expect(shown('x.late.hospital', person(90, 'kids', 'retired')).some((t) => t.includes('子どもの家の一室'))).toBe(true)
    // the talk about the home: without children, no relative; with them, the child's house as before
    for (const kin of ['alone', 'couple'] as const) {
      const t = shown('x.late.homeMove', person(90, kin, 'retired')).join('')
      expect(t).not.toMatch(/親戚|身内|子ども/)
      expect(t).toContain('段差の少ない')
    }
    const withKids = shown('x.late.homeMove', person(90, 'kids', 'retired'))
    expect(withKids).toContain('階段の上り下りがつらくなり、家族から、子どもの家の近くに移らないかと勧められました。')
    expect(withKids).toContain('長年住んだ家を手放し、子どもの家に近い小さな家へ引っ越しました。')
    // the farewell season without a workplace (a player, a student, a retired man): no party he goes to, no one in particular
    const univ = person(20, 'alone', 'none')
    univ.career.phase = 'univ'
    for (const s of [player, univ, person(70, 'alone', 'retired')]) {
      const t = shown('nw.sendoff.jp', s).join('')
      expect(t).toContain('送別会が開かれる季節')
      expect(t).not.toMatch(/異動|居酒屋|一家|集会所/)
    }
    // the blackout, alone: the answer that stays indoors does not read like the one that goes out to the neighbours
    const alone = person(50, 'alone', 'none', 'CU')
    const out = shown('cu.daily.blackout', alone)
    const indoors = out.find((t) => t.includes('ランプをともし'))
    expect(indoors).toBeDefined()
    expect(indoors).not.toMatch(/近所|隣/)
    expect(out.some((t) => t.includes('路地に椅子を並べ'))).toBe(true)
  })

  it('the short lines of the trends do not take a workplace or a family for granted', () => {
    const bad = TRENDS.filter((t) => !t.when && t.ages[1] >= 24 && /職場|同僚|通勤|午後の会議|家族の恒例/.test(t.text)).map((t) => t.text)
    expect(bad).toEqual([])
  })

  it('in lives played as on screen (おまかせ, and other answers), these events never speak of a family, children or a job he does not have', () => {
    const sim: Sim = { params: defaultParams() }
    const bad: string[] = []
    let checked = 0
    const play = (cc: CountryCode, seed: number, random: boolean) => {
      const s = createLife({ seed, country: cc, pace: 'p15' })
      let step = 0
      const pick = (d: Decision) => (random && !d.stop ? hashSeed(seed ^ ++step) % d.choices.length : d.autoIndex)
      const look = (id: string | undefined, text: string, a: Facts, b: Facts) => {
        if (!id || !TARGETS.has(id)) return
        checked++
        // (against the state before and after the step that wrote it: a question written early in the year he retired may still speak
        // of the job when it is asked after that)
        for (const name of broken(text, a, b)) bad.push(`${cc} ${seed} ${id} at ${s.age}: ${name}: ${text}`)
      }
      for (let g = 0; g < 130 && s.alive; g++) {
        const f0 = facts(s)
        const plan = planYear(s, sim)
        const f1 = facts(s)
        for (const e of plan.events) look(e.entry.eventId, e.entry.text, f0, f1)
        let d = plan.decision?.decision
        // (the year's questions are written during the year's plan, or during the answer before them)
        let from = f0
        let now = f1
        while (d && s.alive) {
          for (const t of [d.title, d.body, ...d.choices.map((c) => c.label)]) look(d.id, t, from, now)
          const r = resolveDecision(s, pick(d), sim)
          const f2 = facts(s)
          for (const e of r.events) look(e.entry.eventId ?? d.id, e.entry.text, now, f2)
          from = f0
          now = f2
          d = r.followUp?.decision
        }
        endYear(s)
      }
    }
    for (let i = 0; i < 100; i++) play('JP', hashSeed(i + 8_100_000), false)
    for (let i = 0; i < 100; i++) play('JP', hashSeed(i + 8_200_000), true)
    for (const cc of ['US', 'KR', 'CU'] as const) for (let i = 0; i < 25; i++) play(cc, hashSeed(i + 8_300_000), true)
    expect(bad).toEqual([])
    // (the check means something only if these lines come often)
    expect(checked).toBeGreaterThan(1000)
  }, 120_000)
})
