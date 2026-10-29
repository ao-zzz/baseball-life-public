// The table of trials of the ★ (src/data/potentialStars.ts STAR_TRIALS): potential mode, Japan, おまかせ, N lives per ★, seeds from
// 7,000,000, up to the end of baseball; the share of lives at each measure (r5 on after high school, r6 NPB 育成 or higher, r8 the NPB
// first team, r10 MLB). Prints the rows to compare with the table. Run: N=10000 node scripts/startrials.ts
import { runHeadless } from '../src/engine/life.ts'
import { defaultParams } from '../src/engine/params.ts'
import { hashSeed } from '../src/engine/rng.ts'
import { STAR_TRIALS } from '../src/data/potentialStars.ts'

const N = Number(process.env.N ?? 10000)
const sim = { params: defaultParams(), headless: true }
const r3 = (x: number) => Math.round(x * 1000) / 1000
for (let k = 1; k <= 10; k++) {
  const lives = Array.from({ length: N }, (_, i) => runHeadless({ seed: hashSeed(i + 7_000_000), country: 'JP', pace: 'p15', mode: 'potential', stars: k }, sim, true))
  const share = (rank: number) => r3(lives.filter((s) => s.career.highestRank >= rank).length / N)
  const now = { r5: share(5), r6: share(6), r8: share(8), r10: share(10) }
  const was = STAR_TRIALS[k]
  console.log(`  ${k}: { r5: ${now.r5}, r6: ${now.r6}, r8: ${now.r8}, r10: ${now.r10} },   // table: r5 ${was.r5}, r6 ${was.r6}, r8 ${was.r8}, r10 ${was.r10}`)
}
