import { describe, expect, it } from 'vitest'
import { createLife, endYear, planYear, resolveDecision, type Sim } from './life.ts'
import { defaultParams } from './params.ts'
import { hashSeed } from './rng.ts'
import type { LifeState, StatLine } from './types.ts'
import { addLine, emptyLine, hsCareerHr } from './games.ts'

// Stage 3 (PROJECT_PLAN §11.2): the high-school season. Tournament results agree with the calibrated
// Koshien check, records add up, and 高校通算本塁打 is the player's own in-game total of official and
// practice games.

const sim: Sim = { params: defaultParams() }

function playUi(seed: number, until: number): LifeState {
  const s = createLife({ seed, country: 'JP', pace: 'p15' })
  for (let g = 0; g < 130 && s.alive && s.age < until; g++) {
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
  return s
}

const LIVES = Array.from({ length: 600 }, (_, i) => playUi(hashSeed(i + 840_000), 18))
const HS = LIVES.filter((s) => s.bb?.rec?.tournaments.length)

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

describe('high-school tournaments', () => {
  it('enough high-school seasons are played to test', () => {
    expect(HS.length).toBeGreaterThan(150)
  })

  it('each school year has its own tournaments: spring from the 2nd year, autumn until the 2nd year', () => {
    for (const s of HS) {
      const t = s.bb!.rec!.tournaments
      // high school is ages 15–17 (1st to 3rd year)
      for (const x of t) {
        expect(x.age).toBeGreaterThanOrEqual(15)
        expect(x.age).toBeLessThanOrEqual(17)
        if (x.name.startsWith('春季大会')) expect(x.age, `seed ${s.config.seed}`).toBeGreaterThanOrEqual(16)
        if (x.name.startsWith('秋季大会')) expect(x.age, `seed ${s.config.seed}`).toBeLessThanOrEqual(16)
      }
      // one summer prefectural tournament a year at most
      const summers = t.filter((x) => x.name.includes('大会') && x.name.includes('全国高等学校野球選手権大会の'))
      expect(new Set(summers.map((x) => x.age)).size).toBe(summers.length)
    }
  })

  it('Koshien in the record agrees with the calibrated check and the achievement', () => {
    let koshienYears = 0
    for (const s of HS) {
      const t = s.bb!.rec!.tournaments
      const injured = new Set(s.log.filter((e) => e.text.includes('けがのため外れました')).map((e) => e.age))
      const atKoshien = new Set(s.log.filter((e) => e.text.startsWith('甲子園の土を踏みました') || e.text === 'もう一度、甲子園に戻ってきました。').map((e) => e.age))
      const nationals = t.filter((x) => x.name.startsWith('甲子園での'))
      for (const n of nationals) {
        koshienYears++
        // the team only plays at Koshien in a year the check put the player there (or he was injured out)
        expect(atKoshien.has(n.age) || injured.has(n.age), `seed ${s.config.seed} age ${n.age}`).toBe(true)
        // a summer Koshien follows a won prefectural final
        if (n.name.includes('全国高等学校野球選手権大会')) {
          const pref = t.find((x) => x.age === n.age && x.name.startsWith('全国高等学校野球選手権大会の'))
          expect(pref?.result, `seed ${s.config.seed}`).toBe('優勝')
        }
      }
      for (const age of atKoshien) expect(nationals.some((n) => n.age === age), `seed ${s.config.seed} age ${age}`).toBe(true)
      expect(s.career.achievements.includes('甲子園')).toBe(atKoshien.size > 0)
      // a squad member without Koshien never wins the summer prefectural final
      for (const x of t.filter((x) => x.name.startsWith('全国高等学校野球選手権大会の') && x.result === '優勝')) {
        const teamWent = s.log.some((e) => e.age === x.age && e.text.startsWith('チームは甲子園に出場しました'))
        expect(atKoshien.has(x.age) || injured.has(x.age) || teamWent, `seed ${s.config.seed} age ${x.age}`).toBe(true)
      }
    }
    expect(koshienYears).toBeGreaterThan(0)
  })
})

describe('records', () => {
  it('official totals are the sum of the tournament lines, practice games are kept apart', () => {
    for (const s of HS) {
      const rec = s.bb!.rec!
      const sum = rec.tournaments.reduce((a, x) => addLine(a, x.line), emptyLine())
      expect(rec.official.hs ?? emptyLine()).toEqual(sum)
      saneLine(rec.official.hs ?? emptyLine())
      saneLine(rec.practice.hs ?? emptyLine())
      for (const x of rec.tournaments) saneLine(x.line)
    }
  })

  it('高校通算本塁打 = official + practice home runs, and the text says so', () => {
    let quoted = 0
    for (const s of HS) {
      const rec = s.bb!.rec!
      expect(hsCareerHr(s)).toBe((rec.official.hs?.hr ?? 0) + (rec.practice.hs?.hr ?? 0))
      const end = s.log.find((e) => e.text.includes('3年間の高校野球が終わりました'))
      const m = end && /高校通算本塁打は(\d+)本（公式戦と練習試合の合計、ゲーム内の記録）/.exec(end.text)
      if (m) {
        quoted++
        expect(Number(m[1])).toBe(hsCareerHr(s))
      }
      // milestones never run ahead of the record
      for (const e of s.log) {
        const k = /高校通算本塁打が(\d+)本になりました/.exec(e.text)
        if (k) expect(Number(k[1])).toBeLessThanOrEqual(hsCareerHr(s))
      }
    }
    expect(quoted).toBeGreaterThan(0)
  })

  it('home-run totals stay plausible', () => {
    for (const s of HS) expect(hsCareerHr(s), `seed ${s.config.seed}`).toBeLessThanOrEqual(80)
  })
})
