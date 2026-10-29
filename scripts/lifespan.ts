// Age at death (PROJECT_PLAN §11.62): おまかせ lives against lives that keep the focus on health (重点「健康」) every year, as a
// player can on screen. Mean age at death of those alive at 10, the share reaching 90 and 100, against the life table (jpLifeMaleAt10).
// Run: N=3000 node scripts/lifespan.ts
import { createLife, endYear, planYear, resolveDecision, setFocus, type Sim } from '../src/engine/life.ts'
import { defaultParams } from '../src/engine/params.ts'
import { hashSeed } from '../src/engine/rng.ts'
import { statValue } from '../src/data/stats.ts'

const N = Number(process.env.N ?? 3000)
const sim: Sim = { params: defaultParams(), headless: true }
for (const way of ['おまかせ', '健康重点'] as const) {
  const ages: number[] = []
  for (let i = 0; i < N; i++) {
    const s = createLife({ seed: hashSeed(i + 3_500_000), country: 'JP', pace: 'p15' })
    for (let g = 0; g < 130 && s.alive; g++) {
      if (way === '健康重点') setFocus(s, 'rest')
      let d = planYear(s, sim).decision?.decision
      while (d && s.alive) d = resolveDecision(s, d.autoIndex, sim).followUp?.decision
      endYear(s)
    }
    if (s.age >= 10) ages.push(s.age)
  }
  const mean = ages.reduce((a, b) => a + b, 0) / ages.length
  const share = (a: number) => ((ages.filter((x) => x >= a).length / ages.length) * 100).toFixed(1)
  console.log(`${way}: mean age at death ${mean.toFixed(1)} (life table ${statValue('jpLifeMaleAt10')}); reached 90: ${share(90)}%, 100: ${share(100)}%, 105: ${share(105)}%; n=${ages.length}`)
}
