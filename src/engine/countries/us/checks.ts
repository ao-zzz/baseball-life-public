import type { LifeState } from '../../types.ts'
import { statValue } from '../../../data/stats.ts'
import { hashSeed, makeRng, type Rng } from '../../rng.ts'
import { normCdf, normInv } from '../../math.ts'
import { scoutPremium, starOf } from '../../potential.ts'
import { US_ALPHA } from './calibration.ts'

// The stage checks of the US model (PROJECT_PLAN §11.31). As in Japan's CHECKS (params.ts) the chance of passing is
// Φ(alpha + b·z + context); the target rates are the statistics `us*` (stats.ts), which are all game assumptions except where
// that file says otherwise. The checks are drawn from streams of their own, one per check and year, so that a US life
// never touches the random stream of the calibrated Japanese model and the choices on screen cannot move another check.

export interface UsCheck {
  /** slope on ability z (assumption) */
  b: number
  /** the statistic that holds the target */
  stat: string
  label: string
}

export const US_CHECKS: Record<string, UsCheck> = {
  'us.mid': { b: 0.6, stat: 'usMid', label: '少年野球 → 中学年代でも続ける' },
  'us.hs': { b: 0.8, stat: 'usHs', label: '中学年代 → 高校の野球部に入る' },
  'us.hsStay': { b: 0.3, stat: 'usHsStay', label: '高校の部活を1年続ける' },
  'us.hsDraft': { b: 1.6, stat: 'usHsDraft', label: '高校最終学年 → MLBドラフトで指名' },
  'us.hsSign': { b: 0.4, stat: 'usHsSign', label: '指名された高校生 → 契約する（おまかせ）' },
  'us.hsCollege': { b: 0.9, stat: 'usHsCollege', label: '高校 → 大学・短大の野球部で続ける' },
  'us.collegeStay': { b: 0.3, stat: 'usCollegeStay', label: '大学の部活を1年続ける' },
  'us.collegeDraft': { b: 1.4, stat: 'usCollegeDraft', label: '大学・短大 → MLBドラフトで指名（1年あたり）' },
  'us.collegeSign': { b: 0.4, stat: 'usCollegeSign', label: '指名された大学生 → 契約する（おまかせ）' },
  'us.jucoTransfer': { b: 0.8, stat: 'usJucoTransfer', label: '短大 → 4年制の大学に編入' },
  'us.minorUp': { b: 1.0, stat: 'usMinorUp', label: 'マイナーで1つ上の階層へ（1年あたり）' },
  'us.minorExit': { b: -0.8, stat: 'usMinorExit', label: 'マイナーで契約が切れる（1年あたり）' },
  'us.mlbDebut': { b: 1.2, stat: 'usMlbDebut', label: 'マイナー上位 → MLB初出場（1年あたり）' },
  'us.mlbExit': { b: -0.9, stat: 'usMlbExit', label: 'MLBを離れる（1年あたり）' },
}

/** the keys in which someone picks him (the draft, a college): his promise counts as in Japan's PICKED_BY (potential.ts) */
const PICKED = /Draft|College$/

export function usTarget(key: string): number {
  return statValue(US_CHECKS[key].stat)
}

/** the first guess of the intercept: exact when z ~ N(0,1) and no context */
export function initialUsAlpha(key: string): number {
  const c = US_CHECKS[key]
  return normInv(usTarget(key)) * Math.sqrt(1 + c.b * c.b)
}

/** the stream of one check in one year: a function of the life and the key only */
export function usRng(s: LifeState, key: string): Rng {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  return makeRng(hashSeed(s.config.seed ^ Math.imul(s.age + 1, 0x9e3779b1) ^ (h >>> 0) ^ 0x75735f31))
}

export function usProb(s: LifeState, key: string, ctx = 0, alpha: Record<string, number> = US_ALPHA): number {
  const c = US_CHECKS[key]
  const pot = s.pot
  // potential mode: the one who picks him adds what he believes of his promise to what he can do now (as in Japan's p())
  const picked = !!pot && PICKED.test(key) && (starOf(pot.stars) > 1 || /Draft/.test(key))
  const z = picked ? s.z + 1.2 * scoutPremium(s) : s.z
  return normCdf((alpha[key] ?? initialUsAlpha(key)) + c.b * z + ctx)
}
