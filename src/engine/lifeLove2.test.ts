import { describe, expect, it } from 'vitest'
import { createLife, endYear, planYear, resolveDecision, runHeadless, type Sim } from './life.ts'
import { defaultParams } from './params.ts'
import { hashSeed } from './rng.ts'
import { LIFE_LOVE_EVENTS } from './lifeLoveEvents.ts'

// The relationship as it is lived (PROJECT_PLAN §11.45): distance, quarrel, making up, anniversary, the future, the wedding, living apart,
// slump, time together, the talk about life after baseball. They need a partner or a spouse, which only a choice gives.

const sim: Sim = { params: defaultParams() }
const NEW = ['life.distance', 'life.quarrel', 'life.makeup', 'life.anniversary', 'life.futureTalk', 'life.weddingPrep', 'life.apart', 'life.apartEnd', 'life.slumpTalk', 'life.spouseTime', 'life.afterTalk']

describe('the new relationship events', () => {
  it('are registered once each and need a partner or a spouse', () => {
    for (const id of NEW) expect(LIFE_LOVE_EVENTS.filter((d) => d.id === id)).toHaveLength(1)
    const bare = createLife({ seed: 5, country: 'JP', pace: 'p15' })
    bare.age = 30
    for (const id of NEW) expect(LIFE_LOVE_EVENTS.find((d) => d.id === id)!.when!(bare)).toBe(false)
  })

  it('happen to a man who goes out with someone, and leave a consistent family and finances', () => {
    const seen = new Set<string>()
    let lives = 0
    for (let i = 0; i < 4000 && lives < 250; i++) {
      const seed = hashSeed(i + 3_100_000)
      if (runHeadless({ seed, country: 'JP', pace: 'p15' }, sim, true).career.highestRank < 5) continue
      lives++
      const s = createLife({ seed, country: 'JP', pace: 'p15' })
      for (let g = 0; g < 130 && s.alive; g++) {
        let d = planYear(s, sim).decision?.decision
        while (d && s.alive) {
          if (NEW.includes(d.id)) seen.add(d.id)
          const pick = d.id === 'life.meet' ? 0 : d.autoIndex
          d = resolveDecision(s, pick, sim).followUp?.decision
        }
        expect(Number.isFinite(s.money)).toBe(true)
        expect(!(s.family.partner && s.family.spouse)).toBe(true)
        endYear(s)
      }
    }
    expect([...seen].join(), 'seen').toBeTruthy()
    expect(seen.size, [...seen].join()).toBeGreaterThanOrEqual(6)
  }, 60000)
})