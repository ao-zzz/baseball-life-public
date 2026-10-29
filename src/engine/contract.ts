import type { LifeState, StatLine } from './types.ts'
import type { Rng } from './rng.ts'
import { clamp, normCdf } from './math.ts'

// The draft, the first contract and the pay of a pro (PROJECT_PLAN §11.23). Amounts are 万円 for NPB. All amounts are model values:
// the facts the model leans on are marked as such below, the rest is a game assumption.
//
// Facts (secondary sources, checked 2026-10-19): the NPB clubs' agreement caps a new player's signing bonus at 1億円 plus incentives of
// up to 5,000万円 and his first salary at 1,600万円 (an agreement between the clubs, not written in the baseball charter; reported by
// 文春オンライン and 高校野球ドットコム); in 2025 the clubs drafted 116 players (支配下73・育成43: stat jpDraftTotal).
// The 支配下 minimum salary (420万円) and the first team's minimum guarantee (stats npbMinSalary, npbFirstTeamMin): the figures of the
// players' association's table (2022 edition, source jpbpaGuide2022), used as the 2025 basis on the owner's instruction; the 2025 and
// 2026 amounts themselves are not confirmed (the charter's text is not public).
// The 育成 minimum 240万円 has no confirmed source: the same 2022 table says 230万円（税別）, which does not match. Kept at 240 on the
// owner's instruction (2026-10-22) until a source is found.
// Assumptions: the ranges by round (the game's table), the limits on a pay cut (25% up to 1億円, 40% above: reported practice, not
// checked), and how a season's results move the pay.

export const NPB_CLUBS = 12
export const NPB_MIN_SALARY = 420
export const IKUSEI_MIN_SALARY = 240

/**
 * The first team's minimum guarantee (追加参稼報酬): a 支配下 player paid less than 1,600万円 gets, for each day he is registered on the
 * first team, (1,600万円 − his salary) ÷ 150 on top of his salary; with 150 days or more the two make 1,600万円, never more. Nothing for
 * a day off the first team, nothing for a 育成 player (who cannot be registered), nothing at 1,600万円 and above. 万円, rounded.
 */
export const FIRST_TEAM_MIN = 1600
export const FIRST_TEAM_DAYS = 150
export function firstTeamExtra(salary: number, days: number): number {
  if (salary >= FIRST_TEAM_MIN || days <= 0) return 0
  const d = Math.min(days, FIRST_TEAM_DAYS)
  return Math.min(FIRST_TEAM_MIN - salary, Math.round(((FIRST_TEAM_MIN - salary) * d) / FIRST_TEAM_DAYS))
}
/** the top of NPB pay in the game (assumption, about the largest contracts of recent years) */
export const NPB_MAX_SALARY = 65000

export interface DraftInfo {
  /** the age and year of the draft */
  age: number
  year: number
  /** where he was drafted from: 高校, 大学, 社会人, 独立リーグ */
  from: string
  /** the club (its label) */
  team: string
  kind: 'shihaika' | 'ikusei'
  /** the round (支配下 1…, 育成 1…), the pick in the round, the overall pick, and the club's own order of picks */
  round: number
  pickInRound: number
  overall: number
  clubOrder: number
  /** 契約金 (育成: 支度金), the incentives on top of it (most), and the first salary, 万円 */
  bonus: number
  incentive: number
  salary: number
  /** drafted → signed (joined) or declined; the shirt number once he has joined */
  status: 'drafted' | 'signed' | 'declined'
  number?: number
  /** why he was taken: what the scouts saw */
  reason: string
  /** what he could do then (display score 0–100, see ability.ts abilityScore) and his record at the level he was drafted from */
  ability: number
  record?: string
}

/** the 支配下 rounds a club fills (about 73 支配下 picks over twelve clubs in 2025: six rounds and a little) */
const SHIHAIKA_ROUNDS = 9
const IKUSEI_ROUNDS = 6

/**
 * The round he is taken in: the better his evaluation (what the scouts see, potential included), the earlier. `q` is his standing
 * among the year's draftees (0 = the last taken, 1 = the first), drawn around his evaluation.
 */
export function draftRound(r: Rng, q: number, kind: 'shihaika' | 'ikusei'): { round: number; pickInRound: number; overall: number } {
  const rounds = kind === 'shihaika' ? SHIHAIKA_ROUNDS : IKUSEI_ROUNDS
  // the first six rounds take most of the 支配下 players; later rounds are thin (assumption)
  const u = clamp(q + r.normal() * 0.08, 0, 0.999)
  const round = kind === 'shihaika' ? clamp(1 + Math.floor((1 - u) * 6.6), 1, rounds) : clamp(1 + Math.floor((1 - u) * 4.5), 1, rounds)
  const pickInRound = r.int(1, NPB_CLUBS)
  // 支配下 picks come first (about 73 of them in 2025), then the 育成 draft
  const overall = kind === 'shihaika' ? (round - 1) * NPB_CLUBS + pickInRound : 73 + (round - 1) * 8 + Math.min(8, pickInRound)
  return { round, pickInRound, overall }
}

/** the game's table of first contracts by 支配下 round (万円): 契約金 range and first-salary range */
const ROOKIE: { bonus: [number, number]; salary: [number, number] }[] = [
  { bonus: [10000, 10000], salary: [1000, 1600] },
  { bonus: [6000, 7500], salary: [900, 1200] },
  { bonus: [4500, 6000], salary: [600, 1100] },
  { bonus: [3000, 4500], salary: [550, 900] },
  { bonus: [2500, 3500], salary: [450, 850] },
  { bonus: [2000, 3000], salary: [450, 850] },
  { bonus: [2000, 3000], salary: [450, 740] },
  { bonus: [1500, 2500], salary: [440, 650] },
  { bonus: [1000, 2000], salary: [440, 600] },
]

/** where in a range a background puts him: a high-school pick is paid less than a university or company player of the same round */
const BACKGROUND: Record<string, [number, number]> = { 高校: [0.05, 0.55], 大学: [0.35, 0.85], 社会人: [0.5, 1], 独立リーグ: [0, 0.45] }

const round10 = (x: number) => Math.round(x / 10) * 10

export function rookieTerms(r: Rng, round: number, kind: 'shihaika' | 'ikusei', from: string): { bonus: number; incentive: number; salary: number } {
  const [lo, hi] = BACKGROUND[from] ?? [0.2, 0.7]
  const at = lo + (hi - lo) * r.next()
  if (kind === 'ikusei') {
    // 支度金 about 200–300万円, salary 240–400万円 (the game's table)
    return { bonus: round10(200 + 100 * r.next()), incentive: 0, salary: round10(IKUSEI_MIN_SALARY + 160 * at) }
  }
  const t = ROOKIE[Math.min(round, ROOKIE.length) - 1]
  const bonus = round10(t.bonus[0] + (t.bonus[1] - t.bonus[0]) * (0.5 * at + 0.5 * r.next()))
  const salary = round10(t.salary[0] + (t.salary[1] - t.salary[0]) * at)
  // incentives: most first-round picks have the full 5,000万円 on top, a few of the second round some (assumption)
  const incentive = round === 1 ? (r.chance(0.75) ? 5000 : round10(2000 + 3000 * r.next())) : round === 2 && r.chance(0.3) ? round10(1000 + 2000 * r.next()) : 0
  return { bonus, incentive, salary }
}

// ---------------------------------------------------------------- the pay after the first year

export interface SeasonPay {
  /** a value of the season in the 1軍: 0 = no 1軍 games, about 1 = a regular with an average line, 2 = a star season */
  value: number
  firstTeam: boolean
  injured: boolean
}

/** what a season was worth for the pay, from its record (1軍 line, playing time, its quality) */
export function seasonValue(line: StatLine | undefined, pitcher: boolean, reliever: boolean): number {
  if (!line || line.games === 0) return 0
  if (!pitcher) {
    const share = clamp(line.pa / 450, 0, 1.2)
    if (!line.ab) return 0.05
    const avg = line.h / line.ab
    const hr = line.hr / line.ab
    const q = clamp((avg - 0.245) / 0.035 + (hr - 0.02) / 0.02, -2, 3)
    return Math.max(0, share * (0.6 + 0.4 * q))
  }
  const share = reliever ? clamp(line.games / 50, 0, 1.2) : clamp(line.outs / 420, 0, 1.2)
  const era = line.outs ? (line.er * 27) / line.outs : 9
  const q = clamp((3.5 - era) / 0.9, -2, 3)
  return Math.max(0, share * (0.6 + 0.4 * q))
}

/**
 * Next year's salary of a 支配下 player from this year's and last season's value. A season in the 1軍 raises the pay with its value
 * (a regular's average season about ×1.6, a star season up to ×2.7); a season without one, an injury or age cut it, within the
 * limits on a cut (25% up to 1億円, 40% above). `noise`: a standard normal draw (the year's stream, as before). Model values.
 */
export function nextSalary(prev: number, value: number, firstTeam: boolean, injured: boolean, age: number, noise: number): number {
  let m: number
  // a low pay (a rookie contract, under about 3,000万円) rises much more for a good season: 'lowness' is 1 at 700万円 and 0 from 3,000万円
  // (examples, all 推定: a high-school batter with 800万円 got 4,500万円 after a 143-game, 36-homer season; a starter with 650万円 got
  // 2,600万円 after 9 wins at 2.76; a regular with 1,200万円 got 8,000万円 after .309 and 33 homers. Three players only: an assumption)
  const lowness = clamp(Math.log(3000 / Math.max(prev, IKUSEI_MIN_SALARY)) / Math.log(3000 / 700), 0, 1)
  if (firstTeam && value > 0) {
    const base = 0.85 * value - 0.2
    const boost = base > 0 ? 0.8 * lowness * Math.max(0, value - 0.5) : 0
    m = Math.exp(clamp(base + boost, -0.3, 1 + 0.8 * lowness))
  } else m = age <= 24 ? 0.97 : age <= 28 ? 0.9 : 0.82
  if (injured) m *= 0.9
  m *= Math.exp(0.06 * noise)
  // the higher the pay already is, the smaller a raise in proportion (a star's pay grows slower above 1億円), and no club pays more
  // than about 6.5億円 (assumption near the top NPB contracts)
  if (m > 1) m = 1 + (m - 1) * clamp(1 - Math.log(Math.max(1, prev / 1000)) / Math.log(70), 0.12, 1)
  const floor = prev > 10000 ? 0.6 : 0.75
  return Math.min(NPB_MAX_SALARY, Math.max(NPB_MIN_SALARY, round10(prev * clamp(m, floor, 2.7 + 3 * lowness))))
}

/**
 * A multi-year contract (years) for a star season at a high pay, else 0. Deterministic (no draw): from 2億円 two years, from 3億円
 * three, for a season worth at least 1.2, aged 24 to 31 and not injured. Assumption: one example only (a 6億円, 3-year contract
 * of a Triple Crown winner, 2022 off-season, reported); no source for the thresholds. During it the pay does not follow the seasons.
 */
export function multiYearTerm(salary: number, value: number, age: number, injured: boolean): number {
  if (injured || value < 1.2 || age < 24 || age > 31) return 0
  return salary >= 30000 ? 3 : salary >= 20000 ? 2 : 0
}

/** a 育成 player's salary: small steps up for a good farm season, never below the minimum */
export function nextIkuseiSalary(prev: number, farmValue: number, noise: number): number {
  return Math.max(IKUSEI_MIN_SALARY, round10(prev * clamp(1 + 0.15 * farmValue + 0.03 * noise, 0.9, 1.25)))
}

/** a 育成 player promoted to 支配下 signs a new contract: a 支配下 salary, no new signing bonus (assumption) */
export function promotedSalary(prev: number, standing: number): number {
  return Math.max(NPB_MIN_SALARY, round10(prev * 1.3 + 150 * clamp(standing + 1, 0, 2)))
}

// ---------------------------------------------------------------- MLB

/**
 * MLB pay is kept in US dollars and shown in yen at a fixed game rate (not a market rate): 1 dollar = 150 yen.
 * Facts: the MLB minimum salary is $780,000 in 2026 under the 2022–26 agreement (confirmed 2026-10-23: MLB.com,
 * https://www.mlb.com/news/mlb-mlbpa-agree-to-cba; the agreement ends in December 2026, so later years are not known);
 * the 2025 draft's first slot was $11,075,900 (MLB.com). Everything else about MLB pay here is an estimate.
 */
export const YEN_PER_DOLLAR = 150
export const MLB_MIN_USD = 780_000
export const usdToMan = (usd: number) => Math.round((usd * YEN_PER_DOLLAR) / 10_000)

/** a year's MLB salary for a player who came from NPB (dollars): around $3M for an established NPB player, from a draw */
export function mlbSalaryUsd(standing: number, noise: number): number {
  return clamp(Math.round(3_000_000 * Math.exp(0.4 * clamp(standing, -1, 3) + 0.5 * clamp(noise, -2.5, 2.5))), MLB_MIN_USD, 35_000_000)
}

/**
 * An estimate of the MLB draft's assigned pick values (dollars) by overall pick: $11.08M for the first (2025, MLB.com), falling
 * quickly through the first round and more slowly after (pick 10 about $6.2M, the end of the first round about $2.8M, the end of the
 * tenth round about $160,000). After the tenth round a player is signed for at most about $150,000 (an estimate; the draft has 20
 * rounds since 2022). Used by the US lives' draft (countries/us/model.ts). The 2026 slots (first $11,350,600, round 10 about
 * $192,000–202,000) are reported; this curve is left at 2025's (a change of US lives' money awaits the owner's decision).
 */
export function mlbSlotUsd(overall: number): number {
  if (overall <= 0) return 0
  if (overall > 315) return 150_000 * Math.max(0.1, 1 - (overall - 315) / 400)
  const v = 11_075_900 * Math.exp(-0.058 * (overall - 1)) * (overall > 40 ? Math.exp(0.035 * (overall - 40)) : 1)
  return Math.round(Math.max(160_000, v))
}

/** what the scouts saw, in words, for the draft screen */
export function draftReason(s: LifeState, ev: { fit: number; growth: number; record: number; perf: number }): string {
  const parts: string[] = []
  if (ev.growth > 0.15) parts.push('伸びしろ')
  if (ev.record > 0.2) parts.push('実績')
  if (ev.perf > 0.08) parts.push('今季の成績')
  if (ev.fit > 0.1) parts.push(s.person.position === 'P' ? '投手としての体と能力のかみ合い' : 'ポジションへの適性')
  if (s.person.position === 'P' && (s.bb?.skills.velocity ?? 0) > 0.15) parts.push('球の速さ')
  if (s.person.position !== 'P' && (s.bb?.skills.power ?? 0) > 0.15) parts.push('長打力')
  return parts.length ? `${parts.slice(0, 3).join('・')}を評価されました` : '総合力を評価されました'
}

/** the standing that sets the round: his evaluation against the usual draftee (model value) */
export function draftStanding(total: number): number {
  // (the evaluation of the players drafted in the game has its middle near 3.7: a total of 3.7 is a fourth-round pick)
  return normCdf((total - 4.1) / 0.6)
}
