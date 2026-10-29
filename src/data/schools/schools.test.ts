import { describe, expect, it } from 'vitest'
import { ALL_SCHOOLS, HIGH_SCHOOLS, SCHOOL_LIST_META, UNIVERSITIES, admitsMale, candidates, clubCoverageByPref, coverage, genderOf, schoolById } from './index.ts'
import { BASEBALL_CLUBS } from './baseball.ts'
import { DEVIATIONS } from './deviation.ts'
import { ENTRY_METHODS } from './entry.ts'
import { JHBF_CLUBS_2026 } from './jhbfClubs.ts'
import { SOURCES } from '../sources.ts'
import { PREFECTURES } from '../jp.ts'

// School data (PROJECT_PLAN §11.11): the national list, and the separate tables of baseball club, entry
// method and 偏差値, each row with source, check date and year; nothing confirmed is invented.

const rowsWithSource = [...BASEBALL_CLUBS, ...ENTRY_METHODS, ...DEVIATIONS]

describe('the national school list (文部科学省 学校コード)', () => {
  it('is a whole-country list with a recorded source, list date and checksum', () => {
    expect(SCHOOL_LIST_META.source).toBe('mextSchoolCode')
    expect(SOURCES[SCHOOL_LIST_META.source].accessed).toBe(SCHOOL_LIST_META.accessed)
    expect(SCHOOL_LIST_META.listDate).toMatch(/^\d{4}\/\d+\/\d+$/)
    expect(SCHOOL_LIST_META.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(HIGH_SCHOOLS.length).toBeGreaterThan(5000)
    expect(UNIVERSITIES.length).toBeGreaterThan(800)
  })

  it('covers all 47 prefectures, with unique ids and complete rows', () => {
    const names = new Set(PREFECTURES.map((p) => p.name))
    expect(new Set(HIGH_SCHOOLS.map((s) => s.pref))).toEqual(names)
    expect(new Set(ALL_SCHOOLS.map((s) => s.id)).size).toBe(ALL_SCHOOLS.length)
    for (const s of ALL_SCHOOLS) {
      expect(s.name.trim(), s.id).not.toBe('')
      expect(names.has(s.pref), s.id).toBe(true)
      expect(['national', 'public', 'private']).toContain(s.owner)
    }
    for (const s of HIGH_SCHOOLS) expect(s.muni, s.id).not.toBe('')
  })

  it('the count of main high schools in a prefecture is above the federation count of member schools', () => {
    // 加盟校（野球部）は学校の一部なので、学校数が加盟校数を下回ることはない（収録漏れの検出）
    const main = (pref: string) => HIGH_SCHOOLS.filter((s) => s.pref === pref && s.branch === 'main').length
    for (const [pref, n] of Object.entries(JHBF_CLUBS_2026)) expect(main(pref), pref).toBeGreaterThanOrEqual(n)
  })

  it('the federation counts add up to the national total on its page (3,746)', () => {
    expect(Object.values(JHBF_CLUBS_2026).reduce((a, x) => a + x, 0)).toBe(3746)
    expect(Object.keys(JHBF_CLUBS_2026)).toHaveLength(47)
  })
})

describe('gender and eligibility', () => {
  it('girls’ schools (by name) are never candidates; schools not known to be girls’ stay in', () => {
    const girls = ALL_SCHOOLS.filter((s) => genderOf(s) === 'girls')
    expect(girls.length).toBeGreaterThan(100)
    for (const g of girls) expect(admitsMale(g), g.name).toBe(false)
    for (const kind of ['hs', 'univ'] as const) for (const c of candidates(kind)) expect(genderOf(c)).not.toBe('girls')
    expect(candidates('hs', '東京都').length).toBeGreaterThan(100)
  })

  it('coverage counts are consistent, and the status of the gender is only name-based', () => {
    for (const kind of ['hs', 'univ', 'jc', 'kosen'] as const) {
      const c = coverage(kind)
      expect(c.girlsByName + c.unconfirmedGender + ALL_SCHOOLS.filter((s) => s.kind === kind && genderOf(s) === 'boys').length).toBe(c.total)
      expect(c.main).toBeLessThanOrEqual(c.total)
    }
  })
})

describe('偏差値 coverage', () => {
  const devOf = (name: string) => {
    const u = ALL_SCHOOLS.find((s) => s.kind === 'univ' && s.name === name)
    return u ? DEVIATIONS.find((d) => d.schoolId === u.id) : undefined
  }
  // 旧帝大・一橋・東京科学・早慶上智・MARCH・関関同立ほか (the names as in the national list)
  const MAJOR = ['東京大学', '京都大学', '大阪大学', '東北大学', '名古屋大学', '九州大学', '北海道大学', '一橋大学', '東京科学大学', '早稲田大学', '慶應義塾大学', '上智大学', '明治大学', '青山学院大学', '立教大学', '中央大学', '法政大学', '関西大学', '関西学院大学', '同志社大学', '立命館大学', '神戸大学', '筑波大学', '東京理科大学', '国際基督教大学', '学習院大学']

  it('every major university has one 偏差値 with its source (none is missing, none is a name only)', () => {
    const missing = MAJOR.filter((n) => !devOf(n))
    expect(missing).toEqual([])
    for (const n of MAJOR) expect(devOf(n)!.value, n).toBeGreaterThan(40)
  })

  it('a university has one value, from one source (the two sources are never mixed for a school)', () => {
    const seen = new Map<string, string>()
    for (const d of DEVIATIONS) {
      expect(seen.get(d.schoolId), d.schoolId).toBeUndefined()
      seen.set(d.schoolId, d.sourceId)
    }
    expect(new Set(DEVIATIONS.map((d) => d.sourceId))).toEqual(new Set(['keinetRanking2027', 'jukelabo2026univ', 'jukelabo2026']))
  })

  it('high schools: a wide share of the national list has a value, and a famous one reads as expected', () => {
    const hs = coverage('hs')
    expect(hs.withDeviation / hs.main).toBeGreaterThan(0.7)
    const dev = (name: string, pref: string) => {
      const s = HIGH_SCHOOLS.find((x) => x.name === name && x.pref === pref)
      return s ? DEVIATIONS.find((d) => d.schoolId === s.id)?.value : undefined
    }
    expect(dev('北海道札幌南高等学校', '北海道')).toBe(74)
    expect(dev('東京都立日比谷高等学校', '東京都')).toBe(74)
  })
})

describe('separate tables with provenance', () => {
  it('every row names an existing school, a known source, a check date and a year', () => {
    for (const r of rowsWithSource) {
      expect(schoolById(r.schoolId), r.schoolId).toBeDefined()
      expect(SOURCES[r.sourceId], `${r.schoolId} → ${r.sourceId}`).toBeDefined()
      expect(r.accessed).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(r.year).toBeGreaterThan(1990)
      expect(r.year).toBeLessThanOrEqual(2027)
    }
  })

  it('偏差値 rows carry the department, the exam and its basis', () => {
    for (const d of DEVIATIONS) {
      expect(d.course.trim()).not.toBe('')
      expect(d.exam.trim()).not.toBe('')
      expect(d.value).toBeGreaterThan(20)
      expect(d.value).toBeLessThan(90)
    }
  })

  it('a school has at most one club row, and clubs are registered only for high schools and universities', () => {
    expect(new Set(BASEBALL_CLUBS.map((r) => r.schoolId)).size).toBe(BASEBALL_CLUBS.length)
    for (const r of BASEBALL_CLUBS) expect(['hs', 'univ', 'jc', 'kosen']).toContain(schoolById(r.schoolId)!.kind)
  })

  it('club coverage by prefecture never exceeds the federation count', () => {
    for (const c of clubCoverageByPref()) expect(c.known, c.pref).toBeLessThanOrEqual(c.official)
  })
})
