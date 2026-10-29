import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { currencyOf, moneyIn, moneyTokens } from './currency.ts'
import { setLang } from './index.ts'
import { yen } from '../ui/format.ts'
import { MLB_MIN_USD, YEN_PER_DOLLAR, usdToMan } from '../engine/contract.ts'

// The money of the screens in the reader's currency (currency.ts): fixed rates for display only, the game's amounts untouched.

afterEach(() => setLang('ja'))

describe('the currency of each language', () => {
  it('Japanese yen, English dollars, Korean won and Taiwan dollars, at fixed rates (the dollar is the game’s own)', () => {
    expect(['ja', 'en', 'ko', 'zh-TW', 'xx'].map((l) => currencyOf(l).code)).toEqual(['JPY', 'USD', 'KRW', 'TWD', 'JPY'])
    expect(currencyOf('en').yenPer).toBe(YEN_PER_DOLLAR)
    expect(YEN_PER_DOLLAR).toBe(150)
    expect(currencyOf('ko').yenPer).toBe(0.11)
    expect(currencyOf('zh-TW').yenPer).toBe(4.7)
  })

  it('writes small and large amounts, and signs, as each language does', () => {
    // dollars: whole dollars, three significant figures, then millions and billions
    expect(['0.1', '1', '50', '1,200', '15,000', '-1,200', '150,000,000'].map((m) => moneyIn(Number(m.replace(/,/g, '')), 'USD'))).toEqual([
      '$7', '$67', '$3,330', '$80,000', '$1 million', '−$80,000', '$10 billion',
    ])
    expect(moneyIn(18519, 'USD')).toBe('$1.23 million')
    // won and Taiwan dollars, in their own large units (not offered yet)
    expect([1, 1200, 15000].map((m) => moneyIn(m, 'KRW'))).toEqual(['9만 원', '1.09억 원', '13.6억 원'])
    expect([1, 1200, 15000].map((m) => moneyIn(m, 'TWD'))).toEqual(['NT$2,128', 'NT$255萬', 'NT$3,191萬'])
    expect(moneyIn(Number.NaN, 'USD')).toBe('—')
  })

  it('a US contract signed in dollars is shown in the same dollars in English', () => {
    setLang('en')
    expect(yen(usdToMan(MLB_MIN_USD))).toBe('$780,000')
  })

  it('in Japanese the amounts are the screens’ own yen, as before', () => {
    expect([1234, 15000, -30, 120000].map(yen)).toEqual(['1,234万円', '1.5億円', '−30万円', '12億円'])
  })
})

describe('amounts written in the catalogs', () => {
  it('{yen:N} is an amount of the game, in the reader’s currency; {yen~:N} a quoted figure, kept in yen with a rough guide', () => {
    expect(moneyTokens('About {yen:2000000}', 'en')).toBe('About $13,300')
    expect(moneyTokens('under {yen~:16000000} gets', 'en')).toBe('under ¥16 million (about $107,000) gets')
    expect(moneyTokens('{yen~:4200000}', 'ko')).toBe('420만 엔 (약 3,818만 원)')
    expect(moneyTokens('no amount', 'en')).toBe('no amount')
  })

  it('no token is ever shown as it is: every way out of the catalogs reads them', async () => {
    const { EN } = await import('./en.ts')
    const { t } = await import('./index.ts')
    const { STATS } = await import('../data/stats.ts')
    const { SOURCES } = await import('../data/sources.ts')
    const { statText, sourceText } = await import('./statsEn.ts')
    const { CHANGES, changeText } = await import('./changelog.ts')
    const { gameText, loadGameTexts } = await import('./game.ts')
    await loadGameTexts('en')
    setLang('en')
    const source = JSON.parse(readFileSync(new URL('./game/source.json', import.meta.url), 'utf8')) as { ja: string; parts?: string[] }[]
    const shown = [
      ...(Object.keys(EN) as (keyof typeof EN)[]).map((k) => t(k)),
      ...Object.values(STATS).flatMap((s) => Object.values(statText(s))),
      ...(Array.isArray(SOURCES) ? SOURCES : Object.values(SOURCES)).flatMap((s) => Object.values(sourceText(s))),
      ...Object.keys(CHANGES.en).map(changeText),
      ...source.filter((s) => !s.parts?.length).map((s) => gameText(s.ja)),
    ]
    expect(shown.filter((x) => typeof x === 'string' && x.includes('{yen'))).toEqual([])
  })

  it('no English text keeps an amount in yen of its own but formulas, titles of sources and units', () => {
    const allowed = ['(¥16 million − salary)', 'is ¥52.16 million (May 18, 2026)', "'× ¥10,000'", "'× ¥1,000 (monthly)'", 'at ¥{rate} to the dollar', 'guide of ¥150 to the dollar']
    const dir = new URL('./', import.meta.url)
    const texts = [
      ...['en.ts', 'statsEn.ts', 'changelog.ts'].flatMap((f) => readFileSync(new URL(f, dir), 'utf8').split('\n')),
      ...readdirSync(new URL('game/en/', dir)).flatMap((f) => readFileSync(new URL(`game/en/${f}`, dir), 'utf8').split('\n')),
    ]
    const left = texts.filter((l) => /¥\d|¥\{/.test(l) && !allowed.some((a) => l.includes(a)))
    expect(left).toEqual([])
  })
})
