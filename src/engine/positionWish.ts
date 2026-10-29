import type { LifeState, Position, PositionWish, WishPos } from './types.ts'

// The position he wants (PROJECT_PLAN §11.23). The wish is his; the position he plays (person.position) is the team's, and it moves
// toward the wish only after high school, when a new team looks at him, by how well his body and skills suit it (ability.ts
// positionFit). Up to high school the wish is kept and shown, the team's choice stands (the squad there feeds the calibrated checks).

export const WISH_LABEL: Record<WishPos, string> = {
  SP: '先発投手',
  RP: '中継ぎ投手',
  C: '捕手',
  '1B': '一塁手',
  '2B': '二塁手',
  '3B': '三塁手',
  SS: '遊撃手',
  LF: '左翼手',
  CF: '中堅手',
  RF: '右翼手',
}

export const GROUP_OF: Record<WishPos, Position> = { SP: 'P', RP: 'P', C: 'C', '1B': 'IF', '2B': 'IF', '3B': 'IF', SS: 'IF', LF: 'OF', CF: 'OF', RF: 'OF' }
const DEFAULT_OF: Record<Position, WishPos> = { P: 'SP', C: 'C', IF: 'SS', OF: 'CF' }

export interface WishChoice {
  label: string
  hint?: string
  wish?: Omit<PositionWish, 'age'>
}

/** the wishes offered at a stage: rough groups for a child, the places themselves from high school on; the last leaves it to the coach */
export function wishChoices(s: LifeState): WishChoice[] {
  const field: WishPos = s.person.position === 'P' ? 'SS' : DEFAULT_OF[s.person.position]
  if (s.age < 15) {
    return [
      { label: '投手をやりたい', wish: { pos: 'SP' } },
      { label: '捕手をやりたい', wish: { pos: 'C' } },
      { label: '内野手をやりたい', wish: { pos: 'SS' } },
      { label: '外野手をやりたい', wish: { pos: 'CF' } },
      { label: '投手も野手もやりたい（二刀流）', hint: '両方の練習が要り、疲れもたまりやすい', wish: { pos: 'SP', twoWay: field } },
      { label: '監督に任せる' },
    ]
  }
  const places: WishPos[] = ['SP', 'RP', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']
  return [
    ...places.map((p) => ({ label: WISH_LABEL[p], wish: { pos: p } })),
    { label: `二刀流（先発と${WISH_LABEL[field]}）`, hint: '両方の能力と出番、疲れとの勝負。選んだだけでは成り立たない', wish: { pos: 'SP' as WishPos, twoWay: field } },
    { label: `二刀流（中継ぎと${WISH_LABEL[field]}）`, hint: '登板の合間に打席にも立つ。疲れがたまりやすい', wish: { pos: 'RP' as WishPos, twoWay: field } },
    { label: '監督に任せる', hint: 'チーム事情に合わせる' },
  ]
}

/** the place he plays, in words: the wished place when it is in his group, else the usual place of the group */
export function placeLabel(s: LifeState): string {
  const w = s.career.wish
  const g = s.person.position
  if (w && GROUP_OF[w.pos] === g) return WISH_LABEL[w.pos]
  if (w?.twoWay && GROUP_OF[w.twoWay] === g) return WISH_LABEL[w.twoWay]
  return { P: '投手', C: '捕手', IF: '内野手', OF: '外野手' }[g]
}

export function wishLabel(w: PositionWish | undefined): string {
  if (!w) return '—'
  return w.twoWay ? `二刀流（${WISH_LABEL[w.pos]}と${WISH_LABEL[w.twoWay]}）` : WISH_LABEL[w.pos]
}

/** the stages at which he says what he wants: once at the start of each playing stage */
export const WISH_PHASES = ['youth', 'jhs', 'hs', 'univ', 'company', 'indep', 'proMinor', 'pro', 'abroad']
