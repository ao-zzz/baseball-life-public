import { STATS } from '../data/stats.ts'
import type { LogEntry } from '../engine/types.ts'

/**
 * The statistics the record of a life has used, for the panel 「この人生に出てきた統計」: the last 8 different ids, in the order the
 * record first used them. An id this version does not know (a save made by another version, an id since removed) is skipped as if
 * it were not there, so the known ones keep their order and the panel never looks it up.
 */
export function usedStatIds(log: readonly Pick<LogEntry, 'statIds'>[]): string[] {
  const ids = new Set<string>()
  for (const e of log) for (const id of e.statIds ?? []) if (Object.hasOwn(STATS, id)) ids.add(id)
  return [...ids].slice(-8)
}
