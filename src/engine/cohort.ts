import type { LifeConfig, LifeState, Phase } from './types.ts'
import { hashSeed } from './rng.ts'
import { median, wilson } from './math.ts'
import { isPlaying, runHeadless, type Sim } from './life.ts'

// Same-condition model runs (PROJECT_PLAN §5.2, §6.1):
// "同じ条件" = same country and same prefecture; everything else (family, ability, chance) is drawn anew,
// and every decision is answered with おまかせ. Results are model estimates, not real-world probabilities.

export const RARITY_RUNS = 10000
export const FULL_RUNS = 1000
export const MAX_AGE = 110

export interface CohortResult {
  nRarity: number
  /** number of runs whose highest rank was >= r, for r = 0..10 */
  atLeast: number[]
  nFull: number
  medians: { lifespan: number; yearsPlaying: number; lifetimeIncome: number; happiness: number }
  /** share of runs still on a baseball team at each age */
  playingByAge: number[]
  /** share of runs alive at each age */
  aliveByAge: number[]
  /** distribution of highest rank among the full runs */
  rankHist: number[]
}

export function runCohort(base: LifeConfig, sim: Sim, nRarity = RARITY_RUNS, nFull = FULL_RUNS, onProgress?: (f: number) => void): CohortResult {
  const atLeast = new Array(11).fill(0)
  for (let i = 0; i < nRarity; i++) {
    const s = runHeadless({ ...base, seed: hashSeed(base.seed ^ Math.imul(i + 1, 0x27d4eb2d)) }, sim, true)
    for (let r = 0; r <= s.career.highestRank; r++) atLeast[r]++
    if (onProgress && i % 500 === 0) onProgress((i / (nRarity + nFull * 3)) * 0.999)
  }
  const lifespans: number[] = []
  const years: number[] = []
  const incomes: number[] = []
  const happy: number[] = []
  const playing = new Array(MAX_AGE).fill(0)
  const alive = new Array(MAX_AGE).fill(0)
  const rankHist = new Array(11).fill(0)
  for (let i = 0; i < nFull; i++) {
    const s = runHeadless({ ...base, seed: hashSeed(base.seed ^ Math.imul(i + 1, 0x165667b1) ^ 0x5bd1e995) }, sim)
    lifespans.push(s.age)
    years.push(s.career.yearsPlaying)
    incomes.push(s.lifetimeIncome)
    happy.push(avgHappiness(s))
    rankHist[s.career.highestRank]++
    for (const t of s.timeline) {
      if (t.age < MAX_AGE) {
        alive[t.age]++
        if (PLAYING_PHASES.has(t.phase)) playing[t.age]++
      }
    }
    if (onProgress && i % 50 === 0) onProgress((nRarity + i * 3) / (nRarity + nFull * 3))
  }
  return {
    nRarity,
    atLeast,
    nFull,
    medians: { lifespan: median(lifespans), yearsPlaying: median(years), lifetimeIncome: median(incomes), happiness: median(happy) },
    playingByAge: playing.map((c) => c / nFull),
    aliveByAge: alive.map((c) => c / nFull),
    rankHist,
  }
}

const PLAYING_PHASES = new Set<Phase>(['youth', 'jhs', 'hs', 'univ', 'company', 'indep', 'proMinor', 'pro', 'abroad'])

export function avgHappiness(s: LifeState): number {
  if (s.timeline.length === 0) return s.status.happiness
  return Math.round(s.timeline.reduce((a, t) => a + t.happiness, 0) / s.timeline.length)
}

export interface Rarity {
  k: number
  n: number
  lo: number
  hi: number
  /** text shown to the player */
  text: string
  /** "約N回に1回" when it can be stated, else null */
  oneIn: number | null
}

/** Rarity of reaching at least `rank`, with its uncertainty (Wilson 95%). */
export function rarityOf(c: CohortResult, rank: number): Rarity {
  const k = c.atLeast[rank] ?? 0
  const n = c.nRarity
  const { lo, hi } = wilson(k, n)
  const nTxt = n.toLocaleString()
  if (k === 0) {
    return { k, n, lo, hi, oneIn: null, text: `同じ条件の${nTxt}回の試行で0回。${nTxt}回に1回より少ないと考えられます（95%の上限は約${fmtOneIn(hi)}）。` }
  }
  if (k < 10) {
    return { k, n, lo, hi, oneIn: null, text: `同じ条件の${nTxt}回の試行で${k}回。回数が少ないため、${nTxt}回に10回未満とだけ言えます（95%区間 ${fmtOneIn(hi)}〜${fmtOneIn(lo)}）。` }
  }
  const oneIn = n / k
  return { k, n, lo, hi, oneIn, text: `同じ条件の${nTxt}回の試行で${k.toLocaleString()}回（約${fmtOneIn(k / n)}）。95%区間は${fmtOneIn(hi)}〜${fmtOneIn(lo)}。` }
}

export function fmtOneIn(p: number): string {
  if (p <= 0) return '—'
  if (p >= 0.5) return `${Math.round(p * 100)}%`
  const x = 1 / p
  const r = x < 10 ? Math.round(x * 10) / 10 : x < 100 ? Math.round(x) : x < 1000 ? Math.round(x / 10) * 10 : Math.round(x / 100) * 100
  return `${r.toLocaleString()}回に1回`
}

export function stillPlaying(t: LifeState['timeline'][number] | undefined): boolean {
  return !!t && PLAYING_PHASES.has(t.phase)
}

export { isPlaying }
