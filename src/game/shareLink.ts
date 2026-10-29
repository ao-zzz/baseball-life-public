import type { LifeConfig, LifeState } from '../engine/types.ts'
import { fullName, prefName } from '../engine/life.ts'
import { highestLabel } from '../engine/summary.ts'
import type { CountryCode } from '../data/types.ts'
import { COUNTRY_INFO, isCountryCode } from '../engine/countries/index.ts'
import { eduText } from '../engine/after.ts'
import { shownAge } from '../engine/displayAge.ts'
import { yen } from '../ui/format.ts'
import { lang, t } from '../i18n/index.ts'
import { placeName } from '../i18n/places.ts'
import { gameText as g } from '../i18n/game.ts'

// The link a shared life carries (PROJECT_PLAN §11.23): the birth only (seed, prefecture, mode, ★), never the life's story. Opening it
// shows the title page with the offer to be born the same way; the choices made on the way can make a different life.

export interface SharedBirth {
  seed: number
  /** the country of birth when it is not Japan (a link without it is Japan's, as every link made before the other countries) */
  country?: CountryCode
  /** only when the shared life was given its place of birth (a prefecture, a state); otherwise the same seed draws the same one */
  prefecture?: number
  mode?: 'potential'
  stars?: number
}

export function shareUrl(base: string, c: LifeConfig): string {
  const q = new URLSearchParams({ s: String(c.seed >>> 0) })
  if (c.country !== 'JP') q.set('c', c.country)
  if (c.prefecture !== undefined) q.set('pf', String(c.prefecture))
  if (c.mode === 'potential') {
    q.set('m', 'p')
    q.set('k', String(c.stars ?? 1))
  }
  return `${base}?${q.toString()}`
}

/**
 * a birth read from a link, or null when the link has none or anything in it is out of range. A country that cannot be played yet
 * (or an unknown code) makes the link void: it must not start a Japanese life that the link did not mean.
 */
export function readShared(search: string): SharedBirth | null {
  const q = new URLSearchParams(search)
  const s = q.get('s')
  const pf = q.get('pf')
  if (!s || !/^\d{1,10}$/.test(s) || (pf !== null && !/^\d{1,2}$/.test(pf))) return null
  const c = q.get('c')
  let country: CountryCode = 'JP'
  if (c !== null) {
    if (!isCountryCode(c) || !COUNTRY_INFO[c].implemented) return null
    country = c
  }
  const seed = Number(s)
  const prefecture = pf === null ? undefined : Number(pf)
  if (seed > 0xffffffff || (prefecture !== undefined && prefecture >= COUNTRY_INFO[country].regions.length)) return null
  const place = prefecture !== undefined ? { prefecture } : {}
  const from = country === 'JP' ? {} : { country }
  const m = q.get('m')
  const k = q.get('k')
  if (m === 'p') {
    if (!k || !/^\d{1,2}$/.test(k) || Number(k) < 1 || Number(k) > 10) return null
    return { seed, ...from, ...place, mode: 'potential', stars: Number(k) }
  }
  return { seed, ...from, ...place }
}

// (the texts are in src/i18n; the stage, the team, the name and the school are the game's words, through src/i18n/game.ts; the title
// comes in the language now. xLength counts any language the same way.)

/** the name of the game on the card and in the post: the country's brand (COUNTRY_INFO), in English 1 in 120,000 or A Baseball Life */
export function brandName(c: CountryCode): string {
  return lang() !== 'ja' ? t(c === 'JP' ? 'share.brand.JP' : 'share.brand') : COUNTRY_INFO[c].brand
}

/** a draft pick: its round, or its round of the development draft (育成) */
const pickText = (d: { kind: string; round: number }) => t(d.kind === 'shihaika' ? 'share.pick' : 'share.pick.ikusei', { n: d.round })

/** the few facts of the life worth a line on the card (all from the state; nothing added) */
export function shareHighlights(life: LifeState): string[] {
  const out: string[] = []
  const a = life.career.achievements
  const d = life.career.draft
  if (d && d.status === 'signed') out.push(t('share.draft', { pick: pickText(d), team: g(d.team) }))
  if (a.includes('甲子園')) out.push(t('share.koshien'))
  const pro = life.bb?.rec?.official.pro
  if (pro && pro.games) {
    const top = life.person.country === 'US' ? 'MLB' : life.person.country === 'KR' ? 'KBO' : life.person.country === 'CU' ? (life.flags?.['cu.mlb'] !== undefined ? 'MLB' : t('share.top.domestic')) : t('share.top.first')
    if (life.person.position === 'P') out.push(t('share.pro.P', { top, g: pro.games, w: pro.w }))
    else out.push(t('share.pro.B', { top, g: pro.games, h: pro.h, hr: pro.hr }))
  }
  if (life.career.highestRank >= 10 && life.person.country !== 'KR') out.push(life.person.country === 'JP' ? t('share.mlb.JP') : t('share.mlb'))
  if (life.pot) out.push(t('share.pot', { n: life.pot.stars ?? 1 }))
  if (!out.length && life.career.yearsPlaying > 0) out.push(t('share.years', { n: life.career.yearsPlaying }))
  return out.slice(0, 3)
}

/**
 * the three figures of the life's end, each read from its own field of the state (nothing estimated):
 * - income: `lifetimeIncome`, the sum of every year's income of the model (play, work and pension, before tax and living costs)
 * - edu: the school he finished, or 大学在学中 (after.ts eduText); unknown when he died before 18 (the household model starts then)
 * - money: `money`, what was left at the end after the model's spending; a different figure from the income
 */
export function shareFacts(life: LifeState): { income: string; edu: string; money: string } {
  return {
    income: yen(life.lifetimeIncome),
    edu: g(eduText(life)),
    money: yen(life.money),
  }
}

/**
 * the age at the end and how far he got, in one phrase: the age as the screen shows it (displayAge.ts), said as the length of the life
 * (「N歳まで → プロ野球選手」 read as if he had played until N)
 */
function lifeLine(life: LifeState): string {
  const d = life.career.draft
  return t('share.line', { age: shownAge(life.age), label: g(highestLabel(life)), draft: d && d.status === 'signed' ? t('share.line.draft', { pick: pickText(d) }) : '' })
}

/** X's length of a post: a link counts 23, a character of the ranges below 1, every other one (Japanese) 2; the limit is 280 */
export const X_LIMIT = 280
export function xLength(text: string): number {
  let n = 0
  for (const part of text.split(/(https?:\/\/\S+)/)) {
    if (/^https?:\/\//.test(part)) {
      n += 23
      continue
    }
    for (const ch of part) {
      const c = ch.codePointAt(0)!
      n += c <= 4351 || (c >= 8192 && c <= 8205) || (c >= 8208 && c <= 8223) || (c >= 8242 && c <= 8247) ? 1 : 2
    }
  }
  return n
}

/**
 * the short text for a post on X: within X's limit, the link always kept. Who he was, how far he got and the link come first; the
 * rarity, the title and the question are added only while they fit (a long title is cut with …). The copied text stays the long one.
 */
export function postText(life: LifeState, title: string, rarityText: string | null, url: string): string {
  const head = [t('share.head', { brand: brandName(life.person.country ?? 'JP'), name: g(fullName(life)) }), lifeLine(life)]
  const lines = [...head]
  const fits = (extra: string[]) => xLength([...extra, url].join('\n')) <= X_LIMIT
  const titled = t('share.quote', { text: title })
  const optional = [rarityText ? t('share.reach.post', { x: rarityText }) : '', titled, t('share.ask')].filter(Boolean)
  for (const o of optional) {
    if (fits([...lines, o])) {
      lines.push(o)
      continue
    }
    // a long title: cut to what fits
    if (o === titled) {
      const cut = (x: string) => t('share.quote', { text: `${x}…` })
      let tt = title
      while (tt.length > 4 && !fits([...lines, cut(tt)])) tt = tt.slice(0, -1)
      if (fits([...lines, cut(tt)])) lines.push(cut(tt))
    }
  }
  // even the head too long (a very long name): cut the second line, never the link
  while (!fits(lines) && lines[lines.length - 1].length > 1) lines[lines.length - 1] = lines[lines.length - 1].slice(0, -2) + '…'
  return [...lines, url].join('\n')
}

export function shareText(life: LifeState, title: string, rarityText: string | null, url: string): string {
  const f = shareFacts(life)
  return [
    t('share.head', { brand: brandName(life.person.country ?? 'JP'), name: g(fullName(life)) }),
    t('share.born', { place: placeName(prefName(life)), line: lifeLine(life) }),
    t('share.facts', { income: f.income, edu: f.edu, money: f.money }),
    t('share.quote', { text: title }),
    rarityText ? t('share.reach', { x: rarityText }) : '',
    t('share.ask'),
    url,
  ]
    .filter(Boolean)
    .join('\n')
}

