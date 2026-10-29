import { afterEach, describe, expect, it } from 'vitest'
import { setLang } from './index.ts'
import { JAPANESE, gameText, gameTextMisses, loadGameTexts, setGameTextsForTests, type SourceText } from './game.ts'
import { createLife, endYear, planYear, resolveDecision, type Sim } from '../engine/life.ts'
import { defaultParams } from '../engine/params.ts'
import type { LifeConfig } from '../engine/types.ts'

// The game's own texts at display time (src/i18n/game.ts): the identity in Japanese, the matching of templates on a small catalog made
// here, and the share of the lines and questions of real lives still shown in Japanese with the real English catalog (COVERAGE_MIN).

afterEach(() => setLang('ja'))

/** a small catalog made by hand: the language 'xx' (any code other than 'ja' works) */
const SOURCE: SourceText[] = [
  { id: 'a', ja: '野球を始めました。' },
  { id: 'b', ja: '{0}に入学しました。', parts: ['school'] },
  { id: 'c', ja: '年俸は{0}万円です。', parts: ['pay'] },
  { id: 'd', ja: '契約金 約{0}万ドル', parts: ['usd'] },
  { id: 'e', ja: '観客は{0}万人でした。', parts: ['n'] },
  { id: 'f', ja: '{0}と{1}を食べた', parts: ['a', 'b'] },
  { id: 'g', ja: 'りんご' },
  { id: 'h', ja: 'みかん' },
  { id: 'i', ja: '{0}さんと出会いました。{1}', parts: ['name', 'rest'] },
  { id: 'j', ja: '山田' },
  { id: 'k', ja: '太郎' },
  { id: 'l', ja: '話が合いました。' },
  { id: 'm', ja: '{0}で、', parts: ['at'] },
  { id: 'n', ja: '{0}{1}として働き始めました。', parts: ['at', 'title'] },
  { id: 'o', ja: '事務職' },
  { id: 'p', ja: 'わかば' },
  { id: 'q', ja: '精機' },
  { id: 'r', ja: '運用の成績は{0}{1}万円でした。', parts: ['sign', 'gain'] },
  { id: 's', ja: '{0}・{1}', parts: ['x', 'y'] },
  { id: 't', ja: '高校{0}年・{1}', parts: ['year', 'school'] },
]
const EN: Record<string, string> = {
  a: 'He started baseball.',
  b: 'He entered {0}.',
  c: 'His salary is {0|yen}.',
  d: 'Signing bonus about {0|usd}',
  e: 'The crowd was {0|man}.',
  f: 'ate {0} and {1}',
  g: 'an apple',
  h: 'an orange',
  i: 'He met {0}. {1}',
  j: 'Yamada',
  k: 'Taro',
  l: 'They got on well.',
  m: ' at {0}',
  n: '{1}{0}: he started work.',
  o: 'office worker',
  p: 'Wakaba',
  q: 'Precision',
  r: 'His investments made {0}{1|yen} this year.',
  s: '{0} and {1}',
  t: 'Year {0} at {1}',
}

describe('gameText', () => {
  it('in Japanese is the text itself, always (even with a catalog loaded)', () => {
    setGameTextsForTests('en', SOURCE, EN)
    setGameTextsForTests('xx', SOURCE, EN)
    for (const s of ['野球を始めました。', '埼玉県立浦和高等学校に入学しました。', '', 'abc', '年俸は1,200万円です。']) expect(gameText(s)).toBe(s)
  })

  it('exact texts, templates with numbers and their modifiers, values translated in turn', () => {
    setGameTextsForTests('en', SOURCE, EN)
    setLang('en')
    expect(gameText('野球を始めました。')).toBe('He started baseball.')
    // (amounts in English in dollars at the display's fixed rate, ¥150: src/i18n/currency.ts; a dollar amount of the game stays the same)
    expect(gameText('年俸は1,200万円です。')).toBe('His salary is $80,000.')
    expect(gameText('契約金 約1,500万ドル')).toBe('Signing bonus about $15 million')
    expect(gameText('観客は4.5万人でした。')).toBe('The crowd was 45,000.')
    // two values side by side: the cut where both are known
    expect(gameText('りんごとみかんを食べた')).toBe('Ate an apple and an orange')
    // a value that is itself a sentence, and a person's name by its parts
    expect(gameText('山田 太郎さんと出会いました。話が合いました。')).toBe('He met Yamada Taro. They got on well.')
    // a fragment beginning with a space, a value made of two words of the catalog (a company), a whole line tidied
    expect(gameText('わかば精機で、事務職として働き始めました。')).toBe('Office worker at Wakaba Precision: he started work.')
    // a sign kept before an amount
    expect(gameText('運用の成績は+30万円でした。')).toBe('His investments made +$2,000 this year.')
    expect(gameText('運用の成績は−1,200万円でした。')).toBe('His investments made −$80,000 this year.')
    // a template with no kana or kanji of its own is never used; a list joined with ・ is translated item by item (one unknown item
    // left as it is, and the text kept among the misses)
    expect(gameText('りんご・知らない')).toBe('An apple, 知らない')
    expect(gameTextMisses('en')).toContain('りんご・知らない')
    // a closing note in brackets
    expect(gameText('りんご（みかん・りんご）')).toBe('An apple (an orange an apple)')
    expect(gameText('りんご（話が合いました。）')).toBe('An apple (They got on well.)')
    // (two words of the catalog joined by ・ are a name in katakana: each part in turn)
    expect(gameText('りんご・みかん')).toBe('an apple an orange')
    // sentences translated one by one when the whole is not in the catalog
    expect(gameText('野球を始めました。話が合いました。')).toBe('He started baseball. They got on well.')
  })

  it('names by rules: places, schools by their kind and place, amounts', () => {
    setGameTextsForTests('en', SOURCE, EN)
    setLang('en')
    expect(gameText('埼玉県')).toBe('Saitama')
    expect(gameText('北海道札幌南高等学校に入学しました。')).toBe('He entered a public high school in Hokkaido.')
    expect(gameText('早稲田大学に入学しました。')).toBe('He entered Waseda University.')
    expect(gameText('どこにもない架空高校')).toBe('a high school')
    expect(gameText('高校2年・存在しない学園高等学校')).toBe('Year 2 at a high school')
    expect(gameText('1.5億円')).toBe('$1 million')
    // a text no rule knows stays as it is
    expect(gameText('知らない言葉')).toBe('知らない言葉')
  })

  it('Korean names (hangul in the data) in Latin letters: the usual family names, given names syllable by syllable; never in Japanese', () => {
    setGameTextsForTests('en', SOURCE, EN)
    expect(gameText('김 민준')).toBe('김 민준')
    setLang('en')
    expect(gameText('김 민준')).toBe('Kim Minjun')
    expect(gameText('이 현우')).toBe('Lee Hyeon-u')
    expect(gameText('서연')).toBe('Seoyeon')
    expect(gameText('최 승현さんと出会いました。話が合いました。')).toBe('He met Choi Seunghyeon. They got on well.')
  })

  it('a sentence the game appends with its 。 (「。…」) is found once a line is cut at its 。; sentences joined are found as a run', () => {
    setGameTextsForTests('en', [...SOURCE, { id: 'u', ja: '。開業に200万円かかる' }, { id: 'v', ja: '体力が生きる。夜勤もある' }], { ...EN, u: '. Opening it costs ¥2 million', v: 'Hard work. Night shifts too' })
    setLang('en')
    expect(gameText('開業に200万円かかる')).toBe('Opening it costs ¥2 million')
    expect(gameText('野球を始めました。体力が生きる。夜勤もある。開業に200万円かかる')).toBe('He started baseball. Hard work. Night shifts too. Opening it costs ¥2 million')
  })

  it('without a catalog for the language, the text as it is', () => {
    setLang('en')
    setGameTextsForTests('en', [], {})
    expect(gameText('野球を始めました。')).toBe('野球を始めました。')
  })
})

// ---------------------------------------------------------------- the coverage of real lives with the English catalog

/** the least share of the lines and question texts shown with no Japanese left in them (98.7% measured 2026-10-23 with every English part, 100% with the composites; raise it as it improves) */
const COVERAGE_MIN = 0.998

/**
 * The names of the game's people in English, reviewed (2026-10-23). The people are fictional and the data has no readings: each name
 * has one reading fixed here, the most common one for that name (surnames: the usual reading; given names: the first reading of the
 * baby-name rankings). Different names may share a reading (奏太・颯太 Sota), as they do in Japan. Hepburn without long-vowel marks
 * (佐藤 Sato, 亮 Ryo), as the places (src/i18n/places.ts). Korean names: game.ts hangulText. A name added to the data fails here
 * until its reading is chosen.
 */
const NAMES_EN: Record<string, string> = {
  佐藤: 'Sato', 鈴木: 'Suzuki', 高橋: 'Takahashi', 田中: 'Tanaka', 伊藤: 'Ito', 渡辺: 'Watanabe', 山本: 'Yamamoto', 中村: 'Nakamura',
  小林: 'Kobayashi', 加藤: 'Kato', 吉田: 'Yoshida', 山田: 'Yamada', 佐々木: 'Sasaki', 山口: 'Yamaguchi', 松本: 'Matsumoto', 井上: 'Inoue',
  木村: 'Kimura', 林: 'Hayashi', 斎藤: 'Saito', 清水: 'Shimizu', 山崎: 'Yamazaki', 森: 'Mori', 池田: 'Ikeda', 橋本: 'Hashimoto', 阿部: 'Abe',
  石川: 'Ishikawa', 山下: 'Yamashita', 中島: 'Nakajima', 石井: 'Ishii', 小川: 'Ogawa', 前田: 'Maeda', 岡田: 'Okada', 長谷川: 'Hasegawa',
  藤田: 'Fujita', 後藤: 'Goto', 近藤: 'Kondo', 村上: 'Murakami', 遠藤: 'Endo', 青木: 'Aoki', 坂本: 'Sakamoto', 斉藤: 'Saito', 福田: 'Fukuda',
  太田: 'Ota', 西村: 'Nishimura', 藤井: 'Fujii', 金子: 'Kaneko', 岡本: 'Okamoto', 藤原: 'Fujiwara', 三浦: 'Miura', 中野: 'Nakano',
  中川: 'Nakagawa', 原田: 'Harada', 松田: 'Matsuda', 竹内: 'Takeuchi', 小野: 'Ono', 田村: 'Tamura', 中山: 'Nakayama', 和田: 'Wada',
  石田: 'Ishida', 森田: 'Morita',
  蓮: 'Ren', 湊: 'Minato', 陽翔: 'Haruto', 蒼: 'Aoi', 樹: 'Itsuki', 悠真: 'Yuma', 大和: 'Yamato', 颯: 'Hayate', 律: 'Ritsu', 陽太: 'Hinata',
  奏太: 'Sota', 悠人: 'Yuto', 朝陽: 'Asahi', 大翔: 'Hiroto', 湊斗: 'Minato', 健太: 'Kenta', 翔太: 'Shota', 拓海: 'Takumi', 大輝: 'Daiki',
  航: 'Wataru', 颯太: 'Sota', 海斗: 'Kaito', 優斗: 'Yuto', 晴: 'Haru', 陸: 'Riku', 隼: 'Shun', 一輝: 'Kazuki', 直樹: 'Naoki', 圭: 'Kei', 亮: 'Ryo',
  美咲: 'Misaki', 葵: 'Aoi', 結衣: 'Yui', 陽菜: 'Hina', 紗希: 'Saki', 彩: 'Aya', 真央: 'Mao', 千尋: 'Chihiro', 詩織: 'Shiori', 理沙: 'Risa',
  舞: 'Mai', 恵: 'Megumi',
}

describe('the names of the people in English (reviewed)', () => {
  it('every Japanese name of the data has its reviewed reading; every Korean name its letters', async () => {
    const { FAMILY_NAMES, GIVEN_NAMES, PARTNER_NAMES } = await import('../data/jp.ts')
    const { KR_FAMILY_NAMES, KR_GIVEN_NAMES, KR_PARTNER_NAMES } = await import('../data/league.ts')
    await loadGameTexts('en')
    setLang('en')
    for (const name of [...FAMILY_NAMES, ...GIVEN_NAMES, ...PARTNER_NAMES]) expect(gameText(name), name).toBe(NAMES_EN[name])
    expect(Object.keys(NAMES_EN).length).toBe(new Set([...FAMILY_NAMES, ...GIVEN_NAMES, ...PARTNER_NAMES]).size)
    expect(gameText('山崎 陽太')).toBe('Yamazaki Hinata')
    for (const name of [...KR_FAMILY_NAMES, ...KR_GIVEN_NAMES, ...KR_PARTNER_NAMES]) expect(gameText(name), name).toMatch(/^[A-Z][a-z]+(-[a-z]+)?$/)
    expect([...KR_GIVEN_NAMES, ...KR_PARTNER_NAMES].map(gameText).join(' ')).toBe(
      'Minjun Seojun Doyun Yejun Siu Hajun Juwon Jiho Jihu Jun-u Hyeon-u Geon-u Ujin Seon-u Minjae Jihun Seunghyeon Taeyang Jaeyun Donghyeon ' +
        'Seoyeon Jiu Hayun Seoyun Jimin Sua Chaewon Yeeun Yujin Daeun',
    )
  })
})

describe('the composites (src/i18n/game/composite.json: the shapes of lines the game joins at run time, written by hand)', () => {
  it('each has its id, no Japanese text twice, and an English text using only its values', async () => {
    const { readFileSync, readdirSync } = await import('node:fs')
    const dir = new URL('./game/', import.meta.url)
    const composite = JSON.parse(readFileSync(new URL('composite.json', dir), 'utf8')) as SourceText[]
    const source = JSON.parse(readFileSync(new URL('source.json', dir), 'utf8')) as SourceText[]
    const en = JSON.parse(readFileSync(new URL('en/part-composite.json', dir), 'utf8')) as Record<string, string>
    const known = new Set(source.map((s) => s.ja))
    const values = (s: string) => new Set([...s.matchAll(/\{(\d+)(?:\|\w+)?\}/g)].map((m) => m[1]))
    expect(new Set(composite.map((c) => c.id)).size).toBe(composite.length)
    for (const c of composite) {
      expect(known.has(c.ja), c.ja).toBe(false)
      expect(en[c.id], c.ja).toBeTruthy()
      expect(JAPANESE.test(en[c.id]), c.ja).toBe(false)
      const own = values(c.ja)
      for (const v of values(en[c.id])) expect(own.has(v), `${c.ja}: {${v}}`).toBe(true)
    }
    // (every id of the English parts is a text of the game or a composite)
    const ids = new Set([...source, ...composite].map((s) => s.id))
    const parts = readdirSync(new URL('en/', dir)).flatMap((f) => Object.keys(JSON.parse(readFileSync(new URL(`en/${f}`, dir), 'utf8'))))
    expect(parts.filter((id) => !ids.has(id))).toEqual([])
  })
})

describe('the coverage of the English catalog', () => {
  it('the lines of the record and the questions of real lives in English', async () => {
    await loadGameTexts('en')
    const sim: Sim = { params: defaultParams() }
    const shown: string[] = []
    const configs: LifeConfig[] = []
    for (const country of ['JP', 'US', 'KR', 'CU'] as const)
      for (let i = 0; i < 10; i++) {
        configs.push({ seed: 31_000 + 97 * i + country.charCodeAt(0), country, pace: 'p15' })
        configs.push({ seed: 32_000 + 89 * i + country.charCodeAt(1), country, pace: 'p15', mode: 'potential', stars: 1 + i })
      }
    for (const config of configs) {
      const s = createLife(config)
      for (let g = 0; g < 130 && s.alive; g++) {
        const plan = planYear(s, sim)
        for (const e of plan.events) shown.push(e.entry.text)
        let d = plan.decision?.decision
        while (d && s.alive) {
          shown.push(d.title, d.body, ...(d.factText ? [d.factText] : []), ...(d.question ? [d.question] : []), ...d.choices.flatMap((c) => [c.label, ...(c.hint ? [c.hint] : [])]))
          const r = resolveDecision(s, d.autoIndex, sim)
          for (const e of r.events) shown.push(e.entry.text)
          d = r.followUp?.decision
        }
        endYear(s)
      }
    }
    setLang('en')
    const t0 = performance.now()
    const left = new Map<string, number>()
    let japanese = 0
    for (const ja of shown) {
      const en = gameText(ja)
      if (!JAPANESE.test(en)) continue
      japanese++
      const k = ja.replace(/\d[\d,.]*/g, '#')
      left.set(k, (left.get(k) ?? 0) + 1)
    }
    const ms = performance.now() - t0
    const translated = 1 - japanese / shown.length
    const top = [...left].sort((a, b) => b[1] - a[1]).slice(0, 30)
    console.log(
      `game texts in English: ${shown.length} shown, ${(translated * 100).toFixed(1)}% with no Japanese (${(ms / 1000).toFixed(1)} s)\n` +
        top.map(([k, n]) => `${String(n).padStart(5)}  ${k.slice(0, 160)}`).join('\n'),
    )
    expect(translated).toBeGreaterThanOrEqual(COVERAGE_MIN)
  }, 60_000)
})
