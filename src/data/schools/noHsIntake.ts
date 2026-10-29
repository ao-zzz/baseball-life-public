// High schools that take no new students at the high-school stage (PROJECT_PLAN §11.62): their students all come from the school's own
// junior high (完全中高一貫), so they are never a choice at the high-school entrance. The MEXT school list (mext.json) has no field for
// this, so each school is listed here with its source; a school not listed is offered as before (no rule guessed from names).
//
// 都立の併設型中高一貫教育校 (Tokyo): 富士・武蔵 from the entrants of 令和3年度 (2021), 両国・大泉 from 令和4年度 (2022), 白鷗 from
// 令和5年度 (2023) stopped the high-school-stage intake. Source: 東京都教育委員会の資料
// https://www.kyoiku.metro.tokyo.lg.jp/documents/d/kyoiku/doc_13 (read 2026-10-20 through the search engine's excerpt of it; the PDF
// itself could not be opened here — check it before adding to this list). Schools of other prefectures and private schools are not
// checked yet.

export interface NoHsIntake {
  /** the MEXT school code (mext.json `c`) */
  id: string
  name: string
  /** the first school year (April) without a high-school-stage intake */
  since: number
}

export const NO_HS_INTAKE_SOURCE = 'https://www.kyoiku.metro.tokyo.lg.jp/documents/d/kyoiku/doc_13'

export const NO_HS_INTAKE: NoHsIntake[] = [
  { id: 'D113299903020', name: '東京都立富士高等学校', since: 2021 },
  { id: 'D113299909015', name: '東京都立武蔵高等学校', since: 2021 },
  { id: 'D113299906018', name: '東京都立両国高等学校', since: 2022 },
  { id: 'D113299903100', name: '東京都立大泉高等学校', since: 2022 },
  { id: 'D113299905019', name: '東京都立白鴎高等学校', since: 2023 },
]

export const NO_HS_INTAKE_IDS: ReadonlySet<string> = new Set(NO_HS_INTAKE.map((x) => x.id))
