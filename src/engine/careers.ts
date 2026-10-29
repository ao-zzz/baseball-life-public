import type { CareerKind, Industry, LifeState, WorkState } from './types.ts'
import { setWork } from './after.ts'
import { clamp } from './math.ts'
import { LICENSES } from './license.ts'

// The careers beyond the job offers (2026-10-24): creators and streamers, entertainers, writers and artists, a founder, the
// Self-Defense Forces, politics, and the baseball careers after playing (commentator, coach, scout, front office). A career is an
// ordinary job (after.ts setWork: its allowance, the years, the history) with a kind that its own events follow (events/careerLife.ts)
// and, for the careers whose income swings, a pay its events set (fame, sales, a contract). All the figures are GAME ASSUMPTIONS
// (stat careerModel): the starting pay of each career and how events move it are the game's settings, not measured incomes.

interface CareerDef {
  title: string
  industry: Industry
  employer: WorkState['employer']
  regular: boolean
  /** starting yearly pay (万円); absent: the wage table, as an ordinary job */
  pay?: number
  baseball?: boolean
}

/** a licensed career: its title, employer and pay are license.ts's */
function licensedCareer(k: 'doctor' | 'dentist' | 'pharmacist' | 'nurse'): CareerDef {
  const d = LICENSES[k]
  return { title: d.title, industry: 'care', employer: d.employer!, regular: true, pay: d.pay }
}

export const CAREERS: Record<CareerKind, CareerDef> = {
  gamer: { title: 'プロゲーマー', industry: 'media', employer: 'team', regular: false, pay: 180 },
  streamer: { title: '動画配信者', industry: 'media', employer: 'self', regular: false, pay: 40 },
  idol: { title: 'アイドル', industry: 'entertainment', employer: 'small', regular: false, pay: 120 },
  singer: { title: '歌手', industry: 'entertainment', employer: 'small', regular: false, pay: 150 },
  actor: { title: '俳優', industry: 'entertainment', employer: 'small', regular: false, pay: 120 },
  talent: { title: 'タレント', industry: 'entertainment', employer: 'small', regular: false, pay: 250 },
  manga: { title: '漫画家', industry: 'media', employer: 'self', regular: false, pay: 100 },
  novelist: { title: '小説家', industry: 'media', employer: 'self', regular: false, pay: 60 },
  illustrator: { title: 'イラストレーター', industry: 'media', employer: 'self', regular: false, pay: 180 },
  founder: { title: '会社経営（自分で起業）', industry: 'it', employer: 'self', regular: true, pay: 240 },
  sdf: { title: '自衛官', industry: 'defense', employer: 'public', regular: true },
  politician: { title: '議員', industry: 'politics', employer: 'public', regular: true, pay: 900 },
  commentator: { title: '野球解説者', industry: 'media', employer: 'self', regular: false, pay: 350, baseball: true },
  coach: { title: '野球の指導者（コーチ）', industry: 'baseball', employer: 'team', regular: true, pay: 600, baseball: true },
  scout: { title: '球団のスカウト', industry: 'baseball', employer: 'team', regular: true, pay: 650, baseball: true },
  frontOffice: { title: '球団フロント', industry: 'baseball', employer: 'team', regular: true, pay: 700, baseball: true },
  // (licensed work, license.ts: the pay is a game assumption of the order of the profession's; the clinic or the hospital employs him)
  doctor: licensedCareer('doctor'),
  dentist: licensedCareer('dentist'),
  pharmacist: licensedCareer('pharmacist'),
  nurse: licensedCareer('nurse'),
}

/** he starts a career (the job he held, if any, ends: setWork pays its allowance); returns the allowance paid */
export function startCareer(s: LifeState, kind: CareerKind): number {
  const d = CAREERS[kind]
  // a student keeps his place at the university beside the career (life.ts: he graduates in his year)
  if (s.job === '大学生' && s.schools?.univ) (s.flags ??= {})['career.student'] ??= s.age
  return setWork(s, {
    title: d.title,
    industry: d.industry,
    employer: d.employer,
    level: 0,
    years: 0,
    satisfaction: 62,
    regular: d.regular,
    baseball: !!d.baseball,
    kind,
    ...(d.pay !== undefined ? { pay: d.pay } : {}),
  })
}

/** the career he follows now (none: no job, a job of the offers, or retired) */
export const careerOf = (s: LifeState): CareerKind | undefined => (s.after?.work && !s.after.retired ? s.after.work.kind : undefined)

/** a career's pay grows or falls (a contract, a hit, a slump): only a career with its own pay */
export function scalePay(s: LifeState, factor: number): void {
  const w = s.after?.work
  if (w?.pay !== undefined) w.pay = clamp(Math.round(w.pay * factor), 0, 200000)
}

/**
 * How widely he is known, 0–100: once an event has moved it, the stored value; before, from the baseball career (assumption): a star
 * of the pros or the majors is widely known, a pro somewhat, a name of high school or university baseball locally.
 */
export function fameOf(s: LifeState): number {
  if (s.fame !== undefined) return s.fame
  const r = s.career.highestRank
  return r >= 9 ? 70 : r >= 8 ? 45 : r >= 7 ? 25 : r >= 5 ? 10 : 3
}

export function addFame(s: LifeState, n: number): void {
  s.fame = clamp(fameOf(s) + n, 0, 100)
}
