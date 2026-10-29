import type { CountryCode } from '../../../data/types.ts'
import { CU_FAMILY_NAMES, CU_GIVEN_NAMES, CU_PARTNER_NAMES, CU_REGIONS, KR_FAMILY_NAMES, KR_GIVEN_NAMES, KR_PARTNER_NAMES, KR_REGIONS, type LeagueRegion } from '../../../data/league.ts'
import type { LifeWords } from '../us/year.ts'

// The countries played through the league flow (Korea and Cuba; PROJECT_PLAN §11.46). One profile holds everything a country adds to the
// shared engine: the names, the places of birth, the chances of each step, the pay, the household (after.ts HOUSEHOLDS), the words. EVERY
// NUMBER HERE IS A GAME ASSUMPTION, a rough estimate made from general knowledge, not an official statistic and not a figure of a real
// rule (stats krModel, cuModel); the political and economic conditions of a country are the game's own model and are never stated as facts.
// To add a country: see 「新規国モード追加ガイド」 in PROJECT_PLAN §11.46.

export type LeagueCode = Extract<CountryCode, 'KR' | 'CU'>

/** the chance of passing a step is Φ(α + b·z + context), where α is set so that the rate is `target` for a player of average ability (as the US checks) */
export interface LeagueCheck {
  b: number
  /** the rate for z ~ N(0,1) and no context */
  target: number
}

export interface LeagueProfile {
  cc: LeagueCode
  /** how the road to the pros goes: through a draft (Korea), or through selection by the state's sports schools and teams (Cuba) */
  kind: 'draft' | 'state'
  regions: LeagueRegion[]
  family: string[]
  given: string[]
  partners: string[]
  /** English-style order (given name first) */
  givenFirst: boolean
  words: LifeWords
  /** the death rate's own correction on top of the Japanese-calibrated scale (1 = none; an assumption) */
  mortalityExtra: number
  checks: Record<string, LeagueCheck>
  /** names of the stages for the screens and the log */
  names: {
    youth: string
    middle: string
    middleClub: string
    high: string
    highStrong: string
    univ: string
    minor: string
    first: string
    league: string
  }
  /** pay (万円 a year): the farm team, the first team's minimum and cap, the growth with each year and with ability */
  pay: { minor: number; min: number; cap: number; perYear: number; perStanding: number }
  /** the years of service for free agency (an assumption) */
  faYears: number
  /** the stage names of the pro, for the season lines (careerSeason) */
  labels: { first: string; farm: string }
  /** a team's games in a season at the two levels (careerSeason seasonGames; not Japan's) */
  games: { first: number; farm: number }
}

const check = (b: number, target: number): LeagueCheck => ({ b, target })

/**
 * the KBO's seasons for free agency: 8 for a player from high school, 7 from a four-year university (confirmed 2026-10-23: OSEN,
 * https://osen.co.kr/article/G1112487350; a season counts with 145 days or more on the first team's register, which the game takes
 * as any season played in the first team: a simplification)
 */
export const KR_FA_HS = 8
export const KR_FA_UNIV = 7

/**
 * The KBO's pay, in the model's 万円 at 1 won = 0.11 yen (the screens' fixed rate for Korean: i18n/currency.ts).
 * CONFIRMED (2026-10-23): the minimum salary is ₩30 million for every player, rookies included, in 2025 and 2026 (₩33 million from
 * 2027): Herald, https://www.heraldk.com/article/2026012818054212726. The average of 2026 is ₩175.36 million (529 players; rookies,
 * foreign and Asia-quota players excluded): KBO, https://www.koreabaseball.com/MediaNews/Notice/View.aspx?bdSe=11861.
 * ESTIMATE: the growth with standing and years (perStanding 0.65, perYear 0.15) and the cap are the game's, set so that the first
 * team's average is near that figure: measured 2026-10-23 on the first-team seasons of 6,000 Korean lives (641 seasons), mean
 * 2,128万円 (≈ ₩193 million; real ₩175 million, +10%), median 953万円 (the old 0.5 and 0.1 gave a mean of 988万円, half the real one).
 */
const KR_MIN_PAY = 330

/**
 * A team's games in a season. CONFIRMED (2026-10-23): KBO 144 (2025 and 2026: https://newsseoul.co.kr/news/view/1065598825460638),
 * the Futures League 118 in 2025 and 121 in 2026 (https://osen.co.kr/article/G1112744851): 120 taken. Cuba's Serie Nacional 75 in the
 * 62nd–64th series (2023–2026; https://en.wikipedia.org/wiki/2025%E2%80%9326_Cuban_National_Series); the 65th (2026–27) is reported
 * with 44 in a new format by one secondary source only, so 75 is kept. ESTIMATE: a Cuban provincial reserve's games (no data): Japan's
 * 2軍's share of the season, 58.
 */
const KR_GAMES = { first: 144, farm: 120 }
const CU_GAMES = { first: 75, farm: 58 }

export const KR_PROFILE: LeagueProfile = {
  cc: 'KR',
  kind: 'draft',
  regions: KR_REGIONS,
  family: KR_FAMILY_NAMES,
  given: KR_GIVEN_NAMES,
  partners: KR_PARTNER_NAMES,
  givenFirst: false,
  words: { partners: KR_PARTNER_NAMES, spouses: KR_PARTNER_NAMES, middle: '中学校に入学しました。', high: '高校に進学しました。', college: '大学に進学することにしました。' },
  mortalityExtra: 1,
  checks: {
    mid: check(0.6, 0.5),
    hs: check(0.8, 0.5),
    hsStay: check(0.3, 0.96),
    hsDraft: check(1.6, 0.012),
    hsSign: check(0.4, 0.9),
    hsUniv: check(0.9, 0.3),
    univStay: check(0.3, 0.96),
    univDraft: check(1.4, 0.05),
    univSign: check(0.4, 0.9),
    minorExit: check(-0.8, 0.14),
    debut: check(1.2, 0.3),
    firstExit: check(-0.9, 0.1),
  },
  names: { youth: '少年野球', middle: '中学野球', middleClub: '中学の野球部', high: '高校の野球部', highStrong: '野球の名門高校', univ: '大学野球', minor: 'KBO球団の2軍', first: 'KBO球団（1軍）', league: 'KBO' },
  // (the pay: the real minimum for both levels, KR_MIN_PAY; the rest an estimate, see there)
  pay: { minor: KR_MIN_PAY, min: KR_MIN_PAY, cap: 25000, perYear: 0.15, perStanding: 0.65 },
  faYears: KR_FA_HS,
  labels: { first: '1軍', farm: '2軍' },
  games: KR_GAMES,
}

export const CU_PROFILE: LeagueProfile = {
  cc: 'CU',
  kind: 'state',
  regions: CU_REGIONS,
  family: CU_FAMILY_NAMES,
  given: CU_GIVEN_NAMES,
  partners: CU_PARTNER_NAMES,
  givenFirst: true,
  words: { partners: CU_PARTNER_NAMES, spouses: CU_PARTNER_NAMES, middle: '中等学校に入学しました。', high: '高等学校に進学しました。', college: '大学に進学することにしました。' },
  mortalityExtra: 1,
  checks: {
    mid: check(0.6, 0.65),
    eide: check(0.9, 0.12),
    hs: check(0.8, 0.5),
    hsStay: check(0.3, 0.95),
    serie: check(1.5, 0.02),
    serieExit: check(-0.8, 0.1),
    leaveOffer: check(1.1, 0.07),
    leaveGo: check(0.6, 0.5),
  },
  names: { youth: '少年野球', middle: '地域の少年チーム', middleClub: 'スポーツ学校（EIDE）', high: '州のジュニアチーム', highStrong: 'スポーツ学校（EIDE）のジュニアチーム', univ: '大学', minor: 'セリエ・ナシオナル（州チームの控え）', first: 'セリエ・ナシオナル（州チーム）', league: 'セリエ・ナシオナル' },
  // (a domestic player's pay is small on the scale of the model: a wage of 0.2 of Japan's table, after.ts HOUSEHOLDS; a player abroad is paid in dollars)
  pay: { minor: 50, min: 70, cap: 420, perYear: 0.02, perStanding: 0.45 },
  faYears: 99,
  labels: { first: 'セリエ・ナシオナル', farm: '州の控え' },
  games: CU_GAMES,
}

export const LEAGUE_PROFILES: Record<LeagueCode, LeagueProfile> = { KR: KR_PROFILE, CU: CU_PROFILE }

export function leagueProfile(c: CountryCode | undefined): LeagueProfile | undefined {
  return c === 'KR' || c === 'CU' ? LEAGUE_PROFILES[c] : undefined
}
