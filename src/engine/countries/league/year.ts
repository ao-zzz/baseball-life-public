import type { LifeState } from '../../types.ts'
import type { YearCtx } from '../../life.ts'
import { lifeApi, quitWeights } from '../../life.ts'
import { eventRng } from '../../events.ts'
import { clamp, normCdf, normInv } from '../../math.ts'
import { initBaseball } from '../../ability.ts'
import { leagueSeason } from '../../games.ts'
import { TEAM_AFTER_HS, proSeason, seasonGames } from '../../careerSeason.ts'
import { usdToMan } from '../../contract.ts'
import { UNIV_MEAN, evaluate, type Evaluation, type TeamRating } from '../../route/rating.ts'
import { setResidence } from '../index.ts'
import { usRng } from '../us/checks.ts'
import { COLLEGE_SQUAD, HS_SQUAD, hsLeague, retire, seasonLine, stayCtx, usBaseballYear, usLifeYear } from '../us/year.ts'
import { offerRehire, type RehireLeague } from '../rehire.ts'
import { KR_FA_UNIV, leagueProfile, type LeagueCheck, type LeagueProfile } from './profile.ts'

// The yearly flow of the countries played through the league profile (Korea and Cuba; PROJECT_PLAN §11.46). It is the US flow's shape
// (child → youth → middle → high school → [university] → pro) with each step a check of the profile and each country's own way to the
// pros: Korea's through a draft (hs 14–16, university 17–20, 2軍 → 1軍, the military service), Cuba's through selection by the state
// (sports school, state junior team, the national league, and the offer from abroad that sends a player into the US flow). The shared
// engine is reused for ability, games, team strength, pay history, events and the life after baseball (usLifeYear with the country's
// words). The checks draw from streams of their own (usRng with a key per country), so no other country's draws move. Every number is a
// game assumption (profile.ts).

type Data = Record<string, number | boolean | string>
export type Resolver = (y: YearCtx, choice: number, data: Data) => void

// (life.ts imports this file and this file needs life.ts: the object is read when a year is played, not when the modules load)
const A = new Proxy({} as typeof lifeApi, { get: (_t, k) => (lifeApi as unknown as Record<string | symbol, unknown>)[k] })
const FACT = 'この国の各段階の割合・年俸・年数は、確認できたデータがなく、ゲーム上の推定です（統計ページの「仮定」）。'
/** Korea's: the KBO's games, minimum salary and years to free agency are confirmed (profile.ts, 2026-10-23); the rest stays an estimate */
const FACT_KR = 'この国の各段階の割合・年俸の伸び方・契約金は、確認できたデータがなく、ゲーム上の推定です（統計ページの「仮定」）。KBOの試合数・最低年俸・FAまでの年数は、公表資料で確認しています。'
const factOf = (p: LeagueProfile) => (p.cc === 'KR' ? FACT_KR : FACT)

const alpha = (c: LeagueCheck) => normInv(c.target) * Math.sqrt(1 + c.b * c.b)
export function leagueProb(p: LeagueProfile, s: LifeState, key: string, ctx = 0): number {
  const c = p.checks[key]
  return normCdf(alpha(c) + c.b * s.z + ctx)
}
const rng = (s: LifeState, p: LeagueProfile, key: string) => usRng(s, `${p.cc.toLowerCase()}.${key}`)
function lcheck(y: YearCtx, p: LeagueProfile, key: string, ctx = 0): boolean {
  const ok = rng(y.s, p, key).next() < leagueProb(p, y.s, key, ctx)
  y.sim.tally?.(`${p.cc}.${key}`, ok)
  return ok
}
const pct = (z: number) => normCdf(z)

// ---------------------------------------------------------------- entry

export function leagueBaseballYear(y: YearCtx) {
  const s = y.s
  const p = leagueProfile(s.person.country)
  if (!p) return
  // a Cuban who went abroad plays through the US flow (minors and majors) from then on
  if (s.flags?.['cu.mlb'] !== undefined && (s.career.phase === 'proMinor' || s.career.phase === 'pro')) return usBaseballYear(y)
  switch (s.career.phase) {
    case 'child':
      return childYear(y, p)
    case 'youth':
      return youthYear(y, p)
    case 'jhs':
      return middleYear(y, p)
    case 'hs':
      return hsYear(y, p)
    case 'univ':
      return univYear(y, p)
    case 'proMinor':
      return minorYear(y, p)
    case 'pro':
      return p.kind === 'draft' ? firstYear(y, p) : serieYear(y, p)
    default:
      return
  }
}

export function leagueBirthLine(s: LifeState, place: string): string {
  const fam = { none: '野球とは縁のない', hs: '父が高校で野球をしていた', univ: '父が大学まで野球を続けた', company: '父がアマチュアのチームでプレーした' }[s.person.parentBaseball]
  return `${s.year}年${s.person.birthMonth}月、${place}で男の子が生まれました。名前は${s.person.given}。${fam}家庭です。`
}

// ---------------------------------------------------------------- childhood to the end of middle school

function childYear(y: YearCtx, p: LeagueProfile) {
  const s = y.s
  if (s.age === 6) y.add('milestone', '小学校に入学しました。')
  if (s.age === 7) y.flavor('normal', p.kind === 'draft' ? '近所の友だちに誘われて、少年野球チームの体験会に行きました。' : '空き地でボールを追う年上の子たちに混ざって、初めて野球をしました。')
  if (s.age === 8) {
    A.setPhase(s, 'youth', p.kind === 'draft' ? '地元の少年野球チーム' : '近所の野球仲間のチーム')
    s.career.startedAge = 8
    A.reachRank(s, 1)
    s.bb = initBaseball(s, eventRng(s, 0xbb))
    A.joinTeam(s, 'youth')
    y.add('big', p.kind === 'draft' ? '地元の少年野球チームに入りました。最初のグローブは少し大きめです。' : '近所の仲間とチームをつくりました。ボールは古びたもので、グローブはみんなでわけあいます。', { key: true })
  }
}

function youthYear(y: YearCtx, p: LeagueProfile) {
  const s = y.s
  if (s.age === 9) {
    const pos = rng(s, p, 'pos').weighted(['P', 'C', 'IF', 'OF'] as const, [20, 12, 40, 28])
    s.person.position = pos
    y.add('normal', `守るポジションが${{ P: 'ピッチャー', C: 'キャッチャー', IF: '内野', OF: '外野' }[pos]}に決まりました。`)
  }
  if (s.person.position === 'P' && s.career.injured === 0 && rng(s, p, 'elbow').chance(0.06)) {
    s.career.injured = 1
    y.add('bad', '投げたあと、肘の内側が痛むようになりました。しばらく投球を休みます。', { statIds: ['elbowYouth'] })
  }
  if (s.age === 10) askMiddle(y, p)
}

function askMiddle(y: YearCtx, p: LeagueProfile) {
  const s = y.s
  const cont = lcheck(y, p, 'mid')
  if (p.kind === 'draft') {
    const club = cont && (pct(s.z) > 0.7 && s.person.wealth >= 3 ? rng(s, p, 'midClub').chance(0.6) : rng(s, p, 'midClub').chance(0.15))
    y.ask(
      {
        id: 'kr.mid',
        weight: 'major',
        title: '中学では、どこで野球をする？',
        body: '来年から中学生です。学校の野球部に入るか、民間のクラブで本格的に練習するか、それとも野球をやめるか。',
        choices: [
          { label: '中学校の野球部に入る', hint: '学校の仲間と。費用は少なめ' },
          { label: '民間のクラブチームに入る', hint: '練習量が多く、費用もかかる。高校を見すえて' },
          { label: '野球をやめて、その後の人生を歩む', hint: '勉強や、ほかの好きなことに時間を使う。人生はこのまま続く' },
        ],
        autoIndex: cont ? (club ? 1 : 0) : 2,
        stop: true,
        factText: factOf(p),
        factStatIds: ['krModel'],
      },
      {},
    )
    return
  }
  // Cuba: the sports schools pick the children who show talent (the offer is a check on ability); the others play in their neighbourhood
  const offer = lcheck(y, p, 'eide')
  const choices = [{ label: '地域の少年チームで続ける', hint: '近所の学校の仲間と。ボールもグローブも数が少ない' }, { label: '野球をやめて、その後の人生を歩む', hint: '勉強や、ほかの好きなことに時間を使う。人生はこのまま続く' }]
  if (offer) choices.unshift({ label: 'スポーツ学校（EIDE）の選抜に進む', hint: '練習と学業を同じ場所で。家族と離れて寄宿することもある' })
  y.ask(
    {
      id: 'cu.mid',
      weight: 'major',
      title: '中学の年代で、どこで野球をする？',
      body: offer ? '地区の大会で見ていた指導者から、スポーツ学校の選抜に来ないかと声がかかりました。' : '来年から中学生です。近所のチームで続けるか、それとも野球をやめるか。',
      choices,
      autoIndex: cont ? 0 : choices.length - 1,
      stop: true,
      factText: factOf(p),
      factStatIds: ['cuModel'],
    },
    { offer },
  )
}

function middleYear(y: YearCtx, p: LeagueProfile) {
  const s = y.s
  const grade = s.career.phaseYears + 1
  A.announce(y, grade === 3 ? '中学最後のシーズン' : `中学${grade}年目のシーズン`, 0x13 + grade)
  if (s.age === 13) {
    const good = pct(s.z) > 0.8 || (!s.career.softballClub && pct(s.z) > 0.6)
    y.add(good ? 'good' : 'normal', good ? '中学最後の大会は、地域の上位に入りました。' : '中学最後の大会が終わりました。悔しくて、しばらく黙っていました。')
    askHigh(y, p)
  }
}

function askHigh(y: YearCtx, p: LeagueProfile) {
  const s = y.s
  const join = lcheck(y, p, 'hs')
  const strongOffer = pct(s.z) > 0.88 && rng(s, p, 'hsOffer').chance(0.6)
  const strongWord = p.kind === 'draft' ? '野球の名門高校の誘いを受ける' : 'スポーツ学校（EIDE）の高校課程に進む'
  const plainWord = p.kind === 'draft' ? '地元の高校の野球部に入る' : '州のジュニアチームで続ける'
  const choices = [
    { label: plainWord, hint: '通いやすく、勉強とも両立しやすい' },
    { label: '高校では野球をやめて、その後の人生を歩む', hint: '勉強や、ほかの道に時間を使う。人生はこのまま続く' },
  ]
  if (strongOffer || (p.kind === 'state' && s.career.strongSchool)) choices.unshift({ label: strongWord, hint: 'スカウトの目に触れやすい。競争も激しい' })
  const auto = join ? 0 : choices.length - 1
  y.ask(
    {
      id: `${p.cc.toLowerCase()}.hs`,
      weight: 'major',
      title: '高校で野球を続ける？',
      body: choices.length === 3 ? '中学での活躍を見た、強い学校やチームから誘いが来ました。' : '高校に入る時期が近づいてきました。野球を続けるかどうか。',
      choices,
      autoIndex: auto,
      stop: true,
      factText: factOf(p),
      factStatIds: [`${p.cc.toLowerCase()}Model`],
    },
    { strong: choices.length === 3 },
  )
}

// ---------------------------------------------------------------- high school

function hsYear(y: YearCtx, p: LeagueProfile) {
  const s = y.s
  const stay = lcheck(y, p, 'hsStay', (s.career.strongSchool ? 0.1 : 0) + stayCtx(s))
  if (!stay) {
    // (an injury is the reason only of one who has been hurt: life.ts quitWeights; one draw, as the even pick before)
    const reasons = ['故障が長引き、医師に止められて野球部をやめました。', '勉強に専念するため、野球部をやめました。', '部の雰囲気になじめず、野球部をやめました。', '家の事情でアルバイトを始め、野球部をやめました。']
    y.add('bad', rng(s, p, 'hsWhy').weighted(reasons, quitWeights(s, reasons.length)), { key: true, stop: 'quit' })
    A.endBaseball(s, s.age)
    return
  }
  const years = p.kind === 'draft' ? 3 : 4
  const year = s.career.phaseYears + 1
  s.career.team = `${s.career.strongSchool ? p.names.highStrong : p.names.high}${year}年`
  const label = year === years ? '最後のシーズン' : `${year}年目のシーズン`
  A.announce(y, label, 0x5a + year, HS_SQUAD)
  const c = y.eventCtx(0x5c0 + year)
  const winP = clamp(0.5 + 0.6 * ((s.bb?.teamStrength ?? 0.3) - 0.3), 0.25, 0.75)
  seasonLine(y, label, `${p.names.high}のシーズン`, 'hs', hsLeague(s, c.rng, 28, winP))
  if (year >= years) hsGraduate(y, p)
}

function hsGraduate(y: YearCtx, p: LeagueProfile) {
  const s = y.s
  A.reachRank(s, 4)
  y.add('milestone', `${p.kind === 'draft' ? '3' : '4'}年間の高校野球が終わりました。`)
  const ev = evaluate(s)
  if (p.kind === 'draft') {
    if (lcheck(y, p, 'hsDraft')) return pickAndAsk(y, p, 'hs', ev)
    return askRoute(y, p, ev)
  }
  // Cuba: the state's selection for the national league (the junior team's best go up at the end of it)
  const picked = lcheck(y, p, 'serie', s.career.strongSchool ? 0.5 : 0)
  y.ask(
    {
      id: 'cu.serie',
      weight: 'major',
      title: '州の代表チームへ',
      body: picked ? '州の代表チームの監督が、国内リーグ（セリエ・ナシオナル）の控えに入らないかと声をかけてくれました。' : '州の代表チームの選抜が終わりました。名前は、呼ばれませんでした。',
      choices: picked ? [{ label: '州の代表チームに入る', hint: '国内リーグの選手として、野球で暮らす道' }, { label: '野球をやめて、学業や仕事の道に進む' }] : [{ label: '野球をやめて、学業や仕事の道に進む' }],
      autoIndex: 0,
      stop: true,
      factText: factOf(p),
      factStatIds: ['cuModel'],
    },
    { picked },
  )
}

// ---------------------------------------------------------------- Korea: the draft, the university

/**
 * a pick of the KBO draft (10 clubs, 10 rounds: the rounds are the game's; one report speaks of 11, not checked): the better he
 * stands among the draftees, the earlier. The bonus in 万円 (1 won = 0.11 yen) falls with the pick. ESTIMATE fitted to two reported
 * points (2026-10-23): the first pick about ₩700 million for the 2026 class (₩500 million for 2025:
 * https://v.daum.net/v/20250924172347303) → 7,700万円, and the last rounds about ₩30 million, the minimum salary → 330万円
 * (https://www.mt.co.kr/sports/2026/10/07/2026100712315871962).
 */
export function krPick(standing: number, u1: number, u2: number) {
  const base = 1 + 9 * Math.pow(1 - clamp(standing, 0, 1), 1.4)
  const round = clamp(Math.round(base + (u1 - 0.5) * 3), 1, 10)
  const overall = (round - 1) * 10 + 1 + Math.floor(u2 * 10)
  return { round, overall, bonus: Math.max(330, Math.round(7700 * Math.pow(overall, -0.65))) }
}

function pickAndAsk(y: YearCtx, p: LeagueProfile, from: 'hs' | 'univ', ev: Evaluation) {
  const s = y.s
  const r = rng(s, p, 'pick')
  const standing = clamp(0.35 + 0.1 * (ev.total - 3.5) + 0.1 * s.z, 0, 1)
  const pick = krPick(standing, r.next(), r.next())
  y.add('big', `KBOの新人ドラフトの${pick.round}巡目（全体${pick.overall}番目）で、ある球団から指名されました。契約金の目安は約${pick.bonus.toLocaleString()}万円です。`, { key: true })
  const signs = lcheck(y, p, from === 'hs' ? 'hsSign' : 'univSign')
  const second = from === 'hs' ? { label: '大学へ進んで野球を続ける', hint: '契約せずに進学する。指名はこの年かぎり' } : { label: '契約せず、野球を終える', hint: 'ここで野球を離れる' }
  y.ask(
    {
      id: 'kr.draftSign',
      weight: 'major',
      title: 'ドラフトで指名された',
      body: `${pick.round}巡目（全体${pick.overall}番目）。契約金は約${pick.bonus.toLocaleString()}万円（目安）。契約すれば、まず球団の2軍から始まります。`,
      choices: [{ label: `契約する（契約金 約${pick.bonus.toLocaleString()}万円）`, hint: 'プロの道に進む。男性には兵役の義務もある' }, second],
      autoIndex: signs ? 0 : 1,
      stop: true,
      factText: 'KBOの新人ドラフトの巡目・全体順位・契約金は、確認できたデータがなく、ゲーム上の推定です。',
      factStatIds: ['krModel'],
    },
    { from, round: pick.round, overall: pick.overall, bonus: pick.bonus },
  )
}

function joinKbo(y: YearCtx, p: LeagueProfile, overall: number, bonus: number, from: string) {
  const s = y.s
  s.career.draftedFrom = `KR-${from}`
  A.achieve(s, 'ドラフト指名')
  A.reachRank(s, 7)
  s.career.signingPay = (s.career.signingPay ?? 0) + bonus
  // the first picks start in the first team, the others on the farm
  const top = overall <= 10
  if (top) {
    A.setPhase(s, 'pro', p.names.first)
    s.career.proDebut = true
    A.reachRank(s, 8)
    A.achieve(s, 'KBO')
  } else A.setPhase(s, 'proMinor', p.names.minor)
  A.joinTeam(s, 'pro')
  A.proNumber(s, !top)
  y.add('big', top ? 'KBOの球団と契約しました。1軍の春季キャンプから始まります。' : 'KBOの球団と契約しました。まずは2軍で、1軍のマウンドや打席を目指します。', { key: true })
}

function askRoute(y: YearCtx, p: LeagueProfile, ev: Evaluation) {
  const admitP = clamp(0.35 + 0.3 * (ev.total - 3.5), 0.05, 0.95)
  const goes = lcheck(y, p, 'hsUniv')
  y.ask(
    {
      id: 'kr.route',
      weight: 'major',
      stop: true,
      title: '高校卒業後の進路',
      body: '高校での野球が終わります。大学の野球部で続けるか、別の道に進むか。',
      choices: [{ label: '大学の野球部で続ける（学校名は一般名）', hint: `入れる見込みは${Math.round(admitP * 100)}%（ゲーム上の仮定）` }, { label: '野球をやめて、進学や就職をする（その後の人生を歩む）', hint: '新しい道に進む。人生はこのまま続き、仕事・家族の出来事が待っている' }],
      autoIndex: goes ? 0 : 1,
      factText: factOf(p),
      factStatIds: ['krModel'],
    },
    { admitP },
  )
}

function joinUniv(y: YearCtx, p: LeagueProfile) {
  const s = y.s
  const rating: TeamRating = { value: UNIV_MEAN - 0.1, basis: 'estimated', league: '大学野球リーグ', why: '大学の水準はゲーム上の仮定' }
  A.setPhase(s, 'univ', `大学1年・${p.names.univ}（一般名）`)
  A.reachRank(s, 5)
  A.joinTeam(s, 'univ')
  s.schools = { ...(s.schools ?? {}), univ: { id: `${p.cc.toLowerCase()}-univ`, name: '大学（一般名）', method: 'sports', club: 'club', rating: rating.value, ratingBasis: rating.basis, ...(rating.league ? { league: rating.league } : {}), note: '一般名' } }
  A.applyTeamRating(s, rating, UNIV_MEAN)
  y.add('decision', '大学の野球部に入りました。', { key: true })
  s.job = '大学生'
}

function univYear(y: YearCtx, p: LeagueProfile) {
  const s = y.s
  const stay = lcheck(y, p, 'univStay', stayCtx(s))
  if (!stay) {
    const reasons = ['故障が長引き、大学の野球部を退部しました。', '学業とアルバイトに専念するため、野球部を退部しました。']
    y.add('bad', rng(s, p, 'colWhy').weighted(reasons, quitWeights(s, reasons.length)), { key: true, stop: 'quit' })
    A.endBaseball(s, s.age)
    s.job = '大学生'
    return
  }
  const year = s.career.phaseYears + 1
  s.career.team = `大学${year}年・${p.names.univ}`
  const label = `大学${year}年のシーズン`
  A.announce(y, label, 0xa0 + year, COLLEGE_SQUAD)
  const c = y.eventCtx(0xb0 + year)
  const winP = clamp(0.5 + 0.6 * ((s.bb?.teamStrength ?? TEAM_AFTER_HS.univ[2]) - TEAM_AFTER_HS.univ[2]), 0.25, 0.75)
  seasonLine(y, label, '大学のシーズン', 'univ', leagueSeason(s, c.rng, 'univ', 55, winP, 8))
  if (year >= 4) {
    if (lcheck(y, p, 'univDraft')) return pickAndAsk(y, p, 'univ', evaluate(s))
    y.add('milestone', '大学での4年間が終わりました。野球はここまでです。', { key: true, stop: 'quit' })
    A.endBaseball(s, s.age)
    s.job = '大学生'
  }
}

// ---------------------------------------------------------------- the pros

/** the standing among the pros (sd units), from ability: the pool of the pros is above the average player (assumption) */
const standingOf = (s: LifeState) => (s.z - 1.0) / 0.6

/** a year's pay in the first team (万円): the minimum, growing with the years of service and the standing, capped */
export function firstPay(p: LeagueProfile, service: number, standing: number, noise: number): number {
  const v = p.pay.min * Math.exp(p.pay.perStanding * (standing + 0.2 * noise) + p.pay.perYear * service)
  return Math.round(clamp(v, p.pay.min, p.pay.cap))
}

function minorYear(y: YearCtx, p: LeagueProfile) {
  const s = y.s
  s.career.team = p.names.minor
  if (inService(y, p)) return
  s.career.salary = p.pay.minor
  A.payHist(s, 'minor')
  s.career.minorSeasons++
  proSeason(y.eventCtx(0x9a1), { ikusei: true, debuted: false, debutNow: false, released: false, standing: standingOf(s), labels: p.labels, games: seasonGames(p.games.first, p.games.farm) })
  const ageCtx = s.age > 27 ? 0.12 * (s.age - 27) : 0
  if (lcheck(y, p, 'minorExit', ageCtx)) {
    if (!offerRehire(y, p.cc as RehireLeague, 'farm', standingOf(s))) retire(y, `${p.names.league}での契約が更新されず、現役を引退しました。`)
    return
  }
  if (lcheck(y, p, 'debut', 0.1 * Math.min(3, s.career.minorSeasons) - 0.3)) {
    A.setPhase(s, 'pro', p.names.first)
    A.reachRank(s, 8)
    s.career.proDebut = true
    A.achieve(s, 'KBO')
    A.joinTeam(s, 'pro')
    y.add('big', '1軍に初めて昇格し、試合に出場しました。スタンドの家族の姿が見えました。', { key: true })
    return
  }
  askMilitary(y, p)
}

function firstYear(y: YearCtx, p: LeagueProfile) {
  const s = y.s
  s.career.team = p.names.first
  if (inService(y, p)) return
  const service = s.career.proSeasons
  const standing = standingOf(s)
  s.career.salary = firstPay(p, service, standing, eventRng(s, 0x75b).normal())
  A.payHist(s, 'mlb')
  const exit = lcheck(y, p, 'firstExit', s.age > 33 ? 0.15 * (s.age - 33) : 0) || s.age >= 42
  s.career.proSeasons++
  proSeason(y.eventCtx(0x9a0), { ikusei: false, debuted: true, debutNow: service === 0, released: exit, standing, labels: p.labels, games: seasonGames(p.games.first, p.games.farm) })
  // (a player from a university needs one season fewer: KR_FA_UNIV, confirmed with its source in profile.ts)
  const faNeed = s.career.draftedFrom === 'KR-univ' ? KR_FA_UNIV : p.faYears
  if (s.career.proSeasons === faNeed) {
    A.reachRank(s, 9)
    A.achieve(s, `${p.names.league}で${faNeed}年`)
    y.add('big', `1軍で${faNeed}年を過ごし、FAの資格を得ました。長く第一線で戦ってきました。`, { key: true })
  }
  if (standing >= 1.6 && s.career.proSeasons >= 4) A.reachRank(s, 9)
  if (exit) {
    if (!offerRehire(y, p.cc as RehireLeague, 'first', standing)) retire(y, `${p.names.league}での契約が切れ、現役を引退しました。`)
    return
  }
  askMilitary(y, p)
}

// ---------------------------------------------------------------- the military service (Korea)

/** the service years are the two after the start; true while he is in them (the season is not played) */
function inService(y: YearCtx, p: LeagueProfile): boolean {
  const s = y.s
  const from = p.cc === 'KR' ? s.flags?.['kr.mil'] : undefined
  if (from === undefined || s.age >= from + 2) return false
  const sports = s.flags?.['kr.mil.sports'] !== undefined
  s.career.team = sports ? '軍の野球チーム（兵役）' : '軍（兵役）'
  s.career.salary = sports ? 120 : 60
  A.payHist(s, 'minor')
  if (s.age === from) y.add('normal', sports ? '軍の野球チームに入り、兵役を始めました。試合には出られますが、球団での昇格は止まっています。' : '入隊し、兵役を始めました。野球から離れた2年間です。', { key: true })
  else y.add('normal', sports ? '兵役の2年目。軍の野球チームで、肩を落とさないように体を動かし続けています。' : '兵役の2年目。夜は、キャッチボールをした日々を思い出しています。')
  if (s.age === from + 1) y.add('good', '兵役を終えました。球団に戻る日が決まっています。')
  return true
}

/** the service is asked at 23–26 (the first time in the pros), and decided for him at 27 (assumption: most players owe it) */
function askMilitary(y: YearCtx, p: LeagueProfile) {
  const s = y.s
  if (p.cc !== 'KR' || s.flags?.['kr.mil'] !== undefined || s.age < 23 || s.age > 27) return
  if (s.age < 27 && !rng(s, p, 'milAsk').chance(0.5)) return
  const sportsP = clamp(pct(s.z - 0.2), 0.05, 0.9)
  y.ask(
    {
      id: 'kr.mil',
      weight: 'major',
      title: '兵役',
      body: '男性には、兵役に就く義務があります。野球選手として、いつ、どのように務めるか決める時期が来ました。',
      choices: [
        { label: '軍の野球チームの選抜を受ける', hint: `受かれば野球を続けながら務められる（見込み ${Math.round(sportsP * 100)}%・ゲーム上の仮定）。落ちれば通常の入隊になる` },
        { label: '通常の入隊で、野球から離れて務める', hint: '2年間は試合に出られない' },
        ...(s.age < 27 ? [{ label: 'もう少し現役を続け、先に延ばす', hint: '27歳までに務める必要がある' }] : []),
      ],
      autoIndex: sportsP >= 0.5 ? 0 : 1,
      stop: true,
      factText: '兵役の扱い（軍の野球チーム・期間・年齢の上限）は、確認できたデータがなく、ゲーム上の推定です。',
      factStatIds: ['krModel'],
    },
    { sportsP },
  )
}

// ---------------------------------------------------------------- Cuba: the national league and the road abroad

function serieYear(y: YearCtx, p: LeagueProfile) {
  const s = y.s
  s.career.team = p.names.first
  const standing = standingOf(s)
  s.career.salary = Math.round(clamp(p.pay.min * Math.exp(p.pay.perStanding * standing + p.pay.perYear * s.career.proSeasons), p.pay.min, p.pay.cap))
  A.payHist(s, 'mlb')
  const ageCtx = s.age > 33 ? 0.15 * (s.age - 33) : 0
  const exit = lcheck(y, p, 'serieExit', ageCtx) || s.age >= 40
  s.career.proSeasons++
  proSeason(y.eventCtx(0x9a0), { ikusei: false, debuted: true, debutNow: s.career.proSeasons === 1, released: exit, standing, labels: p.labels, games: seasonGames(p.games.first, p.games.farm) })
  if (s.career.proSeasons === 8) {
    A.reachRank(s, 5)
    A.achieve(s, 'セリエ・ナシオナルで8年')
    y.add('big', '国内リーグで8年。州の顔として、街の子どもたちに名前を呼ばれるようになりました。', { key: true })
  }
  if (exit) {
    if (!offerRehire(y, 'CU', 'first', standing)) retire(y, '国内リーグの契約が終わり、現役を引退しました。')
    return
  }
  // an offer from abroad: ages 19–32, the better he is, the likelier
  if (s.age >= 19 && s.age <= 32 && lcheck(y, p, 'leaveOffer', (s.career.proSeasons >= 3 ? 0.2 : 0) + (s.flags?.['cu.scouted'] !== undefined ? 0.3 : 0))) askLeave(y, p)
}

function askLeave(y: YearCtx, p: LeagueProfile) {
  const go = lcheck(y, p, 'leaveGo')
  y.ask(
    {
      id: 'cu.leave',
      weight: 'major',
      title: '海外からの誘い',
      body: 'アメリカのMLB球団の関係者が、あなたとの契約を望んでいるという話が届きました。海を渡れば、まずマイナーから。けれど、家族や仲間、この国の暮らしから離れることになります。',
      choices: [
        { label: '海を渡り、MLB球団と契約する', hint: '契約金とマイナーでの競争。家族への送金もできるが、暮らしも言葉も変わる（手続きや国籍の事情は簡略化している）' },
        { label: '国内にとどまって、野球を続ける', hint: '家族と地域に近い暮らし。収入は小さいまま' },
      ],
      autoIndex: go ? 0 : 1,
      stop: true,
      factText: '海外挑戦の手続き・契約金・人数は、確認できたデータがなく、ゲーム上の推定です。政治や制度の状況は、ゲーム内のモデルとして単純化しています。',
      factStatIds: ['cuModel'],
    },
    {},
  )
}

// ---------------------------------------------------------------- life outside baseball

export function leagueLifeYear(y: YearCtx) {
  const p = leagueProfile(y.s.person.country)
  if (p) usLifeYear(y, p.words)
}

// ---------------------------------------------------------------- decisions

export const LEAGUE_RESOLVERS: Record<string, Resolver> = {
  'kr.mid': (y, c) => middleChoice(y, 'KR', c, c),
  'kr.hs': (y, c, d) => highChoice(y, 'KR', c, d.strong === true),
  'cu.mid': (y, c, d) => middleChoice(y, 'CU', c, d.offer === true ? c : c + 1),
  'cu.hs': (y, c, d) => highChoice(y, 'CU', c, d.strong === true),
  'kr.draftSign': (y, c, d) => {
    const s = y.s
    const p = leagueProfile('KR')!
    if (c === 0) {
      y.add('decision', 'ドラフトで指名された球団と契約することにしました。', { key: true })
      joinKbo(y, p, Number(d.overall), Number(d.bonus), String(d.from))
      return
    }
    if (String(d.from) === 'hs') {
      y.add('decision', '契約はせず、大学で野球を続けることにしました。', { key: true })
      askRoute(y, p, evaluate(s))
    } else {
      y.add('decision', '契約はせず、ここで野球を終えることにしました。', { key: true })
      A.endBaseball(s, s.age)
      s.job = '大学生'
    }
  },
  'kr.route': (y, c, d) => {
    const s = y.s
    const p = leagueProfile('KR')!
    if (c !== 0) {
      y.add('decision', '野球を離れ、新しい道に進むことにしました。', { key: true })
      A.endBaseball(s, s.age)
      return
    }
    if (rng(s, p, 'admit').next() >= Number(d.admitP)) {
      y.add('bad', '大学の野球部のテストには届きませんでした。野球はここまでです。', { key: true })
      A.endBaseball(s, s.age)
      return
    }
    joinUniv(y, p)
  },
  'kr.mil': (y, c, d) => {
    const s = y.s
    const f = (s.flags ??= {})
    if (c === 2) {
      y.add('decision', '兵役は、もう少し先に延ばすことにしました。', { key: true })
      return
    }
    // (the service begins next year: this year's season is played)
    f['kr.mil'] = s.age + 1
    if (c === 0 && rng(s, leagueProfile('KR')!, 'milSports').next() < Number(d.sportsP)) {
      f['kr.mil.sports'] = s.age
      y.add('good', '軍の野球チームの選抜に受かりました。野球を続けながら、兵役を務めます。', { key: true })
    } else if (c === 0) y.add('bad', '軍の野球チームの選抜には届かず、通常の入隊になりました。', { key: true })
    else y.add('decision', '通常の入隊で、兵役を務めることにしました。', { key: true })
  },
  'cu.serie': (y, c, d) => {
    const s = y.s
    const p = leagueProfile('CU')!
    if (d.picked !== true || c !== 0) {
      y.add('decision', '野球を離れ、新しい道に進むことにしました。', { key: true })
      A.endBaseball(s, s.age)
      return
    }
    A.setPhase(s, 'pro', p.names.first)
    A.reachRank(s, 5)
    s.career.proDebut = true
    A.achieve(s, '国内リーグ')
    A.joinTeam(s, 'pro')
    A.proNumber(s, false)
    y.add('big', '州の代表チームに入り、国内リーグの選手になりました。ユニフォームの背番号は、父が自分のことのように喜びました。', { key: true })
  },
  'cu.leave': (y, c) => {
    const s = y.s
    if (c !== 0) {
      y.add('decision', '国内にとどまることにしました。家族と近い場所で、野球を続けます。', { key: true })
      return
    }
    // the level he starts at, and the bonus, from his ability (assumptions); then the US flow plays him (minors and majors)
    const level = s.z > 1.4 ? 2 : s.z > 0.6 ? 1 : 0
    const usd = Math.round(Math.min(5_000_000, 25_000 * Math.exp(1.3 * Math.max(0, s.z))))
    ;(s.flags ??= {})['cu.mlb'] = s.age
    s.flags['us.level'] = level
    s.career.signingPay = (s.career.signingPay ?? 0) + usdToMan(usd)
    s.career.draftedFrom = 'CU-abroad'
    setResidence(s, 'US')
    A.setPhase(s, 'proMinor', 'MLB球団のマイナー')
    A.reachRank(s, 6)
    A.achieve(s, 'MLB球団と契約')
    A.joinTeam(s, 'pro')
    A.proNumber(s, false)
    y.add('big', `海を渡り、MLB球団と契約しました。契約金は約${Math.round(usd / 10000).toLocaleString()}万ドル（目安）。慣れない言葉と寒さの中で、マイナーでの暮らしが始まります。`, { key: true })
  },
}

function middleChoice(y: YearCtx, cc: 'KR' | 'CU', c: number, idx: number) {
  const s = y.s
  const p = leagueProfile(cc)!
  // Korea: 0 school, 1 club, 2 quit. Cuba: idx 0 = the sports school, 1 = the neighbourhood team, 2 = quit
  const quit = idx === 2
  if (quit) {
    y.add('decision', '中学の年代では野球をやめることにしました。グローブはクローゼットにしまいました。', { key: true })
    A.endBaseball(s, s.age)
    return
  }
  if (cc === 'KR') {
    s.career.softballClub = idx === 0
    A.setPhase(s, 'jhs', idx === 0 ? p.names.middleClub : '民間のクラブチーム')
    A.reachRank(s, 2)
    A.joinTeam(s, idx === 0 ? 'jhsSoft' : 'jhsClub')
    y.add('decision', idx === 0 ? '中学校の野球部に入りました。' : '民間のクラブチームに入りました。練習は平日の夜と週末です。')
    return
  }
  const eide = idx === 0
  s.career.strongSchool = eide
  s.career.softballClub = !eide
  A.setPhase(s, 'jhs', eide ? p.names.middleClub : p.names.middle)
  A.reachRank(s, 2)
  A.joinTeam(s, eide ? 'jhsClub' : 'jhsSoft')
  y.add('decision', eide ? 'スポーツ学校（EIDE）に入りました。学業と練習が同じ日課の中にあります。' : '地域の少年チームで続けることにしました。')
  void c
}

function highChoice(y: YearCtx, cc: 'KR' | 'CU', c: number, hasStrong: boolean) {
  const s = y.s
  const p = leagueProfile(cc)!
  const idx = hasStrong ? c : c + 1 // 0 = strong, 1 = plain, 2 = quit
  if (idx === 2) {
    y.add('decision', '高校では野球をやめることにしました。', { key: true })
    A.endBaseball(s, s.age)
    return
  }
  s.career.strongSchool = idx === 0
  const team = `${idx === 0 ? p.names.highStrong : p.names.high}1年`
  A.setPhase(s, 'hs', team)
  A.reachRank(s, 3)
  A.joinTeam(s, idx === 0 ? 'hsStrong' : 'hsPublic')
  const n = s.bb?.teamSize ?? 30
  y.add('decision', idx === 0 ? `${p.names.highStrong}に進みました。チームの人数は${n}人います。` : `${p.names.high}に入りました。人数は${n}人です。`, { key: idx === 0 })
}
