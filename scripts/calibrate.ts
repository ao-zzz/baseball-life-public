// Calibrate stage-check intercepts so that おまかせ lives reproduce the target rates (PROJECT_PLAN §6.2).
// Run: node scripts/calibrate.ts [lives per iteration] [iterations] [validation lives]
//      node scripts/calibrate.ts --mortality-only   (keeps the stored intercepts, redoes only the mortality scale)
//
// - Each iteration uses fresh seeds, and the stored intercepts are the average over the second half
//   of the iterations, so the sampling noise of single iterations averages out.
// - The report is a validation run on held-out seeds with the stored intercepts. Its standard errors
//   are cluster-robust (a life is a cluster: one life can draw the same check in several years, and
//   those draws are correlated through ability), so they are honest for per-year checks.
// - `seCalib` estimates how much the stored intercepts themselves are off because of the
//   calibration's own sampling noise (used by the tests).
// - `insufficient` marks stages with fewer than MIN_SUCCESSES successes in the validation run:
//   their rate is too uncertain to call reproduced (relative standard error above about 10%).
import { writeFileSync } from 'node:fs'
import { CHECKS, initialAlpha, type Params } from '../src/engine/params.ts'
import { runHeadless, type Sim } from '../src/engine/life.ts'
import { hashSeed } from '../src/engine/rng.ts'
import { clamp, normInv } from '../src/engine/math.ts'
import { setMortalityScale } from '../src/engine/mortality.ts'
import { statValue } from '../src/data/stats.ts'
import { CALIBRATION } from '../src/data/calibration.ts'

const args = process.argv.slice(2)
// the stage checks only depend on the baseball years; life after baseball (health) moves only the mortality scale
const MORTALITY_ONLY = args.includes('--mortality-only')
const pos = args.filter((a) => !a.startsWith('--'))
const N = MORTALITY_ONLY ? CALIBRATION.lives : Number(pos[0] ?? 1_500_000)
const ITER = MORTALITY_ONLY ? CALIBRATION.iterations : Number(pos[1] ?? 16)
const NVAL = MORTALITY_ONLY ? CALIBRATION.validationLives : Number(pos[2] ?? 1_000_000)
const MIN_SUCCESSES = 100
const VALIDATION_SEED_OFFSET = 900_000_000

const params: Params = { alpha: {}, npbZMean: 2.2, npbZSd: 0.5 }
for (const k of Object.keys(CHECKS)) params.alpha[k] = initialAlpha(k)

interface Tally {
  k: number
  n: number
  /** per-life sums for the cluster-robust variance: Σk_i², Σk_i·n_i, Σn_i², number of lives */
  kk: number
  kn: number
  nn: number
  lives: number
}

function run(n: number, seedOf: (i: number) => number, p: Params) {
  const total = new Map<string, Tally>()
  const life = new Map<string, { k: number; n: number }>()
  const npbZ: number[] = []
  const sim: Sim = {
    params: p,
    headless: true,
    tally: (key, ok) => {
      const t = life.get(key) ?? { k: 0, n: 0 }
      t.n++
      if (ok) t.k++
      life.set(key, t)
    },
    observe: (key, v) => {
      if (key === 'npbZ') npbZ.push(v)
    },
  }
  for (let i = 0; i < n; i++) {
    life.clear()
    runHeadless({ seed: seedOf(i), country: 'JP', pace: 'p15' }, sim, true)
    for (const [key, l] of life) {
      const t = total.get(key) ?? { k: 0, n: 0, kk: 0, kn: 0, nn: 0, lives: 0 }
      t.k += l.k
      t.n += l.n
      t.kk += l.k * l.k
      t.kn += l.k * l.n
      t.nn += l.n * l.n
      t.lives++
      total.set(key, t)
    }
  }
  return { total, npbZ }
}

/** cluster-robust standard error of the ratio k/n */
function seCluster(t: Tally): number {
  if (t.n === 0 || t.lives < 2) return NaN
  const p = t.k / t.n
  const ss = t.kk - 2 * p * t.kn + p * p * t.nn
  return Math.sqrt(Math.max(0, ss) / (t.n * t.n) * (t.lives / (t.lives - 1)))
}

const history: Record<string, number>[] = []
const seCalibRaw: Record<string, number> = {}
for (let it = 0; it < (MORTALITY_ONLY ? 0 : ITER); it++) {
  const t0 = Date.now()
  const { total, npbZ } = run(N, (i) => hashSeed(i + 1 + it * N), params)
  let worst = ['', 0] as [string, number]
  for (const [key, c] of Object.entries(CHECKS)) {
    const t = total.get(c.metric ?? key)
    if (!t || t.n < 40) continue
    const target = c.target()
    const achieved = t.k / t.n
    const lo = 0.5 / t.n
    const step = (normInv(target) - normInv(clamp(achieved, lo, 1 - lo))) * Math.sqrt(1 + c.b * c.b)
    params.alpha[key] += clamp(step, -1.5, 1.5) * 0.85
    seCalibRaw[key] = seCluster(t)
    const dev = Math.abs(Math.log(Math.max(achieved, 1e-9) / target))
    if (dev > worst[1]) worst = [key, dev]
  }
  if (npbZ.length > 30) {
    const m = npbZ.reduce((a, b) => a + b, 0) / npbZ.length
    const sd = Math.sqrt(npbZ.reduce((a, b) => a + (b - m) * (b - m), 0) / npbZ.length)
    params.npbZMean = m
    params.npbZSd = Math.max(0.15, sd)
  }
  history.push({ ...params.alpha, __npbZMean: params.npbZMean, __npbZSd: params.npbZSd })
  console.log(`iter ${it + 1}/${ITER} ${((Date.now() - t0) / 1000).toFixed(1)}s worst=${worst[0]} ${worst[1].toFixed(3)}`)
}

// average the second half of the iterations
const tail = history.slice(Math.floor(ITER / 2))
const avg = (k: string) => tail.reduce((a, h) => a + h[k], 0) / tail.length
const final: Params = MORTALITY_ONLY
  ? { alpha: { ...CALIBRATION.alpha }, npbZMean: CALIBRATION.npbZMean, npbZSd: CALIBRATION.npbZSd }
  : { alpha: {}, npbZMean: avg('__npbZMean'), npbZSd: avg('__npbZSd') }
if (!MORTALITY_ONLY) for (const k of Object.keys(CHECKS)) final.alpha[k] = avg(k)

// mortality: find the hazard multiplier at which full lives (with their health ups and downs) die on
// average at the life-table age for men alive at 10 (stat jpLifeMaleAt10)
const MORT_LIVES = 20_000
const lifeTarget = statValue('jpLifeMaleAt10')
function meanAge(scale: number): number {
  setMortalityScale(scale)
  let sum = 0
  let n = 0
  for (let i = 0; i < MORT_LIVES; i++) {
    const s = runHeadless({ seed: hashSeed(i + 700_000_000), country: 'JP', pace: 'p15' }, { params: final, headless: true })
    if (s.age >= 10) {
      sum += s.age
      n++
    }
  }
  return sum / n
}
let lo = 0.3
let hi = 1.5
for (let i = 0; i < 9; i++) {
  const mid = (lo + hi) / 2
  if (meanAge(mid) > lifeTarget) lo = mid
  else hi = mid
}
const mortalityScale = +((lo + hi) / 2).toFixed(4)
const mortalityAchieved = meanAge(mortalityScale)
console.log(`mortality scale ${mortalityScale}: mean age at death ${mortalityAchieved.toFixed(2)} (target ${lifeTarget})`)

// validation on held-out seeds (kept as stored when only the mortality scale is redone)
const t0 = Date.now()
const { total } = MORTALITY_ONLY ? { total: new Map<string, Tally>() } : run(NVAL, (i) => hashSeed(i + VALIDATION_SEED_OFFSET), final)
if (!MORTALITY_ONLY) console.log(`validation ${NVAL} lives ${((Date.now() - t0) / 1000).toFixed(1)}s`)

const report: Record<string, { target: number; achieved: number; k: number; n: number; se: number; seCalib: number; z: number; insufficient: boolean }> = MORTALITY_ONLY ? { ...CALIBRATION.report } : {}
for (const [key, c] of MORTALITY_ONLY ? [] : Object.entries(CHECKS)) {
  const t = total.get(c.metric ?? key) ?? { k: 0, n: 0, kk: 0, kn: 0, nn: 0, lives: 0 }
  const target = c.target()
  const achieved = t.n ? t.k / t.n : NaN
  const se = seCluster(t)
  // noise of the averaged intercepts: one iteration's SE shrinks with the number of averaged iterations
  const seCalib = (seCalibRaw[key] ?? NaN) / Math.sqrt(tail.length)
  report[key] = {
    target: +target.toPrecision(4),
    achieved: +achieved.toPrecision(4),
    k: t.k,
    n: t.n,
    se: +se.toPrecision(3),
    seCalib: +seCalib.toPrecision(3),
    z: +((achieved - target) / Math.sqrt(se * se + seCalib * seCalib)).toFixed(2),
    insufficient: t.k < MIN_SUCCESSES || t.n - t.k < MIN_SUCCESSES,
  }
}

const rounded = Object.fromEntries(Object.entries(final.alpha).map(([k, v]) => [k, Math.round(v * 10000) / 10000]))
const out = `// Generated by scripts/calibrate.ts — do not edit by hand.
// lives per iteration=${N}, iterations=${ITER} (intercepts averaged over the last ${MORTALITY_ONLY ? Math.floor(ITER / 2) : tail.length}), validation lives=${NVAL} on held-out seeds.
// report: target vs achieved in the validation run; se = cluster-robust standard error of "achieved";
// seCalib = estimated error of the intercepts from calibration noise; insufficient = fewer than ${MIN_SUCCESSES} successes or failures.
export interface CalibrationRow {
  target: number
  achieved: number
  k: number
  n: number
  se: number
  seCalib: number
  z: number
  insufficient: boolean
}
export const CALIBRATION: { alpha: Record<string, number>; npbZMean: number; npbZSd: number; mortalityScale?: number; mortality?: { lives: number; target: number; achieved: number }; generated: string; lives: number; iterations: number; validationLives: number; minSuccesses: number; report: Record<string, CalibrationRow> } = ${JSON.stringify(
  {
    alpha: rounded,
    npbZMean: +final.npbZMean.toFixed(4),
    npbZSd: +final.npbZSd.toFixed(4),
    mortalityScale,
    mortality: { lives: MORT_LIVES, target: lifeTarget, achieved: +mortalityAchieved.toFixed(2) },
    generated: MORTALITY_ONLY ? CALIBRATION.generated : new Date().toISOString().slice(0, 10),
    lives: N,
    iterations: ITER,
    validationLives: NVAL,
    minSuccesses: MIN_SUCCESSES,
    report,
  },
  null,
  2,
)}
`
writeFileSync(new URL('../src/data/calibration.ts', import.meta.url), out)
for (const [k, r] of Object.entries(report)) {
  console.log(`${k.padEnd(18)} target=${r.target} achieved=${r.achieved} (k=${r.k}/n=${r.n}) se=${r.se} seCalib=${r.seCalib} z=${r.z}${r.insufficient ? ' 試行不足' : ''}`)
}
