import type { EventCtx } from './events.ts'
import type { HonourId, LifeState, StatLine } from './types.ts'
import { avg, era, records } from './games.ts'
import { greatSeason, proType, type ProType } from './careerSeason.ts'
import { orgById } from '../data/orgs.ts'
import leaders from '../data/npb-leaders.json' with { type: 'json' }
import rivals from '../data/title-rivals.json' with { type: 'json' }

// The personal titles and the big moments of an NPB player's 1軍 season (Japan's pro years only). Everything here only reads the
// season already played (careerSeason.ts proSeason) and draws on its own stream (the caller's eventCtx): it writes lines and the
// record of honours (Records.honours) and changes nothing else, so no calibrated check, pay or later event of the life moves (the
// honours feed only the love-life events a player chooses on screen: lifeLoveEvents.ts).
//
// - A title is first place among the league's qualified players (2026-11-16, feedback 「タイトル全然出ない」; before, the season had
//   to reach the figure of a real leader, which the game's seasons, lower than the real ones, almost never did). How many players
//   compete is real: the number who reached the 規定打席 / 規定投球回 in one real season of his league, drawn for the year
//   (src/data/npb-leaders.json, NPB 2015–2025 without 2020: stat npbTitleRivals). Who they are is the game's: the other K−1 are
//   seasons of the game's own players of the same kind (src/data/title-rivals.json, made by scripts/title-rivals.ts from the
//   lives of the normal mode), so the season wins with the chance that it is better than all of them, F(x)^(K−1), F being the share
//   of those seasons below his. Over the rivals themselves that is one title in K seasons, as in the league.
// - 首位打者 needs the 規定打席 (npbQualify). The game's starters pitch fewer innings than the real ones (careerSeason.ts: 4 to 7
//   innings a start, 25 starts), so the 規定投球回 is taken in the game's scale (SP_QUAL_OUTS): the pitching titles are among the
//   game's qualified starters, and the ERA title needs that line. (No relief titles: the game plays every 1軍 pitcher as a starter,
//   careerSeason.ts proType — no pitcher who reaches the pros has the low stamina of its reliever type, so there are no saves to count.)
// - The no-hitter has NPB's rate per start (npbNoHitRate), the perfect game its share of the no-hitters (npbPerfectShare); the Japan
//   Series is two clubs of twelve and one winner of two, the same for every club (npbJapanSeries).
// - MVP, ベストナイン, 新人王 and the All-Star game are chosen by others; the game decides them by rules of its own
//   (npbAwardRule, npbAllStar). The 新人王's eligibility is NPB's (5 years, 60 PA / 30 innings before, no pro play abroad).

type Row = (typeof leaders.rows)[number]
/** a pool of rival seasons: [value, count] pairs, ascending by value */
type Hist = [number, number][]

/** 規定打席 and 規定投球回 of a 143-game season (チーム試合数×3.1, ×1.0: stat npbQualify) */
export const QUALIFY_PA = 443
export const QUALIFY_OUTS = 143 * 3
/** individual no-hitters per start, 2015–2025 without 2020: 12 in 10 seasons of 1,716 starts (stat npbNoHitRate) */
export const NO_HIT_PER_START = 12 / (10 * 143 * 12)
/** the perfect games among NPB's no-hitters: 16 of 103 (stat npbPerfectShare) */
export const PERFECT_SHARE = 16 / 103
/** a club's chance to play the Japan Series (two of twelve) and to win it (stat npbJapanSeries) */
export const JAPAN_SERIES = 2 / 12
/** the game's rules for the awards others choose (stat npbAwardRule) and the All-Star game (npbAllStar) */
export const AWARD_EVEN = 0.5
export const ROOKIE_CHANCE = 0.6
export const ALL_STAR = { star: 0.6, regular: 0.15, bench: 0.03 }

/** the value of a season that a title compares (avg ×1000 and ERA ×100, rounded, as the official figures are) */
const avgKey = (l: StatLine) => Math.round((1000 * l.h) / Math.max(1, l.ab))
const eraKey = (l: StatLine) => Math.round((100 * 27 * l.er) / Math.max(1, l.outs))

/**
 * the 規定投球回 in the game's scale (scripts/title-rivals.ts): the innings of the top share of the game's regular starters that the
 * real qualified pitchers are of a league's rotation (stat npbTitleRivals)
 */
export const SP_QUAL_OUTS: number = rivals.spQualOuts
/** a starter's season that counts as qualified in the game's scale: a regular of the rotation with that many innings */
export const qualifiedStarter = (type: ProType, regular: boolean, l: StatLine) => type === 'starter' && regular && l.outs >= SP_QUAL_OUTS

interface Title {
  id: HonourId
  pool: 'bat' | 'sp'
  stat: string
  /** the value compared; undefined: the season cannot win it (the 規定打席, the 規定投球回 in the game's scale) */
  value: (l: StatLine, regular: boolean) => number | undefined
  lower?: boolean
  text: (l: StatLine) => string
}

const BAT: Title[] = [
  { id: 'avg', pool: 'bat', stat: 'avg', value: (l) => (l.pa >= QUALIFY_PA ? avgKey(l) : undefined), text: (l) => `打率${avg(l)}で、首位打者のタイトルを獲得しました。` },
  { id: 'hr', pool: 'bat', stat: 'hr', value: (l) => l.hr, text: (l) => `${l.hr}本塁打で、本塁打王のタイトルを獲得しました。` },
  { id: 'rbi', pool: 'bat', stat: 'rbi', value: (l) => l.rbi, text: (l) => `${l.rbi}打点で、打点王のタイトルを獲得しました。` },
  { id: 'sb', pool: 'bat', stat: 'sb', value: (l) => l.sb, text: (l) => `${l.sb}盗塁で、盗塁王のタイトルを獲得しました。` },
  { id: 'h', pool: 'bat', stat: 'h', value: (l) => l.h, text: (l) => `${l.h}安打で、最多安打のタイトルを獲得しました。` },
]
const PITCH: Title[] = [
  { id: 'w', pool: 'sp', stat: 'w', value: (l) => l.w, text: (l) => `${l.w}勝で、最多勝のタイトルを獲得しました。` },
  { id: 'era', pool: 'sp', stat: 'era', value: (l, regular) => (qualifiedStarter('starter', regular, l) ? eraKey(l) : undefined), lower: true, text: (l) => `防御率${era(l)}で、最優秀防御率のタイトルを獲得しました。` },
  { id: 'k', pool: 'sp', stat: 'k', value: (l) => l.k, text: (l) => `${l.k}奪三振で、最多奪三振のタイトルを獲得しました。` },
]
/** the titles of the statistics (the others are awards and big moments) */
export const STAT_TITLES: HonourId[] = [...BAT, ...PITCH].map((x) => x.id)

const POOLS = rivals.pools as unknown as Record<string, Record<string, Hist>>

/** the share of the pool's seasons below x (ties count half); for a "lower is better" figure, the share above it */
export function shareBelow(h: Hist, x: number, lower = false): number {
  let n = 0
  let below = 0
  let tie = 0
  for (const [v, c] of h) {
    n += c
    if (v === x) tie += c
    else if (lower ? v > x : v < x) below += c
  }
  return n ? (below + tie / 2) / n : 0
}

/** the chance that a season with this value is first among k players: better than k − 1 rivals of the pool */
export function firstAmong(pool: string, stat: string, x: number, k: number, lower = false): number {
  const h = POOLS[pool]?.[stat]
  if (!h) return 0
  return shareBelow(h, x, lower) ** Math.max(0, k - 1)
}

/** the honours of the record (absent in older saves) */
export function honoursOf(s: LifeState) {
  return s.bb?.rec?.honours ?? []
}

/** how many times each honour was won, in the order of HONOUR_ORDER */
export const HONOUR_ORDER: HonourId[] = ['mvp', 'avg', 'hr', 'rbi', 'sb', 'h', 'w', 'era', 'k', 'rookie', 'best9', 'perfect', 'nohit', 'champion', 'jseries', 'allstar']
export function honourCounts(s: LifeState): [HonourId, number][] {
  const n = new Map<HonourId, number>()
  for (const h of honoursOf(s)) n.set(h.id, (n.get(h.id) ?? 0) + 1)
  return HONOUR_ORDER.filter((id) => n.has(id)).map((id) => [id, n.get(id)!])
}

/** NPB's 新人王 eligibility before this season: within 5 years of joining, ≤ 60 PA / ≤ 30 innings in the 1軍 before, no pro play abroad */
function rookieEligible(s: LifeState, pitcher: boolean): boolean {
  const rows = s.bb?.rec?.tournaments ?? []
  if (rows.some((t) => t.level === 'mlb') || s.timeline.some((t) => t.phase === 'abroad')) return false
  const proAges = rows.filter((t) => t.level === 'pro' || t.level === 'farm').map((t) => t.age)
  if (!proAges.length || s.age - Math.min(...proAges) > 4) return false
  const before = rows.filter((t) => t.level === 'pro' && t.age < s.age)
  return pitcher ? before.reduce((a, t) => a + t.line.outs, 0) <= 90 : before.reduce((a, t) => a + t.line.pa, 0) <= 60
}

/**
 * The honours of this year's 1軍 season (the row proSeason has just written), after the season: titles, the Japan Series, the
 * awards, the All-Star game and a no-hitter. Nothing in a year without 1軍 games or in the year of a 戦力外 notice.
 */
export function seasonHonours(c: EventCtx, released: boolean) {
  const s = c.s
  const r = c.rng
  const rec = records(s)
  const line = rec.tournaments.find((t) => t.age === s.age && t.level === 'pro')?.line
  if (!line?.games || released) return
  const add = (id: HonourId) => (rec.honours ??= []).push({ age: s.age, id })
  const type = proType(s)
  const pitcher = type !== 'batter'
  const regular = s.bb?.role === 'starter'
  const league = orgById(s.career.orgId)?.league === 'セントラル・リーグ' ? 'C' : 'P'
  const rows = leaders.rows.filter((x) => x.league === league)
  const rival: Row = rows[r.int(0, rows.length - 1)]
  const great = greatSeason(line, type)

  // the titles: first place among as many players as qualified in one real season of his league
  const rivalsOf = { bat: rival.qualB, sp: rival.qualP }
  const titles = (pitcher ? PITCH : BAT).filter((x) => {
    const v = x.value(line, regular)
    return v !== undefined && r.chance(firstAmong(x.pool, x.stat, v, rivalsOf[x.pool], x.lower))
  })
  for (const x of titles) {
    add(x.id)
    c.add('big', x.text(line), { key: true, statIds: ['npbTitleRivals', 'npbQualify'] })
  }

  // a no-hitter (starters), with NPB's rate per start
  if (type === 'starter' && r.chance(1 - (1 - NO_HIT_PER_START) ** line.games)) {
    if (r.chance(PERFECT_SHARE)) {
      add('perfect')
      c.add('big', '完全試合を達成しました。27人の打者を、1人も塁に出しませんでした。最後の打者を打ち取ると、仲間がマウンドに駆け寄ってきました。', { key: true, statIds: ['npbNoHitRate', 'npbPerfectShare'] })
    } else {
      add('nohit')
      c.add('big', 'ノーヒットノーランを達成しました。最後の打者を打ち取ると、仲間がマウンドに駆け寄ってきました。', { key: true, statIds: ['npbNoHitRate'] })
    }
  }

  // the All-Star game (the game's rule: a season with a title or a great one, else a regular's or a bench player's chance)
  const star = titles.length > 0 || great
  if (r.chance(star ? ALL_STAR.star : s.bb?.role === 'starter' ? ALL_STAR.regular : s.bb?.role === 'bench' ? ALL_STAR.bench : 0)) {
    add('allstar')
    c.add('good', 'オールスターゲームに選ばれ、出場しました。', { statIds: ['npbAllStar'] })
  }

  // the Japan Series: his club is one of the two league champions, and wins it or not
  const series = r.chance(JAPAN_SERIES)
  if (series) {
    add('jseries')
    if (r.chance(0.5)) {
      add('champion')
      c.add('big', 'チームがリーグの代表として日本シリーズに進み、日本一になりました。', { key: true, statIds: ['npbJapanSeries'] })
    } else {
      c.add('good', 'チームがリーグの代表として日本シリーズに進みました。日本一にはあと一歩届きませんでした。', { statIds: ['npbJapanSeries'] })
    }
  }

  // the awards others choose (the game's rules): MVP, ベストナイン, 新人王
  const score = titles.length + (series ? 1 : 0)
  if (score >= 3 || (score === 2 && r.chance(AWARD_EVEN))) {
    add('mvp')
    c.add('big', 'リーグの最優秀選手（MVP）に選ばれました。', { key: true, statIds: ['npbAwardRule'] })
  }
  const best9 = pitcher
    ? type === 'starter' && (titles.some((x) => x.id === 'w' || x.id === 'era') || (titles.length > 0 && r.chance(AWARD_EVEN)))
    : line.pa >= QUALIFY_PA && (titles.length > 0 || ((line.h / Math.max(1, line.ab) >= 0.3 || line.hr >= 25) && r.chance(AWARD_EVEN)))
  if (best9) {
    add('best9')
    c.add('good', 'ベストナインに選ばれました。', { statIds: ['npbAwardRule'] })
  }
  if (!honoursOf(s).some((h) => h.id === 'rookie') && rookieEligible(s, pitcher)) {
    const good =
      titles.length > 0 ||
      (type === 'batter' && line.pa >= 300 && line.h / Math.max(1, line.ab) >= 0.27) ||
      (type === 'starter' && line.w >= 8 && line.er * 27 < line.outs * 3) ||
      (type === 'reliever' && line.games >= 40 && line.er * 27 < line.outs * 2.5)
    if (good && r.chance(ROOKIE_CHANCE)) {
      add('rookie')
      c.add('good', '最優秀新人（新人王）に選ばれました。', { statIds: ['npbAwardRule'] })
    }
  }
}
