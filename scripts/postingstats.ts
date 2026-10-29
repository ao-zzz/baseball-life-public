// How MLB is reached in potential lives (PROJECT_PLAN §11.61): every MLB interest (the jp.mlb check passed) with the right he had
// (overseas FA or posting), his age, first-team seasons, standing and the club's chance, and how it ended. おまかせ answers, the seeds
// of scripts/startrials.ts. Run: N=3000 STARS=9,10 node scripts/postingstats.ts
import { createLife, endYear, isPlaying, planYear, postingChance, resolveDecision, type Sim } from '../src/engine/life.ts'
import { defaultParams } from '../src/engine/params.ts'
import { hashSeed } from '../src/engine/rng.ts'
import { faStatus } from '../src/engine/freeAgent.ts'

const N = Number(process.env.N ?? 3000)
const sim: Sim = { params: defaultParams(), headless: true }
for (const k of (process.env.STARS ?? '9,10').split(',').map(Number)) {
  const asks: { age: number; seasons: number; st: number; p: number; kind: string; ok: boolean }[] = []
  let mlb = 0
  const mlbAge: number[] = []
  for (let i = 0; i < N; i++) {
    const s = createLife({ seed: hashSeed(i + 7_000_000), country: 'JP', pace: 'p15', mode: 'potential', stars: k })
    for (let g = 0; g < 130 && s.alive; g++) {
      let d = planYear(s, sim).decision?.decision
      while (d && s.alive) {
        if (d.id === 'jp.posting' || d.id === 'jp.mlb') {
          const before = s.career.phase
          const rec = { age: s.age, seasons: faStatus(s).seasons, st: Math.round((s.career.proStanding ?? 0) * 10) / 10, p: d.id === 'jp.posting' ? postingChance(s) : 1, kind: d.id === 'jp.posting' ? 'posting' : 'fa', ok: false }
          d = resolveDecision(s, d.autoIndex, sim).followUp?.decision
          rec.ok = before !== 'abroad' && s.career.phase === 'abroad'
          asks.push(rec)
          continue
        }
        d = resolveDecision(s, d.autoIndex, sim).followUp?.decision
      }
      endYear(s)
      if (s.career.endedAge !== null && !isPlaying(s)) break
    }
    if (s.career.highestRank >= 10) {
      mlb++
      mlbAge.push(s.timeline.find((t) => t.phase === 'abroad')?.age ?? -1)
    }
  }
  const by = (f: (a: (typeof asks)[number]) => string) => {
    const m = new Map<string, { n: number; ok: number; p: number }>()
    for (const a of asks) {
      const key = f(a)
      const x = m.get(key) ?? { n: 0, ok: 0, p: 0 }
      x.n++
      x.ok += a.ok ? 1 : 0
      x.p += a.p
      m.set(key, x)
    }
    return [...m.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, x]) => `${key}: ${x.n} asked, ${x.ok} went (mean p ${(x.p / x.n).toFixed(2)})`).join('; ')
  }
  const ages = mlbAge.reduce((m, a) => m.set(a, (m.get(a) ?? 0) + 1), new Map<number, number>())
  console.log(`★${k}: MLB ${(100 * mlb / N).toFixed(1)}% (${mlb}/${N}); lives asked at least once ${new Set(asks.map((a) => a)).size}`)
  console.log(`  by right: ${by((a) => a.kind)}`)
  console.log(`  posting by seasons: ${by((a) => (a.kind === 'posting' ? String(a.seasons).padStart(2) : 'fa'))}`)
  console.log(`  posting by age: ${by((a) => (a.kind === 'posting' ? String(a.age).padStart(2) : 'fa'))}`)
  console.log(`  posting by standing: ${by((a) => (a.kind === 'posting' ? (a.st >= 2 ? '≥2' : a.st >= 1.2 ? '1.2–2' : a.st >= 0.6 ? '0.6–1.2' : '<0.6') : 'fa'))}`)
  console.log(`  age at the move (model age): ${[...ages.entries()].sort((a, b) => a[0] - b[0]).map(([a, n]) => `${a}:${n}`).join(' ')}`)
}
