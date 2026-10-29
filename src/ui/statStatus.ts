import type { Stat } from '../data/types.ts'

/**
 * How a statistic is labelled on screen (PROJECT_PLAN §6.1, 2026-10-17 decision):
 * 「未確認」 = the value, its source, or who is counted is not confirmed;
 * 「参考値」 = confirmed in the source, but the source gives no sex breakdown (sex: 'unstated').
 * Assumptions carry their own 「仮定」 label.
 */
export function statusOf(stat: Stat): 'unverified' | 'reference' | null {
  if (stat.kind === 'assumption') return null
  if (stat.unverified) return 'unverified'
  if (stat.sex === 'unstated') return 'reference'
  return null
}
