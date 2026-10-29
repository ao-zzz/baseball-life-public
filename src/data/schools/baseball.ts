import type { BaseballClubRow } from './types.ts'

// Baseball clubs of schools (有無・硬式／軟式・年度・出典). Starts empty: 日本高野連 gives only counts by
// prefecture (jhbfPref2026), so school-level rows come from each prefecture's federation or another
// published list, row by row, with source and check date. See `clubCoverageByPref`.
export const BASEBALL_CLUBS: BaseballClubRow[] = []
