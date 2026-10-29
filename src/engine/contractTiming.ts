import type { LifeState } from './types.ts'
import { faStatus, FA_AFTER_USE } from './freeAgent.ts'
import { US_FA_YEARS } from './countries/us/model.ts'
import { KR_FA_HS, KR_FA_UNIV } from './countries/league/profile.ts'

// How near free agency a player is (PROJECT_PLAN §11.51), for WHEN a multi-year contract is talked about: mostly in the last year before
// the right is earned, in the year before that only for an exceptional season, never earlier. Each league keeps its own rule:
//  - Japan: the domestic right after 8 seasons (7 from a university or a company team), the overseas one after 9 (freeAgent.ts, NPB's
//    own page); the seasons are the game's stand-in for 145 registered days.
//  - the US (and a Cuban in the US flow): free agency after 6 years of service (usFreeAgencyYears). Arbitration (after 3) is a
//    different right and is NOT free agency: it never counts as "near the end".
//  - Korea: 9 seasons, 8 for a player from a university (reported for 2011–2015; 2026's rules not checked: an assumption here).
//  - Cuba's domestic league has no free agency in the game's model: undefined (the old rules stay).

/** the seasons still needed for free agency in the player's league: 0 when he has the right, undefined where the model has none */
export function faYearsLeft(s: LifeState): number | undefined {
  const c = s.person.country
  if (s.flags?.['cu.mlb'] !== undefined || c === 'US') return Math.max(0, US_FA_YEARS - s.career.proSeasons)
  if (c === 'KR') {
    const need = s.career.draftedFrom === 'KR-univ' ? KR_FA_UNIV : KR_FA_HS
    return Math.max(0, need - s.career.proSeasons)
  }
  if (c === 'JP') {
    const st = faStatus(s)
    if (st.domestic) return 0
    // (the domestic right is used once; after it the overseas right needs 4 more seasons: freeAgent.ts)
    const used = s.flags?.['fa.seasons']
    return Math.max(0, used === undefined ? st.need - st.seasons : used + FA_AFTER_USE - st.seasons)
  }
  return undefined
}

/**
 * The weight of a multi-year talk this year (1 = as it was): 1 in the last year before free agency or without a model of it, a fraction
 * a year earlier (an exceptional season only, which the caller's own `value` stands for), 0 earlier than that.
 */
export function multiYearWeight(s: LifeState): number {
  const left = faYearsLeft(s)
  if (left === undefined || left <= 1) return 1
  return left === 2 ? 0.15 : 0
}

/** may a multi-year contract be signed now: the last year before the right, or the year before it for an exceptional season (value ≥ 1.8) */
export function multiYearAllowed(s: LifeState, value: number): boolean {
  const left = faYearsLeft(s)
  return left === undefined || left <= 1 || (left === 2 && value >= 1.8)
}
