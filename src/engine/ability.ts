import type { BaseballState, LifeState, Menu, Phase, Position, SkillKey } from './types.ts'
import type { Rng } from './rng.ts'
import { clamp, normCdf } from './math.ts'
import { performanceZ } from './potential.ts'

// Abilities (PROJECT_PLAN §11.1-2/3, stage 2). Model values, not statistics.
// The calibrated overall ability `z` stays the driver of every statistical stage check. A player's
// skills are a profile around it: displayed skill = position among peers of the same age,
// 50 + 15·(z + profile). Practice choices shift the profile (what grows) and add to the growth of z.

export const SKILLS: Record<'P' | 'F' | 'C', SkillKey[]> = {
  P: ['velocity', 'control', 'breaking', 'stamina'],
  F: ['contact', 'power', 'speed', 'fielding', 'arm'],
  C: ['catching', 'throwing', 'calling'],
}

export const SKILL_LABEL: Record<SkillKey, string> = {
  velocity: '球速',
  control: '制球',
  breaking: '変化球',
  stamina: 'スタミナ',
  contact: 'ミート',
  power: '長打',
  speed: '走力',
  fielding: '守備',
  arm: '肩',
  catching: '捕球',
  throwing: '送球',
  calling: 'リード',
}

const ALL_SKILLS = Object.keys(SKILL_LABEL) as SkillKey[]

/** which skills matter for a position (catchers also bat) */
export function skillsFor(pos: Position): SkillKey[] {
  if (pos === 'P') return SKILLS.P
  if (pos === 'C') return [...SKILLS.C, 'contact', 'power']
  return SKILLS.F
}

export const MENU_LABEL: Record<Menu, string> = {
  batting: '打撃練習',
  pitching: '投球練習',
  defense: '守備・走塁',
  body: '体づくり',
  balanced: 'まんべんなく',
}

const MENU_SKILLS: Record<Menu, SkillKey[]> = {
  batting: ['contact', 'power'],
  pitching: ['velocity', 'control', 'breaking', 'stamina'],
  defense: ['fielding', 'arm', 'speed', 'catching', 'throwing', 'calling'],
  body: ['power', 'velocity', 'stamina', 'speed'],
  balanced: [],
}

export function initBaseball(s: LifeState, rng: Rng): BaseballState {
  const skills = {} as Record<SkillKey, number>
  for (const k of ALL_SKILLS) skills[k] = rng.normal() * 0.35
  // tall players throw harder and hit farther; light ones run (assumption)
  const r = s.person.heightCm / 170.8 - 1
  skills.velocity += r * 4
  skills.power += r * 4
  skills.speed -= r * 2
  centre(skills)
  return {
    skills,
    build: Math.exp(rng.normal() * 0.1),
    muscleKg: 0,
    fatigue: 20,
    condition: 0,
    confidence: 50,
    coachEval: 50,
    role: 'none',
    teamSize: 0,
    teamStrength: 0,
    menu: 'balanced',
    gain: 0,
  }
}

/** keep the profile centred, so that the overall level stays z */
export function centre(skills: Record<SkillKey, number>) {
  const m = ALL_SKILLS.reduce((a, k) => a + skills[k], 0) / ALL_SKILLS.length
  for (const k of ALL_SKILLS) skills[k] -= m
}

/** one year of practice: the menu shifts the profile; effort adds to the growth of z (returned) */
export function practiceYear(bb: BaseballState, rng: Rng, intensity: number): number {
  const focus = MENU_SKILLS[bb.menu]
  for (const k of ALL_SKILLS) {
    bb.skills[k] *= 0.9
    if (focus.includes(k)) bb.skills[k] += 0.12 + rng.normal() * 0.04
  }
  centre(bb.skills)
  if (bb.menu === 'body') bb.muscleKg += 1.5 + rng.next()
  // effort pays off less when tired (assumption)
  const tiredness = clamp((bb.fatigue - 60) / 40, 0, 1)
  return intensity * (1 - 0.6 * tiredness)
}

/** displayed skill 1–99: position among peers of the same age */
export function skillScore(s: LifeState, k: SkillKey): number {
  const prof = s.bb?.skills[k] ?? 0
  return clamp(Math.round(100 * normCdf(s.z + prof)), 1, 99)
}

/**
 * The ability shown to the player (PROJECT_PLAN §11.23), on one scale for every age and level: 50 is about the average NPB player,
 * and a very strong high-school player (the top two in a hundred of his age) is about 50 too; a child is lower, as he has not grown
 * yet. `skillScore` (the standing among peers of the same age) stays what the game models read; this is for the screen only.
 * Model values: the reference (2.1 on the ability scale) is between the average NPB player (2.14, calibration) and a top-two-percent
 * high-school player (2.05).
 */
export const ABILITY_REF = 2.1

/**
 * The shown ability of speed (PROJECT_PLAN §11.51): 150 km/h is 50 (a game reference, a rough mark for pitchers of every age and
 * level, not the exact NPB mean), 2 points for each km/h above or below it, so 160 km/h is 70 and 140 km/h is 30. It is read from the
 * pitch speed the screen shows (`velocityKmh`), so the number and the km/h agree. FOR THE SCREEN ONLY: no draft, pro or stage check
 * and no decision reads it (they read z); `skillScore` and the games stay as they were.
 */
export const VELOCITY_REF_KMH = 150
export const VELOCITY_POINTS_PER_KMH = 2
export function velocityScore(s: LifeState): number {
  return clamp(Math.round(50 + VELOCITY_POINTS_PER_KMH * (velocityKmh(s) - VELOCITY_REF_KMH)), 1, 99)
}

export function abilityScore(s: LifeState, k: SkillKey): number {
  if (k === 'velocity' && s.person.position === 'P') return velocityScore(s)
  const prof = s.bb?.skills[k] ?? 0
  return clamp(Math.round(50 + 12 * (performanceZ(s) + prof - ABILITY_REF) - 3 * Math.max(0, 17 - s.age)), 1, 99)
}

/** a pitcher's shown overall counts his speed double (a game weight); the other positions are the plain mean of their skills */
export const VELOCITY_WEIGHT = 2

/** the overall shown ability for his position (the mean of the position's skills on the shown scale, speed doubled for a pitcher) */
export function abilityOverall(s: LifeState): number {
  const keys = skillsFor(s.person.position).filter((k) => k !== 'velocity' || s.person.position === 'P')
  const w = (k: SkillKey) => (k === 'velocity' ? VELOCITY_WEIGHT : 1)
  const total = keys.reduce((a, k) => a + w(k), 0)
  return Math.round(keys.reduce((a, k) => a + w(k) * abilityScore(s, k), 0) / total)
}

/** pitch speed (km/h, model value): an age baseline plus ability */
export function velocityKmh(s: LifeState): number {
  // a third-year high school pitcher: median 127 km/h, the lowest tenth near 117, the top one in a hundred near 143
  // (targets set 2026-10-18; assumptions, stat hsPlayModel). Ability counts for more than the profile (what he trained),
  // and the spread is wider among the young, who differ most in how far they have grown.
  const base: Record<number, number> = { 12: 99, 13: 105, 14: 111, 15: 116, 16: 121, 17: 123, 18: 127, 19: 130, 20: 133, 21: 136, 22: 137 }
  // (from 31 the arm loses speed with the years: 0.6 km/h a year to 35, 1 km/h a year after; game assumptions, PROJECT_PLAN §11.65 —
  // the ability z is measured against the players of his own age and does not fall by itself, so the decline of age is here)
  const b = s.age <= 11 ? 90 + (s.age - 9) * 3 : s.age >= 23 ? 139 - 0.6 * clamp(s.age - 30, 0, 5) - 1.0 * Math.max(0, s.age - 35) : base[s.age]
  const sens = clamp(7.7 - 0.6 * Math.max(0, s.age - 17), 5, 7.7)
  return Math.round(b + sens * (performanceZ(s) + 0.7 * (s.bb?.skills.velocity ?? 0)))
}

export const CONDITION_LABEL = ['絶不調', '不調', 'ふつう', '好調', '絶好調']

export function conditionLabel(bb: BaseballState): string {
  return CONDITION_LABEL[clamp(Math.round(bb.condition) + 2, 0, 4)]
}

/** height in sd units (the cohort's adult height is drawn as 171 cm with sd 6, life.ts createLife) */
export function heightZ(s: LifeState): number {
  return clamp((s.person.heightCm - 171) / 6, -2.5, 2.5)
}

/** weights of the skills that matter for a position (PROJECT_PLAN §11.14; model values) */
const FIT_WEIGHTS: Record<Position, Partial<Record<SkillKey, number>>> = {
  P: { velocity: 0.3, control: 0.25, breaking: 0.2, stamina: 0.15 },
  C: { catching: 0.3, throwing: 0.25, calling: 0.2, contact: 0.1, power: 0.05 },
  IF: { fielding: 0.3, contact: 0.25, speed: 0.15, arm: 0.15, power: 0.1 },
  OF: { speed: 0.25, arm: 0.25, contact: 0.2, power: 0.2, fielding: 0.1 },
}

/**
 * How well the body and the skills suit the position, in z units (−0.35 … +0.35; game assumption). Height is
 * never decisive alone: it only tilts the position (a pitcher's reach and leverage, a catcher's sturdiness,
 * an infielder's agility, an outfielder's range), the tilt grows a little with ability, and strong skills
 * for the position make up for a body that is against it.
 */
export function positionFit(s: LifeState, pos: Position = s.person.position): number {
  const sk = s.bb?.skills
  if (!sk) return 0
  let skill = 0
  for (const [k, w] of Object.entries(FIT_WEIGHTS[pos]) as [SkillKey, number][]) skill += w * sk[k]
  const hz = heightZ(s)
  const tilt = { P: 0.04 * hz, C: 0.012 * hz - 0.02 * hz * hz, IF: -0.025 * hz, OF: 0.012 * hz }[pos]
  const scale = 1 + 0.25 * clamp(s.z, -1, 2)
  let size = tilt * scale
  if (size < 0 && skill > 0.08) size *= 0.5
  // (the skills of a player's position grow with the practice he does for it: the weighted skill is about +0.4 on average)
  return clamp(0.45 * skill + size, -0.35, 0.35)
}

/** the position the body and skills suit best, and how much better it is than the present one */
export function bestPosition(s: LifeState): { pos: Position; fit: number; gain: number } {
  let pos: Position = s.person.position
  let fit = positionFit(s)
  for (const p of ['P', 'C', 'IF', 'OF'] as const) {
    const f = positionFit(s, p)
    if (f > fit) {
      pos = p
      fit = f
    }
  }
  return { pos, fit, gain: fit - positionFit(s) }
}

/**
 * After high school the squad is picked with the fit to the position counted (a part of the team score);
 * in high school the squad check feeds the calibrated Koshien and staying rates, so it is left as calibrated.
 */
export const FIT_IN_SQUAD: Phase[] = ['univ', 'company', 'indep']

/** the player's playing strength inside his team (z plus form and the coach's view) */
export function teamScore(s: LifeState): number {
  const bb = s.bb
  if (!bb) return s.z
  const fit = FIT_IN_SQUAD.includes(s.career.phase) ? 0.5 * positionFit(s) : 0
  return s.z + 0.12 * bb.condition + 0.006 * (bb.coachEval - 50) + 0.004 * (bb.confidence - 50) + fit
}

const POS_SHARE: Record<Position, number> = { P: 0.25, C: 0.12, IF: 0.35, OF: 0.28 }
const POS_SLOTS: Record<Position, number> = { P: 1, C: 1, IF: 4, OF: 3 }
/** grade offset of teammates relative to a 3rd-year (assumption) */
const GRADE_SHIFT = [-0.6, -0.25, 0]
/** the same for the four university years: bodies differ less after 18 (assumption) */
export const UNIV_GRADE_SHIFT = [-0.4, -0.2, -0.08, 0]
/** company and independent teams: no grades */
export const NO_GRADE_SHIFT = [0]

/**
 * Where the player stands in his team this tournament.
 * Teammates are drawn around the team's strength; returns how many are better overall and at his position.
 * `shifts`: grade offsets (high school by default).
 */
export function rankInTeam(s: LifeState, rng: Rng, grade: number, shifts: number[] = GRADE_SHIFT): { better: number; betterAtPos: number; size: number } {
  const bb = s.bb!
  // z is the position among players of the same grade; younger players stand lower in a mixed team
  const me = teamScore(s) + shifts[clamp(grade - 1, 0, shifts.length - 1)]
  const others = bb.teamSize - 1
  // how far teammates spread around the team's strength (assumption). University squads are recruited, so they spread less: with the
  // high school's 0.8, the big squads of the strongest university teams held so many far stronger players that a top-5% player of his
  // age sat out most leagues (2026-10-24: 55–80% of the halves without a game for the 90–95th percentile). The draws are the same.
  const spread = shifts === UNIV_GRADE_SHIFT ? 0.55 : 0.8
  let better = 0
  let betterAtPos = 0
  for (let i = 0; i < others; i++) {
    const g = i % shifts.length
    const v = bb.teamStrength + shifts[g] + rng.normal() * spread
    if (v > me) {
      better++
      if (rng.chance(POS_SHARE[s.person.position])) betterAtPos++
    }
  }
  return { better, betterAtPos, size: bb.teamSize }
}

export function startsAt(pos: Position, betterAtPos: number): boolean {
  return betterAtPos < POS_SLOTS[pos]
}

/**
 * the bench role as written in the texts: a pitcher on the bench waits to pitch in relief (the stored
 * role keeps its effects on practice, so nothing else changes)
 */
export function subRoleLabel(s: LifeState): string {
  return s.person.position === 'P' ? '救援' : (s.bb?.subRole ?? '代打')
}

/** the best use of a bench player */
export function benchRole(s: LifeState): '代打' | '代走' | '守備固め' {
  const sk = s.bb!.skills
  const bat = (sk.contact + sk.power) / 2
  if (sk.speed > bat && sk.speed > sk.fielding) return '代走'
  if (sk.fielding > bat) return '守備固め'
  return '代打'
}

export const BENCH_SIZE = 20
/** squad size for university league games and company and independent teams (game setting, stat seasonModel) */
export const BENCH_SIZE_ADULT = 25
