import type { EventCtx } from './events.ts'
import type { Level, LifeState } from './types.ts'
import { PREFECTURES } from '../data/jp.ts'
import { orgById, orgLabel } from '../data/orgs.ts'
import { schoolById } from '../data/schools/index.ts'
import { battingText, hsCareerHr, knockout, pitchingText, practiceCountHs, practiceSeason, records, type TournamentResult } from './games.ts'
import { clamp } from './math.ts'

// The high-school season (PROJECT_PLAN §11.2, stage 3): spring and autumn prefectural tournaments, the
// summer championship (prefectural tournament, then Koshien), 選抜, practice games, record milestones.
// Reaching Koshien is decided by the calibrated check (jp.koshien); the games are drawn to agree with it.
// All results are in-game simulations (stated in the note shown with the first real name).

const SUMMER = () => orgLabel(orgById('hs-summer'))
const SPRING = () => orgLabel(orgById('hs-spring'))

/**
 * the prefecture whose tournaments his high school plays (the school's, from the national list; the one he was born in when the school
 * is not known): its name, its number of teams and so its rounds, and the Koshien chance (life.ts koshienCtx) all read it
 */
export function hsPrefecture(s: LifeState): number {
  const id = s.schools?.hs?.id
  const pref = id ? schoolById(id)?.pref : undefined
  const i = pref ? PREFECTURES.findIndex((p) => p.name === pref) : -1
  return i >= 0 ? i : s.person.prefecture
}

function prefRounds(s: LifeState): number {
  const teams = PREFECTURES[hsPrefecture(s)]?.teams ?? 70
  return Math.max(4, Math.ceil(Math.log2(Math.max(8, teams))))
}

/** chance of winning one prefectural game (model setting) */
function prefWinP(s: LifeState): number {
  return clamp(0.5 + 0.22 * (s.bb?.teamStrength ?? 0), 0.2, 0.9)
}

export const ROUND = (k: number, rounds: number) => (k >= rounds ? '優勝' : k === rounds - 1 ? '決勝' : k === rounds - 2 ? '準決勝' : k === rounds - 3 ? '準々決勝' : `${k + 1}回戦`)

export function myPart(r: { line: TournamentResult['line'] }): string {
  const t = [battingText(r.line), pitchingText(r.line)].filter(Boolean).join('、')
  return t ? `自分は${r.line.games}試合で${t}。` : ''
}

/** effects of a tournament on the player (model) */
function feel(c: EventCtx, r: TournamentResult) {
  const b = c.s.bb!
  const l = r.feel ?? r.line
  const good = l.h >= 4 || l.hr > 0 || (l.outs >= 27 && l.er * 27 < l.outs * 3)
  b.confidence = clamp(b.confidence + (good ? 6 : l.games > 0 && l.h === 0 && l.outs === 0 ? -4 : 0), 0, 100)
  b.coachEval = clamp(b.coachEval + (good ? 4 : 0), 0, 100)
  c.s.status.happiness = clamp(c.s.status.happiness + (r.champion ? 10 : r.wins >= 2 ? 3 : -2), 5, 100)
}

/** who the team met, in general words (never a real school's name beside a score the game made up) */
// (a seeded school is not met in the first round: OPP_SEED from the second)
const OPP_PREF = ['昨夏の代表校', '公立の伏兵', '同じ地区のライバル校', '私立の強豪', '勢いのある新興校']
const OPP_SEED = 'シード校'
const OPP_NATIONAL = ['優勝候補の強豪', '初出場の公立校', '近畿の強豪', '九州の代表校', '東北の代表校', '春夏連続出場の強豪']

/**
 * The game of a high school tournament worth telling, in one sentence (feedback: high school felt short, no game stood out): a home
 * run, three hits or more, a complete game won, ten strikeouts, or the defeat that ended it when he did nothing in it; the defeat
 * of the last summer ends with the farewell to the ground. Read from the games he played (TournamentResult.games); the opponent's
 * words and the score come from a fork of the season's stream, which draws nothing from it (the calibrated lives keep their draws).
 * The score agrees with his line: the runs he drove in, the earned runs he gave up.
 */
function highlight(c: EventCtx, name: string, r: TournamentResult, when: string): string {
  const games = r.games ?? []
  const lastSummer = when.startsWith('最後の夏') || (name === `甲子園での${SUMMER()}` && c.s.career.phaseYears + 1 >= 3)
  const farewell = lastSummer && !r.champion ? '試合のあと、仲間と泣きながら、グラウンドに一礼しました。' : ''
  if (games.length === 0) return farewell
  const pitcher = c.s.person.position === 'P'
  const score = (g: (typeof games)[number]) => {
    const l = g.line
    if (l.hr > 0) return 30 + l.hr
    if (pitcher && l.outs >= 27 && g.won && l.er <= 1) return 25
    if (pitcher && l.k >= 10) return 20
    if (l.h >= 3) return 15 + l.h
    if (l.rbi >= 3) return 14
    return 0
  }
  const best = games.reduce((a, b) => (score(b) > score(a) ? b : a))
  const lastGame = games[games.length - 1]
  const lostLast = !r.champion && !lastGame.won && lastGame.round === r.wins
  const quiet = (l: (typeof games)[number]['line']) => (pitcher && l.outs > 0 ? l.er >= 4 : l.pa >= 3 && l.h === 0)
  const g = score(best) > 0 ? best : lostLast && quiet(lastGame.line) ? lastGame : undefined
  if (!g) return farewell
  const h = c.rng.fork(0x9a3e + g.round * 7 + r.rounds)
  const opp = h.pick(name.startsWith('甲子園') ? OPP_NATIONAL : g.round > 0 ? [...OPP_PREF, OPP_SEED] : OPP_PREF)
  const l = g.line
  // the score: ours above theirs in a win; his runs batted in are ours, the earned runs he gave up theirs
  let them = g.won ? h.int(0, 4) : h.int(2, 7)
  if (pitcher && l.outs > 0) them = Math.max(them, l.er)
  // (a complete game: their runs are his earned runs, or one more unearned)
  if (pitcher && l.outs >= 27) them = Math.min(them, l.er + (l.er === 0 && g.won ? 0 : 1))
  let us = g.won ? them + h.int(1, 5) : h.int(0, Math.max(0, them - 1))
  us = Math.max(us, l.rbi)
  if (!g.won && us >= them) them = us + 1
  const sc = `${us}対${them}`
  const round = ROUND(g.round, r.rounds)
  const res = g.won ? `${sc}で勝ちました` : `${sc}で敗れました`
  let t: string
  if (l.hr > 0) t = `${round}の${opp}戦では${l.hr > 1 ? `${l.hr}本の本塁打` : '本塁打'}を打ち、${res}。`
  else if (pitcher && l.outs >= 27 && g.won && l.er <= 1) t = `${round}の${opp}戦では${them === 0 ? '完封' : '完投'}し、${sc}で勝ちました。${l.k}個の三振を奪いました。`
  else if (pitcher && l.k >= 10) t = `${round}の${opp}戦では${l.k}個の三振を奪い、${res}。`
  else if (l.h >= 3) t = `${round}の${opp}戦では${l.h}安打を放ち、${res}。`
  else if (l.rbi >= 3) t = `${round}の${opp}戦では${l.rbi}打点を挙げ、${res}。`
  else t = `${round}の${opp}戦は${sc}で敗れました。${pitcher && l.outs > 0 ? `自分は${l.er}点を失い、` : '自分はヒットが出ず、'}悔しさが残りました。`
  return t + farewell
}

/** a knock-out tournament's line in the life record and its entry in the records (also used after high school) */
export function result(c: EventCtx, name: string, r: TournamentResult, when = '', level: Level = 'hs') {
  const role = c.s.bb?.role
  const text =
    role === 'outside'
      ? `${when}チームは${name}${r.champion ? 'で優勝しました' : `の${ROUND(r.wins, r.rounds)}で敗れました`}。自分はスタンドから声を送りました。`
      : `${when}${name}${r.champion ? 'で優勝しました' : `は${ROUND(r.wins, r.rounds)}で敗れました`}。${myPart(r)}${level === 'hs' ? highlight(c, name, r, when) : ''}`
  c.add(r.champion ? 'big' : r.wins >= r.rounds - 2 ? 'good' : 'milestone', text, { key: r.champion })
  records(c.s).tournaments.push({ age: c.s.age, name, result: r.champion ? '優勝' : ROUND(r.wins, r.rounds), line: r.line, level })
  feel(c, r)
}

export function springTournament(c: EventCtx) {
  const r = knockout(c.s, c.rng, 'hs', prefRounds(c.s), prefWinP(c.s))
  result(c, '春季大会（都道府県）', r)
}

/**
 * The summer championship. `koshien`: the calibrated check put the player on the Koshien bench this year;
 * `viaSpring`: that appearance is 選抜 (spring), so the summer prefectural tournament ends before Koshien.
 */
export function summerTournament(c: EventCtx, koshien: boolean, viaSpring: boolean) {
  const s = c.s
  const pref = PREFECTURES[hsPrefecture(s)]?.name ?? ''
  const outside = s.bb?.role === 'outside'
  const summerKoshien = koshien && !viaSpring
  // a player outside the squad can see his team go without him (the check is about his own bench place)
  const r = knockout(s, c.rng, 'hs', prefRounds(s), prefWinP(s), summerKoshien ? { mustWin: true } : outside ? {} : { mustLose: true })
  const grade = s.career.phaseYears + 1
  result(c, `${SUMMER()}の${pref}大会`, r, grade >= 3 ? '最後の夏、' : `${grade}年生の夏、`)
  if (summerKoshien) nationals(c, SUMMER(), 6)
  else if (outside && r.champion) c.add('normal', 'チームは甲子園に出場しました。メンバーには入れず、アルプススタンドで応援しました。')
}

export function springNationals(c: EventCtx) {
  nationals(c, SPRING(), 5)
}

function nationals(c: EventCtx, name: string, rounds: number) {
  const st = c.s.bb?.teamStrength ?? 0.9
  const r = knockout(c.s, c.rng, 'hs', rounds, clamp(0.45 + 0.15 * (st - 0.9), 0.2, 0.75))
  result(c, `甲子園での${name}`, r)
}

export function fallTournament(c: EventCtx) {
  const r = knockout(c.s, c.rng, 'hs', prefRounds(c.s), prefWinP(c.s))
  const b = c.s.bb!
  b.fallGood = r.wins >= r.rounds - 1
  result(c, '秋季大会（都道府県）', r)
  if (b.fallGood) c.add('good', '秋季地区大会に進みました。春の選抜につながる大会です。')
}

const HR_MARKS = [1, 10, 20, 30, 40, 50, 60]

export function practiceGames(c: EventCtx) {
  const s = c.s
  // (a strong school plays many more practice games than a weak one; the count is drawn on the same stream as before)
  c.rng.int(25, 40)
  practiceSeason(s, c.rng, 'hs', practiceCountHs(s, c.rng))
  const rec = records(s)
  const hr = hsCareerHr(s)
  for (const m of HR_MARKS) {
    const key = `hs.hr.${m}`
    if (hr >= m && !rec.marks.includes(key)) {
      rec.marks.push(key)
      c.add(m >= 30 ? 'big' : 'good', m === 1 ? '高校で初めての本塁打を打ちました（練習試合を含む）。' : `高校通算本塁打が${m}本になりました（公式戦と練習試合の合計、ゲーム内の記録）。`, { key: m >= 30 })
    }
  }
}
