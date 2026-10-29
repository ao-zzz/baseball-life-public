import type { EventCtx, EventDef, EventStage } from '../events.ts'
import type { CountryCode } from '../../data/types.ts'
import type { CareerKind, LifeState, LogKind, Position, SkillKey } from '../types.ts'
import { loseWork } from '../after.ts'
import { addFame, scalePay, startCareer } from '../careers.ts'
import { clamp } from '../math.ts'
import { careerHooks } from './hooks.ts'
import { bestPosition } from '../ability.ts'
import { applyPot, type PotEffect } from '../potential.ts'
import { resolveLang, studyLang, type Lang } from '../language.ts'
import { livingPlace, moveAway, moveUnknown } from '../place.ts'

/** where he lives now, for an outcome's text after a move (place.ts) */
export const placeWords = (s: LifeState): string => livingPlace(s) ?? '新しい町'

// Declarative events (PROJECT_PLAN §11.10, E0). An event is its conditions, its choices (each with a
// different effect), its outcomes (drawn by weight, each with a different effect or follow-up) and the
// follow-ups it books for later years. `compileSpec` turns it into an ordinary EventDef, so the existing
// scheduler (draw, cooldown, per-life limit, one category a year, the decision queue, the screen and the
// headless runs) handles it unchanged. `validateSpecs` rejects padding: choices or outcomes that differ
// only in wording, repeated or near-repeated texts, follow-ups that lead nowhere.

/** what an outcome changes; the vocabulary is closed so that tests can compare effects */
export interface Effect {
  /** 監督の評価, 自信, 疲労 (baseball details; ignored without them) */
  eval?: number
  conf?: number
  fatigue?: number
  /** the skill profile (what the player is good at); does not move the overall ability */
  skill?: Partial<Record<SkillKey, number>>
  happy?: number
  rel?: number
  know?: number
  /** 万円 */
  money?: number
  /** job satisfaction (only with a job) */
  sat?: number
  flag?: string | string[]
  unflag?: string | string[]
  // ---- these move the calibrated career or the death rate: in playing stages only with `career: true`
  /** growth of the overall ability this year (bb.gain) */
  gain?: number
  health?: number
  /** years out injured */
  injury?: number
  /** the player becomes captain / vice-captain (also written to the achievements) */
  captain?: 'captain' | 'vice'
  /** the post at his job (0 一般 … 4), only with a job */
  level?: number
  /** moves to another real team of the same kind (life.ts careerHooks.moveTeam) */
  moveTeam?: boolean
  /** ends the playing career (life.ts careerHooks.retire) */
  retire?: boolean
  /**
   * changes the position he plays (the fit of his body and skills to it changes with it); 'best' = the one they suit most;
   * 'otherField' = the other field position (内野 ↔ 外野; a pitcher or a catcher stays where he is): a move the text names
   * (PROJECT_PLAN §11.65: a move to the outfield must not make him a pitcher because his body suits that best)
   */
  position?: Position | 'best' | 'otherField'
  /** the potential mode's hidden talent and how it develops (potential.ts); ignored in the normal mode */
  pot?: PotEffect
  /** a home: where he lives from now (a house bought, a new rental) and the loan taken for it (万円; needs his own household, from 18) */
  home?: 'own' | 'rent'
  loan?: number
  /** study of a language: [language, strength 0..100]; a share of what is left, once a year per language (language.ts studyLang). 'local': the language of the country he lives in; 'heritage': his second background's; 'focus': the local one when he lives away from his own country, else the heritage one */
  lang?: [Lang | 'local' | 'heritage' | 'focus', number]
  /** 'end': the dating relationship ends (family.partner); nothing when he dates nobody */
  partner?: 'end'
  /**
   * 'quit': he leaves the job he holds after baseball (careerHooks.quitJob; nothing without one); the flag 'job.quit' marks the age.
   * 'change': he moves to another company for the same work (careerHooks.changeJob; nothing without a job)
   */
  job?: 'quit' | 'change' | 'retire'
  /** how widely he is known moves (careers.ts fameOf, 0–100) */
  fame?: number
  /** he starts one of the careers of careers.ts (the job he held ends: its allowance) */
  career?: CareerKind
  /** a career's own pay grows or falls by this factor (careers.ts scalePay; nothing for a job without its own pay) */
  payScale?: number
  /** the title of the job he holds becomes this (an office won: 市長, 知事, 大臣; nothing without a job) */
  title?: string
  /** an office or a title he now holds, kept with the achievements (shown on the result screen; e.g. an election won) */
  achieve?: string
  /**
   * he moves house to another place (place.ts; shown only): 'far' another region, 'rural' a prefecture outside the large cities (the
   * outcome's text can name it: it is set before the text is written), 'unknown' a place the model does not know (near a child)
   */
  move?: 'far' | 'rural' | 'unknown'
}

/** effects that change calibrated checks (ability, injuries, the position) or mortality (health) */
export const PROTECTED_EFFECTS = ['gain', 'health', 'injury', 'position'] as const

/**
 * What an extra event may do on the おまかせ path (the おまかせ choice, a happening, and what follows from
 * them): only flags. Everything else feeds a calibrated check (the skill profile too: it changes the games'
 * results, which move confidence and the coach's view, which move the squad and the Koshien chance), the
 * 50-year marriage share, money or mortality; keeping the おまかせ path neutral leaves the calibrated lives
 * as they were, while the other choices carry the real trade-offs (PROJECT_PLAN §11.12).
 */
export const NEUTRAL_FORBIDDEN = ['gain', 'health', 'injury', 'conf', 'eval', 'fatigue', 'rel', 'know', 'money', 'happy', 'sat', 'captain', 'skill', 'level', 'moveTeam', 'retire', 'position', 'pot', 'partner', 'job', 'achieve', 'fame', 'career', 'payScale', 'title'] as const
export const PLAYING_STAGES: EventStage[] = ['youth', 'jhs', 'hs', 'univ', 'amateur', 'pro']

export interface FollowSpec {
  /** a followOnly event */
  id: string
  /** years from now (1 = next year) */
  after: number
  /** how long it may wait for its conditions (default 2 years) */
  within?: number
}

type Text = string | ((s: LifeState) => string)

export interface OutcomeSpec {
  weight?: number | ((s: LifeState) => number)
  when?: (s: LifeState) => boolean
  text: Text
  kind?: LogKind
  key?: boolean
  effects?: Effect
  follow?: FollowSpec[]
  statIds?: string[]
}

export interface ChoiceSpec {
  label: string
  hint?: string
  /** facts set when this choice is taken (whatever the outcome) */
  flag?: string | string[]
  /** follow-ups booked when this choice is taken (whatever the outcome) */
  follow?: FollowSpec[]
  /** shown only when this holds */
  when?: (s: LifeState) => boolean
  /** applied on choosing, before the outcome */
  effects?: Effect
  outcomes: OutcomeSpec[]
}

export interface EventSpec {
  id: string
  category: string
  /** the country whose lives meet it (default JP) */
  country?: CountryCode
  /** daily life of the country he LIVES in, whatever country he was born in (events.ts EventDef.lives): replaces `country` */
  lives?: CountryCode
  /** the everyday subject (events.ts THEME_BY_CATEGORY); one event of a subject a year across the tables */
  theme?: string
  stages: EventStage[]
  ages?: [number, number]
  when?: (s: LifeState) => boolean
  /** what must still hold when its question, waiting behind another of the year, comes to be asked (EventDef.requires) */
  requires?: (s: LifeState) => boolean
  weight?: number | ((s: LifeState) => number)
  cooldown?: number
  maxPerLife?: number
  priority?: boolean
  followOnly?: boolean
  /** drawn in the extra pass (events.ts runExtraEvents) with the neutral おまかせ path */
  extra?: boolean
  /** can only happen after the player's own (not おまかせ) choice */
  needsChoice?: boolean
  /** only in the potential mode (a life with pot); the normal mode never meets it */
  potentialOnly?: boolean
  /** declares that the event may move the calibrated career or mortality (needs the approval of PROJECT_PLAN §11.10) */
  career?: boolean
  /** a decision: title, body and choices; without choices the event just happens (one of `outcomes`) */
  title?: string
  body?: Text
  decision?: 'major' | 'minor'
  choices?: ChoiceSpec[]
  /** おまかせ: index into `choices` */
  auto?: number | ((s: LifeState) => number)
  factText?: string
  factStatIds?: string[]
  outcomes?: OutcomeSpec[]
}

const textOf = (t: Text, s: LifeState) => (typeof t === 'function' ? t(s) : t)
const list = (x: string | string[] | undefined) => (x === undefined ? [] : Array.isArray(x) ? x : [x])

/**
 * A choice between study and the rest (practice, rest, work) says what it moves (PROJECT_PLAN §11.61): only a choice that moves the
 * knowledge (知識, which sets the 偏差値 of the exams) gets the list, with what it costs elsewhere. The same numbers as `effects`.
 */
export function studyWords(e: Effect | undefined): string {
  if (!e || !e.know) return ''
  const n = (v: number) => `${v > 0 ? '+' : '−'}${Math.abs(v)}`
  const out = [`知識${n(e.know)}`]
  if (e.gain) out.push(e.gain > 0 ? '野球の伸び↑' : '野球の伸び↓')
  if (e.eval) out.push(`監督の評価${n(e.eval)}`)
  if (e.fatigue) out.push(`疲労${n(e.fatigue)}`)
  if (e.health) out.push(`健康${n(e.health)}`)
  if (e.money) out.push(`お金${n(e.money)}万円`)
  return out.join('・')
}
const withStudy = (hint: string | undefined, e: Effect | undefined): string | undefined => {
  const w = studyWords(e)
  return w ? (hint ? `${hint}（${w}）` : w) : hint
}

/** the position an effect `position` leads to (Effect.position) */
export function positionAfter(now: Position, to: NonNullable<Effect['position']>, s: LifeState): Position {
  if (to === 'best') return bestPosition(s).pos
  if (to === 'otherField') return now === 'IF' ? 'OF' : now === 'OF' ? 'IF' : now
  return to
}

/** he has grandchildren: the achievement 孫 (afterEvents family.grandchild, only from a child of 26 or more; PROJECT_PLAN §11.62) */
export function hasGrandkids(s: LifeState): boolean {
  return s.career.achievements.includes('孫')
}
/** who of the young people around him: a grandchild, else a child, else a young neighbour (never a grandchild he does not have) */
export function youngKin(s: LifeState): string {
  // (the number of children: an older save may have children without the list of their ages)
  return hasGrandkids(s) ? '孫' : s.family.children > 0 ? '子ども' : '近所の若い人'
}

/** he has a job now (after baseball; not retired): the condition of every line that speaks of his work */
export function holdsJob(s: LifeState): boolean {
  return !!s.after?.work && !s.after.retired
}

// The kinds of work a line may speak of (2026-10-24: a shop owner was shown as 課長, and company lines kept coming after a lay-off):
// a line about a boss, colleagues, a promotion or a transfer needs an employer, not merely a job.
/** he works for someone (a company, the public service, a club), not for himself */
export const employed = (s: LifeState): boolean => holdsJob(s) && s.after!.work!.employer !== 'self'
/** he runs his own business (a shop, the family business, a company he founded, freelance work) */
export const selfEmployed = (s: LifeState): boolean => holdsJob(s) && s.after!.work!.employer === 'self'
/** a regular post at a company (the posts 主任…部長, the company's exams and transfers) */
export const companyJob = (s: LifeState): boolean => employed(s) && s.after!.work!.regular && ['large', 'small'].includes(s.after!.work!.employer)
/** he has held this job for n years or more */
export const tenure = (s: LifeState, n: number): boolean => holdsJob(s) && s.after!.work!.years >= n
/**
 * he still holds the job he held when the flag was set (a follow-up about "this job": a later job is not it); a job without its
 * age of hiring (an older save) counts as the same
 */
export function sameJobSince(s: LifeState, flag: string): boolean {
  const at = s.flags?.[flag]
  const since = s.after?.work?.since
  return holdsJob(s) && (at === undefined || since === undefined || since <= at)
}
/** the job he held last, when he holds none now (a line about the past names it as the past: 「以前勤めていた〜」) */
export const formerJob = (s: LifeState): string | undefined => (holdsJob(s) ? undefined : s.after?.pastJobs?.at(-1)?.title)

/**
 * he has a brother: the model keeps no brothers or sisters, except the younger brother a boy meets in a story of his own
 * (lifeStories x.life.siblings); a line about a brother or a sister is for him only
 */
export function hasSibling(s: LifeState): boolean {
  return s.evHist?.['x.life.siblings'] !== undefined
}

/** someone of his own family is there: a wife, a child or a parent (the model has no brothers or sisters): the condition of a line that speaks of "家族" */
export function hasFamily(s: LifeState): boolean {
  return !!s.family.spouse || s.family.children > 0 || s.family.father !== null || s.family.mother !== null
}

export function hasFlag(s: LifeState, f: string): boolean {
  return s.flags?.[f] !== undefined
}

/** years since a flag was set (Infinity when it never was) */
export function flagAge(s: LifeState, f: string): number {
  const a = s.flags?.[f]
  return a === undefined ? Infinity : s.age - a
}

export function applyEffect(s: LifeState, e: Effect | undefined): void {
  if (!e) return
  const b = s.bb
  if (b) {
    if (e.eval) b.coachEval = clamp(b.coachEval + e.eval, 0, 100)
    if (e.conf) b.confidence = clamp(b.confidence + e.conf, 0, 100)
    if (e.fatigue) b.fatigue = clamp(b.fatigue + e.fatigue, 0, 100)
    if (e.gain) b.gain += e.gain
    if (e.skill) for (const [k, v] of Object.entries(e.skill) as [SkillKey, number][]) b.skills[k] += v
  }
  const st = s.status
  if (e.happy) st.happiness = clamp(st.happiness + e.happy, 5, 100)
  if (e.rel) st.relations = clamp(st.relations + e.rel, 5, 100)
  if (e.know) st.knowledge = clamp(st.knowledge + e.know, 1, 99)
  if (e.health) st.health = clamp(st.health + e.health, 5, 100)
  // (a minor's own savings do not move: the household is the parents')
  if (e.money && s.age >= 18) s.money += e.money
  const w = s.after?.work
  if (e.sat && w) w.satisfaction = clamp(w.satisfaction + e.sat, 0, 100)
  if (e.injury) s.career.injured = Math.max(s.career.injured, e.injury)
  // (a post is a company's or the public service's: a shop owner, freelance or part-time work has none)
  if (e.level && w && employed(s) && w.regular) w.level = clamp(w.level + e.level, 0, 4)
  if (e.fame) addFame(s, e.fame)
  if (e.career) startCareer(s, e.career)
  if (e.payScale) scalePay(s, e.payScale)
  if (e.title && w && holdsJob(s)) {
    w.title = e.title
    s.job = e.title
  }
  if (e.position) s.person.position = positionAfter(s.person.position, e.position, s)
  if (e.moveTeam) careerHooks.moveTeam(s)
  if (e.retire) careerHooks.retire(s)
  if (e.pot) applyPot(s, e.pot)
  if (e.lang) studyLang(s, resolveLang(s, e.lang[0]), e.lang[1])
  if (s.after) {
    if (e.home) s.after.home = e.home
    if (e.loan) s.after.loan += e.loan
  }
  if (e.captain && b) {
    b.captain = e.captain
    const label = e.captain === 'captain' ? '主将' : '副主将'
    if (!s.career.achievements.includes(label)) s.career.achievements.push(label)
  }
  for (const f of list(e.flag)) (s.flags ??= {})[f] = s.age
  for (const f of list(e.unflag)) if (s.flags) delete s.flags[f]
  // the dating relationship ends (the same state as the life pass writes on a breakup: lifeLoveEvents.ts life.strain)
  if (e.partner === 'end' && s.family.partner) {
    s.family.partner = undefined
    if (s.flags) delete s.flags['life.dating']
  }
  if (e.job === 'quit' && holdsJob(s)) careerHooks.quitJob(s)
  if (e.job === 'change' && holdsJob(s)) careerHooks.changeJob(s)
  // (he leaves working for good: the allowance, no job, and no search for one)
  if (e.job === 'retire' && holdsJob(s)) {
    loseWork(s)
    s.after!.retired = true
  }
  if (e.achieve && !s.career.achievements.includes(e.achieve)) s.career.achievements.push(e.achieve)
  if (e.move === 'unknown') moveUnknown(s)
  else if (e.move) moveAway(s, e.move, e.move === 'far' ? 0x71 : 0x72)
}

function book(s: LifeState, from: string, follow: FollowSpec[] | undefined) {
  for (const f of follow ?? []) (s.due ??= []).push({ id: f.id, age: s.age + f.after, until: s.age + f.after + (f.within ?? 2), from })
}

function weightOfOutcome(o: OutcomeSpec, s: LifeState): number {
  return typeof o.weight === 'function' ? o.weight(s) : (o.weight ?? 1)
}

/** draw one outcome among those whose conditions hold (the first one if none does) and apply it */
function happen(c: EventCtx, spec: EventSpec, outcomes: OutcomeSpec[]) {
  const s = c.s
  const open = outcomes.filter((o) => (!o.when || o.when(s)) && weightOfOutcome(o, s) > 0)
  const from = open.length ? open : outcomes.slice(0, 1)
  const o = from.length === 1 ? from[0] : c.rng.weighted(from, from.map((x) => weightOfOutcome(x, s)))
  applyEffect(s, o.effects)
  book(s, spec.id, o.follow)
  c.add(o.kind ?? (spec.choices ? 'decision' : 'normal'), textOf(o.text, s), { key: o.key, statIds: o.statIds })
}

/**
 * A question is a choice: one whose conditions on the choices (a price he cannot pay, an age) leave a single answer is not asked at
 * all (it would show one button; feedback 「食事の管理」). Only events with a condition on a choice are concerned.
 */
function choicesOpen(spec: EventSpec): ((s: LifeState) => boolean) | undefined {
  const choices = spec.choices
  if (!choices || !choices.some((ch) => ch.when)) return undefined
  return (s) => {
    let n = 0
    for (const ch of choices) if (!ch.when || ch.when(s)) n++
    return n >= 2
  }
}

export function compileSpec(spec: EventSpec): EventDef {
  const open2 = choicesOpen(spec)
  const base = spec.potentialOnly ? (s: LifeState) => !!s.pot && (!spec.when || spec.when(s)) : spec.when
  const def: EventDef = {
    id: spec.id,
    category: spec.category,
    ...(spec.country ? { country: spec.country } : {}),
    ...(spec.lives ? { lives: spec.lives } : {}),
    ...(spec.theme ? { theme: spec.theme } : {}),
    stages: spec.stages,
    ages: spec.ages,
    when: open2 ? (s) => (!base || base(s)) && open2(s) : base,
    ...(spec.requires ? { requires: spec.requires } : {}),
    weight: spec.weight,
    cooldown: spec.cooldown,
    maxPerLife: spec.maxPerLife,
    priority: spec.priority,
    followOnly: spec.followOnly,
    extra: spec.extra,
    needsChoice: spec.needsChoice || spec.potentialOnly,
    run: (c) => {
      if (!spec.choices) return happen(c, spec, spec.outcomes ?? [])
      const s = c.s
      const open = spec.choices.map((ch, i) => [ch, i] as const).filter(([ch]) => !ch.when || ch.when(s))
      const autoWanted = typeof spec.auto === 'function' ? spec.auto(s) : (spec.auto ?? 0)
      const autoIndex = Math.max(0, open.findIndex(([, i]) => i === autoWanted))
      c.ask(
        {
          id: spec.id,
          weight: spec.decision ?? 'minor',
          title: spec.title ?? '',
          body: textOf(spec.body ?? '', s),
          choices: open.map(([ch]) => ({ label: ch.label, hint: withStudy(ch.hint, ch.effects) })),
          autoIndex,
          factText: spec.factText,
          factStatIds: spec.factStatIds,
        },
        { open: open.map(([, i]) => i).join(',') },
      )
    },
  }
  if (spec.choices) {
    const choices = spec.choices
    def.resolve = (c, choice, data) => {
      const open = String(data.open ?? '').split(',').filter(Boolean).map(Number)
      const ch = choices[open[choice] ?? choice] ?? choices[0]
      applyEffect(c.s, ch.effects)
      if (ch.flag) applyEffect(c.s, { flag: ch.flag })
      book(c.s, spec.id, ch.follow)
      happen(c, spec, ch.outcomes)
    }
  }
  return def
}

// ---------------------------------------------------------------- validation (used by the tests)

const norm = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(norm)
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined && x !== 0).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, norm(x)]))
  return v
}
const outcomeSig = (o: OutcomeSpec) => JSON.stringify(norm({ e: o.effects ?? {}, f: (o.follow ?? []).map((f) => f.id).sort(), k: o.kind ?? '' }))
const choiceSig = (ch: ChoiceSpec) => JSON.stringify({ e: norm(ch.effects ?? {}), f: list(ch.flag).sort(), b: (ch.follow ?? []).map((f) => f.id).sort(), o: ch.outcomes.map(outcomeSig).sort() })

/** character-bigram similarity of two texts (1 = same) */
export function similarity(a: string, b: string): number {
  const grams = (t: string) => {
    const x = t.replace(/[\s、。「」（）・]/g, '')
    const g = new Set<string>()
    for (let i = 0; i < x.length - 1; i++) g.add(x.slice(i, i + 2))
    return g
  }
  const ga = grams(a)
  const gb = grams(b)
  if (ga.size === 0 || gb.size === 0) return a === b ? 1 : 0
  let common = 0
  for (const g of ga) if (gb.has(g)) common++
  return common / (ga.size + gb.size - common)
}

/** texts that count as near-repeats */
export const NEAR_REPEAT = 0.7

/**
 * Problems in a set of specs (empty = fine). `known`: ids of every registered event (for follow-ups).
 */
export function validateSpecs(specs: EventSpec[], known: Set<string>): string[] {
  const out: string[] = []
  const ids = new Set<string>()
  const byId = new Map(specs.map((s) => [s.id, s]))
  const targets = new Set(
    specs.flatMap((s) => [
      ...[...(s.outcomes ?? []), ...(s.choices ?? []).flatMap((c) => c.outcomes)].flatMap((o) => (o.follow ?? []).map((f) => f.id)),
      ...(s.choices ?? []).flatMap((c) => (c.follow ?? []).map((f) => f.id)),
    ]),
  )
  const texts: [string, string][] = []
  for (const s of specs) {
    const where = s.id
    if (!/^[\w.-]+$/.test(s.id)) out.push(`${where}: bad id`)
    if (ids.has(s.id)) out.push(`${where}: duplicate id`)
    ids.add(s.id)
    if (s.stages.length === 0) out.push(`${where}: no stage`)
    if (s.ages && s.ages[0] > s.ages[1]) out.push(`${where}: ages reversed`)
    if (s.followOnly && !targets.has(s.id)) out.push(`${where}: followOnly but nothing books it`)
    const outcomes = [...(s.outcomes ?? []), ...(s.choices ?? []).flatMap((c) => c.outcomes)]
    if (s.choices) {
      if (s.choices.length < 2) out.push(`${where}: a decision needs two choices or more`)
      if (!s.title || !s.body) out.push(`${where}: a decision needs a title and a body`)
      if (s.outcomes) out.push(`${where}: outcomes belong to the choices`)
      const sigs = s.choices.map(choiceSig)
      if (new Set(sigs).size !== sigs.length) out.push(`${where}: two choices have the same effects (only the wording differs)`)
      if (new Set(s.choices.map((c) => c.label)).size !== s.choices.length) out.push(`${where}: two choices have the same label`)
      for (const ch of s.choices) {
        if (ch.outcomes.length === 0) out.push(`${where} / ${ch.label}: no outcome`)
        const os = ch.outcomes.map(outcomeSig)
        if (new Set(os).size !== os.length) out.push(`${where} / ${ch.label}: two outcomes differ only in wording`)
      }
    } else {
      if (!s.outcomes || s.outcomes.length === 0) out.push(`${where}: no outcome`)
      else {
        const os = s.outcomes.map(outcomeSig)
        if (new Set(os).size !== os.length) out.push(`${where}: two outcomes differ only in wording`)
      }
    }
    for (const f of (s.choices ?? []).flatMap((c) => c.follow ?? [])) {
      if (!known.has(f.id) && !byId.has(f.id)) out.push(`${where}: follow-up ${f.id} does not exist`)
      else if (byId.has(f.id) && !byId.get(f.id)!.followOnly) out.push(`${where}: follow-up ${f.id} is not followOnly`)
      if (f.after < 1) out.push(`${where}: follow-up ${f.id} must come in a later year`)
    }
    for (const o of outcomes) {
      for (const f of o.follow ?? []) {
        if (!known.has(f.id) && !byId.has(f.id)) out.push(`${where}: follow-up ${f.id} does not exist`)
        else if (byId.has(f.id) && !byId.get(f.id)!.followOnly) out.push(`${where}: follow-up ${f.id} is not followOnly`)
        if (f.after < 1) out.push(`${where}: follow-up ${f.id} must come in a later year`)
      }
      if (typeof o.text === 'string') texts.push([where, o.text])
    }
    // effects that move the calibrated career or mortality, in playing stages
    if (!s.career && s.stages.some((st) => PLAYING_STAGES.includes(st))) {
      const effects = [...(s.choices ?? []).map((c) => c.effects), ...outcomes.map((o) => o.effects)]
      for (const e of effects) for (const k of PROTECTED_EFFECTS) if (e?.[k]) out.push(`${where}: '${k}' in a playing stage needs career: true (PROJECT_PLAN §11.10)`)
    }
  }
  // the おまかせ path of extra events stays neutral: only skill and flags (see NEUTRAL_FORBIDDEN)
  const visited = new Set<string>()
  const neutral = (s: EventSpec, via: string) => {
    if (visited.has(s.id)) return
    visited.add(s.id)
    let outs: OutcomeSpec[]
    let effects: (Effect | undefined)[]
    if (s.choices) {
      if (typeof s.auto === 'function') {
        out.push(`${s.id}: an extra decision needs a fixed おまかせ choice`)
        return
      }
      const ch = s.choices[s.auto ?? 0]
      if (!ch) {
        out.push(`${s.id}: おまかせ points at no choice`)
        return
      }
      outs = ch.outcomes
      effects = [ch.effects, ...outs.map((o) => o.effects)]
      for (const f of ch.follow ?? []) {
        const t = byId.get(f.id)
        if (t) neutral(t, `${s.id} → ${f.id}`)
      }
    } else {
      outs = s.outcomes ?? []
      effects = outs.map((o) => o.effects)
    }
    for (const e of effects) for (const k of NEUTRAL_FORBIDDEN) if (e?.[k]) out.push(`${s.id}: '${k}' on the おまかせ path (${via}) would move the calibrated lives`)
    for (const o of outs) for (const f of o.follow ?? []) {
      const t = byId.get(f.id)
      if (t) neutral(t, `${s.id} → ${f.id}`)
    }
  }
  for (const s of specs) if (s.extra && !s.followOnly) neutral(s, 'おまかせ')
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const sim = similarity(texts[i][1], texts[j][1])
      if (sim >= NEAR_REPEAT) out.push(`${texts[i][0]} / ${texts[j][0]}: near-repeated text (${sim.toFixed(2)}): ${texts[i][1]} | ${texts[j][1]}`)
    }
  }
  return out
}
