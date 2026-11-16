// The coach's road after playing (engine/coaching.ts, events/baseballCareer.ts), as on screen: a life that says yes to every coaching
// offer and every step up (the choice that makes him a coach, a first-team coach, the head coach or a manager), every other question
// as おまかせ. How many former players get an offer, how many coach, how many years, and how many coaching scenes and seasons they see.
// Run: N=600 node scripts/coachstats.ts   (STARS=10: potential-mode lives of that ★)
import { createLife, endYear, planYear, resolveDecision, type Sim } from '../src/engine/life.ts'
import { defaultParams } from '../src/engine/params.ts'
import { hashSeed } from '../src/engine/rng.ts'
import { careerOf } from '../src/engine/careers.ts'
import { coachingSummary } from '../src/engine/coaching.ts'

const N = Number(process.env.N ?? 600)
const STARS = Number(process.env.STARS ?? 0)
const sim: Sim = { params: defaultParams() }
const YES =
  /コーチを引き受ける|監督になる|後任を引き受ける|監督を引き受ける|二軍のコーチとして|独立リーグのコーチなら|一軍のコーチになる|ヘッドコーチを引き受ける|強豪校の監督になる|大学の野球部の監督になる|日本代表のコーチを引き受ける/
type G = { lives: number; offered: number; coached: number; years: number; scenes: number; managers: number; seasons: number; ids: Map<string, number> }
const groups = new Map<string, G>()
for (let i = 0; i < N; i++) {
  const s = createLife({ seed: hashSeed(i + 4_000_000), country: 'JP', pace: 'p15', ...(STARS ? { mode: 'potential' as const, stars: STARS } : {}) })
  let offered = false
  let scenes = 0
  let years = 0
  const seen: string[] = []
  for (let g = 0; g < 130 && s.alive; g++) {
    const p = planYear(s, sim)
    // (the scenes of a coach: his questions and his happenings, by their event ids)
    for (const e of p.events) if (/^x\.(cy|bbc)\./.test(e.entry.eventId ?? '') && /^x\.cy\.(?!retireOffer)|^x\.bbc\.(coach|proCoach|manager|badSeason|firstSquad|afterBench)/.test(e.entry.eventId ?? '')) scenes++
    let d = p.decision?.decision
    while (d && s.alive) {
      const k = d.choices.findIndex((c) => YES.test(c.label))
      if (k >= 0 && /retireOffer|coachHs|coachFromWeekend|proCoachOffer|staffRole|coachTeacher/.test(d.id)) offered = true
      if (k >= 0) seen.push(d.id)
      if (/^x\.(cy|bbc)\./.test(d.id) && !/retireOffer/.test(d.id) && (careerOf(s) === 'coach' || /teacher/i.test(d.id))) scenes++
      d = resolveDecision(s, k >= 0 ? k : d.autoIndex, sim).followUp?.decision
    }
    if (careerOf(s) === 'coach') years++
    endYear(s)
  }
  const r = s.career.highestRank
  const key = r >= 8 ? 'プロ1軍' : r >= 7 ? 'プロ（2軍まで）' : r >= 5 ? '社会人・大学など' : 'それ以下'
  const g = groups.get(key) ?? { lives: 0, offered: 0, coached: 0, years: 0, scenes: 0, managers: 0, seasons: 0, ids: new Map() }
  g.lives++
  if (offered) g.offered++
  if (years > 0) g.coached++
  g.years += years
  g.scenes += scenes
  const sum = coachingSummary(s)
  if (sum) {
    g.managers++
    g.seasons += s.coaching!.seasons.length
  }
  for (const id of seen) g.ids.set(id, (g.ids.get(id) ?? 0) + 1)
  groups.set(key, g)
}
const pct = (a: number, b: number) => `${b ? ((100 * a) / b).toFixed(1) : '-'}%`
for (const [k, g] of groups) {
  const per = (x: number) => (x / Math.max(1, g.coached)).toFixed(1)
  console.log(`${k}: ${g.lives} lives, offered ${pct(g.offered, g.lives)}, coached ${pct(g.coached, g.lives)}; a coach: ${per(g.years)} years, ${per(g.scenes)} scenes; managed a team ${pct(g.managers, g.lives)}, ${(g.seasons / Math.max(1, g.managers)).toFixed(1)} seasons each`)
  console.log('  yes to: ' + [...g.ids].sort((a, b) => b[1] - a[1]).map(([id, n]) => `${id} ${n}`).join(', '))
}
