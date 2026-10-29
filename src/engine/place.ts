import type { LifeState } from './types.ts'
import { PREFECTURES } from '../data/jp.ts'
import { AMATEUR_TEAMS, JABA_REGION_OF_PREF } from '../data/teams.ts'
import { COUNTRY_INFO, residenceOf } from './countries/index.ts'
import { hashSeed, makeRng } from './rng.ts'

// Where he lives now, apart from where he was born (feedback: after a move, the screen and the last words of a life still named the
// prefecture of his birth). `person.prefecture` stays the place of birth (the certificate, the share link, the birth-based draws);
// `LifeState.place` is where he lives, an index into his birth country's table of places (prefectures for Japan, states for the US, …):
//  - absent: he has not moved since birth (the place of birth), or a life saved before it was kept (see placeIndex);
//  - PLACE_UNKNOWN: he moved, and the model does not know where (an NPB club: the game keeps no home ground; a home near a child).
// It is set by what moves him: a transfer, a family's move, a university or a team in another region, the moves of the life events. It is
// shown only; nothing calibrated reads it, and a destination is drawn on a hash of the life, the age and the move, never on a stream of
// the year. Abroad (residence), the country is where he lives.

export const PLACE_UNKNOWN = -1

/** the lines that told a move in a life saved before the place was kept: such a life's place is not known any more */
const LEGACY_MOVE = /新しい土地に引っ越しました|家族で新しい街に移りました|新しい町へ引っ越し|見知らぬ町のチーム|縁側のある古い家|子どもの家に近い小さな家|暖かい州へ引っ越しました|子どもの家の近くに小さな家を買いました/
const PRO_PHASES = ['proMinor', 'pro', 'abroad']

const regionsOf = (s: LifeState): string[] => COUNTRY_INFO[s.person.country ?? 'JP'].regions

/**
 * The index of the place he lives in now (his birth country's table), or PLACE_UNKNOWN. A life saved before the place was kept has
 * none: the place of birth, unless its record shows a move or a pro career (whose home is not known).
 */
export function placeIndex(s: LifeState): number {
  if (s.place !== undefined) return s.place
  const moved = PRO_PHASES.includes(s.career.phase) || s.timeline.some((t) => PRO_PHASES.includes(t.phase)) || s.log.some((e) => LEGACY_MOVE.test(e.text))
  return moved ? PLACE_UNKNOWN : s.person.prefecture
}

/** the name of the place he lives in now (abroad: the country), or undefined when the model does not know it */
export function livingPlace(s: LifeState): string | undefined {
  const res = residenceOf(s)
  if (res !== (s.person.country ?? 'JP')) return COUNTRY_INFO[res].label
  const i = placeIndex(s)
  return i >= 0 ? regionsOf(s)[i] : undefined
}

/** Japan's prefecture index of his home for the schools of his age (the place he lives in, else the place of birth) */
export function homePrefecture(s: LifeState): number {
  const i = placeIndex(s)
  return i >= 0 ? i : s.person.prefecture
}

const METRO = new Set(['東京都', '神奈川県', '大阪府', '愛知県', '埼玉県', '千葉県', '兵庫県', '福岡県', '京都府'])

/**
 * He moves to another place of his country, drawn on a hash of the life, the age and `salt`: 'far' another region (Japan's 地方) when
 * there is one, 'rural' a prefecture outside the large cities. Returns its name.
 */
export function moveAway(s: LifeState, how: 'far' | 'rural', salt: number): string {
  const names = regionsOf(s)
  const cur = placeIndex(s)
  const jp = (s.person.country ?? 'JP') === 'JP'
  let pool = names.map((_, i) => i).filter((i) => i !== cur)
  if (jp && how === 'far' && cur >= 0) {
    const far = pool.filter((i) => PREFECTURES[i].region !== PREFECTURES[cur].region)
    if (far.length) pool = far
  }
  if (jp && how === 'rural') {
    const rural = pool.filter((i) => !METRO.has(PREFECTURES[i].name))
    if (rural.length) pool = rural
  }
  const r = makeRng(hashSeed(s.config.seed ^ Math.imul(s.age + 1, 0x2f6e2b1) ^ Math.imul(salt + 5, 0x9e3779b9)))
  const to = pool[Math.floor(r.next() * pool.length)]
  s.place = to
  return names[to]
}

/** he moves to one of these places (by name, his country's table), drawn as moveAway; none of them in the table: a place not known */
export function moveToOneOf(s: LifeState, places: string[], salt: number): string | undefined {
  const names = regionsOf(s)
  const cur = placeIndex(s)
  const pool = places.map((p) => names.indexOf(p)).filter((i) => i >= 0 && i !== cur)
  if (pool.length === 0) {
    s.place = PLACE_UNKNOWN
    return undefined
  }
  const r = makeRng(hashSeed(s.config.seed ^ Math.imul(s.age + 1, 0x2f6e2b1) ^ Math.imul(salt + 5, 0x9e3779b9)))
  const to = pool[Math.floor(r.next() * pool.length)]
  s.place = to
  return names[to]
}

/** he has moved, to a place the model does not know */
export function moveUnknown(s: LifeState): void {
  s.place = PLACE_UNKNOWN
}

/**
 * He goes to a school or a team in this prefecture (Japan): in another region he moves there; in his own region he goes from home.
 * Coming from a place not known, he lives where it is.
 */
export function settleAt(s: LifeState, prefName: string | undefined): void {
  if ((s.person.country ?? 'JP') !== 'JP' || !prefName) return
  const to = PREFECTURES.findIndex((p) => p.name === prefName)
  if (to < 0) return
  const cur = placeIndex(s)
  if (cur === to || (cur >= 0 && PREFECTURES[cur].region === PREFECTURES[to].region)) return
  s.place = to
}

/**
 * He joins a 社会人野球 team: its prefecture when the federation's lists give it; else, a team of another 地区連盟 means a move to a
 * place the model does not know (one of his own 地区 he goes to from home).
 */
export function settleWithTeam(s: LifeState, teamName: string | undefined): void {
  if ((s.person.country ?? 'JP') !== 'JP' || !teamName) return
  const t = AMATEUR_TEAMS.find((x) => x.name === teamName)
  if (!t) return
  if (t.pref) return settleAt(s, t.pref)
  const cur = placeIndex(s)
  if (cur >= 0 && JABA_REGION_OF_PREF[PREFECTURES[cur].name] === t.region) return
  s.place = PLACE_UNKNOWN
}
