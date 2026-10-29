// Guard for the Japan mode (PROJECT_PLAN §11.10): a fingerprint of every calibrated check drawn (key and
// outcome) and of the career path, for 100,000 headless lives up to the end of baseball. If two versions
// give the same fingerprints, the calibrated stage rates and the careers are unchanged.
// Run: node scripts/fingerprint.ts check [file]   compare with the stored baseline (default below)
//      node scripts/fingerprint.ts save  [file]   write a new baseline (only when a change was approved)
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { createLife, endYear, isPlaying, planYear, resolveDecision, type Sim } from '../src/engine/life.ts'
import { defaultParams } from '../src/engine/params.ts'
import { hashSeed } from '../src/engine/rng.ts'

const mode = process.argv[2] ?? 'check'
const file = process.argv[3] ?? new URL('./fingerprint-jp.txt', import.meta.url).pathname
// FP_N=10000 compares only the first lives against the same baseline (the lives are numbered the same way); never saves
const N = Number(process.env.FP_N ?? 100_000)
if (mode === 'save' && N !== 100_000) throw new Error('save needs the full 100,000 lives')
const SEED_BASE = 4_000_000

let draws: string[] = []
const sim: Sim = { params: defaultParams(), headless: true, tally: (k, ok) => draws.push(`${k}${ok ? 1 : 0}`) }

export function careerPrint(seed: number): string {
  draws = []
  const s = createLife({ seed, country: 'JP', pace: 'p15' })
  for (let g = 0; g < 130 && s.alive; g++) {
    const plan = planYear(s, sim)
    let d = plan.decision?.decision
    while (d && s.alive) d = resolveDecision(s, d.autoIndex, sim).followUp?.decision
    endYear(s)
    if (s.career.endedAge !== null && !isPlaying(s)) break
  }
  const c = s.career
  return [draws.join(','), c.highestRank, c.endedAge, c.achievements.join('/'), c.draftedFrom ?? '', c.proDebut, c.proSeasons, c.minorSeasons, s.timeline.map((t) => t.phase[0]).join('')].join('|')
}

const t0 = Date.now()
const lines: string[] = []
for (let i = 0; i < N; i++) lines.push(createHash('sha1').update(careerPrint(hashSeed(i + SEED_BASE))).digest('hex').slice(0, 12))
const secs = ((Date.now() - t0) / 1000).toFixed(1)

if (mode === 'save') {
  writeFileSync(file, `# fingerprint-jp v1 lives=${N} seedBase=${SEED_BASE} saved=${new Date().toISOString()}\n${lines.join('\n')}\n`)
  console.log(`saved ${N} fingerprints in ${secs}s → ${file}`)
} else {
  const base = readFileSync(file, 'utf8').split('\n').filter((l) => l && !l.startsWith('#'))
  const diff: number[] = []
  for (let i = 0; i < N; i++) if (base[i] !== lines[i]) diff.push(i)
  console.log(`${N} lives in ${secs}s; differing from the baseline: ${diff.length}${diff.length ? ` (first: ${diff.slice(0, 10).map((i) => `#${i} seed ${hashSeed(i + SEED_BASE)}`).join(', ')})` : ''}`)
  if (diff.length) process.exitCode = 1
}
