import type { CountryCode } from '../../data/types.ts'
import type { LifeState, LogKind } from '../types.ts'
import type { EventDef, EventStage } from '../events.ts'
import { rotate } from '../events.ts'
import { compileSpec, flagAge, type ChoiceSpec, type Effect, type EventSpec, type OutcomeSpec } from '../events/spec.ts'

// Event packs: the common way to add events from now on. A pack is one file of events on one subject, for the lives of the
// countries it names; it is added by one line in packs/index.ts. Its events use the declarative spec of the catalog
// (events/spec.ts) through the builders below, which put every id, flag and category under the pack's own name
// (pk.<pack>.…), so a pack can never set a flag or take a category that an existing event reads.
//
// Four kinds, one way of writing them:
//   log     a line (or one of several lines, in turn) and nothing else, or a few flags and effects
//   happen  several endings drawn by weight, without a question
//   choice  a question with choices, each with its endings; `auto` is the おまかせ answer
//   later   any of the above, continuing an earlier one: it comes while the years since a flag of the pack are within a window
//           (the packs chain their events by flags, never by the booked follow-ups of the catalog, LifeState.due)
//
// What an event may change is declared by its pack (`impact`) and checked (packs/validate.ts), from the least to the most:
//   log     flags of the pack only
//   life    money, happiness, relations, knowledge, the job, the home, languages, the end of a relationship
//   career  baseball: confidence, the coach's view, fatigue, skills, growth, the captaincy, the position, leaving or moving team
//   health  health and injuries (the death rate)
// While he plays, the おまかせ answer of an event changes flags only (the lives played by おまかせ keep their calibrated course),
// unless the event says `autoEffects` and the pack carries an approval; `career` and `health` need an approval too.
// The packs are drawn by their own pass (packs/pass.ts), on their own random stream, after everything else of the year. An event
// with a `chance` comes by that chance in each year its conditions hold, on a stream of its own, so adding another pack does not
// change how often it comes; one without it takes part in the shared draw of the pass (PACK_PER_YEAR).

/** how far an event may reach into a life, from the least to the most */
export type Impact = 'log' | 'life' | 'career' | 'health'
export const IMPACTS: readonly Impact[] = ['log', 'life', 'career', 'health']
export const atLeast = (a: Impact, b: Impact): boolean => IMPACTS.indexOf(a) >= IMPACTS.indexOf(b)

/** the level of each effect of the closed vocabulary (events/spec.ts Effect): a key added to Effect must be placed here */
export const EFFECT_IMPACT: Record<keyof Effect, Impact> = {
  flag: 'log',
  unflag: 'log',
  money: 'life',
  happy: 'life',
  rel: 'life',
  job: 'life',
  achieve: 'life',
  fame: 'life',
  career: 'life',
  payScale: 'life',
  title: 'life',
  move: 'life',
  know: 'life',
  sat: 'life',
  level: 'life',
  home: 'life',
  loan: 'life',
  lang: 'life',
  partner: 'life',
  conf: 'career',
  eval: 'career',
  fatigue: 'career',
  skill: 'career',
  gain: 'career',
  captain: 'career',
  moveTeam: 'career',
  retire: 'career',
  position: 'career',
  pot: 'career',
  health: 'health',
  injury: 'health',
}

/** the stages an event meets when it names none: every one but early childhood (where nothing but decorative lines happen) */
export const DEFAULT_STAGES: EventStage[] = ['youth', 'jhs', 'hs', 'univ', 'amateur', 'pro', 'student', 'adult', 'senior']

type Text = string | ((s: LifeState) => string)
type Flags = string | string[]

/** an ending: its line, its weight, what it changes (flags by the pack's own names) */
export interface PackOutcome {
  text: Text
  kind?: LogKind
  weight?: number | ((s: LifeState) => number)
  when?: (s: LifeState) => boolean
  key?: boolean
  effects?: Effect
  /** flags of the pack set by this ending (where a later event starts) */
  flag?: Flags
  statIds?: string[]
}

export interface PackChoice {
  label: string
  hint?: string
  /** shown only when this holds */
  when?: (s: LifeState) => boolean
  /** applied on choosing, before the ending */
  effects?: Effect
  /** flags of the pack set on choosing, whatever the ending */
  flag?: Flags
  outcomes: PackOutcome[]
}

interface Common {
  /** the name inside the pack: the event's id is pk.<pack>.<id> */
  id: string
  /** default: DEFAULT_STAGES */
  stages?: EventStage[]
  /** inclusive */
  ages?: [number, number]
  when?: (s: LifeState) => boolean
  weight?: number | ((s: LifeState) => number)
  /** years before it can come again (default 3) */
  cooldown?: number
  /** default 1 */
  maxPerLife?: number
  /** a second word of its category (one event of a category a year in the packs' pass): pk.<pack>.<category>; default pk.<pack> */
  category?: string
  /** changes beyond flags on the おまかせ path while he plays: moves the calibrated lives, needs the pack's approval */
  autoEffects?: boolean
  /**
   * the chance (0 < chance ≤ 1) that it happens in a year whose conditions hold, drawn on a stream of its own (packs/pass.ts packRoll):
   * how often it comes depends on it alone, not on the other events or packs of the pass. Without it, the event takes part in the
   * shared draw of the pass (PACK_PER_YEAR).
   */
  chance?: number
}

export interface LogInput extends Common {
  /** one line, or several used in turn */
  text: string | string[]
  kind?: LogKind
  key?: boolean
  effects?: Effect
  flag?: Flags
  statIds?: string[]
}

export interface HappenInput extends Common {
  outcomes: PackOutcome[]
}

export interface ChoiceInput extends Common {
  title: string
  body: Text
  choices: PackChoice[]
  /** おまかせ: the index of a choice */
  auto: number
  decision?: 'major' | 'minor'
  factText?: string
  factStatIds?: string[]
}

/** an event of a pack, built: its spec (ids, flags and category under the pack's name) and what the checks need to know */
export interface PackEvent {
  spec: EventSpec
  /** continues an earlier event: comes while the years since this flag (the full name) are within the window */
  after?: { flag: string; years: [number, number] }
  autoEffects: boolean
  /** a chance a year of its own (see Common.chance), or none (the shared draw) */
  chance?: number
  /** every line written as a fixed text (for the checks of length and of near-repeats) */
  texts: string[]
}

export interface Pack {
  /** a short name: lower-case first letter, letters and digits (the prefix of its ids, flags and categories: pk.<id>.) */
  id: string
  /** the countries whose lives meet it (each country is switched on or off in packs/index.ts too) */
  countries: CountryCode[]
  /** which country counts: the one he was born in (default) or the one he lives in now */
  where: 'born' | 'lives'
  /** the most any of its events may change */
  impact: Impact
  /** who approved its effects on the calibrated lives, and when (needed for `career`, `health` and `autoEffects`) */
  approved?: string
  events: PackEvent[]
}

export interface PackKit {
  /** the full name of a flag of this pack */
  flag(name: string): string
  /** whether a flag of this pack is set */
  has(s: LifeState, name: string): boolean
  /** years since a flag of this pack was set (Infinity when it never was) */
  since(s: LifeState, name: string): number
  log(e: LogInput): PackEvent
  happen(e: HappenInput): PackEvent
  choice(e: ChoiceInput): PackEvent
  /** the event continues an earlier one: it comes while the years since the flag are within `years` (inclusive) */
  later(after: { flag: string; years: [number, number] }, e: PackEvent): PackEvent
}

const list = (x: Flags | undefined): string[] => (x === undefined ? [] : Array.isArray(x) ? x : [x])

export interface PackInput {
  id: string
  countries: CountryCode[]
  where?: 'born' | 'lives'
  impact: Impact
  approved?: string
  events: (k: PackKit) => PackEvent[]
}

/** a pack: its events are written with the kit, which puts their ids, flags and categories under the pack's name */
export function definePack(o: PackInput): Pack {
  const P = `pk.${o.id}`
  const flag = (name: string) => `${P}.${name}`
  const flags = (x: Flags | undefined) => list(x).map(flag)
  /** effects with the pack's flag names made full, and the extra flags added */
  const effects = (e: Effect | undefined, extra: Flags | undefined): Effect | undefined => {
    const set = [...flags(e?.flag), ...flags(extra)]
    const unset = flags(e?.unflag)
    if (!e && set.length === 0) return undefined
    const out: Effect = { ...e }
    delete out.flag
    delete out.unflag
    if (set.length) out.flag = set
    if (unset.length) out.unflag = unset
    return out
  }
  const outcome = (x: PackOutcome): OutcomeSpec => ({ text: x.text, kind: x.kind, weight: x.weight, when: x.when, key: x.key, statIds: x.statIds, effects: effects(x.effects, x.flag) })
  const base = (c: Common) => ({
    id: `${P}.${c.id}`,
    category: c.category ? `${P}.${c.category}` : P,
    stages: c.stages ?? DEFAULT_STAGES,
    ages: c.ages,
    when: c.when,
    weight: c.weight,
    cooldown: c.cooldown,
    maxPerLife: c.maxPerLife,
  })
  const fixed = (t: Text): string[] => (typeof t === 'string' ? [t] : [])
  const k: PackKit = {
    flag,
    has: (s, name) => s.flags?.[flag(name)] !== undefined,
    since: (s, name) => flagAge(s, flag(name)),
    log(e) {
      const b = base(e)
      const texts = Array.isArray(e.text) ? e.text : [e.text]
      const text: Text = Array.isArray(e.text) ? (s) => rotate(s, b.id, texts) : e.text
      return { spec: { ...b, outcomes: [{ text, kind: e.kind ?? 'normal', key: e.key, statIds: e.statIds, effects: effects(e.effects, e.flag) }] }, autoEffects: !!e.autoEffects, chance: e.chance, texts }
    },
    happen(e) {
      return { spec: { ...base(e), outcomes: e.outcomes.map(outcome) }, autoEffects: !!e.autoEffects, chance: e.chance, texts: e.outcomes.flatMap((x) => fixed(x.text)) }
    },
    choice(e) {
      const choices: ChoiceSpec[] = e.choices.map((ch) => ({ label: ch.label, hint: ch.hint, when: ch.when, effects: effects(ch.effects, undefined), flag: ch.flag === undefined ? undefined : flags(ch.flag), outcomes: ch.outcomes.map(outcome) }))
      return {
        spec: { ...base(e), title: e.title, body: e.body, decision: e.decision ?? 'minor', auto: e.auto, factText: e.factText, factStatIds: e.factStatIds, choices },
        autoEffects: !!e.autoEffects,
        chance: e.chance,
        texts: [...fixed(e.body), ...e.choices.flatMap((ch) => ch.outcomes.flatMap((x) => fixed(x.text)))],
      }
    },
    later(after, e) {
      const full = flag(after.flag)
      const [lo, hi] = after.years
      const own = e.spec.when
      return { ...e, after: { flag: full, years: after.years }, spec: { ...e.spec, when: (s) => flagAge(s, full) >= lo && flagAge(s, full) <= hi && (!own || own(s)) } }
    },
  }
  return { id: o.id, countries: o.countries, where: o.where ?? 'born', impact: o.impact, approved: o.approved, events: o.events(k) }
}

/** an event of a pack ready for the pass: the catalog's event (marked with its pack, so the passes of events.ts leave it out) and where it belongs */
export interface PackEntry {
  def: EventDef
  pack: string
  countries: readonly CountryCode[]
  where: 'born' | 'lives'
  /** continues an earlier event (drawn first, while its window is open) */
  later: boolean
  /** its own chance a year (Common.chance), or none (the shared draw) */
  chance?: number
}

export function compilePack(p: Pack): PackEntry[] {
  return p.events.map((e) => ({ def: { ...compileSpec(e.spec), pack: p.id }, pack: p.id, countries: p.countries, where: p.where, later: !!e.after, ...(e.chance !== undefined ? { chance: e.chance } : {}) }))
}
