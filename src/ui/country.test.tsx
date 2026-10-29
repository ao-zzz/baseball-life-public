import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Intro } from './Intro.tsx'
import { Cert } from './Cert.tsx'
import { ProYears } from './ProPanels.tsx'
import { phaseLabel } from './format.ts'
import { createLife, runHeadless } from '../engine/life.ts'
import { defaultParams } from '../engine/params.ts'
import { hashSeed } from '../engine/rng.ts'
import { lifeTitle } from '../engine/summary.ts'
import type { LifeState } from '../engine/types.ts'

// The country on the screens (PROJECT_PLAN §11.31): the choice of the country, the place of birth, the birth certificate, the
// pro table and the names of the stages. Japan's screens are as they were; a US life does not carry Japan's figures.

const noop = () => {}
const settings = (o: object = {}) => ({ pace: 'p15' as const, prefecture: -1, theme: 'auto' as const, mode: 'normal' as const, stars: 1, ...o })
const intro = (s: object) => renderToStaticMarkup(<Intro settings={settings(s)} onSettings={noop} onStart={noop} resume={null} onResume={noop} onDiscard={noop} past={[]} onTheme={noop} />)

describe('the choice of the country and the place of birth', () => {
  it('Japan: Japan and the US can be chosen, the other countries are 「準備中」, the places are prefectures, the funnel is shown', () => {
    const html = intro({})
    expect(html).toContain('生まれる国')
    expect(html).toContain('<option value="US">アメリカ（ベータ版）</option>')
    expect(html).toContain('<option value="KR">韓国（ベータ版）</option>')
    expect(html).toContain('<option value="CU">キューバ（ベータ版）</option>')
    expect(html).toContain('台湾（準備中）')
    expect(html).not.toContain('日本（ベータ版）')
    expect(html).toContain('生まれる都道府県')
    expect(html).toContain('東京都')
    expect(html).toContain('学童野球 → 中学でも続ける')
    expect(html).not.toContain('アメリカの流れ')
  })

  it('US: the places are the states, the Japanese funnel and the title\'s denominator are not carried over, and the assumptions are said', () => {
    const html = intro({ country: 'US' })
    expect(html).toContain('生まれる州')
    expect(html).toContain('カリフォルニア州')
    expect(html).not.toContain('東京都')
    expect(html).toContain('アメリカの流れ')
    expect(html).not.toContain('学童野球 → 中学でも続ける')
    expect(html).toContain('「12万」は日本の高校野球部員数で、この国の人生には使いません')
    expect(html).toContain('ゲーム上の仮定')
    // the facts that were confirmed are named
    expect(html).toContain('76.5年')
  })
})

describe('the birth certificate, the pro table and the names of the stages', () => {
  it('a US birth certificate has the state, the US life table and the US fact box, and no Japanese tournament figure', () => {
    const life = createLife({ seed: 31, country: 'US', pace: 'p15', prefecture: 4 })
    const html = renderToStaticMarkup(<Cert life={life} onBegin={noop} onCancel={noop} />)
    expect(html).toContain('No. US-')
    expect(html).toContain('カリフォルニア州')
    expect(html).toContain('平均寿命（アメリカの男性）')
    expect(html).toContain('76.5')
    expect(html).toContain('MLBドラフトは20巡')
    expect(html).not.toContain('夏の地方大会')
    expect(html).not.toContain('令和7年簡易生命表')
    expect(html).not.toContain('甲子園')
  })

  it('a Japanese birth certificate is as it was', () => {
    const life = createLife({ seed: 31, country: 'JP', pace: 'p15' })
    const html = renderToStaticMarkup(<Cert life={life} onBegin={noop} onCancel={noop} />)
    expect(html).toContain('No. JP-')
    expect(html).toContain('夏の地方大会の参加チーム')
    expect(html).toContain('令和7年簡易生命表')
  })

  it('the stages are named in the life\'s country; a US pro table says MLB and マイナー, not 1軍 and 2軍', () => {
    expect(phaseLabel('pro', 'US')).toBe('MLB')
    expect(phaseLabel('proMinor', 'US')).toBe('マイナーリーグ')
    expect(phaseLabel('hs', 'US')).toContain('ハイスクール')
    expect(phaseLabel('pro', 'JP')).toBe('NPB')
    expect(phaseLabel('hs', undefined)).toBe('高校野球')
    let pro: LifeState | undefined
    for (let i = 0; i < 20000 && !pro; i++) {
      const s = runHeadless({ seed: hashSeed(i + 15_000_000), country: 'US', pace: 'p15' }, { params: defaultParams(), headless: true })
      if (s.career.proDebut && s.career.salaryHist?.some((h) => h.kind === 'minor')) pro = s
    }
    expect(pro).toBeDefined()
    const html = renderToStaticMarkup(<ProYears life={pro!} />)
    expect(html).toContain('MLB')
    expect(html).toContain('マイナー')
    expect(html).not.toContain('1軍')
    expect(html).not.toContain('2軍')
    expect(lifeTitle(pro!)).not.toContain('1軍')
  }, 60_000)
})

describe('Korea and Cuba (beta, PROJECT_PLAN §11.46)', () => {
  it('show their own places, their flow and the statement that every figure is an estimate', () => {
    const kr = intro({ country: 'KR' })
    expect(kr).toContain('韓国の流れ（ベータ版）')
    expect(kr).toContain('ソウル')
    expect(kr).not.toContain('東京都')
    expect(kr).toContain('ゲーム上の推定です')
    const cu = intro({ country: 'CU' })
    expect(cu).toContain('キューバの流れ（ベータ版）')
    expect(cu).toContain('ラ・ハバナ')
    expect(cu).toContain('事実として断定するものではありません')
  })
  it('name their stages in the life screen', () => {
    expect(phaseLabel('pro', 'KR')).toBe('KBO')
    expect(phaseLabel('proMinor', 'KR')).toBe('KBO 2軍')
    expect(phaseLabel('pro', 'CU')).toBe('セリエ・ナシオナル')
    expect(phaseLabel('pro', 'CU', true)).toBe('MLB')
  })
})