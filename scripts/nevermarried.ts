// The share never married at 50 of the おまかせ lives of after.test.ts (the same 4,000 lives), printed with the statistic it is
// compared to. Run: node scripts/nevermarried.ts   (PROJECT_PLAN §11.61: measuring what a change of the love events does to it)
import { runHeadless } from '../src/engine/life.ts'
import { defaultParams } from '../src/engine/params.ts'
import { hashSeed } from '../src/engine/rng.ts'
import { statValue } from '../src/data/stats.ts'

const lives = Array.from({ length: 4000 }, (_, i) => runHeadless({ seed: hashSeed(i + 3_500_000), country: 'JP', pace: 'p15' }, { params: defaultParams(), headless: true }))
const at50 = lives.filter((s) => s.age > 50)
const never = at50.filter((s) => s.family.marriedAge === undefined || s.family.marriedAge >= 50).length / at50.length
console.log(`never married at 50: ${(never * 100).toFixed(2)}% (statistic ${(statValue('jpNeverMarried50Male') * 100).toFixed(2)}%, gap ${((never - statValue('jpNeverMarried50Male')) * 100).toFixed(2)} points; ${at50.length} lives)`)
