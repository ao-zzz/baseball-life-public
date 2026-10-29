// Statistical parameters and their provenance (PROJECT_PLAN §6.1).

export type StatKind = 'measured' | 'estimate' | 'assumption'
/** population = general demographic statistics; baseball = baseball-specific; model = output of this model */
export type StatDomain = 'population' | 'baseball' | 'model'
/**
 * male     = the source states that the figures are for males
 * all      = the source states that the figures cover both sexes
 * unstated = the population is stated (e.g. NPB players, 高野連 club members) but the source gives no sex
 *            breakdown; may be used as a reference value for the male career model, never shown as a
 *            confirmed male figure (2026-10-17 decision)
 * unknown  = who is counted is not clear enough; stays 未確認
 */
export type StatSex = 'male' | 'all' | 'unstated' | 'unknown'
export type SourceType = 'primary' | 'secondary' | 'none'

export interface Source {
  id: string
  title: string
  publisher: string
  url?: string
  /** date the source was opened and checked (YYYY-MM-DD); null = not recorded */
  accessed: string | null
  /** what the check confirmed, and what it could not */
  checkNote?: string
}

export interface Stat {
  id: string
  value: number
  unit: string
  kind: StatKind
  domain: StatDomain
  sex: StatSex
  /** who is counted */
  population: string
  /** what is counted and how */
  definition: string
  /** time the data refers to */
  asOf: string
  sourceIds: string[]
  sourceType: SourceType
  /**
   * true = the value, its source, or who is counted is not confirmed: shown as 「未確認」.
   * A missing sex breakdown alone is recorded in `sex: 'unstated'` (shown as 「参考値」), not here.
   */
  unverified: boolean
  /** why the value is (or is not) confirmed; shown with the 「未確認」 label */
  verifyNote?: string
  note?: string
}

export type CountryCode = 'JP' | 'US' | 'KR' | 'TW' | 'DO' | 'CU' | 'VE' | 'MX'

/** A real-world organisation that may be shown by name only when it meets the inclusion rules (§2.1-7). */
export interface Org {
  id: string
  type: 'federation' | 'tournament' | 'school' | 'university' | 'company' | 'independent' | 'pro'
  country: CountryCode
  /** real name; shown only when `verified` is true */
  realName?: string
  /** blurred / generic label used whenever the real name may not be shown */
  generic: string
  /** league name (shown only when verified) */
  league?: string
  verified: boolean
  sourceIds: string[]
  accessed: string | null
  validFrom?: number
  validTo?: number
}
