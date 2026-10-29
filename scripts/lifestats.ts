// Life outcomes after baseball (PROJECT_PLAN §11.6–11.7): money, marriage, children, housing, work.
// Plays N lives the way the screen does (おまかせ) and prints model results next to the statistics they
// are compared with. Run: node scripts/lifestats.ts [lives]
import { createLife, endYear, planYear, resolveDecision, type Sim } from '../src/engine/life.ts'
import { defaultParams } from '../src/engine/params.ts'
import { hashSeed } from '../src/engine/rng.ts'
import { quantile } from '../src/engine/metrics.ts'
import { statValue } from '../src/data/stats.ts'

const N = Number(process.argv[2] ?? 3000)
const sim: Sim = { params: defaultParams() }
let married = 0
let kids = 0
let own = 0
let coach = 0
let kusa = 0
let negEver = 0
let ageSum = 0
let alive10 = 0
let alive50 = 0
let never50 = 0
const minMoney: number[] = []
const money65: number[] = []
const moneyEnd: number[] = []
const jobs: Record<string, number> = {}
const kidsDist = [0, 0, 0, 0]
const t0 = Date.now()
for (let i = 0; i < N; i++) {
  const s = createLife({ seed: hashSeed(i + 4_400_000), country: 'JP', pace: 'p15' })
  let mn = 0
  for (let g = 0; g < 130 && s.alive; g++) {
    const plan = planYear(s, sim)
    let d = plan.decision?.decision
    while (d && s.alive) d = resolveDecision(s, d.autoIndex, sim).followUp?.decision
    if (s.age >= 18) mn = Math.min(mn, s.money)
    if (s.age === 65) money65.push(s.money)
    if (s.age === 50) {
      alive50++
      if (!s.family.everMarried) never50++
    }
    if (s.after?.work) jobs[s.after.work.title] = (jobs[s.after.work.title] ?? 0) + 1
    endYear(s)
  }
  if (s.age >= 10) {
    ageSum += s.age
    alive10++
  }
  if (s.family.everMarried) married++
  kids += s.family.children
  kidsDist[Math.min(3, s.family.children)]++
  if (s.after?.home === 'own') own++
  if (s.after?.baseballLife.includes('少年野球の指導')) coach++
  if (s.after?.baseballLife.includes('草野球')) kusa++
  if (mn < 0) negEver++
  minMoney.push(mn)
  moneyEnd.push(s.money)
}
const pct = (k: number, n: number) => `${((100 * k) / n).toFixed(1)}%`
console.log(`lives ${N} in ${((Date.now() - t0) / 1000).toFixed(1)}s (model results; compare only with the statistics named)`)
console.log(`mean age at death, alive at 10: ${(ageSum / alive10).toFixed(2)} (statistic jpLifeMaleAt10 ${statValue('jpLifeMaleAt10')})`)
console.log(`never married at 50: ${pct(never50, alive50)} of ${alive50} alive at 50 (statistic jpNeverMarried50Male ${(statValue('jpNeverMarried50Male') * 100).toFixed(2)}%)`)
console.log(`ever married ${pct(married, N)}; children per life ${(kids / N).toFixed(2)}, 0/1/2/3+ ${kidsDist.map((x) => pct(x, N)).join(' / ')} (assumptions)`)
console.log(`own home at death ${pct(own, N)}, youth coach ${pct(coach, N)}, 草野球 ${pct(kusa, N)} (assumptions)`)
console.log(`money ever below 0 after 18: ${pct(negEver, N)}; lowest money p1 ${quantile(minMoney, 0.01)}, p10 ${quantile(minMoney, 0.1)} (万円)`)
console.log(`money at 65: p10 ${quantile(money65, 0.1)}, median ${quantile(money65, 0.5)}, p90 ${quantile(money65, 0.9)}; at death median ${quantile(moneyEnd, 0.5)} (万円)`)
console.log('jobs (person-years per life): ' + Object.entries(jobs).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => `${k} ${(n / N).toFixed(1)}`).join(', '))
