import type { EventCtx } from './events.ts'
import type { HonourId, LifeState, StatLine } from './types.ts'
import { avg, era, records } from './games.ts'
import { greatSeason, proType } from './careerSeason.ts'
import { orgById } from '../data/orgs.ts'
import leaders from '../data/npb-leaders.json' with { type: 'json' }

// The personal titles and the big moments of an NPB player's 1軍 season (Japan's pro years only). Everything here only reads the
// season already played (careerSeason.ts proSeason) and draws on its own stream (the caller's eventCtx): it writes lines and the
// record of honours (Records.honours) and changes nothing else, so no calibrated check, pay or later event of the life moves.
//
// - The titles compare the season with the first-place figures of one real league season (src/data/npb-leaders.json, NPB's
//   「リーダーズ」 2015–2025 without the 120-game 2020, the player's league, one season drawn for the year): a season that reaches
//   that leader's figure wins the title (stat npbTitleLeaders). 首位打者 and 最優秀防御率 need the 規定打席 / 規定投球回 (npbQualify).
// - The no-hitter has NPB's rate per start (npbNoHitRate), the perfect game its share of the no-hitters (npbPerfectShare); the Japan
//   Series is two clubs of twelve and one winner of two, the same for every club (npbJapanSeries).
// - MVP, ベストナイン, 新人王 and the All-Star game are chosen by others; the game decides them by rules of its own
//   (npbAwardRule, npbAllStar). The 新人王's eligibility is NPB's (5 years, 60 PA / 30 innings before, no pro play abroad).

type Row = (typeof leaders.rows)[number]

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

const BAT: { id: HonourId; reached: (l: StatLine, r: Row) => boolean; text: (l: StatLine) => string }[] = [
  { id: 'avg', reached: (l, r) => l.pa >= QUALIFY_PA && Math.round((1000 * l.h) / Math.max(1, l.ab)) >= Math.round(1000 * r.avg), text: (l) => `打率${avg(l)}で、首位打者のタイトルを獲得しました。` },
  { id: 'hr', reached: (l, r) => l.hr >= r.hr, text: (l) => `${l.hr}本塁打で、本塁打王のタイトルを獲得しました。` },
  { id: 'rbi', reached: (l, r) => l.rbi >= r.rbi, text: (l) => `${l.rbi}打点で、打点王のタイトルを獲得しました。` },
  { id: 'sb', reached: (l, r) => l.sb >= r.sb, text: (l) => `${l.sb}盗塁で、盗塁王のタイトルを獲得しました。` },
  { id: 'h', reached: (l, r) => l.h >= r.h, text: (l) => `${l.h}安打で、最多安打のタイトルを獲得しました。` },
]
const PITCH: typeof BAT = [
  { id: 'w', reached: (l, r) => l.w >= r.w, text: (l) => `${l.w}勝で、最多勝のタイトルを獲得しました。` },
  { id: 'era', reached: (l, r) => l.outs >= QUALIFY_OUTS && Math.round((100 * 27 * l.er) / l.outs) <= Math.round(100 * r.era), text: (l) => `防御率${era(l)}で、最優秀防御率のタイトルを獲得しました。` },
  { id: 'k', reached: (l, r) => l.k >= r.k, text: (l) => `${l.k}奪三振で、最多奪三振のタイトルを獲得しました。` },
]

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
  const league = orgById(s.career.orgId)?.league === 'セントラル・リーグ' ? 'C' : 'P'
  const rows = leaders.rows.filter((x) => x.league === league)
  const rival = rows[r.int(0, rows.length - 1)]
  const great = greatSeason(line, type)

  // the titles: the season against the leaders of one real season of his league
  const titles = (pitcher ? PITCH : BAT).filter((x) => x.reached(line, rival))
  for (const x of titles) {
    add(x.id)
    c.add('big', x.text(line), { key: true, statIds: ['npbTitleLeaders', 'npbQualify'] })
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
