import type { GrowthPattern, LifeConfig, LifeState, PotentialState } from './types.ts'
import { clamp, normCdf } from './math.ts'
import { hashSeed, makeRng, type Rng } from './rng.ts'
import { shownAge } from './displayAge.ts'

// The potential mode (PROJECT_PLAN §11.20). The normal mode's ability `z` (the player's standing among players of his age,
// read by every calibrated stage check) moves as a mean-reverting random walk with a drift from practice. Here it is
// computed from a hidden talent instead, so that the same checks, schools, scouts and events work unchanged:
//
//   z = base + g · D − ḡ · D̄(age) + short-term form + lasting bumps
//
// base  the ability he starts with;  g  the talent (what full development adds);  D  the share of it realised so far
// (0..1);  D̄(age)  the share the usual player has realised by that age;  ḡ  the usual talent. A player who develops as
// usual stands where his base and talent put him; one who is developed better than usual rises, one who is not falls
// back, whatever his talent. Each year D grows by (the pattern's share of development at that age) × (the quality of
// that year's development) × (his growth speed). The quality comes from effort, the coach and how he suits him,
// playing time, health and injuries, and the lasting effect of choices. Everything here is a model value, not a statistic.
//
// Nothing in this file runs in the normal mode: `LifeState.pot` is absent there, and every caller checks for it.

/** the usual talent (the mean of g) */
export const GBAR = 0.9
/**
 * The normal mode's ability drifts down a little each year for a player who is not drilled (a mean-reverting walk with a negative
 * drift), so that its players stand a little below the cohort's centre; the potential mode matches that, so that the same
 * stage checks give about the same shares of players (assumption, measured against the normal mode)
 */
export const LEVEL_OFFSET = 0.3
const AGE_FROM = 8
const AGE_TO = 28

export const PATTERN_LABEL: Record<GrowthPattern, string> = { early: '早熟型', steady: '標準型', late: '晩成型', spurt: '急成長型', plateau: '足踏み型' }
export const PATTERN_TEXT: Record<GrowthPattern, string> = {
  early: '早い時期に伸びて、そのあとは伸びが緩やかになる',
  steady: '年齢なりに、少しずつ伸びる',
  late: '遅い時期になってから、大きく伸びる',
  spurt: '何年かのあいだに、一気に伸びる',
  plateau: '途中で壁にぶつかり、きっかけがなければ伸びが止まる',
}
const PATTERN_WEIGHT: Record<GrowthPattern, number> = { early: 25, steady: 33, late: 20, spurt: 17, plateau: 5 }
const PATTERNS = Object.keys(PATTERN_WEIGHT) as GrowthPattern[]

const gauss = (age: number, c: number, sd: number) => Math.exp(-0.5 * ((age - c) / sd) ** 2)

/** the share of all development that falls in each age (ages 8..28; sums to 1) */
function hazard(pattern: GrowthPattern, spurtAge: number): number[] {
  const raw: number[] = []
  for (let a = AGE_FROM; a <= AGE_TO; a++) {
    const v =
      pattern === 'early' ? gauss(a, 12, 2.6)
      : pattern === 'steady' ? gauss(a, 15.5, 4)
      : pattern === 'late' ? gauss(a, 20.5, 3.2)
      : pattern === 'spurt' ? 0.4 * gauss(a, 15.5, 4.5) / 4.5 + 0.6 * gauss(a, spurtAge, 0.9) / 0.9
      : pattern === 'plateau' ? (a <= 14 ? gauss(a, 12, 2.2) : 0) : 0
    raw.push(v)
  }
  if (pattern === 'plateau') {
    // two thirds before fifteen; the last third is spread over fifteen to twenty-two and only comes once the stall is broken
    const early = raw.reduce((x, y) => x + y, 0)
    return raw.map((v, i) => (AGE_FROM + i <= 14 ? (0.62 * v) / early : AGE_FROM + i <= 22 ? 0.38 / 8 : 0))
  }
  const sum = raw.reduce((x, y) => x + y, 0)
  return raw.map((v) => v / sum)
}

/** hazards by pattern (the spurt by its age) */
const HAZ: Record<string, number[]> = {}
for (const p of PATTERNS) if (p !== 'spurt') HAZ[p] = hazard(p, 0)
for (let a = 14; a <= 19; a++) HAZ[`spurt${a}`] = hazard('spurt', a)

export function hazardOf(p: PotentialState): number[] {
  return p.pattern === 'spurt' ? HAZ[`spurt${p.spurtAge}`] : HAZ[p.pattern]
}

/** the share of development the usual player has realised by the end of a year of age (the average over the patterns) */
const MEAN_DEV: number[] = (() => {
  const out: number[] = []
  const cum = Object.fromEntries(PATTERNS.map((p) => [p, 0])) as Record<GrowthPattern, number>
  const total = Object.values(PATTERN_WEIGHT).reduce((x, y) => x + y, 0)
  for (let a = AGE_FROM; a <= AGE_TO; a++) {
    for (const p of PATTERNS) {
      const h = p === 'spurt' ? [14, 15, 16, 17, 18, 19].reduce((x, sa) => x + HAZ[`spurt${sa}`][a - AGE_FROM], 0) / 6 : HAZ[p][a - AGE_FROM]
      // a plateau player passes fifteen at about half the usual speed (some break through, some do not)
      cum[p] += p === 'plateau' && a >= 15 ? h * 0.5 : h
    }
    out.push(PATTERNS.reduce((x, p) => x + (PATTERN_WEIGHT[p] / total) * cum[p], 0))
  }
  return out
})()

/** the usual realised share at an age (0 before eight, as much as is usual at twenty-eight and after) */
export function meanDev(age: number): number {
  if (age < AGE_FROM) return 0
  return MEAN_DEV[Math.min(age, AGE_TO) - AGE_FROM]
}

// ---------------------------------------------------------------- the ★ chosen at the start (PROJECT_PLAN §11.21)

export const MAX_STAR = 10

/** the chosen ★ as a whole number 1..10 (a life without one is ★1) */
export function starOf(k: number | undefined): number {
  return Math.round(clamp(k ?? 1, 1, MAX_STAR))
}

/**
 * What a ★ changes, all relative to ★1 (the baseline model) and all assumptions: the talent's distribution (a shift of g and a
 * little more spread: `shift`, `spread`), how fast he grows (`rate`), how well he is developed in a year (`q`), how much
 * likelier a stall is broken (`unlock`). It never touches a stage check, a country's base rate or a probability: a check
 * is Φ(α + b·z), and the ★ acts only through z, so the calibrated rates stay as they are and no probability can leave [0, 1].
 * The base ability, the growth type and the aptitudes are drawn as at ★1.
 */
/** the size of each effect per ★ above the first (assumptions, tuned against the trials of PROJECT_PLAN §11.22) */
export const STAR_TUNING = { shift: 0.24, shift2: -0.003, spread: 0.04, rate: 0.15, rate2: 0, q: 0.027, unlock: 0.02, base: 0.1, base2: 0.005, prem: 1.5, premCap: 0.12, early: 0.17, early2: 0, shi: 0.1 }
export function starParams(k: number | undefined) {
  const n = starOf(k) - 1
  const u = STAR_TUNING
  return { shift: u.shift * n + u.shift2 * n * n, spread: 1 + u.spread * n, rate: 1 + u.rate * n + u.rate2 * n * n, q: u.q * n, unlock: u.unlock * n, base: u.base * n + u.base2 * n * n, prem: 1 + u.prem * n, premCap: u.premCap * n, early: u.early * n + u.early2 * n * n, shi: u.shi * n }
}

// ---------------------------------------------------------------- start

/** the hidden talent of a new player; drawn from a stream of its own, so nothing else in the life moves */
export function initPotential(config: LifeConfig, z0: number, wealth = 3): PotentialState {
  const r = makeRng(hashSeed(config.seed ^ 0x70a1c0de))
  const star = starParams(config.stars)
  const pattern = r.weighted(PATTERNS, PATTERNS.map((p) => PATTERN_WEIGHT[p]))
  const base = 0.85 * z0 + star.base
  const g = clamp(GBAR + 0.6 * star.spread * r.normal() + star.shift, 0.1, 2.4 + star.shift)
  const rate = clamp((1 + 0.2 * r.normal()) * star.rate, 0.65, 1.45 * star.rate)
  const spurtAge = r.int(14, 19)
  const mind = r.normal()
  const soc = r.normal()
  const scoutBias = clamp(0.45 * r.normal(), -0.9, 0.9)
  // how much of the talent the scouts can see: the draw is the same at every ★ (drawn last, so that ★1 is the baseline model);
  // a family with more means reaches more coaches and tournaments (assumption)
  const exposure = clamp(0.75 + 0.3 * r.normal() + 0.04 * (wealth - 3), 0.25, 1)
  return {
    stars: starOf(config.stars),
    starShift: star.shift,
    exposure,
    base,
    g,
    rate,
    pattern,
    spurtAge,
    dev: 0,
    unlocked: false,
    mind,
    soc,
    known: { ath: 0.05, mind: 0.05, soc: 0.05 },
    scoutBias,
    coachFit: 0,
    phaseSeen: '',
    nurture: 0,
    noise: 0,
    bonus: 0,
    zLast: base,
    lost: 0,
    hist: [],
    peakZ: base,
  }
}

// ---------------------------------------------------------------- the year

const COACHED_PHASES = ['youth', 'jhs', 'hs', 'univ', 'company', 'indep', 'proMinor', 'pro', 'abroad']

export interface YearQuality {
  q: number
  /** what held development back or pushed it, for the log and the retrospective */
  why: string[]
}

/** how well this year develops him (1 = as usual), from his effort, coach, playing time, health and choices */
export function yearQuality(s: LifeState, effort: number): YearQuality {
  const p = s.pot!
  const b = s.bb
  const why: string[] = []
  let q = 1
  q += s.focus === 'practice' ? 0.15 : s.focus === 'rest' ? -0.12 : s.focus === 'study' ? -0.05 : 0
  q += 2.5 * effort
  if (b) {
    q += 0.004 * (b.coachEval - 50)
    if (COACHED_PHASES.includes(s.career.phase)) {
      if (b.role === 'starter') q += 0.1
      else if (b.role === 'outside') {
        q -= 0.12
        why.push('出場機会が少なかった')
      }
    }
    if (b.fatigue > 75) {
      q *= 0.85
      why.push('疲れが溜まっていた')
    }
  }
  const phase = s.career.phase
  if (phase === 'hs' && s.career.strongSchool) q += 0.08
  if (phase === 'company') q -= 0.1
  if (phase === 'pro' || phase === 'proMinor') q += 0.05
  // a higher ★ is likelier to be developed well (assumption); at ★1 this is zero
  q += starParams(p.stars).q
  q += p.coachFit
  if (p.coachFit <= -0.1) why.push('指導者との相性が合わなかった')
  else if (p.coachFit >= 0.1) why.push('指導者との相性がよかった')
  q += p.nurture
  const f = s.flags ?? {}
  if (f['coach.trust'] !== undefined) q += 0.06
  if (f['trainer.care'] !== undefined) q += 0.05
  if (f['rehab.expert'] !== undefined) q += 0.02
  if (s.career.injured > 0) {
    q *= 0.35
    why.push('怪我で練習できなかった')
  }
  return { q: clamp(q, 0.15, 1.7), why }
}

export interface YearResult {
  /** a stalled ('plateau') player has just broken through */
  unlocked: boolean
  q: number
}

/**
 * One year of development of a player in a playing stage: updates D, the talent lost to injuries, what is known, and z.
 * `effort`: the year's practice effect (ability.ts practiceYear); `rng`: the potential mode's own stream.
 */
export function advanceYear(s: LifeState, effort: number, rng: Rng): YearResult {
  const p = s.pot!
  if (p.phaseSeen !== s.career.phase) {
    p.phaseSeen = s.career.phase
    p.coachFit = clamp(0.1 * rng.normal(), -0.2, 0.2)
  }
  const { q, why } = yearQuality(s, effort)
  const age = s.age
  const haz = age >= AGE_FROM && age <= AGE_TO ? hazardOf(p)[age - AGE_FROM] : 0
  const gate = p.pattern === 'plateau' && age >= 15 && !p.unlocked ? 0.25 : 1
  p.dev = Math.min(1, p.dev + haz * q * p.rate * gate)
  if (gate < 1) why.push('伸びが止まっていた')
  // a lasting injury or a body worn out takes some of the talent with it
  if (s.career.injured > 0) {
    const cut = 0.04 * p.g
    p.g = Math.max(0.1, p.g - cut)
    p.lost += cut
  } else if ((s.bb?.fatigue ?? 0) > 85) {
    const cut = 0.02 * p.g
    p.g = Math.max(0.1, p.g - cut)
    p.lost += cut
  }
  let unlocked = false
  if (p.pattern === 'plateau' && !p.unlocked && age >= 16 && rng.chance(0.08 + starParams(p.stars).unlock + 0.3 * Math.max(0, q - 1))) {
    p.unlocked = true
    unlocked = true
  }
  p.noise = 0.5 * p.noise + 0.3 * rng.normal()
  // z moved this year by something other than development (a decision's bump) is kept for a while
  p.bonus = 0.85 * p.bonus + (s.z - p.zLast)
  p.nurture *= 0.8
  // a child with a high ★ stands out from the start: a lead over his age group that the others make up by eighteen
  const lead = starParams(p.stars).early * clamp((18 - age) / 6, 0, 1)
  s.z = p.base + p.g * p.dev - GBAR * meanDev(age) - LEVEL_OFFSET * Math.min(1, meanDev(age) * 1.5) + lead + p.noise + p.bonus
  p.zLast = s.z
  p.peakZ = Math.max(p.peakZ, s.z)
  const up = (s.bb?.role === 'starter' ? 0.02 : 0) + (['univ', 'company', 'indep', 'pro', 'proMinor', 'abroad'].includes(s.career.phase) ? 0.03 : 0)
  p.known.ath = Math.min(1, p.known.ath + 0.05 + up)
  p.hist.push({ age, q: Math.round(q * 100) / 100, dev: Math.round(p.dev * 1000) / 1000, z: Math.round(s.z * 100) / 100, why: why.join('、') })
  return { unlocked, q }
}

/** the aptitudes beside baseball: study and judgement raise knowledge, dealing with people raises relations */
export function aptitudeYear(s: LifeState): void {
  const p = s.pot!
  if (s.age >= 6 && s.age <= 22) s.status.knowledge += 0.8 * p.mind * (s.focus === 'study' ? 1.8 : 1)
  if (s.age >= 6 && s.age <= 40) s.status.relations += 0.5 * p.soc * (s.focus === 'people' ? 1.4 : 1)
  p.known.mind = Math.min(1, p.known.mind + 0.03)
  p.known.soc = Math.min(1, p.known.soc + 0.03)
}

// ---------------------------------------------------------------- choices

export interface PotEffect {
  /** how well he is developed over the next years */
  nurture?: number
  /** the talent itself, and the growth speed */
  g?: number
  rate?: number
  /** what becomes known about each aptitude */
  reveal?: number
  revealMind?: number
  revealSoc?: number
  /** breaks a stall ('plateau') */
  unlock?: boolean
  /** how well he suits the coach (a redraw when 'redraw') */
  coachFit?: number | 'redraw'
  /** the scouts' over- or under-estimate of his talent */
  scoutBias?: number
  mind?: number
  soc?: number
}

export function applyPot(s: LifeState, e: PotEffect, rng: Rng = makeRng(hashSeed(s.config.seed ^ s.age ^ 0x70a3))): void {
  const p = s.pot
  if (!p) return
  if (e.nurture) p.nurture = clamp(p.nurture + e.nurture, -0.4, 0.5)
  if (e.g) p.g = clamp(p.g + e.g, 0.1, 5)
  if (e.rate) p.rate = clamp(p.rate + e.rate, 0.6, 2.0)
  if (e.reveal) p.known.ath = clamp(p.known.ath + e.reveal, 0, 1)
  if (e.revealMind) p.known.mind = clamp(p.known.mind + e.revealMind, 0, 1)
  if (e.revealSoc) p.known.soc = clamp(p.known.soc + e.revealSoc, 0, 1)
  if (e.unlock) p.unlocked = true
  if (e.coachFit === 'redraw') p.coachFit = clamp(0.1 * rng.normal(), -0.2, 0.2)
  else if (e.coachFit) p.coachFit = clamp(p.coachFit + e.coachFit, -0.25, 0.25)
  if (e.scoutBias) p.scoutBias = clamp(p.scoutBias + e.scoutBias, -0.9, 0.9)
  if (e.mind) p.mind = clamp(p.mind + e.mind, -2.5, 2.5)
  if (e.soc) p.soc = clamp(p.soc + e.soc, -2.5, 2.5)
}

// ---------------------------------------------------------------- what he can do in a game

/**
 * The ability that his games and his pitch speed are made from. A player far above the rest of his level does not keep
 * rising in the box score as fast as in the ability (the records of the game model are bounded by what a person can do):
 * above 2.5 the extra counts for 40%. Only for a ★2 or higher, whose ability goes further than any life of the normal mode;
 * ★1 and the normal mode are untouched.
 */
export function performanceZ(s: LifeState): number {
  if (!s.pot || starOf(s.pot.stars) === 1 || s.z <= 2.5) return s.z
  return 2.5 + 0.4 * (s.z - 2.5)
}

// ---------------------------------------------------------------- the scouts

/** the talent as the scouts estimate it: the truth plus their bias, which fades as he is seen more */
export function scoutEstimate(s: LifeState): number {
  const p = s.pot!
  const seen = clamp(s.career.yearsPlaying / 14, 0, 1)
  // the part of the talent that the ★ added is noticed only as far as he is exposed: a talent in the wrong place goes unseen at first
  const unseen = (p.starShift ?? 0) * (1 - (p.exposure ?? 1)) * (1 - seen)
  return p.g - unseen + p.scoutBias * (1 - 0.5 * clamp(s.career.yearsPlaying / 12, 0, 1))
}

/**
 * What the scouts add for his promise: the talent they believe he has (not the one he has), over the usual, for the part
 * of the development still ahead of a player of his age. It is not what he can do now (that is `z`), and it can be wrong.
 */
export function scoutPremium(s: LifeState): number {
  if (!s.pot) return 0
  const star = starParams(s.pot.stars)
  return clamp(0.6 * star.prem * (scoutEstimate(s) - GBAR) * (1 - meanDev(s.age)), -0.25, 0.4 + star.premCap)
}

// ---------------------------------------------------------------- what the player is told

/** ☆1〜☆10 from the talent (standing among players: ☆5 and ☆6 are the usual) */
export function starsOf(g: number): number {
  return clamp(Math.round(1 + 9 * normCdf((g - GBAR) / 0.6)), 1, 10)
}

export interface Range {
  lo: number
  hi: number
  /** exact (the range has closed) */
  exact: boolean
}

/** a range of stars that always holds the truth, and narrows as more is known */
function rangeOf(star: number, known: number, seed: number, salt: number): Range {
  const spread = Math.round(4 * (1 - known))
  if (spread <= 0) return { lo: star, hi: star, exact: true }
  const shift = Math.round((makeRng(hashSeed(seed ^ salt)).next() * 2 - 1) * spread)
  const lo = clamp(star - spread + shift, 1, 10)
  const hi = clamp(star + spread + shift, 1, 10)
  return { lo: Math.min(lo, star), hi: Math.max(hi, star), exact: false }
}

export interface PotentialView {
  ath: Range
  mind: Range
  soc: Range
  /** the growth type, once it shows */
  pattern?: GrowthPattern
  /** how he is developing now: from the last year's quality */
  trend: '順調' | 'ふつう' | '停滞' | '—'
  /** the share realised, shown only with a margin until it is well known */
  dev: number
  known: number
  /** the ★ chosen at the start */
  chosen: number
}

export function potentialView(s: LifeState): PotentialView | undefined {
  const p = s.pot
  if (!p) return undefined
  const seed = s.config.seed
  const last = p.hist.at(-1)
  return {
    ath: rangeOf(starsOf(p.g), p.known.ath, seed, 1),
    mind: rangeOf(clamp(Math.round(5.5 + 2.2 * p.mind), 1, 10), p.known.mind, seed, 2),
    soc: rangeOf(clamp(Math.round(5.5 + 2.2 * p.soc), 1, 10), p.known.soc, seed, 3),
    pattern: p.known.ath >= 0.5 ? p.pattern : undefined,
    trend: !last ? '—' : last.q >= 1.1 ? '順調' : last.q >= 0.75 ? 'ふつう' : '停滞',
    dev: p.dev,
    known: p.known.ath,
    chosen: starOf(p.stars),
  }
}

export const rangeText = (r: Range): string => (r.exact ? `☆${r.lo}` : `☆${r.lo}〜☆${r.hi}`)

/** where a z value stands among players of his age, 0–100 */
export const standing = (z: number): number => Math.round(100 * normCdf(z))

// ---------------------------------------------------------------- looking back

export type Used = '生かせた' | '一部だけ生かせた' | '生かせなかった'

export interface Retrospective {
  /** the ★ chosen at the start */
  chosen: number
  startStanding: number
  peakStanding: number
  finalStanding: number
  /** ☆ of the talent he was born with (before injuries took some of it) */
  stars: number
  pattern: GrowthPattern
  /** how much of the talent came out (0..1) */
  dev: number
  /** did the talent come out: from the share realised */
  used: Used
  lost: number
  /** the cause of the gaps between talent and what came of it, from the life's own record, most important first */
  notes: string[]
  years: { age: number; z: number; q: number; dev: number }[]
}

export function retrospective(s: LifeState): Retrospective | undefined {
  const p = s.pot
  if (!p) return undefined
  const born = p.g + p.lost
  const stars = starsOf(born)
  const chosen = starOf(p.stars)
  const bad = p.hist.filter((h) => h.q < 0.75)
  const good = p.hist.filter((h) => h.q >= 1.15)
  const notes: string[] = []
  const reasons = new Map<string, number>()
  for (const h of bad) for (const w of h.why.split('、').filter(Boolean)) reasons.set(w, (reasons.get(w) ?? 0) + 1)
  const top = [...reasons.entries()].sort((a, b) => b[1] - a[1])
  const ratio = p.dev
  const used: Used = ratio >= 0.8 ? '生かせた' : ratio >= 0.5 ? '一部だけ生かせた' : '生かせなかった'
  const rank = s.career.highestRank
  if (p.hist.length === 0) notes.push('野球を本格的に始める前に人生が終わったため、素質が開く機会はありませんでした。')
  else {
    if (stars >= 7 && ratio < 0.7) notes.push(`素質は☆${stars}でしたが、開花は${Math.round(ratio * 100)}%にとどまりました。${top.length ? `${top.slice(0, 2).map(([w, n]) => `${w}（${n}年）`).join('、')}が響きました。` : '育ちの質が、素質を十分に引き出すところまで届きませんでした。'}`)
    else if (stars >= 7) notes.push(`素質は☆${stars}で、開花は${Math.round(ratio * 100)}%まで進みました。`)
    else if (stars <= 4 && standing(p.peakZ) - standing(p.base) >= 20) notes.push(`素質は☆${stars}でしたが、積み重ねた年（${good.length}年）が力を引き出し、始まりの位置から大きく伸びました。`)
    else notes.push(`素質は☆${stars}、開花は${Math.round(ratio * 100)}%でした。`)
    if (p.lost > 0.05) notes.push(`怪我や疲れで、素質の一部（約${Math.round((100 * p.lost) / born)}%）が失われました。`)
    if ((s.bb?.injuries ?? 0) >= 2) notes.push(`怪我で${s.bb!.injuries}シーズンを失いました。`)
    const quitAge = s.career.endedAge
    if (quitAge !== null && quitAge <= 17 && p.pattern !== 'early') notes.push(`${shownAge(quitAge)}歳で野球を離れました。${PATTERN_LABEL[p.pattern]}の素質が開く年齢の前でした。`)
    else if (p.pattern === 'late' && p.hist.length < 12) notes.push('晩成型でしたが、伸びる前に野球を離れました。')
    if (p.pattern === 'plateau') notes.push(p.unlocked ? '足踏み型でしたが、壁を越えるきっかけがありました。' : '足踏み型で、壁を越えるきっかけがないまま終わりました。')
    // the talent that the ★ added is noticed only as far as he was exposed (potential.ts scoutEstimate)
    if ((p.starShift ?? 0) >= 0.7 && (p.exposure ?? 1) < 0.6) notes.push('才能の大きさに比べて、スカウトの目に触れる機会が少なく、見つけられるのが遅れました。')
    if (Math.abs(p.scoutBias) >= 0.3) notes.push(p.scoutBias > 0 ? 'スカウトは、実際の素質より高く見ていました。' : 'スカウトは、実際の素質より低く見ていました。')
    if (chosen >= 7 && rank < 6 && ratio >= 0.7) notes.push('素質は十分に開きましたが、志望届・指名・契約といった進路の関門を通れませんでした。')
  }
  return {
    chosen,
    startStanding: standing(p.base),
    peakStanding: standing(p.peakZ),
    finalStanding: standing(s.z),
    stars,
    pattern: p.pattern,
    dev: p.dev,
    used,
    lost: p.lost,
    notes,
    years: p.hist.map((h) => ({ age: h.age, z: h.z, q: h.q, dev: h.dev })),
  }
}
