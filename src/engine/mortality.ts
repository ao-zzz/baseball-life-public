import type { Rng } from './rng.ts'
import { statValue } from '../data/stats.ts'
import { CALIBRATION } from '../data/calibration.ts'

// Gompertz–Makeham hazard μ(x) = A + B·e^{c·x}, with B solved so that the mean age at death of men
// alive at 10 matches the life table (令和7年簡易生命表: 10 + e10, PROJECT_PLAN §6.2).
// The game conditions on the player not dying before he starts baseball at 8 (assumption), so the
// target is taken at 10 rather than at birth. A and c are assumptions.

const A = 0.0004
const C = 0.095
const FROM_AGE = 10

/** mean age at death for someone alive at FROM_AGE, under hazard B */
function meanAgeAtDeath(b: number): number {
  let alive = 1
  let years = 0
  for (let x = FROM_AGE; x < 125; x++) {
    const q = 1 - Math.exp(-(A + b * Math.exp(C * x)))
    years += alive * (1 - q / 2)
    alive *= 1 - q
  }
  return FROM_AGE + years
}

function solveB(target: number): number {
  let lo = 1e-7
  let hi = 1e-3
  for (let i = 0; i < 80; i++) {
    const mid = Math.sqrt(lo * hi)
    if (meanAgeAtDeath(mid) > target) lo = mid
    else hi = mid
  }
  return Math.sqrt(lo * hi)
}

const cache = new Map<string, number>()

function bFor(statId: string): number {
  let b = cache.get(statId)
  if (b === undefined) {
    b = solveB(statValue(statId))
    cache.set(statId, b)
  }
  return b
}

/**
 * Hazard multiplier, calibrated by scripts/calibrate.ts so that simulated lives (whose health rises and
 * falls with what happens to them) die on average at the life-table age. 1 = no correction.
 */
let mortalityScale = CALIBRATION.mortalityScale ?? 1

/** used by the calibration script while it searches for the scale */
export function setMortalityScale(x: number): void {
  mortalityScale = x
}

/** Annual probability of death. `health` 0..100 shifts the hazard (assumption). */
export function deathProb(age: number, health: number, lifeStatId = 'jpLifeMaleAt10', extra = 1): number {
  if (age < 8) return 0
  const b = bFor(lifeStatId)
  // `extra`: a country's own correction on top of the Japanese-calibrated scale (US: countries/us/settings.ts); 1 for Japan
  const mu = (A + b * Math.exp(C * age)) * Math.exp((60 - health) / 35) * mortalityScale * extra
  return 1 - Math.exp(-mu)
}

/** Cause of death: model weights by age (assumption; not shown with numbers). */
export function causeOfDeath(age: number, rng: Rng): string {
  if (age < 40) return rng.weighted(['事故', '病気', 'がん'], [4, 3, 2])
  if (age < 65) return rng.weighted(['がん', '心臓の病気', '脳の病気', '事故'], [5, 3, 2, 1])
  if (age < 85) return rng.weighted(['がん', '心臓の病気', '脳の病気', '肺炎', '老衰'], [5, 3, 2, 2, 1])
  return rng.weighted(['老衰', '心臓の病気', '肺炎', 'がん', '脳の病気'], [5, 3, 3, 2, 2])
}
