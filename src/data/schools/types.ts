// Schools (PROJECT_PLAN §11.11). Each kind of fact is its own table, each row with a source, a check date
// and a target year: the school list (文部科学省), the baseball club (有無), admission methods, 偏差値.
// A value that has not been confirmed is absent (never filled in): coverage says how much is there.

export type SchoolKind = 'hs' | 'univ' | 'jc' | 'kosen'

export interface School {
  /** 学校コード */
  id: string
  kind: SchoolKind
  name: string
  /** 都道府県 (as written by 文部科学省, e.g. 「北海道」「東京都」) */
  pref: string
  /** 市区町村 */
  muni: string
  owner: 'national' | 'public' | 'private'
  branch: 'main' | 'branch'
}

/**
 * Who can enrol, as far as the name tells: 'girls' (名称に女子・女学院など。男子は入学できない前提で、
 * 選ばれない) or 'boys' (名称に男子) or 'unconfirmed' (名称からは判断できない。共学とは確認していない)
 */
export type GenderStatus = 'girls' | 'boys' | 'unconfirmed'

/** baseball club of a school (a separate table: a school can exist without the fact being known) */
export interface BaseballClubRow {
  schoolId: string
  /** 硬式／軟式／野球部なし */
  status: 'hard' | 'soft' | 'none'
  /** the year the club was confirmed */
  year: number
  sourceId: string
  accessed: string
}

export type EntryMethod = 'general' | 'recommend' | 'sports' | 'ao'

/** whether a university has an admission method (from its 募集要項 or another published source) */
export interface EntryMethodRow {
  schoolId: string
  method: EntryMethod
  available: boolean
  /** 入試の年度 */
  year: number
  sourceId: string
  accessed: string
}

/** 偏差値: per school and department, with the exam and its basis */
export interface DeviationRow {
  schoolId: string
  /** 学部・学科・コース */
  course: string
  value: number
  /** 模試の主体と基準（例: 河合塾 全統模試・合格可能性50%のボーダー） */
  exam: string
  /** 対象年度 */
  year: number
  sourceId: string
  accessed: string
  /** at the published floor (「37.4以下は便宜上35.0」): the real value is lower */
  floor?: boolean
}
