// Who a pro marries when he is played on screen and says yes to every meeting and every proposal (lifeLoveEvents.ts celebShare, stat
// celebPartner): the share of wives in the public eye, by how far he went and how many honours he won. Every other question as おまかせ.
// Run: N=600 node scripts/celebstats.ts   (STARS=10: potential-mode lives of that ★; ONLY=celeb: he asks out only people in the public eye)
import { createLife, endYear, planYear, resolveDecision, type Sim } from '../src/engine/life.ts'
import { defaultParams } from '../src/engine/params.ts'
import { hashSeed } from '../src/engine/rng.ts'
import { isCeleb } from '../src/engine/family.ts'
import { honourPoints } from '../src/engine/lifeLoveEvents.ts'

const N = Number(process.env.N ?? 600)
const STARS = Number(process.env.STARS ?? 0)
const sim: Sim = { params: defaultParams() }
const groups = new Map<string, { lives: number; married: number; celeb: number; met: number; metCeleb: number }>()
for (let i = 0; i < N; i++) {
  const s = createLife({ seed: hashSeed(i + 4_000_000), country: 'JP', pace: 'p15', ...(STARS ? { mode: 'potential' as const, stars: STARS } : {}) })
  let met = 0
  let metCeleb = 0
  for (let g = 0; g < 130 && s.alive; g++) {
    let d = planYear(s, sim).decision?.decision
    while (d && s.alive) {
      if (d.id === 'life.meet') {
        met++
        if (/テレビで見ていた人/.test(d.body)) metCeleb++
      }
      // ONLY=celeb: ask out only people in the public eye
      const ask = process.env.ONLY === 'celeb' ? /テレビで見ていた人/.test(d.body) : true
      const yes = (d.id === 'life.meet' && ask) || d.id === 'life.proposal' || d.id === 'love.propose'
      d = resolveDecision(s, yes ? 0 : d.autoIndex, sim).followUp?.decision
    }
    endYear(s)
  }
  if (s.career.highestRank < 8) continue
  const pts = honourPoints(s)
  const key = pts === 0 ? '1軍・タイトルなし' : pts < 0.2 ? '1軍・タイトル少し' : '1軍・タイトル多い'
  const g = groups.get(key) ?? { lives: 0, married: 0, celeb: 0, met: 0, metCeleb: 0 }
  g.lives++
  g.met += met
  g.metCeleb += metCeleb
  if (s.family.everMarried) g.married++
  if (isCeleb(s.family.wifeJob)) g.celeb++
  groups.set(key, g)
}
const pct = (a: number, b: number) => `${b ? ((100 * a) / b).toFixed(1) : '-'}%`
for (const [k, g] of groups)
  console.log(`${k}: ${g.lives} lives, meetings ${(g.met / g.lives).toFixed(2)} a life (${pct(g.metCeleb, g.met)} in the public eye), married ${pct(g.married, g.lives)}, wife in the public eye ${pct(g.celeb, g.lives)}`)
