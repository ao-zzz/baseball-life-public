import { afterEach, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { JA } from './ja.ts'
import { EN } from './en.ts'
import { PUBLIC_LANGS, dataDate, dayText, langFromPath, setLang, t } from './index.ts'
import { Rich } from './Rich.tsx'
import { Intro } from '../ui/Intro.tsx'
import { CounterLine } from '../ui/LifeCounter.tsx'
import { VersionInfo } from '../ui/VersionInfo.tsx'
import { STATS } from '../data/stats.ts'
import { KindBadge } from '../ui/common.tsx'
import { StarPick } from '../ui/StarPick.tsx'
import { Roll } from '../ui/Roll.tsx'
import { Cert } from '../ui/Cert.tsx'
import { COUNTRY_INFO, COUNTRY_ORDER, countryTitle } from '../engine/countries/index.ts'
import { STAR_INFO } from '../data/potentialStars.ts'
import { createLife } from '../engine/life.ts'
import { PLACE_EN, STAR_EN, countryChoice, countryName, placeName, regionName, regionWord, starInfo } from './places.ts'
import type { CohortResult } from '../engine/cohort.ts'

// The texts of the screens in other languages (the multilingual work, step 1): every Japanese text has its English one with the same
// values and parts, no Japanese is left in English, and the pages read their language from the path. The Japanese screens themselves
// are guarded by src/test/golden.

const JAPANESE = /[ぁ-んァ-ヶ一-龠々〆〇ー]/
/** the pieces of text of a page that still have Japanese in them */
const leftJapanese = (html: string) => [...html.replace(/<[^>]+>/g, '\n').split('\n')].map((x) => x.trim()).filter((x) => JAPANESE.test(x))
const values = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
const parts = (s: string) => [...s.matchAll(/<\/?(\w+)\/?>/g)].map((m) => m[0]).sort()

afterEach(() => setLang('ja'))

describe('the catalogs', () => {
  it('English has every Japanese key, and no other', () => {
    expect(Object.keys(EN).sort()).toEqual(Object.keys(JA).sort())
  })

  it('each English text has the values and the parts of its Japanese one, and no Japanese', () => {
    for (const k of Object.keys(JA) as (keyof typeof JA)[]) {
      expect(values(EN[k]), k).toEqual(values(JA[k]))
      expect(parts(EN[k]), k).toEqual(parts(JA[k]))
      expect(JAPANESE.test(EN[k]), `${k}: ${EN[k]}`).toBe(false)
      expect(EN[k].trim(), k).not.toBe('')
    }
  })

  it('Japanese, English (1.3.0), Korean and Traditional Chinese (1.5.0) are offered; the title page links to the others', () => {
    expect(PUBLIC_LANGS).toEqual(['ja', 'en', 'ko', 'zh-TW'])
    const settings = { pace: 'p15' as const, prefecture: -1, theme: 'light' as const, mode: 'normal' as const, stars: 1 }
    const page = () => renderToStaticMarkup(<Intro settings={settings} onSettings={() => {}} onStart={() => {}} resume={null} onResume={() => {}} onDiscard={() => {}} past={[]} onTheme={() => {}} />)
    const link = (href: string, l: string, name: string) => `<a class="btn sm" href="${href}" lang="${l}" hrefLang="${l}">${name}</a>`
    const ja = link('/', 'ja', '日本語')
    const others = [link('/en/', 'en', 'English'), link('/ko/', 'ko', '한국어'), link('/zh-tw/', 'zh-TW', '繁體中文')]
    for (const x of others) expect(page()).toContain(x)
    expect(page()).not.toContain(ja)
    setLang('en')
    expect(page()).toContain(ja)
    expect(page()).not.toContain(others[0])
  })
})

describe('the language of a page', () => {
  it('is English under /en, Japanese elsewhere', () => {
    expect(langFromPath('/en/')).toBe('en')
    expect(langFromPath('/en')).toBe('en')
    expect(langFromPath('/')).toBe('ja')
    expect(langFromPath('/enter')).toBe('ja')
    expect(langFromPath('/ja/')).toBe('ja')
  })

  it('t: values put in; Japanese by default; English when set', () => {
    expect(t('intro.resume.who', { pref: '大阪府', age: 30, name: '山田 太郎' })).toBe('大阪府・30歳の山田 太郎')
    setLang('en')
    expect(t('intro.resume.who', { pref: 'Osaka', age: 30, name: 'Taro Yamada' })).toBe('Taro Yamada, 30, Osaka')
  })

  it('dates of the data and of the history in English', () => {
    setLang('en')
    expect(dataDate('2026年5月末')).toBe('end of May 2026')
    expect(dataDate('2025年')).toBe('2025')
    expect(dataDate('2026年夏')).toBe('summer 2026')
    expect(dataDate('2021〜2025年')).toBe('2021〜2025年')
    expect(dayText('2026-10-23')).toBe('October 23, 2026')
    setLang('ja')
    expect(dataDate('2026年5月末')).toBe('2026年5月末')
    expect(dayText('2026-10-23')).toBe('2026年10月23日')
  })
})

describe('Rich', () => {
  it('draws the parts as the screen\'s elements, in the order of the language', () => {
    expect(renderToStaticMarkup(<Rich k="intro.hero" tags={{ br: <br />, em: <em /> }} />)).toBe('12万<br/>分の<em>1</em>')
    setLang('en')
    expect(renderToStaticMarkup(<Rich k="intro.hero" tags={{ br: <br />, em: <em /> }} />)).toBe('<em>1</em> in <br/>120,000')
  })
})

describe('the title page in English', () => {
  const settings = { pace: 'p15' as const, prefecture: -1, theme: 'light' as const, mode: 'normal' as const, stars: 1 }
  const page = () => renderToStaticMarkup(<Intro settings={settings} onSettings={() => {}} onStart={() => {}} resume={null} onResume={() => {}} onDiscard={() => {}} past={[]} onTheme={() => {}} />)

  it('has the English texts of this batch', () => {
    setLang('en')
    const html = page()
    for (const k of ['intro.lede', 'intro.funnel', 'intro.start', 'intro.about', 'mode.normal', 'pace.p15'] as const) expect(html).toContain(EN[k].replace(/&/g, '&amp;').replace(/'/g, '&#x27;').replace(/"/g, '&quot;'))
    expect(html).toContain('124,116')
    expect(html).toContain('end of May 2026')
    expect(html).toContain('Update history')
    expect(html).toContain('href="#stats">Statistics &amp; sources</a>')
  })

  it('no Japanese is left on it, the update history included (src/i18n/changelog.ts)', () => {
    setLang('en')
    // (the switch names each language in itself: 日本語, 繁體中文…: PUBLIC_LANGS)
    const html = page().replace(/<a[^>]*\bhrefLang="[^"]*"[^>]*>[^<]*<\/a>/g, '')
    expect(leftJapanese(html)).toEqual([])
    expect([...html.matchAll(/\btitle="([^"]*)"/g)].map((m) => m[1]).filter((x) => JAPANESE.test(x))).toEqual([])
    expect(html).toContain('Place of birth (prefecture)')
    expect(html).toContain('>United States (beta)</option>')
    expect(html).toContain('>Osaka</option>')
  })

  it('every line of the update history has its English; in Japanese the history is the data as it is', async () => {
    const { CHANGELOG } = await import('../data/changelog.ts')
    const { CHANGES, changeText } = await import('./changelog.ts')
    const lines = CHANGELOG.flatMap((r) => r.changes)
    for (const ja of lines) expect(CHANGES.en[ja], `no English for 「${ja}」`).toBeTruthy()
    // (no English line is left over from a Japanese one changed since)
    expect(Object.keys(CHANGES.en).filter((ja) => !lines.includes(ja))).toEqual([])
    for (const ja of lines) expect(changeText(ja)).toBe(ja)
    setLang('en')
    for (const ja of lines) expect(JAPANESE.test(changeText(ja))).toBe(false)
  })

  it('the counter line and the badges in English', () => {
    setLang('en')
    expect(renderToStaticMarkup(<CounterLine state={{ status: 'ok', total: 12345 }} />)).toContain('<b class="num">12,345</b> baseball lives have begun so far.')
    expect(renderToStaticMarkup(<KindBadge stat={STATS.jpHsComplete} />)).toContain('Measured')
    expect(renderToStaticMarkup(<VersionInfo />)).toContain(' — update history')
  })
})

describe('batch 2: countries, places and the screens before the life', () => {
  it('every place of birth of every playable country has its English name; every ★ its English words', () => {
    for (const c of COUNTRY_ORDER.filter((x) => COUNTRY_INFO[x].implemented))
      for (const name of COUNTRY_INFO[c].regions) {
        expect(PLACE_EN[name], `${c} ${name}`).toBeTruthy()
        expect(JAPANESE.test(PLACE_EN[name]), `${c} ${name}: ${PLACE_EN[name]}`).toBe(false)
      }
    for (let n = 1; n <= 10; n++) {
      expect(STAR_EN[n]?.title, `★${n}`).toBeTruthy()
      expect(JAPANESE.test(STAR_EN[n].title + STAR_EN[n].text), `★${n}`).toBe(false)
    }
  })

  it('in Japanese the names are the data as they are', () => {
    for (const c of COUNTRY_ORDER) {
      expect(countryName(c)).toBe(COUNTRY_INFO[c].label)
      expect(countryChoice(c)).toBe(countryTitle(c))
      expect(regionWord(c)).toBe(COUNTRY_INFO[c].regionLabel)
      COUNTRY_INFO[c].regions.forEach((name, i) => {
        expect(placeName(name)).toBe(name)
        expect(regionName(c, i)).toBe(name)
      })
    }
    for (let n = 1; n <= 10; n++) expect(starInfo(n)).toBe(STAR_INFO[n])
  })

  it('in English: the choice of ★, the roll of the place and the birth certificate', () => {
    setLang('en')
    const star = renderToStaticMarkup(<StarPick stars={10} onStars={() => {}} onBegin={() => {}} onBack={() => {}} />)
    expect(leftJapanese(star)).toEqual([])
    expect(star).toContain('Be born with ★10')
    expect(star).toContain('about 31%')
    const roll = renderToStaticMarkup(<Roll target={26} onDone={() => {}} country="JP" />)
    expect(leftJapanese(roll)).toEqual([])
    expect(roll).toContain('Choosing the prefecture of birth')
    for (const country of ['JP', 'US', 'KR', 'CU'] as const) {
      const life = createLife({ seed: 1234, country, pace: 'p15', mode: 'potential', stars: 7 })
      const html = renderToStaticMarkup(<Cert life={life} onBegin={() => {}} onCancel={() => {}} />).replace(/title="[^"]*"/g, '')
      // what is left: his name (a Japanese life's is in kanji; romanised in a later batch) and the publishers of the sources (data)
      const left = leftJapanese(html).filter((x) => x !== life.person.family + ' ' + life.person.given && x !== `${life.person.family} ${life.person.given}` && !x.startsWith('Source: '))
      expect(left, country).toEqual([])
      expect(html, country).toContain('Begin this life')
      expect(html, country).toContain(`Life expectancy (men in ${countryName(country)})`)
    }
  })
})

describe('batch 3: the life screen\'s frame in English', () => {
  const FRAME = /^(life|live|focus|role|post|work|univClub|map|curve|panel|dec|money)\./
  it('the frame shows its English texts, and none of the Japanese ones moved into the catalog', async () => {
    const { LifeScreen } = await import('../ui/LifeScreen.tsx')
    const { DecisionDialog } = await import('../ui/DecisionDialog.tsx')
    const { endYear, planYear, resolveDecision } = await import('../engine/life.ts')
    const { defaultParams } = await import('../engine/params.ts')
    setLang('en')
    const sim = { params: defaultParams() }
    for (const country of ['JP', 'US', 'KR', 'CU'] as const) {
      const s = createLife({ seed: 4321, country, pace: 'p15', mode: 'potential', stars: 9 })
      let question: import('../engine/types.ts').Decision | undefined
      for (let g = 0; g < 30 && s.alive; g++) {
        const plan = planYear(s, sim)
        for (const e of plan.events) s.log.push(e.entry)
        let d = plan.decision?.decision
        while (d && s.alive) {
          question ??= d
          const r = resolveDecision(s, d.autoIndex, sim)
          for (const e of r.events) s.log.push(e.entry)
          d = r.followUp?.decision
        }
        endYear(s)
      }
      // (the record's lines are the game's words, out of this batch: drawn without them)
      const html = renderToStaticMarkup(<LifeScreen life={{ ...s, log: [] }} sim={sim} cohort={null} cohortProgress={0} onDeath={() => {}} onQuit={() => {}} onTheme={() => {}} />)
      const dialog = question ? renderToStaticMarkup(<DecisionDialog life={s} decision={question} onChoose={() => {}} onMinimize={() => {}} onAutoAll={() => {}} />) : ''
      // each label of the frame is a piece of text of its own: none of them is left as its Japanese text (the game's own words,
      // in the same pieces or elsewhere, are out of this batch)
      // (the insides of the panels left for a later batch: the pro seasons table, the record panel and the gifts panel)
      const frame = html.replace(/<(section|div)[^>]*class="[^"]*\b(proyears|recpanel|potpanel)\b[\s\S]*?<\/(table|dl)>/g, '')
      // (and the game's names of the skills, which are the game's words: 守備 is a skill there)
      const { SKILL_LABEL } = await import('../engine/ability.ts')
      const skills = new Set<string>(Object.values(SKILL_LABEL))
      const pieces = new Set([...leftJapanese(frame), ...leftJapanese(dialog)].filter((x) => !skills.has(x)))
      for (const k of Object.keys(JA) as (keyof typeof JA)[]) {
        if (!FRAME.test(k) || /\{/.test(JA[k])) continue
        expect(pieces.has(JA[k].trim()), `${country}: ${k} 「${JA[k]}」 left in Japanese`).toBe(false)
      }
      for (const text of ['Pause', 'Speed', 'Auto', 'Leave', 'Condition', 'This year’s focus', 'Life record', 'Savings', 'Family &amp; home', 'Life map', 'Baseball survival curve'])
        expect(html, `${country}: ${text}`).toContain(text)
      if (question) expect(dialog).toContain('Decide later ▾')
    }
  }, 60_000)
})

describe('batch 4: ending, result and share in English', () => {
  const BATCH4 = /^(end|res|share)\./
  const cohort: CohortResult = {
    nRarity: 20000,
    atLeast: [20000, 19000, 15000, 9000, 3000, 800, 120, 40, 9, 3, 0],
    nFull: 2000,
    medians: { lifespan: 81, yearsPlaying: 9, lifetimeIncome: 23456, happiness: 61 },
    playingByAge: Array.from({ length: 120 }, (_, a) => (a < 6 ? 0 : Math.max(0, 0.9 - a * 0.02))),
    aliveByAge: Array.from({ length: 120 }, (_, a) => Math.max(0, 1 - a / 110)),
    rankHist: new Array(11).fill(1),
  }

  it('the last scene, the record and the share show their English texts, and none of the Japanese ones', async () => {
    const { Ending } = await import('../ui/Ending.tsx')
    const { Result } = await import('../ui/Result.tsx')
    const { ShareDialog } = await import('../ui/ShareDialog.tsx')
    const { postText, shareHighlights, shareText } = await import('../game/shareLink.ts')
    const { endYear, planYear, resolveDecision } = await import('../engine/life.ts')
    const { defaultParams } = await import('../engine/params.ts')
    const { lifeTitle } = await import('../engine/summary.ts')
    const { HOME_LABEL } = await import('../engine/after.ts')
    const { ladderOf } = await import('../engine/ladder.ts')
    const sim = { params: defaultParams() }
    setLang('en')
    for (const country of ['JP', 'US', 'KR', 'CU'] as const) {
      for (const mode of ['normal', 'potential'] as const) {
        const s = createLife({ seed: 2468, country, pace: 'p15', mode, stars: 9 })
        for (let g = 0; g < 130 && s.alive; g++) {
          const plan = planYear(s, sim)
          for (const e of plan.events) s.log.push(e.entry)
          let d = plan.decision?.decision
          while (d && s.alive) {
            const r = resolveDecision(s, d.autoIndex, sim)
            for (const e of r.events) s.log.push(e.entry)
            d = r.followUp?.decision
          }
          endYear(s)
        }
        const tag = `${country} ${mode}`
        expect(s.alive, tag).toBe(false)
        const title = lifeTitle(s)
        const url = 'https://example.invalid/en/'
        const ending = renderToStaticMarkup(<Ending life={s} onDone={() => {}} />)
        // (without the panels of later batches: the gifts in retrospect, the records and the pro seasons)
        const result = [null, cohort]
          .map((c) => renderToStaticMarkup(<Result life={s} cohort={c} cohortProgress={0.5} onAgain={() => {}} onTop={() => {}} />))
          .join('')
          .replace(/<div class="ro ro-retro">[\s\S]*?(?=<div class="two">)/g, '')
          .replace(/<div class="ro ro-records">[\s\S]*?(?=<[^>]*ro-log)/g, '')
          .replace(/<div class="ro ro-years">[\s\S]*?(?=<section class="panel ro ro-again")/g, '')
        const dialog = renderToStaticMarkup(<ShareDialog life={s} title={title} rarityText="about 1 in 2,500" onClose={() => {}} />)
        const texts = [...shareHighlights(s), ...postText(s, title, 'about 1 in 2,500', url).split('\n'), ...shareText(s, title, null, url).split('\n')]
        // (the game's words that may be a piece of their own: the home, the stages)
        const game = new Set<string>([...Object.values(HOME_LABEL), ...ladderOf(country).map((r) => r.short)])
        const pieces = new Set([...leftJapanese(ending + result + dialog), ...texts.map((x) => x.trim())].filter((x) => !game.has(x)))
        for (const k of Object.keys(JA) as (keyof typeof JA)[]) {
          if (!BATCH4.test(k) || /\{/.test(JA[k])) continue
          expect(pieces.has(JA[k].trim()), `${tag}: ${k} 「${JA[k]}」 left in Japanese`).toBe(false)
        }
        expect(ending, tag).toContain('Skip')
        expect(ending, tag).toContain(': the last year')
        for (const text of ['Cause of death', 'Highest level', 'Lifetime income', 'Money left', 'How often a life gets this far', 'Be born again', 'Watch the final scene again', 'median '])
          expect(result, `${tag}: ${text}`).toContain(text)
        expect(result, tag).toContain('fewer than')
        for (const text of ['Share this life', 'Copy text and link', 'Save image']) expect(dialog, `${tag}: ${text}`).toContain(text)
        expect(postText(s, title, null, url), tag).toContain(`${country === 'JP' ? '【1 in 120,000】' : '【A Baseball Life】'}`)
        expect(postText(s, title, null, url), tag).toContain(' (fictional): a baseball life\nA life of ')
        expect(shareText(s, title, 'about 1 in 2,500', url), tag).toContain('Lives that get this far: about 1 in 2,500 (simulations under the same conditions; model estimate)\nHow far will you get?')
        expect(shareText(s, title, null, url), tag).toContain(`Born in ${placeName(COUNTRY_INFO[country].regions[s.person.prefecture])}. `)
      }
    }
  }, 60_000)

  it('a place abroad is named by its country', () => {
    setLang('en')
    expect(placeName('アメリカ')).toBe('the United States')
    expect(placeName('キューバ')).toBe('Cuba')
    expect(placeName('東京都')).toBe('Tokyo')
    setLang('ja')
    expect(placeName('アメリカ')).toBe('アメリカ')
  })
})

describe('batch 5: panels and stop screens in English', () => {
  const BATCH5 = /^(col|lv|pro|stop|draft|rec|pot|retro)\./

  it('the pro seasons, the record, the gifts, the look back and the stop screens show their English texts, and none of the Japanese ones', async () => {
    const { ProYears, StopDialog } = await import('../ui/ProPanels.tsx')
    const { RecordsPanel } = await import('../ui/Records.tsx')
    const { PotentialPanel, PotentialRetro } = await import('../ui/PotentialPanels.tsx')
    const { endYear, planYear, resolveDecision } = await import('../engine/life.ts')
    const { defaultParams } = await import('../engine/params.ts')
    type Life = import('../engine/types.ts').LifeState
    type Entry = import('../engine/types.ts').LogEntry
    const sim = { params: defaultParams() }
    // the pieces of text of a page and its titles and labels
    const piecesOf = (html: string) => [...leftJapanese(html), ...[...html.matchAll(/\b(?:title|aria-label)="([^"]*)"/g)].map((m) => m[1].trim())]
    setLang('en')
    // lives that reach the pros (★10: a Japanese one drafted, one in MLB, a pitcher), and an ordinary one of each country
    const lives = [
      { country: 'JP', seed: 2, mode: 'potential' },
      { country: 'JP', seed: 3, mode: 'potential' },
      { country: 'JP', seed: 1, mode: 'normal' },
      { country: 'US', seed: 3, mode: 'potential' },
      { country: 'US', seed: 1, mode: 'normal' },
      { country: 'KR', seed: 2, mode: 'potential' },
      { country: 'KR', seed: 1, mode: 'normal' },
      { country: 'CU', seed: 3, mode: 'potential' },
      { country: 'CU', seed: 1, mode: 'normal' },
    ] as const
    const seen = { pro: 0, mlb: 0, draft: 0, quit: 0, pot: 0, retro: 0 }
    for (const { country, seed, mode } of lives) {
      const tag = `${country} ${mode} #${seed}`
      const s = createLife({ seed, country, pace: 'p15', mode, stars: 10 })
      let html = ''
      const stops = (entries: Entry[], at: Life) => {
        for (const entry of entries) {
          if (!entry.stop) continue
          seen[entry.stop]++
          const one = (life: Life) => renderToStaticMarkup(<StopDialog life={life} stop={{ kind: entry.stop!, entry }} onGoOn={() => {}} />)
          html += one(at)
          if (entry.stop === 'draft' && at.career.draft) for (const status of ['declined', 'drafted'] as const) html += one({ ...at, career: { ...at.career, draft: { ...at.career.draft, status } } })
          // (the line he stopped on is the game's words)
          html = html.replace(entry.text, '')
        }
      }
      for (let g = 0; g < 130 && s.alive; g++) {
        const plan = planYear(s, sim)
        for (const e of plan.events) s.log.push(e.entry)
        stops(plan.events.map((e) => e.entry), s)
        let d = plan.decision?.decision
        while (d && s.alive) {
          const r = resolveDecision(s, d.autoIndex, sim)
          for (const e of r.events) s.log.push(e.entry)
          stops(r.events.map((e) => e.entry), s)
          d = r.followUp?.decision
        }
        endYear(s)
        if (g % 3 === 0 || !s.alive) {
          const pot = renderToStaticMarkup(<PotentialPanel life={s} />)
          if (pot) seen.pot++
          html += renderToStaticMarkup(<ProYears life={s} />) + renderToStaticMarkup(<RecordsPanel life={s} />) + pot
        }
      }
      const retro = renderToStaticMarkup(<PotentialRetro life={s} />)
      if (retro) seen.retro++
      html += renderToStaticMarkup(<ProYears life={s} fold />) + renderToStaticMarkup(<RecordsPanel life={s} tournaments={6} />) + retro
      const pro = renderToStaticMarkup(<ProYears life={s} />)
      if (pro) seen.pro++
      if (pro.includes('MLB stats')) seen.mlb++
      const pieces = new Set(piecesOf(html))
      for (const k of Object.keys(JA) as (keyof typeof JA)[]) {
        if (!BATCH5.test(k) || /\{/.test(JA[k])) continue
        expect(pieces.has(JA[k].trim()), `${tag}: ${k} 「${JA[k]}」 left in Japanese`).toBe(false)
      }
      if (pro) for (const text of ['Pro seasons year by year', '>Age<', '>G<', '>Salary<', '>Career<']) expect(pro, `${tag}: ${text}`).toContain(text)
      if (html.includes('recpanel')) expect(html, tag).toContain('<small>Official</small>')
      if (mode === 'potential') for (const text of ['Baseball gifts', 'Growth now', 'Gifts and growth in retrospect', 'Where he got to']) expect(html, `${tag}: ${text}`).toContain(text)
    }
    expect(seen.pro).toBeGreaterThanOrEqual(4)
    expect(seen.mlb).toBeGreaterThan(0)
    expect(seen.draft).toBeGreaterThan(0)
    expect(seen.quit).toBeGreaterThan(0)
  }, 60_000)

  it('the draft card and the end of baseball in English', async () => {
    const { StopDialog } = await import('../ui/ProPanels.tsx')
    setLang('en')
    const life = createLife({ seed: 1, country: 'JP', pace: 'p15', mode: 'normal', stars: 1 })
    life.career.draft = { age: 18, year: 2044, from: '高校', team: 'チーム', kind: 'ikusei', round: 2, pickInRound: 1, overall: 80, clubOrder: 9, bonus: 300, incentive: 0, salary: 400, status: 'signed', number: 121, reason: '理由', ability: 31 }
    const draft = renderToStaticMarkup(<StopDialog life={life} stop={{ kind: 'draft', entry: { age: 18, year: 2044, kind: 'big', text: '' } }} onGoOn={() => {}} />)
    for (const text of ['Drafted by チーム in development round 2', 'Development (from high school)', 'Development round 2 (80 overall)', 'Preparation money', '$20,000', 'Sign and join'])
      expect(draft, text).toContain(text)
    const quit = renderToStaticMarkup(<StopDialog life={life} stop={{ kind: 'quit', entry: { age: 22, year: 2048, kind: 'bad', text: '' } }} onGoOn={() => {}} />)
    expect(leftJapanese(quit)).toEqual([])
    expect(quit).toContain('Leave baseball and go on with life')
  })
})

describe('batch 6: statistics and legal pages in English', () => {
  const keys = Object.keys(JA) as (keyof typeof JA)[]
  const BATCH6 = keys.slice(keys.indexOf('source.line'))
  const titles = (html: string) => [...html.matchAll(/\b(?:title|aria-label|alt|placeholder)="([^"]*)"/g)].map((m) => m[1])

  it('every statistic and every source has its English words, with no Japanese but the original titles', async () => {
    const { SOURCES } = await import('../data/sources.ts')
    const { STAT_EN, SOURCE_EN, UNIT_EN } = await import('./statsEn.ts')
    expect(Object.keys(STAT_EN).sort()).toEqual(Object.keys(STATS).sort())
    expect(Object.keys(SOURCE_EN).sort()).toEqual(Object.keys(SOURCES).sort())
    for (const s of Object.values(STATS)) {
      const e = STAT_EN[s.id]
      for (const f of ['population', 'definition', 'asOf'] as const) expect(e[f]?.trim(), `${s.id}.${f}`).toBeTruthy()
      // the same fields as the Japanese, and none in Japanese
      expect(e.verifyNote === undefined, `${s.id}.verifyNote`).toBe(s.verifyNote === undefined)
      expect(e.note === undefined, `${s.id}.note`).toBe(s.note === undefined)
      expect(JAPANESE.test(Object.values(e).join(' ')), `${s.id}: ${JSON.stringify(e)}`).toBe(false)
      expect(UNIT_EN[s.unit], `unit ${s.unit}`).toBeTruthy()
      expect(JAPANESE.test(UNIT_EN[s.unit]), s.unit).toBe(false)
    }
    for (const src of Object.values(SOURCES)) {
      const { original, ...e } = SOURCE_EN[src.id]
      expect(e.title.trim() && e.publisher.trim(), src.id).toBeTruthy()
      expect(e.checkNote === undefined, `${src.id}.checkNote`).toBe(src.checkNote === undefined)
      expect(JAPANESE.test(Object.values(e).join(' ')), `${src.id}: ${JSON.stringify(e)}`).toBe(false)
      // the original title is the source's own, as the data write it
      if (original !== undefined) expect(original, src.id).toBe(src.title)
    }
  })

  it('in Japanese the statistics and the sources are the data as they are', async () => {
    const { SOURCES } = await import('../data/sources.ts')
    const { statAsOfShort, statText, sourceText } = await import('./statsEn.ts')
    for (const s of Object.values(STATS)) {
      expect(statText(s)).toEqual({ population: s.population, definition: s.definition, asOf: s.asOf, verifyNote: s.verifyNote, note: s.note, unit: s.unit })
      expect(statAsOfShort(s)).toBe(s.asOf.slice(0, 7))
    }
    for (const src of Object.values(SOURCES)) expect(sourceText(src)).toEqual({ title: src.title, publisher: src.publisher, checkNote: src.checkNote })
  })

  it('the statistics page and the four pages at the foot: only the original titles and the form\'s own choices are left in Japanese', async () => {
    const { StatsPage } = await import('../ui/StatsPage.tsx')
    const { InfoPageView } = await import('../ui/InfoPages.tsx')
    const { INFO_PAGES, FEEDBACK_CATEGORIES } = await import('../data/site.ts')
    const { SOURCE_EN } = await import('./statsEn.ts')
    setLang('en')
    const originals = [...new Set(Object.values(SOURCE_EN).flatMap((e) => (e.original ? [e.original] : [])))]
    const stats = renderToStaticMarkup(<StatsPage onBack={() => {}} />)
    // each piece left in Japanese is English with original titles in parentheses; all of them are there, and nothing else
    const found = new Set<string>()
    for (const piece of leftJapanese(stats)) {
      let rest = piece
      for (const o of originals)
        if (rest.includes(`(${o})`)) {
          found.add(o)
          rest = rest.split(`(${o})`).join('')
        }
      expect(JAPANESE.test(rest), piece).toBe(false)
    }
    expect([...found].sort()).toEqual([...originals].sort())
    expect(titles(stats).filter((x) => JAPANESE.test(x))).toEqual([])
    for (const text of ['← Back', 'Statistics &amp; sources', 'Data on real schools', 'Parameters', 'Checking the model', 'List of sources', 'Japan High School Baseball Federation, “Statistics on member schools and club members (hardball) (加盟校数・部員数統計（硬式）)”', '>The University of Tokyo: '])
      expect(stats, text).toContain(text)
    const pages = INFO_PAGES.map((p) => renderToStaticMarkup(<InfoPageView page={p.id} onBack={() => {}} />))
    for (const [i, html] of pages.entries()) {
      // the feedback form's choices are the Google form's own (bilingual, never translated)
      expect(leftJapanese(html), INFO_PAGES[i].id).toEqual(INFO_PAGES[i].id === 'feedback' ? [...FEEDBACK_CATEGORIES] : [])
      expect(titles(html).filter((x) => JAPANESE.test(x))).toEqual([])
      expect(html).toContain('>Back</button>')
      expect(html).toContain('Legal notice (Specified Commercial Transactions Act)</a>')
    }
    expect(pages.join('')).toContain('Notice under Japan’s Act on Specified Commercial Transactions')
    expect(pages.join('')).toContain('(not set)')
    const pieces = new Set([...leftJapanese(stats), ...pages.flatMap(leftJapanese)])
    for (const k of BATCH6) {
      if (/\{/.test(JA[k])) continue
      expect(pieces.has(JA[k].trim()), `${k} 「${JA[k]}」 left in Japanese`).toBe(false)
    }
  })

  it('the lines of the statistics under the record and in the panel of the life screen', async () => {
    const { FactBox, SourceLine } = await import('../ui/common.tsx')
    const { LifeScreen } = await import('../ui/LifeScreen.tsx')
    const { endYear, planYear, resolveDecision } = await import('../engine/life.ts')
    const { defaultParams } = await import('../engine/params.ts')
    setLang('en')
    for (const id of Object.keys(STATS)) {
      const html = renderToStaticMarkup(<SourceLine ids={[id]} />) + renderToStaticMarkup(<FactBox text="t" ids={[id]} />)
      expect(leftJapanese(html), id).toEqual([])
      expect(titles(html).filter((x) => JAPANESE.test(x)), id).toEqual([])
    }
    expect(renderToStaticMarkup(<SourceLine ids={['jpHsPlayers']} />)).toContain(
      'Hardball baseball club members at member schools of the Japan High School Baseball Federation: Total club members of all grades',
    )
    const sim = { params: defaultParams() }
    const s = createLife({ seed: 1, country: 'JP', pace: 'p15', mode: 'normal', stars: 1 })
    for (let g = 0; g < 40 && s.alive; g++) {
      const plan = planYear(s, sim)
      for (const e of plan.events) s.log.push(e.entry)
      let d = plan.decision?.decision
      while (d && s.alive) {
        const r = resolveDecision(s, d.autoIndex, sim)
        for (const e of r.events) s.log.push(e.entry)
        d = r.followUp?.decision
      }
      endYear(s)
    }
    const html = renderToStaticMarkup(<LifeScreen life={s} sim={sim} cohort={null} cohortProgress={0} onDeath={() => {}} onQuit={() => {}} onTheme={() => {}} />)
    const panel = /<h3>Statistics in this life<\/h3>[\s\S]*?<\/section>/.exec(html)?.[0] ?? ''
    expect(panel).not.toBe('')
    expect(leftJapanese(panel)).toEqual([])
    expect(panel).toMatch(/<span class="a">(\d{4}(–\d{4})?|-)<\/span>/)
  }, 60_000)
})

describe('the statistics lines of the result screen in English (with the English of src/i18n/statsEn.ts)', () => {
  it('who is counted and what is counted are in English; in Japanese they are the data as they are', async () => {
    const { Result } = await import('../ui/Result.tsx')
    const { endYear, planYear, resolveDecision } = await import('../engine/life.ts')
    const { defaultParams } = await import('../engine/params.ts')
    const sim = { params: defaultParams() }
    let checked = 0
    for (let i = 0; i < 6; i++) {
      const s = createLife({ seed: 7000 + i, country: 'JP', pace: 'p15', ...(i % 2 ? { mode: 'potential' as const, stars: 10 } : {}) })
      for (let g = 0; g < 130 && s.alive; g++) {
        const plan = planYear(s, sim)
        for (const e of plan.events) s.log.push(e.entry)
        let d = plan.decision?.decision
        while (d && s.alive) {
          const r = resolveDecision(s, d.autoIndex, sim)
          for (const e of r.events) s.log.push(e.entry)
          d = r.followUp?.decision
        }
        endYear(s)
      }
      const steps = (html: string) => /class="[^"]*ro-steps[\s\S]*?<\/ul>/.exec(html)?.[0] ?? ''
      const ja = steps(renderToStaticMarkup(<Result life={s} cohort={null} cohortProgress={0} onAgain={() => {}} onTop={() => {}} />))
      setLang('en')
      const en = steps(renderToStaticMarkup(<Result life={s} cohort={null} cohortProgress={0} onAgain={() => {}} onTop={() => {}} />))
      setLang('ja')
      if (!ja.includes('<li')) continue
      checked++
      expect(ja).toContain(STATS.jpJhsContinue.population)
      expect(leftJapanese(en.replace(/title="[^"]*"/g, '')), `seed ${7000 + i}`).toEqual([])
    }
    expect(checked).toBeGreaterThan(2)
  }, 60_000)
})
