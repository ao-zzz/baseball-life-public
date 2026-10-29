import type {
  CareerState,
  Decision,
  Focus,
  Level,
  LifeConfig,
  LifeState,
  LogEntry,
  LogKind,
  Phase,
  Position,
  TimedEntry,
  WorkState,
  YearPlan,
} from './types.ts'
import { hashSeed, makeRng, type Rng } from './rng.ts'
import { shownAge } from './displayAge.ts'
import { contractRuns, faStatus, registeredDays, stayTerms, suitorCount, suitorTerms, type FaOffer } from './freeAgent.ts'
import { clamp, normCdf } from './math.ts'
import { FAMILY_NAMES, GIVEN_NAMES, PREFECTURES } from '../data/jp.ts'
import { US_FAMILY_NAMES, US_GIVEN_NAMES, US_STATES } from '../data/us.ts'
import { COUNTRY_INFO, setResidence } from './countries/index.ts'
import { immerseYear, initBackground } from './language.ts'
import { relativeCause } from './family.ts'
import { autoShopYear, careChoices, careYear, portfolioYear, recordHist, treatCare, type CareBill, type CareWay } from './shop.ts'
import { US_RESOLVERS, usBaseballYear, usBirthLine, usLifeYear } from './countries/us/year.ts'
import { LEAGUE_RESOLVERS, leagueBaseballYear, leagueBirthLine, leagueLifeYear } from './countries/league/year.ts'
import { leagueProfile } from './countries/league/profile.ts'
import { LEAGUE_SPECS } from './countries/league/events.ts'
import { US_SPECS } from './countries/us/events.ts'
import { US_DAILY_SPECS } from './countries/us/daily.ts'
import { SPENDING_SPECS } from './events/spending.ts'
import { PUBLIC_SPECS } from './events/publicLife.ts'
import { US_MORTALITY_EXTRA } from './countries/us/settings.ts'
import { statValue } from '../data/stats.ts'
import { type Params, passProb } from './params.ts'
import { causeOfDeath, deathProb } from './mortality.ts'
import { INDEP_PREF, ORGS, ORG_NAME_NOTE, orgById, orgLabel } from '../data/orgs.ts'
import { EventRegistry, eventRng, runExtraEvents, runLifePass, runResidentPass, runYearEvents, stageOf, tagged, type EventAddOpts, type EventCtx } from './events.ts'
import { BASE_EVENTS } from './eventCatalog.ts'
import { trendPass } from './trendLog.ts'
import { GROUP_OF, WISH_LABEL, WISH_PHASES, wishChoices, wishLabel } from './positionWish.ts'
import { multiYearAllowed } from './contractTiming.ts'
import { REHIRE_MAX, rehireProb } from './countries/rehire.ts'
import { usRng } from './countries/us/checks.ts'
import { IKUSEI_MIN_SALARY, NPB_MAX_SALARY, NPB_MIN_SALARY, firstTeamExtra, multiYearTerm, draftReason, draftRound, draftStanding, mlbSalaryUsd, nextIkuseiSalary, nextSalary, promotedSalary, rookieTerms, seasonValue, usdToMan } from './contract.ts'
import { advanceYear, aptitudeYear, initPotential, scoutPremium, starOf, starParams } from './potential.ts'

/** the checks in which someone picks him (the scouts, a university, a company team, an independent club): his promise counts (potential.ts) */
const PICKED_BY = /File|Draft|shihaika|hsUniv|hsCompany|hsIndep|univCompany|univIndep/
/** the draft's choice between 支配下 and 育成 weighs the promise a little more for a high ★ */
const SHIHAIKA = /shihaika/
import { HS_EVENTS } from './hsEvents.ts'
import { BENCH_SIZE, BENCH_SIZE_ADULT, NO_GRADE_SHIFT, UNIV_GRADE_SHIFT, abilityOverall, benchRole, positionFit, centre, initBaseball, practiceYear, rankInTeam, startsAt, subRoleLabel } from './ability.ts'
import { fallTournament, hsPrefecture, practiceGames, springNationals, springTournament, summerTournament } from './season.ts'
import { hsCareerHr, lineAt } from './games.ts'
import { SCOUT_VISIT, TEAM_AFTER_HS, companySeason, indepSeason, mlbSeason, proSeason, proType, scoutPerf, univHalf, univPractice } from './careerSeason.ts'
import { AFTER_EVENTS } from './afterEvents.ts'
import { LIFE_LOVE_EVENTS } from './lifeLoveEvents.ts'
import { LIFE_ABROAD_EVENTS } from './lifeAbroadEvents.ts'
import { US_LIFE_EVENTS } from './countries/us/lifeEvents.ts'
import { companyFor, ensureAfter, householdYear, incomeNow, loseWork, setWork } from './after.ts'
import { LICENSES, examDue, graduationAge, licenseOfSchool, takeExam } from './license.ts'
import { careerOf, startCareer } from './careers.ts'
import { kidBallYear } from './kidBall.ts'
import { homePrefecture, moveUnknown, settleAt, settleWithTeam } from './place.ts'
import { SPECS } from './events/index.ts'
import { compileSpec } from './events/spec.ts'
import { PACK_EVENTS, PACK_SALT, runPackPass } from './packs/index.ts'
import { METHOD_LABEL, SCHOOL_NOTE, autoPick, hsShortlist, inviteSummary, optionHint, optionLabel, prospect, sitExam, studentDev, univShortlist, usInvites, type Entered, type Option } from './route/schools.ts'
import {
  COMPANY_MEAN,
  INDEP_MEAN,
  UNIV_MEAN,
  admitP,
  amateurRating,
  clubTeamRating,
  evaluate,
  indepRating,
  levelWord,
  NPB_MEAN,
  npbRating,
  ratingText,
  squadSize,
  univRating,
  type TeamRating,
} from './route/rating.ts'
import { schoolById } from '../data/schools/index.ts'
import { UNIV_EVENTS, hooks } from './route/univEvents.ts'
import { careerHooks } from './events/hooks.ts'
import { JABA_REGION_OF_PREF, teamsInRegion } from '../data/teams.ts'

/** all catalog events (PROJECT_PLAN §11.2) */
export const EVENTS = new EventRegistry()
EVENTS.register(BASE_EVENTS)
EVENTS.register(HS_EVENTS)
EVENTS.register(AFTER_EVENTS)
EVENTS.register(LIFE_LOVE_EVENTS)
EVENTS.register(LIFE_ABROAD_EVENTS)
EVENTS.register(US_LIFE_EVENTS)
EVENTS.register(SPECS.map(compileSpec))
EVENTS.register(UNIV_EVENTS)
// the events of the US lives (countries/us/events.ts); the others are Japan's, and a life meets only its own country's
EVENTS.register(US_SPECS.map(compileSpec))
EVENTS.register(US_DAILY_SPECS.map(compileSpec))
// Korea and Cuba (PROJECT_PLAN §11.46): the events of the countries played through the league flow, tied to where he lives
EVENTS.register(LEAGUE_SPECS.map(compileSpec))
// spending and investing, the news of a place, a second background, languages, public life: events of the country he lives in
// (PROJECT_PLAN §11.41), drawn by the resident pass
EVENTS.register(SPENDING_SPECS.map(compileSpec))
EVENTS.register(PUBLIC_SPECS.map(compileSpec))
// the event packs (src/engine/packs): registered so that their questions can be answered; drawn only by their own pass (packYear),
// never by the passes above (events.ts leaves out an event with a pack)
EVENTS.register(PACK_EVENTS)

// Japan pipeline (PROJECT_PLAN §6.3). Male players only (§2-4). All texts are original.
// Engine functions mutate the LifeState they are given; the UI passes a copy.

export const BASE_YEAR = 2026
export const PLAYING: Phase[] = ['youth', 'jhs', 'hs', 'univ', 'company', 'indep', 'proMinor', 'pro', 'abroad']

export interface Sim {
  params: Params
  /** headless runs (cohort, calibration) skip breath screens and decorative lines */
  headless?: boolean
  tally?: (key: string, ok: boolean) => void
  observe?: (key: string, value: number) => void
}

interface Pending {
  id: string
  data: Record<string, number | boolean | string>
}

/** at most this many decisions in one year (the first, plus queued ones) */
const DECISIONS_PER_YEAR = 3

type StateWithPending = LifeState & { pending?: Pending; queue?: (Pending & { decision: Decision })[] }

// ---------------------------------------------------------------- creation

export function createLife(config: LifeConfig): LifeState {
  // a US life draws its birth from a stream of its own and its place and names from the US tables (PROJECT_PLAN §11.31);
  // Japan's draws are the same calls in the same order as before
  const us = config.country === 'US'
  // (Korea and Cuba: the league profile's tables and a stream of their own, PROJECT_PLAN §11.46)
  const lp = leagueProfile(config.country)
  const rng = makeRng(hashSeed(config.seed ^ (us ? 0x75735f01 : lp ? (lp.cc === 'KR' ? 0x6b725f01 : 0x63755f01) : 0xa5a5a5a5)))
  const prefecture =
    config.prefecture ??
    (lp ? lp.regions.indexOf(rng.weighted(lp.regions, lp.regions.map((p) => p.births))) : us ? US_STATES.indexOf(rng.weighted(US_STATES, US_STATES.map((p) => p.births))) : PREFECTURES.indexOf(rng.weighted(PREFECTURES, PREFECTURES.map((p) => p.births))))
  const throws: 'R' | 'L' = rng.chance(0.1) ? 'L' : 'R'
  const parentBaseball = rng.weighted(['none', 'hs', 'univ', 'company'] as const, [70, 22, 6, 2])
  const z = rng.normal() * 0.95 + (parentBaseball === 'none' ? -0.05 : 0.15)
  const s: StateWithPending = {
    v: 1,
    config,
    person: {
      family: rng.pick(lp ? lp.family : us ? US_FAMILY_NAMES : FAMILY_NAMES),
      given: rng.pick(lp ? lp.given : us ? US_GIVEN_NAMES : GIVEN_NAMES),
      birthYear: BASE_YEAR,
      birthMonth: rng.int(1, 12),
      country: config.country,
      prefecture,
      wealth: rng.int(1, 5),
      throws,
      bats: throws === 'L' ? 'L' : rng.chance(0.2) ? 'L' : 'R',
      position: 'IF',
      heightCm: Math.round(171 + rng.normal() * 6),
      parentBaseball,
    },
    age: 0,
    year: BASE_YEAR,
    alive: true,
    z,
    status: {
      health: clamp(Math.round(72 + rng.normal() * 8), 30, 95),
      happiness: 60,
      relations: 55,
      knowledge: clamp(Math.round(50 + rng.normal() * 15), 5, 95),
    },
    focus: 'people',
    career: {
      phase: 'child',
      team: '',
      highestRank: 0,
      achievements: [],
      yearsPlaying: 0,
      startedAge: 8,
      endedAge: null,
      phaseYears: 0,
      strongSchool: false,
      softballClub: true,
      injured: 0,
      proDebut: false,
      proSeasons: 0,
      minorSeasons: 0,
      salary: 0,
    },
    family: {
      father: rng.int(28, 40),
      mother: rng.int(26, 38),
      spouse: null,
      children: 0,
      everMarried: false,
    },
    money: 0,
    income: 0,
    lifetimeIncome: 0,
    job: '',
    log: [],
    timeline: [],
    taken: [],
    autoDecide: false,
    memos: [],
    happiestAge: 0,
    happiestValue: 0,
  }
  // the potential mode: the hidden talent comes from a stream of its own (potential.ts); the normal mode has none of it
  if (config.mode === 'potential') {
    s.pot = initPotential(config, z, s.person.wealth)
    s.z = s.pot.base
    // the body is part of the gift (PROJECT_PLAN §11.62): the adult height drawn above moves up with the ★, by the same amount for
    // everyone of that ★ (no new draw; the spread stays the normal one, 6 cm): ★1 as the normal mode, 1.5 cm more for each ★, so ★10
    // is 13.5 cm taller on average (about 184.5 cm; the owner's choice, PROJECT_PLAN §11.63). The growth curve and the abilities follow it.
    s.person.heightCm = Math.round(s.person.heightCm + 1.5 * (starOf(config.stars ?? 1) - 1))
  }
  // languages and a second background: a stream of its own, nothing of the life's other draws (language.ts)
  initBackground(s)
  return s
}

// ---------------------------------------------------------------- helpers

export function isPlaying(s: LifeState): boolean {
  return PLAYING.includes(s.career.phase)
}

export function setFocus(s: LifeState, f: Focus): void {
  s.focus = f
}

export function setAutoDecide(s: LifeState, on: boolean): void {
  s.autoDecide = on
}

export function prefName(s: LifeState): string {
  // the place of birth: a prefecture for Japan, a state for the US (a life without a country is Japan's)
  if (s.person.country === 'US') return US_STATES[s.person.prefecture]?.name ?? 'アメリカ'
  const lp = leagueProfile(s.person.country)
  if (lp) return lp.regions[s.person.prefecture]?.name ?? COUNTRY_INFO[lp.cc].label
  return PREFECTURES[s.person.prefecture]?.name ?? '日本'
}

function region(s: LifeState): string {
  return PREFECTURES[s.person.prefecture]?.region ?? ''
}

export function fullName(s: LifeState): string {
  // English names are written given name first
  return s.person.country === 'US' || leagueProfile(s.person.country)?.givenFirst ? `${s.person.given} ${s.person.family}` : `${s.person.family} ${s.person.given}`
}

function idHash(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return (h >>> 0) % 100000
}

function yearRng(s: LifeState, salt = 0): Rng {
  return makeRng(hashSeed(s.config.seed ^ Math.imul(s.age + 1, 0x9e3779b1) ^ Math.imul(salt + 7, 0x85ebca6b)))
}

interface QuitNote {
  from: 'hs' | 'univ'
  /** the stop was an injury (the first reason of the list), not a choice of the player's own */
  injury: boolean
  team: string
  phaseYears: number
  orgId: string
  amateurTeam: string
}

export class YearCtx {
  events: TimedEntry[] = []
  decision?: { at: number; decision: Decision }
  readonly s: StateWithPending
  readonly rng: Rng
  readonly sim: Sim
  private slot = 0
  /** the calibrated check ended his playing this year: what to put back if he chooses to come back (screen only) */
  quitNote?: QuitNote
  /**
   * the line that ended it ("…野球部をやめました", the screen stops on it) and the same reason without the end: when the question of
   * coming back follows (askQuitCrossroads), the line tells only the reason, and the answer tells the end
   */
  quitLine?: { entry: LogEntry; cause: string }
  /** the draw sent a student to work at 18: the screen asks whether he would rather sit a university's exam (askUnivInstead) */
  univInstead?: boolean

  constructor(s: StateWithPending, rng: Rng, sim: Sim) {
    this.s = s
    this.rng = rng
    this.sim = sim
  }

  add(kind: LogKind, text: string, opts: EventAddOpts = {}, rng: Rng = this.rng) {
    const at = opts.at ?? clamp(0.06 + this.slot * 0.11 + rng.next() * 0.08, 0.02, this.decision ? 0.55 : 0.94)
    this.slot++
    const entry: LogEntry = { age: this.s.age, year: this.s.year, kind, text }
    if (opts.statIds) entry.statIds = opts.statIds
    if (opts.key) entry.key = true
    if (opts.eventId) entry.eventId = opts.eventId
    if (opts.category) entry.category = opts.category
    if (opts.roster) entry.roster = opts.roster
    if (opts.stop) entry.stop = opts.stop
    this.events.push({ at, entry })
  }

  /**
   * decisions counted against the yearly limit; the 節目 screen (UI only) does not count, so a life
   * played on screen meets the same decisions as the same life run headless
   */
  private decisionsUsed(): number {
    return (this.decision && this.decision.decision.id !== 'breath' ? 1 : 0) + (this.s.queue?.length ?? 0)
  }

  /** a decision after the year's first one waits in a queue (shown one after another) */
  queueAsk(decision: Decision, data: Record<string, number | boolean | string> = {}) {
    if (!this.decision) return this.ask(decision, data)
    if (this.decisionsUsed() < DECISIONS_PER_YEAR) (this.s.queue ??= []).push({ id: decision.id, data, decision })
  }

  canAsk(): boolean {
    return this.decisionsUsed() < DECISIONS_PER_YEAR
  }

  /**
   * a question of the event packs (packYear): asked after everything else of the year, behind any question already there. Alone in
   * its year it comes at the end of the year (0.97, after the year's lines), so unlike `ask` it moves no line already written.
   */
  askLast(decision: Decision, data: Record<string, number | boolean | string> = {}) {
    if (this.decision) {
      if (this.decisionsUsed() < DECISIONS_PER_YEAR) (this.s.queue ??= []).push({ id: decision.id, data, decision })
      return
    }
    this.decision = { at: 0.97, decision }
    this.s.pending = { id: decision.id, data }
  }

  /** a context for catalog events: their own random stream, so career draws stay as calibrated */
  eventCtx(salt = 0): EventCtx {
    const rng = eventRng(this.s, salt)
    return {
      s: this.s,
      rng,
      headless: !!this.sim.headless,
      add: (kind, text, opts) => this.add(kind, text, opts, rng),
      ask: (decision, data) => this.queueAsk(decision, data),
      canAsk: () => this.canAsk(),
    }
  }

  /** decorative lines are skipped in headless runs (and use their own stream, so they change nothing) */
  flavor(kind: LogKind, text: string) {
    if (!this.sim.headless) this.add(kind, text, {}, eventRng(this.s, 0xf1a8))
  }

  ask(decision: Decision, data: Record<string, number | boolean | string> = {}) {
    if (this.decision) return
    this.decision = { at: 0.6, decision }
    this.s.pending = { id: decision.id, data }
    // the lines written before the question come before it on the screen (they were placed as if no question would come, some after
    // 0.6; PROJECT_PLAN §11.61): kept in their order, just before the question. Only the time on screen moves (nothing is drawn).
    const late = this.events.filter((e) => e.at >= 0.56).sort((a, b) => a.at - b.at)
    late.forEach((e, i) => (e.at = 0.56 + ((i + 1) * 0.035) / (late.length + 1)))
  }

  p(key: string, ctx = 0): number {
    // potential mode: whoever picks him (the scouts and the draft, a university, a company team, an independent club) adds what
    // they believe of his promise to what he can do now (potential.ts)
    const pot = this.s.pot
    // (★1 is the baseline model: its recruiters weigh the promise only where the first version of the model did, in the file and the draft)
    const picked = !!pot && PICKED_BY.test(key) && (starOf(pot.stars) > 1 || /File|Draft/.test(key))
    const z = picked ? this.s.z + (SHIHAIKA.test(key) ? 1.2 + starParams(pot!.stars).shi : 1.2) * scoutPremium(this.s) : this.s.z
    return passProb(this.sim.params, key, z, ctx)
  }

  /** draw a calibrated check and report it for calibration */
  check(key: string, ctx = 0): boolean {
    const ok = this.rng.next() < this.p(key, ctx)
    this.sim.tally?.(key, ok)
    return ok
  }
}

function reachRank(s: LifeState, rank: number) {
  if (rank > s.career.highestRank) s.career.highestRank = rank
}

function achieve(s: LifeState, a: string) {
  if (!s.career.achievements.includes(a)) s.career.achievements.push(a)
}

function setPhase(s: LifeState, phase: Phase, team: string) {
  s.career.phase = phase
  s.career.team = team
  // the new phase starts counting from next year (endYear adds 1)
  s.career.phaseYears = -1
}

function endBaseball(s: LifeState, age: number) {
  if (s.career.endedAge === null) s.career.endedAge = age
  setPhase(s, 'retired', '')
  s.career.orgId = undefined
  s.career.amateurTeam = undefined
}

function pct(z: number): number {
  return normCdf(z)
}

// ---------------------------------------------------------------- scouts (PROJECT_PLAN §11.8, stat scoutModel)

/**
 * the scouts' attention this year: from the calibrated chance of the 志望届 or draft check ahead (read, not
 * drawn, so nothing calibrated moves) and the season's record; below the visiting stage until that check
 */
function scoutUpdate(y: YearCtx, key: string, level: Level) {
  const s = y.s
  const b = s.bb
  if (!b) return
  const base = Math.round(100 * Math.pow(y.p(key), 0.4))
  const koshien = level === 'hs' && s.career.achievements.includes('甲子園') ? 4 : 0
  // the same record counts for more from a stronger league or team (the scouts know where he plays)
  const kindMean = { univ: UNIV_MEAN, company: COMPANY_MEAN, indep: INDEP_MEAN }[s.career.phase as 'univ' | 'company' | 'indep']
  const league = kindMean === undefined || level === 'hs' ? 0 : Math.round(8 * clamp((b.teamStrength - kindMean) / 0.5, -1, 1))
  const promise = s.pot ? Math.round(25 * scoutPremium(s)) : 0
  b.scout = clamp(base + scoutPerf(lineAt(s, s.age, level), level) + koshien + league + promise, 0, SCOUT_VISIT - 1)
}

/** the calibrated check has brought scouts (a 志望届 worth filing, or a draft): the visiting stage */
function scoutsCame(y: YearCtx, text: string) {
  const b = y.s.bb
  if (!b) return
  b.scout = clamp((b.scout ?? 0) + 20, SCOUT_VISIT, 95)
  y.add('good', text, { statIds: ['scoutModel'] }, eventRng(y.s, 0x5c0))
}

// ---------------------------------------------------------------- the year

export function planYear(state: LifeState, sim: Sim): YearPlan {
  const s = state as StateWithPending
  delete s.pending
  delete s.queue
  // saves from before the ability model: give a playing career its details
  if (!s.bb && isPlaying(s)) s.bb = initBaseball(s, eventRng(s, 0xbb))
  const y = new YearCtx(s, yearRng(s), sim)
  if (s.age === 0) birth(y)
  // (the second 入部テスト comes in the spring, before the season: only a student who chose it on screen)
  univRetryYear(y)
  baseballYear(y)
  lifeYear(y)
  // the end of playing by injury or leaving the team: on screen only (like the wish), after the calibrated check, so the
  // headless life and its fingerprint keep おまかせ's answer (the end); nothing already asked this year is displaced
  if (!sim.headless && y.quitNote && !y.decision) askQuitCrossroads(y, y.quitNote)
  if (!sim.headless && !y.decision) breath(y)
  // (while he may still come back, the year's catalog events wait: they read him as retired and would start his working life;
  // once he has ended baseball for good they run in the same year, as in the headless life: yearEvents in the resolver)
  // (a year of 浪人 has no team: the university's events wait for the year he enters)
  const ronin = s.career.phase === 'univ' && s.career.phaseYears < 0 && s.flags?.['univ.ronin'] !== undefined
  const eventsNow = y.decision?.decision.id !== 'jp.quitCross' && !ronin
  if (eventsNow) yearEvents(y)
  // a student the draw sent to work at 18 may still choose a university (screen only, after the year's events: afterBaseballPath)
  if (y.univInstead) askUnivInstead(y)
  // 世間の小ネタ: screen only, log only, on its own stream (trendLog.ts)
  // (the trend lines and the free agency and credit questions are Japan's: a US life has its own, countries/us)
  const jp = s.person.country === 'JP' || s.person.country === undefined
  if (!sim.headless && jp) trendPass(y.eventCtx(0x7e4d))
  // the wished position at the start of a stage: on screen only, and only when nothing else is asked this year
  if (!sim.headless && jp && !y.decision) askFa(y)
  if (!sim.headless && jp && !y.decision) askCredits(y)
  if (!sim.headless && !y.decision) askWish(y)
  statusYear(y)
  mortality(y)
  // the event packs: last, in the years whose catalog events ran above (a year whose events wait for a resolver gets them there)
  if (eventsNow) packYear(y)
  stageEndingLast(y)
  dropStaleFirst(y)
  y.events.sort((a, b) => a.at - b.at)
  return { events: y.events, decision: y.decision }
}

/**
 * The questions that end a stage: the 志望届 and the route after school, the release from a pro club. The year's other questions
 * were drawn while he was still at that stage (a talk about his future in the third year, the spring camp), so they come before it,
 * as in the year itself; asked after it, they spoke to a man who had already turned pro, entered a university or left the club.
 */
const STAGE_ENDING = new Set(['jp.hsFile', 'jp.route', 'jp.univFile', 'jp.release'])

/**
 * The stage-ending question of the year goes behind the questions waiting in the queue. Only the order in which they are asked
 * changes: every question was already drawn, and each answer is drawn on a stream of its own (the question's id), whatever comes first.
 */
function stageEndingLast(y: YearCtx) {
  const s = y.s as StateWithPending
  if (!y.decision || !s.pending || !STAGE_ENDING.has(y.decision.decision.id) || !s.queue?.length) return
  const first = s.queue.shift()!
  s.queue.push({ id: s.pending.id, data: s.pending.data, decision: y.decision.decision })
  y.decision = { at: y.decision.at, decision: first.decision }
  s.pending = { id: first.id, data: first.data }
}

/**
 * A question of the catalog that no longer fits the state when its turn comes: its `requires` fails (he lost the job it speaks of), or
 * an earlier answer of the year moved him to a stage the event does not belong to (he retired, turned pro, left the team).
 */
function staleQuestion(s: LifeState, id: string): boolean {
  const def = EVENTS.get(id)
  if (!def) return false
  return def.requires?.(s) === false || !def.stages.includes(stageOf(s))
}

/**
 * The year's first question may have been written before a later event of the same year changed what it speaks of (a question about
 * his boss, then a lay-off): like the questions waiting behind it (resolveDecision, PROJECT_PLAN §11.61), one whose event no longer
 * fits the state gives way to the next that does, at the same moment of the year; with none left, the year asks nothing.
 */
function dropStaleFirst(y: YearCtx) {
  const s = y.s as StateWithPending
  while (y.decision && staleQuestion(s, y.decision.decision.id)) {
    let next = s.queue?.shift()
    while (next && staleQuestion(s, next.id)) next = s.queue?.shift()
    if (next) {
      y.decision = { at: y.decision.at, decision: next.decision }
      s.pending = { id: next.id, data: next.data }
    } else {
      y.decision = undefined
      delete s.pending
    }
  }
}

function yearEvents(y: YearCtx) {
  runYearEvents(EVENTS, y.eventCtx())
  runExtraEvents(EVENTS, y.eventCtx(0xe7a))
  // everyday life of the playing years: love, family, rumours (its own stream; PROJECT_PLAN §11.33)
  runLifePass(EVENTS, y.eventCtx(0x11fe))
  // daily life of the country he lives in, whichever country he was born in (own stream; PROJECT_PLAN §11.37)
  runResidentPass(EVENTS, y.eventCtx(0x2e51))
}

/**
 * The event packs (src/engine/packs) of the year: after everything else of it (planYear: after the questions shown on screen only,
 * the status and the death rate; a resolver: after its catalog events), on their own stream, their question asked last (askLast).
 * With no pack, or with his country switched off, nothing is drawn or written.
 */
function packYear(y: YearCtx) {
  if (!y.s.alive) return
  const c = y.eventCtx(PACK_SALT)
  runPackPass({ ...c, ask: (decision, data) => y.askLast(decision, data) })
}

export function endYear(state: LifeState): void {
  const s = state as StateWithPending
  delete s.pending
  delete s.queue
  // choices made after the year's practice may have shifted the profile: keep it centred on z
  if (s.bb) centre(s.bb.skills)
  s.timeline.push({ age: s.age, rank: s.career.highestRank, phase: s.career.phase, happiness: s.status.happiness })
  if (s.status.happiness > s.happiestValue) {
    s.happiestValue = s.status.happiness
    s.happiestAge = s.age
  }
  if (!s.alive) return
  if (isPlaying(s)) s.career.yearsPlaying++
  s.career.phaseYears++
  if (s.bb) {
    // injury history for the scouts' view (counted once per spell)
    if (s.career.injured > 0 && !s.bb.hurt) s.bb.injuries = (s.bb.injuries ?? 0) + 1
    s.bb.hurt = s.career.injured > 0
  }
  if (s.career.injured > 0) s.career.injured--
  if (s.family.father !== null) s.family.father++
  if (s.family.mother !== null) s.family.mother++
  if (s.family.spouse) s.family.spouse.years++
  if (s.family.kids) s.family.kids = s.family.kids.map((k) => k + 1)
  if (s.after?.work) s.after.work.years++
  // a parent who has died no longer needs care
  if (s.after?.care && s.family.father === null && s.family.mother === null) s.after.care = false
  s.age++
  s.year++
}

export interface Resolution {
  events: TimedEntry[]
  followUp?: { at: number; decision: Decision }
}

export function resolveDecision(state: LifeState, choice: number, sim: Sim, memo?: string): Resolution {
  const s = state as StateWithPending
  const pending = s.pending
  if (!pending) return { events: [] }
  delete s.pending
  s.taken.push(pending.id)
  const y = new YearCtx(s, yearRng(s, idHash(pending.id)), sim)
  const before = y.events.length
  const resolver = RESOLVERS[pending.id] ?? US_RESOLVERS[pending.id] ?? LEAGUE_RESOLVERS[pending.id]
  if (memo && memo.trim()) s.memos.push({ age: s.age, text: memo.trim().slice(0, 200) })
  if (resolver) resolver(y, choice, pending.data)
  else {
    // a decision opened by a catalog event
    const def = EVENTS.get(pending.id)
    if (def?.resolve) def.resolve(tagged(y.eventCtx(idHash(pending.id)), def), choice, pending.data)
  }
  // outcome lines go after the decision point
  y.events.slice(before).forEach((e, i) => {
    e.at = clamp(0.64 + i * 0.07 + y.rng.next() * 0.03, 0.62, 0.97)
  })
  if (y.decision) return { events: y.events, followUp: { at: 0.8, decision: y.decision.decision } }
  // the next decision waiting this year; one whose event no longer fits the state (an earlier answer this year changed it, e.g. he
  // lost the job it speaks of) is dropped (PROJECT_PLAN §11.61)
  let next = s.alive ? s.queue?.shift() : undefined
  while (next && staleQuestion(s, next.id)) next = s.queue?.shift()
  if (next) {
    s.pending = { id: next.id, data: next.data }
    return { events: y.events, followUp: { at: 0.8, decision: next.decision } }
  }
  return { events: y.events }
}

/** Run a whole life without UI, answering every decision with おまかせ. */
export function runHeadless(config: LifeConfig, sim: Sim, stopWhenBaseballEnds = false): LifeState {
  const s = createLife(config)
  const hs = { ...sim, headless: true }
  for (let guard = 0; guard < 130 && s.alive; guard++) {
    const plan = planYear(s, hs)
    let d = plan.decision?.decision
    while (d && s.alive) {
      const r = resolveDecision(s, d.autoIndex, hs)
      d = r.followUp?.decision
    }
    endYear(s)
    if (stopWhenBaseballEnds && s.career.endedAge !== null && !isPlaying(s)) break
  }
  return s
}

/** Play the rest of a life at once (「結果だけ」), keeping the log, answering decisions with おまかせ. */
export function playToEnd(s: LifeState, sim: Sim): void {
  const quiet = { ...sim, headless: false }
  for (let guard = 0; guard < 130 && s.alive; guard++) {
    const plan = planYear(s, { ...quiet, headless: true })
    // headless planning keeps the main life's decisions identical; decorative lines are skipped for speed
    for (const e of plan.events) s.log.push(e.entry)
    let d = plan.decision?.decision
    while (d && s.alive) {
      const r = resolveDecision(s, d.autoIndex, quiet)
      for (const e of r.events) s.log.push(e.entry)
      d = r.followUp?.decision
    }
    endYear(s)
  }
}

// ---------------------------------------------------------------- birth & childhood

function birth(y: YearCtx) {
  const s = y.s
  if (s.person.country === 'US') {
    y.add('big', usBirthLine(s, prefName(s)), { at: 0.03, key: true })
    return
  }
  if (leagueProfile(s.person.country)) {
    y.add('big', leagueBirthLine(s, prefName(s)), { at: 0.03, key: true })
    return
  }
  const fam = { none: '野球とは縁のない', hs: '父が高校で野球をしていた', univ: '父が大学まで野球を続けた', company: '父が社会人野球でプレーした' }[
    s.person.parentBaseball
  ]
  y.add(
    'big',
    `${s.year}年${s.person.birthMonth}月、${prefName(s)}で男の子が生まれました。名前は${s.person.given}。${fam}家庭です。`,
    { at: 0.03, key: true },
  )
}

// everyday lines for each stage live in eventCatalog.ts (drawn by the event scheduler)

function childYear(y: YearCtx) {
  const s = y.s
  if (s.age === 6) y.add('milestone', '小学校に入学しました。')
  if (s.age === 7) y.flavor('normal', '近所の友だちに誘われて、学童野球チームの体験会に行きました。')
  if (s.age === 8) {
    setPhase(s, 'youth', '地元の学童野球チーム')
    s.career.startedAge = 8
    reachRank(s, 1)
    s.bb = initBaseball(s, eventRng(s, 0xbb))
    joinTeam(s, 'youth')
    y.add('big', '地元の学童野球チームに入りました。最初のグローブは少し大きめです。', { key: true })
  }
}

// ---------------------------------------------------------------- baseball by phase

function baseballYear(y: YearCtx) {
  const s = y.s
  // another country's life goes through that country's own flow (countries/us/year.ts); Japan's code below is untouched
  if (s.person.country === 'US') return usBaseballYear(y)
  if (leagueProfile(s.person.country)) return leagueBaseballYear(y)
  switch (s.career.phase) {
    case 'child':
      return childYear(y)
    case 'youth':
      return youthYear(y)
    case 'jhs':
      return jhsYear(y)
    case 'hs':
      return hsYear(y)
    case 'univ':
      return univYear(y)
    case 'company':
    case 'indep':
      return amateurYear(y)
    case 'proMinor':
      return ikuseiYear(y)
    case 'pro':
      return proYear(y)
    case 'abroad':
      return abroadYear(y)
    default:
      return
  }
}

function youthYear(y: YearCtx) {
  const s = y.s
  if (s.age === 9) {
    const pos = y.rng.weighted(['P', 'C', 'IF', 'OF'] as const, [20, 12, 40, 28])
    s.person.position = pos
    const name = { P: 'ピッチャー', C: 'キャッチャー', IF: '内野', OF: '外野' }[pos]
    y.add('normal', `守るポジションが${name}に決まりました。`)
  }
  if (s.person.position === 'P' && s.career.injured === 0 && y.rng.chance(0.06)) {
    s.career.injured = 1
    y.add('bad', '投げたあと、肘の内側が痛むようになりました。しばらく投球を休みます。', {
      statIds: ['elbowYouth'],
    })
  }
  if (s.age === 10 && s.person.position !== 'P' && !s.taken.includes('jp.pitch')) {
    y.ask({
      id: 'jp.pitch',
      weight: 'minor',
      title: 'ピッチャーをやってみないか',
      body: `監督から、${s.person.given}にピッチャーをやってみないかと声がかかりました。`,
      choices: [
        { label: 'ピッチャーに挑戦する', hint: '投げる機会が増える。肘を痛める子もいる' },
        { label: '今のポジションを続ける', hint: '慣れた守備で経験を積む' },
      ],
      autoIndex: y.rng.chance(0.2) ? 0 : 1,
      factText: '山形大学などの研究（2007年）では、超音波の肘検診で、小学校の野球チームの選手247人中48人（約19%）に肘の内側の骨の障害（内側上顆の裂離）が見つかった。1つの研究で、全国の値ではない。',
      factStatIds: ['elbowYouth'],
    })
  }
  if (s.age === 11) askJhs(y)
}

function askJhs(y: YearCtx) {
  const s = y.s
  const cont = y.check('jp.jhs')
  const club = cont && (pct(s.z) > 0.7 && s.person.wealth >= 3 ? y.rng.chance(0.6) : y.rng.chance(0.15))
  y.ask(
    {
      id: 'jp.jhs',
      weight: 'major',
      title: '中学では、どこで野球をする？',
      body: '春から中学生です。学校の軟式野球部に入るか、硬式のクラブチームに入るか、それとも野球をやめるか。',
      choices: [
        { label: '中学校の軟式野球部に入る', hint: '学校の仲間と。費用は少なめ' },
        { label: '硬式のクラブチームに入る', hint: '遠征が多く、費用もかかる。高校を見すえて' },
        { label: '野球をやめて、その後の人生を歩む', hint: '勉強や、ほかの好きなことに時間を使う。人生はこのまま続く' },
      ],
      autoIndex: cont ? (club ? 1 : 0) : 2,
      stop: true,
      factText: '中体連の軟式野球の選手は、2025年に139,240人（全学年）。硬式クラブの選手数は確認できていない。',
      factStatIds: ['jpJhsSoft', 'jpJhsContinue'],
    },
    {},
  )
}

function jhsYear(y: YearCtx) {
  const s = y.s
  if (s.age === 13) announce(y, '新チームの大会', 0x13)
  if (s.age === 14) {
    announce(y, '中学最後の大会', 0x14)
    const good = pct(s.z) > 0.8 || (!s.career.softballClub && pct(s.z) > 0.6)
    y.add(good ? 'good' : 'normal', good ? '中学最後の大会で、県のベスト4に入りました。' : '中学最後の大会が終わりました。悔しくて、しばらく黙っていました。')
    askHs(y)
  }
}

function askHs(y: YearCtx) {
  const s = y.s
  const join = y.check('jp.hs')
  const strongOffer = pct(s.z) > 0.88 && y.rng.chance(0.6)
  const choices = [
    // (the school is chosen next, among those near his own marks: the public school is not a school for good marks by itself)
    { label: '地元の公立高校で野球部に入る', hint: `通いやすく、練習の負担は強豪ほど重くない。入れる学校は学力しだい（いまの偏差値の目安${Math.round(studentDev(s))}）` },
    { label: '高校では野球をやめて、その後の人生を歩む', hint: '勉強や、ほかの道に時間を使う。人生はこのまま続く' },
  ]
  if (strongOffer) choices.unshift({ label: '強豪私立の推薦を受ける', hint: '甲子園に近い。部員が多く、競争も激しい' })
  let auto = choices.length - 1
  if (join) auto = strongOffer && y.rng.chance(0.75) ? 0 : strongOffer ? 1 : 0
  y.ask(
    {
      id: 'jp.hs',
      weight: 'major',
      title: '高校で硬式野球を続ける？',
      body: strongOffer
        ? '中学での活躍を見た県内の強豪私立から、推薦の話が来ました。'
        : '高校受験が近づいてきました。硬式野球部のある高校を選ぶかどうか。',
      choices,
      autoIndex: auto,
      stop: true,
      factText: `高校の硬式野球部の1年生は、2026年5月末に43,836人。中学の軟式野球の選手は、2025年に1学年あたり約4.6万人（全学年139,240人）。`,
      factStatIds: ['jpHsFirstYears', 'jpJhsSoft'],
    },
    { strongOffer },
  )
}

function koshienCtx(s: LifeState): number {
  // (the prefecture of his high school, where he plays the summer tournament: the one he was born in unless he went away to school)
  const teams = PREFECTURES[hsPrefecture(s)]?.teams ?? 70
  // being on the Koshien bench needs a place in the squad (assumption on the size of the effect)
  const role = s.bb?.role
  const roleCtx = role === 'starter' ? 0.45 : role === 'bench' ? 0.25 : role === 'outside' ? -1.2 : 0
  return (s.career.strongSchool ? 0.7 : -0.15) - 0.35 * Math.log(teams / 70.4) + roleCtx
}

type TeamKind = 'youth' | 'jhsSoft' | 'jhsClub' | 'hsStrong' | 'hsPublic' | 'univ' | 'company' | 'indep' | 'pro'

/** team size and strength (z scale) when joining a team — model settings (stats hsTeamModel, seasonModel) */
function joinTeam(s: LifeState, kind: TeamKind) {
  // where he lives with the team (place.ts; shown only): a pro club's home is not kept by the game; a company or an independent team's
  // prefecture when the lists give it (a team of his own region, he goes to from home)
  if (kind === 'pro') moveUnknown(s)
  else if (kind === 'company') settleWithTeam(s, s.career.amateurTeam)
  else if (kind === 'indep') settleAt(s, INDEP_PREF[s.career.orgId ?? ''])
  const b = s.bb
  if (!b) return
  const r = eventRng(s, 0x7ea + kind.length * 31)
  const lognorm = (median: number, sd: number) => Math.round(median * Math.exp(r.normal() * sd))
  const spec: Record<TeamKind, [number, number, number, number]> = {
    // [median size, sd, strength, strength sd]
    youth: [18, 0.3, -0.1, 0.3],
    jhsSoft: [22, 0.35, 0, 0.3],
    jhsClub: [40, 0.3, 0.45, 0.25],
    hsStrong: [95, 0.2, 0.9, 0.2],
    hsPublic: [30, 0.4, -0.15, 0.3],
    ...TEAM_AFTER_HS,
  }
  const [m, sd, st, stSd] = spec[kind]
  b.teamSize = clamp(lognorm(m, sd), kind === 'hsPublic' ? 10 : 12, 140)
  b.teamStrength = st + r.normal() * stSd
  b.role = 'none'
  b.subRole = undefined
  b.number = undefined
  b.captain = undefined
  // an NPB club has its own strength (its record over the last three seasons); not read by anything calibrated
  if (kind === 'pro') {
    const rt = npbRating(s.career.orgId)
    if (rt) applyTeamRating(s, rt, NPB_MEAN)
  }
}

/**
 * After high school the team's own strength (its league, a place in the 日本選手権's list: route/rating.ts)
 * replaces the generic draw made on joining, and a stronger team has more players. Nothing calibrated reads
 * the strength or the squad after high school (only the games, the squad and the scouts' view do), so the
 * calibrated careers are unchanged. In high school the draw stays as calibrated.
 */
function applyTeamRating(s: LifeState, rt: TeamRating, mean: number) {
  const b = s.bb
  const ph = s.career.phase
  if (!b || (ph !== 'univ' && ph !== 'company' && ph !== 'indep' && ph !== 'pro' && ph !== 'proMinor')) return
  const r = eventRng(s, 0x7ea9)
  b.teamStrength = rt.value + r.normal() * 0.08
  // (a pro club's squad is the same size whatever its strength)
  if (ph !== 'pro' && ph !== 'proMinor') b.teamSize = clamp(squadSize(Math.round(TEAM_AFTER_HS[ph][0] * Math.exp(r.normal() * 0.15)), rt, mean), 12, 140)
}

/** the rating of the university he plays for (from the real school; an overseas team carries its own number) */
function univTeamRating(s: LifeState): TeamRating | undefined {
  const u = s.schools?.univ
  if (!u) return undefined
  if (u.rating !== undefined) return { value: u.rating, basis: u.ratingBasis ?? 'estimated', ...(u.league ? { league: u.league } : {}), why: '' }
  const x = schoolById(u.id)
  return x ? univRating(x) : undefined
}

const POS_NUMBERS: Record<Position, number[]> = { P: [1], C: [2], IF: [3, 4, 5, 6], OF: [7, 8, 9] }

/** squads after high school: university (four grades) and company or independent teams (no grades) */
const UNIV_SQUAD = { bench: BENCH_SIZE_ADULT, shifts: UNIV_GRADE_SHIFT }
const ADULT_SQUAD = { bench: BENCH_SIZE_ADULT, shifts: NO_GRADE_SHIFT }

/** the squad for a tournament: starter, bench or out, with the shirt number (high school by default) */
function announce(y: YearCtx, label: string, salt: number, squad: { bench: number; shifts?: number[] } = { bench: BENCH_SIZE }) {
  const s = y.s
  const b = s.bb
  if (!b) return
  const r = eventRng(s, salt)
  const prev = b.role
  if (s.career.injured > 0) {
    b.role = 'outside'
    b.number = undefined
    y.add('bad', `${label}のメンバーから、けがのため外れました。`, { eventId: 'hs.roster', category: 'roster', roster: { role: 'outside' } }, r)
    return
  }
  const grade = s.career.phaseYears + 1
  const bench = squad.bench
  const { better, betterAtPos } = rankInTeam(s, r, grade, squad.shifts)
  if (better < bench && startsAt(s.person.position, betterAtPos)) {
    b.role = 'starter'
    b.number = r.pick(POS_NUMBERS[s.person.position])
    b.subRole = undefined
  } else if (better < bench || b.teamSize <= bench) {
    b.role = 'bench'
    b.number = 10 + Math.min(10, better)
    b.subRole = benchRole(s)
  } else {
    b.role = 'outside'
    b.number = undefined
  }
  // (the squad as announced now: the panel shows it while this line is the latest one revealed)
  const tag = { eventId: 'hs.roster', category: 'roster', roster: { role: b.role, ...(b.number !== undefined ? { number: b.number } : {}) } }
  const st = s.status
  if (b.role === 'starter') {
    const first = prev !== 'starter'
    if (first) {
      b.confidence = clamp(b.confidence + 10, 0, 100)
      st.happiness = clamp(st.happiness + 6, 5, 100)
    }
    y.add(first ? 'big' : 'good', first ? `${label}で、背番号${b.number}をもらいました。レギュラーです。` : `${label}も、背番号${b.number}でレギュラーとして出場します。`, { ...tag, key: first && grade >= 2 }, r)
  } else if (b.role === 'bench') {
    if (prev === 'starter') {
      b.confidence = clamp(b.confidence - 10, 0, 100)
      st.happiness = clamp(st.happiness - 6, 5, 100)
      y.add('bad', `${label}は背番号${b.number}。レギュラーの座を失い、${subRoleLabel(s)}での出番を待つ立場になりました。`, { ...tag, key: true }, r)
    } else {
      y.add(prev === 'outside' || prev === 'none' ? 'good' : 'milestone', `${label}のベンチ入りメンバーに選ばれました。背番号${b.number}、${subRoleLabel(s)}としての出番を待ちます。`, tag, r)
    }
  } else {
    b.confidence = clamp(b.confidence - (prev === 'bench' || prev === 'starter' ? 10 : 3), 0, 100)
    if (prev === 'bench' || prev === 'starter') st.happiness = clamp(st.happiness - 5, 5, 100)
    y.add(prev === 'bench' || prev === 'starter' ? 'bad' : 'milestone', prev === 'bench' || prev === 'starter' ? `${label}のメンバー発表で、名前は呼ばれませんでした。ベンチから外れました。` : `${label}のベンチ入りはかないませんでした。スタンドから声を出します。`, tag, r)
  }
}

/** players with a place in the team quit less (assumption on the size; calibrated to the 3-year rate) */
function stayCtx(s: LifeState): number {
  const role = s.bb?.role
  const roleCtx = role === 'starter' ? 0.25 : role === 'bench' ? 0.1 : role === 'outside' ? -0.15 : 0
  return roleCtx + (s.status.happiness < 35 ? -0.2 : 0)
}

function hsYear(y: YearCtx) {
  const s = y.s
  // staying on the team this year
  const stay = y.check('jp.hsStay', (s.career.strongSchool ? 0.1 : 0) + stayCtx(s))
  if (!stay) {
    // [the line that ends it, the same reason before the end]; an injury is the reason only of one who has been hurt (quitWeights)
    const reasons: [string, string][] = [
      ['故障が長引き、医師に止められて野球部をやめました。', '故障が長引き、医師から練習を止められました。'],
      ['勉強に専念するため、野球部をやめました。', '勉強に専念したい気持ちが、強くなってきました。'],
      ['部の雰囲気になじめず、野球部をやめました。', '部の雰囲気になじめず、練習から足が遠のきました。'],
      ['家の事情でアルバイトを始め、野球部をやめました。', '家の事情でアルバイトを始め、練習に出られない日が続きました。'],
    ]
    const why = y.rng.weighted(reasons, quitWeights(s, reasons.length))
    y.add('bad', why[0], { key: true, stop: 'quit' })
    y.quitLine = { entry: y.events[y.events.length - 1].entry, cause: why[1] }
    y.quitNote = noteQuit(s, 'hs', why === reasons[0])
    endBaseball(s, s.age)
    return
  }
  const year = s.career.phaseYears + 1
  s.career.team = `高校${year}年・${s.schools?.hs?.name ?? (s.career.strongSchool ? '県内の強豪私立高校' : '地元の公立高校')}`
  // the season (stage 3): tournaments and practice games, drawn on the event stream
  const season = y.eventCtx(0x5ea + year)
  if (s.bb) orgNote(y)
  if (s.bb && year >= 2) springTournament(season)
  announce(y, year === 3 ? '最後の夏の大会' : `${year}年生の夏の大会`, 0x5a + year)
  const overuse = s.taken.includes('jp.overuse.push') ? 0.2 : 0
  const koshien = y.check('jp.koshien', koshienCtx(s) + overuse)
  // the statistic is a place on the Koshien bench: the squad is chosen again for the national stage
  if (koshien && s.career.injured === 0 && s.bb && s.bb.role === 'outside') {
    s.bb.role = 'bench'
    s.bb.subRole = benchRole(s)
    // (the last place on the national-stage bench: before, he was on the bench with no number at all)
    s.bb.number = 20
  }
  // a Koshien appearance after a good autumn can be 選抜 (spring) instead of the summer championship
  const viaSpring = koshien && !!s.bb?.fallGood && season.rng.chance(0.6)
  if (s.bb) {
    if (viaSpring) springNationals(season)
    summerTournament(season, koshien, viaSpring)
  }
  if (koshien && s.career.injured === 0) {
    if (!s.career.achievements.includes('甲子園')) {
      achieve(s, '甲子園')
      y.add('big', '甲子園の土を踏みました。ベンチ入りメンバーとして、大観衆の前に立ちました。', {
        key: true,
        statIds: ['jpKoshien'],
      })
      s.status.happiness += 8
    } else {
      y.add('good', 'もう一度、甲子園に戻ってきました。')
    }
  }
  if (year <= 2) {
    announce(y, year === 1 ? '新チームで迎える秋の大会' : '最上級生として迎える秋の大会', 0xf0 + year)
    if (s.bb) fallTournament(season)
  }
  if (s.bb) practiceGames(season)
  if (year >= 2) scoutUpdate(y, 'jp.hsFile', 'hs')
  if (s.age === 16) {
    if (s.person.position === 'P') {
      y.ask({
        id: 'jp.overuse',
        weight: 'minor',
        title: '連投するか、休むか',
        body: '秋の大会で3日続けての登板を求められました。腕が重く、肘に張りを感じます。',
        choices: [
          { label: '投げる', hint: '勝ち進めば注目される。故障のおそれもある' },
          { label: '監督に相談して休む', hint: 'チームには迷惑をかけるかもしれない' },
        ],
        autoIndex: y.rng.chance(0.55) ? 0 : 1,
      })
    }
    // (the after-practice choice for other players is the catalog event hs.selfPractice;
    //  the old jp.hsStudy resolver stays for saves made before it)
  }
  if (s.age === 17) hsGraduate(y, koshien)
}

/** the end of the third year (age 17): the record, the scouts, the route (also for one who came back in this year: jp.quitCross) */
function hsGraduate(y: YearCtx, koshien: boolean) {
  const s = y.s
  {
    reachRank(s, 4)
    const atKoshien = koshien && s.career.injured === 0
    const hr = hsCareerHr(s)
    y.add(
      'milestone',
      `${atKoshien ? '最後の夏は、甲子園で終わりました。' : ''}3年間の高校野球が終わりました。${hr > 0 ? `高校通算本塁打は${hr}本（公式戦と練習試合の合計、ゲーム内の記録）。` : ''}`,
      { statIds: ['jpHsComplete'] },
    )
    y.sim.tally?.('jp.koshienEver', s.career.achievements.includes('甲子園'))
    const scouted = y.check('jp.hsFile')
    if (scouted) scoutsCame(y, '3年の夏の大会のあと、プロのスカウトが練習や試合を見に来るようになりました。')
    if (scouted || pct(s.z) > 0.97) {
      y.ask(
        {
          id: 'jp.hsFile',
          weight: 'major',
          title: 'プロ志望届を出す？',
          // (his own standing, in words: the draft check's chance for him, read without drawing; feedback r11 B6)
          body: scouted
            ? `プロのスカウトが、何度か練習を見に来ていました。聞こえてくる評価では、指名の見込みは「${prospect(y.p('jp.hsDraft'))}」です（ゲーム上の推定）。プロ志望届を出しますか。`
            : `スカウトの姿は見かけませんでしたが、プロ志望届は誰でも出せます。指名の見込みは「${prospect(y.p('jp.hsDraft'))}」です（ゲーム上の推定）。`,
          choices: [
            { label: 'プロ志望届を出す', hint: '指名がなければ、ほかの進路を考える' },
            { label: '出さずに進学・就職を考える' },
          ],
          autoIndex: scouted ? 0 : 1,
          factText: '2025年のプロ志望届は高校生124人。そのうち33人（約27%）が指名された（支配下・育成の合計）。',
          factStatIds: ['jpShibouHs', 'jpDraftFromHs', 'jpHsDraftGivenFile'],
        },
        {},
      )
    } else {
      askRoute(y, 'hs')
    }
  }
}

/** Route after high school or university when not going pro. */
function askRoute(y: YearCtx, from: 'hs' | 'univ', returnee = false) {
  const s = y.s
  const wealthCtx = 0.15 * (s.person.wealth - 3)
  const univOffer = from === 'hs' ? y.rng.next() < y.p('jp.hsUniv', wealthCtx) : false
  const companyOffer = y.rng.next() < y.p(from === 'hs' ? 'jp.hsCompany' : 'jp.univCompany')
  const indepPass = y.rng.next() < y.p(from === 'hs' ? 'jp.hsIndep' : 'jp.univIndep')
  const choices: { label: string; hint?: string; key: string }[] = []
  // who has noticed him: the offers above are the calibrated ones; the team and its level are read from the same
  // deterministic picks as the later steps, and the extra doors below are drawn on the event stream (§11.14)
  const ev = evaluate(s)
  if (companyOffer) {
    const t = pickAmateur(s, 0x66)
    const rt = amateurRating(t?.name)
    choices.push({ label: '社会人野球の企業チームに入る', hint: `会社員として働きながら野球を続ける${t && rt ? `。${t.name}から声がかかっている（${ratingText(rt, COMPANY_MEAN)}）` : ''}`, key: 'company' })
  }
  if (univOffer) {
    const inv = inviteSummary(s)
    choices.push({ label: '大学で野球を続ける', hint: `4年後に、もう一度プロを目指せる${inv ? `。${inv}` : ''}`, key: 'univ' })
  }
  choices.push({ label: '独立リーグのトライアウトを受ける', hint: '合格すれば、NPB を目指してプレーできる。収入は少ない', key: 'indep' })
  if (from === 'hs' && !univOffer) {
    choices.push({ label: '大学に入って、野球部の入部テストを受ける', hint: '声はかかっていない。一般入試か推薦で入学し、テストに受かれば野球を続けられる。落ちれば野球はそこまで', key: 'univWalk' })
  }
  if (!companyOffer && JABA_REGION_OF_PREF[prefName(s)]) {
    const club = clubTeamRating()
    choices.push({ label: '社会人のクラブチームで野球を続ける', hint: `仕事を持ちながら、地域のクラブで。実績が少なくても入りやすく、チームの強さはさまざま（${levelWord(club.value - COMPANY_MEAN)}の目安・推定）`, key: 'club' })
  }
  // a US college (NCAA Division I) invites only a player with a standing that high (a game assumption); the colleges are real
  if (from === 'hs' && ev.total >= 2.0) {
    const got = usInvites(s, ev).filter((x) => x.invited)
    if (got.length > 0) {
      const best = got.reduce((a, b) => (b.rating.value > a.rating.value ? b : a))
      choices.push({
        label: '米国の大学で野球を続ける（NCAA 1部）',
        hint: `${best.college.name}など${got.length}校から声がかかっている（${best.rating.league}）。入れるかは別で、言葉の壁もある。短大や NCAA 2部以下は収録していない`,
        key: 'overseas',
      })
    }
  }
  choices.push({
    label: from === 'hs' ? '野球をやめて、進学や就職をする（その後の人生を歩む）' : '野球をやめて就職する（その後の人生を歩む）',
    hint: '新しい道に進む。人生はこのまま続き、仕事・家族・趣味の出来事が待っている',
    key: 'quit',
  })
  const auto = companyOffer ? 0 : univOffer ? choices.findIndex((c) => c.key === 'univ') : indepPass ? choices.findIndex((c) => c.key === 'indep') : choices.findIndex((c) => c.key === 'quit')
  y.ask(
    {
      id: 'jp.route',
      weight: 'major',
      stop: true,
      title: from === 'hs' ? '高校卒業後の進路' : '大学卒業後の進路',
      body: from === 'hs' ? '卒業が近づいてきました。この先も野球を続けるか、別の道に進むか。' : '大学での4年間が終わろうとしています。',
      choices: choices.map(({ label, hint }) => ({ label, hint })),
      autoIndex: auto,
      factText:
        from === 'hs'
          ? '高校からの進路の割合（大学で続ける約20%、社会人約1.2%、独立約0.6%）は、データがないためモデル上の仮定。'
          : '大学からの進路の割合（社会人約6%、独立約2%）は、データがないためモデル上の仮定。',
      factStatIds: from === 'hs' ? ['jpToUniv', 'jpToCompany', 'jpToIndep'] : ['jpUnivToCompany', 'jpUnivToIndep'],
    },
    { from, keys: choices.map((c) => c.key).join(','), indepPass, companyOffer, univOffer, returnee },
  )
}

/** a year of preparing for the entrance exam again (only reached on screen, after the choice jp.ronin); the exam is sat at its end */
function roninYear(y: YearCtx) {
  const s = y.s
  s.career.team = '浪人（予備校）'
  y.add('normal', '予備校に通い、もう一度大学受験に向けて勉強しました。野球から離れた1年でした。')
  askPick(y, 'univ', s.flags?.['univ.roninKind'] === 1 ? 'walkon' : 'student')
}

/**
 * A university year may be repeated (a 留年), but only as the result of a choice he makes (screen only): the おまかせ answer
 * studies and is never held back, so a life played on screen keeps the years of the calibrated one (PROJECT_PLAN §11.25).
 * The rates are assumptions (no source): a player who entered on a sports recommendation is held back less often.
 */
const REPEAT_RISK = 0.3
const REPEAT_SPORTS = 0.35
export function univRepeatP(method: string | undefined): number {
  return REPEAT_RISK * (method === 'sports' ? REPEAT_SPORTS : 1)
}
// ---------------------------------------------------------------- free agency (PROJECT_PLAN §11.28, freeAgent.ts)

/** the usual renewal for next season from this year's line (what proPay would give, without the noise), and the season's worth */
function faBase(s: LifeState): { base: number; value: number; hurt: boolean } | undefined {
  const last = s.career.salaryHist?.at(-1)
  if (!last || last.kind !== 'shihaika' || last.age !== s.age) return undefined
  const line = s.bb?.rec?.tournaments.find((t) => t.age === s.age && t.level === 'pro')?.line
  const value = seasonValue(line, s.person.position === 'P', proType(s) === 'reliever')
  const hurt = (s.bb?.hurt ?? false) || s.career.injured > 0
  return { base: nextSalary(last.salary, value, !!line && line.games > 0, hurt, s.age + 1, 0), value, hurt }
}

/** the offers for next season: the old club's first, then the other clubs' (their picks and terms from a stream of their own) */
function faOffers(s: LifeState): FaOffer[] {
  const b = faBase(s)
  if (!b) return []
  const stay = stayTerms(b.base, s.age)
  const offers: FaOffer[] = [{ orgId: s.career.orgId ?? '', ...stay, guarantee: false, stay: true }]
  const r = orgRng(s, 0xfa51)
  const pool = NPB_ORGS.filter((o) => o.id !== s.career.orgId)
  for (let i = 0; i < suitorCount(b.value, b.hurt) && pool.length > 0; i++) {
    const o = pool.splice(Math.floor(r.next() * pool.length), 1)[0]
    offers.push({ orgId: o.id, ...suitorTerms(b.base, s.age, b.hurt, [r.next(), r.next(), r.next()]), stay: false })
  }
  return offers
}

const faClub = (id: string) => orgLabel(orgById(id))
const faLine = (o: FaOffer) => `${o.stay ? '残留' : faClub(o.orgId)}・${o.years}年・年俸${o.salary.toLocaleString()}万円${o.guarantee ? '・1軍での起用を約束' : ''}`

/** a 支配下 player who has the right, with no contract running, on screen only (the おまかせ answer changes nothing) */
function askFa(y: YearCtx) {
  const s = y.s
  if (s.career.phase !== 'pro' || !s.career.proDebut || !s.bb || contractRuns(s)) return
  const st = faStatus(s)
  if (!st.domestic && !st.overseas) return
  const asked = s.flags?.['fa.asked']
  if (asked !== undefined && s.age - asked < 2) return
  const offers = faOffers(s)
  if (offers.length === 0) return
  ;(s.flags ??= {})['fa.asked'] = s.age
  const choices: { key: string; label: string; hint: string }[] = [
    { key: 'auto', label: '球団との契約更改に任せる', hint: '通常の年俸更改。複数年契約にはならない' },
    { key: 'stay', label: `残留する（${faLine(offers[0])}）`, hint: '球団の提示にサインする。ほかの球団の話は聞かない' },
  ]
  if (st.domestic) choices.push({ key: 'declare', label: '国内FA権を行使する', hint: '旧球団を含む球団から条件を聞いて選ぶ。オファーが少ない（ない）こともある' })
  if (st.overseas) choices.push({ key: 'mlb', label: '海外FA権を行使して、メジャーに挑戦する', hint: '海を渡る。言葉も環境も変わる' })
  y.ask(
    {
      id: 'fa.declare',
      weight: 'major',
      title: 'FA権を取得した',
      body: `1軍の登録（ゲーム上の換算）が${st.seasons}シーズンになり、${st.domestic ? '国内FA' : ''}${st.domestic && st.overseas ? 'と' : ''}${st.overseas ? '海外FA' : ''}の権利を得ました。残るか、権利を使うか。`,
      choices: choices.map(({ label, hint }) => ({ label, hint })),
      autoIndex: 0,
      factText: 'NPBの国内FA権は、1軍の出場選手登録145日以上を1シーズンとして8シーズン（2007年以降のドラフトで入団した大学・社会人出身は7シーズン）、海外FA権は9シーズンで得る（NPB公式）。ゲームでは出場試合数で換算し、オファーの内容は仮定。',
    },
    { keys: choices.map((c) => c.key).join(',') },
  )
}

/** sign an offer: the club (a move if it is another), the pay of next season and the years after it */
function faSign(y: YearCtx, o: FaOffer) {
  const s = y.s
  let moved = false
  if (!o.stay) {
    const org = orgById(o.orgId)
    if (org) {
      s.career.orgId = org.id
      s.career.team = `${orgLabel(org)}（支配下）`
      const rt = npbRating(org.id)
      if (rt) applyTeamRating(s, rt, NPB_MEAN)
      proNumber(s, false, 0x9b2)
      moved = true
    }
  }
  s.career.nextSalary = o.salary
  // the years count from next season: this year's pay is already paid
  s.career.contract = { salary: o.salary, untilAge: s.age + o.years, team: s.career.team }
  if (o.guarantee) (s.flags ??= {})['fa.guarantee'] = s.age
  y.add('milestone', `${o.stay ? '球団に残り' : `${faClub(o.orgId)}と契約し`}、${o.years}年契約を結びました（年俸${o.salary.toLocaleString()}万円、推定の条件）。${o.guarantee ? '1軍での起用も約束されました（記録のみ）。' : ''}${moved ? newNumberWords(s) : ''}`, { key: true }, eventRng(s, 0xfa2))
}

function askCredits(y: YearCtx) {
  const s = y.s
  const u = s.schools?.univ
  const year = s.career.phaseYears + 1
  if (s.career.phase !== 'univ' || !u || year !== 2 || s.taken.includes('jp.credits') || s.flags?.['route.overseas'] !== undefined) return
  y.ask({
    id: 'jp.credits',
    weight: 'minor',
    title: '単位が足りていない',
    body: '練習と遠征で授業を休みがちになり、取れた単位が少なくなっています。このまま野球を優先するか、授業を立て直すか。',
    choices: [
      { label: '授業と試験に集中して、単位を取る', hint: '4年で卒業できる。練習はいつもどおり' },
      { label: '野球を優先して、留年も覚悟で続ける', hint: `練習に打ち込んで、力を伸ばせる。留年すると卒業が1年遅れる（${u.method === 'sports' ? 'スポーツ推薦の選手は大学の支えがあり、留年しにくい' : '留年しやすい'}。確率はモデル上の仮定）` },
    ],
    autoIndex: 0,
  })
}

function univYear(y: YearCtx) {
  const s = y.s
  // a year of 浪人 (the phase has not begun: no calibrated check, no season)
  if (s.career.phaseYears < 0) return roninYear(y)
  // a student who went back to the team is outside the calibrated checks (own stream, no tally)
  const returnee = s.taken.includes('univ.returnee')
  const stay = returnee ? eventRng(s, 0x7e1).chance(0.88) : y.check('jp.univStay')
  if (!stay) {
    const reasons: [string, string][] = [
      ['故障が長引き、大学の野球部を退部しました。', '故障が長引き、練習に出られない日が続きました。'],
      ['学業とアルバイトに専念するため、野球部を退部しました。', '学業とアルバイトに専念したい気持ちが、強くなってきました。'],
    ]
    const why = y.rng.weighted(reasons, quitWeights(s, reasons.length))
    y.add('bad', why[0], { key: true, stop: 'quit' })
    y.quitLine = { entry: y.events[y.events.length - 1].entry, cause: why[1] }
    y.quitNote = noteQuit(s, 'univ', why === reasons[0])
    endBaseball(s, s.age)
    // leaving the team is not leaving the university: he studies on until 22 (assumption: no drop-outs)
    s.job = '大学生'
    return
  }
  const year = returnee ? Math.max(1, s.age - 17) : s.career.phaseYears + 1
  s.career.team = s.schools?.univ ? `大学${year}年・${s.schools.univ.name}` : `大学${year}年・${region(s)}の大学野球部`
  // the seasons (stage 4): spring and autumn leagues, national tournaments, practice games — event stream only
  if (s.bb) {
    const season = y.eventCtx(0x0b1 + year)
    announce(y, `大学${year}年の春のリーグ戦`, 0x0b5 + year, UNIV_SQUAD)
    univHalf(season, year, 'spring')
    announce(y, `大学${year}年の秋のリーグ戦`, 0x0b9 + year, UNIV_SQUAD)
    univHalf(season, year, 'fall')
    univPractice(season)
    scoutUpdate(y, 'jp.univFile', 'univ')
  }
  // (>= 4: the same as === 4 for every calibrated life, whose university phase ends there; only one who came back in his fourth year reaches a fifth)
  if (year >= 4 && returnee) askRoute(y, 'univ', true)
  else if (year >= 4) {
    const scouted = y.check('jp.univFile')
    if (scouted) scoutsCame(y, '大学最後のリーグ戦では、プロのスカウトが何度も試合を見に来ていました。')
    if (scouted || pct(s.z) > 0.985) {
      y.ask(
        {
          id: 'jp.univFile',
          weight: 'major',
          title: 'もう一度、プロを目指す？',
          body: scouted
            ? `大学最後の年。スカウトの評価も耳に入ってきます。指名の見込みは「${prospect(y.p('jp.univDraft'))}」です（ゲーム上の推定）。プロ志望届を出しますか。`
            : `大学最後の年です。指名の見込みは「${prospect(y.p('jp.univDraft'))}」です（ゲーム上の推定）。プロ志望届を出しますか。`,
          choices: [{ label: 'プロ志望届を出す' }, { label: '出さずに就職や社会人野球を考える' }],
          autoIndex: scouted ? 0 : 1,
          factText: '2025年のプロ志望届は大学生176人。そのうち54人（約31%）が指名された。',
          factStatIds: ['jpShibouUniv', 'jpDraftFromUniv', 'jpUnivDraftGivenFile'],
        },
        {},
      )
    } else {
      askRoute(y, 'univ')
    }
  }
}

const SHIHAIKA_CHECK: Record<string, string> = { 高校: 'jp.shihaikaHs', 大学: 'jp.shihaikaUniv', 社会人: 'jp.shihaikaCompany', 独立リーグ: 'jp.shihaikaIndep' }

// ---------------------------------------------------------------- real team names (src/data/orgs.ts)

const NPB_ORGS = ORGS.filter((o) => o.type === 'pro' && o.verified && o.realName)
const INDEP_ORGS = ORGS.filter((o) => o.type === 'independent' && o.verified)

/** team picks use their own random stream, so the calibrated career draws are unchanged */
function orgRng(s: LifeState, salt: number): Rng {
  return makeRng(hashSeed(s.config.seed ^ Math.imul(s.age + 101, 0x2c1b3c6d) ^ salt))
}

function orgNote(y: YearCtx) {
  if (y.s.taken.includes('note.orgName')) return
  y.s.taken.push('note.orgName')
  y.add('note', ORG_NAME_NOTE)
}

function assignNpb(y: YearCtx, other = false): string {
  const s = y.s
  const pool = other ? NPB_ORGS.filter((o) => o.id !== s.career.orgId) : NPB_ORGS
  // the draft order favours the weaker clubs, and the better the prospect the more it matters (a game assumption on the
  // clubs' records; the pick is on its own random stream, so the calibrated draws do not move)
  const q = clamp(evaluate(s).total / 2.5, 0, 1)
  const o = orgRng(s, other ? 0x5a17 : 0x1d3).weighted(
    pool,
    pool.map((c) => Math.exp(-1.2 * ((npbRating(c.id)?.value ?? NPB_MEAN) - NPB_MEAN) * q)),
  )
  s.career.orgId = o.id
  orgNote(y)
  return orgLabel(o)
}

const indepLabel = (o: (typeof INDEP_ORGS)[number]) => (o.realName ? `${o.league}・${o.realName}` : orgLabel(o))

/** an independent team: one in the player's own prefecture when there is one (half the time), else any (separate stream) */
function pickIndep(s: LifeState, salt: number, not?: string): (typeof INDEP_ORGS)[number] {
  const r = orgRng(s, salt)
  const all = INDEP_ORGS.filter((o) => o.id !== not)
  const near = all.filter((o) => INDEP_PREF[o.id] === prefName(s))
  // a player of high standing is taken by the higher leagues more often, one of low standing by the lower ones (the
  // tryout itself was passed at the calibrated check; this is only where): weights by the chance to be taken
  const ev = evaluate(s)
  const weigh = (list: typeof all) => list.map((o) => 0.1 + admitP(ev, indepRating(o.id) ?? { value: INDEP_MEAN, basis: 'estimated', why: '' }, 'general'))
  const pool = near.length > 0 && r.chance(0.5) ? near : all
  return r.weighted(pool, weigh(pool))
}

function assignIndep(y: YearCtx): string {
  const s = y.s
  const o = pickIndep(s, 0x77)
  s.career.orgId = o.id
  orgNote(y)
  return indepLabel(o)
}

/**
 * a real company or club team of the player's 地区連盟 (src/data/teams.ts, from the 2026 lists of 日本野球連盟);
 * clubs only a quarter of the time (the route is work at a company). Without a team in the region the
 * generic label stays.
 */
function pickAmateur(s: LifeState, salt: number, not?: string) {
  const region = JABA_REGION_OF_PREF[prefName(s)]
  const pool = region ? teamsInRegion(region).filter((t) => t.name !== not) : []
  if (pool.length === 0) return undefined
  const r = orgRng(s, salt)
  const companies = pool.filter((t) => t.kind !== 'club')
  return r.chance(0.25) || companies.length === 0 ? r.pick(pool) : r.pick(companies)
}

function assignAmateur(y: YearCtx): string | undefined {
  const s = y.s
  const t = pickAmateur(s, 0x66)
  if (!t) return undefined
  s.career.amateurTeam = t.name
  orgNote(y)
  return t.name
}

/**
 * The club-team route (a door for a player with little to show): a real club of the player's 地区連盟, or one of
 * the teams whose type is not stated and that are not in the 日本選手権's list. Work comes first, the pay is the job's.
 */
function joinClub(y: YearCtx, from: string) {
  const s = y.s
  const er = eventRng(s, 0x7002)
  const region = JABA_REGION_OF_PREF[prefName(s)]
  const pool = (region ? teamsInRegion(region) : []).filter((t) => t.kind === 'club' || (t.kind === '' && !t.nationals))
  const t = pool.length ? er.pick(pool) : undefined
  const rt = clubTeamRating()
  if (er.next() >= admitP(evaluate(s), rt, 'club')) {
    y.add('bad', 'クラブチームの練習に参加しましたが、続けるのは難しいと感じました。野球を離れることにしました。', { key: true }, er)
    endBaseball(s, s.age)
    afterBaseballPath(y, from)
    return
  }
  s.career.amateurTeam = t?.name
  setPhase(s, 'company', t ? `${t.name}（社会人野球・クラブチーム）` : `${region ?? prefName(s)}のクラブチーム（社会人野球）`)
  reachRank(s, 5)
  joinTeam(s, 'company')
  applyTeamRating(s, { ...rt, value: rt.value + (t?.nationals ? 0.45 : 0) }, COMPANY_MEAN)
  {
    // (a club's player works for a company of his own, not the club's: a fictional one, as the job offers name them; feedback r11 B8)
    const w = { title: '会社員（クラブチームで野球）', industry: 'office' as const, employer: 'small' as const, level: 0, years: 0, satisfaction: 55, regular: true, baseball: true }
    const company = companyFor(s, 'small', w)
    setWork(s, company ? { ...w, company } : w)
  }
  if (!s.taken.includes('work.started')) s.taken.push('work.started')
  ;(s.flags ??= {})['route.club'] = s.age
  s.job = '会社員（クラブチームで野球）'
  if (t) orgNote(y)
  y.add('decision', t ? `${t.name}に入りました。平日は仕事、休日と夜はグラウンドです。` : '地域のクラブチームに入りました。平日は仕事、休日と夜はグラウンドです。', { key: true }, er)
}

/**
 * A US college (NCAA Division I): the colleges that invited him are tried from the strongest down, each with its own
 * chance to take him (an invitation is not a place); none that does ends in the independent leagues or the end of
 * his career. Colleges below Division I and junior colleges are not collected.
 */
function joinOverseas(y: YearCtx, from: string, indepPass: boolean) {
  const s = y.s
  const er = eventRng(s, 0x7003)
  const ev = evaluate(s)
  // the words matter overseas: a player who studied English is likelier to be taken (a game assumption)
  const english = s.flags?.['study.english'] !== undefined ? 1 : 0.8
  const got = usInvites(s, ev)
    .filter((x) => x.invited)
    .sort((a, b) => b.rating.value - a.rating.value)
  for (const g of got) {
    if (er.next() < admitP(ev, g.rating, 'overseas') * english) {
      setPhase(s, 'univ', `${g.college.name}の野球部（米国・${g.college.conference}）`)
      reachRank(s, 5)
      joinTeam(s, 'univ')
      s.schools = {
        ...(s.schools ?? {}),
        univ: { id: g.college.id, name: g.college.name, method: 'sports', club: 'club', rating: g.rating.value, ratingBasis: g.rating.basis, league: g.rating.league, note: '米国・NCAA 1部' },
      }
      applyTeamRating(s, g.rating, UNIV_MEAN)
      ;(s.flags ??= {})['route.overseas'] = s.age
      y.add('decision', `米国の${g.college.name}に進み、野球を続けることにしました。`, { key: true }, er)
      return
    }
  }
  y.add('bad', '米国の大学のテストを受けましたが、枠には届きませんでした。', { key: true }, er)
  if (indepPass) {
    setPhase(s, 'indep', assignIndep(y))
    reachRank(s, 5)
    joinTeam(s, 'indep')
    const ir = indepRating(s.career.orgId)
    if (ir) applyTeamRating(s, ir, INDEP_MEAN)
    y.add('decision', '国内の独立リーグのトライアウトに切り替え、合格しました。', { key: true }, er)
  } else {
    endBaseball(s, s.age)
    afterBaseballPath(y, from)
  }
}

function teamName(s: LifeState): string {
  return orgLabel(orgById(s.career.orgId)) || 'NPB の球団'
}

// ---------------------------------------------------------------- real schools (src/engine/route/schools.ts)

type PickKind = 'strong' | 'public' | 'quit' | 'club' | 'student' | 'walkon'
const SCHOOL_FACT = '入試の合格・推薦の確率と、野球部の有無や強さは、ゲーム上の仮定です。偏差値は大学が河合塾の公開値（2027年度入試のボーダー予想）、高校がじゅけラボ予備校の公開値（令和8年度、普通科の中央値）です。'

function schoolNote(y: YearCtx) {
  if (y.s.taken.includes('note.schools')) return
  y.s.taken.push('note.schools')
  y.add('note', SCHOOL_NOTE)
}

/** enters the school: the exam is drawn, a failed first choice falls back on the safe school */
function enterSchool(y: YearCtx, which: 'hs' | 'univ', opts: Option[], chosen: number, kind: PickKind, pre?: Entered) {
  const s = y.s
  const e = pre ?? sitExam(opts, chosen, eventRng(s, 0x5c30))
  // a first choice missed by a general-exam taker: on screen, once per life, he may try again a year later (a 浪人; PROJECT_PLAN §11.25)
  if (!pre && which === 'univ' && s.career.phase === 'univ' && e.fellBack && !y.sim.headless && !y.decision && opts[chosen]?.method === 'general' && (kind === 'student' || kind === 'walkon') && s.flags?.['univ.ronin'] === undefined) {
    schoolNote(y)
    y.add('bad', '第一志望の大学は不合格でした。', { key: true })
    y.ask(
      {
        id: 'jp.ronin',
        weight: 'major',
        title: '不合格のあと、どうする？',
        body: '併願していた大学に進むか、1年かけてもう一度受けるか。浪人すると、その1年は野球ができず、進学は1年遅れる。',
        choices: [
          { label: '併願していた大学に進学する', hint: 'すぐに大学生になる' },
          { label: '浪人して、来年もう一度受験する', hint: '予備校に通う1年。再び落ちても、もう浪人はせず併願先に進む（モデル上の仮定）' },
        ],
        autoIndex: 0,
        stop: true,
      },
      { opts: JSON.stringify(opts), kind, chosen },
    )
    return
  }
  const o = e.option
  schoolNote(y)
  const pick = { id: o.id, name: o.name, method: o.method, ...(e.fellBack ? { fellBack: true } : {}) }
  const sch = (s.schools ??= {})
  if (which === 'hs') {
    // the team's strength in high school is the calibrated draw made on joining; the real school is named to match
    sch.hs = s.bb && s.career.phase === 'hs' ? { ...pick, rating: s.bb.teamStrength, ratingBasis: 'estimated' as const, ...(o.note ? { note: o.note } : {}) } : { ...pick, ...(o.note ? { note: o.note } : {}) }
  } else {
    sch.univ = { ...pick, club: kind === 'club' ? 'club' : undefined, ...(o.rating !== undefined ? { rating: o.rating, ratingBasis: o.basis, ...(o.league ? { league: o.league } : {}), ...(o.note ? { note: o.note } : {}) } : {}) }
    // a university of one licensed course (歯科大学, 医科大学…): the licence it leads to (license.ts; feedback r11 A8)
    // (a student who does not play: a university player's years follow the team's four, his course is not modeled)
    const lic = kind === 'student' ? licenseOfSchool(o.name) : undefined
    if (lic) s.license = { kind: lic }
    else delete s.license
    if (kind === 'club' && s.career.phase === 'univ' && o.rating !== undefined) applyTeamRating(s, { value: o.rating, basis: o.basis ?? 'estimated', why: '' }, UNIV_MEAN)
  }
  // a university in another region: he goes to live there (place.ts; the high school's students live at home or in its dormitory)
  if (which === 'univ') settleAt(s, schoolById(o.id)?.pref)
  const where = o.name
  if (e.fellBack) {
    // (no school name in the bad line: PROJECT_PLAN §11.1-5; a failure already told at the 浪人 question (pre) is not told twice)
    if (!pre) y.add('bad', `${which === 'hs' ? '第一志望の高校' : '第一志望の大学'}は不合格でした。`, { key: true })
    y.add('normal', `併願していた${where}に進学することになりました。`)
  } else {
    y.add('good', `${where}に${METHOD_LABEL[o.method]}で合格しました。`, { key: which === 'univ' })
  }
  if (which === 'univ' && s.career.phase === 'univ') s.career.team = `大学1年・${o.name}`
}

/** a decision to choose among the shortlisted schools; without room for a decision, the おまかせ choice is taken */
function askPick(y: YearCtx, which: 'hs' | 'univ', kind: PickKind) {
  const s = y.s
  const r = eventRng(s, which === 'hs' ? 0x5c10 : 0x5c20)
  const opts = which === 'hs' ? hsShortlist(s, kind as 'strong' | 'public' | 'quit', r) : univShortlist(s, kind as 'club' | 'student' | 'walkon', r)
  if (opts.length === 0) {
    // (no school to name: he goes on in the team without a tryout, as before)
    if (kind === 'walkon') reachRank(s, 5)
    return
  }
  const auto = autoPick(opts)
  if (y.decision) {
    enterSchool(y, which, opts, auto, kind)
    if (kind === 'walkon') tryWalkOn(y)
    return
  }
  // a list of one school is not a question (a choice with one answer): he sits its exam, as the answer would have had him do
  // (the lists give two or more: route/schools.ts; this is the last guard)
  if (opts.length < 2) {
    enterSchool(y, which, opts, 0, kind)
    if (which === 'univ' && kind === 'student') askUnivClub(y)
    if (kind === 'walkon') tryWalkOn(y)
    return
  }
  y.ask(
    {
      id: which === 'hs' ? 'jp.hsPick' : 'jp.univPick',
      weight: 'major',
      title: which === 'hs' ? '志望校を選ぶ' : '進学する大学を選ぶ',
      body:
        which === 'hs'
          ? `高校受験の季節です。${PREFECTURES[homePrefecture(s)]?.name ?? prefName(s)}の高校から、受験先の候補を絞りました。どの高校を、どの入試で受けますか。`
          : kind === 'club'
            ? '野球を続けられる大学から、声がかかっています。声がかかることと入れることは別です。どの大学を、どの入試で受けますか。'
            : kind === 'walkon'
              ? '野球部から声はかかっていませんが、一般入試や推薦で入学して、入部テストを受ける道があります。どの大学を受けますか。'
              : '大学進学を考える時期です。どの大学を、どの入試で受けますか。',
      choices: opts.map((o) => ({ label: optionLabel(o, which), hint: optionHint(o) })),
      autoIndex: auto,
      factText: SCHOOL_FACT,
      factStatIds: ['schoolModel', 'evaluationModel', 'teamRatingModel'],
    },
    { which, kind, opts: JSON.stringify(opts) },
  )
}

/**
 * A player nobody invited tries out for the club of the university he entered. He is admitted by his
 * evaluation against the team's level (drawn on the event stream); a failed tryout ends his playing career
 * (the draw never touches the calibrated checks: this route is chosen, never the おまかせ one).
 */
function tryWalkOn(y: YearCtx) {
  const s = y.s
  const u = s.schools?.univ
  if (!u) return
  const rt = univTeamRating(s) ?? univRating(schoolById(u.id)!)
  const er = eventRng(s, 0x5c40)
  const ok = er.next() < admitP(evaluate(s), rt, 'walkon')
  if (ok) {
    u.club = 'club'
    applyTeamRating(s, rt, UNIV_MEAN)
    // (playing on after high school is reached only now, with the club: a failed test is not 「高校の後も野球を続けた」)
    reachRank(s, 5)
    y.add('good', '野球部の入部テストに合格しました。声はかかっていませんでしたが、練習に加わることになりました。', { key: true }, er)
    return
  }
  y.add('bad', '野球部の入部テストには受かりませんでした。', { key: true }, er)
  endBaseball(s, s.age)
  s.job = '大学生'
  ;(s.flags ??= {})['univ.walkFail'] = s.age
  askUnivClub(y)
}

/** the position he wants, asked once at the start of a playing stage (PROJECT_PLAN §11.23) */
function askWish(y: YearCtx) {
  const s = y.s
  const phase = s.career.phase
  if (!isPlaying(s) || !WISH_PHASES.includes(phase) || s.career.phaseYears > 1 || s.age < 9) return
  const key = `wish.${phase}`
  if (s.taken.includes(key)) return
  s.taken.push(key)
  const choices = wishChoices(s)
  y.ask(
    {
      id: 'jp.wish',
      weight: 'minor',
      title: '希望するポジション',
      body: `${s.career.team || '新しいチーム'}での希望を、監督に伝えます。いまは${{ P: '投手', C: '捕手', IF: '内野手', OF: '外野手' }[s.person.position]}${s.career.wish ? `、これまでの希望は${wishLabel(s.career.wish)}` : ''}です。希望どおりになるかは、適性とチーム事情しだいです。`,
      choices: choices.map((c) => ({ label: c.label, hint: c.hint })),
      autoIndex: choices.length - 1,
    },
    { phase },
  )
}

/**
 * The weights of the reasons for leaving the team, the first one an injury: only one who is hurt now (3) or was hurt before (1)
 * leaves for an injury; every other reason weighs 1 (game assumptions). One draw, as the even pick it replaces, so the
 * calibrated stream is not moved; only which reason is told changes.
 */
export function quitWeights(s: LifeState, n: number): number[] {
  const hurt = s.career.injured > 0 || !!s.bb?.hurt ? 3 : (s.bb?.injuries ?? 0) > 0 ? 1 : 0
  return [hurt, ...Array(n - 1).fill(1)]
}

/** (taken before endBaseball clears them) */
function noteQuit(s: LifeState, from: 'hs' | 'univ', injury: boolean): QuitNote {
  return { from, injury, team: s.career.team, phaseYears: s.career.phaseYears, orgId: s.career.orgId ?? '', amateurTeam: s.career.amateurTeam ?? '' }
}

/**
 * Baseball ended by an injury or by leaving the team (high school, university): the player may still choose how it ends.
 * The calibrated end already happened (the choice 'quit' leaves it as it was); coming back or staying on as a helper is
 * decided on the year's own stream, never the calibrated one. The chances are game assumptions.
 */
function askQuitCrossroads(y: YearCtx, n: QuitNote) {
  const hs = n.from === 'hs'
  // the end is not decided yet: the line tells the reason only, the screen does not stop on it, and the answer tells the end
  if (y.quitLine) {
    y.quitLine.entry.text = y.quitLine.cause
    delete y.quitLine.entry.stop
  }
  const choices: { key: string; label: string; hint: string }[] = []
  if (n.injury) {
    choices.push({ key: 'back', label: '治療とリハビリに専念して、復帰を目指す', hint: '今年は試合に出られない。再発するとやめることになる（モデル上の仮定）' })
  } else {
    choices.push({ key: 'back', label: 'もう一度、気持ちを立て直して部に戻る', hint: '仲間や家族と話し合って続ける。また辛くなることもある（モデル上の仮定）' })
  }
  choices.push({
    key: 'helper',
    label: hs ? 'マネージャー・記録員として部を支える' : '学生コーチ・マネージャーとして部に残る',
    hint: '選手としては終わるが、野球とのつながりは残る',
  })
  choices.push({ key: 'quit', label: '野球をやめて、その後の人生を歩む', hint: 'このまま新しい道に進む' })
  y.ask(
    {
      id: 'jp.quitCross',
      weight: 'major',
      stop: true,
      title: n.injury ? (hs ? '故障で、練習ができない' : '故障が長引いている') : '野球部をやめるか、迷っている',
      body: n.injury ? 'このまま野球を終えるのか、治すことに懸けるのか。決める時が来ました。' : '野球部を離れるのか、もう一度向き合うのか。決める時が来ました。',
      choices: choices.map(({ label, hint }) => ({ label, hint })),
      autoIndex: choices.length - 1,
    },
    { from: n.from, injury: n.injury, team: n.team, py: n.phaseYears, org: n.orgId, amateur: n.amateurTeam, keys: choices.map((c) => c.key).join(',') },
  )
}

/**
 * a student who has stopped playing decides what to do with baseball at the university: asked in the year he enters (after the
 * entrance ceremony), not in the year of the exam (PROJECT_PLAN §11.61). Here it is only booked; lifeYear asks it (univClubYear).
 */
function askUnivClub(y: YearCtx) {
  const s = y.s
  if (s.flags?.['univ.clubAsk'] === undefined) s.flags = { ...s.flags, 'univ.clubAsk': s.age }
}

/** the club question booked by askUnivClub, in the first year at the university */
function univClubYear(y: YearCtx) {
  const s = y.s
  const at = s.flags?.['univ.clubAsk']
  if (at === undefined || s.age <= at) return
  delete s.flags!['univ.clubAsk']
  if (!s.schools?.univ || s.schools.univ.club !== undefined) return
  askUnivClubNow(y)
}

/**
 * The club question. One who failed the club's 入部テスト (tryWalkOn: flag univ.walkFail) has two more ways, his own choices (game
 * assumptions): the test again next spring after a year of practising alone (univRetryYear), or the 準硬式 club. おまかせ answers as
 * before (the circle after six years of baseball or more, else nothing).
 */
function univClubKeys(s: LifeState): string[] {
  return s.flags?.['univ.walkFail'] !== undefined ? ['retry', 'semi', 'circle', 'none'] : ['circle', 'none']
}

function askUnivClubNow(y: YearCtx) {
  const s = y.s
  const keys = univClubKeys(s)
  const auto = keys.indexOf(s.career.yearsPlaying >= 6 ? 'circle' : 'none')
  if (y.decision) return resolveUnivClub(y, auto)
  const failed = keys.includes('retry')
  const all: Record<string, { label: string; hint: string }> = {
    retry: { label: '来年の春、もう一度入部テストを受ける', hint: '1年間、授業の合間に自分で練習を続ける。受かるかは実力しだい（ゲーム上の仮定）' },
    semi: { label: '準硬式野球部に入る', hint: '硬式の野球部とは別の部。公式戦もあり、本気で野球を続けられる' },
    circle: { label: '野球サークルに入る', hint: '勝ち負けより楽しさ。授業やアルバイトとの両立もしやすい' },
    none: { label: '野球は続けない', hint: '学業・アルバイト・人間関係に時間を使う' },
  }
  y.ask({
    id: 'jp.univClub',
    weight: 'minor',
    title: failed ? '入部テストのあとで' : '大学での野球は？',
    body: failed ? '硬式野球部の入部テストには受かりませんでした。大学での野球と、これからどう付き合いますか。' : '入学式のあと、サークルの勧誘にあいました。野球とは、これからどう付き合いますか。',
    choices: keys.map((k) => all[k]),
    autoIndex: auto,
  })
}

function resolveUnivClub(y: YearCtx, choice: number) {
  const s = y.s
  const u = s.schools?.univ
  if (!u) return
  const key = univClubKeys(s)[choice] ?? 'none'
  if (key === 'retry') {
    u.club = 'none'
    ;(s.flags ??= {})['univ.walkRetry'] = s.age
    y.add('decision', '来年の春の入部テストに向けて、授業の合間に一人で練習を続けることにしました。')
  } else if (key === 'semi') {
    u.club = 'circle'
    ;(s.flags ??= {})['univ.semi'] = s.age
    const bl = ensureAfter(s).baseballLife
    if (!bl.includes('準硬式野球')) bl.push('準硬式野球')
    s.status.relations = clamp(s.status.relations + 3, 5, 100)
    y.add('decision', '準硬式野球部に入りました。ボールは違っても、公式戦に向けて練習する日々です。')
  } else if (key === 'circle') {
    u.club = 'circle'
    const bl = ensureAfter(s).baseballLife
    if (!bl.includes('サークル野球')) bl.push('サークル野球')
    s.status.relations = clamp(s.status.relations + 3, 5, 100)
    y.add('decision', '野球サークルに入りました。週末は仲間と草野球です。')
  } else {
    u.club = 'none'
    s.status.knowledge = clamp(s.status.knowledge + 2, 1, 99)
    y.add('decision', '大学では野球を続けないことにしました。')
  }
}

/**
 * The second 入部テスト, the spring after the year of practising alone (resolveUnivClub 'retry'): the same chance as the first,
 * on a stream of its own; passed, he joins the team as a student who went back to it (hooks.returnToClub: outside the calibrated checks).
 */
function univRetryYear(y: YearCtx) {
  const s = y.s
  const at = s.flags?.['univ.walkRetry']
  const u = s.schools?.univ
  if (at === undefined || s.age !== at + 1 || !u || s.job !== '大学生' || isPlaying(s)) return
  const rt = univTeamRating(s) ?? univRating(schoolById(u.id)!)
  const er = eventRng(s, 0x5c41)
  if (er.next() < admitP(evaluate(s), rt, 'walkon')) {
    hooks.returnToClub(s)
    reachRank(s, 5)
    y.add('good', '2度目の入部テストに合格し、硬式野球部に入りました。1年遅れのスタートです。', { key: true }, er)
  } else {
    delete s.flags!['univ.walkRetry']
    y.add('bad', '2度目の入部テストも、合格には届きませんでした。大学での硬式野球は、ここまでにします。', { key: true }, er)
  }
}

function pickFromData(d: Record<string, number | boolean | string>): { opts: Option[]; kind: PickKind; which: 'hs' | 'univ' } {
  return { opts: JSON.parse(String(d.opts)) as Option[], kind: String(d.kind) as PickKind, which: d.which === 'univ' ? 'univ' : 'hs' }
}

// what declarative events may do to the career (events/hooks.ts)
careerHooks.moveTeam = (s) => {
  const ph = s.career.phase
  if (ph === 'company') {
    const t = pickAmateur(s, 0x67, s.career.amateurTeam)
    if (!t) return
    s.career.amateurTeam = t.name
    s.career.team = `${t.name}（社会人野球）`
    const rt = amateurRating(t.name)
    if (rt) applyTeamRating(s, rt, COMPANY_MEAN)
  } else if (ph === 'indep') {
    const o = pickIndep(s, 0x78, s.career.orgId)
    s.career.orgId = o.id
    s.career.team = indepLabel(o)
    const rt = indepRating(o.id)
    if (rt) applyTeamRating(s, rt, INDEP_MEAN)
  } else if (ph === 'pro' || ph === 'proMinor') {
    // a trade carries a multi-year contract that still runs into next season: the years and the pay stay, only the club changes
    // (one that has run out or belongs to no club of his is left as it is: proPay drops it; free agency signs its own contract, faSign)
    const carried = contractRuns(s) ? s.career.contract : undefined
    const pool = NPB_ORGS.filter((o) => o.id !== s.career.orgId)
    const o = orgRng(s, 0x5a18).pick(pool)
    s.career.orgId = o.id
    s.career.team = `${orgLabel(o)}（${ph === 'pro' ? '支配下' : '育成'}）`
    if (carried) s.career.contract = { ...carried, team: s.career.team }
    const rt = npbRating(o.id)
    if (rt) applyTeamRating(s, rt, NPB_MEAN)
    // a new club, a new number (the line of the event tells it: newNumberWords)
    proNumber(s, ph === 'proMinor', 0x9b1)
  }
}

careerHooks.retire = (s) => {
  if (!isPlaying(s)) return
  const company = s.career.phase === 'company'
  endBaseball(s, s.age)
  if (company) {
    // a company player stays an employee of the company that ran the team
    const w = s.after?.work
    if (w && w.baseball) {
      w.title = '会社員（元社会人野球選手）'
      w.baseball = false
      s.job = w.title
      s.after!.jobs?.push(w.title)
    }
    if (!s.taken.includes('work.started')) s.taken.push('work.started')
  }
}

careerHooks.changeJob = (s) => {
  // the same work at another company (x.life.jobChange): setWork pays the old employer's allowance and counts the years again
  const w = s.after?.work
  if (!w) return
  const next: WorkState = { ...w, years: 0 }
  delete next.company
  // (a new job: hired at this age, setWork)
  delete next.since
  const company = companyFor(s, `change.${s.age}`, next)
  setWork(s, company ? { ...next, company } : next)
}

careerHooks.quitJob = (s) => {
  // the same leaving as a lay-off (afterEvents work.layoff): the allowance, no job; the age is kept for the line that tells it
  loseWork(s)
  ensureAfter(s).jobless = 0
  ;(s.flags ??= {})['job.quit'] = s.age
}

// a student who failed the club's 入部テスト tries it again (univ.return): the same chance as the first, on a stream of its own
hooks.walkOnAgain = (s) => {
  const u = s.schools?.univ
  if (!u) return false
  const rt = univTeamRating(s) ?? univRating(schoolById(u.id)!)
  if (eventRng(s, 0x5c42).next() >= admitP(evaluate(s), rt, 'walkon')) return false
  hooks.returnToClub(s)
  reachRank(s, 5)
  return true
}

hooks.returnToClub = (s) => {
  const u = s.schools?.univ
  if (!u) return
  if (!s.taken.includes('univ.returnee')) s.taken.push('univ.returnee')
  u.club = 'returned'
  setPhase(s, 'univ', `大学${Math.max(1, s.age - 16)}年・${u.name}`)
  joinTeam(s, 'univ')
  const rt = univTeamRating(s)
  if (rt) applyTeamRating(s, rt, UNIV_MEAN)
}

function draftNow(y: YearCtx, from: string): 'shihaika' | 'ikusei' {
  const s = y.s
  const shihaika = y.check(SHIHAIKA_CHECK[from] ?? 'jp.shihaikaUniv')
  s.career.draftedFrom = from
  achieve(s, 'ドラフト指名')
  // how many times he has been drafted (amateurDraftBarred: a second return through the draft is the last)
  s.flags = { ...s.flags, 'draft.n': (s.flags?.['draft.n'] ?? 0) + 1 }
  assignNpb(y)
  const kind = shihaika ? 'shihaika' : 'ikusei'
  // the pick and the first contract (PROJECT_PLAN §11.23): drawn on a stream of their own after the calibrated checks
  const r = eventRng(s, 0xd7a)
  const ev = evaluate(s)
  const pick = draftRound(r, draftStanding(ev.total), kind)
  const terms = rookieTerms(r, pick.round, kind, from)
  s.career.draft = { age: s.age, year: s.year, from, team: teamName(s), kind, ...pick, clubOrder: pick.round, ...terms, status: 'drafted', reason: draftReason(s, ev), ability: abilityOverall(s), record: recordSummary(s) }
  return kind
}

/** his official record at the level he is leaving, in a few words (for the draft screen) */
function recordSummary(s: LifeState): string | undefined {
  const rec = s.bb?.rec
  if (!rec) return undefined
  const level = s.career.phase === 'univ' ? 'univ' : s.career.phase === 'company' || s.career.phase === 'indep' ? 'amateur' : 'hs'
  const l = rec.official[level]
  if (!l) return undefined
  const where = { hs: '高校', univ: '大学', amateur: s.career.phase === 'company' ? '社会人' : '独立リーグ' }[level]
  if (s.person.position === 'P' && l.outs >= 9) return `${where}の公式戦 ${l.games}試合・${l.w}勝${l.l}敗・防御率${((l.er * 27) / l.outs).toFixed(2)}・${l.k}奪三振`
  if (l.ab) return `${where}の公式戦 ${l.games}試合・打率${(l.h / l.ab).toFixed(3).replace(/^0/, '')}・${l.hr}本塁打・${l.rbi}打点`
  return undefined
}

function joinPro(y: YearCtx, kind: 'shihaika' | 'ikusei') {
  const s = y.s
  if (kind === 'shihaika') {
    setPhase(s, 'pro', `${teamName(s)}（支配下）`)
    reachRank(s, 7)
  } else {
    setPhase(s, 'proMinor', `${teamName(s)}（育成）`)
    reachRank(s, 6)
  }
  joinTeam(s, 'pro')
  proNumber(s, kind === 'ikusei')
  // the contract is signed: the first salary, the signing bonus (paid with this or next year's income) and the number
  const d = s.career.draft
  if (d && d.status === 'drafted') {
    d.status = 'signed'
    d.number = s.bb?.number
    s.career.nextSalary = d.salary
    s.career.signingPay = (s.career.signingPay ?? 0) + d.bonus
  }
}

/** shirt number in pro: three digits for 育成, two for 支配下 (event stream; `salt`: another stream for a new club in the same year) */
function proNumber(s: LifeState, ikusei: boolean, salt = 0x9b0) {
  if (!s.bb) return
  const r = eventRng(s, salt)
  s.bb.number = ikusei ? r.int(101, 140) : r.int(10, 69)
}

/** the new number at another club, in words for the line that tells the move (the same words in events/proLife.ts x.pro.trade) */
function newNumberWords(s: LifeState): string {
  return s.bb?.number !== undefined ? `新しい背番号は${s.bb.number}です。` : ''
}

/**
 * A 支配下 player who has become a regular of the first team (role 'starter' after the season) with a large number is often given
 * a smaller one (game assumptions: 4 in 10 a year while his number is 40 or more; the new one from 1 to 39). Own stream.
 */
function numberAfterSeason(y: YearCtx) {
  const s = y.s
  const b = s.bb
  if (!b || s.career.phase !== 'pro' || b.role !== 'starter' || (b.number ?? 0) < 40) return
  const r = eventRng(s, 0x9b3)
  if (!r.chance(0.4)) return
  b.number = r.int(1, 39)
  y.add('good', `1軍での活躍が認められ、背番号が${b.number}に変わりました。`, {}, r)
}

/** standing among NPB players (sd units) from ability: the calibration's NPB roster */
function npbStanding(y: YearCtx): number {
  return (y.s.z - y.sim.params.npbZMean) / y.sim.params.npbZSd
}

/** the standing behind this year's salary (proSalary draws it): 1軍 play time follows it, so the two agree */
function salaryStanding(s: LifeState): number {
  return (Math.log(Math.max(1, s.career.salary)) - Math.log(statValue('jpSalaryMedian'))) / statValue('jpSalarySigma')
}

function amateurYear(y: YearCtx) {
  const s = y.s
  const company = s.career.phase === 'company'
  // (a player of a club team has no pay from the team: his income is his job's)
  s.career.salary = company ? (s.flags?.['route.club'] !== undefined ? 330 : 420) : 120
  // a company player is an employee of the company that runs the team: his years of service count from
  // the start (PROJECT_PLAN §11.8; the job model is stage 5's). His pay while playing is the team salary.
  if (company && !s.after?.work) {
    // (the company that runs the team is his employer: its team's name is kept, shown after he retires to the company's work; r11 B8)
    const team = s.career.amateurTeam
    setWork(s, { title: '会社員（社会人野球部）', industry: 'office', employer: 'large', level: 0, years: 0, satisfaction: 58, regular: true, baseball: true, ...(team ? { team } : {}) })
    if (!s.taken.includes('work.started')) s.taken.push('work.started')
  }
  // the season (stage 4), on the event stream; the draft and the end of the career stay calibrated checks
  const n = s.career.phaseYears + 1
  if (s.bb) {
    announce(y, company ? `入社${n}年目のシーズン` : `独立リーグ${n}年目のシーズン`, 0x0a5 + n, ADULT_SQUAD)
    const season = y.eventCtx(0x0a1 + n)
    if (company) companySeason(season, n)
    else indepSeason(season, n)
    scoutUpdate(y, company ? 'jp.companyDraft' : 'jp.indepDraft', 'amateur')
  }
  const eligible = company ? s.career.phaseYears >= 2 : true
  // the calibrated check is drawn as before; NPB clubs pass over a player too old for a draft or already drafted twice (PROJECT_PLAN
  // §11.65: a player released again and again was drafted again from the independent league every year, into his sixties)
  if (eligible && y.check(company ? 'jp.companyDraft' : 'jp.indepDraft') && !amateurDraftBarred(s)) {
    scoutsCame(y, 'シーズン中、プロのスカウトが何度も試合を見に来ていました。')
    const kind = draftNow(y, company ? '社会人' : '独立リーグ')
    y.add('big', `ドラフト会議で、${teamName(s)}から${kind === 'shihaika' ? '' : '育成で'}指名されました。`, {
      key: true,
      statIds: [company ? 'jpDraftFromCompany' : 'jpDraftFromIndep'],
      stop: 'draft',
    })
    // leaving the company for pro baseball (its retirement allowance is paid by the job model)
    if (company && s.after?.work) loseWork(s)
    joinPro(y, kind)
    return
  }
  const ageCtx = s.age > 27 ? 0.12 * (s.age - 27) : 0
  if (y.check('jp.amateurExit', ageCtx) || s.age >= 34) {
    y.add('milestone', company ? '現役を引退し、社業に専念することになりました。' : '独立リーグでの挑戦に区切りをつけ、現役を引退しました。', { key: true, stop: 'quit' })
    endBaseball(s, s.age)
    if (company) {
      // a company player stays an employee of the company that ran the team, with his years of service
      const w = s.after?.work
      if (w && w.baseball) {
        w.title = '会社員（元社会人野球選手）'
        w.baseball = false
        s.job = w.title
        s.after!.jobs?.push(w.title)
      } else {
        // saves from before stage 4 (no job while playing)
        setWork(s, { title: '会社員（元社会人野球選手）', industry: 'office', employer: 'large', level: 0, years: s.career.yearsPlaying > 4 ? 4 : 2, satisfaction: 55, regular: true, baseball: false })
      }
      if (!s.taken.includes('work.started')) s.taken.push('work.started')
    } else {
      s.job = ''
    }
  }
}

/**
 * NPB clubs do not draft a company or independent-league player who is over 33, or one who has already been drafted twice (his first
 * draft and one return through the draft after a release; game assumptions, PROJECT_PLAN §11.65). Other ways back stay open: a club's
 * offer after a release, the joint tryout. Without this, a strong player could be drafted and released year after year to any age.
 * (33: the おまかせ lives of the Japan fingerprint are drafted up to 33 and never later, so their careers do not change; from 34 these
 * teams' players leave baseball, amateurYear.)
 */
export const AMATEUR_DRAFT_MAX_AGE = 33
export function amateurDraftBarred(s: LifeState): boolean {
  return s.age > AMATEUR_DRAFT_MAX_AGE || (s.flags?.['draft.n'] ?? 0) >= 2
}

function ikuseiYear(y: YearCtx) {
  const s = y.s
  // pay (PROJECT_PLAN §11.23): the contract's salary in the first year, then small steps by the farm season (event stream)
  s.career.salary = s.career.nextSalary ?? (s.career.salaryHist?.length ? nextIkuseiSalary(s.career.salary, farmValue(s, s.age - 1), eventRng(s, 0xd7b).normal()) : IKUSEI_MIN_SALARY)
  delete s.career.nextSalary
  payHist(s, 'ikusei')
  s.career.minorSeasons++
  // the season is 2軍 games only (育成 players cannot play 1軍 games); drawn after the calibrated checks
  // of the year, on the event stream, so that a 戦力外 year can be a thin one
  const season = (released: boolean) => {
    if (s.bb) proSeason(y.eventCtx(0x9a1), { ikusei: true, debuted: false, debutNow: false, released, standing: npbStanding(y) })
  }
  if (y.check('jp.ikuseiPromote')) {
    season(false)
    setPhase(s, 'pro', `${teamName(s)}（支配下）`)
    reachRank(s, 7)
    achieve(s, '育成から支配下')
    proNumber(s, false)
    // a new 支配下 contract for next season (no new signing bonus: assumption)
    s.career.nextSalary = promotedSalary(s.career.salary, npbStanding(y))
    y.add('big', '支配下登録されました。背番号が2桁になりました。', { key: true, statIds: ['jpIkuseiPromoted'] })
    return
  }
  // (the calibrated check is drawn as before; a 育成 contract ends at 42 as a 支配下 one does: PROJECT_PLAN §11.65)
  const released = y.check('jp.ikuseiExit') || s.age >= 42
  season(released)
  if (released) askRelease(y, true)
}

/** the value of last season's farm play for a 育成 player's pay (0 none … about 1 a good season) */
function farmValue(s: LifeState, age: number): number {
  const l = s.bb?.rec?.tournaments.find((t) => t.age === age && t.level === 'farm')?.line
  return l ? Math.min(1.2, seasonValue(l, s.person.position === 'P', proType(s) === 'reliever') * 1.5) : 0
}

/** what a 支配下 standing is worth on the market (a new contract from another club or after MLB) */
function marketSalary(standing: number): number {
  return clamp(Math.round(Math.exp(Math.log(statValue('jpSalaryMedian')) + statValue('jpSalarySigma') * clamp(standing, -2.5, 3)) / 10) * 10, NPB_MIN_SALARY, NPB_MAX_SALARY)
}

/**
 * This year's pay of a 支配下 player (PROJECT_PLAN §11.23): a new contract's salary (the rookie contract, a promotion, a return
 * from MLB), else last year's salary moved by last season (contract.ts nextSalary). Event-free: the noise is the draw that set the
 * play time.
 */
function proPay(s: LifeState, y: YearCtx, noise: number): number {
  const fixed = s.career.nextSalary
  delete s.career.nextSalary
  if (fixed !== undefined) {
    // (a contract signed this year starts with this fixed pay and goes on; any other new contract ends an old one)
    const signed = s.career.contract
    if (!(signed && signed.salary === fixed && signed.team === s.career.team)) delete s.career.contract
    return fixed
  }
  const last = s.career.salaryHist?.at(-1)
  const continuing = !!last && last.kind === 'shihaika' && last.age === s.age - 1
  // a multi-year contract comes first: the pay stays while it runs, with the same team and without a break
  const c = s.career.contract
  if (c) {
    if (continuing && s.age <= c.untilAge && c.team === s.career.team) return c.salary
    delete s.career.contract
  }
  if (!last || !continuing) return marketSalary(npbStanding(y))
  const line = s.bb?.rec?.tournaments.find((t) => t.age === s.age - 1 && t.level === 'pro')?.line
  const value = seasonValue(line, s.person.position === 'P', proType(s) === 'reliever')
  const hurt = (s.bb?.hurt ?? false) || s.career.injured > 0
  const pay = nextSalary(last.salary, value, !!line && line.games > 0, hurt, s.age, noise)
  const term = multiYearTerm(pay, value, s.age, hurt)
  // (only in the last year before free agency, or the year before it for an exceptional season: contractTiming.ts)
  if (term > 0 && multiYearAllowed(s, value)) {
    s.career.contract = { salary: pay, untilAge: s.age + term - 1, team: s.career.team }
    y.add('milestone', `${term}年契約を結びました（年俸${pay.toLocaleString()}万円、推定の条件）。契約の間、年俸は成績で変わりません。`, { key: true }, eventRng(s, 0xc0))
  }
  return pay
}

/** the year's pay in the record of pay */
function payHist(s: LifeState, kind: 'shihaika' | 'ikusei' | 'mlb' | 'minor', usd?: number) {
  ;(s.career.salaryHist ??= []).push({ age: s.age, year: s.year, salary: s.career.salary, ...(usd ? { usd } : {}), kind, team: s.career.team })
}

/**
 * The first team's minimum guarantee of this season (contract.ts firstTeamExtra, stat npbFirstTeamMin), after the season is played: the
 * days on the first-team roster are the game's stand-in (freeAgent.ts registeredDays, from the season's first-team line). Paid with this
 * year's income beside the salary (lifeYear), kept in the record of pay; the salary itself, and so next year's pay, does not include it.
 * Nothing is drawn (the line has its own stream).
 */
function firstTeamPay(y: YearCtx) {
  const s = y.s
  const line = s.bb?.rec?.tournaments.find((t) => t.age === s.age && t.level === 'pro')?.line
  const days = line ? registeredDays(line, proType(s)) : 0
  const extra = firstTeamExtra(s.career.salary, days)
  if (extra <= 0) return
  s.career.firstTeamPay = extra
  const h = s.career.salaryHist?.at(-1)
  if (h && h.age === s.age && h.kind === 'shihaika') h.firstTeam = extra
  y.add('note', `1軍に登録された日数（ゲーム内の換算で約${days}日）に応じて、年俸とは別に${extra.toLocaleString()}万円の追加報酬（1軍の最低保障）を受け取りました。`, { statIds: ['npbFirstTeamMin'] }, eventRng(s, 0x1f60))
}


function proYear(y: YearCtx) {
  const s = y.s
  y.sim.observe?.('npbZ', s.z)
  // the standing behind this year's play time is drawn as before (the same draw of the year's stream); the pay now follows the
  // contract and the seasons played (PROJECT_PLAN §11.23)
  const noise = y.rng.normal()
  s.career.proStanding = clamp(npbStanding(y) + noise * 0.3, -2.5, 3)
  s.career.salary = proPay(s, y, noise)
  payHist(s, 'shihaika')
  // the season (stage 4) is drawn on the event stream after this year's calibrated checks, so that it
  // agrees with them: 1軍 games only from the first one on, a thin year when released
  const debutedBefore = s.career.proDebut
  const season = (released: boolean) => {
    if (s.bb) proSeason(y.eventCtx(0x9a0), { ikusei: false, debuted: s.career.proDebut, debutNow: s.career.proDebut && !debutedBefore, released, standing: s.career.proStanding ?? salaryStanding(s) })
    // the first team's minimum guarantee for the days on its roster this season (beside the salary)
    firstTeamPay(y)
  }
  if (!s.career.proDebut) {
    if (y.check('jp.ichigun')) {
      s.career.proDebut = true
      reachRank(s, 8)
      y.add('big', '1軍の試合に初めて出場しました。スタンドの家族の姿が見えました。', { key: true })
    }
  } else {
    s.career.proSeasons++
    if (s.career.proSeasons === 8) {
      reachRank(s, 9)
      // not called FA 権: the official conditions (registration days) have not been checked in a source
      achieve(s, '1軍で8年')
      y.add('big', '1軍に初めて出てから、8年目のシーズンを終えました。長くプロの世界で戦ってきました。', { key: true })
    }
    // the calibrated check is the interest of MLB clubs, drawn as before every year; what follows depends on his rights
    // (PROJECT_PLAN §11.61): with the overseas FA right he decides himself; without it only his club can let him go (posting)
    if (s.age <= 33 && !s.taken.includes('jp.mlb') && s.flags?.['mlb.declined'] === undefined && y.check('jp.mlb')) {
      season(false)
      askMlb(y, false)
      return
    }
  }
  y.add('note', `今季の年俸は${s.career.salary.toLocaleString()}万円です。`, { statIds: ['jpSalaryMedian', 'jpSalaryMean'] })
  const ageCtx = s.age > 30 ? 0.15 * (s.age - 30) : 0
  // the calibrated check is drawn as before; a club keeps a player it has just invested in or who has just carried it (releaseShield)
  const drawn = y.check('jp.npbExit', ageCtx)
  const shield = drawn && s.age < 42 ? releaseShield(s) : null
  if (shield)
    y.add('note', shield === 'draft' ? '結果の出ない一年でしたが、球団は上位で指名した選手として、もう少し時間をかけて育てる方針です。' : '不本意な一年でしたが、これまでの実績から、球団は来季も戦力として計算しています。', {}, eventRng(s, 0x5e1d))
  const released = (drawn && !shield) || s.age >= 42
  season(released)
  if (!released) numberAfterSeason(y)
  if (released) askRelease(y)
  // a player whose posting was refused may ask his club again after a season (PROJECT_PLAN §11.61; at most POSTING_ASKS requests),
  // without waiting for a new word of MLB interest: the calibrated checks above are drawn as before
  else if (s.age <= 33 && !s.taken.includes('jp.mlb') && s.flags?.['mlb.declined'] === undefined && (s.flags?.['posting.n'] ?? 0) > 0 && (s.flags?.['posting.n'] ?? 0) < POSTING_ASKS) askMlb(y, true)
}

/**
 * Who a club does not release after the calibrated release check came out against him (PROJECT_PLAN §11.62; game assumptions, the
 * check itself is drawn as before): a 支配下 pick of the first two rounds in his first three years as a pro (the club's investment),
 * and a player of 33 or under with a regular's season or better (seasonValue ≥ 1) in one of his last two seasons (one poor year does
 * not end a proven player). Two poor years in a row, a late-round pick, or age (the check's own rise after 30, the end at 42) still end it.
 */
export function releaseShield(s: LifeState): 'draft' | 'proven' | null {
  const d = s.career.draft
  if (d && d.kind === 'shihaika' && d.status === 'signed' && d.round <= 2 && s.age - d.age <= 3) return 'draft'
  if (s.age > 33) return null
  const kind = proType(s)
  const recent = (s.bb?.rec?.tournaments ?? []).filter((t) => t.level === 'pro' && t.age < s.age && t.age >= s.age - 2)
  return recent.some((t) => seasonValue(t.line, kind !== 'batter', kind === 'reliever') >= 1) ? 'proven' : null
}

/** how many times in all he may ask his club to post him */
const POSTING_ASKS = 4

/** the question of MLB: his own decision with the overseas FA right; without it, a request to his club (posting) */
function askMlb(y: YearCtx, again: boolean) {
  const s = y.s
  if (faStatus(s).overseas) {
    y.ask({
      id: 'jp.mlb',
      weight: 'major',
      title: 'メジャーリーグに挑戦する？',
      body: `${again ? '海外FA権（1軍で9シーズン）を手にしました。' : 'メジャーリーグの球団が、獲得に関心を示していると伝えられました。海外FA権（1軍で9シーズン）があるので、'}自分の意思で移籍できます。`,
      choices: [{ label: '海を渡る', hint: '言葉も環境も変わる' }, { label: '日本でプレーを続ける' }],
      autoIndex: 0,
    })
    return
  }
  const p = postingChance(s)
  const seasons = faStatus(s).seasons
  y.ask(
    {
      id: 'jp.posting',
      weight: 'major',
      title: again ? 'もう一度、ポスティングを申し出る？' : 'メジャーリーグに挑戦する？',
      body: again
        ? `以前、球団はポスティングを認めませんでした。今季を終えて、1軍で${seasons}シーズン。もう一度、球団に申し出ますか。`
        : `メジャーリーグの球団が、獲得に関心を示していると伝えられました。海外FA権（1軍で9シーズン。いまは${seasons}シーズン）がまだないので、移籍するには、球団にポスティングを認めてもらう必要があります。`,
      factText: POSTING_FACT,
      choices: [
        { label: '球団にポスティングを申し出る', hint: `認められる見込み: 約${Math.round(p * 100)}%（在籍年数・年齢・成績から。ゲーム上の仮定）。認められなければ残留` },
        { label: '日本でプレーを続ける', hint: 'この先、メジャーへの移籍は考えない' },
      ],
      autoIndex: 0,
    },
    { p },
  )
}

/**
 * NPB's posting (PROJECT_PLAN §11.61). Fact: a player without the overseas FA right can move to MLB only if his club agrees to post
 * him; the player cannot force it. Game assumptions (no published rates exist): the chance that the club agrees grows with the
 * first-team seasons counted toward free agency, is lower for a player under 23, and rises with his standing in the league (a
 * regular, a star). A ★ of potential alone does nothing here: only seasons played and results.
 */
export const POSTING_FACT = '球団が認める見込みは、在籍年数（1軍のシーズン数）・年齢・成績から決まる、ゲーム上の仮定です。断られても、次のシーズンのあとに、もう一度申し出ることができます（4回まで）。'
export function postingChance(s: LifeState): number {
  const seasons = faStatus(s).seasons
  // by first-team seasons: almost never before the third, likely from the fifth (a club keeps a young core player)
  const base = [0.005, 0.01, 0.02, 0.05, 0.12, 0.35, 0.55, 0.7, 0.8][Math.min(seasons, 8)]
  const young = s.age < 23 ? 0.5 : 1
  // standing in the league (−2.5 to 3; about 1 a regular): an outstanding player is let go sooner, but only once he has a record of
  // seasons behind him (nothing for two seasons or fewer, in full from the fifth): one strong year does not make a club let him go
  const st = s.career.proStanding ?? 0
  const record = st >= 2 ? 0.25 : st >= 1.2 ? 0.1 : st >= 0.6 ? 0.03 : 0
  return clamp(base * young + record * clamp((seasons - 2) / 3, 0, 1), 0.005, 0.9)
}

/**
 * Does he stay in MLB after this season? (2026-10-24: it was a flat 35% a year to go home, the same for a star and a fringe player, so a
 * third came back after one season.) Now a contract and his standing decide, on streams of their own: at his first season a contract of
 * 1–6 years is drawn from his standing (a game assumption: a regular gets a longer one); during it he goes home only when he is not
 * playing his way (a low standing: an own-stream chance); after it, the chance of going home grows with a low standing and with age.
 * The year's draw that the old check made is still made (the same number of draws on the calibrated stream).
 */
function mlbStays(y: YearCtx, mlbYears: number): boolean {
  const s = y.s
  y.rng.next()
  const st = npbStanding(y)
  const flags = (s.flags ??= {})
  if (flags['mlb.contract'] === undefined) {
    const r = eventRng(s, 0x9b6)
    flags['mlb.contract'] = st >= 2 ? r.int(3, 6) : st >= 1 ? r.int(2, 4) : r.int(1, 2)
  }
  const r = eventRng(s, 0x9b7 + mlbYears)
  if (mlbYears < flags['mlb.contract']) return !(st < 0.5 && r.chance(0.3))
  return !r.chance(clamp(0.12 + 0.2 * clamp(1 - (st + 0.5) / 2.5, 0, 1) + 0.06 * Math.max(0, s.age - 33), 0.06, 0.7))
}

function abroadYear(y: YearCtx) {
  const s = y.s
  // MLB pay in dollars, shown in yen at the game's fixed rate (contract.ts); the draw is the year's, as before
  const usd = mlbSalaryUsd(npbStanding(y), y.rng.normal())
  s.career.salary = usdToMan(usd)
  payHist(s, 'mlb', usd)
  // the season's games, kept as the NPB seasons are (a record only, on a stream of its own: careerSeason.ts mlbSeason)
  const mlbYears = (s.career.salaryHist ?? []).filter((h) => h.kind === 'mlb').length
  mlbSeason(y.eventCtx(0x9a5), npbStanding(y), mlbYears)
  if (mlbStays(y, mlbYears) === false || s.age >= 38) {
    y.add('milestone', 'メジャーでの挑戦に区切りをつけ、日本に戻ることにしました。')
    setPhase(s, 'pro', `${assignNpb(y)}（支配下）`)
    // back in Japan: he lives in the country of his birth again (the only way out of 'abroad' besides death)
    setResidence(s, s.person.country)
    joinTeam(s, 'pro')
    proNumber(s, false)
    // back in NPB on a new contract: what his standing is worth (the market, not a raise)
    s.career.nextSalary = marketSalary(npbStanding(y))
  }
}

/**
 * An offer after a release (PROJECT_PLAN §11.51): another NPB club, or a company team, asks him. It is drawn on a stream of its own
 * (`jp.rehire`, a function of the life and the age: never the calibrated one), only for a player of some standing, with no injury and
 * not too old, at most three times in a life (the count is shared with the other countries: countries/rehire.ts), and at most ONE
 * extra choice a year, added AFTER the old three (their numbers and the おまかせ answer do not move). The independent leagues are
 * always among the old choices (the offer of a named team is the third kind); all of them lead back to the draft by the old yearly checks (amateurYear).
 */
function releaseOffer(y: YearCtx, ikusei: boolean): { kind: 'npb' | 'indep' | 'company'; id: string; label: string } | undefined {
  const s = y.s
  const standing = npbStanding(y)
  const r = usRng(s, 'jp.rehire')
  const u1 = r.next()
  const u2 = r.next()
  const u3 = r.next()
  if (u1 < rehireProb(s, ikusei ? 'farm' : 'first', standing)) {
    const pool = NPB_ORGS.filter((o) => o.id !== s.career.orgId)
    if (pool.length > 0) {
      const o = pool[Math.floor(r.next() * pool.length)]
      return { kind: 'npb', id: o.id, label: orgLabel(o) }
    }
  }
  const open = s.career.injured === 0 && !s.bb?.hurt && (s.flags?.['rehire.n'] ?? 0) < REHIRE_MAX
  // an independent team asks him (more often than the others: the leagues take players of every standing; up to 36)
  if (open && s.age <= 36 && u3 < clamp(0.4 + 0.1 * standing, 0.15, 0.7)) {
    const o = pickIndep(s, 0x79)
    return { kind: 'indep', id: o.id, label: indepLabel(o) }
  }
  if (open && s.age <= 33 && u2 < clamp(0.3 + 0.08 * standing, 0.1, 0.55)) {
    const t = pickAmateur(s, 0x68)
    if (t) return { kind: 'company', id: t.name, label: t.name }
  }
  return undefined
}

/**
 * the oldest (model age) a club signs from the 合同トライアウト: the same limit as the offers of the other leagues (countries/rehire.ts,
 * a game assumption). Before it, nothing stopped a man from passing it at any age, again and again after each release.
 */
const TRYOUT_LAST_AGE = 38
/** the oldest (model age) asked what comes next after a failed tryout, instead of retiring at once (an assumption: shown 26) */
const AFTER_TRYOUT_AGE = 25

function askRelease(y: YearCtx, ikusei = false) {
  const s = y.s
  const otherBaseball = y.rng.chance(statValue('jpCareerOtherBaseball'))
  const offer = releaseOffer(y, ikusei)
  const tier = ikusei || npbStanding(y) < 0 ? '育成' : '支配下'
  const choices = [
    { label: '合同トライアウトを受ける', hint: s.age > TRYOUT_LAST_AGE ? 'この年齢で声がかかることは、まずない' : '別の球団の目にとまれば、もう一度' },
    { label: '独立リーグで続ける', hint: 'NPB への再挑戦を目指す' },
    { label: '現役を引退する', hint: '次の仕事を探す' },
  ]
  const npbHint = `${tier === '育成' ? '育成契約で、支配下を目指す' : '1年契約。年俸は前年より下がることが多い'}（ゲーム上の仮定）`
  if (offer?.kind === 'npb') choices.push({ label: `${offer.label}と契約する（${tier}）`, hint: `別の球団から声がかかった。${npbHint}` })
  // a second NPB club may want him too (PROJECT_PLAN §11.62): he chooses between them. Drawn on a stream of its own after the first
  // offer, added after it (the first offer, the old choices and the おまかせ answer do not move); half the time (an assumption)
  const second = offer?.kind === 'npb' ? secondNpbOffer(s, offer.id) : undefined
  if (second) choices.push({ label: `${second.label}と契約する（${tier}）`, hint: `この球団からも声がかかった。${npbHint}` })
  if (offer?.kind === 'indep') choices.push({ label: `${offer.label}に入る（独立リーグ）`, hint: '声をかけてくれた独立リーグの球団。収入は少ないが、ここからもう一度、NPB のドラフトを目指せる（ゲーム上の仮定）' })
  if (offer?.kind === 'company') choices.push({ label: `${offer.label}（社会人野球）に入る`, hint: '会社員として働きながら野球を続ける。ここからもう一度、NPB のドラフトを目指せる（ゲーム上の仮定）' })
  // his own club may keep him on a 育成 contract (PROJECT_PLAN §11.63: 育成再契約, common after an injury or for a young player), always
  // the last choice; from there the 育成 years as for any 育成 player (ikuseiYear: 2軍 only, the calibrated promotion back to 支配下, or the release)
  const own = ikusei ? undefined : ownIkuseiOffer(s)
  const ownIdx = own ? choices.length : -1
  if (own) choices.push({ label: `${own}と育成契約を結び直す`, hint: '背番号は3桁になり、1軍の試合には出られない。2軍で結果を出せば、支配下に戻れることもある（ゲーム上の仮定）' })
  y.ask(
    {
      id: 'jp.release',
      weight: 'major',
      stop: true,
      title: '来季の契約はない',
      body: offer ? '球団から、来季は契約しないと告げられました。そのあと、声をかけてくれたところがあります。これからどうしますか。' : '球団から、来季は契約しないと告げられました。これからどうしますか。',
      choices,
      autoIndex: otherBaseball && s.age < 33 ? 1 : 2,
      factText:
        '2021〜2025年に戦力外・引退した NPB の選手767人の進路は、NPB 関係57%、その他の野球25%、野球以外11%、未定8%（5年分の人数から計算）。平均年齢は約27歳、平均在籍は約7年。',
      factStatIds: ['jpCareerNpb', 'jpCareerOtherBaseball', 'jpCareerNonBaseball', 'jpCareerUndecided', 'jpReleaseAge', 'jpTenure'],
    },
    { offer: offer?.kind ?? '', offerId: offer?.id ?? '', offerLabel: offer?.label ?? '', offer2Id: second?.id ?? '', offer2Label: second?.label ?? '', ownIdx, ownLabel: own ?? '', tier, ikusei },
  )
}

/**
 * The club that released a 支配下 player offers him a 育成 contract instead (game assumptions): a player of 25 or under, or an injured
 * one of 30 or under; drawn on a stream of its own (an injured player 6 times in 10, a young one 3 in 10). The club's label, or nothing.
 */
/** the first year's pay of a 育成 contract signed after a release (万円; an assumption): half the last pay, between the 育成 minimum and 500 */
function ikuseiResignPay(s: LifeState): number {
  return clamp(Math.round(s.career.salary * 0.5), IKUSEI_MIN_SALARY, Math.max(IKUSEI_MIN_SALARY, 500))
}

function ownIkuseiOffer(s: LifeState): string | undefined {
  const org = NPB_ORGS.find((o) => o.id === s.career.orgId)
  if (!org) return undefined
  const hurt = s.career.injured > 0 || !!s.bb?.hurt
  if (!(s.age <= 25 || (hurt && s.age <= 30))) return undefined
  return usRng(s, 'jp.reikusei').next() < (hurt ? 0.6 : 0.3) ? orgLabel(org) : undefined
}

/** another NPB club that wants the released player, besides the first offer (askRelease): its own stream, half the time */
function secondNpbOffer(s: LifeState, firstId: string): { id: string; label: string } | undefined {
  const r = usRng(s, 'jp.rehire2')
  if (r.next() >= 0.5) return undefined
  const pool = NPB_ORGS.filter((o) => o.id !== s.career.orgId && o.id !== firstId)
  if (!pool.length) return undefined
  const o = pool[Math.floor(r.next() * pool.length)]
  return { id: o.id, label: orgLabel(o) }
}

function assignSecondCareer(y: YearCtx) {
  const s = y.s
  const w = [statValue('jpCareerNpb'), statValue('jpCareerNonBaseball'), statValue('jpCareerUndecided')]
  const which = y.rng.weighted(['npb', 'other', 'undecided'] as const, w)
  s.career.secondCareer = which
  if (!s.taken.includes('work.started')) s.taken.push('work.started')
  if (which === 'npb') {
    setWork(s, { title: '球団スタッフ（コーチ・スカウトなど）', industry: 'baseball', employer: 'team', level: 0, years: 0, satisfaction: 62, regular: true, baseball: true })
    y.add('normal', '球団に残り、スタッフとして働くことになりました。', { statIds: ['jpCareerNpb'] })
  } else if (which === 'other') {
    const w: WorkState = { title: '会社員', industry: 'office', employer: 'small', level: 0, years: 0, satisfaction: 50, regular: true, baseball: false }
    // (the employer: a fictional company, after.ts companyFor)
    const company = companyFor(s, 'second', w)
    setWork(s, company ? { ...w, company } : w)
    y.add('normal', `${company ? `${company.name}で、` : ''}野球とは別の仕事に就きました。新しい名刺に、まだ慣れません。`, { statIds: ['jpCareerNonBaseball'] })
  } else {
    loseWork(s)
    y.add('bad', '次の仕事が決まらないまま、春を迎えました。', { statIds: ['jpCareerUndecided'] })
  }
}

// ---------------------------------------------------------------- decision outcomes

type Resolver = (y: YearCtx, choice: number, data: Record<string, number | boolean | string>) => void

const RESOLVERS: Record<string, Resolver> = {
  'jp.pitch': (y, c) => {
    if (c === 0) {
      y.s.person.position = 'P'
      y.add('decision', 'ピッチャーに挑戦することにしました。最初の投球練習で、キャッチャーのミットが大きく鳴りました。')
    } else {
      y.add('decision', '今のポジションを続けることにしました。')
    }
  },
  'jp.jhs': (y, c) => {
    const s = y.s
    if (c === 2) {
      y.add('decision', '中学では野球をやめることにしました。グローブは押し入れにしまいました。', { key: true })
      endBaseball(s, s.age)
      return
    }
    s.career.softballClub = c === 0
    setPhase(s, 'jhs', c === 0 ? '中学校の軟式野球部' : '地元の硬式クラブ（ボーイズ・シニア）')
    reachRank(s, 2)
    joinTeam(s, c === 0 ? 'jhsSoft' : 'jhsClub')
    // (club fees are the parents' household expense; the player's own savings start at 18)
    y.add('decision', c === 0 ? '中学校の軟式野球部に入りました。' : '硬式のクラブチームに入りました。週末は遠征で県外へ出かけます。')
  },
  'jp.hs': (y, c, d) => {
    const s = y.s
    const strongOffer = d.strongOffer === true
    const idx = strongOffer ? c : c + 1 // 0 = strong, 1 = public, 2 = quit
    if (idx === 2) {
      y.add('decision', '高校では野球をやめることにしました。', { key: true })
      endBaseball(s, s.age)
      askPick(y, 'hs', 'quit')
      return
    }
    s.career.strongSchool = idx === 0
    setPhase(s, 'hs', idx === 0 ? '高校1年・県内の強豪私立高校' : '高校1年・地元の公立高校')
    reachRank(s, 3)
    joinTeam(s, idx === 0 ? 'hsStrong' : 'hsPublic')
    const n = s.bb?.teamSize ?? 30
    y.add('decision', idx === 0 ? `県内の強豪私立に進み、硬式野球部に入りました。部員は${n}人います。` : `地元の公立高校に進み、硬式野球部に入りました。部員は${n}人です。`, {
      key: idx === 0,
    })
    // which real school (names only; whether it has a club and how strong it is are game settings)
    askPick(y, 'hs', idx === 0 ? 'strong' : 'public')
  },
  'jp.hsPick': (y, c, d) => {
    const { opts, kind, which } = pickFromData(d)
    enterSchool(y, which, opts, c, kind)
  },
  'jp.univPick': (y, c, d) => {
    const { opts, kind, which } = pickFromData(d)
    enterSchool(y, which, opts, c, kind)
    if (kind === 'student') askUnivClub(y)
    if (kind === 'walkon') tryWalkOn(y)
  },
  'jp.ronin': (y, c, d) => {
    const s = y.s
    const { opts, kind } = pickFromData(d)
    if (c === 0) {
      const safe = opts.find((x) => x.safe) ?? opts[0]
      enterSchool(y, 'univ', opts, 0, kind, { option: safe, fellBack: true })
      if (kind === 'student') askUnivClub(y)
      if (kind === 'walkon') tryWalkOn(y)
      return
    }
    // a year outside the university: next year is year 0 of the phase (roninYear), the exam is sat again then
    ;(s.flags ??= {})['univ.ronin'] = s.age
    s.flags['univ.roninKind'] = kind === 'walkon' ? 1 : 0
    s.career.phaseYears = -2
    s.career.team = '浪人（予備校）'
    y.add('decision', '浪人して、来年もう一度受験することにしました。', { key: true })
  },
  'fa.declare': (y, c, d) => {
    const s = y.s
    const key = String(d.keys).split(',')[c] ?? 'auto'
    if (key === 'auto') {
      y.add('decision', '契約は球団との更改に任せることにしました。')
      return
    }
    const offers = faOffers(s)
    if (key === 'stay') {
      if (offers[0]) faSign(y, offers[0])
      return
    }
    ;(s.flags ??= {})['fa.used'] = s.age
    s.flags['fa.seasons'] = faStatus(s).seasons
    if (key === 'mlb') {
      y.add('decision', '海外FA権を行使して、メジャーリーグに挑戦することにしました。', { key: true })
      s.taken.push('jp.mlb')
      RESOLVERS['jp.mlb'](y, 0, {})
      return
    }
    y.add('decision', 'FA権を行使しました。', { key: true })
    if (offers.length <= 1) {
      y.add('bad', '他の球団からの申し出はありませんでした。旧球団と契約します。')
      if (offers[0]) faSign(y, offers[0])
      return
    }
    y.ask({
      id: 'fa.pick',
      weight: 'major',
      title: 'どの球団と契約する？',
      body: `${offers.length}球団から条件が届きました（旧球団を含む）。契約の期間は来季から数えます。`,
      choices: offers.map((o) => ({ label: faLine(o), hint: o.stay ? '今の球団に残る' : `移籍する。契約の間は成績で年俸が変わらない（推定の条件）` })),
      autoIndex: offers.reduce((best, o, i) => (o.salary * o.years > offers[best].salary * offers[best].years ? i : best), 0),
    })
  },
  'fa.pick': (y, c) => {
    const offers = faOffers(y.s)
    const o = offers[c] ?? offers[0]
    if (o) faSign(y, o)
  },
  'jp.credits': (y, c) => {
    const s = y.s
    if (c === 0) {
      y.add('decision', '授業に出て、単位を取り直すことにしました。')
      return
    }
    y.add('decision', '野球を優先して、練習を続けることにしました。')
    // what it gains: the practice of the year (the same growth as a choice of practice in the catalog; the question is screen only
    // and this is not its おまかせ answer, so the headless life does not move)
    if (s.bb) s.bb.gain += 0.02
    if (eventRng(s, 0x3e10).next() >= univRepeatP(s.schools?.univ?.method)) return
    // the same year again: endYear adds one, so the phase counts it as not yet passed
    const year = s.career.phaseYears + 1
    s.career.phaseYears--
    ;(s.flags ??= {})['univ.repeat'] = year
    y.add('bad', `単位が足りず、大学${year}年をもう一度やることになりました。`, { key: true }, eventRng(s, 0x3e11))
  },
  'jp.univClub': (y, c) => resolveUnivClub(y, c),
  'jp.wish': (y, c) => {
    const s = y.s
    const ch = wishChoices(s)[c]
    if (!ch?.wish) {
      y.add('decision', '守る場所は、監督に任せることにしました。')
      return
    }
    s.career.wish = { ...ch.wish, age: s.age }
    const want = GROUP_OF[ch.wish.pos]
    const now = s.person.position
    y.add('decision', `希望するポジションを「${wishLabel(s.career.wish)}」と伝えました。`)
    if (want === now || (ch.wish.twoWay && GROUP_OF[ch.wish.twoWay] === now)) return
    // up to high school the team's choice stands; after it, a new team moves him by how well he suits the place (event stream)
    if (!['univ', 'company', 'indep', 'pro', 'proMinor', 'abroad'].includes(s.career.phase)) {
      y.add('normal', `監督は「まずは今の位置で力をつけよう」と言いました。${WISH_LABEL[ch.wish.pos]}への挑戦は、これからの成長しだいです。`)
      return
    }
    const gain = positionFit(s, want) - positionFit(s, now)
    if (eventRng(s, 0x3e1).chance(clamp(0.35 + 1.5 * gain, 0.05, 0.75))) {
      s.person.position = want
      y.add('good', `監督が希望を受け入れ、${WISH_LABEL[ch.wish.pos]}として練習に加わることになりました。`)
    } else {
      y.add('normal', `チーム事情から、当面は今のポジションで出場することになりました。希望は伝えてあります。`)
    }
  },
  'jp.overuse': (y, c) => {
    const s = y.s
    if (c === 0) {
      s.taken.push('jp.overuse.push')
      if (y.rng.chance(0.25)) {
        s.career.injured = 1
        s.z -= 0.15
        y.add('bad', '3日目のマウンドで、肘に痛みが走りました。冬はリハビリに費やしました。', { key: true })
      } else {
        y.add('decision', '3日続けて投げ抜きました。チームは準決勝まで進みました。')
      }
    } else {
      s.z += 0.03
      y.add('decision', '監督に相談して、登板を回避しました。チームは次の試合で敗れました。')
    }
  },
  'jp.hsStudy': (y, c) => {
    const s = y.s
    if (c === 0) {
      s.z += 0.06
      y.add('decision', '毎晩、最後までグラウンドに残りました。')
    } else {
      s.status.knowledge += 6
      y.add('decision', '週3回、塾に通うことにしました。')
    }
  },
  'jp.hsFile': (y, c) => {
    if (c === 1) {
      y.add('decision', 'プロ志望届は出さないことにしました。')
      askRoute(y, 'hs')
      return
    }
    y.add('decision', 'プロ志望届を出しました。', { statIds: ['jpShibouHs'] })
    if (y.check('jp.hsDraft')) {
      const kind = draftNow(y, '高校')
      if (kind === 'shihaika') {
        y.add('big', `ドラフト会議で、${teamName(y.s)}から指名されました。春からプロ野球選手です。`, { key: true, statIds: ['jpDraftFromHs'], stop: 'draft' })
        joinPro(y, 'shihaika')
      } else {
        y.add('big', `ドラフト会議で、${teamName(y.s)}から育成選手として指名されました。`, { key: true, statIds: ['jpDraftFromHs'], stop: 'draft' })
        y.ask({
          id: 'jp.ikuseiOffer',
          weight: 'major',
          title: '育成選手として入団する？',
          body: '育成選手は背番号が3桁で、1軍の試合には出られません。支配下登録を勝ち取れば道が開けます。',
          choices: [{ label: '入団する' }, { label: '断って、ほかの道で力をつける' }],
          autoIndex: 0,
          factText: '育成から支配下に移った選手は、2023年に12球団で32人。',
          factStatIds: ['jpIkuseiPromoted'],
        })
        y.s.pending = { id: 'jp.ikuseiOffer', data: { from: 'hs' } }
      }
    } else {
      y.add('bad', 'ドラフト会議で、名前は呼ばれませんでした。', { key: true })
      askRoute(y, 'hs')
    }
  },
  'jp.univFile': (y, c) => {
    const s = y.s
    if (c === 1) {
      y.add('decision', 'プロ志望届は出さないことにしました。')
      askRoute(y, 'univ')
      return
    }
    y.add('decision', '大学4年の秋、プロ志望届を出しました。', { statIds: ['jpShibouUniv'] })
    if (y.check('jp.univDraft')) {
      const kind = draftNow(y, '大学')
      y.add('big', kind === 'shihaika' ? `ドラフト会議で、${teamName(s)}から指名されました。` : `ドラフト会議で、${teamName(s)}から育成選手として指名されました。`, {
        key: true,
        statIds: ['jpDraftFromUniv'],
        stop: 'draft',
      })
      joinPro(y, kind)
    } else {
      y.add('bad', 'ドラフト会議で、名前は呼ばれませんでした。', { key: true })
      askRoute(y, 'univ')
    }
  },
  'jp.ikuseiOffer': (y, c) => {
    if (c !== 0 && y.s.career.draft) y.s.career.draft.status = 'declined'
    if (c === 0) {
      y.add('decision', '育成選手として入団しました。背番号は3桁です。')
      joinPro(y, 'ikusei')
    } else {
      y.add('decision', '入団を断り、別の道で力をつけることにしました。')
      y.s.career.orgId = undefined
      askRoute(y, 'hs')
    }
  },
  'jp.route': (y, c, d) => {
    const s = y.s
    const keys = String(d.keys).split(',')
    const key = keys[c] ?? 'quit'
    const from = String(d.from)
    if (from === 'hs') {
      y.sim.tally?.('jp.hsUnivShare', key === 'univ')
      y.sim.tally?.('jp.hsCompanyShare', key === 'company')
      y.sim.tally?.('jp.hsIndepShare', key === 'indep' && d.indepPass === true)
    } else if (d.returnee !== true) {
      // (a student who went back to the team is not part of the calibrated shares)
      y.sim.tally?.('jp.univCompanyShare', key === 'company')
      y.sim.tally?.('jp.univIndepShare', key === 'indep' && d.indepPass === true)
    }
    if (key === 'company') {
      const team = assignAmateur(y)
      setPhase(s, 'company', team ? `${team}（社会人野球）` : `${region(s)}の企業チーム（社会人野球）`)
      reachRank(s, 5)
      joinTeam(s, 'company')
      {
        const rt = amateurRating(team)
        if (rt) applyTeamRating(s, rt, COMPANY_MEAN)
      }
      s.job = '会社員（社会人野球）'
      y.add('decision', team ? `${team}に入りました。昼は仕事、夕方からはグラウンドです。` : '企業チームに入りました。昼は会社で働き、夕方からグラウンドに向かいます。', { key: true })
    } else if (key === 'univ') {
      setPhase(s, 'univ', `大学1年・${region(s)}の大学野球部`)
      reachRank(s, 5)
      joinTeam(s, 'univ')
      y.add('decision', '大学に進み、野球を続けることにしました。', { key: true })
      askPick(y, 'univ', 'club')
    } else if (key === 'indep') {
      if (d.indepPass === true) {
        setPhase(s, 'indep', assignIndep(y))
        reachRank(s, 5)
        joinTeam(s, 'indep')
        {
          const rt = indepRating(s.career.orgId)
          if (rt) applyTeamRating(s, rt, INDEP_MEAN)
        }
        y.add('decision', '独立リーグのトライアウトに合格しました。給料は少なく、冬はアルバイトをします。', { key: true })
      } else {
        // His own tryout (2026-10-24). The calibrated draw above (jp.hsIndep / jp.univIndep) is the share of ALL graduates who go on to
        // an independent team, not a pass chance: used as his, a player at the 95th percentile failed nine times in ten. When he chooses
        // the tryout and that draw said no, his level is judged against the team's (as a walk-on: admitP), on a stream of its own. The
        // おまかせ answer chooses this route only when the draw said yes, so the calibrated lives never come here.
        const before = s.career.orgId
        const label = assignIndep(y)
        const rt = indepRating(s.career.orgId)
        const er = eventRng(s, 0x7004)
        if (rt && er.next() < admitP(evaluate(s), rt, 'walkon')) {
          setPhase(s, 'indep', label)
          reachRank(s, 5)
          joinTeam(s, 'indep')
          applyTeamRating(s, rt, INDEP_MEAN)
          y.add('decision', '独立リーグのトライアウトに合格しました。給料は少なく、冬はアルバイトをします。', { key: true }, er)
        } else {
          s.career.orgId = before
          y.add('bad', '独立リーグのトライアウトは不合格でした。野球を離れることにしました。', { key: true }, er)
          endBaseball(s, s.age)
          afterBaseballPath(y, from)
        }
      }
    } else if (key === 'univWalk') {
      // no invitation: enters a university first, then tries out for the baseball club (the rank of playing on: tryWalkOn, if he passes)
      setPhase(s, 'univ', `大学1年・${region(s)}の大学`)
      joinTeam(s, 'univ')
      y.add('decision', '大学に進み、野球部の入部テストを受けることにしました。', { key: true })
      askPick(y, 'univ', 'walkon')
    } else if (key === 'club') {
      joinClub(y, from)
    } else if (key === 'overseas') {
      joinOverseas(y, from, d.indepPass === true)
    } else {
      y.add('decision', '野球を離れ、新しい道に進むことにしました。', { key: true })
      endBaseball(s, s.age)
      afterBaseballPath(y, from)
    }
  },
  'jp.quitCross': (y, c, d) => {
    const s = y.s
    const key = String(d.keys).split(',')[c] ?? 'quit'
    const hs = d.from === 'hs'
    const injury = d.injury === true
    if (key === 'back') {
      // put the team back as it was before the end (the year goes on as a year of recovery or of a second thought)
      setPhase(s, hs ? 'hs' : 'univ', String(d.team))
      s.career.phaseYears = Number(d.py)
      s.career.endedAge = null
      s.career.orgId = d.org ? String(d.org) : undefined
      s.career.amateurTeam = d.amateur ? String(d.amateur) : undefined
      if (s.bb) s.bb.confidence = clamp(s.bb.confidence - (injury ? 8 : 4), 0, 100)
      if (y.rng.chance(injury ? 0.3 : 0.15)) {
        y.add('bad', injury ? 'リハビリを続けましたが、痛みが戻りました。今度こそ、野球を終えることにしました。' : '部に戻りましたが、やはり気持ちが続きませんでした。野球を終えることにしました。', { key: true })
        endBaseball(s, s.age)
        if (!hs) s.job = '大学生'
        yearEvents(y)
        packYear(y)
        return
      }
      if (injury) s.career.injured = Math.max(s.career.injured, 1)
      ;(s.flags ??= {})['quit.back'] = s.age
      y.add('decision', injury ? '治療とリハビリに専念して、復帰を目指すことにしました。' : '仲間と話し、もう一度部に戻ることにしました。', { key: true })
      // the last year of high school ends this year whatever he chose (the age ends it); at university a returner in the fourth
      // year plays on into a fifth (a year held back; the check below reads the year, not the age)
      if (hs && s.age >= 17) hsGraduate(y, false)
    } else if (key === 'helper') {
      s.status.happiness = clamp(s.status.happiness + 3, 5, 100)
      ;(s.flags ??= {})['quit.helper'] = s.age
      y.add('decision', hs ? 'マネージャー・記録員として、部を支えることにしました。' : '学生コーチとして、後輩の練習を手伝うことにしました。', { key: true })
      yearEvents(y)
      packYear(y)
    } else {
      y.add('decision', hs ? '野球部をやめ、新しい道に進むことにしました。' : '大学の野球部を退部し、新しい道に進むことにしました。')
      yearEvents(y)
      packYear(y)
    }
  },
  'jp.release': (y, c, d) => {
    const s = y.s
    if (typeof d.ownIdx === 'number' && d.ownIdx >= 0 && c === d.ownIdx) {
      // re-signed by his own club on a 育成 contract (ownIkuseiOffer): the same club, 育成 from next season
      const label = String(d.ownLabel)
      delete s.career.contract
      s.career.nextSalary = ikuseiResignPay(s)
      setPhase(s, 'proMinor', `${label}（育成）`)
      joinTeam(s, 'pro')
      proNumber(s, true)
      y.add('decision', `${label}と育成契約を結び直しました。背番号は3桁になります。2軍で結果を出して、もう一度支配下を目指します。`, { key: true })
      return
    }
    if (c === 3 || (c === 4 && d.offer2Id)) {
      // an offer (releaseOffer, or the second NPB club: secondNpbOffer); a count for the shared limit of offers
      const f = (s.flags ??= {})
      f['rehire.n'] = (f['rehire.n'] ?? 0) + 1
      if (d.offer === 'npb') {
        const ikusei = d.tier === '育成'
        const id = String(c === 4 ? d.offer2Id : d.offerId)
        const label = String(c === 4 ? d.offer2Label : d.offerLabel)
        s.career.orgId = id
        delete s.career.contract
        // a 育成 contract pays as one (not the 支配下 salary carried on: ikuseiYear starts from nextSalary)
        if (ikusei) s.career.nextSalary = ikuseiResignPay(s)
        setPhase(s, ikusei ? 'proMinor' : 'pro', `${label}（${ikusei ? '育成' : '支配下'}）`)
        joinTeam(s, 'pro')
        proNumber(s, ikusei)
        y.add('good', `${label}から声がかかり、${ikusei ? '育成選手として' : ''}契約しました。もう一度、1軍を目指します。`, { key: true })
      } else if (d.offer === 'indep') {
        s.career.orgId = String(d.offerId)
        s.career.amateurTeam = undefined
        delete s.career.contract
        setPhase(s, 'indep', String(d.offerLabel))
        joinTeam(s, 'indep')
        const ir = indepRating(s.career.orgId)
        if (ir) applyTeamRating(s, ir, INDEP_MEAN)
        y.add('decision', `${d.offerLabel}に入りました。給料は少なく、冬はアルバイトをします。もう一度、NPB のドラフトを目指します。`, { key: true })
      } else if (d.offer === 'company') {
        s.career.amateurTeam = String(d.offerId)
        s.career.orgId = undefined
        delete s.career.contract
        setPhase(s, 'company', `${d.offerLabel}（社会人野球）`)
        joinTeam(s, 'company')
        const rt = amateurRating(String(d.offerId))
        if (rt) applyTeamRating(s, rt, COMPANY_MEAN)
        s.job = '会社員（社会人野球）'
        y.add('decision', `${d.offerLabel}に入りました。昼は仕事、夕方からはグラウンドです。社会人から、もう一度プロのドラフトを目指します。`, { key: true })
      }
      return
    }
    if (c === 0) {
      // (the draw is taken at any age, as before; a club signs from the tryout only a man it would still take: TRYOUT_LAST_AGE)
      if (y.rng.chance(0.08) && s.age <= TRYOUT_LAST_AGE) {
        setPhase(s, 'pro', `${assignNpb(y, true)}（支配下）`)
        joinTeam(s, 'pro')
        proNumber(s, false)
        y.add('good', 'トライアウトで別の球団の目にとまり、契約を勝ち取りました。', { key: true })
      } else if (s.age <= AFTER_TRYOUT_AGE) {
        // a young man is not sent straight into retirement (feedback r11 B3): he chooses (the tryout is never おまかせ's answer:
        // the calibrated lives never come here)
        y.add('bad', 'トライアウトのあと、電話は鳴りませんでした。', { key: true })
        y.ask(
          {
            id: 'jp.afterTryout',
            weight: 'major',
            stop: true,
            title: 'まだ若い。これからどうする？',
            body: 'どの球団からも声はかかりませんでした。それでも、まだ若く、道はひとつではありません。',
            choices: [
              { label: '独立リーグで、もう一度 NPB を目指す', hint: '収入は少ないが、ここから再びドラフトを目指せる' },
              { label: '大学に入り直して、学び直す', hint: '選手としては区切りをつけ、4年間学ぶ。卒業後の仕事の幅が広がる' },
              { label: '現役を引退して、次の仕事を探す', hint: '新しい道に進む' },
            ],
            autoIndex: 2,
          },
          {},
        )
      } else {
        y.add('bad', 'トライアウトのあと、電話は鳴りませんでした。現役を引退しました。', { key: true })
        endBaseball(s, s.age)
        assignSecondCareer(y)
      }
    } else if (c === 1) {
      setPhase(s, 'indep', assignIndep(y))
      joinTeam(s, 'indep')
      {
        const rt = indepRating(s.career.orgId)
        if (rt) applyTeamRating(s, rt, INDEP_MEAN)
      }
      y.add('decision', '独立リーグで、もう一度 NPB を目指すことにしました。', { key: true })
    } else {
      y.add('milestone', '現役を引退しました。', { key: true })
      endBaseball(s, s.age)
      assignSecondCareer(y)
    }
  },
  'jp.mlb': (y, c) => {
    const s = y.s
    if (c === 0) {
      setPhase(s, 'abroad', 'MLB の球団')
      // he moves to the US (the one place the model sends a Japanese to play; PROJECT_PLAN §11.38)
      setResidence(s, 'US')
      // an NPB multi-year contract ends with the move abroad (a return is a new contract: proPay)
      delete s.career.contract
      s.career.orgId = undefined
      reachRank(s, 10)
      achieve(s, 'MLB')
      // the number of his new club (own stream, a game assumption: 1 to 99)
      if (s.bb) s.bb.number = eventRng(s, 0x9b4).int(1, 99)
      y.add('big', `海を渡り、メジャーリーグの球団と契約しました。${s.bb?.number !== undefined ? `背番号は${s.bb.number}です。` : ''}`, { key: true })
    } else {
      y.add('decision', '日本でプレーを続けることにしました。')
    }
  },
  // a young man released and not signed at the tryout (jp.release, feedback r11 B3): independent league, university, or retirement
  'jp.afterTryout': (y, c) => {
    const s = y.s
    if (c === 0) {
      setPhase(s, 'indep', assignIndep(y))
      joinTeam(s, 'indep')
      const rt = indepRating(s.career.orgId)
      if (rt) applyTeamRating(s, rt, INDEP_MEAN)
      y.add('decision', '独立リーグで、もう一度 NPB を目指すことにしました。', { key: true })
    } else if (c === 1) {
      y.add('milestone', '現役を引退し、大学を受験することにしました。', { key: true })
      endBaseball(s, s.age)
      s.job = '大学生'
      // four years from his entrance, not at 22 (the graduation in lifeYear)
      ;(s.flags ??= {})['univ.late'] = s.age + 1
      askPick(y, 'univ', 'student')
    } else {
      y.add('milestone', '現役を引退しました。', { key: true })
      endBaseball(s, s.age)
      assignSecondCareer(y)
    }
  },
  // the student the draw sent to work chooses (askUnivInstead): to work, as drawn, or a university's exam
  'jp.afterPath': (y, c) => {
    const s = y.s
    if (c === 1) {
      // (a job chosen earlier in the same year is left for the university; the first job is chosen again after it: work.first)
      if (s.after?.work) loseWork(s)
      s.taken = s.taken.filter((t) => t !== 'work.started')
      s.job = '大学生'
      y.add('decision', '大学を受験することにしました。', { key: true })
      askPick(y, 'univ', 'student')
    } else {
      y.add('decision', '高校を卒業して、働くことにしました。')
    }
  },
  // posting (POSTING_FACT): the club's answer is drawn on a stream of its own; refused, he stays and MLB may ask again another year
  'jp.posting': (y, c, data) => {
    const s = y.s
    if (c !== 0) {
      s.flags = { ...s.flags, 'mlb.declined': s.age }
      y.add('decision', '日本でプレーを続けることにしました。')
      return
    }
    const r = eventRng(s, 0x9057)
    const p = typeof data.p === 'number' ? data.p : postingChance(s)
    s.flags = { ...s.flags, 'posting.n': (s.flags?.['posting.n'] ?? 0) + 1 }
    if (r.next() < p) {
      y.add('good', '球団が、ポスティングでの移籍を認めました。', { key: true }, r)
      s.taken.push('jp.mlb')
      RESOLVERS['jp.mlb'](y, 0, {})
    } else {
      y.add('bad', '球団は「まだチームに必要な選手だ」として、ポスティングを認めませんでした。日本でプレーを続けます。', { key: true }, r)
    }
  },
  // a medical bill of the money screen's insurance (shop.ts careYear): the way he chose to be treated
  'shop.care': (y, c, data) => {
    const way: CareWay = c === 1 ? 'light' : c === 2 ? 'none' : 'hospital'
    const l = treatCare(y.s, { bill: Number(data.bill), own: Number(data.own) }, way)
    y.add(l.kind, l.text, {}, eventRng(y.s, 0x5a72))
  },
  breath: (y) => {
    y.add('note', `${shownAge(y.s.age)}歳の節目に、少し立ち止まって、これまでをふりかえりました。`)
  },
}

function afterBaseballPath(y: YearCtx, from: string, planned = false) {
  const s = y.s
  // decided once (PROJECT_PLAN §11.61): the path chosen when baseball ended at high school's end is not drawn again at 18
  // (lifeYear's call is for those who left baseball before that decision)
  s.flags = { ...s.flags, 'after.path': s.age }
  if (from === 'hs') {
    const univ = y.rng.chance(clamp(0.35 + 0.1 * (s.person.wealth - 3) + (s.status.knowledge - 50) / 200, 0.1, 0.85))
    if (univ) {
      s.job = '大学生'
      y.add('normal', '大学に進学することにしました。')
      askPick(y, 'univ', 'student')
    } else {
      s.job = ''
      // the draw sent him to work: on screen he may still choose a university (in a planned year, after its events: planYear)
      if (!y.sim.headless) {
        if (planned) y.univInstead = true
        else askUnivInstead(y)
      }
    }
  } else {
    s.job = ''
  }
}

/**
 * A student whom the model's draw sent to work after high school (afterBaseballPath) may still choose to sit a university's exam: his
 * own choice, on screen only (the headless life keeps the draw, and おまかせ answers as it did: to work). Before, a student of any
 * level could be sent to work with no way to choose a university (feedback: 偏差値77 and no university to choose).
 */
function askUnivInstead(y: YearCtx) {
  const s = y.s
  const sd = Math.round(studentDev(s))
  const d: Decision = {
    id: 'jp.afterPath',
    weight: 'major',
    title: '高校卒業後は？',
    body: `大学には進まず、働くことを考えています。いまの学力は偏差値およそ${sd}です。`,
    choices: [
      { label: '就職して働く', hint: '新しい道に進む。仕事・家族・趣味の出来事が待っている' },
      { label: '大学を受験する（野球はしない）', hint: `入れる大学は学力しだい（いまの偏差値の目安${sd}）。4年間は学生として過ごす` },
    ],
    autoIndex: 0,
  }
  if (y.decision) y.queueAsk(d)
  else y.ask(d)
}

// ---------------------------------------------------------------- life outside baseball
// Work, money, family, community and the rest are catalog events (afterEvents.ts) and the
// household model (after.ts). Here: school milestones, income and money, deaths in the family.

/** the money screen's yearly parts (shop.ts), on a stream of their own: nothing for a life that never opened it */
function shopYear(y: YearCtx) {
  const s = y.s
  const rng = eventRng(s, 0x5a71)
  const gain = portfolioYear(s)
  if (Math.abs(gain) >= 20) y.add(gain > 0 ? 'good' : 'bad', `運用の成績は、この一年で${gain > 0 ? '+' : '−'}${Math.abs(gain).toLocaleString()}万円でした。`, {}, rng)
  for (const l of autoShopYear(s)) y.add(l.kind, l.text, { key: l.key, eventId: l.eventId, category: l.category }, rng)
  // a medical bill asks how to be treated, when a decision is still free this year (otherwise, as before: treated at a hospital)
  const decide = (b: CareBill) => {
    if (!y.canAsk()) return false
    y.queueAsk(
      {
        id: 'shop.care',
        weight: 'minor',
        title: '病気やけがの治療',
        body: `病気やけがで、治療が必要になりました。病院でしっかり治すと医療費は${b.bill.toLocaleString()}万円${b.bill > b.own ? `（保険の保障で${(b.bill - b.own).toLocaleString()}万円が出て、自己負担は${b.own.toLocaleString()}万円）` : '（保険がなく、全額が自己負担）'}です。いまの所持金は${s.money < 0 ? '−' : ''}${Math.abs(Math.round(s.money)).toLocaleString()}万円です。`,
        factText: '治療の費用・体への影響・再発しやすさは、ゲーム上の仮定です。',
        choices: careChoices(s, b),
        autoIndex: 0,
      },
      { bill: b.bill, own: b.own },
    )
    return true
  }
  for (const l of careYear(s, decide)) y.add(l.kind, l.text, {}, rng)
  recordHist(s)
}

function lifeYear(y: YearCtx) {
  const s = y.s
  const rng = y.rng
  // school milestones for players who left baseball early (a US life has its own: countries/us/year.ts)
  if (s.person.country === 'US') usLifeYear(y)
  else if (leagueProfile(s.person.country)) leagueLifeYear(y)
  else if (!isPlaying(s)) {
    if (s.age === 12 && s.career.phase === 'retired') y.add('milestone', '中学校に入学しました。')
    if (s.age === 15 && s.career.phase === 'retired') {
      if (s.schools?.hs) y.add('milestone', `${s.schools.hs.name}に進学しました。`)
      else {
        // left baseball before the high school decision: still goes to a real school (the おまかせ choice)
        askPick(y, 'hs', 'quit')
        if (!s.schools?.hs && !y.decision) y.add('milestone', '高校に進学しました。')
      }
    }
    if (s.age === 18 && s.career.phase === 'retired' && !s.job && s.flags?.['after.path'] === undefined) afterBaseballPath(y, 'hs', true)
  }
  if (s.age >= 18) ensureAfter(s)
  // every man finishes high school (no drop-outs in the model): a household opened before 18 (a club team at 17) had said 中学
  if (s.after?.edu === 'jhs' && s.age >= 18) s.after.edu = 'hs'
  univClubYear(y)
  // four years at the university: a year later after a 浪人 year
  // (a student who started a career, careers.ts startCareer, studied beside it: he graduates too and keeps the career)
  const studying = s.job === '大学生' || (s.flags?.['career.student'] !== undefined && !!s.schools?.univ && s.after?.edu !== 'univ')
  // (the course's years from the entrance: 4, or 6 for medicine, dentistry and pharmacy, license.ts)
  if (studying && s.age >= graduationAge(s)) {
    if (s.job === '大学生') s.job = ''
    ensureAfter(s).edu = 'univ'
    y.add('milestone', '大学を卒業しました。')
    // the national exam of a licensed course, on a stream of its own (the graduation line above is as before)
    if (s.license) {
      const er = eventRng(s, 0x11ce)
      takeExam(s, er, (kind, text) => y.add(kind, text, { key: true }, er))
    }
  } else if (examDue(s)) {
    // another try a year later; passed, he leaves the job he took meanwhile for the licensed work
    const er = eventRng(s, 0x11cf)
    const career = LICENSES[s.license!.kind].career
    if (takeExam(s, er, (kind, text) => y.add(kind, text, { key: true }, er)) && career && s.after?.work && careerOf(s) !== career) {
      startCareer(s, career)
      y.add('decision', `勤めていた仕事を辞め、${LICENSES[s.license!.kind].title}として働き始めました。`, { key: true }, er)
    }
  }
  // a university player graduates too, whatever came after the team (assumption: no drop-outs)
  if (s.after && s.after.edu !== 'univ' && s.age >= 22 && s.timeline.some((t) => t.phase === 'univ')) s.after.edu = 'univ'
  // (the salary, a signing bonus, and the first team's minimum guarantee of this season: each paid once, the last two not part of the salary)
  const income = incomeNow(s, isPlaying(s) ? s.career.salary : null) + (s.career.signingPay ?? 0) + (s.career.firstTeamPay ?? 0)
  delete s.career.signingPay
  delete s.career.firstTeamPay
  s.income = income
  s.lifetimeIncome += income
  // household finances are the player's own from 18 (before that, the parents' household)
  householdYear(s)
  // living abroad teaches the local language a little each year (state only, no draw; language.ts)
  immerseYear(s)
  // the money screen's settings, only for a man who set them (shop.ts): the spare money's year and the spending that repeats
  if (s.shop) shopYear(y)
  // a son's baseball (kidBall.ts): drawn at 8 and told year by year, on a stream of its own (the year's stream is not drawn)
  kidBallYear(s, (kind, text, key) => y.add(kind, text, { key }, eventRng(s, 0x6b2b)))
  // family
  for (const who of ['father', 'mother'] as const) {
    const a = s.family[who]
    if (a !== null && a > 45 && rng.chance(deathProb(a, 60) * 1.0)) {
      s.family[who] = null
      // the cause from the model's causes, on a stream of its own (family.ts relativeCause): the year's stream is not drawn more
      y.add('bad', `${who === 'father' ? '父' : '母'}が${a}歳で亡くなりました（死因: ${relativeCause(s, a, who === 'father' ? 1 : 2)}）。`, { key: s.age < 40 })
      s.status.happiness -= 8
    }
  }
  // living in the parents' house after both parents are gone: the house passes to him (assumption)
  if (s.after?.home === 'parents' && s.family.father === null && s.family.mother === null) {
    s.after.home = 'own'
    y.add('milestone', '親の残した家に、そのまま住み続けることにしました。')
  }
  // (meeting a partner, marriage, children, grandchildren, coaching and illness are catalog events)
  if (s.family.spouse && s.age > 40 && rng.chance(0.004 * (s.age - 40))) {
    y.add('bad', `妻の${s.family.spouse.name}さんに先立たれました（死因: ${relativeCause(s, s.age + (s.family.partnerInfo?.name === s.family.spouse.name ? s.family.partnerInfo.gap : 0), 3)}）。`, { key: true })
    s.family.spouse = null
    s.family.ended = 'death'
    s.family.endedAge = s.age
    s.status.happiness -= 15
  }
}

// ---------------------------------------------------------------- breath (節目)

const BREATH_AGES: Record<number, string> = { 12: '中学生になった春', 18: '高校を卒業した春', 30: `${shownAge(30)}歳`, 50: `${shownAge(50)}歳`, 70: `${shownAge(70)}歳` }
/** (the school years of the US are other ages: only the round ages are used there) */
const BREATH_AGES_US: Record<number, string> = { 30: `${shownAge(30)}歳`, 50: `${shownAge(50)}歳`, 70: `${shownAge(70)}歳` }

function breath(y: YearCtx) {
  const s = y.s
  const label = (s.person.country === 'JP' || s.person.country === undefined ? BREATH_AGES : BREATH_AGES_US)[s.age]
  if (!label || s.taken.includes(`breath.${s.age}`)) return
  y.ask({
    id: 'breath',
    weight: 'breath',
    title: `${s.person.given}、${label}`,
    body: isPlaying(s)
      ? `いまも野球を続けています。${s.career.team ? `（${s.career.team}）` : ''}`
      : `野球を離れて${s.career.endedAge !== null ? `${s.age - s.career.endedAge}年` : ''}がたちました。`,
    question: s.age < 18 ? 'あなたは、この年齢のころ、何に夢中でしたか。' : 'あなた自身の野球との距離は、いまどのくらいですか。',
    choices: [{ label: '書き残して、続ける' }, { label: 'そのまま続ける' }],
    autoIndex: 1,
  })
  s.taken.push(`breath.${s.age}`)
}

// ---------------------------------------------------------------- status & mortality

function statusYear(y: YearCtx) {
  const s = y.s
  const rng = y.rng
  const f: Focus = s.focus
  let effort = 0
  if (isPlaying(s)) {
    const rho = statValue('abilityRho')
    let drift = f === 'practice' ? statValue('focusEffect') : -0.03
    if (!s.career.softballClub && s.career.phase === 'jhs') drift += 0.04
    if (s.career.strongSchool && s.career.phase === 'hs') drift += 0.04
    if (s.career.injured > 0) drift -= 0.2
    const b = s.bb
    if (b) {
      // practice shapes the skill profile; choices made this year add to the growth (bb.gain)
      const er = eventRng(s, 0x5157)
      effort = practiceYear(b, er, b.gain)
      drift += effort
      b.gain = 0
      b.fatigue = clamp(Math.round(b.fatigue * 0.45 + (f === 'practice' ? 32 : f === 'rest' ? 8 : 20) + er.normal() * 5), 0, 100)
      b.condition = clamp(Math.round((b.condition * 0.4 + er.normal() * 0.9) * 10) / 10, -2, 2)
      b.confidence = clamp(Math.round(b.confidence + (50 - b.confidence) * 0.2 + (b.role === 'starter' ? 3 : b.role === 'outside' ? -2 : 0)), 0, 100)
      b.coachEval = clamp(Math.round(b.coachEval + (50 - b.coachEval) * 0.15), 0, 100)
      // a two-way player (the wish, on screen only) carries the load of both (PROJECT_PLAN §11.23)
      if (s.career.wish?.twoWay) b.fatigue = clamp(b.fatigue + 6, 0, 100)
    }
    if (s.pot) {
      // potential mode: z follows the talent and how well he is developed (potential.ts)
      const r = advanceYear(s, effort, eventRng(s, 0x70a5))
      if (r.unlocked) y.add('good', '伸び悩んでいたのが嘘のように、ある日、体が思いどおりに動くようになりました。', { key: true, category: 'growth' }, eventRng(s, 0x70a6))
    } else {
      s.z = rho * s.z + Math.sqrt(1 - rho * rho) * rng.normal() + drift
    }
  }
  if (s.pot) aptitudeYear(s)
  const st = s.status
  st.health += f === 'rest' ? 3 : f === 'practice' && isPlaying(s) ? -1 : 0
  st.relations += f === 'people' ? 3 : -1
  st.knowledge += f === 'study' ? 4 : 0
  st.happiness += (60 - st.happiness) * 0.15 + rng.normal() * 3 + (f === 'people' ? 1 : 0)
  if (s.age > 40) st.health -= 0.6
  if (s.age > 65) st.health -= 0.8
  if (s.age > 80) st.health -= 1
  st.health = clamp(Math.round(st.health), 5, 100)
  st.happiness = clamp(Math.round(st.happiness), 5, 100)
  st.relations = clamp(Math.round(st.relations), 5, 100)
  st.knowledge = clamp(Math.round(st.knowledge), 1, 99)
}

/**
 * The health that the death rate reads (PROJECT_PLAN §11.62). From 50, good health protects only up to MORTALITY_HEALTH_CAP: the
 * rate's tie to health (mortality.ts, e^((60−health)/35)) is calibrated on おまかせ lives, whose health falls with age, and a life kept
 * at health 100 by the player's choices (the focus on health every year) lived to 100 on average (measured: 3,000 lives, mean 100.3,
 * 44% to 105). Studies of lifestyle find about a decade, not two: men of 50 with five healthy habits against none, 37.6 against 25.5
 * more years (Li et al., Circulation 2018;138:345–355). The cap keeps such a life near 88–89 years; before 50 nothing changes.
 */
export const MORTALITY_HEALTH_CAP = 60
export function mortalityHealth(s: LifeState): number {
  return s.age >= 50 ? Math.min(s.status.health, MORTALITY_HEALTH_CAP) : s.status.health
}

function mortality(y: YearCtx) {
  const s = y.s
  // the death rate follows the life table of the country (JP: jpLifeMaleAt10, the default; US: usLifeMaleAt10)
  const us = s.person.country === 'US'
  const lp = leagueProfile(s.person.country)
  const h = mortalityHealth(s)
  const dp = us ? deathProb(s.age, h, COUNTRY_INFO.US.lifeStatId, US_MORTALITY_EXTRA) : lp ? deathProb(s.age, h, COUNTRY_INFO[lp.cc].lifeStatId, lp.mortalityExtra) : deathProb(s.age, h)
  if (!y.rng.chance(dp)) return
  const cause = causeOfDeath(s.age, y.rng)
  s.alive = false
  s.causeOfDeath = cause
  if (isPlaying(s)) endBaseball(s, s.age)
  // a pending decision is dropped: the year ends with the death
  delete s.pending
  delete s.queue
  y.decision = undefined
  y.add('death', `${shownAge(s.age)}歳で亡くなりました。死因は${cause}でした。`, { at: 0.95, key: true })
}

export function skillPercentile(s: LifeState): number {
  return Math.round(pct(s.z) * 1000) / 10
}

export type { CareerState }

/**
 * What another country's flow needs from this file (PROJECT_PLAN §11.31). They are reached through this object when a year is
 * played, not when the modules load, so countries/us/year.ts can import it though this file imports that one.
 */
export const lifeApi = { setPhase, endBaseball, reachRank, achieve, joinTeam, applyTeamRating, announce, payHist, proNumber, isPlaying }
