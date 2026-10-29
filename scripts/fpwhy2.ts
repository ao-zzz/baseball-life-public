// What happened in fingerprint lives that differ (PROJECT_PLAN §11.65): kept after a release check (releaseShield), drafts and their
// age, 育成 years, decisions asked. Run: node scripts/fpwhy2.ts <seed> [<seed> ...]
import { createLife, endYear, isPlaying, planYear, resolveDecision, type Sim } from '../src/engine/life.ts'
import { defaultParams } from '../src/engine/params.ts'

for (const seed of process.argv.slice(2).map(Number)) {
  let draws: string[] = []
  const sim: Sim = { params: defaultParams(), headless: true, tally: (k, ok) => draws.push(`${k}${ok ? 1 : 0}`) }
  const s = createLife({ seed, country: 'JP', pace: 'p15' })
  const notes: string[] = []
  for (let g = 0; g < 130 && s.alive; g++) {
    draws = []
    const phase = s.career.phase
    const asked: string[] = []
    let d = planYear(s, sim).decision?.decision
    while (d && s.alive) {
      asked.push(d.id)
      d = resolveDecision(s, d.autoIndex, sim).followUp?.decision
    }
    const exit = draws.find((x) => /^jp\.(npbExit|ikuseiExit|amateurExit|indepDraft|companyDraft)/.test(x))
    if (draws.includes('jp.npbExit1') && !asked.includes('jp.release')) notes.push(`${s.age}: shielded (${phase})`)
    if (exit || asked.some((a) => !/^x\./.test(a))) notes.push(`${s.age} ${phase}: ${draws.filter((x) => /Exit|Draft/.test(x)).join(',')} ${asked.join(',')}`)
    endYear(s)
    if (s.career.endedAge !== null && !isPlaying(s)) break
  }
  console.log(`seed ${seed}: ${notes.join(' | ')}`)
}
