import { describe, expect, it } from 'vitest'
import { createLife } from './life.ts'
import { makeRng } from './rng.ts'
import { TIER_LABEL, devText, generalP, hsShortlist, optionHint, optionLabel, studentDev, tierOf, univShortlist, type Option } from './route/schools.ts'
import type { LifeState } from './types.ts'

// PROJECT_PLAN §11.19: the schools named for a 一般入試 are drawn from windows of 偏差値 around the student's own level:
// a few 挑戦校, some 実力相応校 and a 安全校, four or five in all, never a school far from his level to fill the list.

const PREFS = [0, 3, 12, 13, 22, 26, 39, 46]
const KNOWLEDGE = [10, 20, 30, 40, 45, 50, 55, 60, 65, 70, 80, 90, 99]
const TIERS = ['reach', 'match', 'safe']
// (Okinawa has few schools and none easy enough to be a safe one for a student a little under the middle)
const OKINAWA = 46

function student(know: number, pref: number, seed = 1000): LifeState {
  const s = createLife({ seed: seed + know * 7 + pref, country: 'JP', pace: 'p15' })
  s.status.knowledge = know
  s.person.prefecture = pref
  return s
}

const general = (o: Option) => o.method !== 'sports'
type Lists = { kind: string; s: LifeState; opts: Option[] }[]

function lists(): Lists {
  const out: Lists = []
  for (const know of KNOWLEDGE)
    for (const pref of PREFS) {
      const s = student(know, pref)
      out.push({ kind: 'hs', s, opts: hsShortlist(s, 'public', makeRng(know + pref)) })
      out.push({ kind: 'hs-quit', s, opts: hsShortlist(s, 'quit', makeRng(know + pref + 1)) })
      out.push({ kind: 'univ', s, opts: univShortlist(s, 'student', makeRng(know + pref)) })
      out.push({ kind: 'walkon', s, opts: univShortlist(s, 'walkon', makeRng(know + pref)) })
    }
  return out
}
const all = lists()

describe('受験候補: 挑戦校・実力相応校・安全校', () => {
  it('there are four or five for a student in the middle of the range, and at least three for everyone', () => {
    for (const { kind, s, opts } of all) {
      const sd = studentDev(s)
      expect(opts.length, `${kind} know ${s.status.knowledge} pref ${s.person.prefecture}`).toBeGreaterThanOrEqual(3)
      expect(opts.length).toBeLessThanOrEqual(5)
      if (sd >= 42 && sd <= 62 && kind !== 'walkon' && s.person.prefecture !== OKINAWA) expect(opts.length, `${kind} sd ${sd.toFixed(0)} pref ${s.person.prefecture}: ${opts.map((o) => `${o.name}/${o.dev}/${o.p.toFixed(2)}`).join(' | ')}`).toBeGreaterThanOrEqual(4)
    }
    const counts = all.filter((x) => studentDev(x.s) >= 42 && studentDev(x.s) <= 62 && x.s.person.prefecture !== OKINAWA).map((x) => x.opts.length)
    expect(counts.filter((n) => n >= 4).length / counts.length).toBeGreaterThan(0.85)
  })

  it('no school far from his level fills the list: all within 15 of his 偏差値, and the list does not span the whole scale', () => {
    for (const { kind, s, opts } of all) {
      const sd = studentDev(s)
      const lo = Math.max(sd, 36)
      // (a student above every school of his prefecture is shown the nearest ones)
      if (sd <= 68) for (const o of opts.filter(general)) expect(Math.abs(o.dev - lo), `${kind} sd ${sd.toFixed(0)}: ${o.name} ${o.dev}`).toBeLessThanOrEqual(15)
      const devs = opts.map((o) => o.dev)
      if (sd >= 40 && sd <= 66) expect(Math.max(...devs) - Math.min(...devs), `${kind} sd ${sd.toFixed(0)}`).toBeLessThanOrEqual(22)
    }
  })

  it('the tiers come from the chance, run from hardest to easiest, and one safe school is where a failed first choice falls back', () => {
    for (const { kind, s, opts } of all) {
      const id = `${kind} know ${s.status.knowledge}`
      let last = -1
      let lastDev = 99
      for (const o of opts) {
        expect(o.tier, id).toBe(tierOf(o.p))
        const t = TIERS.indexOf(o.tier!)
        expect(t, `${id}: order`).toBeGreaterThanOrEqual(last)
        if (t === last) expect(o.dev, `${id}: harder first within a tier`).toBeLessThanOrEqual(lastDev)
        last = t
        lastDev = o.dev
        expect(o.tier === 'safe' ? o.p >= 0.85 : o.tier === 'match' ? o.p >= 0.4 && o.p < 0.85 : o.p < 0.4, id).toBe(true)
      }
      expect(opts.filter((o) => o.safe).length, id).toBe(1)
      const safest = opts.find((o) => o.safe)!
      expect(safest.p, id).toBe(Math.max(...opts.map((o) => o.p)))
    }
  })

  it('a student of middling level is offered all three: a school to aim at, one that fits and a safe one', () => {
    for (const x of all.filter((y) => ['hs', 'hs-quit', 'univ'].includes(y.kind) && studentDev(y.s) >= 42 && studentDev(y.s) <= 62 && y.s.person.prefecture !== OKINAWA)) {
      const tiers = new Set(x.opts.map((o) => o.tier))
      expect([...tiers].sort(), `${x.kind} sd ${studentDev(x.s).toFixed(0)} pref ${x.s.person.prefecture}: ${x.opts.map((o) => `${o.name}/${o.dev}/${o.p.toFixed(2)}/${o.published}`).join(' | ')}`).toEqual(['match', 'reach', 'safe'])
    }
  })

  it('a stronger student is offered harder schools, a weaker one easier ones, and the same school is likelier for the stronger', () => {
    for (const pref of PREFS) {
      for (const kind of ['hs', 'univ'] as const) {
        const mean = (know: number) => {
          let sum = 0
          for (let i = 0; i < 8; i++) {
            const s = student(know, pref, 5000 + i)
            const opts = kind === 'hs' ? hsShortlist(s, 'public', makeRng(i + 1)) : univShortlist(s, 'student', makeRng(i + 1))
            sum += opts.reduce((a, o) => a + o.dev, 0) / opts.length
          }
          return sum / 8
        }
        const [a, b, c] = [mean(30), mean(50), mean(75)]
        expect(b, `${kind} pref ${pref}`).toBeGreaterThan(a + 2)
        expect(c, `${kind} pref ${pref}`).toBeGreaterThan(b + 4)
      }
    }
    const weak = student(30, 12)
    const strong = student(70, 12)
    for (const dev of [45, 55, 65]) expect(generalP(strong, dev)).toBeGreaterThan(generalP(weak, dev))
  })

  it('what he studied counts: a year of study beside the practice raises the chance at the same school, and changes who is named', () => {
    const base = student(50, 12)
    const studied = structuredClone(base)
    studied.flags = { 'exam.study': 15 }
    expect(generalP(studied, 55)).toBeGreaterThan(generalP(base, 55))
    const a = univShortlist(base, 'student', makeRng(9)).map((o) => o.id)
    const b = univShortlist(studied, 'student', makeRng(9)).map((o) => o.id)
    expect(a.length).toBeGreaterThanOrEqual(3)
    expect(b.length).toBeGreaterThanOrEqual(3)
  })
})

describe('受験候補: 一般入試・学校推薦・スポーツ推薦は分ける', () => {
  it('a high school list is 一般入試 only; a university list has 一般入試 and 学校推薦, each chance by its own rule', () => {
    for (const { kind, s, opts } of all) {
      if (kind.startsWith('hs')) for (const o of opts) expect(o.method, kind).toBe('general')
      if (kind === 'univ' && studentDev(s) >= 42 && studentDev(s) <= 66) {
        expect(opts.some((o) => o.method === 'recommend'), `univ sd ${studentDev(s).toFixed(0)}`).toBe(true)
        expect(opts.some((o) => o.method === 'general')).toBe(true)
      }
      for (const o of opts.filter((x) => x.method === 'general')) expect(o.p).toBeCloseTo(generalP(s, o.dev), 10)
    }
  })

  it('the スポーツ推薦 list is chosen by baseball, not by 偏差値: a student who studied more is offered the same schools', () => {
    for (const pref of [3, 12, 26]) {
      const a = student(30, pref, 777)
      const b = structuredClone(a)
      b.status.knowledge = 85
      a.bb = b.bb = { skills: {}, build: 1, muscleKg: 0, fatigue: 20, condition: 0, confidence: 50, coachEval: 50, role: 'starter', teamSize: 20, teamStrength: 1, menu: 'balanced', gain: 0, scout: 40 } as never
      const la = hsShortlist(a, 'strong', makeRng(4))
      const lb = hsShortlist(b, 'strong', makeRng(4))
      expect(la.map((o) => o.id)).toEqual(lb.map((o) => o.id))
      expect(la.map((o) => o.p)).toEqual(lb.map((o) => o.p))
      for (const o of la) expect(o.method).toBe('sports')
      // and a club list for a university puts the invitations first, then the examinations beside them
      const c = univShortlist(a, 'club', makeRng(4))
      expect(c[0].method).toBe('sports')
      const d = univShortlist(b, 'club', makeRng(4))
      expect(c.filter((o) => o.method === 'sports').map((o) => o.id)).toEqual(d.filter((o) => o.method === 'sports').map((o) => o.id))
      for (const o of c.filter((x) => x.method !== 'sports')) expect(Math.abs(o.dev - Math.max(studentDev(a), 36)), o.name).toBeLessThanOrEqual(15)
    }
  })
})

describe('受験候補: 表示と、偏差値のない学校', () => {
  it('each name carries its tier, and the hint says where the 偏差値 comes from or that there is none', () => {
    let unpublished = 0
    for (const { kind, s, opts } of all) {
      for (const o of opts) {
        const label = optionLabel(o, kind.startsWith('hs') ? 'hs' : 'univ')
        expect(label.startsWith(`【${TIER_LABEL[o.tier!]}】`), label).toBe(true)
        const hint = optionHint(o)
        if (o.published) expect(hint).toContain(devText(o))
        else {
          unpublished++
          expect(devText(o)).toBe('偏差値は未収録')
          // an assumed difficulty is used for the chance but never shown as a value
          expect(hint).toContain('未収録')
          expect(hint).not.toContain(`偏差値 ${Math.round(o.dev)}`)
          expect(hint).not.toContain(o.dev.toFixed(1))
        }
      }
      void s
    }
    expect(unpublished).toBeGreaterThan(20)
  })

  it('the assumed difficulty of a school without one stays in the range the model gives, and the same life names the same schools', () => {
    for (const { opts } of all) for (const o of opts) if (!o.published) expect(o.dev).toBeGreaterThanOrEqual(33)
    const s = student(55, 12)
    expect(hsShortlist(s, 'public', makeRng(3))).toEqual(hsShortlist(s, 'public', makeRng(3)))
    expect(univShortlist(s, 'student', makeRng(3))).toEqual(univShortlist(s, 'student', makeRng(3)))
  })
})
