import type { CountryCode } from '../data/types.ts'
import type { DraftInfo } from './contract.ts'

export type Pace = 'p5' | 'p15' | 'p30' | 'p60' | 'instant'
export type Mode = 'normal' | 'potential'

export interface LifeConfig {
  seed: number
  country: CountryCode
  /** index into the country's region table (a prefecture for JP, a state for US: countries/index.ts); undefined = drawn at birth */
  prefecture?: number
  pace: Pace
  /** 'potential' = the potential mode (PROJECT_PLAN §11.20); absent = the normal mode */
  mode?: Mode
  /** the ★ chosen at the start of a potential-mode life, 1..10 (absent = ★1; PROJECT_PLAN §11.21) */
  stars?: number
}

export type Position = 'P' | 'C' | 'IF' | 'OF'
export type Focus = 'practice' | 'study' | 'rest' | 'people'

/** Career phases. Only male players are modelled (PROJECT_PLAN §2-4). */
export type Phase =
  | 'child'
  | 'youth' // 学童・リトル
  | 'jhs' // 中学
  | 'hs' // 高校
  | 'univ' // 大学・NCAA
  | 'company' // 社会人
  | 'indep' // 独立リーグ
  | 'proMinor' // 育成・マイナー
  | 'pro' // 1軍を目指す支配下・トップリーグ
  | 'abroad' // MLB など海外
  | 'retired' // 野球を離れた後
  | 'dead'

export type LogKind = 'normal' | 'good' | 'bad' | 'big' | 'decision' | 'milestone' | 'note' | 'death'

export interface LogEntry {
  age: number
  year: number
  kind: LogKind
  text: string
  /** stats referenced by this line (shown as the source row) */
  statIds?: string[]
  /** candidate for "重大な出来事" */
  key?: boolean
  /** catalog event that produced this line (src/engine/events.ts), for counting */
  eventId?: string
  /** event category (practice, team, family, work, health, …) */
  category?: string
  /** the squad this line announces (role and shirt number at that moment; the panel shows it until the next one, feedback r11 A1) */
  roster?: Roster
  /** the screen stops on this line (a draft, the end of the playing career) until the player goes on (PROJECT_PLAN §11.23) */
  stop?: 'draft' | 'quit'
}

/** a line the screen stops on, with its kind */
export interface LifeEntryStop {
  kind: 'draft' | 'quit'
  entry: LogEntry
}

export interface Person {
  family: string
  given: string
  birthYear: number
  birthMonth: number
  country: CountryCode
  prefecture: number
  /** household income quintile 1 (lowest) .. 5 */
  wealth: number
  throws: 'R' | 'L'
  bats: 'R' | 'L'
  position: Position
  /** adult height (cm) the body grows toward */
  heightCm: number
  parentBaseball: 'none' | 'hs' | 'univ' | 'company'
  /**
   * the country of a parent who comes from another country than his own (a man of two backgrounds); absent for most. Set at birth
   * from a stream of its own (language.ts initBackground), and used only for the language he grows up with, the visits to the
   * relatives, and which national team he may choose: never for his ability or his character (PROJECT_PLAN §11.41)
   */
  heritage?: CountryCode
}

/** the partner met in an event: the age is kept as the gap to his own, so it grows with him */
export interface PartnerInfo {
  name: string
  gap: number
  job: string
}

export interface FamilyState {
  father: number | null // age, null = deceased
  mother: number | null
  spouse: { name: string; years: number } | null
  children: number
  everMarried: boolean
  /** ages of the children (optional for older saves) */
  kids?: number[]
  /** dating someone (name) — the step before marriage */
  partner?: string
  /** who the partner is, drawn when they met (family.ts; optional, absent for partners met before it or in other countries' events) */
  partnerInfo?: PartnerInfo
  /** the children's names, in the order of `kids` (family.ts; optional, absent for children born in older saves) */
  kidNames?: string[]
  /** age at the first marriage (optional for older saves) */
  marriedAge?: number
  /** how the last marriage ended, and at what age (absent: it did not, or an older save); a man in this state may meet someone again */
  ended?: 'divorce' | 'death'
  endedAge?: number
  /** a son's baseball, in the order of `kids` (kidBall.ts; null: not followed; absent: not decided yet, or an older save) */
  kidBall?: (KidBall | null)[]
}

/** a son's baseball path (kidBall.ts), drawn once when he is 8 and told year by year to his father */
export interface KidBall {
  name: string
  steps: { age: number; text: string; kind: LogKind; key?: boolean; rank?: number }[]
}

export type Industry =
  | 'maker'
  | 'sales'
  | 'office'
  | 'public'
  | 'transport'
  | 'construction'
  | 'care'
  | 'education'
  | 'food'
  | 'it'
  | 'baseball'
  | 'family'
  // (the careers of careers.ts, 2026-10-24: creators and streamers, entertainers, the forces, politics)
  | 'media'
  | 'entertainment'
  | 'defense'
  | 'politics'

/** the careers of careers.ts that events can follow (a job of the offers has none) */
export type CareerKind =
  | 'gamer'
  | 'streamer'
  | 'idol'
  | 'singer'
  | 'actor'
  | 'talent'
  | 'manga'
  | 'novelist'
  | 'illustrator'
  | 'founder'
  | 'sdf'
  | 'politician'
  | 'commentator'
  | 'coach'
  | 'scout'
  | 'frontOffice'
  // (the licensed work of license.ts, feedback r11 A8: a national licence after the matching university)
  | 'doctor'
  | 'dentist'
  | 'pharmacist'
  | 'nurse'

/** a job after baseball (PROJECT_PLAN §11.6) */
export interface WorkState {
  title: string
  industry: Industry
  employer: 'large' | 'small' | 'public' | 'self' | 'team'
  /** 0 一般 … 4 部長・経営者 */
  level: number
  years: number
  satisfaction: number // 0–100
  regular: boolean
  /** the job has to do with baseball */
  baseball: boolean
  /** the employer, a fictional company (after.ts companyFor; absent for public service, his own business, a club, and older saves) */
  company?: Company
  /** a company team's player: the team he played for, whose company employs him (a real team: only its name, never invented company data) */
  team?: string
  /** his age when he took this job (after.ts setWork; absent in older saves): events about "this job" check it (spec.ts sameJobSince) */
  since?: number
  /** one of the careers of careers.ts, when it is one (absent for the jobs of the offers and in older saves) */
  kind?: CareerKind
  /** a career's yearly pay (万円) set by its events (fame, sales, a contract); absent: the wage table (after.ts jobIncome) */
  pay?: number
}

/** a fictional employer: its name (shown with 架空), what it does and how many people work there */
export interface Company {
  name: string
  kind: string
  staff: number
}

/** life after (or beside) baseball (PROJECT_PLAN §11.6) */
export interface AfterState {
  edu: 'jhs' | 'hs' | 'univ'
  work?: WorkState
  /** years without a job so far in this spell */
  jobless: number
  home: 'parents' | 'rent' | 'own'
  /** housing loan left (万円) */
  loan: number
  /** what the player wanted when baseball ended */
  goal?: 'family' | 'work' | 'baseball' | 'learn' | 'free'
  /** ways of staying with baseball (草野球, 少年野球の指導, 審判, …) */
  baseballLife: string[]
  community: boolean
  /** looking after a parent */
  care: boolean
  retired: boolean
  /** job titles held, in order (optional for older saves) */
  jobs?: string[]
  /** the jobs that ended: what, from and to which age, how it ended (after.ts setWork / loseWork; absent in older saves) */
  pastJobs?: { title: string; company?: string; from?: number; to: number; end: 'changed' | 'lost' }[]
}

export interface CareerState {
  phase: Phase
  /** label shown on the stage chip, e.g. 「高校2年・地元の公立高校」 */
  team: string
  teamOrgId?: string
  /** rank on the career ladder reached so far (see ladder.ts) */
  highestRank: number
  achievements: string[]
  yearsPlaying: number
  startedAge: number
  endedAge: number | null
  /** years spent in the current phase */
  phaseYears: number
  strongSchool: boolean
  softballClub: boolean
  injured: number // remaining injury years
  proDebut: boolean
  proSeasons: number
  minorSeasons: number
  salary: number // 万円, current year
  draftedFrom?: string
  secondCareer?: string
  /** registered real organisation the player belongs to now (src/data/orgs.ts) */
  orgId?: string
  /** the real 社会人野球 team (src/data/teams.ts) while in the company phase */
  amateurTeam?: string
  /** the draft: the pick and the first contract (PROJECT_PLAN §11.23; optional for older saves) */
  draft?: DraftInfo
  /** pay by year while a pro (万円; MLB years also in dollars), with the team */
  salaryHist?: {
    age: number
    year: number
    salary: number
    usd?: number
    kind: 'shihaika' | 'ikusei' | 'mlb' | 'minor'
    team: string
    /** the first team's minimum guarantee paid that year on top of the salary (万円; contract.ts firstTeamExtra) */
    firstTeam?: number
  }[]
  /** a US life's MLB draft (PROJECT_PLAN §11.31): the pick and what came of it; the Japanese draft is `draft` */
  usDraft?: { year: number; age: number; from: 'hs' | 'univ' | 'juco'; round: number; overall: number; bonusUsd: number; status: 'drafted' | 'signed' | 'declined' }
  /** a signing bonus to be paid with this year's income (万円) */
  signingPay?: number
  /** the first team's minimum guarantee of this season, paid with this year's income beside the salary (万円; never part of `salary`) */
  firstTeamPay?: number
  /** the standing among NPB players behind this year's play time (the draw that used to set the salary) */
  proStanding?: number
  /** a salary fixed by a new contract for next season (promotion, return from MLB) */
  nextSalary?: number
  /** a multi-year contract in force (万円): the pay is fixed until this age, with this team (contract.ts multiYearTerm) */
  contract?: { salary: number; untilAge: number; team: string }
  /** the position he wants to play, by stage (PROJECT_PLAN §11.23); the position he plays is person.position */
  wish?: PositionWish
}

export type WishPos = 'SP' | 'RP' | 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF'
/** a wish: one place, or two-way (a pitcher's role and a fielding place) */
export interface PositionWish {
  pos: WishPos
  twoWay?: WishPos
  /** the age it was chosen at */
  age: number
}

export type SkillKey =
  | 'velocity' // 球速
  | 'control' // 制球
  | 'breaking' // 変化球
  | 'stamina' // スタミナ
  | 'contact' // ミート
  | 'power' // 長打
  | 'speed' // 走力
  | 'fielding' // 守備
  | 'arm' // 肩
  | 'catching' // 捕球
  | 'throwing' // 送球
  | 'calling' // リード

export type Menu = 'batting' | 'pitching' | 'defense' | 'body' | 'balanced'

/** Baseball details (model values; PROJECT_PLAN §11.2 stage 2). The calibrated overall ability stays `z`. */
export interface BaseballState {
  /** profile around z (mean 0): what the player is good and bad at */
  skills: Record<SkillKey, number>
  /** body build factor for weight (1 = average) */
  build: number
  /** muscle added by training (kg) */
  muscleKg: number
  fatigue: number // 0–100
  condition: number // −2 (絶不調) … +2 (絶好調)
  confidence: number // 0–100
  coachEval: number // 0–100 監督の評価
  /** standing in the team at the last announcement */
  role: 'none' | 'outside' | 'bench' | 'starter'
  subRole?: '代打' | '代走' | '守備固め'
  number?: number // 背番号
  captain?: 'captain' | 'vice'
  teamSize: number
  /** team strength on the z scale (players of the same grade) */
  teamStrength: number
  menu: Menu
  /** growth of z earned this year by practice choices (applied at the year's end) */
  gain: number
  /** what the player wants after high school (from the career talk) */
  goal?: 'pro' | 'univ' | 'work' | 'quit'
  /** game records (model values, the player's own in-game record) */
  rec?: Records
  /** the team did well in last autumn's tournament (a 選抜 invitation is possible) */
  fallGood?: boolean
  /**
   * scouts' attention 0–100 (model value, PROJECT_PLAN §11.8): from the calibrated chance of the
   * 志望届 / draft check ahead and the season's record; 60 or more only once that check has brought scouts
   */
  scout?: number
  /** seasons lost to an injury so far, and whether the player is in one now (counted at each year's end) */
  injuries?: number
  hurt?: boolean
}

/** batting and pitching totals (model values) */
export interface StatLine {
  games: number
  pa: number
  ab: number
  h: number
  hr: number
  rbi: number
  sb: number
  /** outs recorded as a pitcher (3 = 1 inning) */
  outs: number
  k: number
  er: number
  w: number
  l: number
}

/**
 * 'farm' = プロの2軍 (育成 and 支配下 players outside the first team), 'pro' = 1軍; 'mlb' = a Japanese player's MLB games (phase
 * 'abroad', careerSeason.ts mlbSeason), kept apart from his NPB 1軍 (a US life's majors are its 'pro')
 */
export type Level = 'jhs' | 'hs' | 'univ' | 'amateur' | 'farm' | 'pro' | 'mlb'

export interface Records {
  /** totals by level, official games and practice games kept apart */
  official: Partial<Record<Level, StatLine>>
  practice: Partial<Record<Level, StatLine>>
  /** each tournament, league or pro season played: what happened (model); level is absent in older saves (= 'hs') */
  tournaments: { age: number; name: string; result: string; line: StatLine; level?: Level; team?: string }[]
  /** milestones already written (e.g. 'hs.hr.10') */
  marks: string[]
}

export interface LifeStatus {
  health: number
  happiness: number
  relations: number
  knowledge: number
}

export interface LifeState {
  v: 1
  config: LifeConfig
  person: Person
  age: number
  year: number
  alive: boolean
  causeOfDeath?: string
  z: number
  status: LifeStatus
  focus: Focus
  career: CareerState
  family: FamilyState
  money: number // 万円, savings
  /** how widely he is known, 0–100 (careers.ts fameOf: absent = from the baseball career; events change it with Effect.fame) */
  fame?: number
  /** the licence his university leads to (license.ts): passed when ok is set, the national exam taken tries times */
  license?: { kind: LicenseKind; ok?: number; tries?: number }
  income: number // 万円, this year
  lifetimeIncome: number // 万円
  job: string
  log: LogEntry[]
  /** per-age summary used by the life map / survival curve */
  timeline: { age: number; rank: number; phase: Phase; happiness: number }[]
  /** decision ids already taken (to avoid repeats) */
  taken: string[]
  /** decisions answered with "おまかせ" from now on */
  autoDecide: boolean
  memos: { age: number; text: string }[]
  happiestAge: number
  happiestValue: number
  /** catalog events so far: id → [age last seen, times seen] (optional for older saves) */
  evHist?: Record<string, [number, number]>
  /** the money screen's standing settings (shop.ts): where the spare money is kept, and the kinds of spending that repeat by themselves; absent until set */
  shop?: {
    vehicle: 'deposit' | 'bond' | 'balanced' | 'index' | 'world'
    auto: string[]
    /** 保険 and 食生活 (shop.ts): absent until chosen; with `insurance` set, a yearly medical bill may come (covered by the plan) */
    insurance?: 'none' | 'basic' | 'full'
    diet?: 'free' | 'balanced' | 'strict'
    /** savings at the start of each year the screen has been in use, for the trend chart: [age, 万円] */
    hist?: [number, number][]
  }
  /** how well he speaks each language, 0..100 (language.ts); absent in a life made before it, then read as only his native one */
  languages?: Record<string, number>
  /**
   * the country he lives in now, stored only while it is not the country of his birth (`setResidence`, countries/index.ts): set when the
   * model moves him (a Japanese signing with an MLB club), cleared when he comes back. Absent in a life that never leaves its country.
   */
  residence?: CountryCode
  /**
   * where he lives now in his birth country (an index into its table of places, as `person.prefecture`, which stays the place of birth),
   * −1 when he moved to a place the model does not know; absent while he has not moved (place.ts). Shown only.
   */
  place?: number
  /** facts set by declarative events (src/engine/events/spec.ts): flag → age when set (optional for older saves) */
  flags?: Record<string, number>
  /** follow-up events booked by earlier outcomes: run at `age` or later, dropped after `until` */
  due?: DueEvent[]
  /** baseball details from the first season on (optional for older saves) */
  bb?: BaseballState
  /** life outside baseball, from the end of school or of the playing career (optional for older saves) */
  after?: AfterState
  /** real schools the player entered (PROJECT_PLAN §11.11; optional for older saves) */
  schools?: { hs?: SchoolPick; univ?: SchoolPick }
  /** the potential mode's hidden talent and growth (src/engine/potential.ts); absent in the normal mode */
  pot?: PotentialState
}

/** a real school (a name from the national list) the player entered, and how he got in */
export interface SchoolPick {
  id: string
  name: string
  /** 学部・学科 (university: the department of the 偏差値 row used, when there is one) */
  course?: string
  method: 'general' | 'recommend' | 'sports'
  /** the first choice failed and the player entered a fallback school */
  fellBack?: boolean
  /** university only: what he does with baseball there */
  club?: 'club' | 'circle' | 'none' | 'returned'
  /** the team's internal strength on the model's scale (never shown as a number) and how it is known */
  rating?: number
  ratingBasis?: 'verified' | 'secondary' | 'estimated'
  /** university only: the league (and division) when the sources say */
  league?: string
  /** facts about the team (「甲子園 夏3回」「全国大会 優勝1」) */
  note?: string
}

export interface DueEvent {
  id: string
  age: number
  until: number
  /** the event that booked it (for tests and metrics) */
  from: string
}

export interface Choice {
  label: string
  hint?: string
}

export interface Decision {
  id: string
  /** 'major' = 決断, 'minor' = 選択, 'breath' = 節目のふりかえり */
  weight: 'major' | 'minor' | 'breath'
  title: string
  body: string
  /** statistic shown in the fact box */
  factText?: string
  factStatIds?: string[]
  choices: Choice[]
  /** index chosen by おまかせ */
  autoIndex: number
  /** breath only: question for the memo */
  question?: string
  /** an important decision (one with the end of baseball among its choices): never answered by おまかせ or skipped by fast-forward */
  stop?: boolean
}

export interface TimedEntry {
  at: number // position in the year, 0..1
  entry: LogEntry
}

export interface YearPlan {
  events: TimedEntry[]
  decision?: { at: number; decision: Decision }
}

export type GrowthPattern = 'early' | 'steady' | 'late' | 'spurt' | 'plateau'

/**
 * The potential mode (PROJECT_PLAN §11.20): what the player starts with, what he could become, how fast and when he
 * grows, and how much of it he has realised. `z`, the calibrated overall ability that every stage check reads, is
 * computed from these each year; in the normal mode none of this exists.
 */
export interface PotentialState {
  /** the ★ chosen at the start (1..10); ★1 is the baseline model */
  stars?: number
  /** how much the ★ raised the talent (g units; 0 for ★1) */
  starShift?: number
  /** how much of the talent the scouts can see: 1 = all, lower = part of it is not noticed (fades as he is seen more) */
  exposure?: number
  /** the ability he starts with (z at birth, on the potential mode's scale) */
  base: number
  /** the talent: what full development adds (z units); the ceiling is base + g − (the usual development) */
  g: number
  /** growth speed: how fast he moves along his pattern when everything is as usual */
  rate: number
  pattern: GrowthPattern
  /** the age of the growth spurt (pattern 'spurt') */
  spurtAge: number
  /** development achieved, 0..1 (1 = all of the talent has come out) */
  dev: number
  /** 'plateau' players stall at about two thirds until something breaks the stall */
  unlocked: boolean
  /** aptitudes beside baseball: study and judgement, dealing with people (standard units) */
  mind: number
  soc: number
  /** how much of each is known to the player (0..1); the rest is shown as a range */
  known: { ath: number; mind: number; soc: number }
  /** how far the scouts over- (+) or under- (−) estimate his talent (g units) */
  scoutBias: number
  /** how well he suits the present coach (a draw at each change of stage) */
  coachFit: number
  phaseSeen: string
  /** the lasting effect of choices on how well he is developed (added to the yearly quality) */
  nurture: number
  /** short-term form (AR) and lasting bumps from decisions, added to z */
  noise: number
  bonus: number
  zLast: number
  /** talent lost to injuries and over-training (g units), for the retrospective */
  lost: number
  /** one row per year of development, for the retrospective */
  hist: { age: number; q: number; dev: number; z: number; why: string }[]
  peakZ: number
}
/** a squad announcement as it was when announced (a year has two: the panel must not show the later one early) */
export interface Roster {
  role: 'starter' | 'bench' | 'outside'
  number?: number
}

/** a licence that a university's course leads to (license.ts) */
export type LicenseKind = 'doctor' | 'dentist' | 'pharmacist' | 'nurse' | 'teacher'
