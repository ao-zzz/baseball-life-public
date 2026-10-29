import { describe, expect, it } from 'vitest'
import { createLife, endYear, isPlaying, planYear, resolveDecision, runHeadless, type Sim } from './life.ts'
import { defaultParams } from './params.ts'
import { hashSeed } from './rng.ts'
import type { Decision, Level, LifeState, Phase, StatLine } from './types.ts'
import { addLine, emptyLine } from './games.ts'
import { PRO_GAMES, RELEASED_SHARE, SCOUT_VISIT, proType } from './careerSeason.ts'

// Stage 4 (PROJECT_PLAN §11.8): seasons after high school — university, company and independent teams,
// the pro 2軍 and 1軍 — and the scouts' attention. The career steps stay the calibrated checks; the games
// and the attention must agree with them.

const sim: Sim = { params: defaultParams() }

interface Played {
  s: LifeState
  decisions: { age: number; d: Decision; scout?: number }[]
  /** the scouts' attention at the end of each year with a draft */
  drafts: { age: number; scout?: number }[]
}

/** a life played as on screen (decorative lines included, おまかせ), until baseball ends */
function playCareer(seed: number): Played {
  const s = createLife({ seed, country: 'JP', pace: 'p15' })
  const decisions: Played['decisions'] = []
  const drafts: Played['drafts'] = []
  for (let g = 0; g < 130 && s.alive; g++) {
    const plan = planYear(s, sim)
    for (const e of plan.events) s.log.push(e.entry)
    let d = plan.decision?.decision
    while (d && s.alive) {
      decisions.push({ age: s.age, d, scout: s.bb?.scout })
      const r = resolveDecision(s, d.autoIndex, sim)
      for (const e of r.events) s.log.push(e.entry)
      d = r.followUp?.decision
    }
    if (s.log.some((e) => e.age === s.age && /^ドラフト会議で、.*指名されました/.test(e.text))) drafts.push({ age: s.age, scout: s.bb?.scout })
    endYear(s)
    if (s.career.endedAge !== null && !isPlaying(s)) break
  }
  return { s, decisions, drafts }
}

// lives that go past high school, every route represented: found headless, then played with the log
const want = { univ: 60, company: 25, indep: 20, pro: 60, debut: 35 }
const found = { univ: 0, company: 0, indep: 0, pro: 0, debut: 0 }
const LIVES: Played[] = []
const HEADLESS = new Map<number, LifeState>()
for (let i = 0; i < 40_000; i++) {
  if (Object.entries(want).every(([k, n]) => found[k as keyof typeof found] >= n)) break
  const seed = hashSeed(i + 7_700_000)
  const h = runHeadless({ seed, country: 'JP', pace: 'p15' }, sim, true)
  const ph = new Set(h.timeline.map((t) => t.phase))
  const kinds = [ph.has('univ') && 'univ', ph.has('company') && 'company', ph.has('indep') && 'indep', h.career.highestRank >= 6 && 'pro', h.career.proDebut && 'debut'].filter(Boolean) as (keyof typeof found)[]
  if (!kinds.some((k) => found[k] < want[k])) continue
  for (const k of kinds) found[k]++
  LIVES.push(playCareer(seed))
  HEADLESS.set(seed, h)
}

/** the phase a year started in (the timeline records the phase at the end of each year) */
function startPhase(s: LifeState, age: number): Phase | undefined {
  return s.timeline.find((t) => t.age === age - 1)?.phase
}

function saneLine(l: StatLine) {
  for (const v of Object.values(l)) {
    expect(Number.isInteger(v)).toBe(true)
    expect(v).toBeGreaterThanOrEqual(0)
  }
  expect(l.ab).toBeLessThanOrEqual(l.pa)
  expect(l.h).toBeLessThanOrEqual(l.ab)
  expect(l.hr).toBeLessThanOrEqual(l.h)
  expect(l.w + l.l).toBeLessThanOrEqual(l.games)
}

const debutAge = (s: LifeState) => s.log.find((e) => e.text.startsWith('1軍の試合に初めて出場しました'))?.age

describe('careers after high school', () => {
  it('every route is represented', () => {
    for (const k of Object.keys(want) as (keyof typeof want)[]) expect(found[k], k).toBeGreaterThanOrEqual(want[k])
  })

  it('the seasons leave the calibrated career as it was (same as the headless run)', () => {
    for (const { s } of LIVES) {
      const h = HEADLESS.get(s.config.seed)!
      expect(s.career.highestRank, `seed ${s.config.seed}`).toBe(h.career.highestRank)
      expect(s.career.endedAge).toBe(h.career.endedAge)
      expect(s.career.draftedFrom).toBe(h.career.draftedFrom)
      expect(s.career.proDebut).toBe(h.career.proDebut)
      expect(s.career.proSeasons).toBe(h.career.proSeasons)
    }
  })

  it('official totals by level are the sum of the seasons and tournaments, and every line is sane', () => {
    for (const { s } of LIVES) {
      const rec = s.bb?.rec
      if (!rec) continue
      for (const level of ['hs', 'univ', 'amateur', 'farm', 'pro'] as Level[]) {
        const sum = rec.tournaments.filter((t) => (t.level ?? 'hs') === level).reduce((a, t) => addLine(a, t.line), emptyLine())
        expect(rec.official[level] ?? emptyLine(), `seed ${s.config.seed} ${level}`).toEqual(sum)
        saneLine(rec.official[level] ?? emptyLine())
        saneLine(rec.practice[level] ?? emptyLine())
      }
      for (const t of rec.tournaments) saneLine(t.line)
    }
  })
})

describe('university, company and independent seasons', () => {
  it('a university year has a spring and an autumn league, only in the university years', () => {
    let years = 0
    for (const { s } of LIVES) {
      const leagues = (s.bb?.rec?.tournaments ?? []).filter((t) => t.level === 'univ' && t.name.endsWith('のリーグ戦'))
      for (const t of leagues) expect(startPhase(s, t.age), `seed ${s.config.seed} age ${t.age}`).toBe('univ')
      for (const age of new Set(leagues.map((t) => t.age))) {
        years++
        expect(leagues.filter((t) => t.age === age).map((t) => t.name).sort()).toEqual(['春のリーグ戦', '秋のリーグ戦'])
      }
    }
    expect(years).toBeGreaterThan(100)
  })

  it('company and independent seasons happen only on those teams', () => {
    let n = 0
    for (const { s } of LIVES) {
      for (const t of (s.bb?.rec?.tournaments ?? []).filter((x) => x.level === 'amateur')) {
        n++
        expect(['company', 'indep'], `seed ${s.config.seed} age ${t.age}`).toContain(startPhase(s, t.age))
      }
    }
    expect(n).toBeGreaterThan(0)
  })

  it('a company player works for the company from the start and keeps the job when he retires', () => {
    let n = 0
    for (const { s } of LIVES) {
      if (!s.timeline.some((t) => t.phase === 'company')) continue
      const jobs = s.after?.jobs ?? []
      expect(jobs[0], `seed ${s.config.seed}`).toBe('会社員（社会人野球部）')
      if (s.career.highestRank >= 6) continue // drafted: he left the company for pro baseball
      n++
      expect(jobs, `seed ${s.config.seed}`).toContain('会社員（元社会人野球選手）')
      // years of service count from the first company season (the player retires in the year counted last)
      const companyYears = new Set((s.bb?.rec?.tournaments ?? []).filter((t) => t.level === 'amateur' && startPhase(s, t.age) === 'company').map((t) => t.age)).size
      if (s.after?.work?.title === '会社員（元社会人野球選手）') expect(s.after.work.years).toBe(companyYears)
    }
    expect(n).toBeGreaterThan(0)
  })
})

describe('pro: 2軍 and 1軍', () => {
  const pros = LIVES.filter(({ s }) => s.career.highestRank >= 6)

  it('1軍 games start with the first 1軍 game (the calibrated check), and 育成 years are 2軍 only', () => {
    for (const { s } of pros) {
      const rec = s.bb!.rec!
      const first = rec.tournaments.filter((t) => t.level === 'pro')
      const debut = debutAge(s)
      expect(s.career.proDebut, `seed ${s.config.seed}`).toBe(debut !== undefined)
      expect((rec.official.pro?.games ?? 0) > 0).toBe(s.career.proDebut)
      if (debut !== undefined) expect(first.some((t) => t.age === debut), `seed ${s.config.seed}: no 1軍 game in the debut year`).toBe(true)
      for (const t of first) {
        expect(t.age, `seed ${s.config.seed}`).toBeGreaterThanOrEqual(debut!)
        expect(startPhase(s, t.age)).not.toBe('proMinor')
      }
      for (const t of rec.tournaments.filter((x) => x.level === 'farm' || x.level === 'pro')) expect(['pro', 'proMinor']).toContain(startPhase(s, t.age))
    }
  })

  it('a 戦力外 year is a part-time one in the 1軍', () => {
    let released = 0
    for (const { s, decisions } of pros) {
      for (const { age } of decisions.filter((x) => x.d.id === 'jp.release' && startPhase(s, x.age) === 'pro')) {
        released++
        const first = s.bb!.rec!.tournaments.find((t) => t.age === age && t.level === 'pro')
        if (first) expect(first.line.games, `seed ${s.config.seed} age ${age}`).toBeLessThanOrEqual(Math.ceil(PRO_GAMES.first[proType(s)] * RELEASED_SHARE))
      }
    }
    expect(released).toBeGreaterThan(5)
  })

  it('1軍 playing time goes with the salary drawn for that year', () => {
    const pairs: [number, number][] = []
    for (const { s } of pros) {
      const debut = debutAge(s)
      if (debut === undefined) continue
      for (const e of s.log) {
        const m = /今季の年俸は([\d,]+)万円です/.exec(e.text)
        if (!m || e.age <= debut || s.log.some((x) => x.age === e.age && /けがと不振|体の衰え/.test(x.text))) continue
        const first = s.bb!.rec!.tournaments.find((t) => t.age === e.age && t.level === 'pro')
        pairs.push([Math.log(Number(m[1].replace(/,/g, ''))), (first?.line.games ?? 0) / PRO_GAMES.first[proType(s)]])
      }
    }
    expect(pairs.length).toBeGreaterThan(50)
    const n = pairs.length
    const mx = pairs.reduce((a, p) => a + p[0], 0) / n
    const my = pairs.reduce((a, p) => a + p[1], 0) / n
    let sxy = 0
    let sxx = 0
    let syy = 0
    for (const [x, y] of pairs) {
      sxy += (x - mx) * (y - my)
      sxx += (x - mx) ** 2
      syy += (y - my) ** 2
    }
    // both follow the same standing (measured 2026-10-18: r = 0.62 over 415 seasons)
    expect(sxy / Math.sqrt(sxx * syy)).toBeGreaterThan(0.4)
  })

  it('season lines stay plausible (model values)', () => {
    for (const { s } of pros) {
      for (const t of s.bb!.rec!.tournaments.filter((x) => x.level === 'pro' || x.level === 'farm')) {
        const l = t.line
        if (l.ab >= 300) {
          expect(l.h / l.ab, `seed ${s.config.seed} age ${t.age}`).toBeGreaterThan(0.15)
          expect(l.h / l.ab).toBeLessThan(0.4)
          expect(l.hr).toBeLessThanOrEqual(60)
        }
        if (l.outs >= 300) {
          expect((l.er * 27) / l.outs, `seed ${s.config.seed} age ${t.age}`).toBeGreaterThan(0.5)
          expect((l.er * 27) / l.outs).toBeLessThan(7)
        }
        expect(l.games).toBeLessThanOrEqual(PRO_GAMES.first.batter)
      }
    }
  })
})

describe('scouts', () => {
  it('the visiting stage matches the 志望届 decision: scouts came exactly when the calibrated check said so', () => {
    let filed = 0
    for (const { s, decisions } of LIVES) {
      for (const { d, scout, age } of decisions.filter((x) => x.d.id === 'jp.hsFile' || x.d.id === 'jp.univFile')) {
        filed++
        const scouted = d.body.startsWith('プロのスカウトが') || d.body.startsWith('大学最後の年。スカウト')
        expect(scout, `seed ${s.config.seed} age ${age}`).toBeDefined()
        expect(scout! >= SCOUT_VISIT, `seed ${s.config.seed} age ${age}: ${d.body} (attention ${scout})`).toBe(scouted)
        if (scouted) expect(s.log.some((e) => e.age === age && e.statIds?.includes('scoutModel'))).toBe(true)
      }
    }
    expect(filed).toBeGreaterThan(10)
  })

  it('every drafted player had the scouts visiting, and below that stage no decision says they came', () => {
    let drafted = 0
    for (const { s, decisions, drafts } of LIVES) {
      for (const x of drafts) {
        drafted++
        expect(x.scout, `seed ${s.config.seed} age ${x.age}`).toBeGreaterThanOrEqual(SCOUT_VISIT)
      }
      for (const { d, scout } of decisions) if (scout !== undefined && scout < SCOUT_VISIT) expect(d.body).not.toMatch(/スカウトが(何度か|何度も)/)
    }
    expect(drafted).toBeGreaterThan(30)
  })

  it('no text promises a draft', () => {
    for (const { s, decisions } of LIVES) {
      for (const e of s.log) expect(e.text).not.toMatch(/指名確実|確実に指名|間違いなく指名/)
      for (const { d } of decisions) expect(`${d.body}${d.choices.map((c) => `${c.label}${c.hint ?? ''}`).join('')}`).not.toMatch(/確実/)
    }
  })
})
