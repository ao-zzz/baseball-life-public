// NPB releases (PROJECT_PLAN §11.62): over おまかせ lives up to the end of baseball (the fingerprint's seeds), the release rate per
// 支配下 pro year, the share of 1st/2nd-round picks released within their first two years, and how long a pro career lasts.
// Run: N=10000 node scripts/releasestats.ts   (STARS=10: potential-mode lives of that ★)
import { createLife, endYear, isPlaying, planYear, resolveDecision, type Sim } from '../src/engine/life.ts'
import { defaultParams } from '../src/engine/params.ts'
import { hashSeed } from '../src/engine/rng.ts'

const N = Number(process.env.N ?? 10000)
const sim: Sim = { params: defaultParams(), headless: true }
let proYears = 0
let releases = 0
let high = 0
let highEarly = 0
let careers = 0
let careerYears = 0
for (let i = 0; i < N; i++) {
  const stars = Number(process.env.STARS ?? 0)
  const s = createLife({ seed: hashSeed(i + 4_000_000), country: 'JP', pace: 'p15', ...(stars ? { mode: 'potential' as const, stars } : {}) })
  let pro = 0
  let firstPro = -1
  let releasedAt = -1
  for (let g = 0; g < 130 && s.alive; g++) {
    const wasPro = s.career.phase === 'pro'
    let d = planYear(s, sim).decision?.decision
    while (d && s.alive) {
      if (d.id === 'jp.release' && wasPro && releasedAt < 0) releasedAt = s.age
      d = resolveDecision(s, d.autoIndex, sim).followUp?.decision
    }
    if (wasPro) {
      pro++
      if (firstPro < 0) firstPro = s.age
    }
    endYear(s)
    if (s.career.endedAge !== null && !isPlaying(s)) break
  }
  if (!pro) continue
  careers++
  careerYears += pro
  proYears += pro
  if (releasedAt >= 0) releases++
  const d = s.career.draft
  if (d && d.kind === 'shihaika' && d.round <= 2 && d.status === 'signed') {
    high++
    if (releasedAt >= 0 && releasedAt - firstPro <= 1) highEarly++
  }
}
console.log(`支配下 pro careers ${careers}; first releases per pro year ${(releases / proYears * 100).toFixed(2)}% (${releases}/${proYears}); mean years as a 支配下 pro ${(careerYears / careers).toFixed(2)}; 1st/2nd-round picks ${high}, released within 2 years ${highEarly} (${high ? ((highEarly / high) * 100).toFixed(1) : 0}%)`)
