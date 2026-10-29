// Event statistics (PROJECT_PLAN §11): plays lives the way the screen does (everyday lines included,
// decisions left to おまかせ) and reports events per period, decisions, choices, repeats and gaps.
// Run: node scripts/eventstats.ts [lives]
import { lifeMetrics, summarize } from '../src/engine/metrics.ts'
import { createLife, endYear, planYear, resolveDecision, type Sim } from '../src/engine/life.ts'
import { defaultParams } from '../src/engine/params.ts'
import { hashSeed } from '../src/engine/rng.ts'

const N = Number(process.argv[2] ?? 3000)
const sim: Sim = { params: defaultParams() }
const lives = []
for (let i = 0; i < N; i++) {
  const s = createLife({ seed: hashSeed(i + 3_300_000), country: 'JP', pace: 'p15' })
  const decisions: { age: number; id: string; choices: number }[] = []
  for (let g = 0; g < 130 && s.alive; g++) {
    const plan = planYear(s, sim)
    for (const e of plan.events) s.log.push(e.entry)
    let d = plan.decision?.decision
    while (d && s.alive) {
      decisions.push({ age: s.age, id: d.id, choices: d.choices.length })
      const r = resolveDecision(s, d.autoIndex, sim)
      for (const e of r.events) s.log.push(e.entry)
      d = r.followUp?.decision
    }
    endYear(s)
  }
  lives.push(lifeMetrics(s, decisions))
}
console.log(summarize(lives))
