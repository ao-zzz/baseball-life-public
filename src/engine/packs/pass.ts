import type { CountryCode } from '../../data/types.ts'
import { residenceOf } from '../countries/index.ts'
import { eventRng, markSeen, stageOf, tagged, weightOf, type EventCtx, type EventStage } from '../events.ts'
import type { PackEntry } from './kit.ts'

// The packs' own pass (packs/kit.ts). It runs once a year, after everything else of the year (life.ts packYear): after the main
// draw, the extra, life and resident passes, the questions shown on screen only (the wished position and the like), the year's
// status and the death rate. It draws on random streams of its own, from the packs' events only (events.ts leaves them out of
// its passes), so the draws above, the lines already written and the questions already asked are as they were. Its question
// comes last in the year, and only while the year has room for one (life.ts YearCtx.askLast).
// An event with a chance of its own (`chance`) is rolled on a stream of its own (seed, age, its id) and run on another, so it comes
// as often whatever the other events and packs are; the others share the draw of PACK_PER_YEAR.
// With no pack, or with the country switched off, it returns at once: it draws nothing and writes nothing to the life.

/** events of the packs' pass in a year, by stage: [chance of a first, chance of a second] (game assumptions, to be tuned with the packs) */
export const PACK_PER_YEAR: Record<EventStage, [number, number]> = {
  child: [0, 0],
  youth: [0.15, 0],
  jhs: [0.2, 0.03],
  hs: [0.25, 0.05],
  univ: [0.3, 0.05],
  amateur: [0.3, 0.05],
  pro: [0.3, 0.05],
  student: [0.25, 0.05],
  adult: [0.3, 0.06],
  senior: [0.25, 0.04],
}
/** continuations of earlier events (`later`) whose window is open: run first, at most this many a year */
export const PACK_LATER_PER_YEAR = 2
/** events with a chance of their own (not continuations) that come in a year, at most (those whose roll is lowest first) */
export const PACK_ROLLED_PER_YEAR = 2

/** the country an entry goes by: the one he was born in, or the one he lives in now */
function countryFor(e: PackEntry, born: CountryCode, lives: CountryCode): CountryCode {
  return e.where === 'lives' ? lives : born
}

/** a number of an event's id, for its streams */
function idSalt(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return h >>> 0
}

/** the roll of an event with a chance, this year: in [0, 1), from the seed, the age and the event's id only (it comes when below its chance) */
export function packRoll(s: EventCtx['s'], id: string): number {
  return eventRng(s, idSalt(id)).next()
}

/** whether an entry of a pack may happen this year (its country switched on, its stage, ages, limits and conditions) */
export function packFits(e: PackEntry, s: EventCtx['s'], enabled: Readonly<Record<CountryCode, boolean>>, stage: EventStage = stageOf(s)): boolean {
  const cc = countryFor(e, s.person?.country ?? 'JP', residenceOf(s))
  if (!enabled[cc] || !e.countries.includes(cc)) return false
  const d = e.def
  if (!d.stages.includes(stage)) return false
  if (d.ages && (s.age < d.ages[0] || s.age > d.ages[1])) return false
  const h = s.evHist?.[d.id]
  if (h && (h[1] >= (d.maxPerLife ?? 1) || s.age - h[0] < (d.cooldown ?? 3))) return false
  if (d.when && !d.when(s)) return false
  return weightOf(d, s) > 0
}

/**
 * The year's events of the packs. First the continuations whose window is open (at most PACK_LATER_PER_YEAR): those with a chance of
 * their own that pass their roll, then those without one, drawn. Then the events with a chance that pass their roll (at most
 * PACK_ROLLED_PER_YEAR), then up to two drawn by PACK_PER_YEAR among those without one. One event of a category a year, one
 * question a year, and a question only while there is room for it. Returns the ids that ran.
 */
export function runPacks(entries: readonly PackEntry[], enabled: Readonly<Record<CountryCode, boolean>>, c: EventCtx): string[] {
  const s = c.s
  if (entries.length === 0 || !s.alive) return []
  const born = s.person?.country ?? 'JP'
  if (!enabled[born] && !enabled[residenceOf(s)]) return []
  const stage = stageOf(s)
  const open = entries.filter((e) => packFits(e, s, enabled, stage))
  if (open.length === 0) return []
  const used = new Set<string>()
  const ran: string[] = []
  let decisionOk = true
  const free = (e: PackEntry) => !used.has(e.def.category) && !(e.def.resolve && (!decisionOk || !c.canAsk())) && packFits(e, s, enabled, stage)
  const run = (e: PackEntry, ctx: EventCtx) => {
    const d = e.def
    if (d.resolve) decisionOk = false
    markSeen(s, d.id)
    used.add(d.category)
    ran.push(d.id)
    d.run(tagged(ctx, d))
  }
  // an event with a chance runs on a stream of its own (its endings), so the other packs never move it
  const own = (e: PackEntry): EventCtx => ({ ...c, rng: eventRng(s, idSalt(e.def.id) ^ 0x2b7e) })
  const rolled = open
    .filter((e) => e.chance !== undefined)
    .map((e) => ({ e, r: packRoll(s, e.def.id) }))
    .filter((x) => x.r < x.e.chance!)
    .sort((a, b) => a.r - b.r || (a.e.def.id < b.e.def.id ? -1 : 1))
  const drawn = (later: boolean) => entries.filter((e) => e.chance === undefined && e.later === later && free(e))
  // continuations: the rolled ones, then the drawn ones
  let k = 0
  for (const { e } of rolled) {
    if (k >= PACK_LATER_PER_YEAR) break
    if (!e.later || !free(e)) continue
    run(e, own(e))
    k++
  }
  if (open.some((e) => e.chance === undefined && e.later)) {
    for (; k < PACK_LATER_PER_YEAR; k++) {
      const p = drawn(true)
      if (p.length === 0) break
      run(c.rng.weighted(p, p.map((e) => weightOf(e.def, s))), c)
    }
  }
  // the events with a chance of their own
  let m = 0
  for (const { e } of rolled) {
    if (m >= PACK_ROLLED_PER_YEAR) break
    if (e.later || !free(e)) continue
    run(e, own(e))
    m++
  }
  // the shared draw, for the events without a chance (nothing is drawn when the year has none of them)
  if (open.some((e) => e.chance === undefined && !e.later)) {
    const [p1, p2] = PACK_PER_YEAR[stage]
    let n = 0
    if (c.rng.chance(p1)) n++
    if (n === 1 && c.rng.chance(p2)) n++
    for (let i = 0; i < n; i++) {
      const p = drawn(false)
      if (p.length === 0) break
      run(c.rng.weighted(p, p.map((e) => weightOf(e.def, s))), c)
    }
  }
  return ran
}
