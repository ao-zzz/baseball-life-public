import type { CareerKind, LicenseKind, LifeState, LogKind } from './types.ts'
import type { Rng } from './rng.ts'

// Work that needs a national licence (feedback r11 A8: a student of a dental university became an ordinary clerk). The model keeps
// no faculty, but a university of one course names it (歯科大学, 医科大学, 薬科大学, 看護大学, 教育大学): entering one sets the licence
// it leads to; the course's years decide the graduation; the national exam follows on a stream of its own, and once passed the
// licensed work is always among his job offers (after.ts jobOffers). The pass chances, the pay (careers.ts) and the number of tries
// are GAME ASSUMPTIONS of the order of the professions (stat careerModel), not measured figures.

interface LicenseDef {
  /** years of the course */
  years: number
  /** the national exam (none: the licence comes with the degree, 教員免許) */
  exam?: string
  /** the chance of passing the exam at one try (game assumption) */
  pass: number
  title: string
  /** the career of careers.ts (none: the job offers' 教員) */
  career?: CareerKind
  /** who employs him and the starting yearly pay (万円): game assumptions of the order of the profession's */
  employer?: 'large' | 'small'
  pay?: number
}

export const LICENSES: Record<LicenseKind, LicenseDef> = {
  doctor: { years: 6, exam: '医師国家試験', pass: 0.9, title: '医師', career: 'doctor', employer: 'large', pay: 1000 },
  dentist: { years: 6, exam: '歯科医師国家試験', pass: 0.65, title: '歯科医師', career: 'dentist', employer: 'small', pay: 700 },
  pharmacist: { years: 6, exam: '薬剤師国家試験', pass: 0.7, title: '薬剤師', career: 'pharmacist', employer: 'small', pay: 550 },
  nurse: { years: 4, exam: '看護師国家試験', pass: 0.9, title: '看護師', career: 'nurse', employer: 'large', pay: 480 },
  teacher: { years: 4, pass: 1, title: '教員' },
}

/** the most tries at the exam: after them he gives it up (an assumption) */
export const EXAM_TRIES = 3

/** the licence a university leads to, by its name (a university of one course; a general university: none) */
export function licenseOfSchool(name: string): LicenseKind | undefined {
  if (/歯科|歯学/.test(name)) return 'dentist'
  if (/医科|医学/.test(name)) return 'doctor'
  if (/薬科|薬学/.test(name)) return 'pharmacist'
  if (/看護/.test(name)) return 'nurse'
  if (/教育大学/.test(name)) return 'teacher'
  return undefined
}

/** the years of his course (4 without a licensed course) */
export const courseYears = (s: LifeState): number => (s.license ? LICENSES[s.license.kind].years : 4)

/**
 * the age (model) a student graduates at: his entrance (18, 19 after a 浪人 year, or a later entrance: univ.late) plus his course's
 * years. One rule for the graduation (life.ts) and the age he starts looking for work (afterEvents workAge): a six-year student is
 * not offered work at 22.
 */
export function graduationAge(s: LifeState): number {
  const late = s.flags?.['univ.late']
  const entered = late !== undefined ? late : s.flags?.['univ.ronin'] !== undefined ? 19 : 18
  return entered + courseYears(s)
}

/** he holds the licence */
export const licensed = (s: LifeState): boolean => s.license?.ok !== undefined

/**
 * The national exam: at graduation, then once a year until passed or given up. `add` writes a line on the exam's own stream.
 * Returns whether he passed (or holds the licence with the degree).
 */
export function takeExam(s: LifeState, rng: Rng, add: (kind: LogKind, text: string) => void): boolean {
  const l = s.license
  if (!l || l.ok !== undefined) return !!l
  const d = LICENSES[l.kind]
  if (!d.exam) {
    l.ok = s.age
    add('good', `${d.title}の免許を取りました。`)
    return true
  }
  l.tries = (l.tries ?? 0) + 1
  if (rng.chance(d.pass)) {
    l.ok = s.age
    add('big', `${d.exam}に合格しました。${d.title}として働けます。`)
    return true
  }
  add('bad', l.tries >= EXAM_TRIES ? `${d.exam}は、今年も不合格でした。資格はあきらめ、別の道を探すことにしました。` : `${d.exam}は不合格でした。働きながら、来年もう一度受けます。`)
  return false
}

/** another try is due this year (a graduate who failed and has tries left) */
export const examDue = (s: LifeState): boolean => !!s.license && s.license.ok === undefined && (s.license.tries ?? 0) > 0 && (s.license.tries ?? 0) < EXAM_TRIES
