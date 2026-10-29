import type { LifeState } from '../../types.ts'
import type { YearCtx } from '../../life.ts'
import { lifeApi, quitWeights } from '../../life.ts'
import { eventRng } from '../../events.ts'
import { clamp, normCdf } from '../../math.ts'
import { initBaseball } from '../../ability.ts'
import { addLine, emptyLine, leagueSeason, records } from '../../games.ts'
import { participationHs, playGameHs } from '../../games.ts'
import { myPart } from '../../season.ts'
import { MLB_GAMES, TEAM_AFTER_HS, proSeason, seasonGames } from '../../careerSeason.ts'
import { MLB_MIN_USD, draftStanding, usdToMan } from '../../contract.ts'
import { UNIV_MEAN, evaluate, type Evaluation, type TeamRating } from '../../route/rating.ts'
import { usInvites } from '../../route/schools.ts'
import { ensureAfter, householdOf, jobOffers, loseWork, setWork } from '../../after.ts'
import { US_DATING_FLAG, US_PARTNER_NAMES } from '../../../data/us.ts'
import { offerRehire } from '../rehire.ts'
import { usProb, usRng } from './checks.ts'
import { COLLEGE_LEVELS, COLLEGE_ORDER, MINOR_GAMES, MINOR_LEVELS, MINOR_UP_CTX, MLB_DEBUT_CTX, TOP_MINOR, admitP, levelWeights, type CollegeKey } from './settings.ts'
import { US_ARB_YEARS, US_FA_YEARS, usDraftPick, usMinorPay, usMlbPay, usStanding } from './model.ts'
import { addKid } from '../../family.ts'

// The yearly flow of a US life (PROJECT_PLAN §11.31). Internal age is the age at the start of the school year, as in Japan's model
// (the screen shows it +1, displayAge.ts). Stages and the ages they cover:
//   child 0–7 · youth (Little League) 8–10 · middle school 11–13 · high school 14–17 (four years) · college 18–21 (junior college
//   18–19) · draft: at 17 from high school, at 20 and 21 from a four-year college (after the junior year or at 21), at 18 and 19 from a
//   junior college · the minors · the majors. The checks draw on streams of their own (checks.ts); the shared engine is reused for
//   ability, games, team strength, pay history, events and the life after baseball.

type Data = Record<string, number | boolean | string>
export type Resolver = (y: YearCtx, choice: number, data: Data) => void

// (life.ts imports this file and this file needs life.ts: the object is read when a year is played, not when the modules load)
const A = new Proxy({} as typeof lifeApi, { get: (_t, k) => (lifeApi as unknown as Record<string | symbol, unknown>)[k] })
const FACT_ASSUMED = '米国の各段階の割合は、確認できたデータがなく、ゲーム上の仮定です（統計ページの「仮定」）。'

/** a US check, drawn from its own stream and reported for calibration */
export function usCheck(y: YearCtx, key: string, ctx = 0): boolean {
  const s = y.s
  const ok = usRng(s, key).next() < usProb(s, key, ctx)
  y.sim.tally?.(key, ok)
  return ok
}

const rng = (s: LifeState, key: string) => usRng(s, key)
const pct = (z: number) => normCdf(z)

// ---------------------------------------------------------------- entry

export function usBaseballYear(y: YearCtx) {
  switch (y.s.career.phase) {
    case 'child':
      return childYear(y)
    case 'youth':
      return youthYear(y)
    case 'jhs':
      return middleYear(y)
    case 'hs':
      return hsYear(y)
    case 'univ':
      return collegeYear(y)
    case 'proMinor':
      return minorYear(y)
    case 'pro':
      return mlbYear(y)
    default:
      return
  }
}

export function usBirthLine(s: LifeState, place: string): string {
  const fam = { none: '野球とは縁のない', hs: '父が高校で野球をしていた', univ: '父が大学まで野球を続けた', company: '父がセミプロのチームでプレーした' }[s.person.parentBaseball]
  return `${s.year}年${s.person.birthMonth}月、${place}で男の子が生まれました。名前は${s.person.given}。${fam}家庭です。`
}

// ---------------------------------------------------------------- childhood to middle school

function childYear(y: YearCtx) {
  const s = y.s
  if (s.age === 6) y.add('milestone', 'エレメンタリースクールに入学しました。')
  if (s.age === 7) y.flavor('normal', '近所の友だちに誘われて、リトルリーグのチームの体験会に行きました。')
  if (s.age === 8) {
    A.setPhase(s, 'youth', '地元のリトルリーグのチーム')
    s.career.startedAge = 8
    A.reachRank(s, 1)
    s.bb = initBaseball(s, eventRng(s, 0xbb))
    A.joinTeam(s, 'youth')
    y.add('big', '地元のリトルリーグのチームに入りました。最初のグローブは少し大きめです。', { key: true })
  }
}

function youthYear(y: YearCtx) {
  const s = y.s
  if (s.age === 9) {
    const pos = rng(s, 'pos').weighted(['P', 'C', 'IF', 'OF'] as const, [20, 12, 40, 28])
    s.person.position = pos
    const name = { P: 'ピッチャー', C: 'キャッチャー', IF: '内野', OF: '外野' }[pos]
    y.add('normal', `守るポジションが${name}に決まりました。`)
  }
  if (s.person.position === 'P' && s.career.injured === 0 && rng(s, 'elbow').chance(0.06)) {
    s.career.injured = 1
    y.add('bad', '投げたあと、肘の内側が痛むようになりました。しばらく投球を休みます。', { statIds: ['elbowYouth'] })
  }
  if (s.age === 10) askMiddle(y)
}

function askMiddle(y: YearCtx) {
  const s = y.s
  const cont = usCheck(y, 'us.mid')
  const r = rng(s, 'midClub')
  const club = cont && (pct(s.z) > 0.7 && s.person.wealth >= 3 ? r.chance(0.6) : r.chance(0.15))
  y.ask(
    {
      id: 'us.mid',
      weight: 'major',
      title: '中学年代では、どこで野球をする？',
      body: '来年からミドルスクールです。学校のチームに入るか、遠征の多いトラベルチームに入るか、それとも野球をやめるか。',
      choices: [
        { label: 'ミドルスクールのチームに入る', hint: '学校の仲間と。費用は少なめ' },
        { label: 'トラベルチーム（遠征の多い民間のクラブ）に入る', hint: '遠征が多く、費用もかかる。高校を見すえて' },
        { label: '野球をやめて、その後の人生を歩む', hint: '勉強や、ほかの好きなことに時間を使う。人生はこのまま続く' },
      ],
      autoIndex: cont ? (club ? 1 : 0) : 2,
      stop: true,
      factText: FACT_ASSUMED,
      factStatIds: ['usMid'],
    },
    {},
  )
}

function middleYear(y: YearCtx) {
  const s = y.s
  const grade = s.career.phaseYears + 1
  A.announce(y, grade === 3 ? 'ミドルスクール最後のシーズン' : `ミドルスクール${grade}年目のシーズン`, 0x13 + grade)
  if (s.age === 13) {
    const good = pct(s.z) > 0.8 || (!s.career.softballClub && pct(s.z) > 0.6)
    y.add(good ? 'good' : 'normal', good ? 'ミドルスクール最後のシーズンは、地区の上位に入りました。' : 'ミドルスクール最後のシーズンが終わりました。悔しくて、しばらく黙っていました。')
    askHighSchool(y)
  }
}

function askHighSchool(y: YearCtx) {
  const s = y.s
  const join = usCheck(y, 'us.hs')
  const r = rng(s, 'hsOffer')
  const strongOffer = pct(s.z) > 0.88 && r.chance(0.6)
  const choices = [
    { label: '地元の公立高校の野球部に入る', hint: '通いやすく、勉強とも両立しやすい' },
    { label: '高校では野球をやめて、その後の人生を歩む', hint: '勉強や、ほかの道に時間を使う。人生はこのまま続く' },
  ]
  if (strongOffer) choices.unshift({ label: '野球の強豪校（私立）の誘いを受ける', hint: 'スカウトの目に触れやすい。部員が多く、競争も激しい' })
  let auto = choices.length - 1
  if (join) auto = strongOffer && r.chance(0.75) ? 0 : strongOffer ? 1 : 0
  y.ask(
    {
      id: 'us.hs',
      weight: 'major',
      title: '高校で野球を続ける？',
      body: strongOffer ? '中学年代での活躍を見た、野球の強豪校から誘いが来ました。' : '高校に入る時期が近づいてきました。野球部のある高校を選ぶかどうか。',
      choices,
      autoIndex: auto,
      stop: true,
      factText: FACT_ASSUMED,
      factStatIds: ['usHs'],
    },
    { strongOffer },
  )
}

// ---------------------------------------------------------------- high school (four years)

export const HS_SQUAD = { bench: 18, shifts: [-0.7, -0.4, -0.2, 0] }
export const COLLEGE_SQUAD = { bench: 25, shifts: [-0.4, -0.2, -0.08, 0] }

export function stayCtx(s: LifeState): number {
  const role = s.bb?.role
  return (role === 'starter' ? 0.25 : role === 'bench' ? 0.1 : role === 'outside' ? -0.15 : 0) + (s.status.happiness < 35 ? -0.2 : 0)
}

/** a season's league table for a school team (the high-school game model of games.ts) */
export function hsLeague(s: LifeState, r: ReturnType<typeof rng>, games: number, winP: number, teams = 6) {
  let line = emptyLine()
  let wins = 0
  for (let g = 0; g < games; g++) {
    const won = r.chance(winP)
    if (won) wins++
    const p = participationHs(s, r)
    if (p.pa === 0 && p.outs === 0) continue
    const gl = playGameHs(s, r, p.pa, p.outs)
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
    for (let g = 0; g < games; g++) if (r.chance(q)) w++
    if (w > wins || (w === wins && r.chance(0.5))) rank++
  }
  const rec = records(s)
  rec.official.hs = addLine(rec.official.hs ?? emptyLine(), line)
  return { wins, rank, champion: rank === 1, line }
}

export function seasonLine(y: YearCtx, label: string, short: string, level: 'hs' | 'univ', lr: { rank: number; champion: boolean; line: import('../../types.ts').StatLine }) {
  const s = y.s
  const c = y.eventCtx(0x5b0 + s.age)
  const out = s.bb?.role === 'outside'
  const place = lr.champion ? '優勝しました' : `${lr.rank}位でした`
  c.add(lr.rank <= 2 ? 'good' : 'milestone', out ? `${label}、チームは${place}。自分はスタンドから声を送りました。` : `${label}は${place}。${myPart(lr)}`, { key: lr.champion && !out })
  records(s).tournaments.push({ age: s.age, name: short, result: lr.champion ? '優勝' : `${lr.rank}位`, line: lr.line, level })
  const b = s.bb!
  const l = lr.line
  const good = l.hr >= 3 || (l.ab >= 25 && l.h / l.ab >= 0.33) || (l.outs >= 45 && l.er * 27 < l.outs * 2.5)
  const poor = l.ab >= 15 && l.h / l.ab < 0.15
  b.confidence = clamp(b.confidence + (good ? 5 : poor ? -4 : 0), 0, 100)
  b.coachEval = clamp(b.coachEval + (good ? 4 : 0), 0, 100)
  s.status.happiness = clamp(s.status.happiness + (lr.champion ? 6 : lr.rank <= 2 ? 2 : -1), 5, 100)
}

function hsYear(y: YearCtx) {
  const s = y.s
  const stay = usCheck(y, 'us.hsStay', (s.career.strongSchool ? 0.1 : 0) + stayCtx(s))
  if (!stay) {
    // (an injury is the reason only of one who has been hurt: life.ts quitWeights; one draw, as the even pick before)
    const reasons = ['故障が長引き、医師に止められて野球部をやめました。', '勉強に専念するため、野球部をやめました。', '部の雰囲気になじめず、野球部をやめました。', '家の事情でアルバイトを始め、野球部をやめました。']
    y.add('bad', rng(s, 'hsWhy').weighted(reasons, quitWeights(s, reasons.length)), { key: true, stop: 'quit' })
    A.endBaseball(s, s.age)
    return
  }
  const year = s.career.phaseYears + 1
  s.career.team = `ハイスクール${year}年・${s.career.strongSchool ? '野球の強豪校（私立）' : '地元の公立高校'}`
  const label = year === 4 ? 'ハイスクール最後のシーズン' : `ハイスクール${year}年生のシーズン`
  A.announce(y, label, 0x5a + year, HS_SQUAD)
  const c = y.eventCtx(0x5c0 + year)
  const winP = clamp(0.5 + 0.6 * ((s.bb?.teamStrength ?? 0.3) - 0.3), 0.25, 0.75)
  seasonLine(y, label, 'ハイスクールのシーズン', 'hs', hsLeague(s, c.rng, 28, winP))
  if (year >= 4) hsGraduate(y)
}

function hsGraduate(y: YearCtx) {
  const s = y.s
  A.reachRank(s, 4)
  y.add('milestone', '4年間のハイスクール野球が終わりました。')
  const ev = evaluate(s)
  if (usCheck(y, 'us.hsDraft')) {
    pickAndAsk(y, 'hs', false, ev)
    return
  }
  askRoute(y, ev)
}

// ---------------------------------------------------------------- the draft

/** the pick (own stream), written to the life, and the choice between signing and the school (the おまかせ answer from a check) */
function pickAndAsk(y: YearCtx, from: 'hs' | 'univ' | 'juco', junior: boolean, ev: Evaluation) {
  const s = y.s
  const r = rng(s, 'pick')
  const pick = usDraftPick(draftStanding(ev.total), r.next(), r.next())
  s.career.usDraft = { year: s.year, age: s.age, from, ...pick, status: 'drafted' }
  y.add('big', `MLBドラフトの${pick.round}巡目（全体${pick.overall}位）で、ある球団から指名されました。契約金の目安は約${Math.round(pick.bonusUsd / 10000).toLocaleString()}万ドルです。`, { key: true })
  const signs = usCheck(y, from === 'hs' ? 'us.hsSign' : 'us.collegeSign', junior ? -0.3 : 0)
  const second = from === 'hs' ? { label: '大学・短大へ進む', hint: '契約せずに進学する。指名はこの年かぎりで、次のドラフトは大学での成績しだい' } : junior ? { label: '学校に残って、もう1年シーズンを過ごす', hint: '契約しない。来年また指名されるとは限らない' } : { label: '契約せず、野球を終える', hint: 'ここで野球を離れる' }
  y.ask(
    {
      id: 'us.draftSign',
      weight: 'major',
      title: 'ドラフトで指名された',
      body: `${pick.round}巡目（全体${pick.overall}位）。契約金は約${Math.round(pick.bonusUsd / 10000).toLocaleString()}万ドル（目安）。契約すれば、マイナーのルーキーから始まります。`,
      choices: [{ label: `契約する（契約金 約${Math.round(pick.bonusUsd / 10000).toLocaleString()}万ドル）`, hint: 'プロの道に進む。マイナーからの長い競争が始まる' }, second],
      autoIndex: signs ? 0 : 1,
      stop: true,
      factText: 'MLBドラフトは20巡（2022〜26年の労使協定）。高校生は卒業後、4年制大学の選手は3年を終えたあとか21歳から、短大の選手はいつでも対象（MLB公式）。順位の決め方と契約金（割当額は推定）は仮定。',
      factStatIds: ['usDraftRounds', 'usModel'],
    },
    { from, junior },
  )
}

function joinMinors(y: YearCtx) {
  const s = y.s
  const d = s.career.usDraft
  if (!d) return
  d.status = 'signed'
  s.career.draftedFrom = `US-${d.from}`
  A.achieve(s, 'ドラフト指名')
  ;(s.flags ??= {})['us.level'] = 0
  A.setPhase(s, 'proMinor', minorTeam(0))
  A.reachRank(s, 6)
  A.joinTeam(s, 'pro')
  A.proNumber(s, false)
  s.career.signingPay = (s.career.signingPay ?? 0) + usdToMan(d.bonusUsd)
  y.add('big', 'MLB球団と契約しました。マイナーのルーキーから始めます。', { key: true })
}

const minorTeam = (level: number) => `MLB球団のマイナー（${MINOR_LEVELS[clamp(level, 0, TOP_MINOR)]}）`

// ---------------------------------------------------------------- the road to college

interface RouteOption {
  key: CollegeKey | 'quit'
  label: string
  hint: string
  p: number
}

function askRoute(y: YearCtx, ev: Evaluation) {
  const s = y.s
  const invites = usInvites(s, ev).filter((x) => x.invited)
  const best = invites.length ? invites.reduce((a, b) => (b.rating.value > a.rating.value ? b : a)) : undefined
  const opts: RouteOption[] = []
  if (best) opts.push({ key: 'd1', label: `${best.college.name}（NCAA 1部・${best.college.conference}）で続ける`, hint: `${invites.length}校から声がかかっている。入れるかは別（ゲーム上の仮定）`, p: 0.5 })
  for (const k of ['d2', 'd3', 'juco'] as const) {
    const p = admitP(k, ev.total)
    opts.push({ key: k, label: `${COLLEGE_LEVELS[k].label}の大学で続ける（学校名は一般名）`, hint: `入れる見込みは${Math.round(p * 100)}%（ゲーム上の仮定）`, p })
  }
  opts.push({ key: 'quit', label: '野球をやめて、進学や就職をする（その後の人生を歩む）', hint: '新しい道に進む。人生はこのまま続き、仕事・家族の出来事が待っている', p: 1 })
  const goes = usCheck(y, 'us.hsCollege')
  let auto = opts.length - 1
  if (goes) {
    const idx = opts.findIndex((o) => o.key !== 'quit' && o.p >= 0.5)
    auto = idx >= 0 ? idx : opts.findIndex((o) => o.key === 'juco')
  }
  y.ask(
    {
      id: 'us.route',
      weight: 'major',
      stop: true,
      title: '高校卒業後の進路',
      body: 'ハイスクールでの野球が終わります。大学や短大の野球部で続けるか、別の道に進むか。',
      choices: opts.map((o) => ({ label: o.label, hint: o.hint })),
      autoIndex: auto,
      factText: 'NCAA 1部の大学名はWikipediaの一覧から。2部・3部・短大は学校名を一般名で表し、入れる確率と各区分の割合はゲーム上の仮定です。',
      factStatIds: ['usHsCollege', 'usModel'],
    },
    { keys: opts.map((o) => o.key).join(','), college: best?.college.id ?? '' },
  )
}

/** a team of the level: the real college for Division I (from the list that invited him), a general name for the others */
function joinCollege(y: YearCtx, level: CollegeKey, collegeId: string, first = true) {
  const s = y.s
  const lv = COLLEGE_LEVELS[level]
  const invited = level === 'd1' ? usInvites(s).find((x) => x.college.id === collegeId) : undefined
  const name = invited ? invited.college.name : `${lv.label}の大学（一般名）`
  const rating: TeamRating = invited ? invited.rating : { value: UNIV_MEAN + lv.rating, basis: 'estimated', league: lv.label, why: `${lv.label}の水準はゲーム上の仮定` }
  A.setPhase(s, 'univ', `カレッジ1年・${name}`)
  A.reachRank(s, 5)
  A.joinTeam(s, 'univ')
  s.schools = {
    ...(s.schools ?? {}),
    univ: { id: invited ? invited.college.id : `us-${level}`, name, method: 'sports', club: 'club', rating: rating.value, ratingBasis: rating.basis, ...(rating.league ? { league: rating.league } : {}), note: invited ? 'NCAA 1部' : `${lv.label}（一般名）` },
  }
  A.applyTeamRating(s, rating, UNIV_MEAN)
  ;(s.flags ??= {})['us.col'] = COLLEGE_ORDER.indexOf(level)
  if (first) y.add('decision', `${name}の野球部に入りました。`, { key: true })
  s.job = '大学生'
}

// ---------------------------------------------------------------- college

function collegeLevel(s: LifeState): CollegeKey {
  return COLLEGE_ORDER[s.flags?.['us.col'] ?? 0] ?? 'd1'
}

function collegeYear(y: YearCtx) {
  const s = y.s
  const level = collegeLevel(s)
  const lv = COLLEGE_LEVELS[level]
  const stay = usCheck(y, 'us.collegeStay', stayCtx(s))
  if (!stay) {
    const reasons = ['故障が長引き、大学の野球部を退部しました。', '学業とアルバイトに専念するため、野球部を退部しました。']
    y.add('bad', rng(s, 'colWhy').weighted(reasons, quitWeights(s, reasons.length)), { key: true, stop: 'quit' })
    A.endBaseball(s, s.age)
    s.job = '大学生'
    return
  }
  const year = s.career.phaseYears + 1
  const name = s.schools?.univ?.name ?? lv.label
  s.career.team = `カレッジ${year}年・${name}`
  const label = `カレッジ${year}年のシーズン`
  A.announce(y, label, 0xa0 + year, COLLEGE_SQUAD)
  const c = y.eventCtx(0xb0 + year)
  const winP = clamp(0.5 + 0.6 * ((s.bb?.teamStrength ?? TEAM_AFTER_HS.univ[2]) - TEAM_AFTER_HS.univ[2]), 0.25, 0.75)
  seasonLine(y, label, 'カレッジのシーズン', 'univ', leagueSeason(s, c.rng, 'univ', level === 'juco' ? 45 : 55, winP, 8))
  // the draft: a four-year player after the junior year or at 21, a junior-college player any year (MLB: rules of the draft)
  const eligible = level === 'juco' || year >= 3
  // (a player who is drafted before his last year there can stay for it)
  const junior = year < lv.years
  if (eligible && usCheck(y, 'us.collegeDraft', lv.draftCtx)) {
    pickAndAsk(y, level === 'juco' ? 'juco' : 'univ', junior, evaluate(s))
    return
  }
  if (year >= lv.years) {
    if (level === 'juco' && usCheck(y, 'us.jucoTransfer')) {
      transfer(y)
      return
    }
    y.add('milestone', level === 'juco' ? '短大での2年間が終わりました。野球はここまでです。' : '大学での4年間が終わりました。野球はここまでです。', { key: true, stop: 'quit' })
    A.endBaseball(s, s.age)
    s.job = '大学生'
  }
}

/** a junior-college player moves to a four-year college as a junior: the level from his ability (the shares of settings.ts) */
function transfer(y: YearCtx) {
  const s = y.s
  const w = levelWeights(s.z)
  const keys = ['d1', 'd2', 'd3'] as const
  const level = rng(s, 'transfer').weighted([...keys], keys.map((k) => w[k]))
  const invited = level === 'd1' ? usInvites(s).filter((x) => x.invited)[0]?.college.id ?? '' : ''
  joinCollege(y, level === 'd1' && !invited ? 'd2' : level, invited, false)
  // he arrives as a junior: two years left in the four-year team (the next year counts as year 3)
  s.career.phaseYears = 1
  y.add('decision', `短大から4年制の大学に編入し、野球を続けることにしました。`, { key: true })
}

// ---------------------------------------------------------------- the minors and the majors

/** a season's games: the majors' 162 above, the minor level's own below (settings.ts MINOR_GAMES; not Japan's) */
const usGames = (level: number) => ({ first: MLB_GAMES, farm: seasonGames(MINOR_GAMES[clamp(level, 0, TOP_MINOR)], MINOR_GAMES[clamp(level, 0, TOP_MINOR)]).farm })

function minorYear(y: YearCtx) {
  const s = y.s
  const level = s.flags?.['us.level'] ?? 0
  s.career.team = minorTeam(level)
  const standing = usStanding(s.z)
  const usd = usMinorPay(level, standing, s.career.minorSeasons)
  s.career.salary = usdToMan(usd)
  A.payHist(s, 'minor', usd)
  s.career.minorSeasons++
  proSeason(y.eventCtx(0x9a1), { ikusei: true, debuted: false, debutNow: false, released: false, standing, labels: US_LABELS, games: usGames(level) })
  const ageCtx = s.age > 27 ? 0.12 * (s.age - 27) : 0
  if (usCheck(y, 'us.minorExit', ageCtx)) {
    if (!offerRehire(y, 'US', 'farm', standing)) retire(y, 'マイナーでの契約が更新されず、現役を引退しました。')
    return
  }
  if (level >= 2 && usCheck(y, 'us.mlbDebut', MLB_DEBUT_CTX[level])) {
    A.setPhase(s, 'pro', 'MLB球団（メジャー）')
    A.reachRank(s, 8)
    s.career.proDebut = true
    A.achieve(s, 'MLB')
    A.joinTeam(s, 'pro')
    y.add('big', 'メジャーリーグに初めて昇格し、試合に出場しました。スタンドの家族の姿が見えました。', { key: true })
    return
  }
  if (level < TOP_MINOR && usCheck(y, 'us.minorUp', MINOR_UP_CTX[level])) {
    ;(s.flags ??= {})['us.level'] = level + 1
    if (level + 1 >= 2) A.reachRank(s, 7)
    y.add('good', `${MINOR_LEVELS[level + 1]}に昇格しました。`, { key: level + 1 >= 2 })
  }
}

function mlbYear(y: YearCtx) {
  const s = y.s
  const service = s.career.proSeasons
  const standing = usStanding(s.z)
  const prev = [...(s.career.salaryHist ?? [])].reverse().find((h) => h.kind === 'mlb')?.usd ?? MLB_MIN_USD
  const usd = usMlbPay(service, prev, standing, eventRng(s, 0x75b).normal())
  s.career.salary = usdToMan(usd)
  A.payHist(s, 'mlb', usd)
  s.career.team = 'MLB球団（メジャー）'
  const exit = usCheck(y, 'us.mlbExit', s.age > 33 ? 0.15 * (s.age - 33) : 0) || s.age >= 40
  s.career.proSeasons++
  proSeason(y.eventCtx(0x9a0), { ikusei: false, debuted: true, debutNow: service === 0, released: exit, standing, labels: US_LABELS, games: usGames(TOP_MINOR) })
  if (s.career.proSeasons === US_ARB_YEARS) y.add('note', `サービスタイムが${US_ARB_YEARS}年に達し、年俸調停の資格を得ました。`, { statIds: ['usArbitrationYears'] })
  if (s.career.proSeasons === US_FA_YEARS) {
    A.reachRank(s, 9)
    A.achieve(s, 'MLBで6年')
    y.add('big', `サービスタイムが${US_FA_YEARS}年に達し、FAの資格を得ました。長くメジャーで戦ってきました。`, { key: true, statIds: ['usFreeAgencyYears'] })
  }
  // a star of the league (assumption: well above the usual player of the majors, after some years)
  if (standing >= 1.6 && s.career.proSeasons >= 4) A.reachRank(s, 10)
  if (exit && !offerRehire(y, 'US', 'first', standing)) retire(y, 'メジャーでの契約が切れ、現役を引退しました。')
}

/** the labels of the US pro levels in the season lines (careerSeason.ts defaults to Japan's 1軍・2軍) */
const US_LABELS = { first: 'MLB', farm: 'マイナー' }

export function retire(y: YearCtx, text: string) {
  const s = y.s
  y.add('milestone', text, { key: true, stop: 'quit' })
  A.endBaseball(s, s.age)
  secondCareer(y)
}

/** staff of the club, another job, or no job yet (assumed shares; Japan's come from NPB's survey, this one has no source) */
export function secondCareer(y: YearCtx) {
  const s = y.s
  const which = rng(s, 'second').weighted(['staff', 'other', 'undecided'] as const, [0.3, 0.55, 0.15])
  s.career.secondCareer = which
  if (!s.taken.includes('work.started')) s.taken.push('work.started')
  if (which === 'staff') {
    setWork(s, { title: '球団スタッフ（コーチ・スカウトなど）', industry: 'baseball', employer: 'team', level: 0, years: 0, satisfaction: 62, regular: true, baseball: true })
    y.add('normal', '球団に残り、スタッフとして働くことになりました。')
  } else if (which === 'other') {
    setWork(s, { title: '会社員', industry: 'office', employer: 'small', level: 0, years: 0, satisfaction: 50, regular: true, baseball: false })
    y.add('normal', '野球とは別の仕事に就きました。新しい名刺に、まだ慣れません。')
  } else {
    loseWork(s)
    y.add('bad', '次の仕事が決まらないまま、春を迎えました。')
  }
}

// ---------------------------------------------------------------- life outside baseball

// ---------------------------------------------------------------- everyday life during the playing years (PROJECT_PLAN §11.34)
// Love, marriage, a place of his own and a house go on in the playing years too, for the おまかせ and headless lives as much as for
// the screen. Every draw is from a stream of its own (`usRng(s, 'us.life.*')`: a function of the life, the age and the key only), and
// the lines are written on those streams too (the 4th argument of `y.add`), so the US checks, the year's calibrated stream and the
// streams of Japan are never touched. A step that a player could take differently is a decision (us.propose, us.home): the draw
// decides whether it is asked and what おまかせ answers, so the screen's おまかせ is the headless life; the steps nobody chooses
// (meeting someone, a break-up, leaving the parents' house) just happen. All the chances are game assumptions (stats lifeEventModel).

const US_PARTNERS = US_PARTNER_NAMES
const DATING = US_DATING_FLAG

export const lrng = (s: LifeState, key: string) => usRng(s, `us.life.${key}`)
const datingYears = (s: LifeState) => (s.flags?.[DATING] === undefined ? 0 : s.age - s.flags[DATING])

/** the words and the names of a country's life outside baseball (the US's are the defaults; the others pass their own: countries/league) */
export interface LifeWords {
  partners: string[]
  spouses: string[]
  middle: string
  high: string
  college: string
}
const US_WORDS: LifeWords = { partners: US_PARTNERS, spouses: ['Emily', 'Sarah', 'Jessica', 'Ashley', 'Megan', 'Hannah', 'Olivia', 'Emma', 'Grace', 'Lauren'], middle: 'ミドルスクールに入学しました。', high: 'ハイスクールに進学しました。', college: '大学に進学することにしました。' }

function usLove(y: YearCtx, playing: boolean, w: LifeWords = US_WORDS) {
  const s = y.s
  const f = s.family
  if (s.age < 20) return
  // meeting someone (while playing; after baseball the older rule of usLifeYear marries him directly)
  if (playing && !f.partner && !f.spouse && s.age <= 36) {
    const r = lrng(s, 'meet')
    if (r.next() < clamp(0.16 + (s.status.relations - 50) / 400, 0.06, 0.26)) {
      f.partner = r.pick(w.partners)
      ;(s.flags ??= {})[DATING] = s.age
      y.add('good', `${f.partner}さんと付き合い始めました。`, {}, r)
    }
    return
  }
  if (!f.partner || f.spouse) return
  // a break-up (about 6% a year, an assumption)
  const b = lrng(s, 'breakup')
  if (b.next() < 0.06) {
    y.add('decision', `${f.partner}さんとは、それぞれの道を歩むことになりました。`, {}, b)
    f.partner = undefined
    if (s.flags) delete s.flags[DATING]
    return
  }
  // the proposal: after two years together, asked in about four years in ten; おまかせ marries
  // (after 「もう少しこのままでいる」 the question waits two years: love.wait, shared with Japan's proposals)
  if (datingYears(s) >= 2 && s.age >= 22 && s.age - (s.flags?.['love.wait'] ?? -99) >= 2) {
    if (lrng(s, 'propose').next() < 0.4) {
      y.ask(
        {
          id: 'us.propose',
          weight: 'major',
          title: '結婚',
          body: `${f.partner}さんとの交際が${datingYears(s)}年になりました。シーズンの合間に、結婚を考えるようになりました。`,
          choices: [{ label: '結婚を申し込む' }, { label: 'もう少しこのままでいる' }, { label: '別々の道を歩む' }],
          autoIndex: 0,
        },
        { name: f.partner },
      )
    }
  }
}

/** a place of his own and a house, for a man who is still playing (the same steps as the working life's, as decisions) */
function usHomeWhilePlaying(y: YearCtx) {
  const s = y.s
  const a = s.after
  if (!a || s.age < 22) return
  if (a.home === 'parents' && s.income >= 250) {
    const r = lrng(s, 'leave')
    if (r.next() < 0.4) {
      a.home = 'rent'
      y.add('milestone', s.family.spouse ? '家族で暮らす部屋を借りました。' : '実家を出て、ひとり暮らしを始めました。', {}, r)
    }
    return
  }
  if (a.home === 'rent' && s.family.spouse && s.age >= 26 && s.age <= 45 && s.money >= 300 && lrng(s, 'home').next() < 0.15) {
    y.ask({
      id: 'us.home',
      weight: 'major',
      title: '家を買うか',
      body: '貯金がたまり、家族で暮らす家を持つことを考えるようになりました。',
      choices: [{ label: '頭金を出して、家を買う', hint: '住宅ローンを組む。引っ越しの多い野球人生では重い選択' }, { label: '賃貸のまま、身軽にしておく' }],
      autoIndex: 0,
    })
  }
}

/** school milestones, the first job, marriage and children of a US life that is not playing (the household model of after.ts is shared) */
export function usLifeYear(y: YearCtx, w: LifeWords = US_WORDS) {
  const s = y.s
  const playing = lifeApi.isPlaying(s)
  if (!playing) {
    if (s.age === 11 && s.career.phase === 'retired') y.add('milestone', w.middle)
    if (s.age === 14 && s.career.phase === 'retired') y.add('milestone', w.high)
    if (s.age === 18 && s.career.phase === 'retired' && !s.job) {
      const r = rng(s, 'college')
      if (r.chance(clamp(0.45 + 0.1 * (s.person.wealth - 3) + (s.status.knowledge - 50) / 200, 0.1, 0.85))) {
        s.job = '大学生'
        y.add('normal', w.college)
      }
    }
  }
  if (s.age >= 18) ensureAfter(s)
  // the first job: after college, or at 19 for one who did not go (assumption)
  const a = s.after
  if (!playing && a && !a.work && !a.retired && s.job !== '大学生' && s.age >= 19 && s.age < 65 && !s.taken.includes('us.work')) {
    s.taken.push('us.work')
    const r = rng(s, 'job')
    const offers = jobOffers(s, (n) => Math.floor(r.next() * n)).filter((o) => ['small', 'factory', 'care', 'large'].includes(o.key))
    const pick = offers[Math.floor(r.next() * offers.length)]
    if (pick) {
      setWork(s, pick.work)
      y.add('milestone', `${pick.work.title}として働き始めました。`)
    }
  }
  // a place of his own: out of the parents' house a few years after the first job, a house for a married man who has saved (assumptions)
  if (a && a.home === 'parents' && a.work && s.age >= 20 && rng(s, 'leave').chance(0.35)) {
    a.home = 'rent'
    y.add('milestone', '実家を出て、ひとり暮らしを始めました。')
  }
  if (playing) usHomeWhilePlaying(y)
  // meeting, break-up and the proposal (a man still playing has the decision form; one who has stopped keeps his partner's thread)
  if (s.age >= 20) usLove(y, playing, w)
  if (!playing && a && a.home === 'rent' && s.family.spouse && s.age >= 26 && s.age <= 50 && s.money >= 300 && rng(s, 'buy').chance(0.12)) {
    a.home = 'own'
    a.loan = 2500
    s.money -= 300
    y.add('milestone', '頭金をためて、家を買いました。', { key: true })
  }
  // the public pension begins at 67 (after.ts usPension: a game assumption); the two years from 65 are lived on savings
  const hm = householdOf(s)
  if (!playing && a?.retired && hm && s.age === hm.pensionAge) y.add('milestone', `${hm.pensionAge}歳になり、公的年金の受け取りが始まりました。`, { key: true }, lrng(s, 'pensionLine'))
  if (!playing && a && !a.retired && s.age >= 65) {
    a.retired = true
    loseWork(s)
    s.job = '引退'
    y.add('milestone', '65歳を過ぎ、リタイアして暮らすことになりました。')
  }
  if (!playing && s.age >= 24 && s.age <= 40 && !s.family.spouse && !s.family.partner && !s.family.everMarried && rng(s, 'marry').chance(0.08)) {
    const name = rng(s, 'spouse').pick(w.spouses)
    s.family.spouse = { name, years: 0 }
    s.family.everMarried = true
    s.family.marriedAge = s.age
    y.add('milestone', `${name}さんと結婚しました。`, { key: true })
  }
  if (s.family.spouse && s.family.children < 3 && s.age <= 42 && rng(s, 'child').chance(0.2)) {
    s.family.children++
    // the child's name is drawn on a stream of its own (family.ts)
    const kid = addKid(s)
    // (a man still playing writes the line on a stream of its own, so the year's calibrated stream is not drawn from)
    y.add('milestone', `子どもの${kid}が生まれました。`, { key: true }, playing ? lrng(s, 'childLine') : undefined)
  }
}

// ---------------------------------------------------------------- decisions

export const US_RESOLVERS: Record<string, Resolver> = {
  // another team of the same league (countries/rehire.ts; used by Korea and Cuba too: this table is consulted for every country)
  'rehire.offer': (y, c, d) => {
    const s = y.s
    const place = String(d.place)
    if (c !== 0) return retire(y, `${place}の球団からの誘いは受けず、現役を引退しました。`)
    const f = (s.flags ??= {})
    f['rehire.n'] = (f['rehire.n'] ?? 0) + 1
    const farm = d.tier === 'farm'
    if (farm && s.career.phase === 'pro') {
      // the first team's player takes a minor-category contract: back to the farm (the next years play it as any other)
      A.setPhase(s, 'proMinor', String(d.cat))
      if (d.cc === 'US') f['us.level'] = TOP_MINOR
    }
    s.career.team = String(d.cat)
    y.add('good', `${place}の球団と契約しました。${farm ? '下のカテゴリーから、もう一度やり直します。' : '同じリーグで、もう一度勝負します。'}`, { key: true })
  },
  'us.mid': (y, c) => {
    const s = y.s
    if (c === 2) {
      y.add('decision', '中学年代では野球をやめることにしました。グローブはクローゼットにしまいました。', { key: true })
      A.endBaseball(s, s.age)
      return
    }
    s.career.softballClub = c === 0
    A.setPhase(s, 'jhs', c === 0 ? 'ミドルスクールのチーム' : 'トラベルチーム（遠征の多い民間のクラブ）')
    A.reachRank(s, 2)
    A.joinTeam(s, c === 0 ? 'jhsSoft' : 'jhsClub')
    y.add('decision', c === 0 ? 'ミドルスクールの野球チームに入りました。' : 'トラベルチームに入りました。週末は遠征で州の外へ出かけます。')
  },
  'us.hs': (y, c, d) => {
    const s = y.s
    const strongOffer = d.strongOffer === true
    const idx = strongOffer ? c : c + 1 // 0 = strong, 1 = public, 2 = quit
    if (idx === 2) {
      y.add('decision', '高校では野球をやめることにしました。', { key: true })
      A.endBaseball(s, s.age)
      return
    }
    s.career.strongSchool = idx === 0
    A.setPhase(s, 'hs', `ハイスクール1年・${idx === 0 ? '野球の強豪校（私立）' : '地元の公立高校'}`)
    A.reachRank(s, 3)
    A.joinTeam(s, idx === 0 ? 'hsStrong' : 'hsPublic')
    const n = s.bb?.teamSize ?? 30
    y.add('decision', idx === 0 ? `野球の強豪校（私立）に進み、野球部に入りました。部員は${n}人います。` : `地元の公立高校に進み、野球部に入りました。部員は${n}人です。`, { key: idx === 0 })
  },
  'us.propose': (y, c, d) => {
    const s = y.s
    const f = s.family
    const name = f.partner
    // never a second marriage, never a proposal to nobody
    if (!name || f.spouse) return
    const r = lrng(s, 'proposeLine')
    if (c === 0) {
      f.spouse = { name, years: 0 }
      f.everMarried = true
      f.marriedAge ??= s.age
      f.partner = undefined
      delete f.ended
      delete f.endedAge
      if (s.flags) delete s.flags[DATING]
      s.status.happiness = clamp(s.status.happiness + 8, 5, 100)
      y.add('big', `${String(d.name ?? name)}さんと結婚しました。`, { key: true }, r)
    } else if (c === 1) {
      s.flags = { ...s.flags, 'love.wait': s.age }
      y.add('decision', '結婚の話は、シーズンが終わってから考えることにしました。', {}, r)
    } else {
      f.partner = undefined
      if (s.flags) delete s.flags[DATING]
      s.status.happiness = clamp(s.status.happiness - 5, 5, 100)
      y.add('decision', `${name}さんとは、それぞれの道を歩むことになりました。`, {}, r)
    }
  },
  'us.home': (y, c) => {
    const s = y.s
    const a = s.after
    if (!a || a.home !== 'rent') return
    const r = lrng(s, 'homeLine')
    if (c === 0) {
      a.home = 'own'
      a.loan = 2500
      s.money -= 300
      y.add('milestone', '頭金をためて、家を買いました。', { key: true }, r)
    } else y.add('decision', '家は買わず、賃貸のまま身軽にしておくことにしました。', {}, r)
  },
  'us.draftSign': (y, c, d) => {
    const s = y.s
    const dr = s.career.usDraft
    if (!dr) return
    if (c === 0) {
      y.add('decision', 'ドラフトで指名された球団と契約することにしました。', { key: true })
      joinMinors(y)
      return
    }
    dr.status = 'declined'
    const from = String(d.from)
    if (from === 'hs') {
      y.add('decision', '契約はせず、大学や短大で野球を続けることにしました。', { key: true })
      askRoute(y, evaluate(s))
    } else if (d.junior === true) {
      y.add('decision', '契約はせず、大学に戻って4年生のシーズンを過ごすことにしました。', { key: true })
    } else {
      y.add('decision', '契約はせず、ここで野球を終えることにしました。', { key: true })
      A.endBaseball(s, s.age)
      s.job = '大学生'
    }
  },
  'us.route': (y, c, d) => {
    const s = y.s
    const keys = String(d.keys).split(',')
    const key = keys[c] ?? 'quit'
    if (key === 'quit') {
      y.add('decision', '野球を離れ、新しい道に進むことにしました。', { key: true })
      A.endBaseball(s, s.age)
      return
    }
    let level = key as CollegeKey
    // a Division II or III team takes him with the chance of the setting (a Division I place is the invitation); a junior college takes anyone (the fallback)
    if (level === 'd2' || level === 'd3') {
      if (rng(s, `admit.${level}`).next() >= admitP(level, evaluate(s).total)) {
        y.add('bad', `${COLLEGE_LEVELS[level].label}の大学のテストには届きませんでした。短大に進むことにしました。`, { key: true })
        level = 'juco'
      }
    }
    joinCollege(y, level, String(d.college))
  },
}
