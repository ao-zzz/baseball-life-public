import type { LifeState, StatLine } from './types.ts'
import { proType } from './careerSeason.ts'
import { NPB_MAX_SALARY } from './contract.ts'
import { clamp } from './math.ts'

// Free agency (PROJECT_PLAN §11.28): who may declare, and the terms offered. Pure and deterministic: no draw is made here (the offers
// take their team picks and their spread from the caller's own stream, never the calibrated one).
//
// Facts (NPB, 「フリーエージェントについて」 npb.jp/announcement/2019/fa_about.html; the players' association's pages agree):
//  - a season counts when the player is on the first-team roster for 145 days or more of the league's season; fewer days of several
//    seasons are added up, and 145 days is the most one season adds;
//  - 国内FA after 8 such seasons (7 for a player who entered by the draft from a university or a company team, drafts of 2007 and after);
//  - 海外FA after 9 seasons, unless the domestic right was used before; one who used the domestic right and signed with an NPB club gets
//    the overseas right after 4 more seasons;
//  - the player says whether he uses the right within 7 days (not counting weekends and holidays) after the Japan Series; from the day
//    after the public notice any club, the old one included, may negotiate the next year's contract.
// Assumptions of the game (the roster days are not modelled): a season of the record counts by the first-team games played (a batter
// 60 games, a reliever 40, a starter 150 outs, as the share of one season), added up the same way; the repeated right after using it is not
// modelled (only the overseas one); compensation and the 10-year-player rules are not modelled.

export const FA_DOMESTIC_HIGH_SCHOOL = 8
export const FA_DOMESTIC_UNIVERSITY = 7
export const FA_OVERSEAS = 9
export const FA_AFTER_USE = 4

/** how much of a first-team season one line is worth (0 to 1): the game's stand-in for 145 registered days (an assumption) */
export function seasonShare(line: StatLine, kind: 'batter' | 'starter' | 'reliever'): number {
  const used = kind === 'batter' ? line.games / 60 : kind === 'reliever' ? line.games / 40 : line.outs / 150
  return clamp(used, 0, 1)
}

/**
 * The days on the first-team roster in a season, for the minimum guarantee (contract.ts firstTeamExtra): the model keeps no roster days,
 * so the same stand-in as free agency's, the share of a first-team season, counts a full share as 150 days (a season on the roster is
 * longer than that). An assumption of the game.
 */
export function registeredDays(line: StatLine, kind: 'batter' | 'starter' | 'reliever'): number {
  return Math.round(seasonShare(line, kind) * 150)
}

/** the seasons counted toward free agency, up to and including this year (the pro seasons of the record, added up like the days) */
export function faSeasons(s: LifeState): number {
  const kind = proType(s)
  const rows = (s.bb?.rec?.tournaments ?? []).filter((t) => t.level === 'pro' && t.age <= s.age)
  return Math.floor(rows.reduce((a, t) => a + seasonShare(t.line, kind), 0) + 1e-9)
}

export interface FaStatus {
  seasons: number
  /** seasons needed for the domestic right (7 from a university or a company team, 8 from high school) */
  need: number
  domestic: boolean
  overseas: boolean
}

export function faStatus(s: LifeState): FaStatus {
  const seasons = faSeasons(s)
  const need = s.career.draftedFrom === '高校' ? FA_DOMESTIC_HIGH_SCHOOL : FA_DOMESTIC_UNIVERSITY
  const used = s.flags?.['fa.seasons']
  const overseas = used === undefined ? seasons >= FA_OVERSEAS : seasons - used >= FA_AFTER_USE
  // (the domestic right is used once here: a second one after using it is not modelled)
  return { seasons, need, domestic: used === undefined && seasons >= need, overseas }
}

/** a multi-year contract in force for next season: no free agency while it runs (the right is for the year it ends) */
export function contractRuns(s: LifeState): boolean {
  const c = s.career.contract
  return !!c && c.untilAge > s.age && c.team === s.career.team
}

export interface FaOffer {
  /** the club (NPB organisation id) */
  orgId: string
  years: number
  /** 万円 a year */
  salary: number
  /** a promise of first-team play (very rare: a record and a line of text; it moves nothing in the model) */
  guarantee: boolean
  /** this is the club he belongs to */
  stay: boolean
}

const round10 = (n: number) => Math.round(n / 10) * 10

/** the old club's offer: a little above what the usual renewal would give, for 3, 2 or 1 years by age (assumptions) */
export function stayTerms(base: number, age: number): { years: number; salary: number } {
  return { years: age <= 29 ? 3 : age <= 33 ? 2 : 1, salary: Math.min(NPB_MAX_SALARY, round10(base * 1.05)) }
}

/** how many other clubs make an offer, from the season's worth (0 when there is little to offer); an assumption */
export function suitorCount(value: number, hurt: boolean): number {
  const n = value >= 1.2 ? 3 : value >= 0.7 ? 2 : value >= 0.3 ? 1 : 0
  return hurt ? Math.max(0, n - 1) : n
}

/** one other club's terms: a spread over what the usual renewal gives; `u` are three uniform numbers in [0,1) from the caller's own stream */
export function suitorTerms(base: number, age: number, hurt: boolean, u: [number, number, number]): { years: number; salary: number; guarantee: boolean } {
  const maxYears = age <= 29 ? 4 : age <= 33 ? 3 : 2
  return {
    years: 1 + Math.floor(u[1] * maxYears),
    salary: Math.min(NPB_MAX_SALARY, round10(base * (1.0 + 0.4 * u[0]))),
    // (the promise is for a healthy player, and very rare: 3%; an assumption)
    guarantee: !hurt && u[2] < 0.03,
  }
}
