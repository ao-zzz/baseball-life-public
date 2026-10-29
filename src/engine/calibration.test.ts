import { describe, expect, it } from 'vitest'
import { runHeadless, type Sim } from './life.ts'
import { CHECKS, defaultParams } from './params.ts'
import { hashSeed } from './rng.ts'
import { normInv } from './math.ts'
import { CALIBRATION } from '../data/calibration.ts'

// Out-of-sample check of scripts/calibrate.ts: with the stored intercepts, おまかせ lives on seeds the
// calibration never used should reproduce each stage's target rate.
//
// Tolerance (no hand-picked margin):
// - se: cluster-robust standard error of the test's own rate. A life is a cluster, because per-year
//   checks (1軍 debut, release, …) are drawn several times in one life and are correlated through ability;
//   the plain binomial error understates this (design effect up to about 1.8, see the 2026-10-17 report).
// - seCalib: the error of the stored intercepts from the calibration's own sampling (calibration.ts).
// - critical z: two-sided, family-wise false-alarm rate of 1% over all compared stages (Bonferroni).
// Stages the calibration marks `insufficient` (fewer than 100 successes or failures in its 1,000,000-life
// validation run) are not compared: their rate is too uncertain to call reproduced.

const LIVES = 400_000
const SEED_OFFSET = 50_000_000 // calibration uses seeds 1..lives×iterations, validation 900,000,000+
const FAMILY_ALPHA = 0.01

interface T {
  k: number
  n: number
  kk: number
  kn: number
  nn: number
  lives: number
}

function seCluster(t: T): number {
  const p = t.k / t.n
  const ss = t.kk - 2 * p * t.kn + p * p * t.nn
  return Math.sqrt((Math.max(0, ss) / (t.n * t.n)) * (t.lives / (t.lives - 1)))
}

const keys = Object.keys(CHECKS)
const compared = keys.filter((k) => !CALIBRATION.report[k]?.insufficient)
const zCrit = normInv(1 - FAMILY_ALPHA / (2 * compared.length))

describe('stage rates match their targets (PROJECT_PLAN §6.2)', () => {
  const total = new Map<string, T>()
  const life = new Map<string, { k: number; n: number }>()
  const sim: Sim = {
    params: defaultParams(),
    headless: true,
    tally: (key, ok) => {
      const t = life.get(key) ?? { k: 0, n: 0 }
      t.n++
      if (ok) t.k++
      life.set(key, t)
    },
  }
  for (let i = 0; i < LIVES; i++) {
    life.clear()
    runHeadless({ seed: hashSeed(i + SEED_OFFSET), country: 'JP', pace: 'p15' }, sim, true)
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

  it('every stage has a calibration report', () => {
    for (const k of keys) expect(CALIBRATION.report[k], k).toBeDefined()
  })

  for (const key of keys) {
    const c = CHECKS[key]
    const rep = CALIBRATION.report[key]
    if (rep?.insufficient) {
      it(`${key}: 試行不足 (rate not compared)`, () => {
        // still drawn, and flagged so the UI can say so
        expect(total.get(c.metric ?? key)?.n ?? 0).toBeGreaterThan(0)
        expect(rep.k < CALIBRATION.minSuccesses || rep.n - rep.k < CALIBRATION.minSuccesses).toBe(true)
      })
      continue
    }
    it(key, () => {
      const t = total.get(c.metric ?? key)
      expect(t, `no draws for ${key}`).toBeDefined()
      if (!t) return
      const target = c.target()
      const achieved = t.k / t.n
      const se = Math.sqrt(seCluster(t) ** 2 + (rep?.seCalib ?? 0) ** 2)
      const z = (achieved - target) / se
      expect(Math.abs(z), `${key}: achieved ${achieved.toFixed(5)} vs target ${target.toFixed(5)} (k=${t.k}, n=${t.n}, se=${se.toFixed(5)}, z=${z.toFixed(2)}, limit ${zCrit.toFixed(2)})`).toBeLessThan(zCrit)
    })
  }
})
