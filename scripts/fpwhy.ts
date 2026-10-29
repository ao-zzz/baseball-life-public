// Why one fingerprint life differs: its decisions (おまかせ), career and checks, the same way scripts/fingerprint.ts plays it.
// Run: node scripts/fpwhy.ts <seed>
import { createLife, endYear, isPlaying, planYear, resolveDecision, type Sim } from '../src/engine/life.ts'
import { defaultParams } from '../src/engine/params.ts'

const seed = Number(process.argv[2])
const draws: string[] = []
const sim: Sim = { params: defaultParams(), headless: true, tally: (k, ok) => draws.push(`${k}${ok ? 1 : 0}`) }
const s = createLife({ seed, country: 'JP', pace: 'p15' })
const asked: string[] = []
for (let g = 0; g < 130 && s.alive; g++) {
  let d = planYear(s, sim).decision?.decision
  while (d && s.alive) {
    asked.push(`${s.age}:${d.id}→${d.autoIndex}`)
    d = resolveDecision(s, d.autoIndex, sim).followUp?.decision
  }
  endYear(s)
  if (s.career.endedAge !== null && !isPlaying(s)) break
}
const c = s.career
console.log(JSON.stringify({ highest: c.highestRank, ended: c.endedAge, ach: c.achievements, phases: s.timeline.map((t) => t.phase[0]).join(''), mlbDraws: draws.filter((d) => d.startsWith('jp.mlb')), asked: asked.filter((a) => /mlb|posting|release/.test(a)) }))
