import { describe, expect, it } from 'vitest'
import { createLife, planYear, resolveDecision, runHeadless, type Sim } from './life.ts'
import { defaultParams } from './params.ts'
import { hashSeed } from './rng.ts'
import type { LifeState } from './types.ts'
import { livesAbroad, livesIn, residenceOf, setResidence } from './countries/index.ts'

// Where he lives is stored where the model moves him (PROJECT_PLAN §11.38): a Japanese signing with an MLB club, and coming back.

const headless: Sim = { params: defaultParams(), headless: true }
const mk = (country: 'JP' | 'US', seed = 12): LifeState => createLife({ seed, country, pace: 'p15' })
const withPending = (s: LifeState, p: { id: string; data: Record<string, string> }) => {
  ;(s as unknown as { pending: unknown }).pending = p
}

describe('setResidence', () => {
  it('stores a residence only when it differs from the country of birth', () => {
    const s = mk('US')
    expect(s.residence).toBeUndefined()
    setResidence(s, 'JP')
    expect(s.residence).toBe('JP')
    expect(residenceOf(s)).toBe('JP')
    expect(livesAbroad(s)).toBe(true)
    setResidence(s, 'US')
    expect('residence' in s).toBe(false)
    expect(livesIn(s, 'US')).toBe(true)
    // a life that never moves keeps none
    const jp = mk('JP')
    setResidence(jp, 'JP')
    expect('residence' in jp).toBe(false)
  })

  it('a US-born man playing in Japan can be given a Japanese residence, and his birth country does not change', () => {
    const s = mk('US')
    s.career.phase = 'pro'
    setResidence(s, 'JP')
    expect(livesIn(s, 'JP')).toBe(true)
    expect(s.person.country).toBe('US')
  })

  it('retiring does not move anyone: the residence is kept, and a life without one stays at home', () => {
    const away = mk('JP')
    setResidence(away, 'US')
    away.career.phase = 'retired'
    expect(residenceOf(away)).toBe('US')
    const home = mk('JP')
    home.career.phase = 'retired'
    expect(residenceOf(home)).toBe('JP')
    expect('residence' in home).toBe(false)
  })
})

describe('a Japanese in the MLB', () => {
  it('signing with an MLB club makes him a resident of the US (the decision jp.mlb)', () => {
    const s = mk('JP')
    s.age = 27
    s.career.phase = 'pro'
    expect(residenceOf(s)).toBe('JP')
    withPending(s, { id: 'jp.mlb', data: {} })
    resolveDecision(s, 0, headless)
    expect(s.career.phase).toBe('abroad')
    expect(s.residence).toBe('US')
    expect(livesIn(s, 'US')).toBe(true)
    expect(livesAbroad(s)).toBe(true)
  })

  it('staying in Japan changes nothing', () => {
    const s = mk('JP')
    s.age = 27
    s.career.phase = 'pro'
    withPending(s, { id: 'jp.mlb', data: {} })
    resolveDecision(s, 1, headless)
    expect(s.career.phase).toBe('pro')
    expect('residence' in s).toBe(false)
  })

  it('coming back to NPB makes him a resident of Japan again', () => {
    const s = mk('JP')
    s.age = 39 // past 38 the return is certain
    s.career.phase = 'abroad'
    s.career.highestRank = 10
    s.career.proSeasons = 8
    setResidence(s, 'US')
    planYear(s, headless)
    expect(s.career.phase).toBe('pro')
    expect('residence' in s).toBe(false)
    expect(residenceOf(s)).toBe('JP')
  })

  it('a life saved while abroad, before the residence was stored, is still read as living in the US', () => {
    const s = mk('JP')
    s.career.phase = 'abroad'
    expect('residence' in s).toBe(false)
    expect(residenceOf(s)).toBe('US')
  })

  it('a life that stays in its country has no residence, in Japan or in the US', () => {
    for (let i = 0; i < 60; i++) {
      for (const country of ['JP', 'US'] as const) {
        const s = runHeadless({ seed: hashSeed(i + 19_000_000), country, pace: 'p15' }, headless)
        if (country === 'US') expect('residence' in s, `US seed ${i}`).toBe(false)
        else if (!s.career.achievements.includes('MLB')) expect('residence' in s, `JP seed ${i}`).toBe(false)
      }
    }
  })
})
