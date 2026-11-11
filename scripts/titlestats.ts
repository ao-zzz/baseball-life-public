// The 1軍 seasons of NPB players against the real league leaders (src/data/npb-leaders.json): how high the game's seasons go, and how
// often a season would reach a leader's figure (the personal titles, engine/titles.ts). Over おまかせ lives (the fingerprint's seeds).
// Run: N=20000 node scripts/titlestats.ts   (STARS=10: potential-mode lives of that ★)
import { createLife, endYear, isPlaying, planYear, resolveDecision, type Sim } from '../src/engine/life.ts'
import { defaultParams } from '../src/engine/params.ts'
import { hashSeed } from '../src/engine/rng.ts'
import type { StatLine } from '../src/engine/types.ts'
import leaders from '../src/data/npb-leaders.json' with { type: 'json' }

const N = Number(process.env.N ?? 20000)
const STARS = Number(process.env.STARS ?? 0)
const sim: Sim = { params: defaultParams(), headless: true }
const bat: StatLine[] = []
const pit: StatLine[] = []
let lives = 0
let livesWith = 0
const won = new Map<string, number>()
for (let i = 0; i < N; i++) {
  const s = createLife({ seed: hashSeed(i + 4_000_000), country: 'JP', pace: 'p15', ...(STARS ? { mode: 'potential' as const, stars: STARS } : {}) })
  for (let g = 0; g < 130 && s.alive; g++) {
    let d = planYear(s, sim).decision?.decision
    while (d && s.alive) d = resolveDecision(s, d.autoIndex, sim).followUp?.decision
    endYear(s)
    if (s.career.endedAge !== null && !isPlaying(s)) break
  }
  const rows = (s.bb?.rec?.tournaments ?? []).filter((t) => t.level === 'pro' && t.line)
  if (rows.length) lives++
  for (const t of rows) (s.person.position === 'P' ? pit : bat).push(t.line!)
  for (const h of s.bb?.rec?.honours ?? []) won.set(h.id, (won.get(h.id) ?? 0) + 1)
  if (s.bb?.rec?.honours?.length) livesWith++
}
const L = leaders.rows
const share = (f: (r: (typeof L)[number]) => boolean) => L.filter(f).length / L.length
const pct = (x: number) => `${(100 * x).toFixed(2)}%`
const q = (xs: number[], p: number) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) * p)] : NaN)
const avg = (l: StatLine) => l.h / Math.max(1, l.ab)
const era = (l: StatLine) => (l.er * 27) / Math.max(1, l.outs)
console.log(`lives ${N}, with 1軍 seasons ${lives}; batter seasons ${bat.length}, pitcher seasons ${pit.length}`)
const qualB = bat.filter((l) => l.pa >= 443)
const qualP = pit.filter((l) => l.outs >= 429)
console.log(`qualified: batters ${qualB.length} (${pct(qualB.length / Math.max(1, bat.length))}), pitchers ${qualP.length} (${pct(qualP.length / Math.max(1, pit.length))})`)
const show = (name: string, xs: number[]) => console.log(`${name}: p50 ${q(xs, 0.5)} p90 ${q(xs, 0.9)} p99 ${q(xs, 0.99)} max ${q(xs, 1)}`)
show('AVG (qualified)', qualB.map(avg).map((x) => +x.toFixed(3)))
show('HR', bat.map((l) => l.hr))
show('RBI', bat.map((l) => l.rbi))
show('SB', bat.map((l) => l.sb))
show('H', bat.map((l) => l.h))
show('W', pit.map((l) => l.w))
show('ERA (qualified)', qualP.map(era).map((x) => +x.toFixed(2)))
show('K', pit.map((l) => l.k))
// the chance that a season reaches a leader of a random row (the rule of the titles)
const mean = (xs: StatLine[], f: (l: StatLine) => number) => (xs.length ? xs.reduce((a, l) => a + f(l), 0) / xs.length : 0)
const P = {
  首位打者: mean(bat, (l) => (l.pa >= 443 ? share((r) => avg(l) >= r.avg) : 0)),
  本塁打王: mean(bat, (l) => share((r) => l.hr >= r.hr)),
  打点王: mean(bat, (l) => share((r) => l.rbi >= r.rbi)),
  盗塁王: mean(bat, (l) => share((r) => l.sb >= r.sb)),
  最多安打: mean(bat, (l) => share((r) => l.h >= r.h)),
  最多勝: mean(pit, (l) => share((r) => l.w >= r.w)),
  最優秀防御率: mean(pit, (l) => (l.outs >= 429 ? share((r) => era(l) <= r.era) : 0)),
  最多奪三振: mean(pit, (l) => share((r) => l.k >= r.k)),
}
for (const [k, v] of Object.entries(P)) console.log(`${k}: ${pct(v)} of the seasons`)
// what the game gave (Records.honours): per 1軍 season of that kind of player, and lives with any
console.log(`lives with an honour: ${livesWith} (${pct(livesWith / Math.max(1, lives))} of the lives with 1軍 seasons)`)
const PITCHING = new Set(['w', 'era', 'k', 'nohit', 'perfect'])
for (const [id, n] of [...won].sort((a, b) => b[1] - a[1])) {
  const base = PITCHING.has(id) ? pit.length : ['avg', 'hr', 'rbi', 'sb', 'h'].includes(id) ? bat.length : bat.length + pit.length
  console.log(`${id}: ${n} (${pct(n / Math.max(1, base))} of the seasons)`)
}
