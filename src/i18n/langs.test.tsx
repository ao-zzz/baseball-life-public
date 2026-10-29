import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { loadLanguage } from './packs.ts'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { JA } from './ja.ts'
import { EN } from './en.ts'
import { KO } from './ko.ts'
import { ZH_TW } from './zhTW.ts'
import { dataDate, dayText, langFromPath, pathIn, setLang, t } from './index.ts'
import { untranslated } from './script.ts'
import { PLACE_EN, STAR_EN, placeWords } from './places.ts'
import { STAT_EN, SOURCE_EN, statsWords } from './statsEn.ts'
import { CHANGES, changeText } from './changelog.ts'
import { gameText, loadGameTexts } from './game.ts'
import { CHANGELOG } from '../data/changelog.ts'
import { SOURCES } from '../data/sources.ts'
import { FEEDBACK_CATEGORIES, INFO_PAGES } from '../data/site.ts'
import { yen } from '../ui/format.ts'
import { createLife, endYear, planYear, resolveDecision } from '../engine/life.ts'
import { defaultParams } from '../engine/params.ts'
import type { LifeConfig } from '../engine/types.ts'

// Korean (ko) and Traditional Chinese for Taiwan (zh-TW): the same scope and the same checks as English (i18n.test.tsx, game.test.tsx).
// "Still Japanese" is the language's own (script.ts): any kana, and for Korean any kanji, for Chinese Japan's own kanji forms and
// simplified characters.

const LANGS = [
  ['ko', KO],
  ['zh-TW', ZH_TW],
] as const
type L = (typeof LANGS)[number][0]

afterEach(() => setLang('ja'))

// (their words are fetched by their own pages: packs.ts, as main.tsx does)
beforeAll(async () => {
  await loadLanguage('ko')
  await loadLanguage('zh-TW')
})

const values = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
const parts = (s: string) => [...s.matchAll(/<\/?(\w+)\/?>/g)].map((m) => m[0]).sort()
const tokens = (s: string) => [...s.matchAll(/\{yen~?:-?\d+\}/g)].map((m) => m[0]).sort()

describe('the catalogs of the screens in Korean and Traditional Chinese', () => {
  for (const [l, cat] of LANGS)
    it(`${l}: every Japanese key, its values, parts and amounts, and nothing of Japanese`, () => {
      expect(Object.keys(cat).sort()).toEqual(Object.keys(JA).sort())
      for (const k of Object.keys(JA) as (keyof typeof JA)[]) {
        expect(values(cat[k]), k).toEqual(values(JA[k]))
        expect(parts(cat[k]), k).toEqual(parts(JA[k]))
        expect(tokens(cat[k]), k).toEqual(tokens(EN[k]))
        expect(cat[k].trim(), k).not.toBe('')
        expect(untranslated(cat[k], l), `${k}: ${cat[k]}`).toEqual([])
      }
    })
})

describe('the pages of the languages', () => {
  it('Japanese and English need nothing fetched; Korean and Chinese words are not in the app until their page fetches them', async () => {
    await expect(loadLanguage('ja')).resolves.toBeUndefined()
    await expect(loadLanguage('en')).resolves.toBeUndefined()
    const app = ['index.ts', 'places.ts', 'statsEn.ts', 'changelog.ts'].map((f) => readFileSync(new URL(`./${f}`, import.meta.url), 'utf8')).join('\n')
    expect(app).not.toMatch(/from '\.\/(ko|zhTW|placesKo|placesZhTW|statsKo|statsZhTW|changelogKo|changelogZhTW)\.ts'/)
  })

  it('/ko is Korean, /zh-tw Traditional Chinese (any case); each language has its own page', () => {
    expect(['/ko/', '/ko', '/zh-tw/', '/zh-TW/', '/kor', '/zh/'].map(langFromPath)).toEqual(['ko', 'ko', 'zh-TW', 'zh-TW', 'ja', 'ja'])
    expect((['ja', 'en', 'ko', 'zh-TW'] as const).map(pathIn)).toEqual(['/', '/en/', '/ko/', '/zh-tw/'])
  })

  it('dates of the data and of the history, and amounts in won and Taiwan dollars', () => {
    setLang('ko')
    expect([dataDate('2026年5月末'), dataDate('2026年夏'), dataDate('2025年'), dayText('2026-10-23')]).toEqual(['2026년 5월 말', '2026년 여름', '2025년', '2026년 10월 23일'])
    expect(yen(1200)).toBe('1.09억 원')
    setLang('zh-TW')
    expect([dataDate('2026年5月末'), dataDate('2026年夏'), dataDate('2025年'), dayText('2026-10-23')]).toEqual(['2026年5月底', '2026年夏季', '2025年', '2026年10月23日'])
    expect(yen(1200)).toBe('NT$255萬')
  })
})

describe('the data’s names, the statistics and the history in Korean and Traditional Chinese', () => {
  for (const [l] of LANGS)
    it(`${l}: every place, ★, statistic, source and line of the history has its words, with nothing of Japanese`, () => {
      const w = placeWords(l)!
      for (const k of Object.keys(PLACE_EN)) expect(untranslated(w.place[k] ?? 'の', l), `place ${k}`).toEqual([])
      for (const n of Object.keys(STAR_EN).map(Number)) expect(untranslated(`${w.star[n]?.title ?? 'の'}${w.star[n]?.text ?? ''}`, l), `★${n}`).toEqual([])
      const s = statsWords(l)!
      for (const [id, e] of Object.entries(STAT_EN))
        for (const f of Object.keys(e) as (keyof typeof e)[]) expect(untranslated(String(s.stat[id]?.[f] ?? 'の'), l), `stat ${id}.${f}`).toEqual([])
      for (const [id, e] of Object.entries(SOURCE_EN))
        for (const f of Object.keys(e) as (keyof typeof e)[]) if (f !== 'original') expect(untranslated(String(s.source[id]?.[f] ?? 'の'), l), `source ${id}.${f}`).toEqual([])
      expect(Object.keys(CHANGES[l]).sort()).toEqual(CHANGELOG.flatMap((r) => r.changes).sort())
      setLang(l)
      for (const ja of CHANGELOG.flatMap((r) => r.changes)) expect(untranslated(changeText(ja), l), ja).toEqual([])
    })
})

// ---------------------------------------------------------------- the game's own texts

/** the least share of the lines and questions of real lives with nothing of Japanese left (as English's COVERAGE_MIN) */
const COVERAGE_MIN = 0.998

/** the lines and question texts of the lives of the English coverage test */
function shownTexts(): string[] {
  const sim = { params: defaultParams() }
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
  return shown
}

describe('the coverage of the Korean and Traditional Chinese catalogs of the game’s texts', () => {
  it('the lines of the record and the questions of real lives', async () => {
    const shown = shownTexts()
    const out: string[] = []
    for (const [l] of LANGS) {
      await loadGameTexts(l)
      setLang(l)
      const left = new Map<string, number>()
      let bad = 0
      for (const ja of shown) {
        if (!untranslated(gameText(ja), l).length) continue
        bad++
        const k = ja.replace(/\d[\d,.]*/g, '#')
        left.set(k, (left.get(k) ?? 0) + 1)
      }
      const share = 1 - bad / shown.length
      out.push(`${l}: ${shown.length} shown, ${(share * 100).toFixed(1)}% with nothing of Japanese\n` + [...left].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => `${String(n).padStart(5)}  ${k.slice(0, 140)}`).join('\n'))
      expect(share, l).toBeGreaterThanOrEqual(COVERAGE_MIN)
    }
    console.log(out.join('\n'))
  }, 120_000)
})

// ---------------------------------------------------------------- every screen of real lives

describe('every screen in Korean and Traditional Chinese', () => {
  it('lives of the four countries, from the title page to the share card: nothing of Japanese left', async () => {
    const { Intro } = await import('../ui/Intro.tsx')
    const { Cert } = await import('../ui/Cert.tsx')
    const { LifeScreen } = await import('../ui/LifeScreen.tsx')
    const { DecisionDialog } = await import('../ui/DecisionDialog.tsx')
    const { Ending } = await import('../ui/Ending.tsx')
    const { Result } = await import('../ui/Result.tsx')
    const { ShareDialog } = await import('../ui/ShareDialog.tsx')
    const { postText, shareText } = await import('../game/shareLink.ts')
    const { ProYears } = await import('../ui/ProPanels.tsx')
    const { RecordsPanel } = await import('../ui/Records.tsx')
    const { PotentialPanel, PotentialRetro } = await import('../ui/PotentialPanels.tsx')
    const { StatsPage } = await import('../ui/StatsPage.tsx')
    const { InfoPageView } = await import('../ui/InfoPages.tsx')
    const { lifeTitle } = await import('../engine/summary.ts')
    const sim = { params: defaultParams() }
    // (kept as they are: the Google Form's own choices, the sources' original titles, the switch naming each language in itself)
    const keep = [...FEEDBACK_CATEGORIES, ...(Array.isArray(SOURCES) ? SOURCES : Object.values(SOURCES)).map((s) => s.title)].sort((a, b) => b.length - a.length)
    const pieces = (html: string, l: L) => {
      let h = html.replace(/<a[^>]*\bhrefLang="[^"]*"[^>]*>[^<]*<\/a>/g, '')
      for (const k of keep) h = h.split(k).join('')
      const texts = [...h.replace(/<[^>]+>/g, '\n').split('\n'), ...[...h.matchAll(/\b(?:title|aria-label|alt|placeholder)="([^"]*)"/g)].map((m) => m[1])]
      return texts.map((x) => x.trim()).filter((x) => untranslated(x, l).length)
    }
    const settings = { pace: 'p15' as const, prefecture: -1, theme: 'light' as const, mode: 'normal' as const, stars: 1 }
    for (const [l] of LANGS) {
      await loadGameTexts(l)
      setLang(l)
      const left = new Set<string>()
      const note = (html: string) => pieces(html, l).forEach((x) => left.add(x))
      note(renderToStaticMarkup(<Intro settings={settings} onSettings={() => {}} onStart={() => {}} resume={null} onResume={() => {}} onDiscard={() => {}} past={[]} onTheme={() => {}} />))
      note(renderToStaticMarkup(<StatsPage onBack={() => {}} />))
      for (const p of INFO_PAGES) note(renderToStaticMarkup(<InfoPageView page={p.id} onBack={() => {}} />))
      for (const country of ['JP', 'US', 'KR', 'CU'] as const)
        for (let i = 0; i < 6; i++) {
          const s = createLife({ seed: 60_000 + 113 * i + country.charCodeAt(0), country, pace: 'p15', mode: i % 2 ? 'potential' : 'normal', stars: 3 + i })
          note(renderToStaticMarkup(<Cert life={s} onBegin={() => {}} onCancel={() => {}} />))
          for (let g = 0; g < 130 && s.alive; g++) {
            const plan = planYear(s, sim)
            for (const e of plan.events) s.log.push(e.entry)
            let d = plan.decision?.decision
            while (d && s.alive) {
              if (g % 3 === 0) note(renderToStaticMarkup(<DecisionDialog life={s} decision={d} onChoose={() => {}} onMinimize={() => {}} onAutoAll={() => {}} />))
              const r = resolveDecision(s, d.autoIndex, sim)
              for (const e of r.events) s.log.push(e.entry)
              d = r.followUp?.decision
            }
            endYear(s)
            if (g % 6 === 0) {
              note(renderToStaticMarkup(<LifeScreen life={{ ...s, log: s.log.slice(-40) }} sim={sim} cohort={null} cohortProgress={0} onDeath={() => {}} onQuit={() => {}} onTheme={() => {}} />))
              note(renderToStaticMarkup(<ProYears life={s} />) + renderToStaticMarkup(<RecordsPanel life={s} />) + renderToStaticMarkup(<PotentialPanel life={s} />))
            }
          }
          const title = gameText(lifeTitle(s))
          note(renderToStaticMarkup(<Ending life={s} onDone={() => {}} />))
          note(renderToStaticMarkup(<Result life={s} cohort={null} cohortProgress={0} onAgain={() => {}} onTop={() => {}} />))
          note(renderToStaticMarkup(<PotentialRetro life={s} />))
          note(renderToStaticMarkup(<ShareDialog life={s} title={title} rarityText={t('res.oneIn', { n: '2,500' })} onClose={() => {}} />))
          note([postText(s, title, null, 'https://example.invalid/'), shareText(s, title, null, 'https://example.invalid/')].join('\n'))
        }
      expect([...left].slice(0, 30), l).toEqual([])
    }
  }, 600_000)
})
