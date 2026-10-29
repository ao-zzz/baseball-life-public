import type { LifeState } from '../types.ts'
import type { Rng } from '../rng.ts'
import { hashSeed, makeRng } from '../rng.ts'
import { clamp, normCdf } from '../math.ts'
import { hasFlag } from '../events/spec.ts'
import { PREFECTURES } from '../../data/jp.ts'
import { homePrefecture } from '../place.ts'
import { ALL_SCHOOLS, LEAGUE_SCHOOL_IDS, admitsMale, deviationsOf, koshienOf, schoolById } from '../../data/schools/index.ts'
import { US_COLLEGES, type UsCollege } from '../../data/usColleges.ts'
import type { DeviationRow, School } from '../../data/schools/types.ts'
import { NO_HS_INTAKE_IDS } from '../../data/schools/noHsIntake.ts'
import { BASIS_LABEL, UNIV_MEAN, admitP, evaluate, hsRating, inviteP, levelWord, univRating, usRating, type Basis, type Evaluation, type TeamRating } from './rating.ts'

// Entering real schools (PROJECT_PLAN §11.11). Names come from the national list (文部科学省); everything
// about getting in is a game assumption (stat schoolModel):
// - a school's difficulty is its published 偏差値 when there is one (universities: 河合塾 2027年度入試の
//   ボーダー予想, by department); a school without one gets a difficulty drawn per life, never shown as a value;
// - 一般入試: the player's academic level (from 知識) against the school's difficulty;
// - 学校推薦: 知識 and standing, not the difficulty;
// - スポーツ推薦: baseball ability and record (an offer at the calibrated 進路 check), never the difficulty.
// Every non-girls school is taken to have a baseball club (assumption, not a confirmed fact).

export const SCHOOL_NOTE =
  '学校名は実在の学校名を割り当てたものです。野球部の有無や強さ、偏差値が未収録の学校の入試の難しさ、合格や推薦の確率は、ゲーム上の仮定です（確認した事実ではありません）。'

export type Method = 'general' | 'recommend' | 'sports'
export const METHOD_LABEL: Record<Method, string> = { general: '一般入試', recommend: '学校推薦', sports: 'スポーツ推薦' }

export interface Option {
  id: string
  name: string
  method: Method
  /** chance of getting in (game assumption) */
  p: number
  /** difficulty used: the published 偏差値, or an assumed one (`published` false) */
  dev: number
  published: boolean
  floor?: boolean
  /** source of the published value (a SOURCES id) */
  src?: string
  /** the school he enters if the first choice fails */
  safe?: boolean
  muni: string
  owner: School['owner']
  /** the team's internal strength (never shown as a number), how it is known, and its league when it is */
  rating?: number
  basis?: Basis
  league?: string
  /** words for the team's level (the number is not shown) */
  level?: string
  /** facts about the team shown beside it (「甲子園 夏3回・春1回」) */
  note?: string
  /** a team that invited him (a sports recommendation): an invitation is not a place, `p` is the chance to get in */
  invited?: boolean
  /** how hard it is for him, from the chance of getting in (see `tierOf`) */
  tier?: Tier
}

/** the player's academic level on the 偏差値 scale: 知識 has sd about 15, 偏差値 has sd 10 (assumption) */
export function studentDev(s: LifeState): number {
  return 50 + ((s.status.knowledge - 50) * 2) / 3
}

export function generalP(s: LifeState, dev: number): number {
  // a year of studying beside the practice (x.hs.entrance) is worth a little at the door of a university
  const studied = hasFlag(s, 'exam.study') ? 2 : 0
  return clamp(normCdf((studentDev(s) + studied - dev) / 5), 0.02, 0.98)
}

export function recommendP(s: LifeState, dev: number): number {
  const captain = s.career.achievements.includes('主将') ? 0.08 : 0
  // a raised 評定 (the choice 「評定を上げて推薦をねらう」) helps a recommendation
  const hyoutei = hasFlag(s, 'hs.hyoutei') ? 0.12 : 0
  const p = 0.25 + 0.012 * (s.status.knowledge - 45) + 0.001 * (s.status.relations - 50) + captain + hyoutei
  return clamp(dev > studentDev(s) + 12 ? p * 0.4 : p, 0.05, 0.8)
}

/** スポーツ推薦: baseball ability, record and the scouts' attention (not the school's difficulty) */
export function sportsP(s: LifeState): number {
  const a = s.career.achievements
  const koshien = a.includes('甲子園') ? 0.7 : 0
  const captain = a.includes('主将') ? 0.2 : 0
  const scout = ((s.bb?.scout ?? 0) - 30) / 60
  // listening to a scout (the choice in x.hs.scoutTalk) makes a recommendation likelier
  const talked = hasFlag(s, 'hs.scoutTalk') ? 0.15 : 0
  // body and skills for the position, what he can still grow and his injuries count beside the ability (§11.14)
  const ev = evaluate(s)
  return clamp(normCdf(0.9 * (s.z + 0.6 * ev.fit + ev.growth + ev.health + ev.perf) + koshien + captain + scout + talked - 0.4), 0.03, 0.95)
}

/** words for a chance (never a number: the chance is a game assumption) */
export function prospect(p: number): string {
  return p >= 0.8 ? '見込みは高め' : p >= 0.45 ? '五分五分' : p >= 0.2 ? 'やや厳しい' : '厳しい'
}

function idNum(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return h >>> 0
}

/** a difficulty for a school without a published 偏差値: drawn per life and school (game assumption) */
export function assumedDev(seed: number, school: School): number {
  const r = makeRng(hashSeed(seed ^ idNum(school.id)))
  const base = school.kind === 'univ' ? { national: 56, public: 50, private: 45 } : { national: 62, public: 50, private: 46 }
  return clamp(base[school.owner] + r.normal() * (school.kind === 'univ' ? 6 : 7), 33, 75)
}

// ---------------------------------------------------------------- pools

const NOT_FULL_TIME = /通信|定時制|サポート|技能連携|専攻科/
const hsByPref = new Map<string, School[]>()
const univByRegion = new Map<string, School[]>()
let univAll: School[] | undefined

function hsPool(pref: string): School[] {
  let list = hsByPref.get(pref)
  if (!list) {
    // (a school with no high-school-stage intake is never a choice at 15: data/schools/noHsIntake.ts)
    list = ALL_SCHOOLS.filter((x) => x.kind === 'hs' && x.pref === pref && x.branch === 'main' && admitsMale(x) && !NOT_FULL_TIME.test(x.name) && !NO_HS_INTAKE_IDS.has(x.id))
    hsByPref.set(pref, list)
  }
  return list
}

function univPool(region: string): School[] {
  univAll ??= ALL_SCHOOLS.filter((x) => x.kind === 'univ' && x.branch === 'main' && admitsMale(x) && !/通信|大学院大学|専門職/.test(x.name))
  if (region === '*') return univAll
  let list = univByRegion.get(region)
  if (!list) {
    const regionOfPref = (pref: string) => PREFECTURES.find((p) => p.name === pref)?.region ?? ''
    list = univAll.filter((u) => regionOfPref(u.pref) === region)
    univByRegion.set(region, list)
  }
  return list
}

/** universities with a baseball club we know of: the members of the 27 leagues (the federation's own pages) */
const clubUnivByRegion = new Map<string, School[]>()
function clubUnivPool(region: string): School[] {
  let list = clubUnivByRegion.get(region)
  if (!list) {
    const regionOfPref = (pref: string) => PREFECTURES.find((p) => p.name === pref)?.region ?? ''
    list = LEAGUE_SCHOOL_IDS.map((id) => schoolById(id)!).filter((u) => admitsMale(u) && (region === '*' || regionOfPref(u.pref) === region))
    clubUnivByRegion.set(region, list)
  }
  return list
}

// (the schools of the place he lives in: the place of birth, unless the family has moved: place.ts)
export const prefOf = (s: LifeState) => PREFECTURES[homePrefecture(s)]?.name ?? ''
const regionOf = (s: LifeState) => PREFECTURES[homePrefecture(s)]?.region ?? ''

function sample<T>(list: T[], n: number, r: Rng): T[] {
  const a = [...list]
  const out: T[] = []
  while (out.length < n && a.length) out.push(a.splice(r.int(0, a.length - 1), 1)[0])
  return out
}

interface Cand {
  school: School
  row?: DeviationRow
  dev: number
  published: boolean
}

/** the school's published representative 偏差値 (one per school), or an assumed difficulty kept apart */
function candidate(seed: number, school: School): Cand {
  const row = deviationsOf(school.id)[0]
  if (row) return { school, row, dev: row.value, published: true }
  return { school, dev: assumedDev(seed, school), published: false }
}

const toOption = (c: Cand, method: Method, p: number): Option => ({
  id: c.school.id,
  name: c.school.name,
  method,
  p,
  dev: c.dev,
  published: c.published,
  floor: c.row?.floor,
  src: c.row?.sourceId,
  muni: c.school.muni,
  owner: c.school.owner,
})

/** the average strength of a high school that takes players on a recommendation (careerSeason hsStrong) */
const HS_STRONG_MEAN = 0.9

function withRating(o: Option, rt: TeamRating, invited = false): Option {
  const mean = schoolById(o.id)?.kind === 'hs' ? HS_STRONG_MEAN : UNIV_MEAN
  return { ...o, rating: rt.value, basis: rt.basis, level: levelWord(rt.value - mean), ...(rt.league ? { league: rt.league } : {}), ...(rt.note ? { note: rt.note } : {}), ...(invited ? { invited: true } : {}) }
}

// ---------------------------------------------------------------- tiers (PROJECT_PLAN §11.19)

export type Tier = 'reach' | 'match' | 'safe'
export const TIER_LABEL: Record<Tier, string> = { reach: '挑戦校', match: '実力相応校', safe: '安全校' }
const TIER_ORDER: Tier[] = ['reach', 'match', 'safe']

/** 挑戦校 (a chance under 4 in 10), 実力相応校, 安全校 (a chance of 85% or more): from the chance, not from the school */
export function tierOf(p: number): Tier {
  return p >= 0.85 ? 'safe' : p >= 0.4 ? 'match' : 'reach'
}

/**
 * Windows of 偏差値 around the student's own level, from which the candidates of a 一般入試 (and of a 学校推薦) are
 * drawn: a 挑戦校 is 2 to 7 above him (a chance of about 1 in 3 down to 1 in 15), a 実力相応校 from 4 below to 1 above,
 * a 安全校 5.5 to 14 below (a chance of 85% or more). A school far from his level is never named to fill the list (game assumption).
 */
const WINDOW = { reach: [2, 7], reach2: [4, 9], match: [-4, 1], safe: [-14, -5.5], rec: [-2, 5] } as const
type WindowName = keyof typeof WINDOW

interface Slot {
  w: WindowName
  method: Method
  owner?: School['owner']
}

/** one candidate from the window that is not taken, preferring the owner type when there is one of it */
function pickWindow(cands: Cand[], sd: number, slot: Slot, used: Set<string>, r: Rng): Cand | undefined {
  const [lo, hi] = WINDOW[slot.w]
  const inside = cands.filter((c) => !used.has(c.school.id) && c.dev - sd >= lo && c.dev - sd <= hi)
  if (!inside.length) return undefined
  const preferred = slot.owner ? inside.filter((c) => c.school.owner === slot.owner) : []
  const c = r.pick(preferred.length ? preferred : inside)
  used.add(c.school.id)
  return c
}

interface PoolIndex {
  pub: Cand[]
  unp: School[]
}
const poolIndex = new WeakMap<School[], PoolIndex>()

/** the schools of a pool with a published 偏差値 (fixed) and those without (a difficulty drawn per life) */
function indexOf(pool: School[]): PoolIndex {
  let ix = poolIndex.get(pool)
  if (!ix) {
    const pub: Cand[] = []
    const unp: School[] = []
    for (const school of pool) {
      const row = deviationsOf(school.id)[0]
      if (row) pub.push({ school, row, dev: row.value, published: true })
      else unp.push(school)
    }
    ix = { pub, unp }
    poolIndex.set(pool, ix)
  }
  return ix
}

/**
 * The schools within 16 of his level: every school of the pool with a published 偏差値 there, and some of the
 * others with their drawn difficulty. (Drawing a few schools at random, as before, could leave only schools far from
 * him, and the nearest of them was named anyway.)
 */
function candidatesFor(pools: School[][], sd: number, seed: number, r: Rng, unpublished = 40): Cand[] {
  const seen = new Set<string>()
  const out: Cand[] = []
  const add = (c: Cand) => {
    if (!seen.has(c.school.id) && Math.abs(c.dev - sd) <= 16) {
      seen.add(c.school.id)
      out.push(c)
    }
  }
  for (const pool of pools) {
    const ix = indexOf(pool)
    ix.pub.forEach(add)
    sample(ix.unp, unpublished, r).forEach((x) => add(candidate(seed, x)))
  }
  // a student above (or below) every school of the pool: the schools nearest to him, so that the list is not empty
  if (out.length < 4) {
    const rest = pools.flatMap((pool) => indexOf(pool).pub).filter((c) => !seen.has(c.school.id)).sort((a, b) => Math.abs(a.dev - sd) - Math.abs(b.dev - sd))
    out.push(...rest.slice(0, 6 - out.length))
  }
  return out
}

/**
 * The general-examination (and recommendation) candidates of a student: some 挑戦校, some 実力相応校 and a 安全校,
 * four or five in all, each drawn from a window of 偏差値 around his own level; a missing window is left out. At least three
 * are named (four for a student of 65 or more: few schools are published at the top of the scale, and the windows above
 * him are empty): when the windows give fewer, the schools nearest to his level (within 15) fill in. The list runs from the
 * hardest to the easiest, and the safe one (the likeliest) is where a failed first choice falls back.
 */
function tieredOptions(s: LifeState, cands: Cand[], slots: Slot[], r: Rng, build: (c: Cand, method: Method, p: number) => Option): Option[] {
  const sd = studentDev(s)
  const used = new Set<string>()
  const pOf = (c: Cand, m: Method) => (m === 'recommend' ? recommendP(s, c.dev) : generalP(s, c.dev))
  const out: Option[] = []
  for (const slot of slots) {
    const c = pickWindow(cands, sd, slot, used, r)
    if (c) out.push(build(c, slot.method, pOf(c, slot.method)))
  }
  const near = [...cands].sort((a, b) => Math.abs(a.dev - sd) - Math.abs(b.dev - sd))
  const least = sd >= 65 ? 4 : 3
  for (const c of near) {
    if (out.length >= least) break
    if (used.has(c.school.id)) continue
    used.add(c.school.id)
    out.push(build(c, 'general', generalP(s, c.dev)))
  }
  // a student who is below every school still gets the likeliest one (the easiest drawn), not only the near misses
  if (cands.length && !out.some((o) => o.p >= 0.4)) {
    const easy = [...cands].filter((c) => !used.has(c.school.id)).sort((a, b) => a.dev - b.dev)[0]
    if (easy) {
      used.add(easy.school.id)
      out.push(build(easy, 'general', generalP(s, easy.dev)))
    }
  }
  if (out.length === 0 && cands.length) {
    const c = [...cands].sort((a, b) => Math.abs(a.dev - sd) - Math.abs(b.dev - sd))[0]
    out.push(build(c, 'general', generalP(s, c.dev)))
  }
  return ordered(out)
}

/** hardest first (by tier, then by 偏差値); each named with its tier; the likeliest is the safe one */
function ordered(list: Option[]): Option[] {
  const out = list.map((o) => ({ ...o, tier: tierOf(o.p) })).sort((a, b) => TIER_ORDER.indexOf(a.tier!) - TIER_ORDER.indexOf(b.tier!) || b.dev - a.dev)
  if (out.length) {
    const safest = out.reduce((a, b) => (b.p > a.p ? b : a))
    safest.safe = true
  }
  return out
}
// ---------------------------------------------------------------- shortlists

/**
 * High schools to choose from. 'strong': a recommendation (スポーツ推薦) from private schools, because the
 * calibrated check gave an offer; 'public' / 'quit': a public school by 一般入試 (one out of reach, one
 * within reach), a private school by 学校推薦 and a private school as the safe one.
 */
export function hsShortlist(s: LifeState, kind: 'strong' | 'public' | 'quit', r: Rng): Option[] {
  const pool = hsPool(prefOf(s))
  const pub = pool.filter((x) => x.owner === 'public')
  const pri = pool.filter((x) => x.owner === 'private')
  if (kind === 'strong') {
    const used = new Set<string>()
    const out: Option[] = []
    // スポーツ推薦: the schools that invited him are picked by baseball level around his own team's strength
    // (never by 偏差値); getting in is his evaluation against the school's level, so an invitation is not a place.
    // The last, lowest school is the safe one.
    const ev = evaluate(s, { beforeHs: true })
    // (§11.51) the level of the list is his own: the team he played in (T, a draw of the junior team) and the scouts' view of him
    // (ev.total: ability, body, what he can still grow, the potential mode's talent). A strong player of a weak junior team is no
    // longer given a list of weak schools. The shortlist is drawn on the event stream and the school is only a name (the high
    // school team's strength is the calibrated draw made on joining), so no calibrated check moves; whether an offer comes at all
    // is decided before (jp.hs) and is not changed here.
    const T = s.bb?.teamStrength ?? 0.9
    const L = Math.max(T, 0.4 * T + 0.6 * ev.total - 0.15)
    // (the schools with a 甲子園 record are few: some are always among the candidates, with the others drawn; for a player of a high
    // level the three strongest of them are always candidates, so a strong player is never left without a powerhouse to choose)
    const base = pri.length ? pri : pool
    const withRecord = base.filter((x) => koshienOf(x.id))
    const others = base.filter((x) => !koshienOf(x.id))
    const top = L >= 1.2 ? [...withRecord].sort((a, b) => hsRating(b).value - hsRating(a).value).slice(0, 3) : []
    const picked = [...new Map([...top, ...sample(withRecord, 10, r), ...sample(others, 8, r), ...awayInvites(s, ev, L)].map((x) => [x.id, x])).values()]
    const rated = picked.map((x) => ({ c: candidate(s.config.seed, x), rt: hsRating(x) }))
    for (const target of [L + 0.3, L, L - 0.45]) {
      const free = rated.filter((x) => !used.has(x.c.school.id))
      if (!free.length) break
      const x = free.reduce((a, b) => (Math.abs(b.rt.value - target) < Math.abs(a.rt.value - target) ? b : a))
      used.add(x.c.school.id)
      out.push(withRating(toOption(x.c, 'sports', admitP(ev, x.rt, 'sports')), x.rt, true))
    }
    if (out.length) {
      const last = out[out.length - 1]
      last.p = Math.max(0.9, last.p)
      last.safe = true
    }
    return out
  }
  // a player's team strength in high school is the calibrated draw: a public school is named whose strength is near it
  // (a school with a long 甲子園 record is not named for a team that is weak in this life)
  const T = s.bb?.teamStrength
  const near = kind === 'public' && T !== undefined ? pub.filter((x) => Math.abs(hsRating(x).value - T) <= 0.7) : pub
  const sdNow = studentDev(s)
  const cands = candidatesFor([near.length >= 4 ? near : pub, pri], sdNow, s.config.seed, r, 30)
  const build = (c: Cand, method: Method, p: number) => {
    const o = toOption(c, method, p)
    return kind === 'public' && c.school.owner === 'public' ? withRating(o, hsRating(c.school)) : o
  }
  // 一般入試 only (a high school has no school recommendation at this age; the sports recommendation is the other list):
  // a 挑戦校 (public), two 実力相応校 (a public and a private school), a 安全校 and a fifth that depends on his level. The 安全校
  // (where a failed exam falls back) is a public one for a player who chose the local public school, a private one otherwise.
  const slots: Slot[] = [
    { w: 'reach', method: 'general', owner: 'public' },
    { w: 'match', method: 'general', owner: 'public' },
    { w: 'match', method: 'general', owner: 'private' },
    { w: 'safe', method: 'general', owner: kind === 'public' ? 'public' : 'private' },
    studentDev(s) >= 50 ? { w: 'reach2', method: 'general', owner: 'private' } : { w: 'safe', method: 'general', owner: kind === 'public' ? 'private' : 'public' },
  ]
  const out = tieredOptions(s, cands, slots, r, build)
  // a small prefecture may lack a kind of school: fall back on whatever the pool has
  if (out.length === 0) return ordered(sample(pool, 3, r).map((x) => toOption(candidate(s.config.seed, x), 'general', generalP(s, assumedDev(s.config.seed, x)))))
  return out
}

// ---------------------------------------------------------------- university teams that may invite him

export interface UnivInvite {
  school: School
  rating: TeamRating
  /** the chance that this university invites him (before the draw) */
  pInvite: number
  invited: boolean
}

const regionOfPref = (pref: string) => PREFECTURES.find((p) => p.name === pref)?.region ?? ''

let awayPool: School[] | undefined
/**
 * How far the word of a player travels (PROJECT_PLAN §11.63; game assumptions): 0 for an ordinary player, 1 for one far above the level
 * of the stage (his list's level for a high school, his evaluation against the universities' mean for a university). The schools of his
 * own region invite as before; the farther ones invite more the higher this is.
 */
const reach = (x: number) => clamp(x, 0, 1)

/**
 * スポーツ推薦 from outside his prefecture (PROJECT_PLAN §11.62–63): private schools with a 甲子園 record elsewhere in the country may
 * invite a player good enough for them. Of the chance that a team of that level invites him (inviteP), his own region gives 0.02–0.3 and
 * the rest of the country 0–0.12, rising with his level (reach, from the list's level L: 1.0 ordinary, 1.8 and above the most): an
 * ordinary player hears from his own region now and then, never from far away.
 * Drawn once per school and player on a hash of their own (the same every time it is asked, no stream is drawn); a school far above him
 * does not look. At most three, the strongest first: a stronger player is asked by stronger schools.
 */
export function awayInvites(s: LifeState, ev: Evaluation, L: number): School[] {
  const own = prefOf(s)
  awayPool ??= ALL_SCHOOLS.filter((x) => x.kind === 'hs' && x.owner === 'private' && x.branch === 'main' && admitsMale(x) && !NOT_FULL_TIME.test(x.name) && !NO_HS_INTAKE_IDS.has(x.id) && !!koshienOf(x.id))
  const region = regionOfPref(own)
  const a = reach((L - 1.0) / 0.8)
  return awayPool
    .filter((x) => x.pref !== own)
    .map((x) => {
      const rt = hsRating(x)
      const fit = inviteP(ev, rt)
      const p = fit < 0.3 ? 0 : fit * (regionOfPref(x.pref) === region ? 0.02 + 0.28 * a : 0.12 * a)
      return { x, v: rt.value, ok: p > 0 && makeRng(hashSeed(s.config.seed ^ idNum(x.id) ^ 0x1418)).next() < p }
    })
    .filter((v) => v.ok)
    .sort((a, b) => b.v - a.v)
    .slice(0, 3)
    .map((v) => v.x)
}

/**
 * The universities that could take an interest in him: the members of the leagues whose lists were read (all
 * over the country) and some more from his own region and from the country (whose leagues are not known).
 * Whether one invites him is drawn once per school and player (the same every time it is asked), from his
 * evaluation against the team's level; a team far from home invites less. Deterministic for a given state.
 */
export function univInvites(s: LifeState, ev: Evaluation = evaluate(s)): UnivInvite[] {
  // only universities that have a baseball club in a league (the federation's lists)
  const schools = clubUnivPool('*')
  // most teams never notice a given player: the chance that one looks at him grows with the scouts' attention to him
  const visible = 0.05 + 0.35 * clamp((s.bb?.scout ?? 0) / 60, 0, 1)
  const far = reach((ev.total - UNIV_MEAN) / 0.8)
  const all = schools.map((school) => {
    const rating = univRating(school)
    const near = regionOfPref(school.pref) === regionOf(s)
    // (§11.63) a team far from home invites less, and less still an ordinary player: 0.3 of the near teams' 1.5 for him, as much as
    // the near teams for a player well above the universities' level (reach); the near teams as before
    const pInvite = inviteP(ev, rating) * visible * (near ? 1.5 : 0.3 + 1.2 * far)
    const invited = makeRng(hashSeed(s.config.seed ^ idNum(school.id) ^ 0x1417)).next() < pInvite
    return { school, rating, pInvite, invited }
  })
  // a player has a handful of offers, not dozens: the twelve likeliest; for a strong player the strongest teams come first, wherever
  // they are (§11.63: the powerhouses of the country, not only his region's teams)
  const key = (x: { pInvite: number; rating: TeamRating }) => x.pInvite + 0.5 * far * x.rating.value
  const keep = new Set(
    all
      .filter((x) => x.invited)
      .sort((a, b) => key(b) - key(a))
      .slice(0, 12)
      .map((x) => x.school.id),
  )
  return all.map((x) => (x.invited && !keep.has(x.school.id) ? { ...x, invited: false } : x))
}

/** words about the best teams that invited him (for the choice on leaving school), or '' */
export function inviteSummary(s: LifeState): string {
  const got = univInvites(s).filter((x) => x.invited)
  if (got.length === 0) return ''
  const best = got.reduce((a, b) => (b.rating.value > a.rating.value ? b : a))
  return `${got.length}校から声がかかっている（最上位は${best.rating.league ? `${best.rating.league}の` : ''}${levelWord(best.rating.value - UNIV_MEAN)}の大学）`
}

/**
 * Universities to choose from, each with its one representative 偏差値 (or an assumed difficulty).
 * 'club': the calibrated check gave him a university that takes baseball players. The スポーツ推薦 options are the
 * teams that invited him (see `univInvites`), picked by baseball level (best, middle, safest), never by 偏差値;
 * whether he gets in is his evaluation against the team's level. 一般入試 and 学校推薦 options follow.
 * 'student': a player who has stopped playing (or never played) chooses by 一般入試 and 学校推薦.
 * 'walkon': a player without an invitation who tries for the baseball club by 一般入試 or 学校推薦.
 */
export function univShortlist(s: LifeState, kind: 'club' | 'student' | 'walkon', r: Rng): Option[] {
  // a player who goes on with baseball chooses among universities with a team in a league; one who has stopped, among all
  const playing = kind !== 'student'
  const sd = studentDev(s)
  const all = candidatesFor(playing ? [clubUnivPool(regionOf(s)), clubUnivPool('*')] : [univPool(regionOf(s)), univPool('*')], sd, s.config.seed, r)
  const used = new Set<string>()
  const out: Option[] = []
  if (kind === 'club') {
    const ev = evaluate(s)
    const all2 = univInvites(s, ev)
    let invited = all2.filter((x) => x.invited).sort((a, b) => b.rating.value - a.rating.value)
    // the calibrated check says a university takes him: at least the lowest-level team does
    if (invited.length === 0) invited = [all2.reduce((a, b) => (b.rating.value < a.rating.value ? b : a))]
    const picks = [invited[0], invited[Math.floor((invited.length - 1) / 2)], invited[invited.length - 1]]
    const seen = new Set<string>()
    for (const x of picks) {
      if (seen.has(x.school.id)) continue
      seen.add(x.school.id)
      used.add(x.school.id)
      out.push(withRating(toOption(candidate(s.config.seed, x.school), 'sports', admitP(ev, x.rating, 'sports')), x.rating, true))
    }
    const last = out[out.length - 1]
    last.p = Math.max(0.9, last.p)
    last.safe = true
    // beside the invitations: one 一般入試 and one 学校推薦, from the windows around his level (a 挑戦校 or an 実力相応校)
    const extra: Slot[] = [
      { w: sd >= 45 ? 'reach' : 'match', method: 'general' },
      { w: 'rec', method: 'recommend' },
    ]
    for (const slot of extra) {
      const c = pickWindow(all, sd, slot, used, r)
      if (c) out.push({ ...withRating(toOption(c, slot.method, slot.method === 'recommend' ? recommendP(s, c.dev) : generalP(s, c.dev)), univRating(c.school)), tier: undefined })
    }
    // one invitation and no school in the windows (a student far above or below the universities with a team): the school with a
    // team nearest to his level, by 一般入試, so that he is not asked to choose among one. Nothing is drawn; the invitations come
    // first, so おまかせ's choice (autoPick) and the safe school stay the same.
    if (out.length < 2) {
      const near = [...all].filter((c) => !used.has(c.school.id)).sort((a, b) => Math.abs(a.dev - sd) - Math.abs(b.dev - sd))[0]
      if (near) {
        used.add(near.school.id)
        out.push({ ...withRating(toOption(near, 'general', generalP(s, near.dev)), univRating(near.school)), tier: undefined })
      }
    }
    return out.map((o) => ({ ...o, tier: tierOf(o.p) }))
  }
  // 一般入試 and 学校推薦 by windows of 偏差値 around his level (see `tieredOptions`)
  const withTeam = (o: Option, school: School) => (kind === 'walkon' ? withRating(o, univRating(school)) : o)
  const build = (c: Cand, method: Method, p: number) => withTeam(toOption(c, method, p), c.school)
  const slots: Slot[] = [
    { w: 'reach', method: 'general' },
    { w: 'match', method: 'general' },
    { w: 'rec', method: 'recommend' },
    { w: 'safe', method: 'general' },
    { w: 'match', method: 'general' },
  ]
  return tieredOptions(s, all, slots, r, build)
}

// ---------------------------------------------------------------- US colleges that may invite him

export interface UsInvite {
  college: UsCollege
  rating: TeamRating
  pInvite: number
  invited: boolean
}

/**
 * US colleges (NCAA Division I) that took an interest in him: drawn once per college and player, from his evaluation
 * against the team's level, much rarer than at home (a few at most). Deterministic for a given state.
 */
export function usInvites(s: LifeState, ev: Evaluation = evaluate(s)): UsInvite[] {
  const visible = 0.04 + 0.2 * clamp((s.bb?.scout ?? 0) / 60, 0, 1)
  const all = US_COLLEGES.map((college) => {
    const rating = usRating(college)
    const pInvite = inviteP(ev, rating) * visible
    const invited = makeRng(hashSeed(s.config.seed ^ idNum(college.id) ^ 0x1c01)).next() < pInvite
    return { college, rating, pInvite, invited }
  })
  const keep = new Set(
    all
      .filter((x) => x.invited)
      .sort((a, b) => b.pInvite - a.pInvite)
      .slice(0, 6)
      .map((x) => x.college.id),
  )
  return all.map((x) => (x.invited && !keep.has(x.college.id) ? { ...x, invited: false } : x))
}

// ---------------------------------------------------------------- showing and choosing

const SRC_TEXT: Record<string, string> = {
  keinetRanking2027: '河合塾・2027年度入試のボーダー予想の学科の中央値',
  jukelabo2026univ: 'じゅけラボ予備校の公表値',
  jukelabo2026: 'じゅけラボ予備校・2026年度の公表値',
}

/** the published 偏差値 with its source, or 「未収録」 (an assumed difficulty is never shown as a value) */
export function devText(o: Option): string {
  if (!o.published) return '偏差値は未収録'
  const src = SRC_TEXT[o.src ?? ''] ?? '公表値'
  return o.floor ? `偏差値 37.4以下（${src}）` : `偏差値 ${o.dev.toFixed(o.dev % 1 ? 1 : 0)}（${src}）`
}

export function optionLabel(o: Option, kind: 'hs' | 'univ'): string {
  const owner = { national: '国立', public: '公立', private: '私立' }[o.owner]
  const place = kind === 'hs' ? `${owner}・${o.muni}` : owner
  return `${o.tier ? `【${TIER_LABEL[o.tier]}】` : ''}${o.name}（${place}）を${METHOD_LABEL[o.method]}で受ける`
}

export function optionHint(o: Option): string {
  const dev =
    o.method === 'sports' ? `${devText(o)}。スポーツ推薦は偏差値ではなく、野球の実績で決まる` : o.method === 'recommend' ? `${devText(o)}。推薦は学力と評価で決まる` : devText(o)
  const team = o.level ? `。野球部の強さの目安は${o.level}${o.league ? `（${o.league}）` : ''}${o.note ? `・${o.note}` : ''}（${BASIS_LABEL[o.basis ?? 'estimated']}）` : ''
  const invited = o.invited ? '。声がかかっている（入れるかは別）' : ''
  return `${dev}${team}${invited}。${prospect(o.p)}（ゲーム上の仮定）`
}

/** おまかせ: the most demanding school he has an even chance at, else the safe one */
export function autoPick(opts: Option[]): number {
  if (opts[0]?.method === 'sports') {
    // invitations: the best team (by its level) he has an even chance to get into, else the safe one
    let top = -1
    for (let i = 0; i < opts.length; i++) if (opts[i].method === 'sports' && opts[i].p >= 0.5 && (top < 0 || (opts[i].rating ?? 0) > (opts[top].rating ?? 0))) top = i
    return top >= 0 ? top : Math.max(0, opts.findIndex((o) => o.safe))
  }
  let best = -1
  for (let i = 0; i < opts.length; i++) if (opts[i].p >= 0.45 && (best < 0 || opts[i].dev > opts[best].dev)) best = i
  return best >= 0 ? best : Math.max(0, opts.findIndex((o) => o.safe))
}

export interface Entered {
  option: Option
  fellBack: boolean
}

/** the exam: the chosen school, or the safe one when it fails (the exam is drawn on the event stream) */
export function sitExam(opts: Option[], chosen: number, r: Rng): Entered {
  const o = opts[chosen] ?? opts[0]
  if (r.next() < o.p) return { option: o, fellBack: false }
  const safe = opts.find((x) => x.safe) ?? opts[0]
  return { option: safe, fellBack: safe.id !== o.id }
}
