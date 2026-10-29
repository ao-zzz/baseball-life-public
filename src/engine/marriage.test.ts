import { describe, expect, it } from 'vitest'
import { createLife, endYear, planYear, resolveDecision, type Sim } from './life.ts'
import { defaultParams } from './params.ts'
import type { LifeState } from './types.ts'
import { shareFacts, shareText } from '../game/shareLink.ts'
import { yen } from '../ui/format.ts'

// A marriage is told once (PROJECT_PLAN §11.32): "結婚しました" only when a spouse is taken, the wedding question only after it, and a child's
// wedding once per child. A second marriage (after a bereavement) is still allowed.

const sim: Sim = { params: defaultParams() }

interface Run {
  s: LifeState
  married: number
  bereaved: number
  weddingAsks: { age: number; spouse: boolean; partnerOnly: boolean }[]
  kidWeddingLines: number
}

function play(seed: number, country: 'JP' | 'US' = 'JP'): Run {
  const s = createLife({ seed, country, pace: 'p15' })
  const out: Run = { s, married: 0, bereaved: 0, weddingAsks: [], kidWeddingLines: 0 }
  const note = (text: string) => {
    if (/さんと結婚しました。/.test(text)) out.married++
    if (/先立たれました/.test(text)) out.bereaved++
    if (/が結婚しました。|の結婚式に出ました。|結婚相手を連れてきました。/.test(text) && /上の子|下の子|長男|長女|次男|次女|三男|三女|子/.test(text)) out.kidWeddingLines++
  }
  for (let g = 0; g < 130 && s.alive; g++) {
    const plan = planYear(s, sim)
    for (const e of plan.events) {
      s.log.push(e.entry)
      note(e.entry.text)
    }
    let d = plan.decision?.decision
    while (d && s.alive) {
      if (d.id === 'x.life.weddingPlan') out.weddingAsks.push({ age: s.age, spouse: !!s.family.spouse, partnerOnly: !!s.family.partner && !s.family.spouse })
      const r = resolveDecision(s, d.autoIndex, sim)
      for (const e of r.events) {
        s.log.push(e.entry)
        note(e.entry.text)
      }
      d = r.followUp?.decision
    }
    endYear(s)
  }
  return out
}

const SEEDS = Array.from({ length: 150 }, (_, i) => i + 1)

describe('marriage is told once', () => {
  const runs = SEEDS.map((seed) => play(seed))

  it('"結婚しました" never appears more often than a spouse can be taken (once, plus once per bereavement)', () => {
    for (const r of runs) expect(r.married, `seed ${r.s.config.seed}`).toBeLessThanOrEqual(1 + r.bereaved)
    expect(runs.some((r) => r.married > 0)).toBe(true)
  })

  it('the wedding question comes only to a married man, never to one who is dating', () => {
    let asks = 0
    for (const r of runs) {
      asks += r.weddingAsks.length
      expect(r.weddingAsks.length).toBeLessThanOrEqual(2)
      for (const a of r.weddingAsks) {
        expect(a.spouse, `seed ${r.s.config.seed} age ${a.age}`).toBe(true)
        expect(a.partnerOnly).toBe(false)
      }
    }
    expect(asks).toBeGreaterThan(0)
  })

  it('each child marries at most once', () => {
    for (const r of runs) {
      const keys = r.s.taken.filter((t) => t.startsWith('family.kidWedding.'))
      expect(new Set(keys).size).toBe(keys.length)
      expect(keys.length).toBeLessThanOrEqual(r.s.family.children)
      expect(r.kidWeddingLines).toBeLessThanOrEqual(keys.length)
    }
  })

  it('a US life marries once as well', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const r = play(seed, 'US')
      expect(r.married, `US seed ${seed}`).toBeLessThanOrEqual(1 + r.bereaved)
    }
  })
})

describe('the figures on the shared card', () => {
  const lives = SEEDS.slice(0, 30).map((seed) => play(seed).s)

  it('are read from the state: income, school and money are three separate values', () => {
    for (const s of lives) {
      const f = shareFacts(s)
      expect(f.income).toBe(yen(s.lifetimeIncome))
      expect(f.money).toBe(yen(s.money))
      // (the school finished; a death before the university's graduation is 在学中: after.ts eduText, tested in feedbackFixes.test.ts)
      if (!s.after) expect(f.edu).toBe('—')
      else if (s.after.edu === 'univ') expect(f.edu).toBe('大学卒業')
      else expect(['高校卒業', '大学在学中']).toContain(f.edu)
    }
    // the income (a sum of every year) is not the money left (after spending): they differ in almost every life
    expect(lives.filter((s) => shareFacts(s).income !== shareFacts(s).money).length).toBeGreaterThan(lives.length * 0.8)
  })

  it('an unknown school is shown as unknown, not guessed', () => {
    const s = createLife({ seed: 7, country: 'JP', pace: 'p15' })
    s.after = undefined
    expect(shareFacts(s).edu).toBe('—')
  })

  it('are in the shared text, and the link still carries the birth only', () => {
    const s = lives[0]
    const text = shareText(s, 'ある人生', null, 'https://example.test/?s=1')
    const f = shareFacts(s)
    expect(text).toContain(`生涯年収 ${f.income}`)
    expect(text).toContain(`最終学歴 ${f.edu}`)
    expect(text).toContain(`残したお金 ${f.money}`)
    expect(text).toContain('https://example.test/?s=1')
  })
})
