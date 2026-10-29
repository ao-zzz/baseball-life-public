import type { LifeState, Phase } from './types.ts'
import { EVENTS, createLife, endYear, planYear, resolveDecision, type Sim } from './life.ts'
import { eligibleExtra, stageOf } from './events.ts'
import { BANDS, SUBSTANTIVE, quantile } from './metrics.ts'

// Play diversity and event reach (PROJECT_PLAN §11.10). Event counts alone say little: these measures
// ask whether events are reachable and drawn at a sensible rate, whether lives differ from each other,
// whether a choice changes what follows, and whether any stage of life goes quiet or repeats itself.

export interface Recorded {
  s: LifeState
  decisions: { age: number; id: string; choice: number; choices: number; auto: number; weight: string }[]
  /** life-years in which each event could be drawn (checked on a copy at the start of the year) */
  eligibleYears: Record<string, number>
  /** the decision changed by `flip`, if any */
  flipAge?: number
}

/**
 * One life played as on screen (decorative lines included), decisions by おまかせ. `flip`: the n-th real
 * decision (two choices or more, not the 節目 screen) takes the next choice instead. `eligibility`: count
 * the years each event could have been drawn (slower: a copy of the life each year).
 */
export function playRecorded(seed: number, sim: Sim, opts: { flip?: number; eligibility?: boolean } = {}): Recorded {
  const s = createLife({ seed, country: 'JP', pace: 'p15' })
  const rec: Recorded = { s, decisions: [], eligibleYears: {} }
  let real = 0
  for (let g = 0; g < 130 && s.alive; g++) {
    if (opts.eligibility) {
      const copy = structuredClone({ ...s, log: [] }) as LifeState
      for (const d of [...EVENTS.eligible(copy, stageOf(copy), true), ...eligibleExtra(EVENTS, copy, stageOf(copy))]) rec.eligibleYears[d.id] = (rec.eligibleYears[d.id] ?? 0) + 1
    }
    const plan = planYear(s, sim)
    for (const e of plan.events) s.log.push(e.entry)
    let d = plan.decision?.decision
    while (d && s.alive) {
      let choice = d.autoIndex
      if (d.id !== 'breath' && d.choices.length >= 2) {
        if (real === opts.flip) {
          choice = (d.autoIndex + 1) % d.choices.length
          rec.flipAge = s.age
        }
        real++
      }
      rec.decisions.push({ age: s.age, id: d.id, choice, choices: d.choices.length, auto: d.autoIndex, weight: d.weight })
      const r = resolveDecision(s, choice, sim)
      for (const e of r.events) s.log.push(e.entry)
      d = r.followUp?.decision
    }
    endYear(s)
  }
  return rec
}

/** events drawn from the catalog (not decorative lines) */
const substantiveEvent = (id: string) => {
  const d = EVENTS.get(id)
  return !!d && !d.flavorOnly
}

export interface EventReach {
  id: string
  stages: string
  /** lives in which the event could be drawn at least once / in which it happened */
  livesEligible: number
  livesReached: number
  /** happened ÷ eligible life-years */
  perEligibleYear: number
  /** the most times in one life, and the limit */
  maxInLife: number
  maxPerLife: number
}

export function eventReach(recs: Recorded[]): EventReach[] {
  const out: EventReach[] = []
  for (const d of EVENTS.all()) {
    if (d.flavorOnly) continue
    let livesEligible = 0
    let livesReached = 0
    let eligibleYears = 0
    let happened = 0
    let maxInLife = 0
    for (const r of recs) {
      const e = r.eligibleYears[d.id] ?? 0
      const h = r.s.evHist?.[d.id]?.[1] ?? 0
      if (e > 0) livesEligible++
      if (h > 0) livesReached++
      eligibleYears += e
      happened += h
      maxInLife = Math.max(maxInLife, h)
    }
    out.push({ id: d.id, stages: d.stages.join(','), livesEligible, livesReached, perEligibleYear: eligibleYears ? happened / eligibleYears : 0, maxInLife, maxPerLife: d.maxPerLife ?? 1 })
  }
  return out
}

/** findings on reach: never possible, possible but almost never drawn, or above the per-life limit */
export function reachProblems(reach: EventReach[], lives: number, minEligible = 30): { neverEligible: string[]; rare: string[]; overLimit: string[] } {
  // follow-ups and events that need a player's own choice first (not reached by おまかせ) are not judged by reach
  const followOnly = (id: string) => !!EVENTS.get(id)?.followOnly || !!EVENTS.get(id)?.needsChoice
  return {
    neverEligible: reach.filter((r) => !followOnly(r.id) && r.livesEligible === 0 && r.livesReached === 0).map((r) => r.id),
    // possible in enough lives, but reached in fewer than 2% of them
    rare: reach.filter((r) => r.livesEligible >= Math.min(minEligible, lives) && r.livesReached / r.livesEligible < 0.02).map((r) => `${r.id} (${r.livesReached}/${r.livesEligible})`),
    overLimit: reach.filter((r) => r.maxInLife > r.maxPerLife).map((r) => `${r.id} (${r.maxInLife} > ${r.maxPerLife})`),
  }
}

/** the phase a year started in */
function startPhase(s: LifeState, age: number): Phase {
  return age === 0 ? 'child' : (s.timeline.find((t) => t.age === age - 1)?.phase ?? 'child')
}

/** the longest run of years without an event or a decision, within each phase of life (from age 8) */
export function phaseGaps(r: Recorded): Partial<Record<Phase, number>> {
  const s = r.s
  const busy = new Set(s.log.filter((e) => SUBSTANTIVE.has(e.kind) && e.kind !== 'death').map((e) => e.age))
  for (const d of r.decisions) if (d.id !== 'breath') busy.add(d.age)
  const out: Partial<Record<Phase, number>> = {}
  let run = 0
  let prev: Phase | undefined
  for (let a = 8; a < s.age; a++) {
    const ph = startPhase(s, a)
    if (ph !== prev) run = 0
    prev = ph
    run = busy.has(a) ? 0 : run + 1
    out[ph] = Math.max(out[ph] ?? 0, run)
  }
  return out
}

function entropy(counts: number[]): number {
  const n = counts.reduce((a, x) => a + x, 0)
  return n ? -counts.reduce((a, x) => (x ? a + (x / n) * Math.log2(x / n) : a), 0) : 0
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  let common = 0
  for (const x of a) if (b.has(x)) common++
  return common / (a.size + b.size - common)
}

const eventSet = (s: LifeState, from = 0, to = 999) => new Set(s.log.filter((e) => e.eventId && e.age >= from && e.age <= to && substantiveEvent(e.eventId)).map((e) => e.eventId!))

/** the path of a life: phases in order, highest stage, last job, and the choices of the major decisions */
export function trajectory(r: Recorded, withChoices = true): string {
  const phases = r.s.timeline.map((t) => t.phase).filter((p, i, a) => i === 0 || a[i - 1] !== p)
  const job = r.s.after?.jobs?.at(-1) ?? r.s.job ?? ''
  const major = withChoices ? r.decisions.filter((d) => d.weight === 'major').map((d) => `${d.id}:${d.choice}`) : []
  return [phases.join('>'), r.s.career.highestRank, job, ...major].join('|')
}

export interface FlipPair {
  base: Recorded
  flipped: Recorded
}

export interface DiversityReport {
  lives: number
  reachByStage: Record<string, { events: number; reached: number }>
  entropyByBand: Record<string, number>
  medianJaccard: number
  trajectories: { distinct: number; topShare: number; distinctPaths: number }
  flips?: { pairs: number; eventDistance10y: number; happinessDiff10y: number; moneyDiffEnd: number; deathAgeDiff: number; careerChanged: number }
  spread: { highestRank: Record<number, number>; lifetimeIncome: [number, number, number]; meanHappiness: [number, number]; deathAge: [number, number, number]; lastJobs: number }
  autoFirst: number
  phaseGaps: Record<string, { p95: number; max: number }>
}

export function diversityReport(recs: Recorded[], flips: FlipPair[] = []): DiversityReport {
  const reach = eventReach(recs)
  const reachByStage: DiversityReport['reachByStage'] = {}
  for (const r of reach) {
    for (const st of r.stages.split(',')) {
      const o = (reachByStage[st] ??= { events: 0, reached: 0 })
      o.events++
      if (r.livesReached > 0) o.reached++
    }
  }
  const entropyByBand: Record<string, number> = {}
  for (const [band, a, b] of BANDS) {
    const counts = new Map<string, number>()
    for (const r of recs) for (const e of r.s.log) if (e.eventId && e.age >= a && e.age <= b && substantiveEvent(e.eventId)) counts.set(e.eventId, (counts.get(e.eventId) ?? 0) + 1)
    entropyByBand[band] = Math.round(entropy([...counts.values()]) * 100) / 100
  }
  const sets = recs.map((r) => eventSet(r.s))
  const js: number[] = []
  for (let i = 0; i + 1 < sets.length; i += 2) js.push(jaccard(sets[i], sets[i + 1]))
  const sig = new Map<string, number>()
  for (const r of recs) sig.set(trajectory(r), (sig.get(trajectory(r)) ?? 0) + 1)
  const paths = new Set(recs.map((r) => trajectory(r, false)))
  const fl = flips.filter((f) => f.flipped.flipAge !== undefined)
  const flipStats = fl.length
    ? (() => {
        const mean = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / Math.max(1, xs.length)
        return {
          pairs: fl.length,
          eventDistance10y: mean(fl.map((f) => 1 - jaccard(eventSet(f.base.s, f.flipped.flipAge!, f.flipped.flipAge! + 10), eventSet(f.flipped.s, f.flipped.flipAge!, f.flipped.flipAge! + 10)))),
          happinessDiff10y: mean(
            fl.map((f) => {
              const a0 = f.flipped.flipAge!
              const h = (r: Recorded) => mean(r.s.timeline.filter((t) => t.age >= a0 && t.age <= a0 + 10).map((t) => t.happiness))
              return Math.abs(h(f.base) - h(f.flipped))
            }),
          ),
          moneyDiffEnd: mean(fl.map((f) => Math.abs(f.base.s.money - f.flipped.s.money))),
          deathAgeDiff: mean(fl.map((f) => Math.abs(f.base.s.age - f.flipped.s.age))),
          careerChanged: mean(fl.map((f) => (f.base.s.career.highestRank !== f.flipped.s.career.highestRank ? 1 : 0))),
        }
      })()
    : undefined
  const rankCount: Record<number, number> = {}
  for (const r of recs) rankCount[r.s.career.highestRank] = (rankCount[r.s.career.highestRank] ?? 0) + 1
  const income = recs.map((r) => r.s.lifetimeIncome)
  const happy = recs.map((r) => r.s.timeline.reduce((a, t) => a + t.happiness, 0) / Math.max(1, r.s.timeline.length))
  const death = recs.map((r) => r.s.age)
  const decisions = recs.flatMap((r) => r.decisions.filter((d) => d.id !== 'breath' && d.choices >= 2))
  const gaps: Record<string, number[]> = {}
  for (const r of recs) for (const [ph, g] of Object.entries(phaseGaps(r))) (gaps[ph] ??= []).push(g)
  return {
    lives: recs.length,
    reachByStage,
    entropyByBand,
    medianJaccard: Math.round(quantile(js, 0.5) * 1000) / 1000,
    trajectories: { distinct: sig.size, topShare: Math.round((Math.max(...sig.values()) / recs.length) * 1000) / 1000, distinctPaths: paths.size },
    flips: flipStats,
    spread: {
      highestRank: rankCount,
      lifetimeIncome: [quantile(income, 0.1), quantile(income, 0.5), quantile(income, 0.9)],
      meanHappiness: [Math.round(quantile(happy, 0.1)), Math.round(quantile(happy, 0.9))],
      deathAge: [quantile(death, 0.1), quantile(death, 0.5), quantile(death, 0.9)],
      lastJobs: new Set(recs.map((r) => r.s.after?.jobs?.at(-1) ?? '')).size,
    },
    autoFirst: Math.round((decisions.filter((d) => d.auto === 0).length / Math.max(1, decisions.length)) * 1000) / 1000,
    phaseGaps: Object.fromEntries(Object.entries(gaps).map(([ph, v]) => [ph, { p95: quantile(v, 0.95), max: Math.max(...v) }])),
  }
}
