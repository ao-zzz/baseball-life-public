// The rivals of the personal titles (engine/titles.ts): the 1軍 seasons of the game's own players, from lives of the normal mode
// played as おまかせ (seeds apart from the fingerprint's). A title is first place among K players of the league; the other K−1 are
// drawn from these seasons, so a season wins with the chance F(x)^(K−1).
//
// Pools (the same rules as titles.ts: QUALIFY_PA, qualifiedStarter with the SP_QUAL_OUTS written here):
// - bat: batters with the 規定打席 (443 PA): 打率 (×1000), 本塁打, 打点, 盗塁, 安打
// - sp: the game's qualified starters. The game's starters pitch fewer innings than the real ones, so the 規定投球回 is taken in the
//   game's own scale: among the regular starters (role 'starter'), the share with the most innings that the real qualified
//   pitchers are of a league's rotation (npb-leaders.json qualP over six clubs × six starters). spQualOuts is that line.
//   勝利, 防御率 (×100), 奪三振.
// (The game plays every 1軍 pitcher as a starter: careerSeason.ts proType's reliever type is not reached, so there is no relief pool.)
// Few lives of the normal mode reach the 1軍 (about one in a thousand), so the lives are run in parts:
//   PART=/tmp/rivals/p0.json FROM=0 N=200000 node scripts/title-rivals.ts      (one part: the seasons of lives FROM … FROM+N−1)
//   MERGE=/tmp/rivals node scripts/title-rivals.ts                              (all the parts → src/data/title-rivals.json)
// The file of 2026-11-16: 12 parts of 200,000 lives (2,400,000).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createLife, endYear, isPlaying, planYear, resolveDecision, type Sim } from '../src/engine/life.ts'
import { defaultParams } from '../src/engine/params.ts'
import { hashSeed } from '../src/engine/rng.ts'
import { proType } from '../src/engine/careerSeason.ts'
import { QUALIFY_PA } from '../src/engine/titles.ts'
import leaders from '../src/data/npb-leaders.json' with { type: 'json' }

const SEED0 = 7_000_000
/** a league's rotation: six clubs × six starters (NPB's usual six-man rotation; an assumption of the game) */
const ROTATION = 6 * 6

interface Part {
  lives: number
  livesWithSeasons: number
  /** [avg ×1000, hr, rbi, sb, h] */
  bat: number[][]
  /** [outs, w, er, k] */
  sp: number[][]
}

function run(from: number, n: number): Part {
  const sim: Sim = { params: defaultParams(), headless: true }
  const p: Part = { lives: n, livesWithSeasons: 0, bat: [], sp: [] }
  for (let i = from; i < from + n; i++) {
    const s = createLife({ seed: hashSeed(i + SEED0), country: 'JP', pace: 'p15' })
    let any = false
    for (let g = 0; g < 130 && s.alive; g++) {
      let d = planYear(s, sim).decision?.decision
      while (d && s.alive) d = resolveDecision(s, d.autoIndex, sim).followUp?.decision
      // (the season row of this year, and the role it was played in)
      const row = s.bb?.rec?.tournaments.find((t) => t.age === s.age && t.level === 'pro' && t.line)
      if (row && s.career.orgId) {
        any = true
        const type = proType(s)
        const l = row.line
        if (type === 'batter') {
          if (l.pa >= QUALIFY_PA) p.bat.push([Math.round((1000 * l.h) / Math.max(1, l.ab)), l.hr, l.rbi, l.sb, l.h])
        } else if (type === 'starter' && s.bb?.role === 'starter') p.sp.push([l.outs, l.w, l.er, l.k])
      }
      endYear(s)
      if (s.career.endedAge !== null && !isPlaying(s)) break
    }
    if (any) p.livesWithSeasons++
  }
  return p
}

const hist = (xs: number[]): [number, number][] => {
  const m = new Map<number, number>()
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1)
  return [...m].sort((a, b) => a[0] - b[0])
}

if (process.env.MERGE) {
  const dir = process.env.MERGE
  const parts = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as Part & { from: number })
  const all: Part = { lives: 0, livesWithSeasons: 0, bat: [], sp: [] }
  for (const p of parts.sort((a, b) => a.from - b.from)) {
    all.lives += p.lives
    all.livesWithSeasons += p.livesWithSeasons
    all.bat.push(...p.bat)
    all.sp.push(...p.sp)
  }
  // the game's 規定投球回: the innings line of the top share of the regular starters
  const qualShare = leaders.rows.reduce((a, r) => a + r.qualP, 0) / leaders.rows.length / ROTATION
  const outs = all.sp.map((x) => x[0]).sort((a, b) => a - b)
  const spQualOuts = outs[Math.floor(outs.length * (1 - qualShare))] ?? 0
  const spq = all.sp.filter((x) => x[0] >= spQualOuts)
  const col = (rows: number[][], k: number) => rows.map((x) => x[k])
  const pools = {
    bat: { avg: hist(col(all.bat, 0)), hr: hist(col(all.bat, 1)), rbi: hist(col(all.bat, 2)), sb: hist(col(all.bat, 3)), h: hist(col(all.bat, 4)) },
    sp: { w: hist(col(spq, 1)), era: hist(spq.map((x) => Math.round((100 * 27 * x[2]) / Math.max(1, x[0])))), k: hist(col(spq, 3)) },
  }
  const meta = {
    note: 'the 1軍 seasons of the game’s own players (normal mode, おまかせ), the rivals of the personal titles (scripts/title-rivals.ts)',
    lives: all.lives,
    seeds: `hashSeed(${SEED0} + i)`,
    livesWithSeasons: all.livesWithSeasons,
    seasons: { bat: all.bat.length, sp: spq.length, spRegular: all.sp.length },
    qualShare: +qualShare.toFixed(4),
  }
  writeFileSync(new URL('../src/data/title-rivals.json', import.meta.url).pathname, JSON.stringify({ meta, spQualOuts, pools }) + '\n')
  console.log(JSON.stringify(meta))
  console.log('spQualOuts', spQualOuts, `(${(spQualOuts / 3).toFixed(1)} innings)`)
} else {
  const from = Number(process.env.FROM ?? 0)
  const n = Number(process.env.N ?? 200000)
  const p = run(from, n)
  writeFileSync(process.env.PART ?? '/dev/stdout', JSON.stringify({ from, ...p }))
  console.error(`lives ${from}…${from + n - 1}: ${p.livesWithSeasons} with 1軍 seasons; ${p.bat.length} bat, ${p.sp.length} sp`)
}
