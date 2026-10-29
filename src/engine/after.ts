import type { AfterState, Company, Industry, LifeState, WorkState } from './types.ts'
import { clamp } from './math.ts'
import { hashSeed, makeRng } from './rng.ts'
import { LICENSES } from './license.ts'
import { hasFamily, hasFlag } from './events/spec.ts'
import type { CountryCode } from '../data/types.ts'
import { residenceOf } from './countries/index.ts'

// Life outside baseball (PROJECT_PLAN §11.6, stage 5): education, work, income, housing and money.
// Income follows the male wage curve by age (厚生労働省 賃金構造基本統計調査 2025, stat jpWageMale);
// the factors for employer, position, regular work and bonuses are model assumptions (stat workModel).

/** male monthly wages by age band, 千円 (2025, general workers; 第2表) */
export const WAGE_MALE_2025: [number, number, number][] = [
  [0, 19, 212.5],
  [20, 24, 245.7],
  [25, 29, 288.0],
  [30, 34, 330.4],
  [35, 39, 366.2],
  [40, 44, 398.2],
  [45, 49, 420.7],
  [50, 54, 437.5],
  [55, 59, 445.6],
  [60, 64, 358.5],
  [65, 69, 304.3],
]

export function wageMonthly(age: number): number {
  const row = WAGE_MALE_2025.find(([a, b]) => age >= a && age <= b) ?? WAGE_MALE_2025[WAGE_MALE_2025.length - 1]
  return row[2]
}

// ---- assumptions (stat workModel): shown as モデル上の仮定
/** months of pay a year including bonuses */
const MONTHS = 14
const EMPLOYER: Record<WorkState['employer'], number> = { large: 1.15, small: 0.85, public: 1.0, self: 0.9, team: 0.95 }
const LEVEL = [1, 1.08, 1.18, 1.32, 1.5]
const NON_REGULAR = 0.62
/** share of income left after taxes and social insurance */
const TAKE_HOME = 0.78
/** pension after retirement (万円 a year), and the spouse's pension when married */
export const PENSION = 180
const SPOUSE_PENSION = 70

// ---- a man who lives in the US (PROJECT_PLAN §11.40): the public pension and the cost of health care in retirement are the US's, not
// Japan's. All of this is a game assumption (stat usHouseholdModel), not the rules or the figures of the system: the sums are set
// to sit on the scale of the model's wage curve, which is still the one Japanese table (the working years are not changed).
/** the age at which the full public pension begins (the model reads it as 67, the full retirement age of the later birth years) */
export const US_PENSION_AGE = 67
/** the full pension a year (万円) of a man whose earnings reached the wage table's level: about 40% of the prime-age wage (assumption) */
const US_PENSION_BASE = 250
/** the share of the working life's earnings (35 years of the table's mid-level pay) that a full pension needs (assumption) */
const US_PENSION_EARNINGS = 12000
/** a spouse's pension, as a share of his (assumption) */
const US_SPOUSE_SHARE = 0.5
/** yearly health costs of a retired man, premiums and what he pays himself (万円): from 65, and more from 80 (assumption) */
const US_MEDICAL = [30, 55] as const

/**
 * The household of each country other than Japan, by where he lives (PROJECT_PLAN §11.46): the age the public pension begins, its full
 * amount a year (万円) and the earnings that make it full, a spouse's share, the yearly health costs of a retired man (from 65, from 80),
 * and `scale`, the size of the country's wages and fixed costs against Japan's table (1 = the table as it is). All of it is a game
 * assumption, never a figure of a real system (stats usHouseholdModel, krModel, cuModel). Japan has no entry: its rules are the ones above.
 */
export interface HouseholdModel {
  pensionAge: number
  base: number
  earnings: number
  spouseShare: number
  medical: readonly [number, number]
  scale: number
}
const HOUSEHOLDS: Partial<Record<CountryCode, HouseholdModel>> = {
  US: { pensionAge: US_PENSION_AGE, base: US_PENSION_BASE, earnings: US_PENSION_EARNINGS, spouseShare: US_SPOUSE_SHARE, medical: US_MEDICAL, scale: 1 },
  KR: { pensionAge: 65, base: 150, earnings: 9000, spouseShare: 0.3, medical: [20, 45], scale: 0.9 },
  // (a low wage and low fixed costs: most of what a household needs is not bought with the wage; the pension is small)
  CU: { pensionAge: 60, base: 40, earnings: 3000, spouseShare: 0.3, medical: [3, 8], scale: 0.2 },
}
/** the household model of the country he lives in now (undefined for Japan) */
export const householdOf = (s: LifeState): HouseholdModel | undefined => HOUSEHOLDS[residenceOf(s)]

function pensionFor(s: LifeState, m: HouseholdModel): number {
  if (s.age < m.pensionAge) return 0
  const own = Math.round(m.base * (0.4 + 0.6 * Math.min(1, Math.max(0, s.lifetimeIncome) / m.earnings)))
  return own + (s.family.spouse ? Math.round(own * m.spouseShare) : 0)
}
function medicalFor(s: LifeState, m: HouseholdModel): number {
  if (!s.after?.retired || s.age < 65) return 0
  return s.age >= 80 ? m.medical[1] : m.medical[0]
}

/** whether the US's pension and health costs are his: he lives in the US */
export const usHousehold = (s: LifeState): boolean => residenceOf(s) === 'US'

/** the pension a year (万円) of a retired man who lives in the US: nothing before 67, scaled by what he earned, plus a spouse's share */
export function usPension(s: LifeState): number {
  if (s.age < US_PENSION_AGE) return 0
  const own = Math.round(US_PENSION_BASE * (0.4 + 0.6 * Math.min(1, Math.max(0, s.lifetimeIncome) / US_PENSION_EARNINGS)))
  return own + (s.family.spouse ? Math.round(own * US_SPOUSE_SHARE) : 0)
}

/** health costs a year (万円) of a retired man who lives in the US */
export function usMedical(s: LifeState): number {
  if (!s.after?.retired || s.age < 65) return 0
  return s.age >= 80 ? US_MEDICAL[1] : US_MEDICAL[0]
}

export function ensureAfter(s: LifeState): AfterState {
  return (s.after ??= {
    edu: s.age >= 22 && s.timeline.some((t) => t.phase === 'univ') ? 'univ' : s.age >= 18 ? 'hs' : 'jhs',
    jobless: 0,
    home: 'parents',
    loan: 0,
    baseballLife: [],
    community: false,
    care: false,
    retired: false,
  })
}

/** yearly income (万円) of a job */
export function jobIncome(s: LifeState, w: WorkState): number {
  // (a career of careers.ts whose pay its events set: a contract, sales, a channel's income)
  if (w.pay !== undefined) return Math.max(0, Math.round(w.pay))
  const base = (wageMonthly(s.age) * MONTHS) / 10
  const satisfaction = 0.95 + (w.satisfaction - 50) / 1000
  return Math.round(base * EMPLOYER[w.employer] * LEVEL[clamp(w.level, 0, 4)] * (w.regular ? 1 : NON_REGULAR) * satisfaction)
}

/** retirement allowance per year of regular work (万円, assumption) by employer */
const SEVERANCE: Record<WorkState['employer'], number> = { large: 50, public: 50, small: 25, self: 0, team: 15 }

/**
 * pays the retirement allowance (退職金) when a regular job ends after three years or more
 * (assumption, stat workModel); returns the amount
 */
export function severance(s: LifeState): number {
  const w = s.after?.work
  if (!w || !w.regular || w.years < 3) return 0
  const amount = Math.round(Math.min(w.years, 40) * SEVERANCE[w.employer])
  s.money += amount
  return amount
}

/** starts a job; a regular job left for it pays its retirement allowance */
export function setWork(s: LifeState, w: WorkState): number {
  const a = ensureAfter(s)
  const paid = severance(s)
  if (a.work) pastJob(s, 'changed')
  // (the same object: a caller may still set its company after this)
  if (w.since === undefined) w.since = s.age
  a.work = w
  a.jobless = 0
  s.job = w.title
  const jobs = (a.jobs ??= [])
  if (jobs[jobs.length - 1] !== w.title) jobs.push(w.title)
  return paid
}

/** leaves work (retirement allowance included); returns the allowance paid */
export function loseWork(s: LifeState): number {
  const a = ensureAfter(s)
  const paid = severance(s)
  if (a.work) pastJob(s, 'lost')
  a.work = undefined
  s.job = ''
  return paid
}

/** the job that ends, kept with its company and years (an event about the past names it as the past one: spec.ts formerJob) */
function pastJob(s: LifeState, end: 'changed' | 'lost') {
  const a = s.after!
  const w = a.work!
  ;(a.pastJobs ??= []).push({ title: w.title, company: w.company?.name, from: w.since, to: s.age, end })
}

/** a job option offered to this person (PROJECT_PLAN §11.6: background opens doors) */
export interface JobOffer {
  key: string
  label: string
  hint?: string
  work: WorkState
}

// ---- the employer (feedback: a job had no company, no line of business, no size). Fictional companies, always shown with 架空: the
// names are made of a word and a business word, never a real company's; what they do follows the job's industry, their size its
// employer (a large company 1,000 to 9,000 people, a small one 15 to 300). Drawn on a hash of the life, the age and the offer (no
// stream of the year moves), so the same offer names the same company when it is shown and when it is taken.
const COMPANY_KIND: Partial<Record<Industry, [string, string[]][]>> = {
  maker: [['食品メーカー', ['食品', 'フーズ']], ['部品メーカー', ['精工', '製作所']], ['機械メーカー', ['機械', '工機']], ['化学メーカー', ['化成', 'ケミカル']]],
  sales: [['商社', ['商事', '物産']], ['卸売会社', ['商会', '物流']], ['自動車販売店', ['モータース', '自動車販売']], ['住宅設備の販売会社', ['住設', 'ハウジング']]],
  office: [['保険会社', ['保険サービス', '総合保険']], ['物流会社', ['ロジスティクス', '物流']], ['不動産会社', ['不動産', 'エステート']], ['印刷会社', ['印刷', 'プリント']]],
  transport: [['運送会社', ['運輸', '急送']], ['バス会社', ['交通', 'バス']]],
  construction: [['建設会社', ['建設', '工務店']], ['設備工事会社', ['設備', '電設']]],
  care: [['介護施設', ['ケアホーム', '福祉会']], ['介護の事業所', ['ケアサービス', 'ライフケア']]],
  food: [['飲食チェーン', ['フードサービス', 'ダイニング']], ['食品スーパー', ['ストア', 'マート']]],
  it: [['ソフトウェア会社', ['ソフト', 'システムズ']], ['システム開発会社', ['テクノロジー', 'ソリューションズ']]],
}
/** the doors whose work is not the industry's usual company */
const KIND_OF_OFFER: Record<string, [string, string[]]> = {
  sporting: ['スポーツ用品の会社', ['スポーツ', 'スポーツ用品']],
  trainer: ['スポーツジム', ['スポーツクラブ', 'フィットネス']],
  mediajob: ['映像制作会社', ['プロダクション', 'メディア']],
}
const COMPANY_HEAD = ['若葉', '朝凪', '光丘', '青嶺', '東雲', '白樺', '楓台', '翠星', '曙', '鳴海', '桜丘', '北斗', '汐見', '山吹', '常盤', '浅黄']

function strHash(t: string): number {
  let h = 2166136261
  for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619)
  return h >>> 0
}

/** the fictional company of a job offered now (`key`: the offer, so that each door has its own), or none for public service and the like */
export function companyFor(s: LifeState, key: string, w: WorkState): Company | undefined {
  if (w.employer !== 'large' && w.employer !== 'small') return undefined
  // (the names are Japanese: only for a man who works in Japan)
  if (residenceOf(s) !== 'JP') return undefined
  const kinds = KIND_OF_OFFER[key] ? [KIND_OF_OFFER[key]] : COMPANY_KIND[w.industry]
  if (!kinds) return undefined
  const r = makeRng(hashSeed(s.config.seed ^ Math.imul(s.age + 1, 0x7f4a7c15) ^ strHash(key)))
  const [kind, tails] = r.pick(kinds)
  const name = `${r.pick(COMPANY_HEAD)}${r.pick(tails)}`
  const staff = w.employer === 'large' ? r.int(10, 90) * 100 : r.int(3, 60) * 5
  return { name, kind, staff }
}

/** 「若葉精工（架空）・部品メーカー・従業員約300人」 */
export function companyText(c: Company): string {
  return `${c.name}（架空）・${c.kind}・従業員約${c.staff.toLocaleString()}人`
}

const W = (title: string, industry: Industry, employer: WorkState['employer'], o: Partial<WorkState> = {}): WorkState => ({
  title,
  industry,
  employer,
  level: 0,
  years: 0,
  satisfaction: 55,
  regular: true,
  baseball: false,
  ...o,
})

/**
 * Jobs this person can choose from. What opens a door (all assumptions): education and knowledge for
 * large employers and public service, a baseball career for baseball-related work, captaincy and a
 * long playing career for sales posts that value athletes, savings for starting a shop, a well-off
 * family for the family business.
 */
export function jobOffers(s: LifeState, rngPick: (n: number) => number): JobOffer[] {
  const a = ensureAfter(s)
  const k = s.status.knowledge
  const rank = s.career.highestRank
  const captain = s.career.achievements.includes('主将')
  const out: JobOffer[] = []
  // the licensed work his course and national exam opened (license.ts; feedback r11 A8): always offered (jobDecision keeps it)
  const lic = s.license?.ok !== undefined ? LICENSES[s.license.kind] : undefined
  if (lic?.career) out.push({ key: 'license', label: `${lic.title}として働く`, hint: '国家資格を生かす。収入は高め（ゲーム上の仮定）', work: W(lic.title, 'care', lic.employer ?? 'small', { kind: lic.career, pay: lic.pay, satisfaction: 64 }) })
  out.push({ key: 'small', label: '地元の会社で営業職として働く', hint: '安定は中くらい', work: W('会社員（営業）', 'sales', 'small') })
  out.push({ key: 'factory', label: '工場で働く', hint: '体力が生きる。夜勤もある', work: W('工場勤務', 'maker', rngPick(3) === 0 ? 'large' : 'small') })
  out.push({ key: 'care', label: '介護の仕事に就く', hint: '人の役に立つ。給料は控えめ', work: W('介護職', 'care', 'small', { satisfaction: 62 }) })
  if (a.edu === 'univ' || k >= 60 || (rank >= 4 && captain))
    out.push({ key: 'large', label: '大きな会社に入る', hint: rank >= 4 && a.edu !== 'univ' ? '体育会での経験が評価された' : '給料は高めだが、転勤がある', work: W('会社員（大手）', 'office', 'large') })
  if (k >= 55 || hasFlag(s, 'univ.seminarAce')) out.push({ key: 'public', label: '公務員試験を受ける', hint: '受かれば安定。勉強が要る', work: W('公務員', 'public', 'public') })
  // what a university life opened (events/univLife.ts): a job from the part-time work, a 内定
  if (hasFlag(s, 'univ.jobOfferReady')) out.push({ key: 'shopjob', label: 'アルバイト先の会社に就職する', hint: '勝手知ったる職場。給料は控えめ', work: W('飲食店の社員', 'food', 'small', { satisfaction: 62 }) })
  // what the playing years opened (events/proLife.ts): getting ready during the independent league and the pro years
  if (hasFlag(s, 'in.prep')) out.push({ key: 'localfirm', label: '独立リーグ時代に話を聞いた地元の会社に入る', hint: '働き方を事前に知っている', work: W('会社員（地元企業）', 'sales', 'small', { satisfaction: 62 }) })
  if (hasFlag(s, 'pro.qual')) out.push({ key: 'trainer', label: '取得した資格を生かして、トレーナーとして働く', hint: '身につけた知識が生きる', work: W('スポーツトレーナー', 'care', 'small', { baseball: true, satisfaction: 64 }) })
  // what the youth team and a winter overseas opened (events/dailyLife.ts, richLife.ts)
  if (hasFlag(s, 'rep.bond')) out.push({ key: 'repfriend', label: '代表で知り合った仲間の紹介で、会社に入る', hint: '同じユニフォームで戦った縁が生きる', work: W('会社員（紹介先）', 'sales', 'small', { satisfaction: 62 }) })
  if (hasFlag(s, 'pro.winterLeague')) out.push({ key: 'intl', label: '海外のウィンターリーグの経験を生かし、球団の海外担当になる', hint: '言葉と現地の人脈が生きる', work: W('球団の海外担当スタッフ', 'baseball', 'team', { baseball: true, satisfaction: 64 }) })
  // what the first steps into coaching and the press opened (events/diamondLife.ts)
  if (hasFlag(s, 'second.coach')) out.push({ key: 'coachjob', label: '外部コーチの経験を生かし、指導の仕事に就く', hint: '週末の手伝いが本業になる', work: W('スポーツ指導員', 'education', 'public', { baseball: true, satisfaction: 64 }) })
  if (hasFlag(s, 'second.broadcast')) out.push({ key: 'mediajob', label: '解説の経験を生かし、放送・メディアの仕事に就く', hint: '話す仕事。収入は波がある', work: W('メディア関係', 'office', 'small', { baseball: true, satisfaction: 62 }) })
  if (hasFlag(s, 'pro.staff')) out.push({ key: 'bbstaff', label: '球団に希望を伝えていたスタッフの仕事に就く', hint: '現役中の人脈が生きる', work: W('球団スタッフ（コーチ・スカウトなど）', 'baseball', 'team', { baseball: true, satisfaction: 62 }) })
  if (hasFlag(s, 'univ.naitei') || hasFlag(s, 'univ.naiteiAcad'))
    out.push({ key: 'naitei', label: '就職活動でもらった内定の会社に入る', hint: hasFlag(s, 'univ.naitei') ? '野球の経験を評価された' : '学業を評価された', work: W('会社員（内定先）', 'office', 'large') })
  if ((a.edu === 'univ' && k >= 50) || (s.license?.kind === 'teacher' && s.license.ok !== undefined)) out.push({ key: 'teacher', label: '教員になる', hint: '野球部の顧問になれるかもしれない', work: W('教員', 'education', 'public', { satisfaction: 60 }) })
  if (rank >= 4) out.push({ key: 'sporting', label: 'スポーツ用品の会社で働く', hint: '野球の経験が生きる', work: W('スポーツ用品の会社員', 'sales', 'small', { baseball: true, satisfaction: 62 }) })
  // (the same offer; its words follow the family: after both parents are gone, the business they ran is his to start again)
  const parentsAlive = s.family.father !== null || s.family.mother !== null
  if (s.person.wealth >= 4) out.push({ key: 'family', label: parentsAlive ? '実家の家業を継ぐ' : '親が営んでいた家業を、自分で再開する', hint: hasFamily(s) ? '家族と働く' : '一人で切り盛りする', work: W('家業（自営）', 'family', 'self', { level: 1 }) })
  if (s.money >= 250 && s.age >= 25) out.push({ key: 'shop', label: '自分の店を始める', hint: '貯金を使う。当たれば大きい', work: W('飲食店の経営', 'food', 'self', { level: 2, satisfaction: 65 }) })
  out.push({ key: 'parttime', label: 'アルバイトをしながら考える', hint: '時間に余裕がある。収入は少ない', work: W('アルバイト', 'food', 'small', { regular: false, satisfaction: 50 }) })
  // the employer of each door (his own shop and the family business are his own: no company)
  return out.map((o) => {
    // (a licensed post has no company of the offers' kinds: a hospital, a clinic, a pharmacy is not one of them)
    const company = o.key === 'shop' || o.key === 'family' || o.key === 'license' ? undefined : companyFor(s, o.key, o.work)
    return company ? { ...o, work: { ...o.work, company } } : o
  })
}

/** money for the year (万円): take-home pay minus living and housing costs (assumptions, stat householdModel) */
export function householdYear(s: LifeState): void {
  if (s.age < 18) return
  const a = ensureAfter(s)
  const kids = s.family.kids ?? []
  const kidsHome = kids.filter((k) => k < 22).length
  const hm = householdOf(s)
  const k = hm?.scale ?? 1
  const takeHome = s.income * (a.retired ? 0.9 : TAKE_HOME) + spouseTakeHome(s) * k
  // spending follows income (people live within their means), plus fixed costs; when savings run out,
  // the household cuts back (assumptions)
  const tight = s.money < 0 ? TIGHT : 1
  // at the parents' house without income (a student, or before the first job) the parents pay
  const living = (a.home === 'parents' ? (takeHome > 0 ? 30 * k + 0.35 * takeHome : 0) : 40 * k + SPEND_SHARE * takeHome + (s.family.spouse ? 20 * k : 0) + kidsHome * KID_COST * k) * tight
  let housing = (a.home === 'rent' ? 50 : a.home === 'own' ? 10 : 0) * k
  if (a.loan > 0) {
    const pay = Math.min(a.loan, 100 * k)
    a.loan -= pay
    housing += pay
  }
  const care = a.care ? 30 * k : 0
  const medical = hm ? medicalFor(s, hm) : 0
  s.money += Math.round(takeHome - living - housing - care - medical)
}

/** share of take-home pay spent on living (assumption) */
const SPEND_SHARE = 0.6
/** extra yearly spending per child living at home, net of child allowances (assumption) */
const KID_COST = 30
/** spending factor when savings are below zero (assumption) */
const TIGHT = 0.85

/**
 * the spouse's take-home pay (万円 a year, assumption): many couples both work; less while the youngest
 * child is small, nothing after 60 (the spouse's pension is added to income on retirement)
 */
export function spouseTakeHome(s: LifeState): number {
  if (!s.family.spouse || s.age >= 60) return 0
  const kids = s.family.kids ?? []
  const youngest = kids.length ? Math.min(...kids) : 99
  return youngest < 3 ? 30 : 90
}

/** income for the year (万円) */
export function incomeNow(s: LifeState, playingSalary: number | null): number {
  if (playingSalary !== null) return playingSalary
  const a = s.after
  if (!a) return 0
  if (a.retired) {
    const hm = householdOf(s)
    const pension = hm ? pensionFor(s, hm) : PENSION + (s.family.spouse ? SPOUSE_PENSION : 0)
    return pension + (a.work ? Math.round(jobIncome(s, a.work) * 0.4 * (hm?.scale ?? 1)) : 0)
  }
  const sc = householdOf(s)?.scale ?? 1
  if (!a.work) return a.jobless > 0 && a.jobless <= 1 ? Math.round(80 * sc) : 0
  return sc === 1 ? jobIncome(s, a.work) : Math.round(jobIncome(s, a.work) * sc)
}

/**
 * the income of a job in its first year (万円): a job taken this year is paid from next year (lifeYear credits the year's income before
 * the year's events), at next year's age, the same way as incomeNow. The job choice shows this figure (PROJECT_PLAN §11.61); only a
 * change of satisfaction before then (at most ±5%) can move it.
 */
export function firstYearIncome(s: LifeState, w: WorkState): number {
  const sc = householdOf(s)?.scale ?? 1
  const v = jobIncome({ ...s, age: s.age + 1 }, w)
  return sc === 1 ? v : Math.round(v * sc)
}

export const EDU_LABEL: Record<AfterState['edu'], string> = { jhs: '中学', hs: '高校', univ: '大学' }

/**
 * His education as the screen shows it (最終学歴): the school he finished; 「大学在学中」 from the year he enters a university until he
 * graduates (four years, five after a 浪人 year; also the rest of the fourth year once the route after it is decided), and at a death
 * before the graduation (the model has no drop-outs). Every man finishes high school ('jhs' was only an early snapshot of `after`).
 * '—' when he died before 18 (the household model starts then).
 */
export function eduText(s: LifeState): string {
  const a = s.after
  if (!a) return '—'
  if (a.edu === 'univ') return '大学卒業'
  const ronin = s.flags?.['univ.ronin'] !== undefined
  // (the year of 浪人 has the phase of the university, before it begins: not yet a student)
  const roninYear = s.career.phase === 'univ' && s.career.phaseYears < 0 && ronin
  const studied = !!s.schools?.univ || s.timeline.some((t) => t.phase === 'univ')
  const atUniv = s.job === '大学生' || (s.career.phase === 'univ' && !roninYear) || (studied && s.age < (ronin ? 23 : 22))
  if (s.age >= 18 && !roninYear && atUniv) return '大学在学中'
  return `${EDU_LABEL[a.edu === 'jhs' && s.age >= 18 ? 'hs' : a.edu]}卒業`
}
export const HOME_LABEL: Record<AfterState['home'], string> = { parents: '実家', rent: '賃貸', own: '持ち家' }
