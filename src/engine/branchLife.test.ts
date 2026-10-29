import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REPEAT_DAMPING, recentCategories } from './events.ts'
import { SPECS } from './events/index.ts'
import { BRANCH_LIFE } from './events/branchLife.ts'
import { EARLY_LIFE } from './events/earlyLife.ts'
import { LIFE_CHOICES } from './events/lifeChoices.ts'
import { ensureAfter } from './after.ts'
import { initBaseball } from './ability.ts'
import { makeRng } from './rng.ts'
import { eventReach, playRecorded, type Recorded } from './diversity.ts'
import { runHeadless } from './life.ts'
import { stageOf, type EventCtx } from './events.ts'
import type { EventSpec, OutcomeSpec } from './events/spec.ts'
import { EVENTS, createLife, endYear, planYear, resolveDecision, type Sim } from './life.ts'
import { defaultParams } from './params.ts'
import { hashSeed } from './rng.ts'
import type { LifeState } from './types.ts'

// PROJECT_PLAN §11.17: choices with a price. The new events (branchLife.ts) are judged on what a choice changes later:
// the fact it sets is read by a follow-up (and by others), the follow-up happens in the lives that made the choice,
// the same subject does not come back year after year, and the middle years of a life differ with the choices made.

const ALL_NEW = [...BRANCH_LIFE, ...EARLY_LIFE, ...LIFE_CHOICES]
const decisions = ALL_NEW.filter((s) => !s.followOnly)
const followUps = ALL_NEW.filter((s) => s.followOnly)
const parents = decisions.filter((s) => s.choices?.some((c) => c.follow?.length))

/** every fact a choice or an outcome of the spec sets */
function flagsSet(sp: EventSpec): string[] {
  const out: string[] = []
  for (const c of sp.choices ?? []) {
    out.push(...[c.flag ?? []].flat())
    for (const e of [c.effects, ...c.outcomes.map((o) => o.effects)]) out.push(...[e?.flag ?? []].flat())
  }
  for (const o of sp.outcomes ?? []) out.push(...[o.effects?.flag ?? []].flat())
  return out
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) return sourceFiles(p)
    return /\.tsx?$/.test(f) && !/\.test\./.test(f) ? [p] : []
  })
}

describe('the new choices with a price', () => {
  it('there are decisions and follow-ups, each decision with several answers and no single right one', () => {
    expect(decisions.length).toBeGreaterThanOrEqual(26)
    expect(followUps.length).toBeGreaterThanOrEqual(28)
    expect(parents.length).toBeGreaterThanOrEqual(26)
    for (const d of parents) {
      // at least two different answers lead somewhere (a different fact and the follow-up that reads it)
      const withFlag = d.choices!.filter((c) => c.flag && c.follow?.length)
      expect(withFlag.length, d.id).toBeGreaterThanOrEqual(1)
      if (withFlag.length >= 2) expect(new Set(withFlag.map((c) => [c.flag].flat().join())).size, d.id).toBe(withFlag.length)
      // each follow-up has outcomes for each answer that books it, and they are not alike
      for (const c of withFlag) {
        const fu = SPECS.find((s) => s.id === c.follow![0].id)!
        expect((fu.outcomes ?? []).length, `${fu.id} has more than one outcome`).toBeGreaterThanOrEqual(2)
        // when two answers lead to the same follow-up, it has outcomes of its own for each
        if (withFlag.length >= 2) for (const f of withFlag) expect((fu.outcomes ?? []).filter((o) => !o.when || o.when(Object.assign(createLife({ seed: 1, country: 'JP', pace: 'p15' }), { flags: Object.fromEntries([f.flag!].flat().map((x) => [x, 1])) }))).length, `${fu.id} for ${f.label}`).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('every fact the new events set is read somewhere (a follow-up, a condition, a weight)', () => {
    const src = sourceFiles(join(__dirname, '..')).map((p) => readFileSync(p, 'utf8')).join('\n')
    // reads only: drop the places where a fact is set
    const reads = src.replace(/flag:\s*\[?'[^']+'(,\s*'[^']+')*\]?/g, '')
    const unread: string[] = []
    for (const sp of ALL_NEW) for (const f of new Set(flagsSet(sp))) if (!reads.includes(`'${f}'`)) unread.push(`${sp.id}: ${f}`)
    expect(unread).toEqual([])
  })

  it('a fact set long before changes the odds of a later outcome: the way chosen at school, a habit of study, a friendship kept', () => {
    const weightOf = (o: OutcomeSpec, s: LifeState) => (typeof o.weight === 'function' ? o.weight(s) : (o.weight ?? 1))
    const base = () => {
      const s = createLife({ seed: 77, country: 'JP', pace: 'p15' })
      s.age = 45
      return s
    }
    const cases: [string, string, string[]][] = [
      ['x.life.friendLoanBack', 'friend.lent', ['rival.friend', 'friend.apologized']],
      ['x.life.midlifeBack', 'mid.reskill', ['exam.study', 'study.english']],
      ['x.life.midlifeBack', 'mid.startup', ['route.ownWay', 'job.changed']],
      ['x.pro.mlbTalkBack', 'mlb.dream', ['study.english']],
      ['x.life.eduFundBack', 'edu.save', ['kid.lesson', 'kid.lessonOther']],
    ]
    for (const [id, own, earlier] of cases) {
      const fu = SPECS.find((s) => s.id === id)!
      const s0 = base()
      s0.flags = { [own]: 40 }
      const o = fu.outcomes!.find((x) => typeof x.weight === 'function' && x.when?.(s0))!
      expect(o, `${id} / ${own}`).toBeDefined()
      const s1 = structuredClone(s0)
      for (const f of earlier) s1.flags![f] = 20
      expect(weightOf(o, s1), `${id}: ${earlier.join(',')} raise the odds`).toBeGreaterThan(weightOf(o, s0))
    }
  })

  it('in lives that make a choice, the fact is set and the follow-up happens years later (lives played as on screen, the answer forced)', () => {
    const sim: Sim = { params: defaultParams() }
    const byId = new Map(parents.map((p) => [p.id, p]))
    const stats = new Map<string, { n: number; flagged: number; followed: number; texts: Set<string> }>()
    let lives = 0
    for (let i = 0; i < 600; i++) {
      const seed = hashSeed(i + 11_100_000)
      const s = createLife({ seed, country: 'JP', pace: 'p15' })
      const forced: { id: string; flags: string[]; follow: string }[] = []
      for (let g = 0; g < 130 && s.alive; g++) {
        const plan = planYear(s, sim)
        for (const e of plan.events) s.log.push(e.entry)
        let d = plan.decision?.decision
        while (d && s.alive) {
          let choice = d.autoIndex
          const sp = byId.get(d.id)
          if (sp) {
            const leads = sp.choices!.map((c, k) => (c.follow?.length ? k : -1)).filter((k) => k >= 0)
            choice = leads[(i + g) % leads.length]
            const c = sp.choices![choice]
            forced.push({ id: sp.id, flags: [c.flag ?? []].flat(), follow: c.follow![0].id })
          }
          const r = resolveDecision(s, choice, sim)
          for (const e of r.events) s.log.push(e.entry)
          d = r.followUp?.decision
        }
        endYear(s)
      }
      lives++
      for (const f of forced) {
        const st = stats.get(f.id) ?? { n: 0, flagged: 0, followed: 0, texts: new Set<string>() }
        st.n++
        if (f.flags.every((x) => s.flags?.[x] !== undefined)) st.flagged++
        if (s.evHist?.[f.follow]) st.followed++
        stats.set(f.id, st)
      }
    }
    expect(lives).toBe(600)
    const seen = [...stats.entries()]
    // the decisions are met in the lives where they can be, and the choice sets its fact every time
    expect(seen.length, `decisions met: ${seen.map(([k, v]) => `${k}=${v.n}`).join(' ')}`).toBeGreaterThanOrEqual(12)
    for (const [id, st] of seen) expect(st.flagged, `${id}: the fact is set`).toBe(st.n)
    // and the follow-up comes in a good part of those lives (the window can end first, or the conditions fail)
    const n = seen.reduce((a, [, v]) => a + v.n, 0)
    const followed = seen.reduce((a, [, v]) => a + v.followed, 0)
    expect(followed / n, `follow-ups: ${seen.map(([k, v]) => `${k} ${v.followed}/${v.n}`).join(' ')}`).toBeGreaterThan(0.9)
    for (const [id, st] of seen) if (st.n >= 8) expect(st.followed, `${id} is followed`).toBeGreaterThan(0)
  }, 240_000)
})

/** a number for how an outcome leaves a life: above 0 it is a gain, below 0 a loss (relative sizes are the game's assumption) */
function netOf(e: OutcomeSpec['effects']): number {
  if (!e) return 0
  const sk = Object.values(e.skill ?? {}).reduce((a, v) => a + v, 0)
  return (e.happy ?? 0) + (e.rel ?? 0) + (e.know ?? 0) + (e.health ?? 0) + (e.sat ?? 0) + (e.conf ?? 0) + (e.eval ?? 0) - (e.fatigue ?? 0) * 0.5 + (e.money ?? 0) / 50 + (e.gain ?? 0) * 50 + (e.level ?? 0) * 3 + sk * 20
}

function baseLife(seed: number): LifeState {
  const s = createLife({ seed, country: 'JP', pace: 'p15' })
  s.age = 40
  s.career.phase = 'retired'
  s.career.highestRank = 4
  s.bb = initBaseball(s, makeRng(seed))
  ensureAfter(s)
  return s
}

const snapshot = (s: LifeState) => [s.money, s.status.happiness, s.status.relations, s.status.knowledge, s.status.health, s.bb?.coachEval ?? 0, s.bb?.confidence ?? 0, s.bb?.fatigue ?? 0, s.bb?.gain ?? 0, s.after?.work?.satisfaction ?? 0, s.after?.work?.level ?? 0, Object.values(s.bb?.skills ?? {}).reduce((a, v) => a + v, 0)]

describe('what a choice does to the years after it', () => {
  const answers = parents.flatMap((p) => p.choices!.filter((c) => c.flag && c.follow?.length).map((c) => ({ parent: p, choice: c, follow: SPECS.find((s) => s.id === c.follow![0].id)! })))

  it('every answer that books a follow-up has results that can go well or badly (no answer is simply the right one)', () => {
    expect(answers.length).toBeGreaterThanOrEqual(55)
    const bad: string[] = []
    for (const a of answers) {
      const s = baseLife(5)
      for (const f of [a.choice.flag!].flat()) s.flags = { ...s.flags, [f]: 30 }
      const open = a.follow.outcomes!.filter((o) => !o.when || o.when(s))
      const nets = open.map((o) => netOf(o.effects))
      if (open.length < 2) bad.push(`${a.parent.id} / ${a.choice.label}: one result`)
      else if (Math.max(...nets) <= 0) bad.push(`${a.parent.id} / ${a.choice.label}: no good result`)
      else if (Math.min(...nets) >= 0) bad.push(`${a.parent.id} / ${a.choice.label}: no bad result`)
    }
    expect(bad).toEqual([])
  })

  it('the answers to one decision leave different lives: money, happiness, relations, knowledge, health, standing or work move differently', () => {
    const byParent = new Map<string, typeof answers>()
    for (const a of answers) byParent.set(a.parent.id, [...(byParent.get(a.parent.id) ?? []), a])
    let pairs = 0
    for (const [id, list] of byParent) {
      if (list.length < 2) continue
      const mean = (a: (typeof answers)[number]) => {
        const sum: number[] = []
        for (let i = 0; i < 120; i++) {
          const s = baseLife(100 + i)
          for (const f of [a.choice.flag!].flat()) s.flags = { ...s.flags, [f]: 30 }
          const before = snapshot(s)
          const c = { s, rng: makeRng(i + 1), headless: true, add: () => {}, ask: () => {}, canAsk: () => true } as unknown as EventCtx
          EVENTS.get(a.follow.id)!.run(c)
          snapshot(s).forEach((v, k) => (sum[k] = (sum[k] ?? 0) + (v - before[k])))
        }
        return sum.map((v) => v / 120)
      }
      const [x, y] = [mean(list[0]), mean(list[1])]
      const spread = Math.max(...x.map((v, k) => Math.abs(v - y[k])))
      expect(spread, `${id}: the two answers lead to the same average future`).toBeGreaterThan(0.4)
      pairs++
    }
    expect(pairs).toBeGreaterThanOrEqual(20)
  })

  it('pets and phones: each answer, taking or refusing, has its own consequences years later', () => {
    for (const id of ['x.life.petAdopt', 'x.life.digital']) {
      const sp = SPECS.find((s) => s.id === id)!
      const leads = sp.choices!.filter((c) => c.follow?.length)
      expect(leads.length, id).toBeGreaterThanOrEqual(2)
      expect(new Set(leads.map((c) => c.follow![0].id)).size, `${id}: not the same follow-up`).toBe(leads.length)
    }
  })
})

describe('who meets which choice (the conditions)', () => {
  const ok = (id: string, s: LifeState) => {
    const d = EVENTS.get(id)!
    return d.stages.includes(stageOf(s)) && (!d.ages || (s.age >= d.ages[0] && s.age <= d.ages[1])) && (!d.when || d.when(s))
  }
  const as = (age: number, phase: LifeState['career']['phase'], f?: (s: LifeState) => void): LifeState => {
    const s = baseLife(31)
    s.age = age
    s.career.phase = phase
    s.after!.work = { title: '会社員', industry: 'office', employer: 'small', level: 1, years: 6, satisfaction: 60, regular: true, baseball: false }
    f?.(s)
    return s
  }

  it('the pitching choice is for a junior-high pitcher, the bench choice for a bench player in high school', () => {
    expect(ok('x.jhs.overuse', as(13, 'jhs', (s) => (s.person.position = 'P')))).toBe(true)
    expect(ok('x.jhs.overuse', as(13, 'jhs', (s) => (s.person.position = 'IF')))).toBe(false)
    expect(ok('x.jhs.overuse', as(16, 'hs', (s) => (s.person.position = 'P')))).toBe(false)
    expect(ok('x.hs.benchRole', as(16, 'hs', (s) => (s.bb!.role = 'bench')))).toBe(true)
    expect(ok('x.hs.benchRole', as(16, 'hs', (s) => (s.bb!.role = 'starter')))).toBe(false)
    expect(ok('x.hs.captainOffer', as(16, 'hs', (s) => (s.bb!.captain = 'captain')))).toBe(false)
    expect(ok('x.hs.captainOffer', as(16, 'hs'))).toBe(true)
  })

  it('the club and the housing choices are for students who do not play; the first position for children who do', () => {
    expect(ok('x.life.clubChoice', as(15, 'retired', (s) => (s.bb = undefined)))).toBe(true)
    expect(ok('x.life.clubChoice', as(15, 'hs'))).toBe(false)
    expect(ok('x.univ.roommate', as(19, 'retired', (s) => (s.job = '大学生')))).toBe(true)
    expect(ok('x.univ.roommate', as(19, 'univ'))).toBe(false)
    expect(ok('x.kid.position', as(10, 'youth'))).toBe(true)
    expect(ok('x.kid.position', as(10, 'retired', (s) => (s.bb = undefined)))).toBe(false)
  })

  it('the work choices need a job; the choice at sixty needs one to leave; the end-of-career choice needs the years', () => {
    expect(ok('x.late.retire', as(58, 'retired'))).toBe(true)
    expect(ok('x.late.retire', as(50, 'retired'))).toBe(false)
    expect(ok('x.late.retire', as(58, 'retired', (s) => (s.after!.retired = true)))).toBe(false)
    expect(ok('x.life.mentor', as(35, 'retired', (s) => (s.after!.work!.years = 10)))).toBe(true)
    expect(ok('x.life.mentor', as(35, 'retired', (s) => (s.after!.work!.years = 2)))).toBe(false)
    expect(ok('x.life.burnout', as(35, 'retired', (s) => ((s.after!.work!.years = 8), (s.after!.work!.satisfaction = 40))))).toBe(true)
    expect(ok('x.life.burnout', as(35, 'retired', (s) => ((s.after!.work!.years = 8), (s.after!.work!.satisfaction = 80))))).toBe(false)
    expect(ok('x.pro.lateCareer', as(34, 'pro', (s) => (s.career.proSeasons = 10)))).toBe(true)
    expect(ok('x.pro.lateCareer', as(28, 'pro', (s) => (s.career.proSeasons = 10)))).toBe(false)
    expect(ok('x.co.promotion', as(27, 'company', (s) => (s.after!.work!.years = 4)))).toBe(true)
    expect(ok('x.co.promotion', as(27, 'indep', (s) => (s.after!.work!.years = 4)))).toBe(false)
  })

  it('a choice is not offered again once its fact is set', () => {
    for (const [id, flag, make] of [
      ['x.life.mentor', 'mentor.take', () => as(35, 'retired', (s) => (s.after!.work!.years = 10))],
      ['x.late.retire', 'retire.full', () => as(58, 'retired')],
      ['x.kid.position', 'kid.pitch', () => as(10, 'youth')],
    ] as [string, string, () => LifeState][]) {
      const s = make()
      expect(ok(id, s), id).toBe(true)
      s.flags = { [flag]: s.age }
      expect(ok(id, s), `${id} after ${flag}`).toBe(false)
    }
  })
})

describe('the events for the rarer careers and for lives without baseball happen in the lives that can have them', () => {
  const sim: Sim = { params: defaultParams() }
  const recs: Recorded[] = []
  const got = { pro: 0, indep: 0, company: 0, plain: 0 }
  // (40 lives of each kind: at 25, a contract year was eligible in only 12 lives, where one life moves the share by 8 points)
  const want = 40
  for (let i = 0; i < 80_000 && Object.values(got).some((n) => n < want); i++) {
    const seed = hashSeed(i + 9_700_000)
    const h = runHeadless({ seed, country: 'JP', pace: 'p15' }, sim, true)
    const ph = new Set(h.timeline.map((t) => t.phase))
    const kinds = [h.career.highestRank >= 6 && 'pro', ph.has('indep') && 'indep', ph.has('company') && 'company', !ph.has('hs') && 'plain'].filter(Boolean) as (keyof typeof got)[]
    if (!kinds.some((k) => got[k] < want)) continue
    for (const k of kinds) got[k]++
    recs.push(playRecorded(seed, sim, { eligibility: true }))
  }
  const reach = eventReach(recs)
  const share = (id: string) => {
    const r = reach.find((x) => x.id === id)!
    return { eligible: r.livesEligible, share: r.livesReached / Math.max(1, r.livesEligible) }
  }

  it('an independent player, a pro in a contract year, a pro who might go overseas: the event comes in a good part of such lives', () => {
    // (measured 2026-10-19: 48%, 68%, 60% of the lives where the conditions held at the start of a year;
    // 2026-10-24 on 40 lives of each kind: 38%, 40%, 59%)
    for (const id of ['x.in.sideLife', 'x.pro.contractYear', 'x.pro.mlbTalk']) {
      const r = share(id)
      expect(r.eligible, `${id}: lives where it can happen`).toBeGreaterThanOrEqual(10)
      expect(r.share, `${id}: share drawn`).toBeGreaterThan(0.25)
    }
  })

  it('the choices of the company, independent and pro stages (promotion, player-coach, new role, foreign teammate, the end of a career) come to the lives that meet their conditions', () => {
    for (const id of ['x.co.promotion', 'x.in.playerCoach', 'x.pro.roleChange', 'x.pro.foreign', 'x.pro.lateCareer']) {
      const r = share(id)
      expect(r.eligible, `${id}: lives where it can happen`).toBeGreaterThanOrEqual(3)
      expect(r.share, `${id}: share drawn`).toBeGreaterThan(0.1)
    }
  })

  it('lives without baseball meet their own choices: a club or none, where to live, the first steps to a job, reunions, the work and the years after sixty', () => {
    // the lives that never played are the whole of this group; their events come from the stages student, adult and senior
    const ids = ['x.life.clubChoice', 'x.univ.roommate', 'x.univ.internship', 'x.life.reunion', 'x.life.burnout', 'x.life.mentor', 'x.late.retire', 'x.kid.honest', 'x.kid.classPres']
    const found = ids.map((id) => ({ id, ...share(id) }))
    // each is possible in some of these lives, and most are drawn in a fair share
    for (const f of found) expect(f.eligible, `${f.id}: lives where it can happen`).toBeGreaterThanOrEqual(1)
    expect(found.filter((f) => f.share > 0.1).length, JSON.stringify(found)).toBeGreaterThanOrEqual(6)
  })
}, 400_000)

describe('the same subject does not come back year after year', () => {
  it('recentCategories lists the subjects of the last two years, main and extra events', () => {
    const s = createLife({ seed: 3, country: 'JP', pace: 'p15' })
    s.age = 40
    s.evHist = { 'x.life.eduFund': [39, 1], 'x.life.loanChoice': [37, 1] } as LifeState['evHist']
    const r = recentCategories(EVENTS, s)
    expect(r.has('kids')).toBe(true)
    expect(r.has('moneyLife')).toBe(false)
    s.evHist = { 'x.life.eduFund': [40, 1] } as LifeState['evHist']
    expect(recentCategories(EVENTS, s).size, 'this year is not yet past').toBe(0)
    expect(REPEAT_DAMPING).toBeGreaterThan(0)
    expect(REPEAT_DAMPING).toBeLessThan(1)
  })

  it('in lives played as on screen, a subject seldom comes round again within two years', () => {
    const sim: Sim = { params: defaultParams() }
    let events = 0
    let again = 0
    for (let i = 0; i < 150; i++) {
      const s = createLife({ seed: hashSeed(i + 11_900_000), country: 'JP', pace: 'p15' })
      for (let g = 0; g < 130 && s.alive; g++) {
        const plan = planYear(s, sim)
        for (const e of plan.events) s.log.push(e.entry)
        let d = plan.decision?.decision
        while (d && s.alive) {
          const r = resolveDecision(s, d.autoIndex, sim)
          for (const e of r.events) s.log.push(e.entry)
          d = r.followUp?.decision
        }
        endYear(s)
      }
      const seen = Object.entries(s.evHist ?? {})
        .map(([id, [age]]) => ({ cat: EVENTS.get(id)?.category, flavor: EVENTS.get(id)?.flavorOnly, age }))
        .filter((x) => x.cat && !x.flavor)
        .sort((a, b) => a.age - b.age)
      seen.forEach((x, k) => {
        events++
        if (seen.slice(0, k).some((y) => y.cat === x.cat && x.age - y.age <= 2 && x.age > y.age)) again++
      })
    }
    expect(events).toBeGreaterThan(1500)
    // (measured 2026-10-18 over 150 lives: 6% of the events had their subject come up in the two years before; 13 of the 16 decisions are met in 900 lives, the rest are for pros and independent players and are checked by the situations of evaluation.test.ts; 99% of the forced choices were followed up)
    expect(again / events).toBeLessThan(0.12)
  }, 240_000)
})
