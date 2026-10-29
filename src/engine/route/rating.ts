import type { Level, LifeState } from '../types.ts'
import { clamp, normCdf } from '../math.ts'
import { hashSeed, makeRng } from '../rng.ts'
import { positionFit } from '../ability.ts'
import { heightAt } from '../body.ts'
import { scoutPremium } from '../potential.ts'
import { ORGS, orgById } from '../../data/orgs.ts'
import { DRAFT_META, draftPicksFrom } from '../../data/draftRecords.ts'
import { AMATEUR_TEAMS } from '../../data/teams.ts'
import { FINALS_BY_LEAGUE, FINALS_BY_SCHOOL, koshienOf, leagueSeatOf } from '../../data/schools/index.ts'
import { DIVISIONS, LEAGUE_SOURCES, UNIV_LEAGUES } from '../../data/schools/leagues.ts'
import { npbWinPct } from '../../data/npbRecords.ts'
import { conferenceTier, type UsCollege } from '../../data/usColleges.ts'
import type { School } from '../../data/schools/types.ts'

// Internal strength of teams and the scouts' view of a player (PROJECT_PLAN §11.14). Nothing here is a
// statistic: the numbers are game assumptions on the same scale as the ability z, never shown to the player
// (only words are). What is known about a team (its league and division, a place in the 日本選手権's list) is
// kept apart from the number made of it: `basis` says whether the facts behind a rating were read from an
// official page, from a secondary page, or are only assumed.

export type Basis = 'verified' | 'secondary' | 'estimated'
export const BASIS_LABEL: Record<Basis, string> = { verified: '公式資料で確認', secondary: '二次資料で確認', estimated: '推定（確認できていない）' }

export interface TeamRating {
  /** strength on the team-strength scale of the model (joinTeam, TEAM_AFTER_HS) */
  value: number
  basis: Basis
  /** league and division, when known */
  league?: string
  /** how the number was made (for the statistics page and the tests) */
  why: string
  /** facts shown beside the team's name (e.g. 「甲子園 夏3回・春1回」) */
  note?: string
}

/** the average team of each level on that scale (the same as careerSeason.TEAM_AFTER_HS) */
export const UNIV_MEAN = 0.55
export const COMPANY_MEAN = 1.4
export const INDEP_MEAN = 1.05

function idNum(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return h >>> 0
}

/** a number that belongs to the school (the same in every life): the assumption for a team nothing is known of */
function schoolNoise(id: string): number {
  return makeRng(hashSeed(idNum(id) ^ 0x7a71)).normal()
}

// ---------------------------------------------------------------- teams

/** a league's base strength from how often its universities reached the national final, 2005–2026 (a fact turned into a game number) */
export function leagueBase(leagueId: string): number {
  return clamp(-0.1 + 0.17 * Math.sqrt(FINALS_BY_LEAGUE[leagueId] ?? 0), -0.1, 0.55)
}

/**
 * A university team. Membership of a league is a fact from the federation's own pages; the strength made of it
 * is an assumption: the division where known (東都・首都, from a secondary page), else the league's finalists at
 * the national championship, plus a little for a school that reached a final itself.
 */
export function univRating(school: School): TeamRating {
  const seat = leagueSeatOf(school.id)
  if (seat) {
    const lg = UNIV_LEAGUES.find((l) => l.id === seat.league)
    const div = DIVISIONS.find((d) => d.league === seat.league && d.division === seat.division)
    const fin = FINALS_BY_SCHOOL.get(school.id)
    const bonus = fin ? Math.min(0.25, 0.12 * fin.won + 0.07 * fin.second) : 0
    const base = div ? div.tier : leagueBase(seat.league)
    const label = `${lg?.name ?? seat.league}${seat.division ? `${seat.division}部` : ''}`
    const parts = [`${lg?.name ?? ''}の加盟校（全日本大学野球連盟の公式ページ、${LEAGUE_SOURCES.accessed}）`]
    parts.push(div ? `部は二次資料（Wikipedia）` : `連盟の選手権決勝進出 ${FINALS_BY_LEAGUE[seat.league] ?? 0}回（2005〜2026、公式）`)
    if (fin) parts.push(`この大学は優勝${fin.won}回・準優勝${fin.second}回`)
    return {
      value: UNIV_MEAN + base + bonus,
      basis: 'verified',
      league: label,
      why: `${parts.join('。')}。強さの値はゲーム上の仮定`,
      ...(fin ? { note: `全国大会 優勝${fin.won}・準優勝${fin.second}（2005〜2026）` } : {}),
    }
  }
  // a university that is a member of no league: it has no baseball club in these lists, so the strength is only an assumption
  const v = clamp(UNIV_MEAN - 0.2 + 0.22 * schoolNoise(school.id), -0.45, 0.5)
  return { value: v, basis: 'estimated', why: '加盟連盟が確認できない大学（野球部があるかも未確認）。強さは大学ごとの推定' }
}

/** a real 社会人野球 team: the one fact on strength is a place in the 日本選手権's list (official, 2026.10.9) */
export function amateurRating(teamName: string | undefined): TeamRating | undefined {
  const t = AMATEUR_TEAMS.find((x) => x.name === teamName)
  if (!t) return undefined
  const club = t.kind === 'club'
  if (t.nationals) return { value: COMPANY_MEAN + 0.3 - (club ? 0.15 : 0), basis: 'verified', why: '第51回日本選手権の出場チーム一覧にある（日本野球連盟、2026.10.9）。強さの値はゲーム上の仮定' }
  return { value: COMPANY_MEAN - 0.1 - (club ? 0.15 : 0), basis: 'estimated', why: '日本選手権の出場チーム一覧にない（強さは確認できていない）' }
}

/**
 * The level of each independent league (PROJECT_PLAN §11.16). Team records are not collected; the league's level is
 * read from how many of its players the NPB clubs picked in the 2021–2025 drafts (NPB's own lists), per team and
 * year: a league that sends more players up plays at a higher level. The step from picks to a level is a game
 * assumption, shrunk towards the middle for a league of few teams (and a league's membership has changed over
 * those years, which the picks cannot show), so the levels are stated as estimates.
 */
export interface IndepLeagueLevel {
  league: string
  teams: number
  picks: number
  /** picks per team per draft year */
  perTeamYear: number
  /** offset from the average independent team on the model's scale */
  offset: number
}
const indepTeams = ORGS.filter((o) => o.type === 'independent' && o.realName && o.league)
const DRAFT_YEARS_N = DRAFT_META.years.length
export const INDEP_LEAGUE_LEVELS: IndepLeagueLevel[] = (() => {
  const names = [...new Set(indepTeams.map((o) => o.league!))]
  const rows = names.map((league) => {
    const ts = indepTeams.filter((o) => o.league === league)
    const picks = ts.reduce((a, o) => a + draftPicksFrom(o.realName!), 0)
    return { league, teams: ts.length, picks, perTeamYear: picks / (ts.length * DRAFT_YEARS_N) }
  })
  const all = rows.reduce((a, r) => a + r.picks, 0) / (indepTeams.length * DRAFT_YEARS_N)
  return rows.map((r) => ({ ...r, offset: clamp(0.2 * Math.log2(Math.max(r.perTeamYear, 0.05) / Math.max(all, 0.05)), -0.3, 0.3) * (r.teams / (r.teams + 2)) * 1.5 }))
})()

export function indepRating(orgId: string | undefined): TeamRating | undefined {
  const o = orgById(orgId)
  if (!o || o.type !== 'independent') return undefined
  const lv = INDEP_LEAGUE_LEVELS.find((l) => l.league === o.league)
  const picks = o.realName ? draftPicksFrom(o.realName) : 0
  const lvAvg = lv ? lv.picks / lv.teams : 0
  // a club that sent many more than its league's average is a little above it (and the reverse)
  const team = 0.05 * (Math.log(1 + picks) - Math.log(1 + lvAvg))
  return {
    value: INDEP_MEAN + (lv?.offset ?? 0) + team,
    basis: 'verified',
    league: o.league,
    why: `${o.league ?? '独立リーグ'}の球団。NPB ドラフト（${DRAFT_META.years[0]}〜${DRAFT_META.years.at(-1)}年）の指名は、この球団から${picks}人、リーグ全体で${lv?.picks ?? 0}人（NPB の指名結果）。指名数から水準を作る式はゲーム上の仮定で、リーグの構成は年によって変わっているため、水準は推定`,
    note: `NPBドラフトの指名 ${picks}人（${DRAFT_META.years[0]}〜${DRAFT_META.years.at(-1)}年）`,
  }
}

/**
 * A high school. Appearances at the 甲子園 (summer and spring, 2004–2026, 日本高野連's lists) are the evidence; a
 * school whose name is not on them, or whose short name could not be matched to the school list, has only an
 * assumption (owner, and a number per school): its absence is not taken as a fact.
 */
export function hsRating(school: School): TeamRating {
  const k = koshienOf(school.id)
  const played = k && (k.summer.length > 0 || k.spring.length > 0)
  // the prefectural runner-ups (Wikipedia, secondary) are strong schools that did not go: half an appearance each
  const second = k?.pfSecond ?? 0
  if (k && (played || second > 0)) {
    const score = k.summer.length + 0.8 * k.spring.length + 0.12 * (k.kw ?? 0) + 0.5 * second
    const total = (k.summerNth ?? 0) + (k.springNth ?? 0)
    const v = 0.7 + 0.12 * Math.min(score, 5) + 0.05 * clamp(score - 5, 0, 5) + 0.15 * clamp(total / 60, 0, 1)
    const bits = [k.summer.length ? `夏${k.summer.length}回${k.kw ? `（${k.kw}勝）` : ''}` : '', k.spring.length ? `春${k.spring.length}回` : '', second ? `県大会準優勝${second}回` : ''].filter(Boolean).join('・')
    return {
      value: v,
      // appearances are the federation's own lists; the games won and the prefectural finals are from a secondary page
      basis: played ? 'verified' : 'secondary',
      why: `甲子園の出場（2004〜2026、日本高野連の出場校一覧）${k.kw || second ? 'に、夏の勝ち星と県大会の決勝（Wikipedia、二次資料）を加えた' : ''}。強さの値はゲーム上の仮定`,
      note: `${played ? '甲子園 ' : ''}${bits}（甲子園は2004〜2026、県大会は2011〜2025）`,
    }
  }
  const n = schoolNoise(school.id)
  const v = school.owner === 'private' ? 0.55 + 0.3 * n : -0.2 + 0.35 * n
  return { value: v, basis: 'estimated', why: '甲子園の出場記録が一覧にない（一覧と照合できなかった校名があるため、出場していないとは確認していない）。設置者と学校ごとの推定' }
}

/** the NPB clubs' average strength on the model's scale (careerSeason.TEAM_AFTER_HS.pro) */
export const NPB_MEAN = 2.1

/** an NPB club: its winning percentage over 2023–2025 (official standings) turned into a game number */
export function npbRating(orgId: string | undefined): TeamRating | undefined {
  const pct = npbWinPct(orgId ?? '')
  if (pct === undefined) return undefined
  const o = orgById(orgId)
  const v = NPB_MEAN + clamp(((pct - 0.5) / 0.06) * 0.25, -0.5, 0.5)
  return { value: v, basis: 'verified', league: o?.league, why: `2023〜2025年の勝率 ${pct.toFixed(3)}（NPB の勝敗表）。勝率から強さの値を作る式はゲーム上の仮定`, note: `直近3年の勝率 ${pct.toFixed(3)}` }
}

/** words for a team's level (the number is never shown) */
export function levelWord(delta: number): string {
  return delta >= 0.45 ? '全国レベルの強豪' : delta >= 0.2 ? '上位' : delta >= -0.1 ? '中堅' : delta >= -0.35 ? 'やや下位' : '下位'
}

export function ratingText(r: TeamRating, mean: number): string {
  return `${r.league ? `${r.league}・` : ''}強さの目安は${levelWord(r.value - mean)}（${BASIS_LABEL[r.basis]}）`
}

/** the pool of clubs of the player's own region, for the club-team route (type 'club' or not stated) */
export function clubTeamRating(): TeamRating {
  return { value: COMPANY_MEAN - 0.45, basis: 'estimated', why: 'クラブチームは企業チームより選手層が薄いと仮定（確認した統計はない）' }
}

/** a US college team (NCAA Division I): the conference's level is an assumption, the college and conference are from a secondary list */
export function usRating(c: UsCollege): TeamRating {
  return { value: UNIV_MEAN + conferenceTier(c.conference), basis: 'secondary', league: `${c.conference}（NCAA 1部）`, why: `${c.conference}のチーム（Wikipedia、2026-10-18）。カンファレンスの強さはゲーム上の仮定` }
}

// ---------------------------------------------------------------- the player as the scouts see him

export interface Evaluation {
  /** the calibrated overall ability */
  ability: number
  /** body and skills for the position (height only tilts it; see ability.ts positionFit) */
  fit: number
  /** what he can still grow: young, and still growing in height */
  growth: number
  /** results and standing: Koshien, captaincy, a place in the squad, titles */
  record: number
  /** injury history and tiredness (≤ 0) */
  health: number
  /** recent form and confidence */
  form: number
  /** a place in a strong team counts for more */
  context: number
  /** the results of his own games at his level (an average record counts nothing; a good one a little more, a poor one a little less) */
  perf: number
  /** the scouts' attention */
  scout: number
  total: number
}

const GROWTH_BY_AGE: Record<number, number> = { 12: 0.2, 13: 0.2, 14: 0.2, 15: 0.16, 16: 0.12, 17: 0.09, 18: 0.06, 19: 0.04, 20: 0.02 }

/**
 * `beforeHs`: the view of a school when he is admitted (PROJECT_PLAN §11.16): nothing that happened in high school
 * counts (not the Koshien, the captaincy, the facts set by high school events, the results of its games), so what
 * he does after entering never reaches back into the entrance decision.
 */
export function evaluate(s: LifeState, opts: { beforeHs?: boolean } = {}): Evaluation {
  const b = s.bb
  const early = opts.beforeHs === true
  const a = early ? [] : s.career.achievements
  /** a fact counts if it is set (and, for the view at admission, set before high school) */
  const fact = (name: string) => {
    const at = s.flags?.[name]
    return at !== undefined && (!early || at <= 14)
  }
  const ability = s.z
  const fit = positionFit(s)
  const left = Math.max(0, s.person.heightCm - heightAt(s)) // cm still to grow
  // potential mode: what the scouts believe of his talent counts too, and they can be wrong (potential.ts)
  const growth = (GROWTH_BY_AGE[s.age] ?? 0) + clamp(left / 150, 0, 0.1) + scoutPremium(s)
  let record = 0
  if (a.includes('甲子園')) record += 0.25
  if (a.includes('主将')) record += 0.08
  else if (a.includes('副主将')) record += 0.04
  if (b?.role === 'starter') record += 0.1
  else if (b?.role === 'bench') record += 0.03
  else if (b?.role === 'outside') record -= 0.1
  const titles = early ? 0 : (b?.rec?.tournaments ?? []).filter((t) => t.result === '優勝').length
  record += Math.min(0.12, 0.04 * titles)
  // things the player did that people noticed (declarative events set these facts)
  if (fact('rep.youth')) record += 0.1
  if (fact('rep.univ')) record += 0.08
  if (fact('scout.noticed')) record += 0.04
  if (fact('coach.trust')) record += 0.06
  if (fact('hs.visitUniv')) record += 0.05
  // smaller marks: obedience is noticed less than trust, a failed selection still showed him to the selectors, a push from
  // the youth team is seen, and not deciding about a university's practice day leaves a thin impression
  if (fact('coach.listened')) record += 0.02
  if (fact('rep.seen')) record += 0.03
  if (fact('rep.spur')) record += 0.02
  if (fact('hs.visitUndecided')) record -= 0.02
  // an expert's care after an injury, or a trainer who found the cause early, takes part of the history off his back
  const care = (s.flags?.['rehab.expert'] !== undefined ? 0.06 : 0) + (s.flags?.['trainer.care'] !== undefined ? 0.04 : 0)
  const health = -0.12 * Math.min(2, b?.injuries ?? 0) - (s.career.injured > 0 ? 0.08 : 0) - ((b?.fatigue ?? 0) > 70 ? 0.03 : 0) + (b?.injuries ? care : 0)
  const form = 0.06 * (b?.condition ?? 0) + 0.003 * ((b?.confidence ?? 50) - 50)
  const context = b ? 0.25 * clamp(b.teamStrength, -0.5, 1.5) * (b.role === 'starter' ? 1 : b.role === 'bench' ? 0.4 : 0) : 0
  const scout = 0.25 * (((b?.scout ?? 15) - 15) / 40)
  const perf = early ? 0 : resultsTerm(s)
  const total = ability + 0.6 * fit + growth + record + health + form + context + scout + perf
  return { ability, fit, growth, record, health, form, context, scout, perf, total }
}

/**
 * What his results at the present level say, against what is usual there (PROJECT_PLAN §11.16): batting average and
 * home runs once there are enough at-bats, earned runs once there are enough innings. Small samples count for little,
 * and the term is capped, so a good record helps and never decides alone.
 */
function resultsTerm(s: LifeState): number {
  const rec = s.bb?.rec
  if (!rec) return 0
  const level: Level = s.career.phase === 'hs' || s.career.phase === 'jhs' ? 'hs' : s.career.phase === 'univ' ? 'univ' : s.career.phase === 'company' || s.career.phase === 'indep' ? 'amateur' : 'pro'
  const l = rec.official[level]
  if (!l) return 0
  const [avgRef, eraRef] = level === 'hs' ? [0.25, 4.5] : level === 'univ' ? [0.26, 2.8] : level === 'amateur' ? [0.26, 3.0] : [0.25, 3.3]
  let v = 0
  if (l.ab >= 30) v += clamp(((l.h / l.ab - avgRef) * 1.1 + (l.hr / l.ab) * 1.5) * clamp(l.ab / 100, 0.3, 1), -0.1, 0.2)
  if (l.outs >= 45) v += clamp((eraRef - (l.er * 27) / l.outs) * 0.04 * clamp(l.outs / 150, 0.3, 1), -0.1, 0.2)
  return clamp(v, -0.1, 0.25)
}

export type EntryKind = 'sports' | 'recommend' | 'general' | 'walkon' | 'club' | 'overseas'

/**
 * Whether a team invites the player at all: it has to see him (his own team's level and record count) and
 * think him close to its level. An invitation is not a place: see `admitP`.
 */
export function inviteP(ev: Evaluation, team: TeamRating): number {
  return clamp(normCdf((ev.total - (team.value - 0.35)) / 0.45), 0.02, 0.97)
}

/** Whether he gets in once he tries (an invitation, a recommendation, a tryout): the team's level against his evaluation */
export function admitP(ev: Evaluation, team: TeamRating, kind: EntryKind): number {
  // an invitation lowers the bar; a walk-on or a tryout without one raises it; a club team asks little
  const bar = { sports: team.value - 0.45, recommend: team.value - 0.3, general: team.value - 0.2, walkon: team.value + 0.1, club: team.value - 0.9, overseas: team.value - 0.1 }[kind]
  return clamp(normCdf((ev.total - bar) / 0.45), 0.03, 0.97)
}

/** crowding for a place: the stronger the team, the more players and the more the player must beat (for the squad) */
export function squadSize(base: number, team: TeamRating, mean: number): number {
  return Math.round(base * (1 + 0.45 * (team.value - mean)))
}
