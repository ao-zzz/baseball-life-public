import { clamp } from '../../math.ts'
import { MLB_MIN_USD, mlbSalaryUsd, mlbSlotUsd } from '../../contract.ts'
import { statValue } from '../../../data/stats.ts'
import { ARB_SHARE_OF_MARKET, DRAFT_CLUBS, DRAFT_ROUND_CURVE, MINOR_PAY_USD, MINOR_RAISE, MLB_Z, PRE_ARB_STEP } from './settings.ts'

// Draft, contracts and pay of the US model (PROJECT_PLAN §11.31). Pure functions of their arguments, no draw: the uniform
// numbers come from the caller's stream. Facts (stats.ts, MLB's pages, 2026-10-19): the draft has 20 rounds (2022–26 agreement);
// arbitration after 3 years of service and free agency after 6; the first slot of the 2025 draft was $11,075,900 and the league
// minimum of 2026 is $780,000 (reported). The rest — the order of the picks, the bonus after the tenth round, the minors' pay,
// the pay of arbitration years and of free agents — is a game assumption (`usModel`).

export const US_DRAFT_ROUNDS = statValue('usDraftRounds')
export const US_ARB_YEARS = statValue('usArbitrationYears')
export const US_FA_YEARS = statValue('usFreeAgencyYears')

export interface UsPick {
  round: number
  overall: number
  bonusUsd: number
}

/**
 * Where a drafted player goes: from his standing among draftees (0–1, 1 = the best), a round from 1 to 20 (the better he is,
 * the earlier; a spread of a few rounds either way from `u1`), the place in the round from `u2`, and the bonus: the pick's
 * assigned value for the early picks (the estimate in contract.ts), at most about $150,000 after the tenth round.
 */
export function usDraftPick(standing: number, u1: number, u2: number): UsPick {
  const base = 1 + (US_DRAFT_ROUNDS - 1) * Math.pow(1 - clamp(standing, 0, 1), DRAFT_ROUND_CURVE)
  const round = clamp(Math.round(base + (u1 - 0.5) * 3), 1, US_DRAFT_ROUNDS)
  const overall = (round - 1) * DRAFT_CLUBS + 1 + Math.floor(u2 * DRAFT_CLUBS)
  return { round, overall, bonusUsd: Math.round(mlbSlotUsd(overall)) }
}

/**
 * yearly pay in the minors (dollars): the level's least pay (settings.ts MINOR_PAY_USD) plus a raise for a good standing and for the
 * seasons already played in the minors, at most 50% over the least; never below it (whole dollars; game values, no draw).
 */
export function usMinorPay(level: number, standing = 0, seasons = 0): number {
  const min = MINOR_PAY_USD[clamp(level, 0, MINOR_PAY_USD.length - 1)]
  const raise = clamp(MINOR_RAISE.perStanding * Math.max(0, standing) + MINOR_RAISE.perSeason * Math.max(0, seasons), 0, MINOR_RAISE.max)
  return Math.round(min * (1 + raise))
}

/**
 * Yearly pay in the majors (dollars) from the years of service so far (`service`), last year's pay, his standing among
 * the players of the majors and a draw `noise` (the caller's own stream): near the league minimum before arbitration, a share
 * of the market for the arbitration years (never less than 10% above last year's), the market as a free agent (a fall of
 * at most 40% from last year's pay).
 */
export function usMlbPay(service: number, prevUsd: number, standing: number, noise: number): number {
  if (service < US_ARB_YEARS) return Math.round(MLB_MIN_USD * (1 + PRE_ARB_STEP * service))
  const market = mlbSalaryUsd(standing, noise)
  if (service < US_FA_YEARS) return Math.min(35_000_000, Math.max(Math.round(prevUsd * 1.1), Math.round(market * ARB_SHARE_OF_MARKET)))
  return Math.min(35_000_000, Math.max(Math.round(prevUsd * 0.6), market))
}

/** his standing among the players of the majors, in the units of mlbSalaryUsd (from the mean and spread of their ability: settings.ts) */
export function usStanding(z: number): number {
  return (z - MLB_Z.mean) / MLB_Z.sd
}
