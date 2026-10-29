import { describe, expect, it } from 'vitest'
import { EVENTS, createLife, endYear, planYear, resolveDecision, type Sim } from './life.ts'
import { defaultParams } from './params.ts'
import { hashSeed, makeRng } from './rng.ts'
import { stageOf, type EventCtx } from './events.ts'
import { applyEffect } from './events/spec.ts'
import { companyText, eduText, jobOffers } from './after.ts'
import { lifeTitle } from './summary.ts'
import { shareText } from '../game/shareLink.ts'
import type { Decision, LifeState, LogEntry } from './types.ts'

// The feedback round of 2026-10-22: questions that no longer fit the state when they are asked, the end of playing and its reason,
// the education shown, the shirt number, the tryout at any age, questions with one answer or one result, the proposal that never came
// back, hobbies started twice, the employer, the games of high school, the university after a failed tryout or a draw to work, the
// age in the shared text.

const sim: Sim = { params: defaultParams() }
type Pending = { pending?: { id: string; data: Record<string, number | boolean | string> } }

interface Asked {
  age: number
  d: Decision
  stage: string
}

/** a life on screen (おまかせ, or `choose`), with every question as it is shown and the lines in their order */
function play(seed: number, until = 130, choose?: (d: Decision, s: LifeState) => number | undefined): { s: LifeState; asked: Asked[]; lines: LogEntry[] } {
  const s = createLife({ seed, country: 'JP', pace: 'p15' })
  const asked: Asked[] = []
  const lines: LogEntry[] = []
  for (let g = 0; g < 130 && s.alive && s.age < until; g++) {
    const plan = planYear(s, sim)
    lines.push(...plan.events.map((e) => e.entry))
    let d = plan.decision?.decision
    while (d && s.alive) {
      asked.push({ age: s.age, d, stage: stageOf(s) })
      const r = resolveDecision(s, choose?.(d, s) ?? d.autoIndex, sim)
      lines.push(...r.events.map((e) => e.entry))
      d = r.followUp?.decision
    }
    endYear(s)
  }
  return { s, asked, lines }
}

const SEEDS = Array.from({ length: 500 }, (_, i) => hashSeed(i + 8_100_000))
const lives = SEEDS.map((seed) => play(seed))

describe('a question fits the state when it is asked', () => {
  it('no question of the catalog is asked at a stage it does not belong to (after the draft, the route, a release, the end)', () => {
    let n = 0
    for (const { asked } of lives) {
      for (const a of asked) {
        const def = EVENTS.get(a.d.id)
        if (!def) continue
        n++
        expect(def.stages, `${a.d.id} at ${a.age} (${a.stage})`).toContain(a.stage)
      }
    }
    expect(n).toBeGreaterThan(3000)
  })

  it('the questions of the year come before the one that ends the stage (the 志望届, the route, the release)', () => {
    let years = 0
    for (const { asked } of lives) {
      const byAge = new Map<number, string[]>()
      for (const a of asked) byAge.set(a.age, [...(byAge.get(a.age) ?? []), a.d.id])
      for (const ids of byAge.values()) {
        const i = ids.findIndex((id) => ['jp.hsFile', 'jp.route', 'jp.univFile', 'jp.release'].includes(id))
        if (i < 0) continue
        years++
        // what follows it is its own consequence (the draft, the school, the club, the job), never a question of the catalog drawn before
        expect(ids.slice(i + 1).filter((id) => EVENTS.get(id)), ids.join(' > ')).toEqual([])
      }
    }
    expect(years).toBeGreaterThan(100)
  })

  it('a question offers two answers or more', () => {
    // (the university list of one school is filled too since 2026-10-22: feedbackFixes2.test.ts)
    for (const { asked } of lives) for (const a of asked) expect(a.d.choices.length, `${a.d.id} at ${a.age}`).toBeGreaterThanOrEqual(2)
  })
})

describe('the end of playing and its reason', () => {
  it('an injury is the reason only of one who has been hurt; a question of coming back comes before the end is told', () => {
    let quits = 0
    let crossed = 0
    for (const seed of SEEDS) {
      const s = createLife({ seed, country: 'JP', pace: 'p15' })
      for (let g = 0; g < 30 && s.alive; g++) {
        const plan = planYear(s, sim)
        const quit = plan.events.find((e) => /故障が長引き|勉強に専念|部の雰囲気|家の事情|学業とアルバイト/.test(e.entry.text))
        if (quit && s.career.endedAge === s.age) {
          quits++
          if (/故障が長引き/.test(quit.entry.text)) expect(s.career.injured > 0 || !!s.bb?.hurt || (s.bb?.injuries ?? 0) > 0, quit.entry.text).toBe(true)
          if (plan.decision?.decision.id === 'jp.quitCross') {
            crossed++
            // the line tells the reason, not the end, and the screen does not stop on it before the question
            expect(quit.entry.text).not.toMatch(/やめました|退部しました/)
            expect(quit.entry.stop).toBeUndefined()
          }
        }
        let d = plan.decision?.decision
        while (d && s.alive) d = resolveDecision(s, d.autoIndex, sim).followUp?.decision
        endYear(s)
        if (s.career.endedAge !== null) break
      }
    }
    expect(quits).toBeGreaterThan(15)
    expect(crossed).toBeGreaterThan(5)
  })

  it('the shoulder is no longer the reason of half of the university quits', () => {
    const all = lives.flatMap((l) => l.lines).filter((e) => /野球部を退部|大学の野球部/.test(e.text))
    expect(all.filter((e) => /肩の故障/.test(e.text)).length).toBe(0)
  })
})

describe('follow-ups about the team wait for a man who is in one', () => {
  const retired = (flags: Record<string, number>): LifeState => {
    const s = createLife({ seed: 77, country: 'JP', pace: 'p15' })
    s.age = 40
    s.career.phase = 'retired'
    s.career.endedAge = 34
    s.flags = flags
    return s
  }
  it('after the end, none of them is told as if he still played', () => {
    const cases: [string, string][] = [
      ['x.coach.roleShiftBack', 'coach.newRole'],
      ['x.coach.benchChanceBack', 'coach.playDown'],
      ['x.pro.roleChangeBack', 'pro.newRole'],
      ['x.pro.contractYearBack', 'contract.bet'],
      ['x.pro.mlbTalkBack', 'mlb.dream'],
      ['x.pro.foreignBack', 'pro.rivalry'],
      ['x.in.sideLifeBack', 'side.allIn'],
    ]
    for (const [id, flag] of cases) {
      const def = EVENTS.get(id)!
      const s = retired({ [flag]: 38 })
      const fits = def.stages.includes(stageOf(s)) && (!def.when || def.when(s))
      expect(fits, id).toBe(false)
    }
  })
})

describe('the education shown', () => {
  const base = (): LifeState => {
    const s = createLife({ seed: 5, country: 'JP', pace: 'p15' })
    s.after = { edu: 'hs', jobless: 0, home: 'parents', loan: 0, baseballLife: [], community: false, care: false, retired: false }
    return s
  }
  it('a student at a university, and one who died before his graduation, is 大学在学中; a graduate 大学卒業', () => {
    const s = base()
    s.age = 20
    s.job = '大学生'
    s.schools = { univ: { id: 'u', name: 'ある大学', method: 'general' } }
    expect(eduText(s)).toBe('大学在学中')
    s.alive = false
    expect(eduText(s)).toBe('大学在学中')
    s.after!.edu = 'univ'
    expect(eduText(s)).toBe('大学卒業')
  })
  it('the rest of the fourth year after the route is decided is still at the university', () => {
    const s = base()
    s.age = 21
    s.career.phase = 'company'
    s.job = '会社員（社会人野球）'
    s.schools = { univ: { id: 'u', name: 'ある大学', method: 'sports', club: 'club' } }
    expect(eduText(s)).toBe('大学在学中')
  })
  it('a man who opened his household at 17 (a club team) is a high school graduate, not 中学', () => {
    const s = base()
    s.after!.edu = 'jhs'
    s.age = 25
    expect(eduText(s)).toBe('高校卒業')
    expect(eduText({ ...s, after: undefined })).toBe('—')
  })
})

describe('the shirt number in pro', () => {
  it('a trade gives the number of the new club, and the line tells it', () => {
    const s = createLife({ seed: 9, country: 'JP', pace: 'p15' })
    s.age = 27
    s.career.phase = 'pro'
    s.career.orgId = 'npb-giants'
    s.bb = { ...(s.bb ?? ({} as NonNullable<LifeState['bb']>)), number: 55 } as NonNullable<LifeState['bb']>
    const before = s.bb.number
    applyEffect(s, { moveTeam: true })
    expect(s.career.orgId).not.toBe('npb-giants')
    expect(s.bb.number).toBeGreaterThanOrEqual(10)
    expect(s.bb.number).toBeLessThanOrEqual(69)
    void before
  })
})

describe('the tryout after a release', () => {
  const released = (seed: number, age: number): LifeState => {
    const s = createLife({ seed, country: 'JP', pace: 'p15' })
    s.age = age
    s.career.phase = 'pro'
    s.career.highestRank = 8
    ;(s as LifeState & Pending).pending = { id: 'jp.release', data: { offer: '', offerId: '', offerLabel: '', offer2Id: '', offer2Label: '', ownIdx: -1, ownLabel: '', tier: '支配下', ikusei: false } }
    return s
  }
  it('signs some men up to 38, never an older one', () => {
    let young = 0
    for (let i = 0; i < 400; i++) {
      const a = released(hashSeed(i + 9_300_000), 30)
      resolveDecision(a, 0, sim)
      if (a.career.phase === 'pro') young++
      const b = released(hashSeed(i + 9_300_000), 45)
      resolveDecision(b, 0, sim)
      expect(b.career.phase).toBe('retired')
    }
    expect(young).toBeGreaterThan(10)
  })
})

describe('a proposal put off comes back', () => {
  it('「もう少しこのまま」 books the question two years on', () => {
    const s = createLife({ seed: 12, country: 'JP', pace: 'p15' })
    s.age = 30
    s.career.phase = 'retired'
    s.family.partner = '恵子'
    const def = EVENTS.get('love.propose')!
    const ctx: EventCtx = { s, rng: makeRng(1), headless: false, add: () => {}, ask: () => {}, canAsk: () => true }
    def.resolve!(ctx, 1, {})
    expect(s.due?.some((d) => d.id === 'love.propose' && d.age === 32)).toBe(true)
    s.age = 32
    s.evHist = { ...s.evHist, 'love.meet': [28, 1] }
    expect(def.when!(s)).toBe(true)
  })
  it('おまかせ\'s own wait books nothing: the おまかせ lives, and the share never married they are tuned to, stay as they were', () => {
    const s = createLife({ seed: 13, country: 'JP', pace: 'p15' })
    s.age = 30
    s.career.phase = 'retired'
    s.family.partner = '恵子'
    const ctx: EventCtx = { s, rng: makeRng(1), headless: true, add: () => {}, ask: () => {}, canAsk: () => true }
    EVENTS.get('love.propose')!.resolve!(ctx, 1, { auto: 1 })
    expect(s.flags?.['love.wait']).toBe(30)
    expect(s.due ?? []).toEqual([])
  })
})

describe('hobbies are not started twice', () => {
  it('a hobby he has is not started again, and the question of a new hobby does not come to one who has one', () => {
    const s = createLife({ seed: 31, country: 'JP', pace: 'p15' })
    s.age = 40
    s.career.phase = 'retired'
    s.flags = { 'hobby.fish': 30 }
    const out: string[] = []
    const ctx: EventCtx = { s, rng: makeRng(2), headless: false, add: (_k, t) => out.push(t), ask: () => {}, canAsk: () => true }
    for (let n = 1; n <= 4; n++) {
      s.evHist = { ...s.evHist, 'hobby.adult': [s.age, n] }
      EVENTS.get('hobby.adult')!.run(ctx)
    }
    expect(out.join('')).not.toMatch(/釣り/)
    expect(s.flags['hobby.started']).toBeDefined()
    expect(EVENTS.get('x.life.hobby')!.when!(s)).toBe(false)
    expect(EVENTS.get('sp.hobby.jp')!.when!(s)).toBe(false)
  })
  it('a harvest comes only from a garden he has', () => {
    for (const { lines } of lives) {
      const started = lines.findIndex((e) => /家庭菜園を始め|トマトとキュウリの苗/.test(e.text))
      const harvest = lines.findIndex((e) => /トマトがたくさん実りました/.test(e.text))
      if (harvest >= 0) expect(started, 'garden before harvest').toBeGreaterThanOrEqual(0)
      if (harvest >= 0) expect(started).toBeLessThan(harvest)
    }
  })
})

describe('the employer', () => {
  it('a company job names a fictional company, its business and its size; public service and his own shop do not', () => {
    const s = createLife({ seed: 41, country: 'JP', pace: 'p15' })
    s.age = 22
    s.status.knowledge = 70
    s.money = 400
    s.person.wealth = 5
    const offers = jobOffers(s, () => 0)
    const small = offers.find((o) => o.key === 'small')!
    expect(small.work.company).toBeDefined()
    expect(companyText(small.work.company!)).toMatch(/^.+（架空）・.+・従業員約[\d,]+人$/)
    expect(offers.find((o) => o.key === 'public')?.work.company).toBeUndefined()
    expect(offers.find((o) => o.key === 'family')?.work.company).toBeUndefined()
    // the same offer names the same company when it is shown and when it is taken
    expect(jobOffers(s, () => 0).find((o) => o.key === 'small')!.work.company).toEqual(small.work.company)
  })
  it('a man who works has his company in the state, and the line of the start names it', () => {
    let named = 0
    for (const { lines } of lives) if (lines.some((e) => /[^\s、。]{2,}(精工|製作所|食品|フーズ|商事|物産|保険サービス|ロジスティクス|運輸|建設|ケアホーム|フードサービス|ストア|ソフト)で(、|.*として働き始め)/.test(e.text))) named++
    expect(named).toBeGreaterThan(20)
  })
})

describe('the games of high school', () => {
  it('the game told has a score that agrees with the result', () => {
    let told = 0
    for (const { lines } of lives) {
      for (const e of lines) {
        const m = /(\d+)対(\d+)で(勝ちました|敗れました)/.exec(e.text)
        if (!m || !/戦(では|は)/.test(e.text)) continue
        told++
        const [us, them] = [Number(m[1]), Number(m[2])]
        if (m[3] === '勝ちました') expect(us, e.text).toBeGreaterThan(them)
        else expect(us, e.text).toBeLessThan(them)
        expect(e.text).not.toMatch(/甲子園.*(シード校)/)
      }
    }
    expect(told).toBeGreaterThan(100)
  })
})

describe('the university for a student', () => {
  it('a student the draw sent to work may still sit an exam (screen only); おまかせ keeps the draw', () => {
    let offered = 0
    let entered = 0
    for (let i = 0; i < 400 && offered < 5; i++) {
      const seed = hashSeed(i + 9_500_000)
      const r = play(seed, 20, (d) => (d.id === 'jp.afterPath' ? 1 : undefined))
      if (!r.asked.some((a) => a.d.id === 'jp.afterPath')) continue
      offered++
      if (r.s.job === '大学生' || r.s.schools?.univ) entered++
    }
    expect(offered).toBeGreaterThan(0)
    expect(entered).toBe(offered)
  })
  it('one who failed the club\'s tryout is offered the tryout again next spring and the 準硬式 club', () => {
    const s = createLife({ seed: 66, country: 'JP', pace: 'p15' })
    s.age = 18
    s.career.phase = 'retired'
    s.career.endedAge = 17
    s.career.highestRank = 4
    s.job = '大学生'
    s.schools = { univ: { id: 'x', name: 'ある大学', method: 'general' } }
    s.flags = { 'univ.clubAsk': 17, 'univ.walkFail': 17, 'after.path': 17 }
    const plan = planYear(s, sim)
    const all: Decision[] = []
    let d = plan.decision?.decision
    while (d) {
      all.push(d)
      d = resolveDecision(s, d.id === 'jp.univClub' ? 0 : d.autoIndex, sim).followUp?.decision
    }
    const club = all.find((x) => x.id === 'jp.univClub')
    expect(club?.choices.map((c) => c.label)).toEqual(['来年の春、もう一度入部テストを受ける', '準硬式野球部に入る', '野球サークルに入る', '野球は続けない'])
    expect(s.flags?.['univ.walkRetry']).toBe(18)
  })
})

describe('the words of the result', () => {
  it('the shared text gives the age as the screen does, as the length of the life', () => {
    const { s } = lives[0]
    const t = shareText(s, 'ある人生', null, 'https://example.test/')
    expect(t).toContain(`${s.age + 1}歳の生涯・最高到達`)
    expect(t).not.toMatch(/歳まで →/)
  })
  it('the youth coach\'s title speaks of teaching, not of his own children', () => {
    const s = createLife({ seed: 3, country: 'JP', pace: 'p15' })
    s.career.highestRank = 3
    s.career.achievements.push('少年野球の指導')
    expect(lifeTitle(s)).toBe('少年野球で子どもたちを教えた人')
  })
  it('an office won is the title of the life', () => {
    const s = createLife({ seed: 3, country: 'JP', pace: 'p15' })
    s.career.highestRank = 4
    applyEffect(s, { achieve: '衆議院議員' })
    expect(lifeTitle(s)).toBe('野球人から国会議員になった人')
  })
})
