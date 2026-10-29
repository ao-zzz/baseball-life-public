import type { Rng } from '../engine/rng.ts'

// A copy of engine/rng.ts makeRng that counts its draws, for tests only (never imported by the game). It must give exactly the
// numbers of the real one: rngMeasure.test.ts compares the two call by call, and whole lives with and without it.
// Each stream made (by makeRng or fork) gets the next number; every draw is reported as that number.

export interface DrawLog {
  /** the seed of each stream, in the order they were made */
  streams: number[]
  /** draws of each stream */
  counts: number[]
  /** every draw in order, folded into one hash (FNV-1a over the stream numbers) */
  hash: number
  total: number
}

export const newDrawLog = (): DrawLog => ({ streams: [], counts: [], hash: 0x811c9dc5, total: 0 })

export function makeCountingRng(seed: number, hashSeed: (n: number) => number, log: DrawLog): Rng {
  const id = log.streams.push(seed >>> 0) - 1
  log.counts.push(0)
  let a = seed >>> 0
  let spare: number | null = null
  const next = () => {
    log.counts[id]++
    log.total++
    log.hash = Math.imul(log.hash ^ id, 0x01000193) >>> 0
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
      return makeCountingRng(hashSeed(a ^ Math.imul(salt + 1, 0x9e3779b1)), hashSeed, log)
    },
  }
  return rng
}
