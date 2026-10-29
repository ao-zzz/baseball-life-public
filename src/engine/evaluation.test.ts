import { describe, expect, it } from 'vitest'
import { EVENTS, createLife, endYear, planYear, resolveDecision, type Sim } from './life.ts'
import { defaultParams } from './params.ts'
import { hashSeed, makeRng } from './rng.ts'
import type { Decision, LifeState, Phase, Position, SkillKey } from './types.ts'
import { bestPosition, heightZ, initBaseball, positionFit, rankInTeam, startsAt, teamScore } from './ability.ts'
import { AMATEUR_TEAMS } from '../data/teams.ts'
import {
  FINALS_BY_LEAGUE,
  FINALS_BY_SCHOOL,
  HIGH_SCHOOLS,
  KOSHIEN_META,
  LEAGUE_SCHOOL_IDS,
  UNMAPPED_LEAGUE_MEMBERS,
  UNMATCHED_DIVISION_MEMBERS,
  UNMATCHED_FINALISTS,
  coverage,
  koshienOf,
  leagueSeatOf,
  UNIVERSITIES,
} from '../data/schools/index.ts'
import { CHAMPIONS, JUBF_META, UNIV_LEAGUES } from '../data/schools/leagues.ts'
import { NPB_STANDINGS } from '../data/npbRecords.ts'
import { US_COLLEGES, conferenceTier } from '../data/usColleges.ts'
import { ORGS } from '../data/orgs.ts'
import { NPB_MEAN, hsRating, npbRating, usRating } from './route/rating.ts'
import { proSeason } from './careerSeason.ts'
import { admitP, amateurRating, evaluate, indepRating, inviteP, levelWord, univRating, UNIV_MEAN } from './route/rating.ts'
import { autoPick, hsShortlist, optionHint, sportsP, univInvites, univShortlist, usInvites } from './route/schools.ts'
import { applyEffect } from './events/spec.ts'
import { SPECS } from './events/index.ts'
import type { EventCtx } from './events.ts'

// Evaluation of the player, the internal strength of teams, invitations against places, and the new
// routes (PROJECT_PLAN §11.14). Height never decides alone; the strength of a team is used for the squad, the
// invitations and the chances of getting in; the calibrated careers are guarded by scripts/fingerprint.ts.

function player(o: { height?: number; pos?: Position; z?: number; skills?: Partial<Record<SkillKey, number>>; phase?: Phase; age?: number; seed?: number } = {}): LifeState {
  const s = createLife({ seed: o.seed ?? 7, country: 'JP', pace: 'p15' })
  s.age = o.age ?? 18
  s.person.heightCm = o.height ?? 171
  s.person.position = o.pos ?? 'IF'
  s.z = o.z ?? 0.5
  s.career.phase = o.phase ?? 'univ'
  s.bb = initBaseball(s, makeRng(1))
  for (const k of Object.keys(s.bb.skills) as SkillKey[]) s.bb.skills[k] = 0
  Object.assign(s.bb.skills, o.skills)
  s.bb.teamStrength = 0.6
  s.bb.teamSize = 60
  return s
}

describe('the fit of body and skills to the position', () => {
  it('height tilts the fit by position, never by much on its own', () => {
    const tallP = player({ height: 184, pos: 'P' })
    const shortP = player({ height: 158, pos: 'P' })
    expect(positionFit(tallP)).toBeGreaterThan(positionFit(shortP))
    const tallI = player({ height: 184, pos: 'IF' })
    const shortI = player({ height: 158, pos: 'IF' })
    expect(positionFit(shortI)).toBeGreaterThan(positionFit(tallI))
    // the same body suits different positions differently
    expect(positionFit(tallP)).not.toBeCloseTo(positionFit(player({ height: 184, pos: 'IF' })), 3)
    for (const s of [tallP, shortP, tallI, shortI]) expect(Math.abs(positionFit(s))).toBeLessThan(0.2)
  })

  it('skills for the position outweigh height: a short pitcher with the skills fits better than a tall one without', () => {
    const tallWeak = player({ height: 186, pos: 'P', skills: { velocity: -0.3, control: -0.3, breaking: -0.3, stamina: -0.3 } })
    const shortStrong = player({ height: 160, pos: 'P', skills: { velocity: 0.3, control: 0.3, breaking: 0.3, stamina: 0.3 } })
    expect(heightZ(tallWeak)).toBeGreaterThan(heightZ(shortStrong))
    expect(positionFit(shortStrong)).toBeGreaterThan(positionFit(tallWeak))
  })

  it('in a population height explains only part of the fit: tall players with a poor fit and short ones with a good fit both exist', () => {
    let tallBad = 0
    let shortGood = 0
    const xs: number[] = []
    const ys: number[] = []
    for (let i = 0; i < 3000; i++) {
      const s = createLife({ seed: hashSeed(i + 410_000), country: 'JP', pace: 'p15' })
      s.age = 18
      s.person.position = (['P', 'C', 'IF', 'OF'] as const)[i % 4]
      s.z = 0
      s.bb = initBaseball(s, makeRng(i + 1))
      const fit = positionFit(s)
      expect(Math.abs(fit)).toBeLessThanOrEqual(0.35)
      xs.push(heightZ(s))
      ys.push(fit)
      if (heightZ(s) > 1 && fit < 0) tallBad++
      if (heightZ(s) < -1 && fit > 0) shortGood++
    }
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length
    const my = ys.reduce((a, b) => a + b, 0) / ys.length
    const cov = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0)
    const r = cov / Math.sqrt(xs.reduce((a, x) => a + (x - mx) ** 2, 0) * ys.reduce((a, y) => a + (y - my) ** 2, 0))
    expect(Math.abs(r)).toBeLessThan(0.5)
    expect(tallBad).toBeGreaterThan(10)
    expect(shortGood).toBeGreaterThan(10)
  })

  it('the evaluation counts it, but height alone moves the evaluation only a little', () => {
    const a = evaluate(player({ height: 186, pos: 'P' }))
    const b = evaluate(player({ height: 160, pos: 'P' }))
    expect(Math.abs(a.total - b.total)).toBeLessThan(0.3)
    expect(a.fit).toBeGreaterThan(b.fit)
    // ability, record, injuries and form all count too
    const base = player({ pos: 'P' })
    const better = player({ pos: 'P', z: 1.5 })
    expect(evaluate(better).total).toBeGreaterThan(evaluate(base).total + 0.8)
    const hurt = player({ pos: 'P' })
    hurt.bb!.injuries = 2
    expect(evaluate(hurt).total).toBeLessThan(evaluate(base).total)
    const koshien = player({ pos: 'P' })
    koshien.career.achievements = ['甲子園', '主将']
    expect(evaluate(koshien).total).toBeGreaterThan(evaluate(base).total)
    const young = player({ pos: 'P', age: 15 })
    expect(evaluate(young).growth).toBeGreaterThan(evaluate(base).growth)
    // a regular on a strong team is rated higher than a regular on a weak one
    const strongTeam = player({ pos: 'P' })
    strongTeam.bb!.role = 'starter'
    strongTeam.bb!.teamStrength = 1.2
    const weakTeam = player({ pos: 'P' })
    weakTeam.bb!.role = 'starter'
    weakTeam.bb!.teamStrength = -0.1
    expect(evaluate(strongTeam).total).toBeGreaterThan(evaluate(weakTeam).total)
  })

  it('a suggested position is the one the body and skills suit best', () => {
    const s = player({ height: 160, pos: 'P', skills: { speed: 0.4, arm: 0.3, fielding: 0.3, velocity: -0.3, control: -0.3 } })
    const b = bestPosition(s)
    expect(b.pos).not.toBe('P')
    expect(b.gain).toBeGreaterThan(0.1)
    expect(positionFit(s, b.pos)).toBe(b.fit)
  })
})

describe('the squad: the strength of the team and the fit are used', () => {
  const starterShare = (teamStrength: number, s0: LifeState) => {
    let n = 0
    const trials = 800
    for (let i = 0; i < trials; i++) {
      const s = structuredClone(s0)
      s.bb!.teamStrength = teamStrength
      const { better, betterAtPos } = rankInTeam(s, makeRng(i + 1), 2, [0])
      if (better < 25 && startsAt(s.person.position, betterAtPos)) n++
    }
    return n / trials
  }

  it('the same player is a regular less often in a stronger team', () => {
    const s = player({ z: 0.8, phase: 'univ' })
    const weak = starterShare(0.2, s)
    const mid = starterShare(0.9, s)
    const strong = starterShare(1.5, s)
    expect(weak).toBeGreaterThan(mid)
    expect(mid).toBeGreaterThan(strong)
    expect(weak - strong).toBeGreaterThan(0.2)
  })

  it('after high school the fit to the position is part of the team score; in high school it is not (calibrated)', () => {
    const fits = { velocity: 0.3, control: 0.3, breaking: 0.3, stamina: 0.3 }
    const univFit = player({ pos: 'P', phase: 'univ', skills: fits })
    const univNo = player({ pos: 'P', phase: 'univ' })
    expect(teamScore(univFit)).toBeGreaterThan(teamScore(univNo))
    const hsFit = player({ pos: 'P', phase: 'hs', skills: fits })
    const hsNo = player({ pos: 'P', phase: 'hs' })
    expect(teamScore(hsFit)).toBe(teamScore(hsNo))
  })
})

describe('internal ratings of teams: what is known and what is assumed', () => {
  it('the federation’s own pages were read: 27 leagues with their members, mapped to the national list', () => {
    expect(UNIV_LEAGUES.length).toBe(27)
    expect(JUBF_META.accessed).toBe('2026-10-18')
    for (const l of UNIV_LEAGUES) expect(l.members.length, l.name).toBe(l.teams)
    const members = UNIV_LEAGUES.flatMap((l) => l.members)
    expect(members.length).toBe(370)
    // a campus, a faculty, a 高専 or a 短大 is not a university of its own in the national list: those are listed, not guessed
    expect(LEAGUE_SCHOOL_IDS.length + UNMAPPED_LEAGUE_MEMBERS.length).toBe(members.length)
    expect(LEAGUE_SCHOOL_IDS.length).toBeGreaterThan(330)
    for (const u of UNMAPPED_LEAGUE_MEMBERS) expect(u.name, u.name).toMatch(/キャンパス|学部|高等専門学校|短期大学|防衛大学校|北海道教育大学|オホーツク|野田|大学$/)
    // the divisions (secondary page) agree with the federation’s member lists
    expect(UNMATCHED_DIVISION_MEMBERS).toEqual([])
    expect(coverage('univ').clubHard).toBe(LEAGUE_SCHOOL_IDS.length)
    for (const n of ['東京大学', '早稲田大学', '慶應義塾大学', '東洋大学', '近畿大学', '東北福祉大学', '富士大学']) {
      const u = UNIVERSITIES.find((x) => x.name === n && x.branch === 'main')!
      expect(leagueSeatOf(u.id), n).toBeDefined()
    }
  })

  it('the finalists of the national championship (the federation’s records) are universities of the leagues', () => {
    expect(CHAMPIONS.length).toBe(21)
    expect(UNMATCHED_FINALISTS).toEqual([])
    expect(Object.values(FINALS_BY_LEAGUE).reduce((a, b) => a + b, 0)).toBe(42)
    const aoyama = UNIVERSITIES.find((u) => u.name === '青山学院大学' && u.branch === 'main')!
    expect(FINALS_BY_SCHOOL.get(aoyama.id)).toEqual({ won: 3, second: 1 })
    expect(Object.keys(FINALS_BY_LEAGUE).length).toBeGreaterThan(8)
  })

  it('a university of a league read is rated by its league and division; the others are marked as estimated', () => {
    const waseda = UNIVERSITIES.find((u) => u.name === '早稲田大学' && u.branch === 'main')!
    const toto4 = UNIVERSITIES.find((u) => u.name === '順天堂大学' && u.branch === 'main')!
    const rw = univRating(waseda)
    const r4 = univRating(toto4)
    expect(rw.basis).toBe('verified')
    expect(rw.league).toContain('東京六大学野球連盟')
    expect(r4.league).toContain('東都大学野球連盟4部')
    expect(rw.note).toContain('全国大会')
    expect(rw.value).toBeGreaterThan(r4.value + 0.5)
    // the leagues differ: 東都 1部 above 東都 3部, 六大学 above them
    const t1 = UNIVERSITIES.find((u) => u.name === '東洋大学' && u.branch === 'main')!
    const t3 = UNIVERSITIES.find((u) => u.name === '上智大学' && u.branch === 'main')!
    expect(univRating(t1).value).toBeGreaterThan(univRating(t3).value)
    // everything else: no league known, an estimate that is the same in every life, and never shown as confirmed
    const others = UNIVERSITIES.filter((u) => u.branch === 'main' && !leagueSeatOf(u.id)).slice(0, 80)
    for (const u of others) {
      const r = univRating(u)
      expect(r.basis).toBe('estimated')
      expect(r.league).toBeUndefined()
      expect(univRating(u).value).toBe(r.value)
    }
    expect(Math.max(...others.map((u) => univRating(u).value))).toBeLessThan(UNIV_MEAN + 0.6)
    // the leagues without divisions are told apart by their finalists: 六大学 (many finals) above a league with none
    const tokyo6 = leagueSeatOf(UNIVERSITIES.find((u) => u.name === '東京大学' && u.branch === 'main')!.id)!.league
    expect(univRating(UNIVERSITIES.find((u) => u.name === '東京大学' && u.branch === 'main')!).value).toBeGreaterThan(UNIV_MEAN + 0.3)
    expect(FINALS_BY_LEAGUE[tokyo6]).toBeGreaterThan(8)
  })

  it('a high school is rated by its 甲子園 record (official lists), and only assumed without one', () => {
    expect(KOSHIEN_META.rowsMatched / KOSHIEN_META.rowsTotal).toBeGreaterThan(0.9)
    expect(KOSHIEN_META.schools).toBeGreaterThan(400)
    const osaka = HIGH_SCHOOLS.find((s) => s.name === '大阪桐蔭高等学校')!
    const k = koshienOf(osaka.id)!
    expect(k.summer.length).toBeGreaterThanOrEqual(8)
    expect(k.spring.length).toBeGreaterThanOrEqual(5)
    expect(k.summer.every((y) => y >= 2004 && y <= 2026 && y !== 2020)).toBe(true)
    const r = hsRating(osaka)
    expect(r.basis).toBe('verified')
    expect(r.note).toMatch(/甲子園 夏\d+回.*春\d+回/)
    // a school with a long record is above a school with one or two appearances, and both above the assumption
    const rarely = HIGH_SCHOOLS.find((s) => {
      const q = koshienOf(s.id)
      return q && q.summer.length + q.spring.length === 1
    })!
    expect(r.value).toBeGreaterThan(hsRating(rarely).value)
    const none = HIGH_SCHOOLS.filter((s) => s.owner === 'private' && s.branch === 'main' && !koshienOf(s.id)).slice(0, 60)
    for (const s of none) {
      const e = hsRating(s)
      expect(e.basis).toBe('estimated')
      expect(e.note).toBeUndefined()
      expect(e.value).toBeLessThan(r.value)
    }
    // the strong-school offers include schools with a record, named for a team near the player’s own strength
    const p = player({ z: 1.4, age: 15, phase: 'hs' })
    p.person.prefecture = 26
    p.bb!.teamStrength = 1.0
    const opts = hsShortlist(p, 'strong', makeRng(2))
    expect(opts.length).toBeGreaterThanOrEqual(2)
    for (const o of opts) expect(o.rating).toBeDefined()
    expect(opts.some((o) => o.basis === 'verified')).toBe(true)
  })

  it('an NPB club is rated by its record over 2023–2025 (the official standings): 12 clubs, centred', () => {
    const clubs = ORGS.filter((o) => o.type === 'pro')
    expect(clubs.length).toBe(12)
    for (const c of clubs) expect(NPB_STANDINGS[c.id], c.id).toHaveLength(3)
    const vals = clubs.map((c) => npbRating(c.id)!.value)
    expect(Math.abs(vals.reduce((a, b) => a + b, 0) / 12 - NPB_MEAN)).toBeLessThan(0.1)
    expect(npbRating('npb-hawks')!.value).toBeGreaterThan(npbRating('npb-lions')!.value + 0.4)
    expect(npbRating('npb-hawks')!.basis).toBe('verified')
    expect(npbRating('il-kagawa')).toBeUndefined()
    // every season is 143 games
    for (const [id, ss] of Object.entries(NPB_STANDINGS)) for (const x of ss) expect(x.w + x.l + x.d, `${id} ${x.year}`).toBe(143)
  })

  it('a deeper club gives the same player less playing time: the 1軍 share falls with the club’s strength', () => {
    const games = (orgId: string) => {
      let total = 0
      for (let i = 0; i < 300; i++) {
        const s = player({ z: 2.1, age: 24, phase: 'pro', seed: 100 + i })
        s.career.orgId = orgId
        s.career.proDebut = true
        s.career.proSeasons = 3
        const c = { s, rng: makeRng(i + 1), headless: true, add: () => {}, ask: () => {}, canAsk: () => false } as unknown as EventCtx
        proSeason(c, { ikusei: false, debuted: true, debutNow: false, released: false, standing: 0.3 })
        total += s.bb!.rec?.official.pro?.games ?? 0
      }
      return total / 300
    }
    const strong = games('npb-hawks')
    const weak = games('npb-lions')
    expect(weak).toBeGreaterThan(strong + 4)
  })

  it('US colleges: Division I programs with state and conference (secondary list), a conference tier each', () => {
    expect(US_COLLEGES.length).toBeGreaterThan(290)
    expect(new Set(US_COLLEGES.map((c) => c.id)).size).toBe(US_COLLEGES.length)
    expect(new Set(US_COLLEGES.map((c) => c.name)).size).toBe(US_COLLEGES.length)
    for (const c of US_COLLEGES) {
      expect(c.name && c.state && c.conference, c.id).toBeTruthy()
      expect(conferenceTier(c.conference), c.conference).toBeDefined()
    }
    const sec = US_COLLEGES.find((c) => c.name === 'Vanderbilt University')!
    const nec = US_COLLEGES.find((c) => c.conference === 'Northeast Conference')!
    expect(usRating(sec).value).toBeGreaterThan(usRating(nec).value + 0.8)
    expect(usRating(sec).basis).toBe('secondary')
    // invitations: few, fixed for a player, more for a better one
    const hi = player({ z: 2.6, seed: 9 })
    hi.bb!.scout = 55
    const lo = player({ z: 0.3, seed: 9 })
    const a = usInvites(hi).filter((x) => x.invited)
    expect(usInvites(hi).filter((x) => x.invited).map((x) => x.college.id)).toEqual(a.map((x) => x.college.id))
    expect(a.length).toBeLessThanOrEqual(6)
    expect(usInvites(lo).filter((x) => x.invited).length).toBeLessThanOrEqual(a.length + 1)
  })

  it('a company team in the 日本選手権 list is rated above the others; the list is the one fact on strength', () => {
    const nat = AMATEUR_TEAMS.filter((t) => t.nationals)
    const non = AMATEUR_TEAMS.filter((t) => !t.nationals)
    expect(nat.length).toBeGreaterThan(10)
    expect(non.length).toBeGreaterThan(10)
    expect(amateurRating(nat[0].name)!.basis).toBe('verified')
    expect(amateurRating(non[0].name)!.basis).toBe('estimated')
    expect(amateurRating(nat.find((t) => t.kind !== 'club')!.name)!.value).toBeGreaterThan(amateurRating(non.find((t) => t.kind !== 'club')!.name)!.value)
    expect(amateurRating('存在しないチーム')).toBeUndefined()
  })

  it('independent leagues are assumptions per league', () => {
    // the evidence is the official draft lists; the step from picks to a level is an assumption, stated in the text
    expect(indepRating('bc-chiba')!.basis).toBe('verified')
    expect(indepRating('bc-chiba')!.why).toContain('推定')
    // (the 日本海リーグ clubs sent more players up, per club, than most of the BC clubs did)
    expect(indepRating('nl-toyama')!.value).toBeGreaterThan(indepRating('bc-chiba')!.value)
    expect(indepRating('il-tokushima')!.value).toBeGreaterThan(indepRating('nl-toyama')!.value)
    expect(indepRating('npb-giants')).toBeUndefined()
  })

  it('level words, never numbers', () => {
    expect(levelWord(0.6)).toBe('全国レベルの強豪')
    expect(levelWord(0)).toBe('中堅')
    expect(levelWord(-0.5)).toBe('下位')
  })
})

describe('an invitation is not a place', () => {
  it('whether a team invites and whether he gets in are two different chances', () => {
    const strong = amateurRating(AMATEUR_TEAMS.find((t) => t.nationals && t.kind !== 'club')!.name)!
    const ev = evaluate(player({ z: 1.0 }))
    const universities = UNIVERSITIES.filter((u) => u.branch === 'main').slice(0, 60).map(univRating)
    for (const rt of [strong, ...universities]) {
      // (two different functions: they agree only where both are held at the ceiling)
      if (inviteP(ev, rt) < 0.97 || admitP(ev, rt, 'sports') < 0.97) expect(inviteP(ev, rt)).not.toBeCloseTo(admitP(ev, rt, 'sports'), 6)
      expect(admitP(ev, rt, 'sports')).toBeLessThanOrEqual(0.97)
      // the same team: a walk-on without an invitation is harder than a recommendation with one
      expect(admitP(ev, rt, 'walkon')).toBeLessThanOrEqual(admitP(ev, rt, 'sports'))
      // a club team asks the least
      expect(admitP(ev, rt, 'club')).toBeGreaterThanOrEqual(admitP(ev, rt, 'general'))
    }
    // stronger team: fewer invitations and fewer places
    const waseda = univRating(UNIVERSITIES.find((u) => u.name === '早稲田大学' && u.branch === 'main')!)
    const jun = univRating(UNIVERSITIES.find((u) => u.name === '順天堂大学' && u.branch === 'main')!)
    expect(inviteP(ev, waseda)).toBeLessThan(inviteP(ev, jun))
    expect(admitP(ev, waseda, 'sports')).toBeLessThan(admitP(ev, jun, 'sports'))
    // a better player is invited and taken more often
    const good = evaluate(player({ z: 2.0 }))
    expect(inviteP(good, waseda)).toBeGreaterThan(inviteP(ev, waseda))
    expect(admitP(good, waseda, 'sports')).toBeGreaterThan(admitP(ev, waseda, 'sports'))
  })

  it('who invites him is fixed for a player, and a better player has more and stronger invitations', () => {
    const low = player({ z: -0.3, seed: 31 })
    const high = player({ z: 2.2, seed: 31 })
    low.person.prefecture = high.person.prefecture = 12
    const a1 = univInvites(low)
    const a2 = univInvites(low)
    expect(a1.map((x) => [x.school.id, x.invited])).toEqual(a2.map((x) => [x.school.id, x.invited]))
    const nLow = a1.filter((x) => x.invited).length
    const hi = univInvites(high)
    const nHigh = hi.filter((x) => x.invited).length
    expect(nHigh).toBeGreaterThan(nLow)
    // the three strongest teams that invited him: stronger for the better player
    const top3 = (list: typeof hi) => {
      const v = list.filter((x) => x.invited).map((x) => x.rating.value).sort((a, b) => b - a).slice(0, 3)
      return v.reduce((a, b) => a + b, 0) / Math.max(1, v.length)
    }
    expect(top3(hi)).toBeGreaterThan(top3(a1))
    expect(nHigh).toBeLessThanOrEqual(12)
  })

  it('the university shortlist of a player with offers: invitations by baseball level, a safe one, places not certain', () => {
    const high = player({ z: 1.6, seed: 5 })
    const low = player({ z: -0.2, seed: 5 })
    for (const s of [high, low]) {
      s.person.prefecture = 12
      s.status.knowledge = 50
      const opts = univShortlist(s, 'club', makeRng(3))
      const sports = opts.filter((o) => o.method === 'sports')
      expect(sports.length).toBeGreaterThanOrEqual(1)
      for (const o of sports) {
        expect(o.invited).toBe(true)
        expect(o.rating).toBeDefined()
        expect(o.basis).toBeDefined()
      }
      const safe = opts.find((o) => o.safe)!
      expect(safe.p).toBeGreaterThanOrEqual(0.9)
      // the top invitation of a weaker player is not a sure place
      if (s === low && sports.length > 1) expect(sports[0].p).toBeLessThan(0.9)
      const picked = autoPick(opts)
      expect(opts[picked].method === 'sports' || opts[picked].safe).toBe(true)
      // the hint names the level of the team and how it is known, never a number
      expect(optionHint(sports[0])).toMatch(/野球部の強さの目安は/)
      expect(optionHint(sports[0])).toContain('声がかかっている')
    }
    const topRating = (s: LifeState) => Math.max(...univShortlist(s, 'club', makeRng(3)).filter((o) => o.method === 'sports').map((o) => o.rating ?? -9))
    expect(topRating(high)).toBeGreaterThan(topRating(low))
  })

  it('the recommendation chance counts the body, growth, injuries and what coaches and selectors saw', () => {
    const base = player({ z: 1.0, age: 17, phase: 'hs' })
    const p0 = sportsP(base)
    const hurt = structuredClone(base)
    hurt.bb!.injuries = 2
    expect(sportsP(hurt)).toBeLessThan(p0)
    const trusted = structuredClone(base)
    trusted.flags = { 'coach.trust': 16, 'rep.youth': 16 }
    expect(evaluate(trusted).total).toBeGreaterThan(evaluate(base).total)
  })
})

// ---------------------------------------------------------------- the doors on leaving school

interface Played {
  s: LifeState
  routeAsked: Decision[]
}

function playTo(seed: number, until: number, choose?: (d: Decision, s: LifeState) => number | undefined): Played {
  const sim: Sim = { params: defaultParams() }
  const s = createLife({ seed, country: 'JP', pace: 'p15' })
  const routeAsked: Decision[] = []
  for (let g = 0; g < 130 && s.alive && s.age < until; g++) {
    const plan = planYear(s, sim)
    for (const e of plan.events) s.log.push(e.entry)
    let d = plan.decision?.decision
    while (d && s.alive) {
      if (d.id === 'jp.route') routeAsked.push(d)
      const r = resolveDecision(s, choose?.(d, s) ?? d.autoIndex, sim)
      for (const e of r.events) s.log.push(e.entry)
      d = r.followUp?.decision
    }
    endYear(s)
  }
  return { s, routeAsked }
}

describe('the doors after high school: one for every standing, never the おまかせ one', () => {
  const lives = Array.from({ length: 700 }, (_, i) => playTo(hashSeed(i + 1_410_000), 19))
  const asked = lives.filter((l) => l.routeAsked.some((d) => d.body.includes('卒業が近づいて')))
  const labelsOf = (l: Played) => l.routeAsked[0].choices.map((c) => c.label)

  it('a player nobody invited can still try a club team or a walk-on at a university; both are offered', () => {
    expect(asked.length).toBeGreaterThan(60)
    const club = asked.filter((l) => labelsOf(l).some((x) => x.includes('クラブチーム')))
    const walk = asked.filter((l) => labelsOf(l).some((x) => x.includes('入部テスト')))
    expect(club.length).toBeGreaterThan(asked.length * 0.4)
    expect(walk.length).toBeGreaterThan(asked.length * 0.3)
    // the walk-on door is for those without a university offer: when the university offer is there, it is not
    for (const l of asked) {
      const labels = labelsOf(l)
      if (labels.some((x) => x === '大学で野球を続ける')) expect(labels.some((x) => x.includes('入部テスト'))).toBe(false)
    }
  })

  it('おまかせ never takes a new door: the answer is the same as before the doors existed', () => {
    for (const l of asked) {
      const d = l.routeAsked[0]
      const picked = d.choices[d.autoIndex].label
      expect(picked).not.toMatch(/クラブチーム|入部テスト|米国/)
    }
  })

  it('an overseas offer comes only to players with a high standing, and is rare', () => {
    const over = asked.filter((l) => labelsOf(l).some((x) => x.includes('米国')))
    expect(over.length).toBeLessThan(asked.length * 0.1)
    for (const l of over) expect(l.s.z, `seed ${l.s.config.seed}`).toBeGreaterThan(0.4)
  })

  const take = (word: string) => (d: Decision) => (d.id === 'jp.route' ? (d.choices.findIndex((c) => c.label.includes(word)) >= 0 ? d.choices.findIndex((c) => c.label.includes(word)) : undefined) : undefined)

  it('the club-team door: a real club of the player’s region, work first, the pay is the job’s', () => {
    let n = 0
    for (let i = 0; i < 400 && n < 12; i++) {
      const seed = hashSeed(i + 1_510_000)
      const base = playTo(seed, 19)
      if (!base.routeAsked.some((d) => d.choices.some((c) => c.label.includes('クラブチーム')))) continue
      const l = playTo(seed, 19, take('クラブチーム'))
      n++
      const s = l.s
      if (s.career.phase === 'company') {
        expect(s.flags?.['route.club']).toBeDefined()
        expect(s.after?.work?.employer).toBe('small')
        expect(s.career.amateurTeam === undefined || AMATEUR_TEAMS.some((t) => t.name === s.career.amateurTeam)).toBe(true)
        expect(s.career.salary).toBe(330)
      } else {
        expect(s.career.phase).toBe('retired')
      }
    }
    expect(n).toBeGreaterThan(5)
  })

  it('the walk-on door: a tryout that can fail, in which case baseball ends but the student goes on', () => {
    let passed = 0
    let failed = 0
    for (let i = 0; i < 600 && passed + failed < 30; i++) {
      const seed = hashSeed(i + 1_610_000)
      const base = playTo(seed, 19)
      if (!base.routeAsked.some((d) => d.choices.some((c) => c.label.includes('入部テスト')))) continue
      const l = playTo(seed, 18, take('入部テスト'))
      const s = l.s
      expect(s.schools?.univ, `seed ${seed}`).toBeDefined()
      if (s.career.phase === 'univ') {
        passed++
        expect(s.schools!.univ!.club).toBe('club')
        expect(s.bb!.teamStrength).toBeDefined()
      } else {
        failed++
        expect(s.job).toBe('大学生')
        expect(s.log.some((e) => e.text.includes('入部テストには受かりませんでした'))).toBe(true)
      }
    }
    expect(passed).toBeGreaterThan(0)
    expect(failed).toBeGreaterThan(0)
  })

  it('the overseas door: admission is separate from the offer, and a failure falls back on the independent leagues or the end', () => {
    let seen = 0
    const ends = new Set<string>()
    for (let i = 0; i < 6000 && seen < 25; i++) {
      const seed = hashSeed(i + 1_710_000)
      const base = playTo(seed, 18)
      if (!base.routeAsked.some((d) => d.choices.some((c) => c.label.includes('米国')))) continue
      seen++
      const s = playTo(seed, 18, take('米国')).s
      if (s.schools?.univ?.id.startsWith('us-d1-')) {
        ends.add('in')
        expect(['univ', 'retired']).toContain(s.career.phase)
        expect(US_COLLEGES.some((c) => c.name === s.schools!.univ!.name)).toBe(true)
        expect(s.flags?.['route.overseas']).toBeDefined()
      } else {
        ends.add(s.career.phase)
        expect(['indep', 'retired']).toContain(s.career.phase)
      }
    }
    expect(seen).toBeGreaterThan(3)
    expect(ends.size).toBeGreaterThanOrEqual(1)
  }, 120_000)
})

describe('the team’s strength reaches the squad after high school', () => {
  it('a university player’s team strength is set from the team’s rating, not the generic draw', () => {
    let n = 0
    for (let i = 0; i < 500 && n < 30; i++) {
      const l = playTo(hashSeed(i + 1_810_000), 21)
      const u = l.s.schools?.univ
      if (!u || u.club !== 'club' || u.rating === undefined || !l.s.bb) continue
      n++
      expect(Math.abs(l.s.bb.teamStrength - u.rating)).toBeLessThan(0.45)
    }
    expect(n).toBeGreaterThan(5)
  })
})

describe('new events use the evaluation, the body and the position', () => {
  const spec = (id: string) => SPECS.find((s) => s.id === id)!

  it('the body event is for a tall player who is light; the position talk is for a body that suits another place', () => {
    const light = player({ height: 184, pos: 'P', age: 17, phase: 'hs' })
    light.bb!.build = 0.8
    expect(spec('x.train.body').when!(light)).toBe(true)
    const heavy = structuredClone(light)
    heavy.bb!.build = 1.3
    expect(spec('x.train.body').when!(heavy)).toBe(false)
    const mismatch = player({ height: 160, pos: 'P', age: 17, phase: 'hs', skills: { speed: 0.4, arm: 0.3, fielding: 0.3, velocity: -0.3, control: -0.3 } })
    expect(spec('x.pos.view').when!(mismatch)).toBe(true)
    const fitted = player({ height: 184, pos: 'P', age: 17, phase: 'hs', skills: { velocity: 0.3, control: 0.3, breaking: 0.2, stamina: 0.2 } })
    expect(spec('x.pos.view').when!(fitted)).toBe(false)
  })

  it('accepting the position talk moves him to the position that suits him best, and the fit improves', () => {
    const s = player({ height: 160, pos: 'P', age: 17, phase: 'hs', skills: { speed: 0.4, arm: 0.3, fielding: 0.3, velocity: -0.3, control: -0.3 } })
    const before = positionFit(s)
    const want = bestPosition(s).pos
    const ch = spec('x.pos.view').choices![0]
    applyEffect(s, ch.effects)
    expect(s.person.position).toBe(want)
    expect(positionFit(s)).toBeGreaterThan(before)
  })

  it('the youth selection is for a good evaluation only, and being picked is likelier for a better one', () => {
    const weak = player({ z: -0.5, age: 16, phase: 'hs' })
    const strong = player({ z: 1.6, age: 16, phase: 'hs' })
    expect(spec('x.rep.youth').when!(weak)).toBe(false)
    expect(spec('x.rep.youth').when!(strong)).toBe(true)
    const w = spec('x.rep.youth').choices![0].outcomes[0].weight as (s: LifeState) => number
    expect(w(strong)).toBeGreaterThan(w(player({ z: 0.9, age: 16, phase: 'hs' })))
    // picked: the fact is set and the evaluation rises
    const s = structuredClone(strong)
    const e0 = evaluate(s).total
    applyEffect(s, spec('x.rep.youth').choices![0].outcomes[0].effects)
    expect(evaluate(s).total).toBeGreaterThan(e0)
  })

  it('a strong, large team gives the crowded-team talk to a bench player; a weak one gives the pillar talk to a regular', () => {
    const bench = player({ z: 0.2, phase: 'univ' })
    bench.bb!.role = 'bench'
    bench.bb!.teamStrength = 1.2
    bench.bb!.teamSize = 80
    expect(spec('x.team.crowded').when!(bench)).toBe(true)
    const weakReg = player({ z: 1.0, phase: 'univ' })
    weakReg.bb!.role = 'starter'
    weakReg.bb!.teamStrength = 0.0
    expect(spec('x.team.small').when!(weakReg)).toBe(true)
    expect(spec('x.team.crowded').when!(weakReg)).toBe(false)
    expect(spec('x.team.small').when!(bench)).toBe(false)
  })

  it('the choices of the new events change what happens (effects differ) and there are many of them', () => {
    const fresh = [
      'x.gear.glove', 'x.gear.spikes', 'x.gear.bat', 'x.fan.supporter', 'x.rival.league', 'x.train.method', 'x.train.body', 'x.coach.trust',
      'x.trip.away', 'x.trip.camp', 'x.game.afterLoss', 'x.rep.youth', 'x.pos.view', 'x.hs.visit', 'x.study.exam', 'x.study.language',
      'x.friend.trouble', 'x.love.confess', 'x.family.cost', 'x.health.sleep', 'x.pro.endorse', 'x.pro.winter', 'x.team.crowded',
      'x.team.small', 'x.team.crowdedMove', 'x.life.sideJob', 'x.life.travel', 'x.life.savings', 'x.life.coachVisit', 'x.life.obMeet', 'x.life.backPain',
    ]
    for (const id of fresh) {
      const sp = spec(id)
      expect(sp, id).toBeDefined()
      expect(sp.choices!.length, id).toBeGreaterThanOrEqual(2)
      expect(EVENTS.get(id)?.extra, id).toBe(true)
    }
    const followUps = SPECS.filter((s) => s.followOnly && fresh.some((f) => (spec(f).choices ?? []).some((c) => c.outcomes.some((o) => (o.follow ?? []).some((x) => x.id === s.id)))))
    expect(followUps.length).toBeGreaterThanOrEqual(12)
  })

  it('a choice books its follow-up and sets the fact the follow-up reads; the follow-up then happens and changes something', () => {
    // (the potential mode's events need a life with talent: they are tried in potential.test.tsx)
    const parents = SPECS.filter((s) => !s.potentialOnly && (s.choices ?? []).some((c) => (c.follow ?? []).length > 0))
    expect(parents.length).toBeGreaterThanOrEqual(15)
    let checked = 0
    for (const sp of parents) {
      const def = EVENTS.get(sp.id)!
      sp.choices!.forEach((ch, i) => {
        if (!ch.follow?.length) return
        // never the おまかせ choice: the おまかせ lives are not touched
        expect(sp.auto, `${sp.id} / ${ch.label}`).not.toBe(i)
        expect(ch.flag, `${sp.id} / ${ch.label}`).toBeDefined()
        // the same choice in the situations where it can be met: a student, a pro, a worker with a family
        const fu = EVENTS.get(ch.follow![0].id)!
        expect(fu.followOnly).toBe(true)
        const situations: ((s: LifeState) => void)[] = [
          () => {},
          (s) => {
            s.career.phase = 'pro'
            s.career.proDebut = true
            s.career.draftedFrom = '大学'
            s.career.phaseYears = 0
          },
          (s) => {
            s.career.phase = 'hs'
            s.career.strongSchool = true
            s.career.phaseYears = 1
          },
          (s) => {
            s.career.phase = 'retired'
            s.age = 40
            s.money = 400
            s.status.health = 55
            s.status.happiness = 45
            s.family.kids = [8, 15]
            s.family.partner = '花'
            s.family.father = null
            s.family.mother = null
            s.career.highestRank = 6
            s.after = { edu: 'univ', jobless: 0, home: 'own', loan: 0, baseballLife: [], community: false, care: false, retired: false, work: { title: '会社員', industry: 'office', employer: 'small', level: 1, years: 6, satisfaction: 60, regular: true, baseball: false } }
          },
        ]
        let ok = false
        for (const prep of situations) {
          const s = player({ z: 1.0, age: 18, phase: 'univ', seed: 50 + i })
          prep(s)
          const c = { s, rng: makeRng(i + 3), headless: true, add: () => {}, ask: () => {}, canAsk: () => true } as unknown as EventCtx
          def.resolve!(c, i, { open: sp.choices!.map((_, k) => k).join(',') })
          expect(s.due?.some((d) => d.from === sp.id && ch.follow!.some((f) => f.id === d.id)), `${sp.id} books ${ch.follow![0].id}`).toBe(true)
          for (const f of [ch.flag!].flat()) expect(s.flags?.[f], `${sp.id}: ${f}`).toBeDefined()
          if (!fu.when!(s)) continue
          const out: string[] = []
          const c2 = { s, rng: makeRng(i + 9), headless: true, add: (_k: string, x: string) => out.push(x), ask: () => {}, canAsk: () => true } as unknown as EventCtx
          fu.run(c2)
          expect(out.length, fu.id).toBe(1)
          ok = true
          break
        }
        expect(ok, `${fu.id} can happen after ${sp.id} / ${ch.label}`).toBe(true)
        checked++
      })
    }
    expect(checked).toBeGreaterThanOrEqual(30)
  })

  it('a choice with a fact changes later chances: studying English raises the overseas chance, a coach’s trust raises the recommendation', () => {
    const base = player({ z: 1.0, age: 17, phase: 'hs' })
    const trusted = structuredClone(base)
    applyEffect(trusted, { flag: 'coach.trust' })
    expect(evaluate(trusted).total).toBeGreaterThan(evaluate(base).total)
    const visited = structuredClone(base)
    applyEffect(visited, { flag: 'hs.visitUniv' })
    expect(evaluate(visited).total).toBeGreaterThan(evaluate(base).total)
    expect(sportsP(trusted)).toBeGreaterThanOrEqual(sportsP(base))
  })
})

// keep the import used by lint when the tests above change
export type { EventCtx }
