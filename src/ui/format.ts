import type { Phase } from '../engine/types.ts'
import { lang, t, type Key } from '../i18n/index.ts'
import { JA } from '../i18n/ja.ts'
import { currencyOf, moneyIn } from '../i18n/currency.ts'

// (the names of the stages are texts of the screens, in src/i18n by key: batch 7)
const PHASE_KEY: Record<Phase, Key> = {
  child: 'phase.child',
  youth: 'phase.youth',
  jhs: 'phase.jhs',
  hs: 'phase.hs',
  univ: 'phase.univ',
  company: 'phase.company',
  indep: 'phase.indep',
  proMinor: 'phase.proMinor',
  pro: 'phase.pro',
  abroad: 'phase.abroad',
  retired: 'phase.retired',
  dead: 'phase.dead',
}

/** the names of the stages in Japanese */
export const PHASE_LABEL = Object.fromEntries(Object.entries(PHASE_KEY).map(([p, k]) => [p, JA[k]])) as Record<Phase, string>

/** the names of the stages in a US life (Japan's are above) */
const US_PHASE_KEY: Partial<Record<Phase, Key>> = {
  youth: 'phase.US.youth',
  jhs: 'phase.US.jhs',
  hs: 'phase.US.hs',
  univ: 'phase.US.univ',
  proMinor: 'phase.US.proMinor',
  pro: 'phase.US.pro',
}

/** Korea's and Cuba's (PROJECT_PLAN §11.46) */
const KR_PHASE_KEY: Partial<Record<Phase, Key>> = { youth: 'phase.KR.youth', proMinor: 'phase.KR.proMinor', pro: 'phase.KR.pro' }
const CU_PHASE_KEY: Partial<Record<Phase, Key>> = { youth: 'phase.CU.youth', jhs: 'phase.CU.jhs', hs: 'phase.CU.hs', proMinor: 'phase.CU.proMinor', pro: 'phase.CU.pro' }

/** the name of a stage in the life's country (`abroad`: a Cuban who went to the US plays in its levels), in the language now */
export function phaseLabel(phase: Phase, country: string | undefined, abroad = false): string {
  const table = country === 'US' || (country === 'CU' && abroad) ? US_PHASE_KEY : country === 'KR' ? KR_PHASE_KEY : country === 'CU' ? CU_PHASE_KEY : undefined
  return t(table?.[phase] ?? PHASE_KEY[phase])
}

/** an amount of the game (万円) as shown: in Japanese in yen as below; in another language in its currency (src/i18n/currency.ts) */
export function yen(man: number): string {
  if (!Number.isFinite(man)) return '—'
  if (lang() !== 'ja') return moneyIn(man, currencyOf(lang()).code)
  const sign = man < 0 ? '−' : ''
  const a = Math.abs(Math.round(man))
  if (a >= 10000) return `${sign}${(a / 10000).toFixed(a >= 100000 ? 0 : 1)}億円`
  return `${sign}${a.toLocaleString()}万円`
}

export function pctText(p: number): string {
  // one decimal so that published rates (e.g. 継続率 90.3%) are shown as published
  if (p >= 0.01) return `${(p * 100).toFixed(1)}%`
  return `${(p * 100).toFixed(2)}%`
}
