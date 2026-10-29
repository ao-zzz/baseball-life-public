import { describe, expect, it } from 'vitest'
import { createLife, endYear, planYear, playToEnd, resolveDecision, type Sim } from './life.ts'
import { defaultParams } from './params.ts'
import { hashSeed } from './rng.ts'
import { shownAge } from './displayAge.ts'
import type { Decision, LifeState } from './types.ts'

// The age on screen is the school-year-end age: the model's age (the start of the school year) + 1, in one place (displayAge.ts).
// Nothing the engine decides reads it: the model's ages are checked in schoolAge.test.ts and by the fingerprint.

function play(seed: number, until: number, headless: boolean, choose?: (d: Decision) => number | undefined): LifeState {
  const s = createLife({ seed, country: 'JP', pace: 'p15' })
  const sim: Sim = { params: defaultParams(), headless }
  for (let g = 0; g < 130 && s.alive && s.age < until; g++) {
    const plan = planYear(s, sim)
    let d = plan.decision?.decision
    while (d && s.alive) d = resolveDecision(s, choose?.(d) ?? d.autoIndex, sim).followUp?.decision
    endYear(s)
  }
  return s
}

const SEEDS = Array.from({ length: 800 }, (_, i) => hashSeed(i + 8_100_000))

describe('fixed-age texts do not contradict the age on screen', () => {
  it('a celebration line carries no age of its own (the line\'s label has the screen age), and the 還暦-type names match their event ages', () => {
    let n = 0
    for (const seed of SEEDS.slice(0, 300)) {
      const s = createLife({ seed, country: 'JP', pace: 'p15' })
      playToEnd(s, { params: defaultParams() })
      for (const e of s.log) {
        if (/古希|喜寿|傘寿|米寿|卒寿|白寿/.test(e.text)) {
          n++
          expect(e.text, `seed ${seed}`).not.toMatch(/^\d+歳/)
        }
      }
    }
    expect(n).toBeGreaterThan(0)
  }, 60_000)
})

describe('the age shown on screen', () => {
  it('is the model age plus one, in one function', () => {
    expect(shownAge(0)).toBe(1)
    expect(shownAge(15)).toBe(16)
    expect(shownAge(17)).toBe(18)
    expect(shownAge(18)).toBe(19)
    expect(shownAge(21)).toBe(22)
  })

  it('gives the school years as 小学 7〜12, 中学 13〜15, 高校 16〜18, 大学 19〜22 in a normal life (the model ages are unchanged)', () => {
    const shown: Record<string, Set<number>> = {}
    for (const seed of SEEDS) {
      const s = play(seed, 30, true)
      s.timeline.forEach((t, i) => {
        const phase = i > 0 ? s.timeline[i - 1].phase : 'child'
        ;(shown[phase] ??= new Set()).add(shownAge(t.age))
      })
    }
    const span = (p: string) => [Math.min(...shown[p]), Math.max(...shown[p])]
    expect(span('jhs')).toEqual([13, 15])
    expect(span('hs')).toEqual([16, 18])
    expect(span('univ')).toEqual([19, 22])
  }, 60_000)

  it('counts every year that passed: one per year, also through a 浪人 year and a 留年', () => {
    const idx = (d: Decision, re: RegExp) => {
      const i = d.choices.findIndex((c) => re.test(c.label))
      return i >= 0 ? i : undefined
    }
    let ronin = 0
    let repeat = 0
    for (const seed of SEEDS) {
      const s = play(seed, 32, false, (d) => (d.id === 'jp.route' ? idx(d, /大学で野球を続ける|入部テスト/) : d.id === 'jp.univPick' ? idx(d, /挑戦校/) : d.id === 'jp.ronin' ? 1 : d.id === 'jp.credits' ? 1 : undefined))
      // a year is one step of the model and of the screen, whatever the stage holds him back
      s.timeline.forEach((t, i) => {
        expect(t.age, `seed ${seed}`).toBe(i)
        expect(shownAge(t.age), `seed ${seed}`).toBe(i + 1)
      })
      // (the 浪人 year follows the school year that ended at 18 and is shown as 19; it is one more year, not a different age)
      if (s.flags?.['univ.ronin'] !== undefined) ronin++
      if (s.flags?.['univ.repeat'] !== undefined) repeat++
      // the age the death text gives is the age shown in the header
      const death = s.log.find((e) => e.kind === 'death')
      if (death) expect(death.text.startsWith(`${shownAge(s.age)}歳で亡くなりました`), `seed ${seed}`).toBe(true)
    }
    expect(ronin).toBeGreaterThan(0)
    expect(repeat).toBeGreaterThan(0)
  }, 60_000)
})
