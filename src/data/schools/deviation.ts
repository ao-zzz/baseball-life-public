import univK from './deviation-univ.json' with { type: 'json' }
import univJ from './deviation-univ-j.json' with { type: 'json' }
import hsJ from './deviation-hs.json' with { type: 'json' }
import type { DeviationRow } from './types.ts'

// 偏差値 (published by exam companies and information sites; the user allowed such public values, with
// some error, 2026-10-18). One representative value per school (PROJECT_PLAN §11.11), each row with the
// exam and its basis, the year, the source and the check date. A value that cannot be confirmed is left
// out, never estimated; the game's assumed difficulty for such a school is kept apart (route/schools.ts)
// and never shown as a 偏差値.
//
// Universities: 河合塾 Kei-Net 「入試難易予想一覧表」2027年度入試 (scripts/ingest-keinet.ts): the median of
// the departments' values. Universities Kei-Net does not cover (e.g. 東京大学) take the じゅけラボ予備校
// value (scripts/ingest-jukelabo-univ.ts), a different basis, marked as such: never mixed for one school.
// High schools: じゅけラボ予備校 令和8年度 (scripts/ingest-jukelabo.ts): the median of the 普通科 courses.
// `floor`: the value is at the published floor 35.0 (「37.4以下は便宜上35.0」): the real value is lower.

export const DEVIATION_UNIV_META = univK.meta as {
  source: string
  files: string
  exam: string
  year: number
  accessed: string
  sha256: string
  rule: string
  departmentRows: number
  universities: number
  borderFree: number
  unmatchedUniversities: string[]
  ambiguousUniversities: string[]
}
export const DEVIATION_UNIV_J_META = univJ.meta as { source: string; exam: string; year: number; accessed: string; rule: string; universities: number; sourceRows: number; unmatchedCount: number }
export const DEVIATION_HS_META = hsJ.meta as { source: string; exam: string; year: number; accessed: string; rule: string; rows: number; schools: number; sourceSchools: number; unmatchedCount: number; ambiguousCount: number; tables: number }

const K: DeviationRow[] = (univK.rows as [string, number, number, number, number, number][]).map(([schoolId, value, min, max, n, nFloor]) => ({
  schoolId,
  course: `学科の中央値（${n}学科、${min}〜${max}）`,
  value,
  exam: DEVIATION_UNIV_META.exam,
  year: DEVIATION_UNIV_META.year,
  sourceId: DEVIATION_UNIV_META.source,
  accessed: DEVIATION_UNIV_META.accessed,
  ...(value <= 35 && nFloor > 0 ? { floor: true } : {}),
}))
const covered = new Set(K.map((r) => r.schoolId))
const J: DeviationRow[] = (univJ.rows as [string, number, number, number, number][])
  .filter(([id]) => !covered.has(id))
  .map(([schoolId, value, min, max, n]) => ({
    schoolId,
    course: `行の中央値（${n}行、${min}〜${max}）`,
    value,
    exam: DEVIATION_UNIV_J_META.exam,
    year: DEVIATION_UNIV_J_META.year,
    sourceId: DEVIATION_UNIV_J_META.source,
    accessed: DEVIATION_UNIV_J_META.accessed,
  }))
const HS: DeviationRow[] = (hsJ.rows as [string, number, number, number][]).map(([schoolId, value, n, futsu]) => ({
  schoolId,
  course: futsu ? `普通科の中央値（全${n}行）` : `全コースの中央値（${n}行）`,
  value,
  exam: DEVIATION_HS_META.exam,
  year: DEVIATION_HS_META.year,
  sourceId: DEVIATION_HS_META.source,
  accessed: DEVIATION_HS_META.accessed,
}))

export const DEVIATIONS: DeviationRow[] = [...K, ...J, ...HS]
