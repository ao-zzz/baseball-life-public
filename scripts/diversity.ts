// Play diversity and event reach (PROJECT_PLAN §11.10): plays lives as on screen (おまかせ), counts the
// years each event could have been drawn, and replays some lives with one decision changed.
// Run: node scripts/diversity.ts [lives] [flipped lives]
import { diversityReport, eventReach, playRecorded, reachProblems, type FlipPair, type Recorded } from '../src/engine/diversity.ts'
import { defaultParams } from '../src/engine/params.ts'
import { hashSeed } from '../src/engine/rng.ts'
import type { Sim } from '../src/engine/life.ts'

const N = Number(process.argv[2] ?? 3000)
const F = Number(process.argv[3] ?? 300)
const sim: Sim = { params: defaultParams() }
const t0 = Date.now()
const recs: Recorded[] = []
for (let i = 0; i < N; i++) recs.push(playRecorded(hashSeed(i + 3_300_000), sim, { eligibility: true }))
const flips: FlipPair[] = []
for (let i = 0; i < Math.min(F, N); i++) {
  const seed = hashSeed(i + 3_300_000)
  // a different decision each time: the 0th–7th real decision of the life
  flips.push({ base: recs[i], flipped: playRecorded(seed, sim, { flip: (seed >>> 0) % 8 }) })
}
const rep = diversityReport(recs, flips)
const reach = eventReach(recs)
const prob = reachProblems(reach, N)
console.log(`lives ${N} (+${flips.length} replays with one decision changed) in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
console.log('events reached by stage (reached/non-decorative): ' + Object.entries(rep.reachByStage).map(([k, v]) => `${k} ${v.reached}/${v.events}`).join(', '))
console.log('entropy of events by age band (bits): ' + Object.entries(rep.entropyByBand).map(([k, v]) => `${k} ${v}`).join(', '))
console.log(`median overlap of two lives' events (Jaccard): ${rep.medianJaccard}`)
console.log(`trajectories: ${rep.trajectories.distinct} distinct with choices, ${rep.trajectories.distinctPaths} distinct paths without; most common ${(rep.trajectories.topShare * 100).toFixed(1)}%`)
if (rep.flips) console.log(`one decision changed (${rep.flips.pairs} lives): events in the next 10 years differ by ${(rep.flips.eventDistance10y * 100).toFixed(0)}% (Jaccard distance); happiness ±${rep.flips.happinessDiff10y.toFixed(1)}; money at death ±${Math.round(rep.flips.moneyDiffEnd)}万円; age at death ±${rep.flips.deathAgeDiff.toFixed(1)}; highest stage changed in ${(rep.flips.careerChanged * 100).toFixed(1)}%`)
console.log(`spread: highest stage ${JSON.stringify(rep.spread.highestRank)}; lifetime income p10/50/90 ${rep.spread.lifetimeIncome.join(' / ')}万円; mean happiness p10/p90 ${rep.spread.meanHappiness.join(' / ')}; age at death p10/50/90 ${rep.spread.deathAge.join(' / ')}; last jobs ${rep.spread.lastJobs}`)
console.log(`おまかせ takes the first choice in ${(rep.autoFirst * 100).toFixed(1)}% of decisions`)
console.log('longest quiet stretch within a phase (p95 / max years): ' + Object.entries(rep.phaseGaps).map(([k, v]) => `${k} ${v.p95}/${v.max}`).join(', '))
console.log(`never possible: ${prob.neverEligible.length ? prob.neverEligible.join(', ') : 'none'}`)
console.log(`possible but reached in under 2% of those lives: ${prob.rare.length ? prob.rare.join(', ') : 'none'}`)
console.log(`over the per-life limit: ${prob.overLimit.length ? prob.overLimit.join(', ') : 'none'}`)
const low = reach.filter((r) => r.livesEligible > 0).sort((a, b) => a.perEligibleYear - b.perEligibleYear).slice(0, 8)
console.log('lowest drawn per eligible year: ' + low.map((r) => `${r.id} ${(r.perEligibleYear * 100).toFixed(1)}% (${r.livesReached}/${r.livesEligible} lives)`).join(', '))
