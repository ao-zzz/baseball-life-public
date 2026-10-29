import { describe, expect, it } from 'vitest'
import { createLife, endYear, planYear, resolveDecision, type Sim } from './life.ts'
import { defaultParams } from './params.ts'
import { hashSeed, makeRng } from './rng.ts'
import type { Decision, LifeState } from './types.ts'
import { ALL_SCHOOLS, HIGH_SCHOOLS, UNIVERSITIES, admitsMale, koshienOf, schoolById } from '../data/schools/index.ts'
import { PREFECTURES } from '../data/jp.ts'
import { METHOD_LABEL, generalP, hsShortlist, optionHint, recommendP, sitExam, sportsP, studentDev, univShortlist, type Option } from './route/schools.ts'
import { DEVIATIONS } from '../data/schools/deviation.ts'

// Entering real schools (PROJECT_PLAN §11.11): names are real, the chances are game assumptions, the
// calibrated career stays as it was (scripts/fingerprint.ts), and the university routes work.

interface Played {
  s: LifeState
  decisions: { age: number; d: Decision }[]
  tallies: { age: number; key: string }[]
}

function play(seed: number, until: number, choose?: (d: Decision, s: LifeState) => number | undefined): Played {
  const tallies: Played['tallies'] = []
  const s = createLife({ seed, country: 'JP', pace: 'p15' })
  const sim: Sim = { params: defaultParams(), tally: (key) => tallies.push({ age: s.age, key }) }
  const decisions: Played['decisions'] = []
  for (let g = 0; g < 130 && s.alive && s.age < until; g++) {
    const plan = planYear(s, sim)
    for (const e of plan.events) s.log.push(e.entry)
    let d = plan.decision?.decision
    while (d && s.alive) {
      decisions.push({ age: s.age, d })
      const r = resolveDecision(s, choose?.(d, s) ?? d.autoIndex, sim)
      for (const e of r.events) s.log.push(e.entry)
      d = r.followUp?.decision
    }
    endYear(s)
  }
  return { s, decisions, tallies }
}

const LIVES = Array.from({ length: 500 }, (_, i) => play(hashSeed(i + 910_000), 30))
const withHs = LIVES.filter((l) => l.s.schools?.hs)
const withUniv = LIVES.filter((l) => l.s.schools?.univ)

describe('the high school', () => {
  it('is a real school of the player’s own prefecture, never a girls’ school, and found in most lives', () => {
    expect(withHs.length).toBeGreaterThan(LIVES.length * 0.6)
    for (const { s } of withHs) {
      const h = schoolById(s.schools!.hs!.id)!
      expect(h.kind).toBe('hs')
      expect(h.name).toBe(s.schools!.hs!.name)
      // (a スポーツ推薦 may come from a powerhouse of another prefecture, PROJECT_PLAN §11.62–63; every other way in is a school of his own)
      if (s.schools!.hs!.method !== 'sports') expect(h.pref, `seed ${s.config.seed}`).toBe(PREFECTURES[s.person.prefecture].name)
      else expect(koshienOf(h.id) || h.pref === PREFECTURES[s.person.prefecture].name, `seed ${s.config.seed}`).toBeTruthy()
      expect(admitsMale(h)).toBe(true)
      expect(['general', 'recommend', 'sports']).toContain(s.schools!.hs!.method)
    }
  })

  it('every way in is used, and a failed first choice is a bad line without a school name', () => {
    const methods = new Set(withHs.map((l) => l.s.schools!.hs!.method))
    // (no school recommendation at this age: the sports recommendation and the entrance examination only)
    expect(methods).toEqual(new Set(['general', 'sports']))
    const fell = withHs.filter((l) => l.s.schools!.hs!.fellBack)
    expect(fell.length).toBeGreaterThan(5)
    expect(fell.length).toBeLessThan(withHs.length * 0.5)
    for (const { s } of fell) expect(s.log.some((e) => e.kind === 'bad' && e.text === '第一志望の高校は不合格でした。')).toBe(true)
  })

  it('the team name of a high school player is the real school', () => {
    let n = 0
    for (const { s } of LIVES) {
      const t = s.timeline.find((x) => x.phase === 'hs')
      if (!t || !s.schools?.hs) continue
      n++
      expect(s.log.some((e) => e.text.includes(s.schools!.hs!.name))).toBe(true)
    }
    expect(n).toBeGreaterThan(50)
  })

  it('a strong-school offer comes as a スポーツ推薦 to a private school', () => {
    const strong = withHs.filter((l) => l.s.career.strongSchool)
    expect(strong.length).toBeGreaterThan(5)
    for (const { s } of strong) {
      expect(s.schools!.hs!.method).toBe('sports')
      expect(schoolById(s.schools!.hs!.id)!.owner).toBe('private')
    }
  })
})

describe('chances (game assumptions)', () => {
  const base = createLife({ seed: 1, country: 'JP', pace: 'p15' })
  const withK = (k: number, z = 0): LifeState => ({ ...base, status: { ...base.status, knowledge: k }, z, career: { ...base.career, achievements: [] } })

  it('一般入試 depends on the player’s level against the school’s 偏差値', () => {
    expect(generalP(withK(70), 55)).toBeGreaterThan(generalP(withK(40), 55))
    expect(generalP(withK(50), 45)).toBeGreaterThan(generalP(withK(50), 65))
    expect(studentDev(withK(50))).toBe(50)
  })

  it('スポーツ推薦 follows baseball ability and record, with no 偏差値 in it', () => {
    expect(sportsP(withK(50, 2))).toBeGreaterThan(sportsP(withK(50, -1)))
    expect(sportsP.length).toBe(1)
    const kosh = withK(50, 0.5)
    const plain = sportsP(kosh)
    kosh.career.achievements = ['甲子園']
    expect(sportsP(kosh)).toBeGreaterThan(plain)
    // knowledge does not matter for it
    expect(sportsP(withK(20, 1))).toBe(sportsP(withK(90, 1)))
  })

  it('学校推薦 follows knowledge and standing; a far-out-of-reach school is much less likely', () => {
    expect(recommendP(withK(70), 50)).toBeGreaterThan(recommendP(withK(35), 50))
    expect(recommendP(withK(50), 80)).toBeLessThan(recommendP(withK(50), 50))
  })

  it('there is always a safe school he is likely to get into, whatever his level', () => {
    let good = 0
    let total = 0
    for (let i = 0; i < 300; i++) {
      const s = createLife({ seed: hashSeed(i + 5_000), country: 'JP', pace: 'p15' })
      s.status.knowledge = [25, 40, 55, 70, 85][i % 5]
      const r = makeRng(i + 1)
      for (const [kind, opts] of [['hs', hsShortlist(s, 'public', r)], ['univ', univShortlist(s, 'student', r)]] as const) {
        const safe = opts.find((o) => o.safe)
        expect(safe, `${kind} ${i}`).toBeDefined()
        // (a player with very little knowledge has no easy way in: the fallback is guaranteed anyway)
        if (s.status.knowledge < 40) continue
        total++
        if (safe!.p >= 0.6) good++
      }
    }
    expect(good / total).toBeGreaterThan(0.8)
  })

  it('a school without a published 偏差値 shows none, and a published one shows its basis', () => {
    const o = (published: boolean, floor?: boolean): Option => ({ id: 'x', name: 'x', method: 'general', p: 0.5, dev: 52.5, published, floor, src: 'keinetRanking2027', muni: '', owner: 'private' })
    expect(optionHint(o(false))).toContain('偏差値は未収録')
    expect(optionHint(o(false))).not.toMatch(/\d\d\.\d/)
    expect(optionHint(o(true))).toMatch(/偏差値 52\.5（河合塾・2027年度入試のボーダー予想の学科の中央値）/)
    expect(optionHint(o(true, true))).toContain('37.4以下')
    expect(optionHint(o(true))).toContain('ゲーム上の仮定')
  })
})

describe('university routes', () => {
  it('a player who goes on with baseball chooses a university with a スポーツ推薦 offer and joins the team', () => {
    const club = withUniv.filter((l) => l.s.schools!.univ!.club === 'club')
    expect(club.length).toBeGreaterThan(5)
    for (const { s, decisions } of club) {
      const pick = decisions.find((x) => x.d.id === 'jp.univPick')
      expect(pick, `seed ${s.config.seed}`).toBeDefined()
      expect(pick!.d.choices.some((c) => c.label.includes(METHOD_LABEL.sports))).toBe(true)
      expect(s.timeline.some((t) => t.phase === 'univ')).toBe(true)
      expect(UNIVERSITIES.some((u) => u.id === s.schools!.univ!.id && admitsMale(u))).toBe(true)
    }
  })

  it('a player who stops chooses by 一般入試 or 学校推薦 (no スポーツ推薦) and then what to do with baseball', () => {
    const students = withUniv.filter((l) => l.s.schools!.univ!.club !== 'club' && l.s.schools!.univ!.club !== 'returned')
    expect(students.length).toBeGreaterThan(20)
    const clubs = new Set(students.map((l) => l.s.schools!.univ!.club))
    expect(clubs).toEqual(new Set(['circle', 'none']))
    for (const { s, decisions } of students) {
      const pick = decisions.find((x) => x.d.id === 'jp.univPick')
      if (pick) expect(pick.d.choices.some((c) => c.label.includes(METHOD_LABEL.sports))).toBe(false)
      expect(s.schools!.univ!.method).not.toBe('sports')
    }
  })

  it('universities with and without a published 偏差値 are both chosen', () => {
    const picks = withUniv.map((l) => l.s.schools!.univ!)
    const has = (id: string) => DEVIATIONS.some((d) => d.schoolId === id)
    expect(picks.some((p) => has(p.id))).toBe(true)
    expect(picks.some((p) => !has(p.id))).toBe(true)
    for (const p of picks) expect(ALL_SCHOOLS.find((x) => x.id === p.id)?.kind).toBe('univ')
  })

  it('a student can go back to the team, and then the calibrated checks are not drawn for him', () => {
    // a life that stopped playing, studies at a university, and says yes to the team
    let found: Played | undefined
    for (let i = 0; i < 4000 && !found; i++) {
      const seed = hashSeed(i + 930_000)
      const l = play(seed, 26, (d) => (d.id === 'univ.return' ? 0 : d.id === 'jp.univClub' ? 0 : undefined))
      if (l.s.schools?.univ?.club === 'returned') found = l
    }
    expect(found, 'no life returned to the team').toBeDefined()
    const s = found!.s
    expect(s.taken).toContain('univ.returnee')
    expect(s.log.some((e) => e.text.startsWith('野球部に入り直しました'))).toBe(true)
    const back = found!.decisions.find((x) => x.d.id === 'univ.return')!.age
    // from the year after, no univ-phase check of the calibration is tallied
    const after = found!.tallies.filter((t) => t.age > back && /univStay|univFile|univDraft|univCompanyShare|univIndepShare/.test(t.key))
    expect(after).toEqual([])
    // and he plays in the university team again (a league season in the record)
    expect(s.bb!.rec!.tournaments.some((t) => t.level === 'univ' && t.age > back)).toBe(true)
  })

  it('a team player who leaves the team keeps studying at the same university', () => {
    const left = withUniv.filter((l) => l.s.schools!.univ!.club === 'club' && l.s.career.endedAge !== null && l.s.career.endedAge <= 21)
    for (const { s } of left) expect(s.schools!.univ!.name).toBeTruthy()
    expect(left.length).toBeGreaterThan(0)
  })
})

describe('the published 偏差値 are what the entrance decisions use', () => {
  const lifeWith = (i: number, knowledge: number): LifeState => {
    const s = createLife({ seed: hashSeed(i + 7_000), country: 'JP', pace: 'p15' })
    s.status.knowledge = knowledge
    return s
  }
  const published = (id: string) => DEVIATIONS.find((d) => d.schoolId === id)

  it('high school: the difficulty of an option is the school’s published value, and the chance follows it', () => {
    let usedValue = 0
    let total = 0
    for (let i = 0; i < 300; i++) {
      const s = lifeWith(i, 60)
      for (const o of hsShortlist(s, 'public', makeRng(i + 1))) {
        total++
        const row = published(o.id)
        if (row) {
          usedValue++
          expect(o.published).toBe(true)
          expect(o.dev).toBe(row.value)
          expect(row.sourceId).toBe('jukelabo2026')
          if (o.method === 'general') expect(o.p).toBe(generalP(s, row.value))
        } else {
          expect(o.published).toBe(false)
        }
      }
    }
    expect(usedValue / total).toBeGreaterThan(0.7)
  })

  it('a more able student is placed in harder schools by 一般入試, for high schools and universities alike', () => {
    const reachable = (kind: 'hs' | 'univ', k: number) => {
      let sum = 0
      let n = 0
      for (let i = 0; i < 300; i++) {
        const s = lifeWith(i, k)
        const opts = kind === 'hs' ? hsShortlist(s, 'public', makeRng(i + 1)) : univShortlist(s, 'student', makeRng(i + 1))
        const ok = opts.filter((o) => o.method === 'general' && o.p >= 0.45)
        if (ok.length) {
          sum += Math.max(...ok.map((o) => o.dev))
          n++
        }
      }
      return sum / n
    }
    expect(reachable('hs', 80) - reachable('hs', 30)).toBeGreaterThan(8)
    expect(reachable('univ', 80) - reachable('univ', 30)).toBeGreaterThan(8)
  })

  it('スポーツ推薦 is picked by baseball level, never by 偏差値: other knowledge, same offers; the safe one is a sure place', () => {
    let harder = 0
    let total = 0
    for (let i = 0; i < 300; i++) {
      const lo = lifeWith(i, 30)
      const hi = lifeWith(i, 80)
      lo.z = hi.z = 1.5
      for (const kind of ['hs', 'univ'] as const) {
        const pick = (s: LifeState) => (kind === 'hs' ? hsShortlist(s, 'strong', makeRng(i + 1)) : univShortlist(s, 'club', makeRng(i + 1))).filter((o) => o.method === 'sports')
        const a = pick(lo)
        const b = pick(hi)
        expect(a.length, kind).toBeGreaterThan(0)
        expect(a.map((o) => o.id), `${kind} ${i}`).toEqual(b.map((o) => o.id))
        // an invitation is not a place: only the safest one is (nearly) sure
        const safe = a.find((o) => o.safe)!
        expect(safe.p).toBeGreaterThanOrEqual(0.9)
        for (const o of a) expect(o.p).toBeGreaterThan(0.02)
        total++
        // and they can lie above his own level: the 偏差値 does not bar the door
        if (a.some((o) => o.dev > studentDev(lo) + 5)) harder++
      }
    }
    expect(harder / total).toBeGreaterThan(0.5)
  })

  it('the exam draws the chosen school with the chance computed from the value (and falls back when it fails)', () => {
    const s = lifeWith(1, 50)
    const opts = hsShortlist(s, 'public', makeRng(5))
    let passed = 0
    const N = 3000
    for (let i = 0; i < N; i++) if (!sitExam(opts, 0, makeRng(i + 1)).fellBack) passed++
    expect(Math.abs(passed / N - opts[0].p)).toBeLessThan(0.04)
  })
})

describe('names in bad lines, and the data behind them', () => {
  const names = [...HIGH_SCHOOLS, ...UNIVERSITIES].map((s) => s.name)

  it('no school name appears in a bad line', () => {
    const offending: string[] = []
    const pattern = new Set(LIVES.flatMap((l) => (l.s.schools ? [l.s.schools.hs?.name, l.s.schools.univ?.name] : [])).filter((x): x is string => !!x))
    for (const { s } of LIVES) for (const e of s.log) if (e.kind === 'bad' && [...pattern].some((n) => e.text.includes(n))) offending.push(`seed ${s.config.seed}: ${e.text}`)
    expect(offending).toEqual([])
    expect(names.length).toBeGreaterThan(5000)
  })

  it('the first real school is introduced with the note that clubs and chances are assumptions', () => {
    for (const { s } of withHs) {
      const note = s.log.findIndex((e) => e.kind === 'note' && e.text.startsWith('学校名は実在'))
      const first = s.log.findIndex((e) => e.text.includes(s.schools!.hs!.name))
      expect(note, `seed ${s.config.seed}`).toBeGreaterThanOrEqual(0)
      expect(note).toBeLessThanOrEqual(first)
    }
  })
})


describe('the recommendation list follows the player\'s own level (PROJECT_PLAN §11.51)', () => {
  const lifeAt = (i: number, z: number, knowledge = 50, junior = 0.4): LifeState => {
    const s = createLife({ seed: hashSeed(i + 8_000), country: 'JP', pace: 'p15' })
    s.z = z
    s.status.knowledge = knowledge
    if (s.bb) s.bb.teamStrength = junior
    return s
  }
  const best = (o: Option[]) => Math.max(...o.map((x) => x.rating ?? 0))
  const lists = (z: number, knowledge = 50, junior = 0.4) => Array.from({ length: 150 }, (_, i) => hsShortlist(lifeAt(i, z, knowledge, junior), 'strong', makeRng(i + 1)))

  it('one to three schools, no school twice, every one a real school of the list', () => {
    for (const z of [0.8, 1.5, 2.4]) {
      for (const o of lists(z)) {
        expect(o.length).toBeGreaterThanOrEqual(1)
        expect(o.length).toBeLessThanOrEqual(3)
        expect(new Set(o.map((x) => x.id)).size).toBe(o.length)
        for (const x of o) {
          expect(schoolById(x.id), x.id).toBeDefined()
          expect(x.method).toBe('sports')
        }
      }
    }
  })

  it('a stronger player is offered stronger schools, and a top player always has a powerhouse to choose', () => {
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
    const lo = mean(lists(0.9).map(best))
    const mid = mean(lists(1.6).map(best))
    const hi = mean(lists(2.5).map(best))
    expect(mid).toBeGreaterThan(lo)
    expect(hi).toBeGreaterThan(mid)
    // a powerhouse (the strength of a regular 甲子園 school) is among a top player's options
    expect(lists(2.5).filter((o) => best(o) >= 1.3).length / 150).toBeGreaterThan(0.9)
  })

  it('a player of a middling level is not crowded with powerhouses', () => {
    const l = lists(0.7)
    expect(l.filter((o) => best(o) >= 1.4).length / l.length).toBeLessThan(0.25)
  })

  it('a strong player of a weak junior team is no longer given weak schools', () => {
    const weak = lists(2.2, 50, 0.1)
    const strong = lists(2.2, 50, 1.0)
    const m = (ls: Option[][]) => ls.reduce((a, o) => a + best(o), 0) / ls.length
    expect(m(weak)).toBeGreaterThan(1.2)
    // (the junior team still counts a little)
    expect(m(strong) - m(weak)).toBeLessThan(0.4)
  })

  it('the safe school stays: the last is a sure place, and a modest school can be chosen on screen', () => {
    for (const o of lists(2.2)) {
      const safe = o.find((x) => x.safe)
      expect(safe).toBeDefined()
      expect(safe!.p).toBeGreaterThanOrEqual(0.9)
      expect(o.some((x) => (x.rating ?? 0) < best(o))).toBe(o.length > 1)
    }
  })

  it('偏差値 does not change it: the same offers for a student of 30 and of 80', () => {
    for (let i = 0; i < 40; i++) {
      const a = hsShortlist(lifeAt(i, 2.0, 30), 'strong', makeRng(i + 1)).map((x) => x.id)
      const b = hsShortlist(lifeAt(i, 2.0, 80), 'strong', makeRng(i + 1)).map((x) => x.id)
      expect(a).toEqual(b)
    }
  })
})