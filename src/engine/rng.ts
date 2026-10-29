// Seeded pseudo-random numbers (mulberry32). The same seed always reproduces the same life.

export interface Rng {
  /** uniform in [0, 1) */
  next(): number
  normal(): number
  int(lo: number, hi: number): number
  chance(p: number): boolean
  pick<T>(items: readonly T[]): T
  weighted<T>(items: readonly T[], weights: readonly number[]): T
  /** derive an independent stream (used for side lives so the main life stays reproducible) */
  fork(salt: number): Rng
  readonly seed: number
}

export function makeRng(seed: number): Rng {
  let a = seed >>> 0
  let spare: number | null = null
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const rng: Rng = {
    seed: seed >>> 0,
    next,
    normal() {
      if (spare !== null) {
        const s = spare
        spare = null
        return s
      }
      let u = 0
      while (u === 0) u = next()
      const v = next()
      const r = Math.sqrt(-2 * Math.log(u))
      spare = r * Math.sin(2 * Math.PI * v)
      return r * Math.cos(2 * Math.PI * v)
    },
    int(lo, hi) {
      return lo + Math.floor(next() * (hi - lo + 1))
    },
    chance(p) {
      return next() < p
    },
    pick(items) {
      return items[Math.floor(next() * items.length)]
    },
    weighted(items, weights) {
      let total = 0
      for (const w of weights) total += w
      let r = next() * total
      for (let i = 0; i < items.length; i++) {
        r -= weights[i]
        if (r < 0) return items[i]
      }
      return items[items.length - 1]
    },
    fork(salt) {
      return makeRng(hashSeed(a ^ Math.imul(salt + 1, 0x9e3779b1)))
    },
  }
  return rng
}

export function hashSeed(n: number): number {
  let h = n >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  return (h ^ (h >>> 16)) >>> 0
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0
}
