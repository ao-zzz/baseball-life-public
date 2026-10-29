import type { CountryCode } from '../../data/types.ts'
import { PREFECTURES } from '../../data/jp.ts'
import { US_STATES } from '../../data/us.ts'
import { CU_REGIONS, KR_REGIONS } from '../../data/league.ts'

// The countries a life can be born in (PROJECT_PLAN §11.30, §11.31). Japan is the original model and keeps its own code in
// life.ts; each other country lives in its own folder here and is switched on when it is done. This file knows only what the
// screens and the share link need: the name, whether it can be played, the table of places of birth, and the life table used
// for deaths. It imports nothing from life.ts, so the screens can use it without loading the engine.

/**
 * Where he lives now, as opposed to where he was born (`person.country`, which picks the model and the event catalog). Events about
 * the daily life of a place (its insurance, its holidays, its language) ask this, never the birth country, so a man who has gone to
 * another country meets that country's events and not his birthplace's (PROJECT_PLAN §11.35). `LifeState.residence` when set (see
 * `setResidence`); a life saved before it was stored and found in phase 'abroad' (a Japanese in the MLB) is read as living in the US;
 * otherwise the country of birth.
 */
export function residenceOf(s: { residence?: CountryCode; person: { country: CountryCode }; career: { phase: string } }): CountryCode {
  if (s.residence) return s.residence
  if (s.career.phase === 'abroad' && s.person.country === 'JP') return 'US'
  return s.person.country
}
/**
 * He moves to a country (or back): the residence is stored only when it differs from the country of his birth, so a life that never
 * leaves it has none, as before. Called where the model really moves him: a Japanese signing with an MLB club (life.ts jp.mlb)
 * and coming back to NPB (abroadYear). Retiring changes nothing: there is no rule that sends a retired man home or away, and where
 * the model has no ground for a move it does not set one (PROJECT_PLAN §11.38).
 */
export function setResidence(s: { residence?: CountryCode; person: { country: CountryCode } }, country: CountryCode): void {
  if (country === s.person.country) delete s.residence
  else s.residence = country
}
export const livesIn =(s: Parameters<typeof residenceOf>[0], c: CountryCode): boolean => residenceOf(s) === c
/** living in a country other than the one he was born in */
export const livesAbroad = (s: Parameters<typeof residenceOf>[0]): boolean => residenceOf(s) !== s.person.country

export interface CountryInfo {
  code: CountryCode
  /** the name shown in the choice of the country */
  label: string
  /** can be chosen at the start (the others show 「準備中」) */
  implemented: boolean
  /** a country other than Japan that can be played is a beta (PROJECT_PLAN §11.46): its name is shown with 「（ベータ版）」 in the choice */
  beta: boolean
  /** the names of the places of birth (index = LifeConfig.prefecture) */
  regions: string[]
  /** what a place of birth is called */
  regionLabel: string
  /** the statistic (stats.ts) of the mean age at death of the men alive at 10, which sets the death rate */
  lifeStatId: string
  /** the statistic of the life expectancy at birth, shown on the birth certificate */
  lifeBirthStatId: string
  /** the name on the title of the share card and the header (Japan's 「12万分の1」 is Japan's own number: PROJECT_PLAN §11.30-9) */
  brand: string
}

export const COUNTRY_INFO: Record<CountryCode, CountryInfo> = {
  JP: { code: 'JP', label: '日本', implemented: true, beta: false, regions: PREFECTURES.map((p) => p.name), regionLabel: '都道府県', lifeStatId: 'jpLifeMaleAt10', lifeBirthStatId: 'jpLifeMale', brand: '12万分の1' },
  US: { code: 'US', label: 'アメリカ', implemented: true, beta: true, regions: US_STATES.map((s) => s.name), regionLabel: '州', lifeStatId: 'usLifeMaleAt10', lifeBirthStatId: 'usLifeMale', brand: '野球人生' },
  KR: { code: 'KR', label: '韓国', implemented: true, beta: true, regions: KR_REGIONS.map((r) => r.name), regionLabel: '地域', lifeStatId: 'krLifeMaleAt10', lifeBirthStatId: 'krLifeMale', brand: '野球人生' },
  TW: { code: 'TW', label: '台湾', implemented: false, beta: true, regions: [], regionLabel: '地域', lifeStatId: 'jpLifeMaleAt10', lifeBirthStatId: 'jpLifeMale', brand: '野球人生' },
  DO: { code: 'DO', label: 'ドミニカ共和国', implemented: false, beta: true, regions: [], regionLabel: '地域', lifeStatId: 'jpLifeMaleAt10', lifeBirthStatId: 'jpLifeMale', brand: '野球人生' },
  CU: { code: 'CU', label: 'キューバ', implemented: true, beta: true, regions: CU_REGIONS.map((r) => r.name), regionLabel: '州', lifeStatId: 'cuLifeMaleAt10', lifeBirthStatId: 'cuLifeMale', brand: '野球人生' },
  VE: { code: 'VE', label: 'ベネズエラ', implemented: false, beta: true, regions: [], regionLabel: '地域', lifeStatId: 'jpLifeMaleAt10', lifeBirthStatId: 'jpLifeMale', brand: '野球人生' },
  MX: { code: 'MX', label: 'メキシコ', implemented: false, beta: true, regions: [], regionLabel: '地域', lifeStatId: 'jpLifeMaleAt10', lifeBirthStatId: 'jpLifeMale', brand: '野球人生' },
}

/** the three-letter code on the registration card (the 2nd line of the card is a decoration) */
export const ISO3: Record<CountryCode, string> = { JP: 'JPN', US: 'USA', KR: 'KOR', TW: 'TWN', DO: 'DOM', CU: 'CUB', VE: 'VEN', MX: 'MEX' }

/** the order of the choice of the country: Japan first, then in the order they will be made (PROJECT_PLAN §11.30) */
export const COUNTRY_ORDER: CountryCode[] = ['JP', 'US', 'KR', 'CU', 'DO', 'VE', 'TW', 'MX']

/** the name in the choice of the country: every country but Japan carries the beta mark (PROJECT_PLAN §11.46) */
export const countryTitle = (c: CountryCode): string => COUNTRY_INFO[c].label + (COUNTRY_INFO[c].beta ? '（ベータ版）' : '')

export const isCountryCode = (x: string): x is CountryCode => x in COUNTRY_INFO

/** a life's country (a life saved before the other countries has none: it is Japan's) */
export const countryOf = (s: { person?: { country?: CountryCode } }): CountryCode => s.person?.country ?? 'JP'
