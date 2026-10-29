import type { EventCtx } from './events.ts'
import type { Level, LifeState, StatLine } from './types.ts'
import type { Rng } from './rng.ts'
import { addLine, addRecord, avg, emptyLine, era, knockout, leagueSeason, playGame, practiceSeason, records, type LeagueResult } from './games.ts'
import { clamp, normCdf } from './math.ts'
import { myPart, result } from './season.ts'
import { NPB_MEAN, npbRating } from './route/rating.ts'

// Seasons after high school (PROJECT_PLAN §11.8, stage 4): university leagues and national tournaments,
// the company and independent seasons, the pro 2軍 and 1軍. The career steps (staying on, the draft, the
// first 1軍 game, release) are the calibrated checks in life.ts; the games here are drawn on the event
// stream and agree with them. Tournament names are generic (the real names have not been checked).
// Everything is a model value (stat seasonModel), never a real player's or team's record.

/**
 * scouts' attention (0–100, stat scoutModel): the visiting stage is reached only when a calibrated check has
 * brought scouts (a 志望届 worth filing, a draft); the labels never promise a draft
 */
export const SCOUT_VISIT = 60

export function scoutLabel(v: number): string {
  return v >= SCOUT_VISIT ? 'スカウトが視察に来ている' : v >= 40 ? '注目され始めている' : v >= 20 ? '名前が挙がることがある' : '目立った注目はない'
}

/** how a season's official record moves the scouts' attention (model setting): a few points either way */
export function scoutPerf(l: StatLine, level: Level = 'univ'): number {
  // against what is usual at that level: a .250 average and a 4.5 ERA are ordinary in high school
  const [avg, era] = level === 'hs' ? [0.25, 4.5] : [0.27, 3.2]
  let v = 0
  if (l.pa >= 20) v += (l.h / Math.max(1, l.ab) - avg) * 80 + (l.hr / l.pa) * 150
  if (l.outs >= 45) v += (era - (l.er * 27) / l.outs) * 2.5
  return clamp(Math.round(v), -6, 6)
}

/**
 * team size and strength (z scale) on joining, after high school: [median size, sd, strength, strength sd];
 * the strength is near the ability of the players who reach the level in this model (stat seasonModel)
 */
export const TEAM_AFTER_HS: Record<'univ' | 'company' | 'indep' | 'pro', [number, number, number, number]> = {
  univ: [60, 0.35, 0.55, 0.3],
  company: [30, 0.2, 1.4, 0.2],
  indep: [28, 0.15, 1.05, 0.2],
  pro: [70, 0.1, 2.1, 0.15],
}

/** chance of winning one game against the other teams of the league (model setting) */
function winP(s: LifeState, kind: 'univ' | 'company' | 'indep'): number {
  const mean = TEAM_AFTER_HS[kind][2]
  return clamp(0.5 + 0.6 * ((s.bb?.teamStrength ?? mean) - mean), 0.25, 0.75)
}

function feelLeague(c: EventCtx, r: LeagueResult) {
  const b = c.s.bb!
  const l = r.line
  const good = l.hr >= 3 || (l.ab >= 25 && l.h / l.ab >= 0.33) || (l.outs >= 45 && l.er * 27 < l.outs * 2.5)
  const poor = l.ab >= 15 && l.h / l.ab < 0.15
  b.confidence = clamp(b.confidence + (good ? 5 : poor ? -4 : 0), 0, 100)
  b.coachEval = clamp(b.coachEval + (good ? 4 : 0), 0, 100)
  c.s.status.happiness = clamp(c.s.status.happiness + (r.champion ? 6 : r.rank <= 2 ? 2 : -1), 5, 100)
}

/** a league season's line in the life record and its entry in the records */
function leagueLine(c: EventCtx, label: string, short: string, r: LeagueResult) {
  const out = c.s.bb?.role === 'outside'
  const placeText = r.champion ? '優勝しました' : `${r.rank}位でした`
  const text = out ? `${label}、チームは${placeText}。自分はスタンドから声を送りました。` : `${label}は${placeText}。${myPart(r)}`
  c.add(r.rank <= 2 ? 'good' : 'milestone', text, { key: r.champion && !out })
  records(c.s).tournaments.push({ age: c.s.age, name: short, result: r.champion ? '優勝' : `${r.rank}位`, line: r.line, level: c.s.career.phase === 'univ' ? 'univ' : 'amateur' })
  feelLeague(c, r)
}

// ---------------------------------------------------------------- university

/** one university half-year: the league (round robin), then the national tournament for a champion */
export function univHalf(c: EventCtx, year: number, half: 'spring' | 'fall') {
  const s = c.s
  const r = c.rng
  const h = half === 'spring' ? '春' : '秋'
  const lr = leagueSeason(s, r, 'univ', r.int(10, 14), winP(s, 'univ'))
  leagueLine(c, `大学${year}年の${h}のリーグ戦`, `${h}のリーグ戦`, lr)
  if (!lr.champion) return
  // the autumn national tournament goes through a regional play-off (model: half of the champions get through)
  if (half === 'fall' && !r.chance(0.5)) {
    c.add('milestone', `大学${year}年の秋、地区の代表決定戦で敗れ、秋の全国大会には届きませんでした。`)
    return
  }
  const k = knockout(s, r, 'univ', half === 'spring' ? 5 : 4, clamp(winP(s, 'univ') - 0.05, 0.3, 0.65))
  result(c, `大学の全国大会（${h}）`, k, `大学${year}年、`, 'univ')
}

/** practice games of a university year (オープン戦) */
export function univPractice(c: EventCtx) {
  practiceSeason(c.s, c.rng, 'univ', c.rng.int(15, 30))
}

// ---------------------------------------------------------------- company and independent teams

/** a company team's year: the summer and autumn national tournaments, each after a qualifier, and practice games */
export function companySeason(c: EventCtx, n: number) {
  const s = c.s
  const r = c.rng
  const wp = winP(s, 'company')
  for (const [h, rounds] of [['夏', 5], ['秋', 4]] as const) {
    const q = knockout(s, r, 'amateur', 2, wp)
    records(s).tournaments.push({ age: s.age, name: `${h}の全国大会の予選`, result: q.champion ? '代表権を獲得' : '予選で敗退', line: q.line, level: 'amateur' })
    if (!q.champion) {
      c.add('milestone', `入社${n}年目の${h}、チームは全国大会の予選で敗れました。${myPart(q)}`)
      continue
    }
    c.add('good', `入社${n}年目の${h}、チームは予選を勝ち抜き、全国大会に出場しました。${myPart(q)}`)
    const k = knockout(s, r, 'amateur', rounds, clamp(wp - 0.05, 0.25, 0.65))
    result(c, `社会人野球の${h}の全国大会`, k, `入社${n}年目の${h}、`, 'amateur')
  }
  practiceSeason(s, r, 'amateur', r.int(30, 50))
}

/** an independent league season (a long league: a starting pitcher takes about every fifth game) */
export function indepSeason(c: EventCtx, n: number) {
  const s = c.s
  const lr = leagueSeason(s, c.rng, 'amateur', c.rng.int(50, 70), winP(s, 'indep'), 6, 0.2)
  leagueLine(c, `独立リーグ${n}年目のシーズン`, 'リーグ戦（独立）', lr)
}

// ---------------------------------------------------------------- pro: 2軍 and 1軍

type ProType = 'batter' | 'starter' | 'reliever'

/** games in a season for a player who plays the whole of it at that level (game settings, stat seasonModel) */
export const PRO_GAMES: Record<'first' | 'farm', Record<ProType, number>> = {
  first: { batter: 143, starter: 25, reliever: 55 },
  farm: { batter: 110, starter: 18, reliever: 40 },
}
/** in the year of a 戦力外 notice the player has at most this share of the 1軍 season (model) */
export const RELEASED_SHARE = 0.35
/** and plays below his level that year: injury or slump, in sd units (model) */
const RELEASED_FORM = -1
/** share of the 1軍 season from which he is a regular (and below which mostly a 2軍 player) */
export const REGULAR_SHARE = 0.6
const FIRST_TEAM_SHARE = 0.25

export interface ProSeasonOpts {
  /** 育成: 2軍 games only (育成 players cannot play 1軍 games) */
  ikusei: boolean
  /** the player has played for the first team (this year or before) */
  debuted: boolean
  /** this is the year of his first 1軍 game */
  debutNow: boolean
  /** told this year that there is no contract for next season */
  released: boolean
  /** standing among NPB players in sd units; for 支配下 players it is the one behind this year's salary */
  standing: number
  /** the names of the two levels in the lines (Japan's 1軍 and 2軍 by default; a US life says MLB and マイナー) */
  labels?: { first: string; farm: string }
  /** the season's games at the two levels for the league (Japan's PRO_GAMES by default; the other leagues' own: seasonGames) */
  games?: SeasonGames
}

export type SeasonGames = Record<'first' | 'farm', Record<ProType, number>>

/**
 * a league's games at its two levels from the games of a team's season (the league's real schedule, given with its source where it
 * is defined): the starters' and relievers' games keep NPB's shares of the season (an assumption of the game)
 */
export function seasonGames(first: number, farm: number): SeasonGames {
  const of = (n: number, level: 'first' | 'farm') => ({
    batter: n,
    starter: Math.round((PRO_GAMES[level].starter * n) / PRO_GAMES[level].batter),
    reliever: Math.round((PRO_GAMES[level].reliever * n) / PRO_GAMES[level].batter),
  })
  return { first: of(first, 'first'), farm: of(farm, 'farm') }
}

export function proType(s: LifeState): ProType {
  if (s.person.position !== 'P') return 'batter'
  return (s.bb?.skills.stamina ?? 0) > -0.05 ? 'starter' : 'reliever'
}

/** the year in pro (1 = first): earlier pro seasons in the record, plus years in MLB */
function proYearNo(s: LifeState): number {
  const seasons = new Set((s.bb?.rec?.tournaments ?? []).filter((t) => (t.level === 'pro' || t.level === 'farm') && t.age < s.age).map((t) => t.age))
  return seasons.size + s.timeline.filter((t) => t.phase === 'abroad').length + 1
}

function proGames(s: LifeState, r: Rng, level: 'pro' | 'farm' | 'mlb', n: number, type: ProType, regular: boolean, form: number): StatLine {
  let line = emptyLine()
  for (let g = 0; g < n; g++) {
    const pa = type === 'batter' ? (regular ? r.int(3, 5) : r.chance(0.55) ? r.int(1, 3) : 0) : 0
    const outs = type === 'starter' ? r.int(12, 21) : type === 'reliever' ? r.int(1, 4) : 0
    const gl = playGame(s, r, level, pa, outs, form)
    const u = r.next()
    if (type === 'starter') {
      const [w, l] = gl.er <= 2 && gl.outs >= 15 ? [0.55, 0.1] : gl.er >= 4 ? [0.08, 0.55] : [0.3, 0.3]
      if (u < w) gl.w = 1
      else if (u < w + l) gl.l = 1
    } else if (type === 'reliever') {
      if (u < 0.06) gl.w = 1
      else if (u < 0.12) gl.l = 1
    }
    line = addLine(line, gl)
  }
  return line
}

/** 「…試合に出場し、打率.268・12本塁打・40打点でした。」 */
function seasonText(where: string, l: StatLine, type: ProType): string {
  if (type !== 'batter') return `${where}で${l.games}試合に登板し、${l.w}勝${l.l}敗・防御率${era(l)}でした。`
  if (!l.ab) return `${where}で${l.games}試合に出場しました（代走・守備固めで、打席はなし）。`
  return `${where}で${l.games}試合に出場し、打率${avg(l)}・${l.hr}本塁打・${l.rbi}打点でした。`
}

function seasonEntry(l: StatLine, type: ProType): string {
  return `${l.games}試合・${type === 'batter' ? (l.ab ? `打率${avg(l)}・${l.hr}本塁打` : '打席なし') : `${l.w}勝${l.l}敗・防御率${era(l)}`}`
}

function greatSeason(l: StatLine, type: ProType): boolean {
  if (type === 'batter') return l.pa >= 400 && (l.h / Math.max(1, l.ab) >= 0.3 || l.hr >= 30)
  if (type === 'starter') return l.outs >= 390 && (l.er * 27 < l.outs * 2.5 || l.w >= 13)
  return l.games >= 50 && l.er * 27 < l.outs * 2
}

const MARKS: { key: keyof StatLine; marks: number[]; text: (m: number, first: string) => string; who: 'batter' | 'pitcher' }[] = [
  { key: 'hr', marks: [100, 200, 300, 400, 500], text: (m, f) => `${f}通算${m}本塁打に到達しました（ゲーム内の記録）。`, who: 'batter' },
  { key: 'h', marks: [1000, 2000], text: (m, f) => `${f}通算${m}安打を記録しました（ゲーム内の記録）。`, who: 'batter' },
  { key: 'games', marks: [1000, 2000], text: (m, f) => `${f}通算${m}試合出場を達成しました（ゲーム内の記録）。`, who: 'batter' },
  { key: 'w', marks: [50, 100, 150, 200], text: (m, f) => `${f}通算${m}勝を挙げました（ゲーム内の記録）。`, who: 'pitcher' },
  { key: 'games', marks: [300, 500, 700], text: (m, f) => `${f}通算${m}試合に登板しました（ゲーム内の記録）。`, who: 'pitcher' },
]

/**
 * One pro season. The 1軍 share follows the standing that set this year's salary (so playing time and pay
 * agree); there are no 1軍 games before the first one (the calibrated jp.ichigun check) nor for 育成
 * players, and the year of a 戦力外 notice (jp.npbExit) is a part-time one.
 */
export function proSeason(c: EventCtx, o: ProSeasonOpts) {
  const s = c.s
  const r = c.rng
  const b = s.bb!
  const type = proType(s)
  const L = o.labels ?? { first: '1軍', farm: '2軍' }
  let share = 0
  if (o.debuted && !o.ikusei) {
    // a deeper club (a better record over the last three seasons) has more players ahead of him: the same standing plays
    // less there (zero on average over the twelve clubs; the share only sets the season's games and role, which no
    // calibrated check reads)
    const club = (npbRating(s.career.orgId)?.value ?? NPB_MEAN) - NPB_MEAN
    share = normCdf(0.9 * o.standing - 0.35 - 0.8 * club + r.normal() * 0.35)
    if (o.debutNow) share = Math.min(share * 0.5, 0.3)
    if (o.released) share = Math.min(share, RELEASED_SHARE)
  }
  b.role = share >= REGULAR_SHARE ? 'starter' : share >= FIRST_TEAM_SHARE ? 'bench' : 'outside'
  b.subRole = undefined
  const G = o.games ?? PRO_GAMES
  const n1 = o.debuted && !o.ikusei ? Math.max(o.debutNow ? 1 : 0, Math.round(G.first[type] * share)) : 0
  const farmPlay = clamp(0.55 + 0.2 * o.standing, 0.3, 1)
  const n2 = Math.round(G.farm[type] * (1 - share) * farmPlay)
  const form = o.released ? RELEASED_FORM : 0
  const year = proYearNo(s)
  const first = proGames(s, r, 'pro', n1, type, share >= REGULAR_SHARE, form)
  const farm = proGames(s, r, 'farm', n2, type, true, form)
  const rec = records(s)
  if (first.games) {
    addRecord(rec, 'official', 'pro', first)
    rec.tournaments.push({ age: s.age, name: `${L.first}のシーズン`, result: seasonEntry(first, type), line: first, level: 'pro', team: s.career.team })
  }
  if (farm.games) {
    addRecord(rec, 'official', 'farm', farm)
    rec.tournaments.push({ age: s.age, name: `${L.farm}のシーズン`, result: seasonEntry(farm, type), line: farm, level: 'farm', team: s.career.team })
  }
  const verb = type === 'batter' ? '出場' : '登板'
  const great = !o.released && first.games > 0 && greatSeason(first, type)
  // (an injury is named only when he is injured: PROJECT_PLAN §11.62)
  const why = o.released ? (s.age >= 33 ? '体の衰えを感じる1年でした。' : s.career.injured > 0 ? 'けがと不振に苦しみ、思うような結果を残せませんでした。' : '不振に苦しみ、思うような結果を残せませんでした。') : ''
  if (first.games) {
    c.add(great ? 'good' : 'milestone', `プロ${year}年目、${seasonText(L.first, first, type)}${farm.games ? `${L.farm}では${farm.games}試合に${verb}しました。` : ''}${why}`, { key: great })
  } else if (farm.games) {
    c.add('milestone', `プロ${year}年目は、${seasonText(L.farm, farm, type)}${why}`)
  }
  b.confidence = clamp(b.confidence + (great ? 6 : first.games === 0 && s.career.proDebut ? -3 : 0), 0, 100)
  s.status.happiness = clamp(s.status.happiness + (great ? 5 : first.games === 0 && s.career.proDebut ? -3 : 0), 5, 100)
  // career milestones in the 1軍 (in-game record)
  const tot = rec.official.pro
  if (!tot || !first.games) return
  for (const m of MARKS) {
    if ((m.who === 'pitcher') !== (type !== 'batter')) continue
    for (const k of m.marks) {
      const id = `pro.${m.who}.${m.key}.${k}`
      if (tot[m.key] >= k && !rec.marks.includes(id)) {
        rec.marks.push(id)
        c.add('big', m.text(k, L.first), { key: true })
      }
    }
  }
}

/** games of a whole MLB season for a player who plays all of it (game settings, as PRO_GAMES) */
export const MLB_GAMES: Record<ProType, number> = { batter: 162, starter: 32, reliever: 65 }
/** how far below his NPB standing a player stands among MLB players, in the same sd units (assumption, no data) */
const MLB_GAP = 0.8

/**
 * A Japanese player's season in the MLB (phase 'abroad'), as the NPB seasons are kept: his games on the event stream given (never
 * the calibrated one), in the record as level 'mlb' and in the year's lines. A record only: his role, confidence and happiness, the
 * NPB 1軍 totals and their milestones are left as they were, so the rest of the life (and its calibrated checks) does not move.
 * The share of the season follows his NPB standing less MLB_GAP; the rest of the season he is in the minors (not recorded).
 */
export function mlbSeason(c: EventCtx, standing: number, year: number) {
  const s = c.s
  const r = c.rng
  const type = proType(s)
  const share = normCdf(0.9 * (standing - MLB_GAP) - 0.35 + r.normal() * 0.35)
  const n = Math.round(MLB_GAMES[type] * share)
  const line = proGames(s, r, 'mlb', n, type, share >= REGULAR_SHARE, 0)
  if (!line.games) {
    c.add('milestone', `メジャー${year}年目は、マイナーで過ごす時間が長く、メジャーの試合には出場できませんでした。`)
    return
  }
  const rec = records(s)
  addRecord(rec, 'official', 'mlb', line)
  rec.tournaments.push({ age: s.age, name: 'MLBのシーズン', result: seasonEntry(line, type), line, level: 'mlb', team: s.career.team })
  c.add(greatSeason(line, type) ? 'good' : 'milestone', `メジャー${year}年目、${seasonText('MLB', line, type)}`)
}
