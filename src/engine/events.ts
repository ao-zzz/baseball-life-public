import type { Decision, DueEvent, LifeState, LogKind, Roster } from './types.ts'
import type { CountryCode } from '../data/types.ts'
import type { Rng } from './rng.ts'
import { hashSeed, makeRng } from './rng.ts'
import { residenceOf } from './countries/index.ts'

// The event catalog (PROJECT_PLAN §11.2, stage 1).
// Each year the scheduler draws a few events from those whose conditions hold, by weight, without
// repeating an event inside its cooldown, beyond its per-life limit, or two of the same category in a row.
// Events use their own random stream, so adding events does not move the calibrated career draws.

/** the part of a life an event can belong to */
export type EventStage =
  | 'child' // before baseball
  | 'youth' // 学童
  | 'jhs'
  | 'hs'
  | 'univ'
  | 'amateur' // 社会人・独立
  | 'pro' // 育成・支配下・MLB
  | 'student' // a teenager who left baseball
  | 'adult' // 18–64, not playing
  | 'senior' // 65+

export interface EventAddOpts {
  statIds?: string[]
  key?: boolean
  stop?: 'draft' | 'quit'
  at?: number
  eventId?: string
  category?: string
  /** the squad this line announces (life.ts announce): the screen shows it while the year is revealed line by line */
  roster?: Roster
}

export interface EventCtx {
  readonly s: LifeState
  /** the event stream (not the calibrated career stream) */
  readonly rng: Rng
  readonly headless: boolean
  add(kind: LogKind, text: string, opts?: EventAddOpts): void
  /** open a decision (queued after any other decision of the year); its outcome is handled by `resolve` */
  ask(decision: Decision, data?: Record<string, number | boolean | string>): void
  /** whether another decision fits in this year */
  canAsk(): boolean
}

export interface EventDef {
  id: string
  category: string
  /** the country whose lives meet it (default 'JP': every event written before the other countries is Japan's; PROJECT_PLAN §11.31) */
  country?: CountryCode
  stages: EventStage[]
  /** inclusive age range */
  ages?: [number, number]
  when?: (s: LifeState) => boolean
  /**
   * what must still hold when its decision, queued behind others of the same year, comes to be asked (life.ts resolveDecision): an
   * earlier answer may have changed the state (he lost the job the question is about). Unlike `when`, nothing the event's own run
   * does may make it false (PROJECT_PLAN §11.61).
   */
  requires?: (s: LifeState) => boolean
  weight?: number | ((s: LifeState) => number)
  /** years before the same event can happen again (default 3) */
  cooldown?: number
  /** default 1 */
  maxPerLife?: number
  /** true = only text, no effect on the life: skipped in headless runs */
  flavorOnly?: boolean
  /** runs whenever its conditions hold (e.g. looking for a job, a budget in the red), before the random draw */
  priority?: boolean
  /** happens only when an earlier outcome booked it (LifeState.due), never by the random draw */
  followOnly?: boolean
  /**
   * drawn in the separate pass after the year's main draws (runExtraEvents), on its own random stream, so
   * that these events leave the calibrated lives' draws as they were (PROJECT_PLAN §11.12)
   */
  extra?: boolean
  /** can only happen after the player's own (not おまかせ) choice: reach tests under おまかせ do not judge it */
  needsChoice?: boolean
  /**
   * everyday life during the playing years (love, marriage, children, rumours; PROJECT_PLAN §11.33): drawn only by runLifePass, on its own
   * random stream, so that the extra pass and the calibrated lives keep their draws. Its おまかせ answer changes no state (the choices do).
   */
  lifePass?: boolean
  /**
   * daily life tied to the country he LIVES in (a place's insurance, holidays, schools, neighbours), whatever country he was born in.
   * Such an event is not in the birth country's table: it is drawn only by runResidentPass, after the year's other events, and
   * `country` is not used for it (PROJECT_PLAN §11.37)
   */
  lives?: CountryCode
  /** the everyday subject (see THEME_BY_CATEGORY); one event of a subject a year, whichever table it comes from */
  theme?: string
  /**
   * the event pack it belongs to (src/engine/packs): drawn only by the packs' own pass (packs/pass.ts), last in the year, never by
   * the passes of this file (the main draw, the extra pass, the life pass, the resident pass, the booked follow-ups), so a pack
   * added or removed leaves their draws as they were
   */
  pack?: string
  run(c: EventCtx): void
  /** outcome of the decision the event opened (decision id = event id) */
  resolve?(c: EventCtx, choice: number, data: Record<string, number | boolean | string>): void
}

/**
 * whether this event belongs to the life: the event table of the country he was born in (`country`, default Japan's), or, for an
 * event of daily life that is tied to a place (`lives`), the country he lives in now (PROJECT_PLAN §11.37)
 */
export function countryFits(d: { country?: CountryCode; lives?: CountryCode }, s: LifeState): boolean {
  if (d.lives !== undefined) return residenceOf({ residence: s.residence, person: { country: s.person?.country ?? 'JP' }, career: s.career }) === d.lives
  return (d.country ?? 'JP') === (s.person?.country ?? 'JP')
}

export function stageOf(s: LifeState): EventStage {
  switch (s.career.phase) {
    case 'child':
      return 'child'
    case 'youth':
      return 'youth'
    case 'jhs':
      return 'jhs'
    case 'hs':
      return 'hs'
    case 'univ':
      return 'univ'
    case 'company':
    case 'indep':
      return 'amateur'
    case 'proMinor':
    case 'pro':
    case 'abroad':
      return 'pro'
    default:
      return s.age < 18 ? 'student' : s.age < 65 ? 'adult' : 'senior'
  }
}

/** how many events a year brings, by stage: [chance of a first, chance of a second, chance of a third] */
const PER_YEAR: Record<EventStage, [number, number, number]> = {
  child: [0.85, 0, 0],
  youth: [1, 0.25, 0],
  jhs: [1, 0.5, 0],
  hs: [1, 0.85, 0.45],
  univ: [1, 0.3, 0],
  amateur: [1, 0.2, 0],
  pro: [1, 0.3, 0],
  student: [0.8, 0, 0],
  adult: [1, 0.6, 0.2],
  senior: [0.9, 0.3, 0],
}

/** chance that this year's random events may include a decision (so that adult life does not stop every year) */
const DECISION_P: Record<EventStage, number> = {
  child: 0,
  youth: 1,
  jhs: 1,
  hs: 1,
  univ: 1,
  amateur: 1,
  pro: 1,
  student: 1,
  adult: 0.4,
  senior: 0.35,
}

export function eventRng(s: LifeState, salt: number): Rng {
  return makeRng(hashSeed(s.config.seed ^ Math.imul(s.age + 1, 0x632be5ab) ^ Math.imul(salt + 3, 0x9e3779b9)))
}

export class EventRegistry {
  private readonly defs: EventDef[] = []
  private readonly byId = new Map<string, EventDef>()
  private life: EventDef[] | null = null
  private resident: EventDef[] | null = null

  /** the daily-life events tied to the country he lives in (runResidentPass), listed once */
  residentDefs(): readonly EventDef[] {
    return (this.resident ??= this.defs.filter((d) => d.lives !== undefined && !d.followOnly && d.pack === undefined))
  }

  /** the everyday-life events (runLifePass), listed once */
  lifeDefs(): readonly EventDef[] {
    return (this.life ??= this.defs.filter((d) => d.lifePass && d.pack === undefined))
  }

  register(list: EventDef[]): void {
    this.life = null
    this.resident = null
    for (const d of list) {
      if (this.byId.has(d.id)) throw new Error(`duplicate event id ${d.id}`)
      this.byId.set(d.id, d)
      this.defs.push(d)
    }
  }

  all(): readonly EventDef[] {
    return this.defs
  }

  get(id: string): EventDef | undefined {
    return this.byId.get(id)
  }

  /** events that may happen this year (by the draw or as priority events; follow-ups are booked instead) */
  eligible(s: LifeState, stage: EventStage, headless: boolean): EventDef[] {
    const hist = s.evHist ?? {}
    return this.defs.filter((d) => {
      if (d.followOnly || d.extra || d.lives !== undefined || d.pack !== undefined) return false
      if (headless && d.flavorOnly) return false
      if (!d.stages.includes(stage)) return false
      if (d.ages && (s.age < d.ages[0] || s.age > d.ages[1])) return false
      // (after the cheap tests: this runs for every event of the catalog, several times a year)
      if (d.country !== undefined && !countryFits(d, s)) return false
      if (d.country === undefined && s.person.country !== 'JP' && s.person.country !== undefined) return false
      const h = hist[d.id]
      if (h) {
        if (h[1] >= (d.maxPerLife ?? 1)) return false
        if (s.age - h[0] < (d.cooldown ?? 3)) return false
      }
      if (d.when && !d.when(s)) return false
      return weightOf(d, s) > 0
    })
  }
}

/** events of the extra pass that may happen this year (follow-ups are booked instead) */
export function eligibleExtra(reg: EventRegistry, s: LifeState, stage: EventStage): EventDef[] {
  const hist = s.evHist ?? {}
  return reg.all().filter((d) => {
    if (!d.extra || d.followOnly || d.lifePass || d.lives !== undefined || d.pack !== undefined) return false
    if (!d.stages.includes(stage)) return false
    if (d.ages && (s.age < d.ages[0] || s.age > d.ages[1])) return false
    if (d.country !== undefined && !countryFits(d, s)) return false
    if (d.country === undefined && s.person.country !== 'JP' && s.person.country !== undefined) return false
    const h = hist[d.id]
    if (h) {
      if (h[1] >= (d.maxPerLife ?? 1)) return false
      if (s.age - h[0] < (d.cooldown ?? 3)) return false
    }
    if (d.when && !d.when(s)) return false
    return weightOf(d, s) > 0
  })
}

/** events of the extra pass in a year: [chance of a first, chance of a second] by stage */
const EXTRA_PER_YEAR: Partial<Record<EventStage, [number, number] | [number, number, number]>> = {
  youth: [0.7, 0.2],
  jhs: [0.85, 0.3],
  student: [0.7, 0.3],
  hs: [1, 0.85, 0.5],
  univ: [1, 0.6, 0.3],
  amateur: [0.95, 0.55, 0.2],
  pro: [0.9, 0.5, 0.2],
  adult: [0.5, 0.2, 0.05],
  senior: [0.55, 0.2],
}
/** chance that the extra events of a year may include a decision */
const EXTRA_DECISION_P: Partial<Record<EventStage, number>> = { youth: 0.6, jhs: 0.75, student: 0.7, hs: 0.8, univ: 0.8, amateur: 0.8, pro: 0.8, adult: 0.5, senior: 0.6 }

/**
 * The extra pass: booked follow-ups first, then a few drawn events, all on the extra random stream
 * `c.rng` (a separate one from the main draws). What they change is limited for lives that answer
 * everything with おまかせ (see validateSpecs: the おまかせ choice and the happenings are neutral for the
 * calibrated variables), so the calibrated stage rates do not move.
 */
export function runExtraEvents(reg: EventRegistry, c: EventCtx): string[] {
  const s = c.s
  const stage = stageOf(s)
  // categories of this year's main events are taken (one category a year, as in the main draws)
  const used = new Set<string>()
  for (const [id, [age]] of Object.entries(s.evHist ?? {})) {
    const d = reg.get(id)
    if (age === s.age && d && !d.extra && !d.followOnly && !d.flavorOnly) used.add(d.category)
  }
  const ran = runDue(reg, c, stage, used)
  const recent = recentCategories(reg, s)
  // a university student who is not in the team has as busy a year as a team player
  const student = stage === 'adult' && s.job === '大学生'
  const [p1, p2, p3 = 0] = student ? EXTRA_PER_YEAR.univ! : (EXTRA_PER_YEAR[stage] ?? [0, 0])
  if (p1 === 0) return ran
  let n = 0
  if (c.rng.chance(p1)) n++
  if (n === 1 && c.rng.chance(p2)) n++
  if (n === 2 && p3 > 0 && c.rng.chance(p3)) n++
  let decisionOk = c.rng.chance(student ? EXTRA_DECISION_P.univ! : (EXTRA_DECISION_P[stage] ?? 0))
  for (let k = 0; k < n; k++) {
    const pool = eligibleExtra(reg, s, stage).filter((d) => !used.has(d.category) && !(d.resolve && (!c.canAsk() || !decisionOk)))
    if (pool.length === 0) break
    const d = c.rng.weighted(pool, pool.map((x) => weightOf(x, s) * (recent.has(x.category) ? REPEAT_DAMPING : 1)))
    if (d.resolve) decisionOk = false
    markSeen(s, d.id)
    used.add(d.category)
    ran.push(d.id)
    d.run(tagged(c, d))
  }
  return ran
}

/** the stages whose lives meet the everyday-life events (a student who left baseball and a retired man have the catalog's own) */
export const LIFE_PASS_STAGES: EventStage[] = ['univ', 'amateur', 'pro']
/** events of the life pass in a year: [chance of a first, chance of a second] (an assumption: about one every two years, a second rarely) */
const LIFE_PASS_PER_YEAR: [number, number] = [0.5, 0.12]

/**
 * Everyday life during the playing years: love, marriage, children, family, rumours. Own random stream (the caller's `c.rng`), run after
 * the extra pass; it takes only the decision room that is left. Every event of it answers おまかせ without changing any state, so a
 * life that never chooses these keeps its calibrated course and its family (a headless run is the screen's おまかせ).
 */
export function runLifePass(reg: EventRegistry, c: EventCtx): string[] {
  const s = c.s
  const stage = stageOf(s)
  if (!LIFE_PASS_STAGES.includes(stage) || s.age < 19) return []
  const hist = s.evHist ?? {}
  const open = () =>
    reg.lifeDefs().filter((d) => {
      if (!d.stages.includes(stage)) return false
      if (d.ages && (s.age < d.ages[0] || s.age > d.ages[1])) return false
      if (!countryFits(d, s)) return false
      const h = hist[d.id]
      if (h && (h[1] >= (d.maxPerLife ?? 1) || s.age - h[0] < (d.cooldown ?? 3))) return false
      if (d.when && !d.when(s)) return false
      return weightOf(d, s) > 0
    })
  if (open().length === 0) return []
  const [p1, p2] = LIFE_PASS_PER_YEAR
  let n = 0
  if (c.rng.chance(p1)) n++
  if (n === 1 && c.rng.chance(p2)) n++
  const used = new Set<string>()
  const ran: string[] = []
  for (let k = 0; k < n; k++) {
    const pool = open().filter((d) => !used.has(d.category) && !ran.includes(d.id) && !(d.resolve && !c.canAsk()))
    if (pool.length === 0) break
    const d = c.rng.weighted(pool, pool.map((x) => weightOf(x, s)))
    markSeen(s, d.id)
    used.add(d.category)
    ran.push(d.id)
    d.run(tagged(c, d))
  }
  return ran
}

/**
 * The everyday subject of the birth countries' categories, for the daily-life categories only (a category not listed has no
 * subject: baseball and the like). A resident event (`lives`) carries its own `theme`. One event of a subject a year, whichever
 * table it comes from, so a man who lives away from the country of his birth does not meet a Japanese and an American
 * "friends" event in the same year (PROJECT_PLAN §11.37). Only the resident pass reads this: the birth countries' draws are as they were.
 */
export const THEME_BY_CATEGORY: Record<string, string> = {
  health: 'health', bodyLife: 'health', bodyCare: 'health', bodyAche: 'health', mind: 'health', mindLife: 'health', healthCheck: 'health', hospital: 'health',
  friends: 'friends', friendship: 'friends', oldFriends: 'friends', circle: 'friends', relations: 'friends', teammates: 'friends',
  community: 'community', communityLife: 'community', localLife: 'community', neighbors: 'community',
  work: 'work', workplace: 'work', careerMove: 'work', sideJob: 'work', partJob: 'work', venture: 'work', money: 'money', moneyLife: 'money', familyMoney: 'money',
  love: 'love', loveLife: 'love', lifeLove: 'love',
  family: 'family', familyLife: 'family', children: 'family', kids: 'family', kidFamily: 'family', lifeFamily: 'family', parentCare: 'family', parents: 'family',
  fans: 'media', media: 'media', trend: 'media', gearDeal: 'media',
  trainer: 'health', offSeason: 'work', secondCareer: 'work', kidHobby: 'family',
  housing: 'home', home: 'home', homeLife: 'home', livingPlace: 'home',
  usAfterCoach: 'work', usAfterHealth: 'health',
  school: 'school', campusLife: 'school', studyLife: 'school', alumniLife: 'school',
}
export const themeOf = (d: { theme?: string; category: string }): string | undefined => d.theme ?? THEME_BY_CATEGORY[d.category]

/** events of the resident pass in a year, by stage: [chance of a first, of a second, of a third] (an assumption) */
const RESIDENT_PER_YEAR: Partial<Record<EventStage, [number, number, number]>> = {
  hs: [0.75, 0.35, 0.1],
  univ: [0.75, 0.35, 0.1],
  amateur: [0.7, 0.3, 0.1],
  pro: [0.75, 0.35, 0.1],
  adult: [0.5, 0.2, 0.05],
  senior: [0.5, 0.2, 0.05],
}

/**
 * Daily life of the country he lives in (`EventDef.lives`): drawn after the year's other events, on a stream of its own. The pool is
 * the events of the country he lives in now, whichever country he was born in; an event whose subject (theme) already happened
 * this year, from either table, is left out, and so is a second one of the same subject. One decision a year at most, and only
 * while there is room for it. Nothing here touches the birth country's draws.
 */
export function runResidentPass(reg: EventRegistry, c: EventCtx): string[] {
  const s = c.s
  const defs = reg.residentDefs()
  if (defs.length === 0) return []
  const stage = stageOf(s)
  const res = residenceOf(s)
  // a man who lives in his birth country meets these in place of the main draws they used to be in, at the pace of those draws
  // (PER_YEAR, DECISION_P); one who lives away from it meets them besides his birth country's own events, at a lighter pace
  const away = res !== (s.person?.country ?? 'JP')
  // (Japan's own table is rich in daily life already: its residents get these besides it, at the lighter pace too)
  const rates = away || res === 'JP' ? RESIDENT_PER_YEAR[stage] : PER_YEAR[stage]
  if (!rates) return []
  const here = defs.filter((d) => d.lives === res)
  if (here.length === 0) return []
  const hist = s.evHist ?? {}
  // subjects already met this year (either table)
  const used = new Set<string>()
  for (const [id, [age]] of Object.entries(hist)) {
    if (age !== s.age) continue
    const d = reg.get(id)
    const t = d && themeOf(d)
    if (t) used.add(t)
  }
  const [p1, p2, p3] = rates
  let n = 0
  if (c.rng.chance(p1)) n++
  if (n === 1 && c.rng.chance(p2)) n++
  if (n === 2 && c.rng.chance(p3)) n++
  // (as in the main draws: outside school baseball not every year may bring a decision, and a year brings one drawn decision)
  let decisionOk = c.rng.chance(DECISION_P[stage])
  const ran: string[] = []
  for (let k = 0; k < n; k++) {
    const pool = here.filter((d) => {
      if (!d.stages.includes(stage)) return false
      if (d.ages && (s.age < d.ages[0] || s.age > d.ages[1])) return false
      const t = themeOf(d)
      if (t && used.has(t)) return false
      const h = hist[d.id]
      if (h && (h[1] >= (d.maxPerLife ?? 1) || s.age - h[0] < (d.cooldown ?? 3))) return false
      if (d.resolve && (!decisionOk || !c.canAsk())) return false
      if (d.when && !d.when(s)) return false
      return weightOf(d, s) > 0
    })
    if (pool.length === 0) break
    const d = c.rng.weighted(pool, pool.map((x) => weightOf(x, s)))
    if (d.resolve && DECISION_P[stage] < 1) decisionOk = false
    markSeen(s, d.id)
    const t = themeOf(d)
    if (t) used.add(t)
    ran.push(d.id)
    d.run(tagged(c, d))
  }
  return ran
}

/** the weight of an event whose subject came up in the last two years (PROJECT_PLAN §11.17): the same theme is not met year after year */
export const REPEAT_DAMPING = 0.35

/** subjects (categories) of the events of the last two years, main and extra */
export function recentCategories(reg: EventRegistry, s: LifeState): Set<string> {
  const out = new Set<string>()
  for (const [id, [age]] of Object.entries(s.evHist ?? {})) {
    if (age >= s.age - 2 && age < s.age) {
      const d = reg.get(id)
      if (d && !d.flavorOnly) out.add(d.category)
    }
  }
  return out
}

/** whether a booked follow-up can run now: its stage, ages, conditions and per-life limit (not the cooldown) */
export function followFits(s: LifeState, d: EventDef, stage: EventStage): boolean {
  if (!countryFits(d, s)) return false
  if (!d.stages.includes(stage)) return false
  if (d.ages && (s.age < d.ages[0] || s.age > d.ages[1])) return false
  if ((s.evHist?.[d.id]?.[1] ?? 0) >= (d.maxPerLife ?? 1)) return false
  if (d.when && !d.when(s)) return false
  return weightOf(d, s) > 0
}

/**
 * Booked follow-ups due this year run first. One that cannot run yet (conditions, no room for a decision)
 * waits until its `until` age, then is dropped. Lives without bookings are not touched at all.
 */
export function runDue(reg: EventRegistry, c: EventCtx, stage: EventStage, usedCats: Set<string>): string[] {
  const s = c.s
  if (!s.due?.length) return []
  const list = s.due
  s.due = []
  const keep: DueEvent[] = []
  const ran: string[] = []
  for (const x of list) {
    if (x.age > s.age) {
      keep.push(x)
      continue
    }
    const d = reg.get(x.id)
    // (a pack's event is never booked here: the packs chain their events by flags, in their own pass)
    if (!d || d.pack !== undefined || ran.includes(d.id) || !followFits(s, d, stage) || (d.resolve && !c.canAsk())) {
      if (d && s.age < x.until) keep.push(x)
      continue
    }
    markSeen(s, d.id)
    usedCats.add(d.category)
    ran.push(d.id)
    d.run(tagged(c, d))
  }
  // bookings made by the follow-ups themselves stay after the ones still waiting
  s.due = [...keep, ...s.due]
  if (s.due.length === 0) delete s.due
  return ran
}

export function weightOf(d: EventDef, s: LifeState): number {
  return typeof d.weight === 'function' ? d.weight(s) : (d.weight ?? 1)
}

export function markSeen(s: LifeState, id: string): void {
  const hist = (s.evHist ??= {})
  const h = hist[id]
  hist[id] = [s.age, (h?.[1] ?? 0) + 1]
}

/** Draw this year's events and run them. Returns the ids that ran. */
export function runYearEvents(reg: EventRegistry, c: EventCtx): string[] {
  const s = c.s
  const stage = stageOf(s)
  const [p1, p2, p3] = PER_YEAR[stage]
  let n = 0
  if (c.rng.chance(p1)) n++
  if (n === 1 && c.rng.chance(p2)) n++
  if (n === 2 && c.rng.chance(p3)) n++
  const usedCats = new Set<string>()
  const ran: string[] = []
  // (follow-ups booked by earlier outcomes and the extra events run in their own pass, runExtraEvents)
  // the draws below never include decorative (flavour-only) events, so a life played on screen meets
  // exactly the same events as the same life run headless; decorative lines get their own pass at the end
  // events that must happen when their conditions hold
  for (const d of reg.eligible(s, stage, true).filter((x) => x.priority)) {
    if (d.resolve && !c.canAsk()) continue
    markSeen(s, d.id)
    usedCats.add(d.category)
    ran.push(d.id)
    d.run(tagged(c, d))
  }
  // avoid last year's categories too, unless nothing else is left
  const lastCats = lastCategories(s, reg)
  let decisionOk = c.rng.chance(DECISION_P[stage])
  let drawn = 0
  for (let k = 0; k < n; k++) {
    const pool = reg.eligible(s, stage, true).filter((d) => !d.priority && !usedCats.has(d.category) && !(d.resolve && (!c.canAsk() || !decisionOk)))
    const fresh = pool.filter((d) => !lastCats.has(d.category))
    const from = fresh.length > 0 ? fresh : pool
    if (from.length === 0) break
    const d = c.rng.weighted(from, from.map((x) => weightOf(x, s)))
    // at most one drawn decision a year outside school baseball
    if (d.resolve && DECISION_P[stage] < 1) decisionOk = false
    markSeen(s, d.id)
    usedCats.add(d.category)
    ran.push(d.id)
    drawn++
    d.run(tagged(c, d))
  }
  if (!c.headless) ran.push(...flavourPass(reg, c, stage, n - drawn, usedCats))
  return ran
}

/**
 * Decorative lines (screen only), on their own random stream: they fill the year's empty event slots
 * (all of them before baseball, where nothing else happens) and never touch what the life draws.
 */
function flavourPass(reg: EventRegistry, c: EventCtx, stage: EventStage, slots: number, usedCats: Set<string>): string[] {
  const s = c.s
  const r = eventRng(s, 0xf1a7)
  const ran: string[] = []
  const lines = (slots > 0 ? 1 : r.chance(0.35) ? 1 : 0) + (slots > 1 ? 1 : 0)
  for (let k = 0; k < lines; k++) {
    const pool = reg.eligible(s, stage, false).filter((d) => d.flavorOnly && !usedCats.has(d.category))
    if (pool.length === 0) break
    const d = r.weighted(pool, pool.map((x) => weightOf(x, s)))
    markSeen(s, d.id)
    usedCats.add(d.category)
    ran.push(d.id)
    d.run(tagged({ ...c, rng: r }, d))
  }
  return ran
}

/**
 * one of an event's alternative texts, in turn (from a per-life starting point), so that a line does
 * not come back before the others have been used
 */
export function rotate(s: LifeState, id: string, texts: string[]): string {
  const n = s.evHist?.[id]?.[1] ?? 1
  const off = (s.config.seed >>> 0) % texts.length
  return texts[(off + n - 1) % texts.length]
}

/** the same context, with every line it adds tagged with the event's id and category */
export function tagged(c: EventCtx, d: EventDef): EventCtx {
  return {
    s: c.s,
    rng: c.rng,
    headless: c.headless,
    add: (kind, text, opts) => c.add(kind, text, { ...opts, eventId: d.id, category: d.category }),
    ask: (decision, data) => c.ask(decision, data),
    canAsk: () => c.canAsk(),
  }
}

function lastCategories(s: LifeState, reg: EventRegistry): Set<string> {
  const out = new Set<string>()
  for (const [id, [age]] of Object.entries(s.evHist ?? {})) {
    if (age !== s.age - 1) continue
    const d = reg.get(id)
    // decorative lines are screen only, and the extra pass has its own stream: neither steers next year's draw
    if (d && !d.flavorOnly && !d.extra && !d.followOnly) out.add(d.category)
  }
  return out
}
