import { statValue } from '../data/stats.ts'
import { normCdf, normInv } from './math.ts'
import { CALIBRATION } from '../data/calibration.ts'

// Stage checks: P(pass) = Φ(alpha + b·z + context). `alpha` is calibrated (scripts/calibrate.ts) so that
// the model reproduces `target` when decisions are left to おまかせ (PROJECT_PLAN §6.2).
// `b` (how much ability matters) is an assumption.

export interface Check {
  /** slope on ability z (assumption) */
  b: number
  /** the rate the model should reproduce */
  target: () => number
  /** metric used for calibration when it differs from the check itself */
  metric?: string
  statIds: string[]
}

const third = (p: number) => Math.pow(p, 1 / 3)
const quarter = (p: number) => Math.pow(p, 1 / 4)

export const CHECKS: Record<string, Check> = {
  'jp.jhs': { b: 0.6, target: () => statValue('jpJhsContinue'), statIds: ['jpJhsContinue'] },
  'jp.hs': { b: 0.8, target: () => statValue('jpHsJoin'), statIds: ['jpHsJoin', 'jpJhsSoft', 'jpHsFirstYears'] },
  'jp.hsStay': { b: 0.3, target: () => third(statValue('jpHsComplete')), statIds: ['jpHsComplete'] },
  'jp.koshien': { b: 1.0, target: () => statValue('jpKoshien'), metric: 'jp.koshienEver', statIds: ['jpKoshien'] },
  'jp.hsFile': { b: 1.6, target: () => statValue('jpHsFile'), statIds: ['jpHsFile', 'jpShibouHs'] },
  'jp.hsDraft': { b: 1.4, target: () => statValue('jpHsDraftGivenFile'), statIds: ['jpHsDraftGivenFile'] },
  // 支配下 or 育成 when drafted, by route (2025 draft; one year of data, small counts for 社会人・独立)
  'jp.shihaikaHs': { b: 1.0, target: () => statValue('jpShihaikaHs'), statIds: ['jpShihaikaHs', 'jpDraftFromHs'] },
  'jp.shihaikaUniv': { b: 1.0, target: () => statValue('jpShihaikaUniv'), statIds: ['jpShihaikaUniv', 'jpDraftFromUniv'] },
  'jp.shihaikaCompany': { b: 1.0, target: () => statValue('jpShihaikaCompany'), statIds: ['jpShihaikaCompany', 'jpDraftFromCompany'] },
  'jp.shihaikaIndep': { b: 1.0, target: () => statValue('jpShihaikaIndep'), statIds: ['jpShihaikaIndep', 'jpDraftFromIndep'] },
  'jp.hsUniv': { b: 0.5, target: () => statValue('jpToUniv'), metric: 'jp.hsUnivShare', statIds: ['jpToUniv'] },
  'jp.hsCompany': { b: 1.2, target: () => statValue('jpToCompany'), metric: 'jp.hsCompanyShare', statIds: ['jpToCompany'] },
  'jp.hsIndep': { b: 0.8, target: () => statValue('jpToIndep'), metric: 'jp.hsIndepShare', statIds: ['jpToIndep'] },
  'jp.univStay': { b: 0.3, target: () => quarter(statValue('jpUnivComplete')), statIds: ['jpUnivComplete'] },
  'jp.univFile': { b: 1.6, target: () => statValue('jpUnivFile'), statIds: ['jpUnivFile', 'jpShibouUniv'] },
  'jp.univDraft': { b: 1.4, target: () => statValue('jpUnivDraftGivenFile'), statIds: ['jpUnivDraftGivenFile'] },
  'jp.univCompany': { b: 1.2, target: () => statValue('jpUnivToCompany'), metric: 'jp.univCompanyShare', statIds: ['jpUnivToCompany'] },
  'jp.univIndep': { b: 0.8, target: () => statValue('jpUnivToIndep'), metric: 'jp.univIndepShare', statIds: ['jpUnivToIndep'] },
  'jp.companyDraft': { b: 1.4, target: () => statValue('jpCompanyDraft'), statIds: ['jpCompanyDraft', 'jpDraftFromCompany'] },
  'jp.indepDraft': { b: 1.2, target: () => statValue('jpIndepDraft'), statIds: ['jpIndepDraft', 'jpDraftFromIndep'] },
  'jp.amateurExit': { b: -0.5, target: () => statValue('companyTenure'), statIds: ['companyTenure'] },
  'jp.ikuseiPromote': { b: 1.2, target: () => statValue('jpIkuseiPromote'), statIds: ['jpIkuseiPromote', 'jpIkuseiPromoted'] },
  'jp.ikuseiExit': { b: -0.8, target: () => statValue('jpIkuseiExit'), statIds: ['jpIkuseiExit'] },
  'jp.ichigun': { b: 1.2, target: () => statValue('jpIchigun'), statIds: ['jpIchigun'] },
  'jp.npbExit': { b: -0.9, target: () => statValue('jpNpbExit'), statIds: ['jpNpbExit', 'jpTenure', 'jpReleaseAge'] },
  'jp.mlb': { b: 1.8, target: () => statValue('jpMlb'), statIds: ['jpMlb'] },
}

export interface Params {
  alpha: Record<string, number>
  /** mean / sd of ability among NPB 支配下 player-years (for salary ranking) */
  npbZMean: number
  npbZSd: number
}

/** First guess: exact when z ~ N(0,1) and no context. */
export function initialAlpha(key: string): number {
  const c = CHECKS[key]
  return normInv(c.target()) * Math.sqrt(1 + c.b * c.b)
}

export function defaultParams(): Params {
  const alpha: Record<string, number> = {}
  for (const k of Object.keys(CHECKS)) alpha[k] = CALIBRATION.alpha[k] ?? initialAlpha(k)
  return { alpha, npbZMean: CALIBRATION.npbZMean, npbZSd: CALIBRATION.npbZSd }
}

export function passProb(params: Params, key: string, z: number, ctx = 0): number {
  const c = CHECKS[key]
  const a = params.alpha[key] ?? initialAlpha(key)
  return normCdf(a + c.b * z + ctx)
}
