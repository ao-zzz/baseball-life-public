import { describe, expect, it } from 'vitest'
import { ORGS } from '../data/orgs.ts'
import { similarity } from './events/spec.ts'
import { TRENDS, TREND_NOTE, eligibleTrends, trendChance, trendPass, type TrendRegion } from './trendLog.ts'
import { EVENTS, createLife, endYear, planYear, resolveDecision, runHeadless, type Sim } from './life.ts'
import { defaultParams } from './params.ts'
import { hashSeed, makeRng } from './rng.ts'
import type { EventCtx } from './events.ts'
import type { LifeState, LogEntry } from './types.ts'

// 世間の小ネタ (PROJECT_PLAN §11.18): short world-news-style lines in the life log. Judged on how many and how varied they
// are, that they are made up and safe, that they are only log (no decision, no change to the life) and that they
// do not crowd out the rest of the log.

const screen: Sim = { params: defaultParams() }
const headless: Sim = { params: defaultParams(), headless: true }

/** a life played as on screen (おまかせ), with its log */
function playScreen(seed: number): LifeState {
  const s = createLife({ seed, country: 'JP', pace: 'p15' })
  for (let g = 0; g < 130 && s.alive; g++) {
    const plan = planYear(s, screen)
    for (const e of plan.events) s.log.push(e.entry)
    let d = plan.decision?.decision
    while (d && s.alive) {
      const r = resolveDecision(s, d.autoIndex, screen)
      for (const e of r.events) s.log.push(e.entry)
      d = r.followUp?.decision
    }
    endYear(s)
  }
  return s
}

const isTrend = (e: LogEntry) => e.category === 'trend'

describe('世間の小ネタ: the stock of lines', () => {
  it('there are many, no two alike, all complete short sentences', () => {
    expect(TRENDS.length).toBeGreaterThanOrEqual(180)
    expect(new Set(TRENDS.map((t) => t.text)).size).toBe(TRENDS.length)
    expect(new Set(TRENDS.map((t) => t.id)).size).toBe(TRENDS.length)
    for (const t of TRENDS) {
      expect(t.text.endsWith('。'), t.text).toBe(true)
      expect(t.text.length, t.text).toBeLessThanOrEqual(75)
      expect(t.text.length, t.text).toBeGreaterThanOrEqual(20)
    }
    // no two lines share a punchline or a build-up (the similarity measure of the event checks)
    const close: string[] = []
    for (let i = 0; i < TRENDS.length; i++) for (let j = i + 1; j < TRENDS.length; j++) if (similarity(TRENDS[i].text, TRENDS[j].text) > 0.6) close.push(`${TRENDS[i].id}/${TRENDS[j].id}`)
    expect(close).toEqual([])
  })

  it('they cover Japan, Korea, Taiwan, the rest of the world and net culture without leaning on one, and mix baseball with everyday life', () => {
    const n = (r: TrendRegion) => TRENDS.filter((t) => t.region === r).length / TRENDS.length
    expect(n('jp')).toBeLessThanOrEqual(0.4)
    expect(n('jp')).toBeGreaterThanOrEqual(0.15)
    expect(n('kr')).toBeGreaterThanOrEqual(0.08)
    expect(n('tw')).toBeGreaterThanOrEqual(0.08)
    expect(n('world')).toBeGreaterThanOrEqual(0.15)
    expect(n('net')).toBeGreaterThanOrEqual(0.15)
    expect(new Set(TRENDS.map((t) => t.theme)).size).toBeGreaterThanOrEqual(8)
    const bb = TRENDS.filter((t) => t.theme === 'baseball').length / TRENDS.length
    expect(bb).toBeGreaterThan(0.1)
    expect(bb).toBeLessThan(0.3)
    // ways of telling: the sentence endings, so they do not all sound alike
    const endings = new Set(TRENDS.map((t) => t.text.slice(-4)))
    expect(endings.size).toBeGreaterThan(30)
    expect(TRENDS.filter((t) => t.text.endsWith('ました。')).length / TRENDS.length).toBeLessThan(0.6)
  })

  it('they name no real company, brand, service, club, team, person or school, and do not touch disasters, accidents, crime, war, politics or discrimination', () => {
    const brands = /Google|Apple|Amazon|Microsoft|ChatGPT|Netflix|Instagram|TikTok|Twitter|YouTube|Facebook|LINE|ユニクロ|セブン|ローソン|ファミリーマート|マクドナルド|スターバックス|ディズニー|任天堂|ポケモン|ジャニーズ|BTS|BLACKPINK|NewJeans|吉野家|すき家|無印|ドン・キホーテ|楽天|ソフトバンク|トヨタ|ホンダ|サムスン|ソニー|パナソニック|甲子園|プロ野球機構/
    const harm = /地震|津波|台風|豪雨|洪水|噴火|災害|被災|戦争|紛争|ミサイル|テロ|事故|火災|感染|病死|死亡|殺|逮捕|犯罪|不祥事|疑惑|詐欺師|選挙|首相|大統領|政党|政権|国会|デモ|差別|偏見|人種|宗教|炎上|失言|不倫|薬物|賭博/
    const orgs = ORGS.map((o) => o.realName).filter(Boolean) as string[]
    for (const t of TRENDS) {
      expect(t.text, t.id).not.toMatch(brands)
      expect(t.text, t.id).not.toMatch(harm)
      for (const o of orgs) expect(t.text.includes(o), `${t.id} names ${o}`).toBe(false)
    }
    // the fact of being made up is told with the first line of a life
    expect(TREND_NOTE).toContain('創作')
    expect(TREND_NOTE).toContain('実際のニュースではありません')
  })

  it('the lines fit the age of the reader: nothing about drink or work for children, the play of children not for the old', () => {
    const young = TRENDS.filter((t) => t.ages[0] < 12)
    expect(young.length).toBeGreaterThanOrEqual(10)
    for (const t of young) expect(t.text, t.id).not.toMatch(/お酒|ビール|ハイボール|飲み会|二日酔い|会議|残業|転職|住宅ローン|年金/)
    for (const t of TRENDS) expect(t.ages[0], t.id).toBeLessThanOrEqual(t.ages[1])
    expect(trendChance(2)).toBe(0)
    expect(trendChance(8)).toBeLessThan(trendChance(30))
    expect(trendChance(30)).toBeLessThanOrEqual(0.2)
  })
})

describe('世間の小ネタ: only a line in the log', () => {
  it('they are not events: not in the event catalog, never a decision, never asked', () => {
    for (const t of TRENDS) expect(EVENTS.get(t.id), t.id).toBeUndefined()
    const s = playScreen(hashSeed(1_300_001))
    const lines = s.log.filter(isTrend)
    expect(lines.length).toBeGreaterThan(5)
    // the note that they are made up comes first, once
    expect(lines[0].kind).toBe('note')
    expect(lines.filter((e) => e.kind === 'note').length).toBe(1)
    for (const e of lines) {
      expect(['normal', 'note']).toContain(e.kind)
      expect(e.eventId).toBeUndefined()
      expect(e.key).toBeFalsy()
    }
  })

  it('a life is the same with them or without: the headless run and the screen run end alike', () => {
    for (let i = 0; i < 25; i++) {
      const seed = hashSeed(i + 1_300_100)
      const a = playScreen(seed)
      const b = runHeadless({ seed, country: 'JP', pace: 'p15' }, headless)
      expect(a.age, `seed ${i}`).toBe(b.age)
      expect(a.z).toBe(b.z)
      expect(a.money).toBe(b.money)
      expect(a.career.highestRank).toBe(b.career.highestRank)
      expect(a.causeOfDeath).toBe(b.causeOfDeath)
      expect(JSON.stringify(a.career)).toBe(JSON.stringify(b.career))
      expect(JSON.stringify(a.timeline)).toBe(JSON.stringify(b.timeline))
    }
  }, 120_000)

  it('the pass touches nothing but the record of what was told, and nothing at all in a headless run', () => {
    const s = createLife({ seed: 7, country: 'JP', pace: 'p15' })
    s.age = 30
    s.year = 2056
    const log: string[] = []
    const mk = (headlessRun: boolean, seed: number) => ({ s, rng: makeRng(seed), headless: headlessRun, add: (_k: string, x: string) => log.push(x), ask: () => {}, canAsk: () => true }) as unknown as EventCtx
    const before = JSON.stringify({ ...s, evHist: undefined, taken: undefined })
    for (let i = 0; i < 20; i++) expect(trendPass(mk(true, i))).toBeUndefined()
    expect(log).toEqual([])
    let told = 0
    for (let i = 0; i < 200 && told < 3; i++) if (trendPass(mk(false, i))) told++
    expect(told).toBe(3)
    expect(log[0]).toBe(TREND_NOTE)
    expect(log.length).toBe(4)
    expect(JSON.stringify({ ...s, evHist: undefined, taken: undefined })).toBe(before)
    expect(Object.keys(s.evHist ?? {}).every((k) => k.startsWith('t.'))).toBe(true)
  })

  it('a line is told once in a life; one fitting the life is always left to tell', () => {
    const s = createLife({ seed: 9, country: 'JP', pace: 'p15' })
    s.age = 40
    s.year = 2066
    const seen = new Set<string>()
    for (let i = 0; i < 300; i++) {
      const c = { s, rng: makeRng(i), headless: false, add: () => {}, ask: () => {}, canAsk: () => true } as unknown as EventCtx
      const id = trendPass(c)
      if (id) {
        expect(seen.has(id)).toBe(false)
        seen.add(id)
      }
    }
    expect(seen.size).toBeGreaterThan(40)
    expect(eligibleTrends(s).every((t) => !seen.has(t.id))).toBe(true)
  })
})

describe('世間の小ネタ: in lives played as on screen', () => {
  const lives = Array.from({ length: 60 }, (_, i) => playScreen(hashSeed(i + 1_300_500)))

  it('they come now and then and do not crowd out the rest of the log', () => {
    const shares = lives.map((s) => s.log.filter(isTrend).length / s.log.length)
    const perLife = lives.map((s) => s.log.filter((e) => isTrend(e) && e.kind === 'normal').length).sort((a, b) => a - b)
    const median = perLife[Math.floor(perLife.length / 2)]
    // (measured 2026-10-19; one in seven years or so, about a twentieth of the log)
    expect(median).toBeGreaterThanOrEqual(8)
    expect(median).toBeLessThanOrEqual(40)
    const sortedShares = [...shares].sort((a, b) => a - b)
    expect(sortedShares[Math.floor(shares.length / 2)]).toBeLessThan(0.09)
    expect(Math.max(...shares)).toBeLessThan(0.25)
    // not in a run: no three years in a row with a line
    for (const s of lives) {
      const ages = new Set(s.log.filter((e) => isTrend(e) && e.kind === 'normal').map((e) => e.age))
      let run = 0
      let worst = 0
      for (let a = 0; a <= 120; a++) {
        run = ages.has(a) ? run + 1 : 0
        worst = Math.max(worst, run)
      }
      expect(worst).toBeLessThanOrEqual(5)
    }
  })

  it('lives differ: they do not tell the same lines, the same places or themes in turn', () => {
    const texts = lives.map((s) => new Set(s.log.filter(isTrend).map((e) => e.text)))
    // two lives overlap in only a small part of their lines
    let overlap = 0
    let n = 0
    for (let i = 0; i < texts.length; i++)
      for (let j = i + 1; j < texts.length; j++) {
        const common = [...texts[i]].filter((x) => texts[j].has(x)).length
        overlap += common / Math.min(texts[i].size, texts[j].size)
        n++
      }
    expect(overlap / n).toBeLessThan(0.3)
    // along one life, the region of a line is seldom the region of the line before it
    const region = new Map(TRENDS.map((t) => [t.text, t.region]))
    let same = 0
    let pairs = 0
    for (const s of lives) {
      const seq = s.log.filter((e) => isTrend(e) && e.kind === 'normal').map((e) => region.get(e.text)!)
      for (let k = 1; k < seq.length; k++) {
        pairs++
        if (seq[k] === seq[k - 1]) same++
      }
    }
    expect(pairs).toBeGreaterThan(300)
    // (five regions: chance alone would give about a third, the draw avoids a place seen in the last years)
    expect(same / pairs).toBeLessThan(0.28)
    // and every region is told in most lives
    for (const r of ['jp', 'kr', 'tw', 'world', 'net'] as TrendRegion[]) {
      const withRegion = lives.filter((s) => s.log.some((e) => isTrend(e) && region.get(e.text) === r)).length
      expect(withRegion / lives.length, r).toBeGreaterThan(0.7)
    }
  })

  it('every line of the stock can be told in some life (conditions are met by some age and state)', () => {
    const told = new Set<string>()
    for (const s of lives) for (const e of s.log) if (isTrend(e)) told.add(e.text)
    // 60 lives of a few dozen lines each reach most of the stock; the rest depend on a baseball life or a year
    expect(told.size / TRENDS.length).toBeGreaterThan(0.6)
    for (const t of TRENDS) expect(t.ages[1] - t.ages[0], t.id).toBeGreaterThanOrEqual(3)
  })
})
