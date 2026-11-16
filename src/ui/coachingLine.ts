import type { LifeState } from '../engine/types.ts'
import { coachingSummary } from '../engine/coaching.ts'
import { t, type Key } from '../i18n/index.ts'

/** the line of the result screen: his years as a manager and what his teams won (engine/coaching.ts; ui/CoachPanel.tsx has the table) */
export function coachingLine(life: LifeState): string | undefined {
  const x = coachingSummary(life)
  if (!x) return undefined
  const parts: string[] = []
  const times = (key: Key, n: number) => (n > 0 ? [t(key, { n })] : [])
  if (x.pro) parts.push([t('res.coach.pro', { years: x.pro.years, w: x.pro.w, l: x.pro.l, d: x.pro.d }), ...times('res.coach.league', x.pro.league), ...times('res.coach.champion', x.pro.champion)].join(t('life.sep')))
  if (x.hs) parts.push([t('res.coach.hs', { years: x.hs.years }), ...times('res.coach.koshien', x.hs.koshien), ...times('res.coach.koshienWon', x.hs.won)].join(t('life.sep')))
  if (x.univ) parts.push([t('res.coach.univ', { years: x.univ.years }), ...times('res.coach.league', x.univ.league)].join(t('life.sep')))
  if (x.corp) parts.push([t('res.coach.corp', { years: x.corp.years }), ...times('res.coach.toshi', x.corp.toshi)].join(t('life.sep')))
  return parts.join(' / ')
}
