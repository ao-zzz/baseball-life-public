// Calibration of the US checks (PROJECT_PLAN §11.31). Runs headless US lives, reads the pass rate of every check (the tally of the
// engine) and moves the intercepts of countries/us/checks.ts until each rate is its target (stats.ts `us*`, game assumptions).
// The Japanese model is not touched. Run: node scripts/calibrate-us.ts [lives] [rounds]   (writes src/engine/countries/us/calibration.ts)
import { writeFileSync } from 'node:fs'
import { runHeadless, type Sim } from '../src/engine/life.ts'
import { defaultParams } from '../src/engine/params.ts'
import { hashSeed } from '../src/engine/rng.ts'
import { normInv } from '../src/engine/math.ts'
import { US_CHECKS, initialUsAlpha, usTarget } from '../src/engine/countries/us/checks.ts'
import { US_ALPHA } from '../src/engine/countries/us/calibration.ts'
import { MLB_Z } from '../src/engine/countries/us/settings.ts'

const N = Number(process.argv[2] ?? 60000)
const ROUNDS = Number(process.argv[3] ?? 6)
const MIN = 150
const file = new URL('../src/engine/countries/us/calibration.ts', import.meta.url).pathname

const alpha: Record<string, number> = {}
for (const k of Object.keys(US_CHECKS)) alpha[k] = US_ALPHA[k] ?? initialUsAlpha(k)
// the engine reads US_ALPHA: it is moved in place while the search runs
Object.assign(US_ALPHA, alpha)

let seedBase = 11_000_000
let last: Record<string, [number, number]> = {}
for (let round = 1; round <= ROUNDS; round++) {
  const tally: Record<string, [number, number]> = {}
  const sim: Sim = { params: defaultParams(), headless: true, tally: (k, ok) => { const a = (tally[k] ??= [0, 0]); a[1]++; if (ok) a[0]++ } }
  for (let i = 0; i < N; i++) runHeadless({ seed: hashSeed(seedBase + i), country: 'US', pace: 'p15' }, sim, true)
  seedBase += N
  let worst = 0
  for (const [k, [ok, n]] of Object.entries(tally)) {
    const target = usTarget(k)
    const p = Math.min(1 - 1e-4, Math.max(1e-4, ok / n))
    worst = Math.max(worst, n >= MIN ? Math.abs(p - target) / target : 0)
    if (n >= MIN) alpha[k] += 0.8 * (normInv(target) - normInv(p))
  }
  Object.assign(US_ALPHA, alpha)
  last = tally
  console.log(`round ${round}: largest relative gap ${(worst * 100).toFixed(1)}%`)
}
for (const [k, [ok, n]] of Object.entries(last).sort()) console.log(k.padEnd(18), String(n).padStart(8), (ok / n).toFixed(4), 'target', usTarget(k).toFixed(4))

// the ability of the players of the majors (read from lives run with the final intercepts)
const zs: number[] = []
const sim: Sim = { params: defaultParams(), headless: true }
for (let i = 0; i < N; i++) {
  const s = runHeadless({ seed: hashSeed(seedBase + i), country: 'US', pace: 'p15' }, sim, true)
  if (s.career.proDebut) zs.push(s.z)
}
const mean = zs.reduce((a, b) => a + b, 0) / Math.max(1, zs.length)
const sd = Math.sqrt(zs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, zs.length))
console.log(`players of the majors: ${zs.length} of ${N}, z mean ${mean.toFixed(2)} sd ${sd.toFixed(2)} (settings.ts MLB_Z now ${MLB_Z.mean}, ${MLB_Z.sd})`)

const body = Object.entries(alpha)
  .map(([k, v]) => `  '${k}': ${Math.round(v * 1000) / 1000},`)
  .join('\n')
writeFileSync(
  file,
  `// Intercepts of the US checks, written by scripts/calibrate-us.ts (${N} lives a round, ${ROUNDS} rounds; a key missing here uses the first guess,
// exact for a standard normal ability). The targets they reproduce are game assumptions (stats.ts \`us*\`), not statistics.
export const US_ALPHA: Record<string, number> = {
${body}
}
`,
)
console.log('written', file)
