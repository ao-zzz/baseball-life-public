import { lang } from './index.ts'
import { placeName } from './places.ts'
import { statsWords } from './statsEn.ts'
import { yen } from '../ui/format.ts'
import { moneyTokens } from './currency.ts'
import { isTranslated, untranslatedCount } from './script.ts'
import { YEN_PER_DOLLAR } from '../engine/contract.ts'
import { ALL_SCHOOLS } from '../data/schools/index.ts'
import type { School } from '../data/schools/types.ts'

// The game's own Japanese texts in another language, at display time (the multilingual work, batch 7). The game (src/engine) writes
// its lines, questions and labels in Japanese and keeps them so; the screens pass what they show through gameText. In Japanese it is
// the identity. In another language it looks the text up in that language's catalog: src/i18n/game/source.json (every Japanese
// string and template of the game, made by scripts/i18n-extract.ts) and src/i18n/game/<lang>/*.json (id → text). The catalogs are
// loaded only for a language that needs them (loadGameTexts, main.tsx); the Japanese page never downloads them.
// A text is found by: its exact Japanese; else a template whose literal parts match it (each part's value translated in turn, a number
// kept, with the modifiers {n|yen} {n|usd} {n|man}); else a rule for names (a person's, a place's, a school's, an amount of money);
// else sentence by sentence; else it is shown as it is (and kept among the misses, for the tests). Pure display: nothing here is
// read by the game.

export interface SourceText {
  id: string
  ja: string
  parts?: string[]
}

type Entries = Record<string, string>

/** kana and kanji: what makes a text Japanese (punctuation alone does not) */
export const JAPANESE = /[ぁ-んァ-ヶ一-龠々〆〇ー]/

// ---------------------------------------------------------------- the catalogs, by language

// (lazy: each file is a chunk of its own, fetched only by loadGameTexts. source.json is made by the script; composite.json is written
// by hand: the shapes of the lines the game joins from several pieces at run time, which no single string of the code has)
const SOURCE_FILES = import.meta.glob<SourceText[]>(['./game/source.json', './game/composite.json'], { import: 'default' })
const LANG_FILES = import.meta.glob<Entries>('./game/*/*.json', { import: 'default' })

/** a template compiled: its segments (literal text, or the number of a value), its English, how specific it is */
interface Template {
  segs: (string | number)[]
  /** the literal parts, each non-empty */
  lits: string[]
  /** the longest literal part (the index) */
  key: string
  /** the number of literal characters: the more, the earlier it is tried */
  spec: number
  out: string
}

interface Catalog {
  exact: Map<string, string>
  /** the templates by their longest literal part; the parts by their length, longest first */
  byKey: Map<string, Template[]>
  keys: string[]
  cache: Map<string, string>
  /** a text not translated whole, with the depth it was tried at (a deeper try has less room) */
  partial: Map<string, { depth: number; out: string }>
  /** the texts whose translation was built of pieces (a template filled, sentences joined) */
  built: Set<string>
  /** the lines as shown (tidied) */
  shown: Map<string, string>
  misses: Set<string>
}

const CATALOGS = new Map<string, Catalog>()
/** the languages whose catalog is the one of the files */
const FROM_FILES = new Set<string>()

/** the segments of a Japanese template: `{n}` is a value */
function segmentsOf(ja: string): (string | number)[] {
  const segs: (string | number)[] = []
  let at = 0
  for (const m of ja.matchAll(/\{(\d+)\}/g)) {
    if (m.index > at) segs.push(ja.slice(at, m.index))
    segs.push(Number(m[1]))
    at = m.index + m[0].length
  }
  if (at < ja.length) segs.push(ja.slice(at))
  return segs
}

function compile(source: SourceText[], entries: Entries): Catalog {
  const exact = new Map<string, string>()
  const byKey = new Map<string, Template[]>()
  // (a piece the game appends to a sentence, 「。開業に200万円かかる」, is also a sentence of its own once a line is cut at its 。)
  const all = source.flatMap((s) => {
    const out = entries[s.id]
    if (out === undefined || out === '') return []
    const one = { ...s, out, cut: false }
    return s.ja.startsWith('。') && s.ja.length > 1 ? [one, { ...s, ja: s.ja.slice(1), out: out.replace(/^[.。]\s*/, ''), cut: true }] : [one]
  })
  for (const s of all) {
    const out = s.out
    if (!s.parts?.length) {
      // (a text of the game's own comes before one cut from a longer piece)
      if (!s.cut || !exact.has(s.ja)) exact.set(s.ja, out)
      continue
    }
    const segs = segmentsOf(s.ja)
    const lits = segs.filter((x): x is string => typeof x === 'string')
    // (a template with no kana or kanji of its own, such as 「{0}・{1}」, would match almost anything: not used)
    if (!lits.some((l) => JAPANESE.test(l))) continue
    const key = lits.reduce((a, b) => (b.length > a.length ? b : a), '')
    const t: Template = { segs, lits, key, spec: lits.reduce((a, b) => a + b.length, 0), out }
    byKey.set(key, [...(byKey.get(key) ?? []), t])
  }
  for (const list of byKey.values()) list.sort((a, b) => b.spec - a.spec)
  const keys = [...byKey.keys()].sort((a, b) => b.length - a.length)
  return { exact, byKey, keys, cache: new Map(), partial: new Map(), built: new Set(), shown: new Map(), misses: new Set() }
}

let sourcePromise: Promise<SourceText[]> | null = null

/** loads the game's texts of a language (nothing for Japanese); called before the first drawing (main.tsx) */
export async function loadGameTexts(l: string): Promise<void> {
  if (l === 'ja' || FROM_FILES.has(l)) return
  sourcePromise ??= Promise.all(Object.values(SOURCE_FILES).map((load) => load())).then((all) => all.flat())
  const files = Object.entries(LANG_FILES)
    .filter(([path]) => path.split('/')[2] === l)
    .sort(([a], [b]) => a.localeCompare(b))
  const [source, ...parts] = await Promise.all([sourcePromise, ...files.map(([, load]) => load())])
  CATALOGS.set(l, compile(source, Object.assign({}, ...parts) as Entries))
  FROM_FILES.add(l)
}

/** the catalog of a language from data in hand (tests: vitest reads the JSON files itself) */
export function setGameTextsForTests(l: string, source: SourceText[], entries: Entries | Entries[]): void {
  CATALOGS.set(l, compile(source, Array.isArray(entries) ? Object.assign({}, ...entries) : entries))
  FROM_FILES.delete(l)
}

/** the texts shown as they are in a language (tests: what is left to translate) */
export const gameTextMisses = (l: string = lang()): string[] => [...(CATALOGS.get(l)?.misses ?? [])]

// ---------------------------------------------------------------- the rules for names, by language

type SchoolWordKind = School['kind'] | 'jhs' | 'elem' | 'secondary'

interface NameWords {
  /** a school by its kind, its owner and its place (any may be unknown) */
  school: (kind: SchoolWordKind, owner?: School['owner'], place?: string) => string
  /** the separator of the two parts of a person's name */
  nameSep: string
  /** the separator of a list the game joined with ・ */
  listSep: string
  /** a note in brackets after a text */
  note: (x: string) => string
  /** the end of a sentence */
  stop: string
  /** Korean names (hangul in the data) written in Latin letters */
  romanHangul: boolean
  /** between two sentences joined, and the marks that end a sentence */
  join: string
  ends: RegExp
}

const KO_KIND: Record<SchoolWordKind, string> = {
  hs: '고등학교',
  univ: '대학',
  jc: '단기대학',
  kosen: '고등전문학교',
  jhs: '중학교',
  elem: '초등학교',
  secondary: '중등교육학교',
}
const ZH_KIND: Record<SchoolWordKind, string> = {
  hs: '高中',
  univ: '大學',
  jc: '短期大學',
  kosen: '高等專門學校',
  jhs: '國中',
  elem: '國小',
  secondary: '中等教育學校',
}
const KO_OWNER: Record<School['owner'], string> = { national: '국립', public: '공립', private: '사립' }
const ZH_OWNER: Record<School['owner'], string> = { national: '國立', public: '公立', private: '私立' }

const EN_KIND: Record<SchoolWordKind, string> = {
  hs: 'high school',
  univ: 'university',
  jc: 'junior college',
  kosen: 'college of technology',
  jhs: 'junior high school',
  elem: 'elementary school',
  secondary: 'secondary school',
}

const NAME_WORDS: Record<string, NameWords> = {
  en: {
    school: (kind, owner, place) => {
      const words = `${owner ? `${owner} ` : ''}${EN_KIND[kind]}`
      return `${/^[aeio]/.test(words) ? 'an' : 'a'} ${words}${place ? ` in ${place}` : ''}`
    },
    nameSep: ' ',
    listSep: ', ',
    note: (x) => ` (${x})`,
    stop: '.',
    romanHangul: true,
    join: ' ',
    ends: /[.!?]["”’]?$/,
  },
  // (a Korean name stays in hangul; a Japanese name's words are the catalog's)
  ko: {
    school: (kind, owner, place) => `${place ? `${place}의 ` : ''}${owner ? `${KO_OWNER[owner]} ` : ''}${KO_KIND[kind]}`,
    nameSep: ' ',
    listSep: ', ',
    note: (x) => ` (${x})`,
    stop: '.',
    romanHangul: false,
    join: ' ',
    ends: /[.!?]["”’]?$/,
  },
  // (a Japanese name in its kanji, run together as Chinese writes it; a Korean name in Latin letters: the data has no hanja)
  'zh-TW': {
    school: (kind, owner, place) => `${place ? `${place}的` : ''}${owner ? ZH_OWNER[owner] : ''}${ZH_KIND[kind]}`,
    nameSep: '',
    listSep: '、',
    note: (x) => `（${x}）`,
    stop: '。',
    romanHangul: true,
    join: '',
    ends: /[。！？」]$/,
  },
}

// ---------------------------------------------------------------- Korean names in Latin letters

const HANGUL = /[가-힣]/
const H_INITIAL = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h']
const H_VOWEL = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i']
const H_FINAL = ['', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k', 'm', 'l', 'l', 'l', 'p', 'l', 'm', 'p', 'p', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 't']
/** the family names of the data in their usual spelling (Revised Romanization would write 김 Gim, 이 I, 박 Bak) */
const HANGUL_FAMILY: Record<string, string> = {
  김: 'Kim', 이: 'Lee', 박: 'Park', 최: 'Choi', 정: 'Jung', 강: 'Kang', 조: 'Cho', 윤: 'Yoon', 장: 'Jang', 임: 'Lim',
  한: 'Han', 오: 'Oh', 서: 'Seo', 신: 'Shin', 권: 'Kwon', 황: 'Hwang', 안: 'Ahn', 송: 'Song', 류: 'Ryu', 홍: 'Hong',
}

/**
 * a Korean name, syllable by syllable in the Revised Romanization (personal names are written without the sound changes; a hyphen
 * where a syllable beginning with a vowel follows one ending in a consonant, 현우 Hyeon-u), family names in their usual spelling
 */
function hangulText(text: string): string {
  const word = (w: string, first: boolean) => {
    if (first && HANGUL_FAMILY[w]) return HANGUL_FAMILY[w]
    let out = ''
    for (const ch of w) {
      const k = ch.charCodeAt(0) - 0xac00
      if (k < 0 || k > 11171) {
        out += ch
        continue
      }
      const ini = H_INITIAL[Math.floor(k / 588)]
      const syl = ini + H_VOWEL[Math.floor((k % 588) / 28)] + H_FINAL[k % 28]
      out += out && ini === '' && /[^aeiouy]$/.test(out) ? `-${syl}` : syl
    }
    return out.charAt(0).toUpperCase() + out.slice(1)
  }
  // (the family name comes first; the given names of the data are never one syllable, so a family name alone is one too)
  const words = text.split(/( +)/)
  const first = words.find((x) => HANGUL.test(x))
  return words.map((w) => (HANGUL.test(w) ? word(w, w === first) : w)).join('')
}

/** the kind of a school by the end of its name (longest first) */
const SCHOOL_ENDS: [RegExp, SchoolWordKind][] = [
  [/高等専門学校$/, 'kosen'],
  [/短期大学(部)?$/, 'jc'],
  [/大学(院)?$/, 'univ'],
  [/中等教育学校$/, 'secondary'],
  [/(高等学校|高校)$/, 'hs'],
  [/(中学校|中学)$/, 'jhs'],
  [/小学校$/, 'elem'],
]

let schoolsByName: Map<string, School[]> | null = null
function schoolsNamed(name: string): School[] {
  if (!schoolsByName) {
    schoolsByName = new Map()
    for (const s of ALL_SCHOOLS) schoolsByName.set(s.name, [...(schoolsByName.get(s.name) ?? []), s])
  }
  return schoolsByName.get(name) ?? schoolsByName.get(name.replace(/高校$/, '高等学校')) ?? []
}

/** a school's name: its own name in the language when it has one (the major universities), else what it is and where */
function schoolName(text: string, words: NameWords): string | undefined {
  const kind = SCHOOL_ENDS.find(([re]) => re.test(text))?.[1]
  if (!kind) return undefined
  const known = statsWords()?.name[text]
  if (known) return known
  const found = schoolsNamed(text)
  const one = <T,>(f: (s: School) => T): T | undefined => (found.length && found.every((s) => f(s) === f(found[0])) ? f(found[0]) : undefined)
  const place = one((s) => s.pref)
  return words.school(one((s) => s.kind) ?? kind, one((s) => s.owner), place ? placeName(place) : undefined)
}

const NUMBER = /^([+\-−]?)(\d[\d,]*(?:\.\d+)?)$/
const MONEY = /^([+\-−]?)(\d[\d,]*(?:\.\d+)?)(億円|万円|万ドル)$/

/** a value put into a template: a number, with its modifier (an amount in 万円, in 万ドル, a count in 万, a month's number), or a text translated */
function valueText(v: string, mod: string | undefined, depth: number, c: Catalog): string {
  const m = NUMBER.exec(v)
  if (!m) return translate(v, depth + 1, c)
  if (!mod) return v
  const n = Number(m[2].replace(/,/g, ''))
  const sign = m[1] === '' || m[1] === '+' ? m[1] : '−'
  if (mod === 'yen') return (sign === '+' ? '+' : '') + yen(sign === '−' ? -n : n)
  // (dollars of a US contract: through yen at the game's own rate, so English shows the same dollars and other languages their currency)
  if (mod === 'usd') return yen((sign === '−' ? -n : n) * YEN_PER_DOLLAR)
  if (mod === 'man') return `${sign}${Math.round(n * 10000).toLocaleString('en-US')}`
  if (mod === 'month' && n >= 1 && n <= 12) {
    const l = lang()
    return l === 'ko' ? `${n}월` : l === 'zh-TW' ? `${n}月` : new Date(2000, n - 1, 1).toLocaleString('en-US', { month: 'long' })
  }
  return v
}

/** a name or an amount, by the rules (undefined when none applies) */
function byRule(text: string, c: Catalog): string | undefined {
  const words = NAME_WORDS[lang()]
  const place = placeName(text)
  if (place !== text) return place
  const money = MONEY.exec(text)
  if (money) {
    const n = Number(money[2].replace(/,/g, '')) * (money[3] === '億円' ? 10000 : 1)
    const neg = money[1] !== '' && money[1] !== '+'
    return yen((neg ? -n : n) * (money[3] === '万ドル' ? YEN_PER_DOLLAR : 1))
  }
  if (!words) return undefined
  const school = schoolName(text, words)
  if (school) return school
  // a person: 「姓 名」 (or 「名・姓」 in katakana), each part a name of the catalog
  const parts = text.split(/[ \u3000・]/)
  if (parts.length >= 2 && parts.length <= 3 && parts.every((p) => c.exact.has(p))) return parts.map((p) => c.exact.get(p)!).join(words.nameSep)
  // a name made of two words of the catalog side by side (a company: after.ts companyFor writes its head and its tail together), or a
  // name and a numbered part of it (a league and its division: route/rating.ts, 「東都大学野球連盟1部」)
  if (text.length <= 24)
    for (let i = 1; i < text.length; i++) {
      const a = c.exact.get(text.slice(0, i))
      if (a === undefined) continue
      const rest = text.slice(i)
      const numbered = /^\d+\D+$/.test(rest) ? byTemplate(rest, MAX_DEPTH - 1, c) : undefined
      const b = c.exact.get(rest) ?? (numbered?.clean ? numbered.out : undefined)
      if (b !== undefined) return `${a.trim()}${words.nameSep}${b.trim()}`
    }
  return undefined
}

/** every way the values of a template can be cut out of a text, the shortest values first */
function* fits(segs: (string | number)[], text: string, i: number, at: number, vals: string[]): Generator<string[]> {
  if (i === segs.length) {
    if (at === text.length) yield vals.slice()
    return
  }
  const s = segs[i]
  if (typeof s === 'string') {
    if (text.startsWith(s, at)) yield* fits(segs, text, i + 1, at + s.length, vals)
    return
  }
  const next = segs[i + 1]
  // (a value inside a sentence never runs across the end of one: only the last value, or one the template itself ends with 。 or
  // a bracket, may hold several sentences; else 「{0}回戦」 would swallow a whole line ending in 「…1回戦」)
  const oneSentence = (v: string) => !/。./.test(v) || (typeof next === 'string' && /^[。（]/.test(next))
  if (next === undefined) {
    vals.push(text.slice(at))
    yield* fits(segs, text, i + 1, text.length, vals)
    vals.pop()
    return
  }
  if (typeof next === 'string') {
    for (let end = text.indexOf(next, at); end >= 0; end = text.indexOf(next, end + 1)) {
      if (!oneSentence(text.slice(at, end))) break
      vals.push(text.slice(at, end))
      yield* fits(segs, text, i + 1, end, vals)
      vals.pop()
    }
    return
  }
  // two values side by side: every cut
  for (let end = at; end <= text.length; end++) {
    if (!oneSentence(text.slice(at, end))) break
    vals.push(text.slice(at, end))
    yield* fits(segs, text, i + 1, end, vals)
    vals.pop()
  }
}

/** how many ways of cutting a text are tried for one template, and in all for one text shown (its values included) */
const MAX_FITS = 64
const BUDGET = 4000
const MAX_DEPTH = 8
let budget = BUDGET

/** a text with nothing of Japanese left for the language now (script.ts: for Chinese, kana and Japan's own kanji forms) */
const clean = (s: string) => isTranslated(s, lang())

/**
 * a whole line made of pieces (a template filled, sentences joined), tidied: the pieces keep their own spaces (a fragment may begin with
 * " at" or end with ", "), so double spaces are collapsed, a space before , . : ; ) removed, and the line's first letter and a letter
 * after ". " made capital where a piece began in lower case. Only a whole line: a piece inside another keeps its case.
 */
function tidy(s: string): string {
  // (Korean: double spaces and a space before a mark; Chinese: no spaces beside its full-width marks; the rest is English's)
  if (lang() === 'ko') return s.replace(/ {2,}/g, ' ').replace(/ +([,:;)]|\.(?!\d))/g, '$1')
  if (lang() === 'zh-TW') return s.replace(/ {2,}/g, ' ').replace(/ *([，。、：；！？）」』]) */g, '$1').replace(/([（「『]) +/g, '$1')
  return s
    .replace(/ {2,}/g, ' ')
    .replace(/ +([,:;)]|\.(?!\d))/g, '$1')
    // (a count of one: "1 games" → "1 game")
    .replace(/(?<![\d.,/])1 (game|home run|RBI|win|strikeout|save|year|time|hit|start|inning|earned run|run)s\b/g, '1 $1')
    .replace(/(?<![\d.,])1 losses\b/g, '1 loss')
    .replace(/^(\s*["“‘(]?)([a-z])/, (_, a: string, b: string) => a + b.toUpperCase())
    .replace(/([.!?]["”’]? )([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase())
}

/** a template's text with its values in their language */
function fill(t: Template, vals: string[], depth: number, c: Catalog): string {
  const byIndex = new Map<number, string>()
  let k = 0
  for (const s of t.segs) if (typeof s === 'number') byIndex.set(s, vals[k++])
  return t.out.replace(/\{(\d+)(?:\|(\w+))?\}/g, (m, n: string, mod: string | undefined) => {
    const v = byIndex.get(Number(n))
    return v === undefined ? m : valueText(v, mod, depth, c)
  })
}

/** the text by its templates: the first whose values are all translated, else the first that fits (some values left as they are) */
function byTemplate(text: string, depth: number, c: Catalog): { out: string; clean: boolean } | undefined {
  const cands: Template[] = []
  for (const key of c.keys) if (key.length <= text.length && text.includes(key)) cands.push(...c.byKey.get(key)!)
  cands.sort((a, b) => b.spec - a.spec)
  let best: string | undefined
  for (const t of cands) {
    if (!t.lits.every((l) => text.includes(l))) continue
    // (a template that leaves values in Japanese is kept only when it holds at least half of the text: a short one, such as 「{0}歳」,
    // fitted to a long text it was not made for, would only scramble it)
    const enough = t.spec * 2 >= text.length
    let n = 0
    for (const vals of fits(t.segs, text, 0, 0, [])) {
      const out = fill(t, vals, depth, c)
      if (clean(out)) return { out, clean: true }
      if (enough && (best === undefined || japaneseIn(out) < japaneseIn(best))) best = out
      if (++n >= MAX_FITS || --budget <= 0) break
    }
    if (budget <= 0) break
  }
  return best === undefined ? undefined : { out: best, clean: false }
}

/** how many characters of Japanese a text still has, for the language now */
const japaneseIn = (s: string) => untranslatedCount(s, lang())

/**
 * a text the game joined from pieces without a template of its own, each piece translated: lines, sentences, a closing note in
 * brackets (「…（知識+3・お金−20万円）」), a list joined with ・ (undefined when it is none of them)
 */
function byPieces(text: string, depth: number, c: Catalog): string | undefined {
  const words = NAME_WORDS[lang()]
  const tr = (x: string) => translate(x, depth + 1, c)
  const lines = text.split('\n')
  if (lines.length > 1) return lines.map(tr).join('\n')
  if (!words) return undefined
  // (a sentence the catalog has only without its 。: translated so, with the language's full stop)
  const sentence = (x: string) => {
    const known = /。$/.test(x) && !c.exact.has(x) ? c.exact.get(x.slice(0, -1)) : undefined
    if (known !== undefined) return `${known}${words.ends.test(known) ? '' : words.stop}`
    const out = tr(x)
    if (clean(out) || !/。$/.test(x)) return out
    const bare = tr(x.slice(0, -1))
    return clean(bare) ? `${bare}${words.ends.test(bare) ? '' : words.stop}` : out
  }
  const ways: (() => string | undefined)[] = [
    // a closing note in brackets (its own brackets may hold more)
    () => {
      if (!text.endsWith('）')) return undefined
      let open = -1
      for (let i = text.length - 2, d = 0; i >= 0 && open < 0; i--) {
        if (text[i] === '）') d++
        else if (text[i] === '（') {
          if (d === 0) open = i
          else d--
        }
      }
      if (open < 0 || open === text.length - 2) return undefined
      const head = text.slice(0, open)
      const inner = words.note(tr(text.slice(open + 1, -1)))
      return head ? `${sentence(head)}${inner}` : inner.trim()
    },
    () => {
      const sentences = text.match(/[^。！？]+[。！？]*|[。！？]+/g) ?? []
      if (sentences.length <= 1) return undefined
      // (the longest run of sentences the catalog has whole: the game joins hints such as 「体力が生きる。夜勤もある」 with 。 into longer ones)
      const out: string[] = []
      for (let i = 0; i < sentences.length; ) {
        let j = sentences.length
        for (; j > i + 1; j--) {
          const run = sentences.slice(i, j).join('')
          if (c.exact.has(run) || c.exact.has(run.replace(/。$/, ''))) break
        }
        out.push(sentence(sentences.slice(i, j).join('')))
        i = j
      }
      return out.join(words.join)
    },
    () => {
      const items = text.split('・')
      return items.length > 1 && items.length <= 8 && items.every(Boolean) ? items.map(tr).join(words.listSep) : undefined
    },
  ]
  let best: string | undefined
  for (const way of ways) {
    const out = way()
    if (out === undefined) continue
    if (clean(out)) return out
    if (best === undefined || japaneseIn(out) < japaneseIn(best)) best = out
  }
  return best
}

function translate(text: string, depth: number, c: Catalog): string {
  if (!JAPANESE.test(text)) return HANGUL.test(text) && NAME_WORDS[lang()]?.romanHangul ? hangulText(text) : text
  const done = c.cache.get(text)
  if (done !== undefined) return done
  const tried = c.partial.get(text)
  if (tried && tried.depth <= depth) return tried.out
  const exact = c.exact.get(text)
  if (exact !== undefined) {
    c.cache.set(text, exact)
    return exact
  }
  let out: string
  if (depth < MAX_DEPTH) {
    const tm = byTemplate(text, depth, c)
    const rule = tm?.clean ? undefined : byRule(text, c)
    const sentences = tm?.clean || rule !== undefined ? undefined : byPieces(text, depth, c)
    // (when nothing translates it whole: the way that leaves the least Japanese, if it leaves less than the text has)
    const partly = [tm?.out, sentences].filter((x): x is string => x !== undefined).sort((a, b) => japaneseIn(a) - japaneseIn(b))[0]
    out = tm?.clean ? tm.out : (rule ?? (sentences !== undefined && clean(sentences) ? sentences : partly !== undefined && japaneseIn(partly) < japaneseIn(text) ? partly : text))
    if (out !== rule && out !== text) c.built.add(text)
  } else out = byRule(text, c) ?? text
  if (clean(out)) c.cache.set(text, out)
  // (a text tried with the budget spent may do better another time: not kept)
  else if (budget > 0) c.partial.set(text, { depth, out })
  return out
}

/**
 * one of the game's Japanese texts (a line of the record, a question, a label) in the language now: in Japanese the text itself,
 * always; in another, its translation when the catalog has it, else the text as it is
 */
export function gameText(ja: string): string {
  const l = lang()
  if (l === 'ja') return ja
  const c = CATALOGS.get(l)
  if (!c || !ja) return ja
  const shown = c.shown.get(ja)
  if (shown !== undefined) return shown
  budget = BUDGET
  const raw = translate(ja, 0, c)
  // (a line built of pieces is tidied as a whole; a piece inside another line never is: the cache keeps the pieces as they are)
  const whole = c.built.has(ja) ? tidy(raw) : raw
  // (a piece's own spaces, 「 Three years…」 kept for the lines it is joined into, are not the line's when it is shown alone)
  // (only a sentence's: a fragment such as 「 at …」 keeps the space the screen joins it with)
  // (in Korean and Chinese a whole line shown alone is trimmed)
  const done = ja !== ja.trim() ? whole : l === 'en' ? whole.replace(/^ +(?=[A-Z"“])/, '').replace(/(?<=[.!?]["”]?) +$/, '') : whole.trim()
  // (the amounts written {yen:N} in the catalog, in the language's currency: after the check, whose kanji may be the currency's own)
  const out = moneyTokens(done, l)
  if (!clean(done)) c.misses.add(ja)
  if (clean(done) || budget > 0) c.shown.set(ja, out)
  return out
}
