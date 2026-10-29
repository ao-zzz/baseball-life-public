// Settings of the US model (PROJECT_PLAN §11.31). Every number here is a game assumption unless a comment says it was confirmed
// in a source; none of the shares or pay below is a statistic. They are kept apart from the code so that they can be replaced
// when a source is found.

/** the kinds of college team he can play for (the school's name is real only for the NCAA Division I list: data/usColleges.ts) */
export type CollegeKey = 'd1' | 'd2' | 'd3' | 'juco'

export interface CollegeLevel {
  key: CollegeKey
  /** shown in the choice and on the team */
  label: string
  /** years in the team before the next step (a junior college is two) */
  years: number
  /** share of the players who go on to college baseball, before ability tilts it (assumption) */
  share: number
  /** how much a high ability tilts the weight towards this level (assumption) */
  tilt: number
  /** the level of the team against an average Japanese university team, the scale of the team rating (assumption; D1 comes from the conference) */
  rating: number
  /** added to the draft check of a player of this level (assumption) */
  draftCtx: number
  /** chance to be taken as a function of his total evaluation (assumption): base + slope × (total − 3.5) */
  admit: { base: number; slope: number }
}

export const COLLEGE_LEVELS: Record<CollegeKey, CollegeLevel> = {
  d1: { key: 'd1', label: 'NCAA 1部', years: 4, share: 0.25, tilt: 1.0, rating: 0, draftCtx: 0.8, admit: { base: 0.3, slope: 0.35 } },
  d2: { key: 'd2', label: 'NCAA 2部', years: 4, share: 0.2, tilt: 0.3, rating: -0.15, draftCtx: 0.1, admit: { base: 0.5, slope: 0.35 } },
  d3: { key: 'd3', label: 'NCAA 3部', years: 4, share: 0.3, tilt: -0.2, rating: -0.4, draftCtx: -0.5, admit: { base: 0.7, slope: 0.3 } },
  // a junior college takes anyone who applies (assumption: open enrolment)
  juco: { key: 'juco', label: '短大（ジュニアカレッジ）', years: 2, share: 0.25, tilt: -0.5, rating: -0.3, draftCtx: 0, admit: { base: 1, slope: 0 } },
}

export const COLLEGE_ORDER: CollegeKey[] = ['d1', 'd2', 'd3', 'juco']

/** the chance that a team of this level takes him */
export function admitP(level: CollegeKey, total: number): number {
  const a = COLLEGE_LEVELS[level].admit
  return Math.min(1, Math.max(0.03, a.base + a.slope * (total - 3.5)))
}

/** a state's share of the college-bound players by level, tilted by ability (assumption): the level he would go to without choosing */
export function levelWeights(z: number): Record<CollegeKey, number> {
  const out = {} as Record<CollegeKey, number>
  for (const k of COLLEGE_ORDER) out[k] = COLLEGE_LEVELS[k].share * Math.exp(COLLEGE_LEVELS[k].tilt * z)
  return out
}

/**
 * The minor leagues (assumption in the game's own grouping; the affiliated levels are Triple-A, Double-A, High-A and Low-A or
 * Single-A, plus the complex and rookie leagues; MLB's own pages disagree on the name of the lowest full-season level, and the
 * game joins the A levels in one).
 */
export const MINOR_LEVELS = ['ルーキー・コンプレックス', 'シングルA', 'ダブルA', 'トリプルA'] as const
export const TOP_MINOR = MINOR_LEVELS.length - 1

/**
 * A team's games in a minor-league season by the game's levels. CONFIRMED (2026 schedules, checked 2026-10-23): Single-A and High-A
 * 132 (https://www.milb.com/daytona/news/tortugas-unveil-2026-schedule), Double-A 138, Triple-A 150
 * (https://www.milb.com/portland/news/sea-dogs-announce-2026-schedule). ESTIMATE: the rookie and complex leagues play a short summer
 * season; no schedule was checked: 56. The majors play 162 (careerSeason MLB_GAMES).
 */
export const MINOR_GAMES = [56, 132, 138, 150]

/**
 * The least yearly pay in the minors by level, in dollars: a GAME ASSUMPTION fixed on 2026-10-19 from a secondary report of the 2026
 * weekly minimums (Triple-A $36,590, Double-A $30,905, High-A $27,940, Single-A $26,840, Rookie about $18,000 a year; not an
 * official MLB or MLBPA document, and not claimed to be the real rule). The game's four levels are matched to them: the rookie and
 * complex leagues → Rookie, 'シングルA' (the game joins Low-A and High-A in one) → Single-A's minimum (High-A's $27,940 is the top of
 * what the raise below can reach there), Double-A, Triple-A. Every year's pay is at least this.
 */
export const MINOR_PAY_USD = [18_000, 26_840, 30_905, 36_590]

/** the raise over the least pay: the better the standing (z of the league's players) and the more minor seasons, the more, up to 50% (assumption) */
export const MINOR_RAISE = { perStanding: 0.1, perSeason: 0.03, max: 0.5 }

/** added to the promotion check by the level he is leaving (assumption) */
export const MINOR_UP_CTX = [0.15, 0, -0.15, -0.4]

/** added to the check of a first MLB game by the level (assumption: nobody is called up from the rookie leagues) */
export const MLB_DEBUT_CTX = [-9, -2.2, -0.6, 0.35]

/** pre-arbitration years are paid near the league minimum, a little more with each year (assumption on the step) */
export const PRE_ARB_STEP = 0.03

/** the share of a free-agent contract that an arbitration-eligible player gets (assumption) */
export const ARB_SHARE_OF_MARKET = 0.5

/** a draft pick's place: how fast the round falls with a lower standing, and the clubs in a round (assumptions; 30 clubs) */
export const DRAFT_CLUBS = 30
export const DRAFT_ROUND_CURVE = 1.4

/**
 * A correction of the death rate so that simulated US lives die on average at the life table's age (76.5 + the assumed 0.25 at 10):
 * the Japanese scale (calibration.ts) alone gave 77.8 years, 1.125 gives about 76.7 (measured over 12,000 lives each, 2026-10-19).
 */
export const US_MORTALITY_EXTRA = 1.125

/** the pool of MLB players: the mean and spread of ability z among those who reached the majors in the calibration run (scripts/calibrate-us.ts, 300,000 lives: 1.38 and 0.63; a model value) */
export const MLB_Z = { mean: 1.4, sd: 0.63 }
