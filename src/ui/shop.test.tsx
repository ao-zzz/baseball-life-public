import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ShopSheet } from './ShopSheet.tsx'
import { createLife } from '../engine/life.ts'
import { ensureAfter } from '../engine/after.ts'
import type { LifeState } from '../engine/types.ts'

// The money screen as it is drawn (PROJECT_PLAN §11.43): the savings, the cards, the options with their prices, what is shaded.

const noop = () => {}
function life(country: 'JP' | 'US', money: number): LifeState {
  const s = createLife({ seed: 77, country, pace: 'p15' })
  s.age = 40
  s.career.phase = 'retired'
  s.career.endedAge = 36
  s.career.highestRank = 8
  s.money = money
  s.income = 400
  const a = ensureAfter(s)
  a.home = 'rent'
  s.family.spouse = { name: 'X', years: 3 }
  return s
}
const html = (s: LifeState) => renderToStaticMarkup(<ShopSheet life={s} onChange={noop} onClose={noop} />)

describe('the money screen', () => {
  it('shows the savings, the cards with the prices, the way the money is kept and the repeating spending', () => {
    const h = html(life('JP', 3000))
    expect(h).toContain('お金を使う · 投資')
    expect(h).toContain('貯金 3,000万円')
    expect(h).toContain('今やっておきたいこと')
    expect(h).toContain('ほかのものも見る')
    expect(h).toContain('暮らし方')
    expect(h).toContain('余裕資金の運用：預金のまま')
    expect(h).toContain('自動で続ける')
    expect(h).toContain('選んでいるあいだ、時間は止まっています')
    // a price and what it changes
    expect(h).toContain('180万円')
    expect(h).toContain('幸福 +')
    // the close button is there twice (the header and the foot), as a dialog
    expect(h).toContain('role="dialog"')
    expect((h.match(/>閉じる</g) ?? []).length).toBe(2)
  })

  it('shows a man with little money the cards, shaded, with the reason, and no option he could press', () => {
    const h = html(life('JP', 5))
    expect(h).toContain('貯金 5万円')
    expect(h).toContain('お金が足りません')
    // every option is disabled
    const pills = h.match(/<button[^>]*class="pill"[^>]*>/g) ?? []
    const options = pills.filter((p) => !p.includes('aria-checked') && !p.includes('aria-pressed'))
    expect(options.length).toBeGreaterThan(0)
    for (const p of options) expect(p, p).toContain('disabled')
  })

  it('is the country\'s: a US life is offered the US\'s car, a Japanese one Japan\'s', () => {
    expect(html(life('US', 3000))).toContain('大きなピックアップトラック')
    expect(html(life('JP', 3000))).toContain('国産のコンパクトカー')
    expect(html(life('JP', 3000))).not.toContain('ピックアップ')
  })

  it('says where the spare money is and that the numbers are assumptions', () => {
    const h = html(life('JP', 3000))
    expect(h).toContain('2,600万円')
    expect(h).toContain('ゲーム上の仮定')
    expect(h).toContain('現実の利回りや予測ではありません')
  })
})
