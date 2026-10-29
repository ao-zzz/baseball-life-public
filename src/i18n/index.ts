import { EN } from './en.ts'
import { JA, type Key } from './ja.ts'
import { moneyTokens } from './currency.ts'

// The language of the screens (the multilingual work, step 1). The language is the page's: `/en/…` English, `/ko/…` Korean,
// `/zh-tw/…` Traditional Chinese for Taiwan, everything else Japanese (x-default is `/`). It is set once when the app starts (main.tsx)
// and read by the screens only: the game (src/engine) never reads it, so a life is the same in every language. Texts are kept by key
// (ja.ts, the source, and one file for each other language).

export type Lang = 'ja' | 'en' | 'ko' | 'zh-TW'
export type { Key }

/** the languages offered to players (the switch on the title page): English since 1.3.0, Korean and Traditional Chinese since 1.5.0 */
export const PUBLIC_LANGS: readonly Lang[] = ['ja', 'en', 'ko', 'zh-TW']

/** each language's name in itself, for the switch (shown only when more than one language is offered: Intro.tsx) */
export const LANG_NAME: Record<Lang, string> = { ja: '日本語', en: 'English', ko: '한국어', 'zh-TW': '繁體中文' }

// The registry of the languages: each one's catalog of the screens' texts and the locale its numbers are written in. Another language
// joins `Lang` and adds its entries here; the screens need no change. The data's names are kept by language in places.ts
// (placeWords) and statsEn.ts (statsWords), the game's own texts in src/i18n/game/<lang>/ (game.ts). Korean and Traditional Chinese
// are fetched only by their own pages (packs.ts loadLanguage, before the first drawing: main.tsx); Japanese and English are here.
const CATALOGS: Partial<Record<Lang, Record<Key, string>>> = { ja: JA, en: EN }

/** a language's catalog of the screens' texts, once fetched (packs.ts) */
export function addCatalog(l: Lang, catalog: Record<Key, string>) {
  CATALOGS[l] = catalog
}
const LOCALES: Record<Lang, string> = { ja: 'ja-JP', en: 'en-US', ko: 'ko-KR', 'zh-TW': 'zh-TW' }
/** each language's page */
const PATHS: Record<Lang, string> = { ja: '/', en: '/en/', ko: '/ko/', 'zh-TW': '/zh-tw/' }

let current: Lang = 'ja'

/** the language of the screens now */
export const lang = (): Lang => current

/** sets the language (main.tsx at the start; tests) */
export function setLang(l: Lang) {
  current = l
}

/** the language of a page by its path: `/en`, `/ko`, `/zh-tw` (any case) or below; else Japanese */
export function langFromPath(pathname: string): Lang {
  const first = /^\/([^/]+)(\/|$)/.exec(pathname)?.[1]?.toLowerCase()
  return first === 'en' ? 'en' : first === 'ko' ? 'ko' : first === 'zh-tw' ? 'zh-TW' : 'ja'
}

/** the path of the same page in another language (the hash and the query are the caller's) */
export function pathIn(l: Lang): string {
  return PATHS[l]
}

export type Params = Record<string, string | number>

/** a text of the screens in the language now, with its values put in (`{name}`) */
export function t(key: Key, params?: Params): string {
  // (an amount written {yen:N} or {yen~:N} in a catalog is shown in the language's currency: currency.ts)
  const s = moneyTokens(CATALOGS[current]?.[key] ?? JA[key], current)
  return params ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : s
}

/** a number as the language writes it (124,116 in both) */
export function num(n: number): string {
  return n.toLocaleString(LOCALES[current])
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** each language's way of writing a date of the data: a year, a month (its end), a season */
const DATES: Record<Exclude<Lang, 'ja'>, { month: (y: string, m: number, end: boolean) => string; season: Record<string, (y: string) => string>; year: (y: string) => string }> = {
  en: {
    month: (y, m, end) => `${end ? 'end of ' : ''}${MONTHS[m - 1]} ${y}`,
    season: { 夏: (y) => `summer ${y}`, 春: (y) => `spring ${y}`, 秋: (y) => `autumn ${y}`, 冬: (y) => `winter ${y}` },
    year: (y) => y,
  },
  ko: {
    month: (y, m, end) => `${y}년 ${m}월${end ? ' 말' : ''}`,
    season: { 夏: (y) => `${y}년 여름`, 春: (y) => `${y}년 봄`, 秋: (y) => `${y}년 가을`, 冬: (y) => `${y}년 겨울` },
    year: (y) => `${y}년`,
  },
  'zh-TW': {
    month: (y, m, end) => `${y}年${m}月${end ? '底' : ''}`,
    season: { 夏: (y) => `${y}年夏季`, 春: (y) => `${y}年春季`, 秋: (y) => `${y}年秋季`, 冬: (y) => `${y}年冬季` },
    year: (y) => `${y}年`,
  },
}

/** a date of the data written in Japanese (「2026年5月末」「2025年」「2026年夏」), in the language now; unknown forms as they are */
export function dataDate(ja: string): string {
  if (current === 'ja') return ja
  const m = /^(\d{4})年(?:(\d{1,2})月(末)?|(夏|春|秋|冬))?$/.exec(ja)
  if (!m) return ja
  const [, y, mo, end, season] = m
  const w = DATES[current]
  if (mo) return w.month(y, Number(mo), !!end)
  if (season) return w.season[season](y)
  return w.year(y)
}

/** a day (YYYY-MM-DD) as the update history shows it */
export function dayText(d: string): string {
  const [y, m, day] = d.split('-').map(Number)
  if (current === 'en') return `${MONTHS[m - 1]} ${day}, ${y}`
  if (current === 'ko') return `${y}년 ${m}월 ${day}일`
  return `${y}年${m}月${day}日`
}

/** the separator of a list of names (、 in Japanese and Chinese) */
export const listSep = (): string => (current === 'en' || current === 'ko' ? ', ' : '、')

/** the space between words, where the language puts one (English and Korean; none in Japanese and Chinese) */
export const wordSep = (): string => (current === 'en' || current === 'ko' ? ' ' : '')
