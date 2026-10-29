import type { BaseballClubRow, DeviationRow, EntryMethodRow, GenderStatus, School, SchoolKind } from './types.ts'
import { BASEBALL_CLUBS } from './baseball.ts'
import { DEVIATIONS } from './deviation.ts'
import { ENTRY_METHODS } from './entry.ts'
import { JHBF_CLUBS_2026 } from './jhbfClubs.ts'
import { CHAMPIONS, DIVISIONS, LEAGUE_SOURCES, MEMBER_ALIAS, UNIV_LEAGUES } from './leagues.ts'

// The school tables (PROJECT_PLAN §11.11). The list itself is 文部科学省「学校コード」, imported by
// scripts/ingest-mext.ts; gender (from the name), baseball club, entry methods and 偏差値 are separate
// tables that start empty and grow only with rows that have a source, a check date and a year.

// the national list is the largest data of the game (about 650 kB of JSON): a separate chunk, loaded
// together with the first use (top-level await keeps every importer synchronous afterwards)
const raw = (await import('./mext.json', { with: { type: 'json' } })).default
// the 甲子園 appearances of the schools (about 40 kB): the same way
const koshienRaw = (await import('./koshien-schools.json', { with: { type: 'json' } })).default

export const SCHOOL_LIST_META = raw.meta as { source: string; files: string[]; listDate: string; accessed: string; sha256: string; note: string }

const OWNER = ['national', 'national', 'public', 'private'] as const
type Raw = { c: string; n: string; p: string; m: string; o: number; b: number }
const make = (kind: SchoolKind, rows: Raw[]): School[] => rows.map((r) => ({ id: r.c, kind, name: r.n, pref: r.p, muni: r.m, owner: OWNER[r.o] ?? 'private', branch: r.b === 1 ? 'main' : 'branch' }))

export const HIGH_SCHOOLS: School[] = make('hs', raw.hs)
export const UNIVERSITIES: School[] = make('univ', raw.univ)
export const JUNIOR_COLLEGES: School[] = make('jc', raw.jc)
export const KOSEN: School[] = make('kosen', raw.kosen)
export const ALL_SCHOOLS: School[] = [...HIGH_SCHOOLS, ...UNIVERSITIES, ...JUNIOR_COLLEGES, ...KOSEN]

const BY_ID = new Map(ALL_SCHOOLS.map((s) => [s.id, s]))
export const schoolById = (id: string): School | undefined => BY_ID.get(id)

/** 女子・男子 by name only; everything else is 'unconfirmed' (not confirmed as coeducational) */
export function genderOf(s: School): GenderStatus {
  if (/女子|女学院|女学園|女学校|女子大|女学館/.test(s.name)) return 'girls'
  if (/男子/.test(s.name)) return 'boys'
  return 'unconfirmed'
}

/** a male player can be placed at this school (not a girls' school by name; a boys' school is allowed) */
export const admitsMale = (s: School): boolean => genderOf(s) !== 'girls'

/**
 * A university that is a member of one of the 27 leagues of 全日本大学野球連盟 (from the federation's own pages).
 * `division` is 0 when the league's divisions are not known (only the 東都 and 首都 leagues' are).
 */
export interface LeagueSeat {
  league: string
  division: number
}
const seatOf = new Map<string, LeagueSeat>()
const leagueClubs: BaseballClubRow[] = []
const divisionOf = new Map<string, number>()
for (const d of DIVISIONS) for (const n of d.names) divisionOf.set(d.league + '|' + n, d.division)
const mainUniv = new Map<string, School>()
for (const u of UNIVERSITIES) if (u.branch === 'main') mainUniv.set(u.name, u)
/** member names that are not a university of their own in the national list (a campus, a faculty, a 高専 or 短大) */
export const UNMAPPED_LEAGUE_MEMBERS: { league: string; name: string }[] = []
for (const l of UNIV_LEAGUES) {
  for (const raw of l.members) {
    const name = MEMBER_ALIAS[raw] ?? raw
    const u = mainUniv.get(name)
    if (!u || seatOf.has(u.id)) {
      UNMAPPED_LEAGUE_MEMBERS.push({ league: l.id, name: raw })
      continue
    }
    seatOf.set(u.id, { league: l.id, division: divisionOf.get(l.id + '|' + name) ?? 0 })
    leagueClubs.push({ schoolId: u.id, status: 'hard', year: 2026, sourceId: LEAGUE_SOURCES.leagues, accessed: LEAGUE_SOURCES.accessed })
  }
}
/** ids of the universities whose league is known */
export const LEAGUE_SCHOOL_IDS: string[] = [...seatOf.keys()]
/** the league and division of a university, when it is a member of a league */
export const leagueSeatOf = (id: string): LeagueSeat | undefined => seatOf.get(id)
/** division names that did not match a member of that league (the secondary page against the federation's): should be none */
export const UNMATCHED_DIVISION_MEMBERS: string[] = DIVISIONS.flatMap((d) => d.names.filter((n) => seatOf.get(mainUniv.get(n)?.id ?? '')?.league !== d.league))

/** how many times a university of each league reached the final of the national championship, 2005–2026 (an official fact) */
export const FINALS_BY_LEAGUE: Record<string, number> = {}
/** universities that reached a final, with the count */
export const FINALS_BY_SCHOOL = new Map<string, { won: number; second: number }>()
export const UNMATCHED_FINALISTS: string[] = []
for (const c of CHAMPIONS) {
  for (const [name, key] of [[c.champion, 'won'], [c.runnerUp, 'second']] as const) {
    const u = mainUniv.get(name)
    if (!u) {
      UNMATCHED_FINALISTS.push(name)
      continue
    }
    const r = FINALS_BY_SCHOOL.get(u.id) ?? FINALS_BY_SCHOOL.set(u.id, { won: 0, second: 0 }).get(u.id)!
    r[key]++
    const lg = seatOf.get(u.id)?.league
    if (lg) FINALS_BY_LEAGUE[lg] = (FINALS_BY_LEAGUE[lg] ?? 0) + 1
    else UNMATCHED_FINALISTS.push(name + '（連盟なし）')
  }
}

/** appearances of a high school at the 甲子園 (日本高野連の出場校一覧, 2004–2026) */
export interface KoshienRecord {
  summer: number[]
  spring: number[]
  summerNth?: number
  springNth?: number
  /** summer Koshien games won and lost since 2004, and prefectural titles and runner-up places 2011–2025 (Wikipedia, secondary) */
  kw?: number
  kl?: number
  pfWon?: number
  pfSecond?: number
}
const koshien = koshienRaw as { meta: { accessed: string; rowsTotal: number; rowsMatched: number; schools: number; unmatchedDistinct: number; unmatchedRows: number; wiki: { accessed: string; koshNames: number; koshMatched: number; finalsNames: number; finalsMatched: number; finalsChampionsChecked: number; finalsChampionsAgree: number } }; schools: Record<string, KoshienRecord>; unmatched: Record<string, number> }
export const KOSHIEN_META = koshien.meta
export const KOSHIEN_UNMATCHED = koshien.unmatched
export const koshienOf = (id: string): KoshienRecord | undefined => koshien.schools[id]
export const KOSHIEN_SCHOOL_COUNT = Object.keys(koshien.schools).length

/** club rows typed by hand plus those read from the league member lists */
export const ALL_BASEBALL_CLUBS: BaseballClubRow[] = [...BASEBALL_CLUBS, ...leagueClubs]
const clubOf = new Map<string, BaseballClubRow>(ALL_BASEBALL_CLUBS.map((r) => [r.schoolId, r]))
export const baseballClubOf = (id: string): BaseballClubRow | undefined => clubOf.get(id)

const devBySchool = new Map<string, DeviationRow[]>()
for (const d of DEVIATIONS) (devBySchool.get(d.schoolId) ?? devBySchool.set(d.schoolId, []).get(d.schoolId)!).push(d)
export const deviationsOf = (id: string): DeviationRow[] => devBySchool.get(id) ?? []
export const entryMethodsOf = (id: string): EntryMethodRow[] => ENTRY_METHODS.filter((m) => m.schoolId === id)

/** schools a male player can pick, by kind and prefecture */
export function candidates(kind: SchoolKind, pref?: string): School[] {
  return ALL_SCHOOLS.filter((s) => s.kind === kind && (!pref || s.pref === pref) && s.branch === 'main' && admitsMale(s))
}

export interface Coverage {
  kind: SchoolKind
  total: number
  main: number
  girlsByName: number
  unconfirmedGender: number
  /** schools with a baseball-club row, and by status */
  clubKnown: number
  clubHard: number
  clubNone: number
  /** schools with at least one 偏差値 row / entry-method row */
  withDeviation: number
  withEntry: number
}

export function coverage(kind: SchoolKind): Coverage {
  const list = ALL_SCHOOLS.filter((s) => s.kind === kind)
  const ids = new Set(list.map((s) => s.id))
  const clubs = ALL_BASEBALL_CLUBS.filter((r) => ids.has(r.schoolId))
  return {
    kind,
    total: list.length,
    main: list.filter((s) => s.branch === 'main').length,
    girlsByName: list.filter((s) => genderOf(s) === 'girls').length,
    unconfirmedGender: list.filter((s) => genderOf(s) === 'unconfirmed').length,
    clubKnown: clubs.length,
    clubHard: clubs.filter((r) => r.status === 'hard').length,
    clubNone: clubs.filter((r) => r.status === 'none').length,
    withDeviation: new Set(DEVIATIONS.filter((d) => ids.has(d.schoolId)).map((d) => d.schoolId)).size,
    withEntry: new Set(ENTRY_METHODS.filter((m) => ids.has(m.schoolId)).map((m) => m.schoolId)).size,
  }
}

/** high schools with a hard-ball club confirmed, against the federation's count, by prefecture */
export function clubCoverageByPref(): { pref: string; official: number; known: number }[] {
  return Object.entries(JHBF_CLUBS_2026).map(([pref, official]) => ({
    pref,
    official,
    known: ALL_BASEBALL_CLUBS.filter((r) => r.status === 'hard' && schoolById(r.schoolId)?.pref === pref && schoolById(r.schoolId)?.kind === 'hs').length,
  }))
}
