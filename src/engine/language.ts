import type { LifeState } from './types.ts'
import type { CountryCode } from '../data/types.ts'
import { hashSeed, makeRng } from './rng.ts'
import { livesAbroad, residenceOf } from './countries/index.ts'

// Languages and a second background (PROJECT_PLAN §11.41). How well he speaks each language is a number 0..100 kept in
// `LifeState.languages`. It grows slowly: a study gives a share of what is left to learn, once a year per language at most
// (`flags['lang.<code>']` holds the age), and living abroad gives a small yearly gain up to a ceiling that only study passes. It
// never touches his ability: it decides how a move abroad feels (the team, daily life, a contract talk), and what is said about it.
// Everything here is a game assumption, not a measure of any language or any person.

export type Lang = 'ja' | 'en' | 'ko' | 'zh' | 'es'
export const LANG_LABEL: Record<Lang, string> = { ja: '日本語', en: '英語', ko: '韓国語', zh: '台湾華語', es: 'スペイン語' }

/** the main language of each country (an assumption: one per country is enough for the events) */
export const LANG_OF: Record<CountryCode, Lang> = { JP: 'ja', US: 'en', KR: 'ko', TW: 'zh', CU: 'es', MX: 'es', DO: 'es', VE: 'es' }

/** the level that living in a country alone can bring, and the level a study can reach (assumptions) */
export const IMMERSION_CEILING = 60
export const STUDY_CEILING = 95
/** the share of the language he speaks at birth to a second background (a man of two backgrounds hears it at home; an assumption) */
const HERITAGE_START = 35

/** a language named in an effect: itself, or the local one, the heritage one, or the one he has most to gain from now */
export function resolveLang(s: LifeState, l: Lang | 'local' | 'heritage' | 'focus'): Lang {
  if (l === 'local') return LANG_OF[residenceOf(s)]
  if (l === 'heritage') return LANG_OF[s.person.heritage ?? s.person.country]
  if (l === 'focus') return livesAbroad(s) ? LANG_OF[residenceOf(s)] : LANG_OF[s.person.heritage ?? s.person.country]
  return l
}

export function levelOf(s: LifeState, lang: Lang): number {
  const known = s.languages?.[lang]
  if (known !== undefined) return known
  // a life made before languages: only his native one
  return lang === LANG_OF[s.person.country] ? 100 : 0
}

/** how well he speaks the language of the country he lives in now */
export function localLevel(s: LifeState): number {
  return levelOf(s, LANG_OF[residenceOf(s)])
}

/**
 * Study: a share of what is left toward the ceiling, and only once a year per language (a second lesson the same year adds nothing,
 * so repeating an event cannot raise it without limit). Returns the gain.
 */
export function studyLang(s: LifeState, lang: Lang, strength: number): number {
  const flag = `lang.${lang}`
  if (s.flags?.[flag] === s.age) return 0
  const lv = levelOf(s, lang)
  if (lv >= STUDY_CEILING) return 0
  const gain = Math.max(1, Math.round((STUDY_CEILING - lv) * Math.min(1, strength / 100)))
  ;(s.languages ??= {})[lang] = Math.min(STUDY_CEILING, lv + gain)
  ;(s.flags ??= {})[flag] = s.age
  return gain
}

/** the yearly gain of living in a country whose language he speaks less than the ceiling (state only, no draw) */
export function immerseYear(s: LifeState): void {
  if (s.age < 12 || !livesAbroad(s)) return
  const lang = LANG_OF[residenceOf(s)]
  const lv = levelOf(s, lang)
  if (lv >= IMMERSION_CEILING) return
  ;(s.languages ??= {})[lang] = Math.min(IMMERSION_CEILING, lv + Math.max(1, Math.round((IMMERSION_CEILING - lv) * 0.1)))
}

// ---- a second background

/** the country of the other parent, by country of birth: the weights are assumptions, not statistics */
const HERITAGE: Partial<Record<CountryCode, { p: number; from: [CountryCode, number][] }>> = {
  JP: { p: 0.03, from: [['US', 3], ['KR', 3], ['TW', 1], ['MX', 1], ['VE', 0.5], ['DO', 0.5]] },
  US: { p: 0.1, from: [['MX', 4], ['DO', 1.5], ['CU', 1], ['VE', 0.7], ['KR', 1.2], ['JP', 1.2], ['TW', 0.6]] },
  // (Korea and Cuba, PROJECT_PLAN §11.46: a rare second background, assumptions)
  KR: { p: 0.02, from: [['JP', 3], ['US', 3], ['TW', 0.5]] },
  CU: { p: 0.06, from: [['US', 3], ['MX', 1], ['DO', 1], ['VE', 1]] },
}

/**
 * languages and the second background of a new life, from a stream of its own (the seed and a salt: the life's other draws are not
 * touched). A man of two backgrounds is rare, and what it gives is a second language to start from, a country to visit and a choice of
 * national team: not ability, not character.
 */
export function initBackground(s: LifeState): void {
  const native = LANG_OF[s.person.country]
  s.languages = { [native]: 100 }
  const table = HERITAGE[s.person.country]
  if (!table) return
  const r = makeRng(hashSeed(s.config.seed ^ 0x68657269))
  if (r.next() >= table.p) return
  const country = r.weighted(table.from.map((x) => x[0]), table.from.map((x) => x[1]))
  s.person.heritage = country
  const lang = LANG_OF[country]
  if (lang !== native) s.languages[lang] = HERITAGE_START
}

// ---- what the screens show (a pure reading of the state: nothing is changed and nothing is drawn)

export interface LangRow {
  lang: Lang
  label: string
  level: number
  /** 母語 / 流暢 / 仕事ができる / 日常会話 / 片言 */
  band: string
  native: boolean
}

export function bandOf(level: number, native: boolean): string {
  if (native) return '母語'
  return level >= 85 ? '流暢' : level >= 60 ? '仕事ができる' : level >= 30 ? '日常会話' : '片言'
}

/** the languages he speaks at all (a language he has not learned is not listed), his own first, then by level */
export function languageRows(s: LifeState): LangRow[] {
  const native = LANG_OF[s.person.country]
  const langs = new Set<Lang>([native, ...(Object.keys(s.languages ?? {}) as Lang[])])
  const rows: LangRow[] = []
  for (const lang of langs) {
    const level = levelOf(s, lang)
    if (level <= 0 || !(lang in LANG_LABEL)) continue
    rows.push({ lang, label: LANG_LABEL[lang], level, band: bandOf(level, lang === native), native: lang === native })
  }
  return rows.sort((a, b) => Number(b.native) - Number(a.native) || b.level - a.level)
}