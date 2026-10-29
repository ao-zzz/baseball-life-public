import { YEN_PER_DOLLAR } from '../engine/contract.ts'

// The money of the screens in the reader's currency (the multilingual work, 1.3.x). The game keeps every amount in 万円 (yen; a US
// contract is converted into yen when it is signed: engine/contract.ts usdToMan) and never reads this file: an amount is converted only
// when it is shown, so pay, prices, branches and saves are the same in every language.
//
// THE RATES ARE FIXED ROUGH VALUES FOR THE DISPLAY OF A GAME, NOT REAL EXCHANGE RATES: no rate is fetched. The dollar is the game's own
// rate (YEN_PER_DOLLAR, 150), so a US contract signed in dollars is shown in the same dollars again.
//
// Two kinds of amount appear in the catalogs' texts:
//   {yen:N}   an amount of the game (a price, a gift, a model setting), N in yen: shown in the reader's currency
//   {yen~:N}  a real amount quoted from a Japanese source (NPB's minimum salary…), N in yen: kept in yen, with the reader's currency
//             beside it as a rough guide (a quoted fact is never shown as if it were in another currency)

export type CurrencyCode = 'JPY' | 'USD' | 'KRW' | 'TWD'

interface Currency {
  code: CurrencyCode
  /** yen for one unit of the currency (fixed, for display only) */
  yenPer: number
  /** the symbol, for a button or an icon */
  symbol: string
  /** an amount in the currency's units, written as the readers of the language write it */
  write: (x: number) => string
  /** a yen amount quoted from a source, written in the language */
  quotedYen: (yen: number) => string
  /** 「about X」 in the language */
  about: (x: string) => string
}

/** at most three significant figures, with the trailing zeros of the decimals dropped */
function sig3(x: number): string {
  const d = x >= 100 ? 0 : x >= 10 ? 1 : 2
  return x.toFixed(d).replace(/\.0+$|(\.\d*?)0+$/, '$1')
}

/** a whole amount to three significant figures (12,345 → 12,300) */
function round3(x: number): number {
  if (x < 1000) return Math.round(x)
  const p = 10 ** (Math.floor(Math.log10(x)) - 2)
  return Math.round(x / p) * p
}

const sign = (x: number) => (x < 0 ? '−' : '')

const usdWords = (x: number) => {
  const a = Math.abs(x)
  if (a >= 1e9) return `${sign(x)}$${sig3(a / 1e9)} billion`
  if (a >= 1e6) return `${sign(x)}$${sig3(a / 1e6)} million`
  return `${sign(x)}$${round3(a).toLocaleString('en-US')}`
}

const CURRENCIES: Record<CurrencyCode, Currency> = {
  // (Japanese: the screens' own words, ui/format.ts; this entry serves the other languages' quotations)
  JPY: {
    code: 'JPY',
    yenPer: 1,
    symbol: '¥',
    write: (x) => {
      const a = Math.abs(x)
      if (a >= 1e8) return `${sign(x)}${sig3(a / 1e8)}億円`
      if (a >= 1e4) return `${sign(x)}${Math.round(a / 1e4).toLocaleString('ja-JP')}万円`
      return `${sign(x)}${Math.round(a).toLocaleString('ja-JP')}円`
    },
    quotedYen: (y) => `${y.toLocaleString('ja-JP')}円`,
    about: (x) => `約${x}`,
  },
  USD: {
    code: 'USD',
    yenPer: YEN_PER_DOLLAR,
    symbol: '$',
    write: usdWords,
    quotedYen: (y) => {
      const a = Math.abs(y)
      if (a >= 1e9) return `${sign(y)}¥${sig3(a / 1e9)} billion`
      if (a >= 1e6) return `${sign(y)}¥${sig3(a / 1e6)} million`
      return `${sign(y)}¥${Math.round(a).toLocaleString('en-US')}`
    },
    about: (x) => `about ${x}`,
  },
  // (ready for Korean, not offered yet: 1 KRW = 0.11 JPY)
  KRW: {
    code: 'KRW',
    yenPer: 0.11,
    symbol: '₩',
    write: (x) => {
      const a = Math.abs(x)
      if (a >= 1e8) return `${sign(x)}${sig3(a / 1e8)}억 원`
      if (a >= 1e4) return `${sign(x)}${Math.round(a / 1e4).toLocaleString('ko-KR')}만 원`
      return `${sign(x)}${Math.round(a).toLocaleString('ko-KR')}원`
    },
    quotedYen: (y) => (Math.abs(y) >= 1e4 ? `${Math.round(y / 1e4).toLocaleString('ko-KR')}만 엔` : `${Math.round(y).toLocaleString('ko-KR')}엔`),
    about: (x) => `약 ${x}`,
  },
  // (ready for Traditional Chinese for Taiwan, not offered yet: 1 TWD = 4.7 JPY)
  TWD: {
    code: 'TWD',
    yenPer: 4.7,
    symbol: 'NT$',
    write: (x) => {
      const a = Math.abs(x)
      if (a >= 1e8) return `${sign(x)}NT$${sig3(a / 1e8)}億`
      if (a >= 1e4) return `${sign(x)}NT$${Math.round(a / 1e4).toLocaleString('zh-TW')}萬`
      return `${sign(x)}NT$${Math.round(a).toLocaleString('zh-TW')}`
    },
    quotedYen: (y) => (Math.abs(y) >= 1e4 ? `${Math.round(y / 1e4).toLocaleString('zh-TW')}萬日圓` : `${Math.round(y).toLocaleString('zh-TW')}日圓`),
    about: (x) => `約${x}`,
  },
}

/** the currency of each language (a language not listed: yen) */
const CURRENCY_OF: Record<string, CurrencyCode> = { ja: 'JPY', en: 'USD', ko: 'KRW', 'zh-TW': 'TWD' }

export const currencyOf = (l: string): Currency => CURRENCIES[CURRENCY_OF[l] ?? 'JPY']

/** an amount of the game (万円) in a currency */
export function moneyIn(man: number, code: CurrencyCode): string {
  if (!Number.isFinite(man)) return '—'
  const c = CURRENCIES[code]
  return c.write((man * 10000) / c.yenPer)
}

/** the amounts written as {yen:N} and {yen~:N} in a text of the catalogs, in the language's currency (see above) */
export function moneyTokens(text: string, l: string): string {
  if (!text.includes('{yen')) return text
  const c = currencyOf(l)
  return text.replace(/\{yen(~?):(-?\d+)\}/g, (_, quoted: string, n: string) => {
    const y = Number(n)
    if (!quoted) return moneyIn(y / 10000, c.code)
    return c.code === 'JPY' ? c.quotedYen(y) : `${c.quotedYen(y)} (${c.about(moneyIn(y / 10000, c.code))})`
  })
}
