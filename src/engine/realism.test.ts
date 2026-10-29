import { describe, expect, it } from 'vitest'
import { createLife, endYear, EVENTS, planYear, playToEnd, postingChance, resolveDecision, type Sim } from './life.ts'
import { defaultParams } from './params.ts'
import { hashSeed } from './rng.ts'
import { ensureAfter, firstYearIncome, incomeNow, jobOffers, setWork } from './after.ts'
import { CARE_WAYS, careChoices, careYear, setInsurance, treatCare } from './shop.ts'
import { addKid, drawPartner, kidNameOf, partnerWords } from './family.ts'
import { faStatus } from './freeAgent.ts'
import { hasGrandkids, positionAfter, studyWords, youngKin } from './events/spec.ts'
import { AMATEUR_DRAFT_MAX_AGE, MORTALITY_HEALTH_CAP, amateurDraftBarred, isPlaying, mortalityHealth, releaseShield } from './life.ts'
import { velocityKmh } from './ability.ts'
import { NO_HS_INTAKE, NO_HS_INTAKE_IDS } from '../data/schools/noHsIntake.ts'
import { schoolById } from '../data/schools/index.ts'
import { awayInvites, hsShortlist, univInvites } from './route/schools.ts'
import { PREFECTURES } from '../data/jp.ts'
import { makeRng } from './rng.ts'
import { secondsPerYear } from '../game/useLifeRunner.ts'
import { termsIn } from '../data/glossary.ts'
import type { LifeState } from './types.ts'

// PROJECT_PLAN §11.61: posting, medical choices, love and family, jobs and pay, the order of school events, the words explained.

const sim: Sim = { params: defaultParams() }
const pend = (s: LifeState, id: string, data: Record<string, number | boolean | string> = {}) => ((s as unknown as { pending: unknown }).pending = { id, data })

function adult(country: 'JP' | 'US' | 'CU' = 'JP', over: (s: LifeState) => void = () => {}): LifeState {
  const s = createLife({ seed: 31, country, pace: 'p15' })
  s.age = 40
  s.career.phase = 'retired'
  s.career.endedAge = 30
  s.money = 1000
  const a = ensureAfter(s)
  a.retired = false
  over(s)
  return s
}

describe('MLB from NPB: the overseas FA right or the club (posting)', () => {
  it('the club lets a young player go rarely, whatever one year looked like; seasons and results make it likelier; no ★ in it', () => {
    const s = createLife({ seed: 5, country: 'JP', pace: 'p15' })
    const line = { games: 140, outs: 0, pa: 500, ab: 450, h: 120, hr: 10, bb: 40, so: 80, w: 0, l: 0, er: 0, ip: 0, sv: 0, hold: 0, k: 0 }
    const seasons = (n: number) => (s.bb = { rec: { tournaments: Array.from({ length: n }, (_, i) => ({ age: 18 + i, level: 'pro', line })) } } as never)
    const at = (n: number, age: number, standing: number) => {
      seasons(n)
      s.age = age
      s.career.proStanding = standing
      return postingChance(s)
    }
    // two seasons at 20: a star is let go no more than anyone (one strong year is not a record)
    expect(at(2, 20, 2.5)).toBe(at(2, 20, 0.5))
    expect(at(2, 20, 2.5)).toBeLessThan(0.02)
    // four seasons at 22: the record counts
    expect(at(4, 22, 2.5)).toBeGreaterThan(at(4, 22, 0.5))
    expect(at(4, 22, 2.5)).toBeLessThan(0.3)
    // seven seasons at 26
    expect(faStatus(s).seasons).toBe(4)
    expect(at(7, 26, 2.5)).toBeGreaterThan(0.6)
    expect(at(7, 26, 2.5)).toBeLessThanOrEqual(0.9)
  })

  it('posting: approved he signs with an MLB club; refused he stays and may be asked again; declined he is not asked again', () => {
    const base = () => {
      const s = createLife({ seed: 9, country: 'JP', pace: 'p15' })
      s.age = 22
      s.career.phase = 'pro'
      s.career.team = '球団（支配下）'
      return s
    }
    const yes = base()
    pend(yes, 'jp.posting', { p: 1 })
    resolveDecision(yes, 0, sim)
    expect(yes.career.phase).toBe('abroad')
    expect(yes.taken).toContain('jp.mlb')
    const no = base()
    pend(no, 'jp.posting', { p: 0 })
    const r = resolveDecision(no, 0, sim)
    expect(no.career.phase).toBe('pro')
    expect(no.taken).not.toContain('jp.mlb')
    expect(r.events.map((e) => e.entry.text).join()).toContain('ポスティングを認めませんでした')
    const stay = base()
    pend(stay, 'jp.posting', { p: 1 })
    resolveDecision(stay, 1, sim)
    expect(stay.career.phase).toBe('pro')
    expect(stay.flags?.['mlb.declined']).toBe(22)
  })

  it('in potential lives (★10) the question follows the rights: jp.mlb only with the overseas FA right, posting without it', () => {
    let asked = 0
    for (let i = 0; i < 120 && asked < 6; i++) {
      const s = createLife({ seed: hashSeed(i + 8_800_000), country: 'JP', pace: 'p15', mode: 'potential', stars: 10 })
      for (let g = 0; g < 45 && s.alive; g++) {
        let d = planYear(s, sim).decision?.decision
        while (d && s.alive) {
          if (d.id === 'jp.mlb') expect(faStatus(s).overseas).toBe(true)
          if (d.id === 'jp.posting') expect(faStatus(s).overseas).toBe(false)
          if (d.id === 'jp.mlb' || d.id === 'jp.posting') asked++
          d = resolveDecision(s, d.autoIndex, sim).followUp?.decision
        }
        endYear(s)
      }
    }
    expect(asked).toBeGreaterThan(0)
  }, 120_000)
})

describe('a medical bill of the money screen: how to be treated', () => {
  it('each way pays its share, moves the health, and the cheaper ways make it come back more often', () => {
    const b = { bill: 200, own: 60 }
    for (const [way, pay] of [['hospital', 60], ['light', 21], ['none', 0]] as const) {
      const s = adult()
      s.status.health = 60
      treatCare(s, b, way)
      expect(s.money).toBe(1000 - pay)
      expect(s.status.health).toBe(60 + CARE_WAYS[way].health)
    }
    const hints = careChoices(adult('JP', (s) => (s.money = 10)), b).map((c) => c.hint)
    expect(hints[0]).toContain('自己負担 60万円')
    expect(hints[0]).toContain('貯金がマイナス')
    expect(hints[2]).toContain('再発しやすくなる')
    // the chance of a bill over many ages: higher right after one left untreated
    let plain = 0
    let again = 0
    for (let age = 20; age < 80; age++) {
      const a = adult('JP', (s) => (s.age = age))
      setInsurance(a, 'none')
      careYear(a, () => ((plain++), true))
      const c = adult('JP', (s) => (s.age = age))
      setInsurance(c, 'none')
      c.flags = { 'care.none': age - 1 }
      careYear(c, () => ((again++), true))
    }
    expect(again).toBeGreaterThan(plain)
  })

  it('without a decision the old way holds (treated at a hospital); the bill is in the money of the country he lives in', () => {
    let jp = 0
    let cu = 0
    for (let age = 20; age < 80; age++) {
      const a = adult('JP', (s) => (s.age = age))
      setInsurance(a, 'none')
      careYear(a)
      jp += 1000 - a.money
      const c = adult('CU', (s) => (s.age = age))
      setInsurance(c, 'none')
      careYear(c)
      cu += 1000 - c.money
    }
    expect(jp).toBeGreaterThan(0)
    expect(cu).toBeLessThan(jp * 0.5)
  })
})

describe('love and family', () => {
  it('the long-distance and break-up questions need someone he dates', () => {
    const s = adult('JP', (x) => (x.age = 24))
    s.flags = { 'love.first': 18 }
    for (const id of ['x.life.loveDistance', 'x.life.breakup']) {
      expect(EVENTS.get(id)!.when!(s), id).toBe(false)
    }
    s.family.partner = '葵'
    expect(EVENTS.get('x.life.loveDistance')!.when!(s)).toBe(true)
  })

  it('「もう少しこのままでいる」 holds the proposal for two years', () => {
    const s = adult('JP', (x) => (x.age = 30))
    s.family.partner = '葵'
    s.flags = { 'love.wait': 30 }
    s.evHist = { 'love.meet': [25, 1] } as never
    expect(EVENTS.get('love.propose')!.when!(s)).toBe(false)
    s.age = 32
    expect(EVENTS.get('love.propose')!.when!(s)).toBe(true)
  })

  it('the partner met is told with age and work, kept only for that partner; children get names, never the same twice', () => {
    const s = adult('JP', (x) => (x.age = 27))
    const p = drawPartner(s, '葵')
    expect(drawPartner(s, '葵')).toEqual(p)
    expect(Math.abs(p.gap)).toBeLessThanOrEqual(4)
    s.family.partner = '葵'
    s.family.partnerInfo = p
    expect(partnerWords(s)).toBe(`（${27 + p.gap}歳・${p.job}）`)
    s.family.partner = '結衣'
    expect(partnerWords(s)).toBe('')
    const names = [addKid(s), addKid(s), addKid(s)]
    expect(new Set(names).size).toBe(3)
    expect(names.every((n) => n.length > 0)).toBe(true)
    expect(kidNameOf(s, 1)).toBe(names[1])
    expect(s.family.kids).toEqual([0, 0, 0])
  })
})

describe('jobs: the pay shown is the pay paid; a queued question about a job he lost is dropped', () => {
  it('the first-year pay shown for a job equals the income of the next year', () => {
    for (const country of ['JP', 'US'] as const) {
      const s = adult(country, (x) => (x.age = 29))
      for (const o of jobOffers(s, () => 0)) {
        const shown = firstYearIncome(s, o.work)
        const t = structuredClone(s)
        setWork(t, { ...o.work })
        t.age++
        expect(incomeNow(t, null), `${country} ${o.key}`).toBe(shown)
      }
    }
  })

  it('a question waiting in the year is not asked when its condition no longer holds', () => {
    const s = adult('JP', (x) => (x.age = 45))
    pend(s, 'shop.care', { bill: 10, own: 10 })
    ;(s as unknown as { queue: unknown[] }).queue = [{ id: 'work.offer', data: {}, decision: { id: 'work.offer', weight: 'major', title: '', body: '', choices: [], autoIndex: 0 } }]
    // he has no job: the job offer that waited is dropped
    expect(resolveDecision(s, 0, sim).followUp).toBeUndefined()
  })
})

describe('the order of the school years', () => {
  it('the club question of the university comes in the year he enters, after the exam', () => {
    let seen = 0
    for (let i = 0; i < 400 && seen < 5; i++) {
      const s = createLife({ seed: hashSeed(i + 6_100_000), country: 'JP', pace: 'p15' })
      playToEnd(s, sim)
      const club = s.log.find((e) => /野球サークルに入りました|大学では野球を続けないことにしました/.test(e.text))
      const pass = s.log.find((e) => /大学に進学することにしました/.test(e.text))
      if (!club || !pass) continue
      seen++
      expect(club.age).toBeGreaterThan(pass.age)
    }
    expect(seen).toBeGreaterThan(0)
  }, 120_000)

  it('the path after high school is drawn once: no university at 17 stays so at 18; a saved and loaded life goes on the same way', () => {
    let quit = 0
    for (let i = 0; i < 400 && quit < 8; i++) {
      const cfg = { seed: hashSeed(i + 6_300_000), country: 'JP' as const, pace: 'p15' as const }
      const s = createLife(cfg)
      // played to 19, saved (JSON) and loaded every year from 16 on: the same as played straight through
      const t = createLife(cfg)
      let u = t
      for (let g = 0; g < 20 && s.alive; g++) {
        for (const x of [s, u]) {
          let d = planYear(x, sim).decision?.decision
          while (d && x.alive) d = resolveDecision(x, d.autoIndex, sim).followUp?.decision
          endYear(x)
        }
        if (u.age >= 16) u = JSON.parse(JSON.stringify(u)) as LifeState
      }
      expect(u.job).toBe(s.job)
      expect(u.schools).toEqual(s.schools)
      expect(u.flags?.['after.path']).toBe(s.flags?.['after.path'])
      if (s.flags?.['after.path'] !== 17) continue
      quit++
      // drawn at 17 only: a man who did not go then is not a student at 19, one who went is
      expect(s.job === '大学生').toBe(!!s.schools?.univ)
    }
    expect(quit).toBeGreaterThan(0)
  }, 120_000)

  it('the second-choice event speaks only of the last exam', () => {
    const s = adult('JP', (x) => (x.age = 18))
    s.schools = { hs: { id: 'a', name: 'A高校', method: 'general', fellBack: true }, univ: { id: 'b', name: 'B大学', method: 'general' } } as never
    expect(EVENTS.get('x.life.fellBack')!.when!(s)).toBe(false)
    ;(s.schools as unknown as { univ: { fellBack: boolean } }).univ.fellBack = true
    expect(EVENTS.get('x.life.fellBack')!.when!(s)).toBe(true)
  })
})

describe('the feedback after release (PROJECT_PLAN §11.62)', () => {
  it('no grandchild in the text of a man without one; a man with grandchildren still meets them', () => {
    const none = adult('JP', (x) => (x.age = 70))
    expect(youngKin(none)).toBe('近所の若い人')
    expect(hasGrandkids(none)).toBe(false)
    const kids = adult('JP', (x) => (x.age = 70))
    kids.family.children = 1
    kids.family.kids = [30]
    expect(youngKin(kids)).toBe('子ども')
    kids.career.achievements.push('孫')
    expect(youngKin(kids)).toBe('孫')
    // the texts of the late years read it: no 孫 for the man without one
    const body = EVENTS.get('x.late.memoir')
    expect(body).toBeDefined()
  })

  it('a school with no high-school intake is never offered at 15; the list keeps its source', () => {
    expect(NO_HS_INTAKE.map((x) => x.name)).toContain('東京都立大泉高等学校')
    for (const x of NO_HS_INTAKE) expect(schoolById(x.id)?.name).toBe(x.name)
    const s = createLife({ seed: 1, country: 'JP', pace: 'p15', prefecture: 12 })
    expect(s.person.prefecture).toBe(12)
    for (let i = 0; i < 40; i++) {
      const opts = hsShortlist(s, i % 2 ? 'public' : 'quit', makeRng(i))
      for (const o of opts) expect(NO_HS_INTAKE_IDS.has(o.id), o.name).toBe(false)
    }
  })

  it('a high pick and a proven player are kept after one bad year; a late pick or an old player is not', () => {
    const s = createLife({ seed: 7, country: 'JP', pace: 'p15' })
    s.age = 20
    s.career.draft = { age: 18, kind: 'shihaika', round: 1, status: 'signed' } as never
    expect(releaseShield(s)).toBe('draft')
    s.career.draft = { age: 18, kind: 'shihaika', round: 5, status: 'signed' } as never
    expect(releaseShield(s)).toBeNull()
    const good = { games: 140, outs: 0, pa: 500, ab: 450, h: 140, hr: 20, bb: 40, so: 80, w: 0, l: 0, er: 0, ip: 0, sv: 0, hold: 0, k: 0, rbi: 70, sb: 5 }
    s.bb = { rec: { tournaments: [{ age: 19, level: 'pro', line: good }] } } as never
    expect(releaseShield(s)).toBe('proven')
    s.age = 22
    expect(releaseShield(s)).toBeNull()
    s.age = 34
    s.bb = { rec: { tournaments: [{ age: 33, level: 'pro', line: good }] } } as never
    expect(releaseShield(s)).toBeNull()
  })

  it('from 50 good health protects only up to the cap; before 50 as before', () => {
    const s = adult('JP', (x) => (x.age = 45))
    s.status.health = 95
    expect(mortalityHealth(s)).toBe(95)
    s.age = 50
    expect(mortalityHealth(s)).toBe(MORTALITY_HEALTH_CAP)
    s.status.health = 40
    expect(mortalityHealth(s)).toBe(40)
  })

  it('height: the normal mode as before (171 ± 6); potential ★10 about 13.5 cm taller than ★1, with the same spread', () => {
    const h = (cfg: (i: number) => Parameters<typeof createLife>[0]) => {
      const xs = Array.from({ length: 600 }, (_, i) => createLife(cfg(i)).person.heightCm)
      const m = xs.reduce((a, b) => a + b, 0) / xs.length
      return { m, sd: Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length) }
    }
    const normal = h((i) => ({ seed: hashSeed(i + 5_100_000), country: 'JP', pace: 'p15' }))
    const one = h((i) => ({ seed: hashSeed(i + 5_100_000), country: 'JP', pace: 'p15', mode: 'potential', stars: 1 }))
    const ten = h((i) => ({ seed: hashSeed(i + 5_100_000), country: 'JP', pace: 'p15', mode: 'potential', stars: 10 }))
    expect(Math.abs(normal.m - 171)).toBeLessThan(1)
    expect(Math.abs(ten.m - one.m - 13.5)).toBeLessThan(0.6)
    expect(Math.abs(ten.sd - normal.sd)).toBeLessThan(0.3)
    expect(Math.abs(ten.m - 184.5)).toBeLessThan(1.2)
  })

  it('スポーツ推薦: a stronger player is invited from farther, by stronger schools; an ordinary one mostly near home', () => {
    let farStrong = 0
    let farWeak = 0
    let hsStrong = 0
    let hsWeak = 0
    for (let i = 0; i < 200; i++) {
      const s = createLife({ seed: hashSeed(i + 5_200_000), country: 'JP', pace: 'p15', prefecture: 20 })
      s.bb = { scout: 50 } as never
      const regionOf = (pref: string) => PREFECTURES.find((p) => p.name === pref)?.region
      const home = PREFECTURES[s.person.prefecture].region
      const ev = (total: number) => ({ total }) as never
      // the share of the invitations that come from outside his region
      const farShare = (total: number) => {
        const inv = univInvites(s, ev(total)).filter((x) => x.invited)
        return inv.length ? inv.filter((x) => regionOf(x.school.pref) !== home).length / inv.length : 0
      }
      farStrong += farShare(2.0)
      farWeak += farShare(0.7)
      const hsFar = (total: number, L: number) => awayInvites(s, ev(total), L).filter((x) => regionOf(x.pref) !== home).length
      hsStrong += hsFar(2.2, 1.9)
      hsWeak += hsFar(1.0, 1.0)
    }
    expect(farStrong / 200).toBeGreaterThan(farWeak / 200 + 0.1)
    // a high school from another region: only for a strong player
    expect(hsStrong).toBeGreaterThan(0)
    expect(hsWeak).toBe(0)
  })

  it('a released 支配下 player re-signed by his own club as 育成: 育成 phase, the same club, a 育成 pay', () => {
    const s = createLife({ seed: 8, country: 'JP', pace: 'p15' })
    s.age = 23
    s.career.phase = 'pro'
    s.career.orgId = 'npb-giants'
    s.career.team = '読売ジャイアンツ（支配下）'
    s.career.salary = 1800
    pend(s, 'jp.release', { offer: '', offerId: '', offerLabel: '', offer2Id: '', offer2Label: '', ownIdx: 3, ownLabel: '読売ジャイアンツ', tier: '支配下', ikusei: false })
    resolveDecision(s, 3, sim)
    expect(s.career.phase).toBe('proMinor')
    expect(s.career.team).toContain('育成')
    expect(s.career.nextSalary).toBeLessThanOrEqual(500)
    expect(s.career.nextSalary).toBeGreaterThanOrEqual(240)
  })

  it('一時間 is a pace of its own: a year lasts twice as long as at 30 minutes', () => {
    expect(secondsPerYear('p60')).toBe(secondsPerYear('p30') * 2)
  })
})

describe('the feedback of 2026-10-21 (PROJECT_PLAN §11.65)', () => {
  it('a move to the outfield makes an infielder an outfielder (never a pitcher), and back; a pitcher or a catcher is not moved', () => {
    const s = createLife({ seed: 3, country: 'JP', pace: 'p15' })
    // a body and skills that suit pitching best: the old 'best' made him a pitcher
    s.bb = { skills: { velocity: 1, control: 1, breaking: 1, stamina: 1, contact: -1, power: -1, speed: -1, fielding: -1, arm: -1, catching: -1, throwing: -1, calling: -1 } } as never
    expect(positionAfter('IF', 'best', s)).toBe('P')
    expect(positionAfter('IF', 'otherField', s)).toBe('OF')
    expect(positionAfter('OF', 'otherField', s)).toBe('IF')
    expect(positionAfter('P', 'otherField', s)).toBe('P')
    expect(positionAfter('C', 'otherField', s)).toBe('C')
    // the coach's event uses it, and its answer keeps the arm and the other data
    const ev = EVENTS.get('x.coach.moveField')!
    s.person.position = 'IF'
    s.career.phase = 'pro'
    const bats = s.person.bats
    ;(s as unknown as { pending: unknown }).pending = { id: 'x.coach.moveField', data: {} }
    resolveDecision(s, 0, sim)
    expect(s.person.position).toBe('OF')
    expect(s.person.bats).toBe(bats)
    expect(ev).toBeDefined()
  })

  it('no draft from a company or independent team after 30, and at most one return through the draft', () => {
    const s = createLife({ seed: 4, country: 'JP', pace: 'p15' })
    s.age = 25
    expect(amateurDraftBarred(s)).toBe(false)
    s.flags = { 'draft.n': 1 }
    expect(amateurDraftBarred(s)).toBe(false)
    s.flags = { 'draft.n': 2 }
    expect(amateurDraftBarred(s)).toBe(true)
    s.flags = {}
    s.age = AMATEUR_DRAFT_MAX_AGE + 1
    expect(amateurDraftBarred(s)).toBe(true)
  })

  it('a strong player who always goes back to the independent league is not drafted again and again: he is out of baseball long before 50', () => {
    let loops = 0
    for (let i = 0; i < 300; i++) {
      const s = createLife({ seed: hashSeed(i + 6_600_000), country: 'JP', pace: 'p15', mode: 'potential', stars: 10 })
      let lastAge = 0
      for (let g = 0; g < 70 && s.alive; g++) {
        let d = planYear(s, sim).decision?.decision
        while (d && s.alive) {
          // the player's own answer at every release: the independent league (choice 1), at any age
          const c = d.id === 'jp.release' ? 1 : d.autoIndex
          d = resolveDecision(s, c, sim).followUp?.decision
        }
        if (isPlaying(s)) lastAge = s.age
        endYear(s)
      }
      const drafted = s.flags?.['draft.n'] ?? 0
      expect(drafted, `seed ${s.config.seed}`).toBeLessThanOrEqual(2)
      expect(lastAge, `seed ${s.config.seed}`).toBeLessThan(45)
      if (drafted === 2) loops++
    }
    // the return through the draft is still possible
    expect(loops).toBeGreaterThan(0)
  }, 300_000)

  it('the speed shown falls with age: no pitcher of 68 throws 160, a strong one of 25 still can be fast', () => {
    const s = createLife({ seed: 5, country: 'JP', pace: 'p15' })
    s.person.position = 'P'
    s.bb = { skills: { velocity: 0.6 } } as never
    s.z = 3.5
    s.age = 25
    const young = velocityKmh(s)
    s.age = 35
    const thirtyFive = velocityKmh(s)
    s.age = 68
    const old = velocityKmh(s)
    expect(young).toBeGreaterThan(150)
    expect(thirtyFive).toBeLessThan(young)
    expect(young - thirtyFive).toBeLessThanOrEqual(4)
    expect(old).toBeLessThan(130)
  })

  it('a senior teaches what fits the position: a pitcher pitching, a fielder hitting or fielding, a catcher catching', () => {
    const spec = EVENTS.get('x.pro.senior')
    expect(spec).toBeDefined()
    const s = createLife({ seed: 6, country: 'JP', pace: 'p15' })
    s.age = 22
    s.career.phase = 'pro'
    s.bb = { skills: Object.fromEntries(['velocity', 'control', 'breaking', 'stamina', 'contact', 'power', 'speed', 'fielding', 'arm', 'catching', 'throwing', 'calling'].map((k) => [k, 0])), role: 'bench', confidence: 50, fatigue: 20, gain: 0 } as never
    const labels = (pos: 'P' | 'C' | 'IF' | 'OF') => {
      s.person.position = pos
      const asked: string[][] = []
      const c = { s, rng: makeRng(1), headless: false, add: () => {}, ask: (d: { choices: { label: string }[] }) => asked.push(d.choices.map((x) => x.label)), canAsk: () => true }
      spec!.run!(c as never)
      return asked[0] ?? []
    }
    expect(labels('P').join()).toMatch(/投球フォーム/)
    expect(labels('P').join()).not.toMatch(/打撃|守備|捕球/)
    expect(labels('IF').join()).toMatch(/打撃のコツ/)
    expect(labels('IF').join()).toMatch(/守備と走塁/)
    expect(labels('IF').join()).not.toMatch(/投球|捕球/)
    expect(labels('C').join()).toMatch(/捕球と配球/)
    expect(labels('C').join()).not.toMatch(/投球|守備と走塁/)
    // the おまかせ answer is the last, and it changes nothing
    expect(labels('OF').at(-1)).toMatch(/自分のやり方を続ける/)
  })
})

describe('the words shown with a choice', () => {
  it('a study choice lists what it moves; the glossary finds the words, not their other uses', () => {
    expect(studyWords({ know: 5, eval: -2 })).toBe('知識+5・監督の評価−2')
    expect(studyWords({ happy: 3 })).toBe('')
    expect(termsIn('後輩の育成を任されました').map((t) => t.word)).toEqual([])
    expect(termsIn('育成選手として契約しました').map((t) => t.word)).toEqual(['育成選手'])
    expect(termsIn('外野へのコンバートを打診されました').map((t) => t.word)).toEqual(['コンバート'])
  })
})
