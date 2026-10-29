// Who is still playing when old (PROJECT_PLAN §11.65: "68歳で160km/h"): おまかせ lives of each country, normal and potential ★10, the
// highest age still in a playing phase, its phase, and the pitch speed the screen would show then. Run: N=2000 node scripts/oldplayers.ts
import { createLife, endYear, isPlaying, planYear, resolveDecision, type Sim } from '../src/engine/life.ts'
import { defaultParams } from '../src/engine/params.ts'
import { hashSeed } from '../src/engine/rng.ts'
import { velocityKmh } from '../src/engine/ability.ts'
import type { CountryCode } from '../src/data/types.ts'

const N = Number(process.env.N ?? 2000)
const sim: Sim = { params: defaultParams(), headless: true }
for (const cc of ['JP', 'US', 'KR', 'CU'] as CountryCode[]) {
  for (const stars of [0, 10]) {
    let over40 = 0
    let maxAge = 0
    let maxAt = ''
    const fast: string[] = []
    for (let i = 0; i < N; i++) {
      const s = createLife({ seed: hashSeed(i + 8_100_000), country: cc, pace: 'p15', ...(stars ? { mode: 'potential' as const, stars } : {}) })
      let last = 0
      for (let g = 0; g < 130 && s.alive; g++) {
        let d = planYear(s, sim).decision?.decision
        while (d && s.alive) d = resolveDecision(s, d.autoIndex, sim).followUp?.decision
        if (isPlaying(s)) {
          last = s.age
          if (s.age >= 36 && s.person.position === 'P' && s.bb) {
            const v = velocityKmh(s)
            if (v >= 150) fast.push(`${s.age}歳 ${s.career.phase} ${v}km/h`)
          }
          if (s.age > maxAge) {
            maxAge = s.age
            maxAt = `${s.career.phase} (seed ${s.config.seed})`
          }
        }
        endYear(s)
        if (s.career.endedAge !== null && !isPlaying(s) && s.age > 45) break
      }
      if (last >= 40) over40++
    }
    console.log(`${cc} ${stars ? `★${stars}` : 'normal'}: playing at 40+ ${over40}/${N}; oldest playing ${maxAge} in ${maxAt}; pitchers 36+ at 150+ km/h: ${fast.length} ${fast.slice(0, 6).join(' / ')}`)
  }
}
