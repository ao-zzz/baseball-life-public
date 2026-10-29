import { describe, expect, it } from 'vitest'
import { EVENTS, createLife, endYear, planYear, prefName, resolveDecision, type Sim } from './life.ts'
import { defaultParams } from './params.ts'
import { hashSeed, makeRng } from './rng.ts'
import type { EventCtx } from './events.ts'
import { FIRST_TEAM_DAYS, FIRST_TEAM_MIN, NPB_MIN_SALARY, firstTeamExtra, nextSalary } from './contract.ts'
import { registeredDays } from './freeAgent.ts'
import { PLACE_UNKNOWN, livingPlace, moveAway, moveUnknown, placeIndex, settleAt } from './place.ts'
import { autoPick, hsShortlist, univShortlist } from './route/schools.ts'
import { initBaseball } from './ability.ts'
import { setResidence } from './countries/index.ts'
import { PREFECTURES } from '../data/jp.ts'
import { schoolById } from '../data/schools/index.ts'
import { STATS } from '../data/stats.ts'
import { shareUrl, readShared } from '../game/shareLink.ts'
import type { Decision, LifeState, StatLine } from './types.ts'

// The round of 2026-10-22 (afternoon): the first team's minimum guarantee, where he lives now, the university list of one school, and
// two questions whose answers ended alike.

const sim: Sim = { params: defaultParams() }
const line = (o: Partial<StatLine>): StatLine => ({ games: 0, pa: 0, ab: 0, h: 0, hr: 0, rbi: 0, sb: 0, outs: 0, k: 0, er: 0, w: 0, l: 0, ...o })

describe('the first team\'s minimum guarantee (2025 charter basis)', () => {
  it('the 支配下 minimum salary and the guarantee are two things: 420万円 and 1,600万円 with 1/150 a day', () => {
    expect(NPB_MIN_SALARY).toBe(420)
    expect(STATS.npbMinSalary.value).toBe(420)
    expect(FIRST_TEAM_MIN).toBe(1600)
    expect(FIRST_TEAM_DAYS).toBe(150)
    expect(STATS.npbFirstTeamMin.value).toBe(1600)
    // the pay floor is the minimum salary, not the guarantee
    expect(nextSalary(430, 0, false, true, 33, -2)).toBe(NPB_MIN_SALARY)
  })

  it('boundaries: below, at and above 1,600万円; 0 and 150 days; never more than 1,600万円 in all', () => {
    expect(firstTeamExtra(420, 0)).toBe(0)
    expect(firstTeamExtra(420, 150)).toBe(1180)
    expect(420 + firstTeamExtra(420, 150)).toBe(1600)
    expect(firstTeamExtra(420, 75)).toBe(590)
    expect(firstTeamExtra(1000, 1)).toBe(4)
    expect(firstTeamExtra(1000, 200)).toBe(600)
    expect(1000 + firstTeamExtra(1000, 400)).toBe(1600)
    expect(firstTeamExtra(1599, 150)).toBe(1)
    expect(firstTeamExtra(1600, 150)).toBe(0)
    expect(firstTeamExtra(1600, 0)).toBe(0)
    expect(firstTeamExtra(2500, 150)).toBe(0)
    for (const sal of [420, 700, 1200, 1599]) for (const d of [0, 1, 30, 149, 150, 151]) expect(sal + firstTeamExtra(sal, d)).toBeLessThanOrEqual(1600)
  })

  it('the days are the game\'s stand-in: a full share of a first-team season is 150 days, no first-team games none', () => {
    expect(registeredDays(line({ games: 60 }), 'batter')).toBe(150)
    expect(registeredDays(line({ games: 140 }), 'batter')).toBe(150)
    expect(registeredDays(line({ games: 30 }), 'batter')).toBe(75)
    expect(registeredDays(line({ games: 20 }), 'reliever')).toBe(75)
    expect(registeredDays(line({ outs: 150 }), 'starter')).toBe(150)
    expect(registeredDays(line({}), 'batter')).toBe(0)
  })

  it('in pro lives: paid only with first-team games and a salary under 1,600万円, beside the salary (once, in the year\'s income)', () => {
    let paid = 0
    let checked = 0
    for (let i = 0; i < 160; i++) {
      const s = createLife({ seed: hashSeed(i + 9_100_000), country: 'JP', pace: 'p15', mode: 'potential', stars: 10 })
      for (let g = 0; g < 45 && s.alive; g++) {
        const plan = planYear(s, { ...sim, headless: true })
        const h = s.career.salaryHist?.at(-1)
        if (h && h.age === s.age && h.kind === 'shihaika') {
          checked++
          const first = s.bb?.rec?.tournaments.find((t) => t.age === s.age && t.level === 'pro')?.line
          if (h.firstTeam) {
            paid++
            expect(h.salary).toBeLessThan(1600)
            expect(h.salary + h.firstTeam).toBeLessThanOrEqual(1600)
            expect(first && first.games > 0).toBe(true)
            // the year's income is the salary and the guarantee (no signing bonus in these years), each once
            if (s.career.draft && s.age > s.career.draft.age + 1) expect(s.income).toBe(h.salary + h.firstTeam)
          } else {
            expect(h.salary >= 1600 || !first || first.games === 0).toBe(true)
          }
          // the salary itself never includes the guarantee
          expect(s.career.salary).toBe(h.salary)
        }
        let d = plan.decision?.decision
        while (d && s.alive) d = resolveDecision(s, d.autoIndex, { ...sim, headless: true }).followUp?.decision
        endYear(s)
      }
      // a 育成 player gets none
      for (const h of s.career.salaryHist ?? []) if (h.kind === 'ikusei') expect(h.firstTeam).toBeUndefined()
    }
    expect(checked).toBeGreaterThan(50)
    expect(paid).toBeGreaterThan(10)
  })
})

describe('where he lives now', () => {
  const at = (age: number): LifeState => {
    const s = createLife({ seed: 21, country: 'JP', pace: 'p15', prefecture: 12 })
    s.age = age
    return s
  }

  it('before any move, the place of birth; after a move, the new place, and the place of birth stays as it was', () => {
    const s = at(35)
    expect(placeIndex(s)).toBe(12)
    expect(livingPlace(s)).toBe(prefName(s))
    const to = moveAway(s, 'far', 1)
    expect(to).not.toBe('東京都')
    expect(PREFECTURES.find((p) => p.name === to)!.region).not.toBe(PREFECTURES[12].region)
    expect(livingPlace(s)).toBe(to)
    expect(prefName(s)).toBe('東京都')
    expect(s.person.prefecture).toBe(12)
  })

  it('a place the model does not know is not named; abroad, the country', () => {
    const s = at(30)
    moveUnknown(s)
    expect(placeIndex(s)).toBe(PLACE_UNKNOWN)
    expect(livingPlace(s)).toBeUndefined()
    setResidence(s, 'US')
    expect(livingPlace(s)).toBe('アメリカ')
  })

  it('a university of another region moves him there; one of his own region he goes to from home', () => {
    const far = at(17)
    settleAt(far, '福岡県')
    expect(livingPlace(far)).toBe('福岡県')
    const near = at(17)
    settleAt(near, '神奈川県')
    expect(livingPlace(near)).toBe('東京都')
  })

  it('the transfer moves the family, and the line names the place where he now lives', () => {
    const s = at(40)
    s.career.phase = 'retired'
    s.after = { edu: 'hs', jobless: 0, home: 'rent', loan: 0, baseballLife: [], community: false, care: false, retired: false, work: { title: '会社員（大手）', industry: 'office', employer: 'large', level: 1, years: 5, satisfaction: 60, regular: true, baseball: false } }
    const def = EVENTS.get('work.transfer')!
    const out: string[] = []
    let asked: { d: Decision; data: Record<string, number | boolean | string> } | undefined
    const ctx: EventCtx = { s, rng: makeRng(3), headless: false, add: (_k, t) => out.push(t), ask: (d, data = {}) => (asked = { d, data }), canAsk: () => true }
    def.run(ctx)
    def.resolve!(ctx, 0, asked!.data)
    const now = livingPlace(s)!
    expect(now).not.toBe('東京都')
    expect(out.join('')).toContain(`${now}の新しい土地に引っ越しました`)
  })

  it('a family that moves in junior high: the high schools he chooses from are those of the new place', () => {
    const s = at(13)
    s.career.phase = 'jhs'
    s.bb = initBaseball(s, makeRng(4))
    const def = EVENTS.get('x.life.moveSchool')!
    const out: string[] = []
    const ctx: EventCtx = { s, rng: makeRng(5), headless: false, add: (_k, t) => out.push(t), ask: () => {}, canAsk: () => true }
    def.resolve!(ctx, 0, { open: '0,1,2' })
    const now = livingPlace(s)!
    expect(now).not.toBe('東京都')
    expect(out.join('')).toContain(now)
    for (const o of hsShortlist(s, 'public', makeRng(6))) expect(schoolById(o.id)!.pref).toBe(now)
  })

  it('a pro has no known home (the game keeps no club ground), a company team of a known prefecture is where he lives', () => {
    let pros = 0
    for (let i = 0; i < 120; i++) {
      const s = createLife({ seed: hashSeed(i + 9_200_000), country: 'JP', pace: 'p15', mode: 'potential', stars: 10 })
      for (let g = 0; g < 26 && s.alive; g++) {
        const plan = planYear(s, { ...sim, headless: true })
        let d = plan.decision?.decision
        while (d && s.alive) d = resolveDecision(s, d.autoIndex, { ...sim, headless: true }).followUp?.decision
        endYear(s)
        if (['pro', 'proMinor'].includes(s.career.phase)) {
          pros++
          expect(livingPlace(s)).toBeUndefined()
          break
        }
      }
    }
    expect(pros).toBeGreaterThan(10)
  })

  it('a life saved before the place was kept: the place of birth, unless its record shows a move or a pro career', () => {
    const s = at(50)
    expect(livingPlace(s)).toBe('東京都')
    s.log.push({ age: 40, year: 2066, kind: 'decision', text: '新しい土地に引っ越しました。近所の人の顔を覚えるところからです。' })
    expect(livingPlace(s)).toBeUndefined()
    const p = at(50)
    p.timeline.push({ age: 25, rank: 7, phase: 'pro', happiness: 60 })
    expect(livingPlace(p)).toBeUndefined()
    // a saved life keeps it as it was (JSON), and the share link still carries the birth only
    const q = at(40)
    moveAway(q, 'rural', 2)
    expect(livingPlace(JSON.parse(JSON.stringify(q)) as LifeState)).toBe(livingPlace(q))
    const url = shareUrl('https://example.test/', q.config)
    expect(readShared(new URL(url).search)).toEqual({ seed: 21, prefecture: 12 })
  })

  it('in lives played to the end, a known place is a real one, and the place of birth never changes', () => {
    for (let i = 0; i < 150; i++) {
      const seed = hashSeed(i + 9_300_000)
      const s = createLife({ seed, country: 'JP', pace: 'p15' })
      const born = s.person.prefecture
      for (let g = 0; g < 130 && s.alive; g++) {
        const plan = planYear(s, sim)
        let d = plan.decision?.decision
        while (d && s.alive) d = resolveDecision(s, d.autoIndex, sim).followUp?.decision
        endYear(s)
      }
      expect(s.person.prefecture).toBe(born)
      const where = livingPlace(s)
      if (where !== undefined) expect([...PREFECTURES.map((p) => p.name), 'アメリカ']).toContain(where)
    }
  })
})

describe('the university list of one school', () => {
  const student = (know: number, z: number, i: number): LifeState => {
    const s = createLife({ seed: hashSeed(i + 7_900_000), country: 'JP', pace: 'p15' })
    s.age = 17
    s.status.knowledge = know
    s.z = z
    s.bb = initBaseball(s, makeRng(i))
    return s
  }

  it('a student far above or below the universities with a team still gets two schools or more; the invitations stay first', () => {
    let lists = 0
    for (let k = 1; k <= 99; k += 4) {
      for (let i = 0; i < 24; i++) {
        const opts = univShortlist(student(k, -1 + (i % 8) * 0.4, i), 'club', makeRng(i + k))
        lists++
        expect(opts.length, `know ${k} #${i}`).toBeGreaterThanOrEqual(2)
        expect(opts[0].method).toBe('sports')
        // おまかせ's answer and the safe school are invitations, as before
        expect(opts[autoPick(opts)].method).toBe('sports')
        expect(opts.find((o) => o.safe)?.method).toBe('sports')
      }
    }
    expect(lists).toBeGreaterThan(500)
  })

  it('the lives that met a list of one (おまかせ): now two choices or more, the school entered the same as before', () => {
    // (found before the fix: 5 of 8,050 lists had one school, in these lives)
    for (const n of [3724, 13770, 14343, 19528, 19728]) {
      const s = createLife({ seed: hashSeed(n + 7_700_000), country: 'JP', pace: 'p15' })
      let seen = 0
      for (let g = 0; g < 22 && s.alive; g++) {
        const plan = planYear(s, { ...sim, headless: true })
        let d = plan.decision?.decision
        while (d && s.alive) {
          if (d.id === 'jp.univPick') {
            seen++
            expect(d.choices.length, `life ${n}`).toBeGreaterThanOrEqual(2)
            // the answer is the invitation, as when it was the only one
            expect(d.choices[d.autoIndex].label).toMatch(/スポーツ推薦/)
          }
          d = resolveDecision(s, d.autoIndex, { ...sim, headless: true }).followUp?.decision
        }
        endYear(s)
      }
      expect(seen, `life ${n}`).toBe(1)
    }
  })
})

describe('two questions whose answers ended alike', () => {
  const snapshot = (s: LifeState) => JSON.stringify([s.status, s.money, s.flags ?? {}, s.taken, s.bb?.confidence, s.bb?.gain])

  it('子どもと野球: every answer leaves its own state, and the words say what happened', () => {
    const base = createLife({ seed: 31, country: 'JP', pace: 'p15' })
    base.age = 38
    base.career.phase = 'retired'
    base.career.highestRank = 4
    base.family = { ...base.family, spouse: { name: '恵子', years: 10 }, everMarried: true, children: 1, kids: [8] }
    const def = EVENTS.get('family.kidBaseball')!
    const results = new Map<number, Set<string>>()
    for (let choice = 0; choice < 2; choice++) {
      for (let seed = 1; seed <= 40; seed++) {
        const s = structuredClone(base)
        const out: string[] = []
        def.resolve!({ s, rng: makeRng(seed), headless: true, add: (_k, t) => out.push(t), ask: () => {}, canAsk: () => true }, choice, {})
        const plays = s.taken.includes('family.kidPlays')
        expect(/学童野球チームに入りました/.test(out.join('')), out.join('')).toBe(plays)
        if (choice === 1) expect(plays).toBe(false)
        ;(results.get(choice) ?? results.set(choice, new Set()).get(choice)!).add(snapshot(s))
      }
    }
    // no result of the first answer is the result of the second
    for (const x of results.get(0)!) expect(results.get(1)!.has(x)).toBe(false)
    expect(results.get(0)!.size).toBe(2)
  })

  it('専門のトレーナー: the short clinic never ends as not going, for a minor (the family pays) as for a man with his own savings', () => {
    for (const age of [15, 24]) {
      const base = createLife({ seed: 41, country: 'JP', pace: 'p15' })
      base.age = age
      base.career.phase = age < 18 ? 'hs' : 'company'
      base.money = 500
      base.person.wealth = 4
      base.bb = initBaseball(base, makeRng(7))
      const def = EVENTS.get('x.trainer.offer')!
      const clinic = new Set<string>()
      const none = new Set<string>()
      for (let seed = 1; seed <= 40; seed++) {
        for (const [choice, into] of [[1, clinic], [2, none]] as const) {
          const s = structuredClone(base)
          const out: string[] = []
          def.resolve!({ s, rng: makeRng(seed), headless: true, add: (_k, t) => out.push(t), ask: () => {}, canAsk: () => true }, choice, { open: '0,1,2' })
          into.add(snapshot(s))
          if (/物足りなさ/.test(out.join(''))) expect(s.bb!.confidence).toBe(base.bb!.confidence - 1)
        }
      }
      for (const x of clinic) expect(none.has(x), `age ${age}`).toBe(false)
    }
  })
})
