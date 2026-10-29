// Lives whose path after high school was drawn twice before PROJECT_PLAN §11.61 (left baseball at high school's end, no university
// then, and at 18 drawn again): how many, and what their adult life looks like (the 4,000 lives of after.test.ts). Prints one JSON line
// per life of interest so two versions can be compared. Run: node scripts/pathcheck.ts > out.jsonl
import { runHeadless } from '../src/engine/life.ts'
import { defaultParams } from '../src/engine/params.ts'
import { hashSeed } from '../src/engine/rng.ts'

for (let i = 0; i < 4000; i++) {
  const seed = hashSeed(i + 3_500_000)
  const s = runHeadless({ seed, country: 'JP', pace: 'p15' }, { params: defaultParams(), headless: true })
  const at30 = s.timeline.find((t) => t.age === 30)
  console.log(JSON.stringify({ seed, ended: s.career.endedAge, edu: s.after?.edu ?? '', univ: !!s.schools?.univ, married: s.family.marriedAge ?? null, age: s.age, happy30: at30?.happiness ?? null, rel: s.status.relations, income: s.lifetimeIncome }))
}
