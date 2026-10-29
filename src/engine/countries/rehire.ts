import type { LifeState } from '../types.ts'
import type { YearCtx } from '../life.ts'
import { normCdf } from '../math.ts'
import { US_STATES } from '../../data/us.ts'
import { CU_REGIONS, KR_REGIONS } from '../../data/league.ts'
import { usRng } from './us/checks.ts'

// A good player who loses his place is sometimes asked by another team of the SAME league (PROJECT_PLAN §11.47). It is shared by the
// US flow (MLB and the minors; a Cuban abroad too), Korea's and Cuba's. Japan's release has its own way back (the tryout of
// 'jp.release') and is not touched, so Japan's random stream does not move. The draw is from a stream of its own ('rehire.<league>':
// a function of the life, the age and the league only). EVERY NUMBER IS A GAME ASSUMPTION (no source): the more he did, the likelier;
// the older, the less; a star keeps a part of his chance at any age; nobody jumps to a higher league (the offer is the same league's,
// or its lower category); at most 3 offers in a life; one offer a year.

export type RehireLeague = 'US' | 'KR' | 'CU'
export type RehireTier = 'first' | 'farm'

const LEAGUE = {
  US: { name: 'MLB', first: 'MLB', farm: 'マイナーリーグ', places: US_STATES.map((x) => x.name) },
  KR: { name: 'KBO', first: 'KBO（1軍）', farm: 'KBO 2軍', places: KR_REGIONS.map((x) => x.name) },
  CU: { name: 'セリエ・ナシオナル', first: 'セリエ・ナシオナル', farm: 'セリエ・ナシオナル', places: CU_REGIONS.map((x) => x.name) },
} as const

export const REHIRE_MAX = 3
const LAST_AGE = 38

/** the chance of an offer: standing is this year's place among the league's players (z-like; 1.6 and more is a star) */
export function rehireProb(s: LifeState, from: RehireTier, standing: number): number {
  if (s.age > LAST_AGE || s.career.injured > 0 || s.bb?.hurt) return 0
  if ((s.flags?.['rehire.n'] ?? 0) >= REHIRE_MAX) return 0
  let x = -1.7 + 0.8 * standing + 0.3 * s.z - (from === 'farm' ? 0.2 : 0)
  const old = Math.max(0, s.age - 28)
  x -= (standing >= 1.6 ? 0.06 : 0.12) * old
  return Math.min(0.7, Math.max(0.01, normCdf(x)))
}

/** a player in good standing gets another first-team contract; the others a minor-category one (where the league has one) */
export function rehireTier(cc: RehireLeague, from: RehireTier, standing: number): RehireTier {
  if (cc === 'CU' || from === 'farm') return from === 'farm' ? 'farm' : 'first'
  return standing >= 0.5 ? 'first' : 'farm'
}

/**
 * Called where the league has just let him go. If an offer comes, the decision is asked and true is returned (the caller must not
 * retire him: 'rehire.offer' does, on a refusal); false leaves the existing retirement to the caller.
 */
export function offerRehire(y: YearCtx, cc: RehireLeague, from: RehireTier, standing: number): boolean {
  const s = y.s
  const r = usRng(s, `rehire.${cc}`)
  if (r.next() >= rehireProb(s, from, standing)) return false
  const L = LEAGUE[cc]
  const tier = rehireTier(cc, from, standing)
  const place = L.places[Math.floor(r.next() * L.places.length)]
  const cat = tier === 'first' ? L.first : L.farm
  const down = from === 'first' && tier === 'farm'
  y.ask(
    {
      id: 'rehire.offer',
      weight: 'major',
      stop: true,
      title: '別の球団からの誘い',
      body: `契約が切れたあと、${place}の球団から声がかかりました。${down ? '1軍ではなく、下のカテゴリーでの契約です。' : '同じリーグで、もう一度やってみないかという話です。'}これからどうしますか。`,
      choices: [
        { label: `${place}の球団と契約する`, hint: `${cat}・1年契約。${down ? '年俸は下がり、1軍に戻るには結果が必要' : '年俸は前年並みか少し下がる見込み'}（ゲーム上の仮定）` },
        { label: '現役を引退する', hint: '次の仕事を探す' },
      ],
      autoIndex: s.age <= 34 || standing >= 1 ? 0 : 1,
      factText: 'オファーが来るかは、直近の成績・年齢・けがの有無から決めたゲーム上の仮定です（実際の移籍の割合ではありません）。',
    },
    { cc, tier, place, league: L.name, cat },
  )
  return true
}
