import type { KidBall, LifeState, LogKind } from './types.ts'
import { GIVEN_NAMES } from '../data/jp.ts'
import { defaultParams, passProb, type Params } from './params.ts'
import { hashSeed, makeRng, type Rng } from './rng.ts'

// A son's baseball, two generations (2026-10-24): the gap between "my child started baseball" and the high school, Koshien, the draft
// and the pros. When a son of a Japanese life turns 8, his path is drawn once, on a stream of his own (the life's seed and his place
// among the children: never the life's streams), through the same calibrated checks as a player's own life (params.ts CHECKS, passProb:
// junior high, the high school club, staying, Koshien, the declaration and the draft, 支配下 or 育成, university, company, independent,
// the first team, MLB), then told to his father in the years they happen. The checks are applied to his own talent with no context
// and no drift, so the shares are those of the model, as an estimate (stat kidBallModel). What the father's background adds is small
// and a GAME ASSUMPTION: it makes a start in baseball likelier and lifts the son's talent a little — it never makes him succeed.
// Nothing here changes the father's life (his money, his career, his checks): only lines in his record and this path.

let params: Params | null = null
const P = () => (params ??= defaultParams())

/** the chance a son starts baseball at 8 (assumption): likelier when his father played, and much likelier when he already plays */
function startChance(s: LifeState): number {
  const r = s.career.highestRank
  if (s.taken.includes('family.kidPlays') || s.flags?.['kid.lesson'] !== undefined) return 0.85
  return r >= 7 ? 0.55 : r >= 3 ? 0.45 : 0.25
}

/** what his father's career adds to a son's talent, in sd units (assumption: small) */
function heritage(s: LifeState): number {
  const r = s.career.highestRank
  return (r >= 8 ? 0.25 : r >= 7 ? 0.15 : r >= 5 ? 0.1 : 0) + (s.flags?.['kid.lesson'] !== undefined ? 0.1 : 0)
}

/** a son: the model's lives are boys, and a Japanese child's name tells it (family.ts draws a boy's name or a girl's) */
const isSon = (name: string) => GIVEN_NAMES.includes(name)

/** the ranks of the path, for the highest the father saw (Result) */
export const KID_RANKS = ['少年野球', '中学野球', '高校野球', '甲子園出場', '独立リーグ', '社会人野球', '大学野球', '育成選手', 'プロ野球（支配下）', 'プロ野球の1軍', 'メジャーリーグ'] as const

function draw(s: LifeState, i: number, name: string): KidBall {
  const r: Rng = makeRng(hashSeed((s.config.seed ^ 0x6b1b) + 977 * (i + 1)))
  const z = r.normal() + heritage(s)
  const p = (key: string) => passProb(P(), key, z)
  const steps: KidBall['steps'] = []
  const at = (age: number, text: string, kind: LogKind = 'good', rank?: number, key = false) => steps.push({ age, text, kind, ...(key ? { key } : {}), ...(rank !== undefined ? { rank } : {}) })
  const fatherPro = s.career.highestRank >= 8
  const fatherKoshien = s.career.achievements.includes('甲子園')

  at(8, s.career.highestRank >= 3 ? `${name}が少年野球のチームに入りました。最初のグラブは、自分が昔使っていたものです。` : `${name}が少年野球のチームに入りました。`, 'good', 0)
  if (!r.chance(p('jp.jhs'))) {
    at(12, `${name}は中学では野球を続けず、別の道を選びました。`, 'normal')
    return { name, steps }
  }
  at(12, `${name}は中学でも野球を続けることにしました。`, 'normal', 1)
  if (!r.chance(p('jp.hs'))) {
    at(15, `${name}は高校では野球部に入らないことにしました。`, 'normal')
    return { name, steps }
  }
  at(15, `${name}が高校の野球部に入りました。`, 'good', 2)
  for (const age of [16, 17]) {
    if (!r.chance(p('jp.hsStay'))) {
      at(age, `${name}は高校の途中で野球部をやめました。話を聞き、本人の決めたことを受け止めました。`, 'normal')
      return { name, steps }
    }
  }
  if (r.chance(p('jp.koshien'))) {
    at(17, `${name}が甲子園に出場しました。アルプススタンドで、声がかれるまで応援しました。`, 'big', 3, true)
    if (fatherKoshien) at(17, '親子2代で、甲子園の土を踏みました。', 'good')
  }
  at(18, `${name}の高校野球が終わりました。最後の夏を、スタンドから見届けました。`, 'normal')

  // after high school: the draft (a declaration first), else university, a company team, an independent team, or the end
  const pro = (age: number, route: 'Hs' | 'Univ' | 'Company' | 'Indep') => {
    const shihaika = r.chance(p(`jp.shihaika${route}`))
    at(age, shihaika ? `${name}がプロ野球のドラフト会議で指名されました。家族みんなで、テレビの前で泣きました。` : `${name}が、育成選手としてプロ野球の球団に指名されました。`, 'big', shihaika ? 8 : 7, true)
    if (s.career.draft) at(age, '自分と同じように、ドラフトで名前を呼ばれました。', 'good')
    let year = age + 1
    if (!shihaika) {
      if (!r.chance(p('jp.ikuseiPromote'))) {
        at(age + 3, `${name}は育成契約のまま、球団を離れることになりました。`, 'bad')
        return
      }
      year = age + 3
      at(year, `${name}が支配下選手に登録されました。背番号が2桁になりました。`, 'good', 8)
    }
    let debuted = false
    for (; year <= 40; year++) {
      if (!debuted && r.chance(p('jp.ichigun'))) {
        debuted = true
        at(year, `${name}がプロ野球の1軍の試合に初めて出場しました。`, 'big', 9, true)
        at(year, fatherPro ? '親子2代で、1軍の舞台に立ちました。' : `${name}は、自分が届かなかった舞台に立ちました。`, 'good')
      }
      if (debuted && year >= 26 && year <= 30 && z >= 2 && r.chance(p('jp.mlb') * 0.3)) {
        at(year, `${name}がメジャーリーグに挑戦することになりました。`, 'big', 10, true)
        at(year + 4, `${name}がメジャーでの挑戦を終え、日本に戻りました。`, 'normal')
        year += 4
      }
      if (r.chance(p('jp.npbExit'))) break
    }
    at(Math.min(year, 41), `${name}がプロ野球の現役を終えました。長い間、テレビの前で応援しました。`, 'milestone')
  }
  if (r.chance(p('jp.hsFile')) && r.chance(p('jp.hsDraft'))) {
    pro(18, 'Hs')
  } else if (r.chance(p('jp.hsUniv'))) {
    at(18, `${name}は大学で野球を続けることにしました。`, 'good', 6)
    for (const age of [19, 20, 21]) {
      if (!r.chance(p('jp.univStay'))) {
        at(age, `${name}は大学の途中で野球部を離れました。`, 'normal')
        return { name, steps }
      }
    }
    if (r.chance(p('jp.univFile')) && r.chance(p('jp.univDraft'))) pro(22, 'Univ')
    else if (r.chance(p('jp.univCompany'))) {
      at(22, `${name}が社会人野球の会社に入りました。`, 'good', 5)
      if (r.chance(p('jp.companyDraft'))) pro(24, 'Company')
      else at(27, `${name}が社会人野球の現役を終え、仕事に専念することになりました。`, 'normal')
    } else at(22, `${name}は大学で野球に区切りをつけ、就職しました。`, 'normal')
  } else if (r.chance(p('jp.hsCompany'))) {
    at(18, `${name}が社会人野球の会社に入りました。`, 'good', 5)
    if (r.chance(p('jp.companyDraft'))) pro(21, 'Company')
    else at(24, `${name}が社会人野球の現役を終え、仕事に専念することになりました。`, 'normal')
  } else if (r.chance(p('jp.hsIndep'))) {
    at(18, `${name}が独立リーグのトライアウトに合格しました。`, 'good', 4)
    if (r.chance(p('jp.indepDraft'))) pro(20, 'Indep')
    else at(21, `${name}は独立リーグで区切りをつけ、野球を離れました。`, 'normal')
  } else at(18, `${name}は高校で野球に区切りをつけ、次の道に進みました。`, 'normal')
  return { name, steps }
}

/**
 * The year of a Japanese life: a son who turns 8 gets his path (or none: not a son, or he does not start), and the steps of this year
 * of each son's path are told (`add`, on a stream of the caller's own)
 */
export function kidBallYear(s: LifeState, add: (kind: LogKind, text: string, key: boolean) => void): void {
  if (s.person.country !== 'JP') return
  const kids = s.family.kids
  const names = s.family.kidNames
  if (!kids?.length || !names) return
  const list = (s.family.kidBall ??= [])
  for (let i = 0; i < kids.length; i++) {
    if (list[i] === undefined && kids[i] === 8) {
      const name = names[i] ?? ''
      const r = makeRng(hashSeed((s.config.seed ^ 0x6b1c) + 977 * (i + 1)))
      list[i] = name && isSon(name) && r.chance(startChance(s)) ? draw(s, i, name) : null
    }
    // (an older save, or a child older than 8 when this came: not followed)
    if (list[i] === undefined && kids[i] > 8) list[i] = null
    const kb = list[i]
    if (!kb) continue
    for (const st of kb.steps) if (st.age === kids[i]) add(st.kind, st.text, !!st.key)
  }
}

/** the furthest each son has come so far, for the result screen: [name, rank label] */
export function kidBallReached(s: LifeState): [string, string][] {
  const out: [string, string][] = []
  const kids = s.family.kids ?? []
  for (const [i, kb] of (s.family.kidBall ?? []).entries()) {
    if (!kb) continue
    const ranks = kb.steps.filter((st) => st.age <= (kids[i] ?? 0) && st.rank !== undefined).map((st) => st.rank!)
    if (ranks.length) out.push([kb.name, KID_RANKS[Math.max(...ranks)]])
  }
  return out
}
