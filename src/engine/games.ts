import type { LifeState, Level, Records, SkillKey, StatLine } from './types.ts'
import type { Rng } from './rng.ts'
import { clamp } from './math.ts'
import { skillScore } from './ability.ts'
import { performanceZ } from './potential.ts'
import { normCdf } from './math.ts'
import { CALIBRATION } from '../data/calibration.ts'

// Games and records (PROJECT_PLAN §11.2, stages 3–4). Everything here is a model value: the player's own
// in-game record, never a real player's or a real team's result.
// Definitions shown on screen:
//   公式戦 = tournament, league and pro regular-season games; 練習試合 = practice games (including B-team
//   games for non-regulars, オープン戦 after high school);
//   高校通算本塁打 = home runs in 公式戦 + 練習試合 during high school (in-game record);
//   プロの記録 = 1軍 ('pro') and 2軍 ('farm') official games, kept apart.

export function emptyLine(): StatLine {
  return { games: 0, pa: 0, ab: 0, h: 0, hr: 0, rbi: 0, sb: 0, outs: 0, k: 0, er: 0, w: 0, l: 0 }
}

export function addLine(a: StatLine, b: StatLine): StatLine {
  const out = emptyLine()
  for (const k of Object.keys(out) as (keyof StatLine)[]) out[k] = a[k] + b[k]
  return out
}

export function records(s: LifeState): Records {
  const bb = s.bb!
  return (bb.rec ??= { official: {}, practice: {}, tournaments: [], marks: [] })
}

export function addRecord(rec: Records, kind: 'official' | 'practice', level: Level, line: StatLine) {
  rec[kind][level] = addLine(rec[kind][level] ?? emptyLine(), line)
}

interface LevelPlay {
  /** ability (z) of the players met at this level: mean and spread */
  mean: number
  sd: number
  /** base rates of an average player: hit per at-bat (besides home runs), home run per at-bat, ERA */
  hit: number
  hr: number
  era: number
}

/**
 * The play model after high school (model settings, stat seasonModel). The opposition is the players who
 * take the field at each level: from the ability of those who reach it in this model (100,000 lives,
 * 2026-10-18: university 0.58±0.89, company 1.48±0.81 and independent 1.12±0.81, together about
 * 1.35±0.81; pro from the calibration's NPB roster), the upper half for university and adult teams, the
 * top third of the roster in the 1軍, a little below the roster mean in the 2軍. Base rates are settings.
 */
const LEVEL_PLAY: Partial<Record<Level, LevelPlay>> = {
  univ: { mean: 0.58 + 0.5 * 0.89, sd: 0.89, hit: 0.25, hr: 0.011, era: 2.6 },
  amateur: { mean: 1.35 + 0.5 * 0.81, sd: 0.81, hit: 0.25, hr: 0.013, era: 3.0 },
  farm: { mean: CALIBRATION.npbZMean - 0.2 * CALIBRATION.npbZSd, sd: CALIBRATION.npbZSd, hit: 0.245, hr: 0.016, era: 3.6 },
  pro: { mean: CALIBRATION.npbZMean + 1.0 * CALIBRATION.npbZSd, sd: CALIBRATION.npbZSd, hit: 0.24, hr: 0.022, era: 3.3 },
  // a Japanese player's games in the MLB (assumption, no data: the players met are stronger than NPB's 1軍 by 0.8 of NPB's spread;
  // more home runs and a higher ERA than NPB's)
  mlb: { mean: CALIBRATION.npbZMean + 1.8 * CALIBRATION.npbZSd, sd: CALIBRATION.npbZSd, hit: 0.245, hr: 0.03, era: 4.1 },
}
/**
 * weight of the skill profile after high school: the profile grows with years of the same practice menu
 * (to about one sd), and the players met at these levels have trained too (assumption)
 */
const PROFILE_WEIGHT = 0.35

/**
 * One game for the player. `pa` = plate appearances (0 if he only pitches or does not play),
 * `outs` = outs he records as a pitcher.
 * Rates are model settings (stat abilityModel; after high school stat seasonModel): a batter's chance of
 * a hit and of a home run grow with his contact and power relative to the opposition.
 * `form` (after high school only): a season-long shift in sd units, e.g. a year of injury and slump that a
 * calibrated check (a 戦力外 notice) has already decided.
 */
/**
 * How much stronger or weaker than the average team of its kind the player's own team is, in sd units of the level
 * (PROJECT_PLAN §11.16): a player of a university in a top league, of a company team that reached the national
 * championship, or of a strong independent league meets better pitchers and batters than one of the same ability
 * in a weaker one, so the same ability gives a poorer line there. Only after high school.
 */
export function leagueShift(s: LifeState, level: Level, sd: number): number {
  const b = s.bb
  const mean = { univ: 0.55, company: 1.4, indep: 1.05 }[s.career.phase as 'univ' | 'company' | 'indep']
  if (!b || mean === undefined || (level !== 'univ' && level !== 'amateur')) return 0
  return clamp(((b.teamStrength - mean) / sd) * 0.8, -0.6, 0.6)
}

export function playGame(s: LifeState, rng: Rng, level: Level, pa: number, outs: number, form = 0): StatLine {
  const line = emptyLine()
  line.games = 1
  const lp = LEVEL_PLAY[level]
  // up to high school: the displayed skill (position among peers of the same age); after it: ability
  // relative to the players met at that level (and, in a stronger league or team, relative to better players)
  const lShift = lp ? leagueShift(s, level, lp.sd) : 0
  const pz = performanceZ(s)
  const rel = (k: SkillKey) => (lp ? (pz - lp.mean) / lp.sd + PROFILE_WEIGHT * (s.bb?.skills[k] ?? 0) + form - lShift : (skillScore(s, k) - 50) / 15)
  const cond = (s.bb?.condition ?? 0) * 0.15
  if (pa > 0) {
    const pHit = lp ? clamp(lp.hit + 0.025 * rel('contact') + 0.02 * cond, 0.12, 0.36) : clamp(0.26 + 0.035 * rel('contact') + 0.02 * cond, 0.08, 0.48)
    const pHr = lp ? clamp(lp.hr * Math.exp(0.55 * rel('power') + cond), 0.0005, 0.09) : clamp(0.012 * Math.exp(0.75 * rel('power') + cond), 0.0005, 0.12)
    const pWalk = 0.09
    for (let i = 0; i < pa; i++) {
      line.pa++
      if (rng.chance(pWalk)) continue
      line.ab++
      if (rng.chance(pHr)) {
        line.h++
        line.hr++
        line.rbi += 1 + (rng.chance(0.4) ? 1 : 0) + (rng.chance(0.12) ? 1 : 0)
      } else if (rng.chance(pHit)) {
        line.h++
        if (rng.chance(0.35)) line.rbi++
      }
    }
    if (rng.chance(clamp(0.05 + 0.03 * rel('speed'), 0, 0.3))) line.sb++
  }
  if (outs > 0) {
    line.outs = outs
    const inn = outs / 3
    const kRate = lp ? clamp(0.8 + 0.15 * rel('velocity') + 0.08 * rel('breaking'), 0.3, 1.5) : clamp(0.75 + 0.18 * rel('velocity') + 0.08 * rel('breaking'), 0.2, 1.8)
    line.k = Math.round(inn * kRate + rng.normal() * 0.8)
    if (line.k < 0) line.k = 0
    const era = lp ? clamp(lp.era - 0.5 * rel('control') - 0.4 * rel('velocity') - 0.4 * cond, 0.8, 9) : clamp(4.2 - 0.9 * rel('control') - 0.6 * rel('velocity') - 0.5 * cond, 0.4, 12)
    line.er = Math.max(0, Math.round((era * inn) / 9 + rng.normal() * 0.9))
  }
  return line
}

/**
 * how a player takes part in a game, by role. In high school the ace pitches every game of a knock-out
 * tournament; after it a starting pitcher takes his turn (`startShare` of the games: about every other
 * game in a university weekend series, less in a long league season) and relieves now and then, and
 * pitchers do not bat (assumptions)
 */
export function participation(s: LifeState, rng: Rng, level: Level = 'hs', startShare = level === 'univ' ? 0.45 : 0.3): { pa: number; outs: number } {
  const role = s.bb?.role ?? 'none'
  const pitcher = s.person.position === 'P'
  if (pitcher && LEVEL_PLAY[level]) {
    if (role === 'starter') return rng.chance(startShare) ? { pa: 0, outs: rng.int(15, 27) } : rng.chance(0.15) ? { pa: 0, outs: rng.int(1, 6) } : { pa: 0, outs: 0 }
    if (role === 'bench') return rng.chance(0.35) ? { pa: 0, outs: rng.int(1, 6) } : { pa: 0, outs: 0 }
    return { pa: 0, outs: 0 }
  }
  if (role === 'starter') return pitcher ? { pa: rng.int(2, 4), outs: rng.int(15, 27) } : { pa: rng.int(3, 5), outs: 0 }
  if (role === 'bench') {
    if (pitcher) return rng.chance(0.5) ? { pa: 0, outs: rng.int(3, 9) } : { pa: 0, outs: 0 }
    return rng.chance(0.45) ? { pa: 1, outs: 0 } : { pa: 0, outs: 0 }
  }
  return { pa: 0, outs: 0 }
}

// ---------------------------------------------------------------- high school (PROJECT_PLAN §11.16)

/**
 * The play model of high school baseball (model settings, stat hsPlayModel). The players met are the other high
 * school players: about 0.35 ± 0.9 on the ability scale for a school of average strength, a little stronger for a
 * strong school (it plays strong schools, above all in practice games). Base rates are those of an average high
 * school player: batting about .250 with 1% home runs, an ERA of about 4.6, about 6.5 strikeouts per nine innings.
 * It replaces the earlier rates, which gave an ordinary player a .315 average and a 2.6 ERA.
 */
const HS_PLAY = { mean: 0.35, sd: 0.9, hit: 0.225, hr: 0.014, era: 4.6, k: 0.72 }
/** the strength of the school against which his line is made (the calibrated draw of the team's strength) */
const teamOf = (s: LifeState) => s.bb?.teamStrength ?? 0
/** how strong the opposition is for this school: strong schools meet strong schools (assumption) */
const oppShift = (s: LifeState) => 0.3 * (teamOf(s) - 0.3)

/** one game of a high school player (batting and pitching drawn with the high school rates above) */
export function playGameHs(s: LifeState, rng: Rng, pa: number, outs: number): StatLine {
  const line = emptyLine()
  line.games = 1
  const opp = HS_PLAY.mean + oppShift(s)
  const rel = (k: SkillKey) => (performanceZ(s) - opp) / HS_PLAY.sd + 0.5 * (s.bb?.skills[k] ?? 0)
  const cond = (s.bb?.condition ?? 0) * 0.15
  if (pa > 0) {
    const pHit = clamp(HS_PLAY.hit + 0.038 * rel('contact') + 0.02 * cond, 0.1, 0.36)
    const pHr = clamp(HS_PLAY.hr * Math.exp(0.75 * rel('power') + cond), 0.0004, 0.1)
    for (let i = 0; i < pa; i++) {
      line.pa++
      if (rng.chance(0.09)) continue
      line.ab++
      if (rng.chance(pHr)) {
        line.h++
        line.hr++
        line.rbi += 1 + (rng.chance(0.4) ? 1 : 0) + (rng.chance(0.12) ? 1 : 0)
      } else if (rng.chance(pHit)) {
        line.h++
        if (rng.chance(0.35)) line.rbi++
      }
    }
    if (rng.chance(clamp(0.06 + 0.03 * rel('speed'), 0, 0.3))) line.sb++
  }
  if (outs > 0) {
    line.outs = outs
    const inn = outs / 3
    const kRate = clamp(HS_PLAY.k + 0.14 * rel('velocity') + 0.08 * rel('breaking'), 0.2, 1.6)
    line.k = Math.max(0, Math.round(inn * kRate + rng.normal() * 0.8))
    const era = clamp(HS_PLAY.era - 0.55 * rel('control') - 0.45 * rel('velocity') - 0.4 * cond, 0.6, 11)
    line.er = Math.max(0, Math.round((era * inn) / 9 + rng.normal() * 0.9))
  }
  return line
}

/** the share of a team's pitching he takes: the ace of a weak school pitches nearly every game, a good pitcher of a strong school shares */
export function aceShare(s: LifeState): number {
  return clamp(normCdf((s.z + 0.3 * (s.bb?.skills.velocity ?? 0) - 0.6 * teamOf(s) - 0.1) / 0.7), 0.1, 0.92)
}

/** a game of a knock-out tournament: who plays and how long (high school) */
export function participationHs(s: LifeState, rng: Rng): { pa: number; outs: number } {
  const role = s.bb?.role ?? 'none'
  const pitcher = s.person.position === 'P'
  const ace = aceShare(s)
  if (role === 'starter') {
    if (pitcher) return rng.chance(ace) ? { pa: rng.int(2, 4), outs: ace > 0.6 ? rng.int(18, 27) : rng.int(9, 21) } : { pa: rng.chance(0.5) ? rng.int(2, 4) : 0, outs: 0 }
    return { pa: rng.int(3, 5), outs: 0 }
  }
  if (role === 'bench') {
    if (pitcher) return rng.chance(0.3 * ace + 0.1) ? { pa: 0, outs: rng.int(3, 9) } : { pa: 0, outs: 0 }
    return rng.chance(0.45) ? { pa: 1, outs: 0 } : { pa: 0, outs: 0 }
  }
  return { pa: 0, outs: 0 }
}

/**
 * practice games of a year: how many depends on the school (a strong school plays many more, B-team games
 * included; a weak one few), and who plays in them on his place in the team (assumption)
 */
export function practiceCountHs(s: LifeState, rng: Rng): number {
  const n = 44 + 32 * (teamOf(s) - 0.3)
  return clamp(Math.round(n * Math.exp(rng.normal() * 0.2)), 18, 110)
}

export function practiceSeasonHs(s: LifeState, rng: Rng, games: number): StatLine {
  const role = s.bb?.role ?? 'none'
  const pitcher = s.person.position === 'P'
  const ace = aceShare(s)
  let total = emptyLine()
  for (let g = 0; g < games; g++) {
    let p = { pa: 0, outs: 0 }
    if (role === 'starter') {
      if (pitcher) p = { pa: rng.chance(0.5) ? rng.int(1, 3) : 0, outs: rng.chance(0.15 + 0.35 * ace) ? rng.int(6, 15) : 0 }
      else p = rng.chance(0.88) ? { pa: rng.int(2, 4), outs: 0 } : p
    } else if (role === 'bench') {
      if (pitcher) p = rng.chance(0.3) ? { pa: 0, outs: rng.int(3, 9) } : p
      else p = rng.chance(0.5) ? { pa: rng.int(1, 3), outs: 0 } : p
    } else if (rng.chance(0.35)) {
      // outside the squad: B-team games now and then
      p = pitcher ? { pa: 0, outs: rng.int(6, 12) } : { pa: rng.int(2, 4), outs: 0 }
    }
    if (p.pa === 0 && p.outs === 0) continue
    total = addLine(total, playGameHs(s, rng, p.pa, p.outs))
  }
  addRecord(records(s), 'practice', 'hs', total)
  return total
}

/** a season of practice games (B-team games for players outside the squad) */
export function practiceSeason(s: LifeState, rng: Rng, level: Level, games: number): StatLine {
  if (level === 'hs') return practiceSeasonHs(s, rng, games)
  const rec = records(s)
  let total = emptyLine()
  const role = s.bb?.role ?? 'none'
  for (let g = 0; g < games; g++) {
    let p = participation(s, rng, level)
    // outside the squad: still plays in B-team games now and then
    if (role === 'outside' || role === 'none') p = rng.chance(0.4) ? (s.person.position === 'P' ? { pa: 0, outs: rng.int(6, 15) } : { pa: rng.int(2, 4), outs: 0 }) : { pa: 0, outs: 0 }
    if (p.pa === 0 && p.outs === 0) continue
    total = addLine(total, playGame(s, rng, level, p.pa, p.outs))
  }
  addRecord(rec, 'practice', level, total)
  return total
}

export interface LeagueResult {
  wins: number
  losses: number
  /** the team's place in the league (1 = champion) */
  rank: number
  teams: number
  champion: boolean
  line: StatLine
}

/**
 * A league season (round robin) for the player's team: each game won with `winP`; the other teams share
 * the rest of the wins (no ties; assumption), which gives the team's place. The player's line is official.
 */
export function leagueSeason(s: LifeState, rng: Rng, level: Level, games: number, winP: number, teams = 6, startShare?: number): LeagueResult {
  let line = emptyLine()
  let wins = 0
  for (let g = 0; g < games; g++) {
    const won = rng.chance(winP)
    if (won) wins++
    const p = participation(s, rng, level, startShare)
    if (p.pa === 0 && p.outs === 0) continue
    const gl = playGame(s, rng, level, p.pa, p.outs)
    if (p.outs >= 15) {
      if (won) gl.w = 1
      else gl.l = 1
    }
    line = addLine(line, gl)
  }
  const q = clamp((teams * 0.5 - wins / games) / (teams - 1), 0.05, 0.95)
  let rank = 1
  for (let t = 1; t < teams; t++) {
    let w = 0
    for (let g = 0; g < games; g++) if (rng.chance(q)) w++
    if (w > wins || (w === wins && rng.chance(0.5))) rank++
  }
  addRecord(records(s), 'official', level, line)
  return { wins, losses: games - wins, rank, teams, champion: rank === 1, line }
}

export interface TournamentResult {
  /** rounds won */
  wins: number
  /** total rounds in the bracket (or the national stage) */
  rounds: number
  champion: boolean
  line: StatLine
  /**
   * high school only: the line the earlier game model drew on the same random stream. What the tournament does to
   * the player's confidence and the coach's view (and so his place in the squad, which the calibrated Koshien and
   * staying checks read) is still taken from it, so the calibrated lives do not move when the records improve.
   */
  feel?: StatLine
  /** high school only: each game he played, in order (the shown record's own lines; season.ts tells the one worth telling) */
  games?: HsGame[]
}

/** one game of a high school tournament that he played: its round (0 = the first), won or lost, and his line */
export interface HsGame {
  round: number
  won: boolean
  line: StatLine
}

/**
 * A knock-out tournament for the player's team. `mustWin` / `mustLose`: the outcome was already decided
 * by a calibrated check (e.g. reaching Koshien) and the games are drawn to agree with it.
 */
export function knockout(s: LifeState, rng: Rng, level: Level, rounds: number, winP: number, opts: { mustWin?: boolean; mustLose?: boolean } = {}): TournamentResult {
  // (the high school record comes from its own stream, forked before anything is drawn here)
  const alt = level === 'hs' ? rng.fork(0xb0 + rounds) : undefined
  let wins = 0
  if (opts.mustWin) wins = rounds
  else {
    while (wins < rounds && rng.chance(winP)) wins++
    if (opts.mustLose && wins === rounds) wins = rounds - 1
  }
  const played = Math.min(rounds, wins + 1)
  let line = emptyLine()
  for (let g = 0; g < played; g++) {
    const p = participation(s, rng, level)
    if (p.pa === 0 && p.outs === 0) continue
    const gl = playGame(s, rng, level, p.pa, p.outs)
    if (p.outs >= 15) {
      if (g < wins) gl.w = 1
      else gl.l = 1
    }
    line = addLine(line, gl)
  }
  if (alt) {
    let shown = emptyLine()
    const games: HsGame[] = []
    for (let g = 0; g < played; g++) {
      const p = participationHs(s, alt)
      if (p.pa === 0 && p.outs === 0) continue
      const gl = playGameHs(s, alt, p.pa, p.outs)
      if (p.outs >= 15) {
        if (g < wins) gl.w = 1
        else gl.l = 1
      }
      shown = addLine(shown, gl)
      games.push({ round: g, won: g < wins, line: gl })
    }
    addRecord(records(s), 'official', level, shown)
    return { wins, rounds, champion: wins === rounds, line: shown, feel: line, games }
  }
  addRecord(records(s), 'official', level, line)
  return { wins, rounds, champion: wins === rounds, line }
}

export function battingText(l: StatLine): string {
  if (l.pa === 0) return ''
  return `${l.ab}打数${l.h}安打${l.hr ? `${l.hr}本塁打` : ''}${l.rbi ? `${l.rbi}打点` : ''}`
}

export function pitchingText(l: StatLine): string {
  if (l.outs === 0) return ''
  const ip = `${Math.floor(l.outs / 3)}${l.outs % 3 ? `回${l.outs % 3}/3` : '回'}`
  return `${ip}を投げて${l.k}奪三振・自責点${l.er}`
}

export function avg(l: StatLine): string {
  return l.ab ? (l.h / l.ab).toFixed(3).replace(/^0/, '') : '—'
}

export function era(l: StatLine): string {
  return l.outs ? ((l.er * 27) / l.outs).toFixed(2) : '—'
}

/** official games of one age at one level (sum of that year's tournament, league and season entries) */
export function lineAt(s: LifeState, age: number, level: Level): StatLine {
  const rec = s.bb?.rec
  if (!rec) return emptyLine()
  return rec.tournaments.filter((t) => t.age === age && (t.level ?? 'hs') === level).reduce((a, t) => addLine(a, t.line), emptyLine())
}

/** high-school career home runs = official + practice games (in-game record) */
export function hsCareerHr(s: LifeState): number {
  const rec = s.bb?.rec
  if (!rec) return 0
  return (rec.official.hs?.hr ?? 0) + (rec.practice.hs?.hr ?? 0)
}
