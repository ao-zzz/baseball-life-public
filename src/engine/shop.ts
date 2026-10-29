import type { LifeState, LogEntry, LogKind } from './types.ts'
import { markSeen, tagged, weightOf, type EventCtx, type EventDef } from './events.ts'
import { compileSpec, type ChoiceSpec, type Effect, type EventSpec } from './events/spec.ts'
import { PROFILES, SPENDING_SPECS } from './events/spending.ts'
import { PUBLIC_SPECS } from './events/publicLife.ts'
import { residenceOf } from './countries/index.ts'
import { hashSeed, makeRng, type Rng } from './rng.ts'

// The money screen (PROJECT_PLAN §11.43): "お金を使う · 投資" as a place of its own, as the reference game has it. It is made of the
// spending events of §11.41 and nothing else: a card is an event, an option on it is one of its choices, and a purchase is that choice
// resolved on a stream of its own (the seed, the age, the event), with the same effects, follow-ups and log line as when the event is
// asked on its own. So there is one rule for the money (taken once, by the choice), the same limits (`maxPerLife`, `cooldown` are read
// from `evHist`, and a purchase counts as the event having happened, so the yearly draw does not ask it again), and a card is never
// shown while the same event waits as a decision. Nothing here runs by itself in a life nobody opens it for: the standing settings
// (`LifeState.shop`) are absent until the player sets them, and the yearly parts below do nothing without them, draw nothing, and leave
// the おまかせ and headless lives as they were.

/** the events that can be bought from the screen, by the country he lives in: the spending ones and a few of the public ones */
const SHOP_PUBLIC = ['pub.charity', 'her.study', 'her.visit']
const SOURCE: EventSpec[] = [...SPENDING_SPECS, ...PUBLIC_SPECS.filter((s) => SHOP_PUBLIC.some((p) => s.id.startsWith(p + '.')))]
const defs = new Map<string, EventDef>()
const defOf = (spec: EventSpec): EventDef => {
  let d = defs.get(spec.id)
  if (!d) defs.set(spec.id, (d = compileSpec(spec)))
  return d
}

export interface ShopOption {
  /** the position of the choice in its event */
  index: number
  label: string
  hint?: string
  /** 万円 */
  cost: number
  /** what it changes, as words */
  effects: string[]
  /** a result that comes years later */
  later: boolean
  /** he can pay and the choice is open to him */
  open: boolean
}

export interface ShopCard {
  id: string
  title: string
  /** the effects of the first option, in words */
  summary: string[]
  options: ShopOption[]
  /** the cards for the moment first, the others folded */
  group: 'now' | 'more'
  /** this kind of spending can be made to repeat by itself (a topic that is not a one-time choice) */
  repeatable: boolean
  topic: string
}

const age18 = (s: LifeState) => s.age >= 18

/** whether the event may happen to him now: its conditions, its ages, its limits and not already asked */
function eligible(s: LifeState, spec: EventSpec): boolean {
  if (spec.followOnly || !spec.choices || spec.lives !== residenceOf(s)) return false
  if (spec.ages && (s.age < spec.ages[0] || s.age > spec.ages[1])) return false
  const h = s.evHist?.[spec.id]
  if (h && (h[1] >= (spec.maxPerLife ?? 1) || s.age - h[0] < (spec.cooldown ?? 3))) return false
  // (a decision of the event waiting on screen: the card is not shown, or it would be offered twice)
  const waiting = s as unknown as { pending?: { id: string }; queue?: { id: string }[] }
  if (waiting.pending?.id === spec.id || waiting.queue?.some((q) => q.id === spec.id)) return false
  if (spec.when && !spec.when(s)) return false
  return true
}

const WORDS: [keyof Effect, string][] = [['happy', '幸福'], ['rel', '人間関係'], ['know', '知識'], ['conf', '自信'], ['health', '健康']]
export function effectWords(e: Effect | undefined): string[] {
  if (!e) return []
  const out: string[] = []
  for (const [k, label] of WORDS) {
    const v = e[k]
    if (typeof v === 'number' && v !== 0) out.push(`${label} ${v > 0 ? '+' : '−'}${Math.abs(v)}`)
  }
  if (e.fatigue && e.fatigue < 0) out.push('疲労↓')
  if (e.gain && e.gain > 0) out.push('成長↑')
  if (e.lang) out.push('語学↑')
  if (e.home === 'own') out.push('持ち家になる')
  if (e.home === 'rent') out.push('住まいが変わる')
  if (e.skill) out.push('技能↑')
  return out
}

/** the cards he can see now: one per event he could buy, the nearest to his life first */
export function shopCards(s: LifeState): ShopCard[] {
  if (!age18(s)) return []
  const cards: ShopCard[] = []
  for (const spec of SOURCE) {
    if (!eligible(s, spec)) continue
    const choices = spec.choices!
    const paid = choices.slice(0, -1)
    const options = paid.map((c, i) => option(s, c, i))
    if (options.length === 0) continue
    cards.push({
      id: spec.id,
      title: spec.title ?? spec.id,
      summary: options[0].effects,
      options,
      group: 'more',
      repeatable: REPEATABLE.has(topicOf(spec.id)),
      topic: topicOf(spec.id),
    })
  }
  // the first five by how likely the event is to come to him (its weight), the rest folded
  const w = (c: ShopCard) => weightOf(defOf(SOURCE.find((x) => x.id === c.id)!), s)
  cards.sort((a, b) => w(b) - w(a))
  cards.slice(0, 5).forEach((c) => (c.group = 'now'))
  return cards
}

function option(s: LifeState, c: ChoiceSpec, index: number): ShopOption {
  const cost = -Math.min(0, c.effects?.money ?? 0)
  const open = (!c.when || c.when(s)) && s.money >= cost
  return {
    index,
    label: c.label,
    hint: c.hint,
    cost,
    effects: effectWords(c.effects),
    later: !!c.follow?.length,
    open,
  }
}

export const topicOf = (id: string): string => id.split('.').slice(0, 2).join('.')
/** the kinds of spending that can repeat by themselves, once the player turns them on (they do not choose anything one-of-a-kind) */
export const REPEATABLE = new Set(['sp.parents', 'sp.outing', 'sp.trip', 'sp.culture', 'sp.course', 'sp.lessons', 'sp.hobby', 'sp.community', 'sp.camp', 'sp.table', 'sp.study', 'sp.gear'])

export interface ShopResult {
  ok: boolean
  /** why not, when it did not happen */
  reason?: string
  lines: LogEntry[]
}

function shopRng(s: LifeState, id: string): Rng {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  const n = s.evHist?.[id]?.[1] ?? 0
  return makeRng(hashSeed(s.config.seed ^ Math.imul(s.age + 1, 0x2545f491) ^ (h >>> 0) ^ Math.imul(n + 1, 0x9e3779b1) ^ 0x73686f70))
}

/**
 * Buy: the choice `index` of the event `id`, once. The money is taken by the choice's own effect (never by this function), the event is
 * marked as having happened (so its limits hold and the yearly draw leaves it alone), and the lines it writes are returned, to be put in
 * the log by the caller.
 */
export function buyShop(s: LifeState, id: string, index: number): ShopResult {
  const spec = SOURCE.find((x) => x.id === id)
  if (!spec || !eligible(s, spec) || !age18(s)) return { ok: false, reason: 'いまは選べません', lines: [] }
  const choices = spec.choices!
  if (index < 0 || index >= choices.length - 1) return { ok: false, reason: 'いまは選べません', lines: [] }
  const o = option(s, choices[index], index)
  if (!o.open) return { ok: false, reason: s.money < o.cost ? 'お金が足りません' : '条件に合いません', lines: [] }
  const def = defOf(spec)
  const lines: LogEntry[] = []
  const rng = shopRng(s, id)
  const base: EventCtx = {
    s,
    rng,
    headless: false,
    add: (kind: LogKind, text: string, opts) => lines.push({ age: s.age, year: s.year, kind, text, ...(opts?.key ? { key: true } : {}), ...(opts?.eventId ? { eventId: opts.eventId } : {}), ...(opts?.category ? { category: opts.category } : {}) }),
    ask: () => {},
    canAsk: () => false,
  }
  markSeen(s, id)
  // the event's own resolve, on the one choice (its `open` list holds only that choice)
  def.resolve!(tagged(base, def), 0, { open: String(index) })
  return { ok: true, lines }
}

// ---------------------------------------------------------------- the standing settings

export type Vehicle = 'deposit' | 'bond' | 'balanced' | 'index' | 'world'
/** where the spare money is kept: the average a year after prices and the swing (game assumptions, not forecasts) */
export const VEHICLES: Record<Vehicle, { label: string; note: string; mean: number; sd: number }> = {
  deposit: { label: '預金のまま', note: 'これまでどおり。増えも減りもしない', mean: 0, sd: 0 },
  bond: { label: '債券', note: '平均2%前後、値動きは小さい', mean: 0.02, sd: 0.03 },
  balanced: { label: '株と債券を半々にしたファンド', note: '平均3.5%、値動きは中くらい', mean: 0.035, sd: 0.08 },
  index: { label: '株式（インデックス）', note: '平均5%、値動きが大きい', mean: 0.05, sd: 0.16 },
  world: { label: '海外インデックス（世界の株式）', note: '平均4.5%（手数料を引いたあと）、為替でも値動きします', mean: 0.045, sd: 0.17 },
}

export type Insurance = 'none' | 'basic' | 'full'
export type Diet = 'free' | 'balanced' | 'strict'
/** 保険: the premium a year, the share of a medical bill it pays (game assumptions) */
export const INSURANCES: Record<Insurance, { label: string; note: string; premium: number; cover: number }> = {
  none: { label: '入らない', note: '保険料なし。大きな医療費は全額自己負担', premium: 0, cover: 0 },
  basic: { label: '基本の保障', note: '年6万円。医療費の7割を保障', premium: 6, cover: 0.7 },
  full: { label: '手厚い保障', note: '年18万円。医療費の95%を保障', premium: 18, cover: 0.95 },
}
/** 食生活: the cost a year and what it does for the body (small, game assumptions) */
export const DIETS: Record<Diet, { label: string; note: string; cost: number; health: number }> = {
  free: { label: '気ままに食べる', note: '費用なし。変化なし', cost: 0, health: 0 },
  balanced: { label: '栄養バランスを意識', note: '年12万円。健康が少しずつ保たれる', cost: 12, health: 1 },
  strict: { label: '管理栄養士つきの食事', note: '年30万円。健康が手厚く保たれる', cost: 30, health: 2 },
}

export function shopSettings(s: LifeState): { vehicle: Vehicle; auto: string[]; insurance?: Insurance; diet: Diet } {
  return { vehicle: s.shop?.vehicle ?? 'deposit', auto: s.shop?.auto ?? [], insurance: s.shop?.insurance, diet: s.shop?.diet ?? 'free' }
}
const put = (s: LifeState, patch: Partial<NonNullable<LifeState['shop']>>) => {
  const cur = s.shop ?? { vehicle: 'deposit' as Vehicle, auto: [] as string[] }
  s.shop = { ...cur, ...patch }
}
export function setVehicle(s: LifeState, v: Vehicle): void {
  put(s, { vehicle: v })
}
export function setInsurance(s: LifeState, v: Insurance): void {
  put(s, { insurance: v })
}
export function setDiet(s: LifeState, v: Diet): void {
  put(s, { diet: v })
}
export function toggleAuto(s: LifeState, topic: string): boolean {
  const cur = shopSettings(s)
  const on = !cur.auto.includes(topic)
  put(s, { auto: on ? [...cur.auto, topic] : cur.auto.filter((t) => t !== topic) })
  return on
}

/** a medical bill of the year (万円): the whole bill and his own share after the insurance */
export interface CareBill {
  bill: number
  own: number
}
export type CareWay = 'hospital' | 'light' | 'none'
/**
 * The ways to meet an illness or an injury (PROJECT_PLAN §11.61; game assumptions): treated in full at a hospital (the bill, as before,
 * and the old おまかせ), only outpatient visits (a third of his share, more harm, a higher chance of it coming back for 2 years), or no
 * treatment (nothing paid, the most harm, a much higher chance of it coming back for 3 years).
 */
export const CARE_WAYS: Record<CareWay, { label: string; pay: number; health: number; again: number; years: number }> = {
  hospital: { label: '病院でしっかり治療する', pay: 1, health: -2, again: 0, years: 0 },
  light: { label: '通院だけにして、費用を抑える', pay: 0.35, health: -5, again: 0.05, years: 2 },
  none: { label: '治療を受けない', pay: 0, health: -9, again: 0.12, years: 3 },
}
const careFlag = (w: CareWay) => `care.${w}`

/** pays for the way he chose and moves the health; the line of the log */
export function treatCare(s: LifeState, b: CareBill, way: CareWay): { kind: LogKind; text: string } {
  const w = CARE_WAYS[way]
  const pay = Math.round(b.own * w.pay)
  s.money -= pay
  s.status.health = Math.max(0, s.status.health + w.health)
  if (w.again) s.flags = { ...s.flags, [careFlag(way)]: s.age }
  const covered = b.bill - b.own
  if (way === 'hospital')
    return { kind: 'bad', text: `病気やけがで医療費が${b.bill}万円かかりました。${covered > 0 ? `保障で${covered}万円が出て、自己負担は${b.own}万円でした。` : '保険に入っていなかったため、全額を自分で払いました。'}` }
  if (way === 'light') return { kind: 'bad', text: `病気やけがを、通院だけで治すことにしました。払ったのは${pay}万円。体には、まだ少し不安が残っています。` }
  return { kind: 'bad', text: '病気やけがを、治療を受けずにやり過ごすことにしました。お金はかかりませんでしたが、体はつらいままです。' }
}

/** the choice of how to be treated, with what each way costs him now (万円) and does */
export function careChoices(s: LifeState, b: CareBill): { label: string; hint: string }[] {
  return (Object.keys(CARE_WAYS) as CareWay[]).map((k) => {
    const w = CARE_WAYS[k]
    const pay = Math.round(b.own * w.pay)
    const short = pay > s.money ? `。所持金が足りず、貯金がマイナスになります` : ''
    const again = w.again ? `。${w.years}年のあいだ、再発しやすくなる` : ''
    return { label: w.label, hint: `自己負担 ${pay.toLocaleString()}万円・健康−${Math.abs(w.health)}${again}${short}` }
  })
}

/**
 * The year of the insurance and the diet, once a year, only for what he chose (nothing is taken from a life that never set them): the
 * premium and the food cost leave the savings, the diet moves the health, and once the insurance is set a medical bill may come
 * (6% a year, 10% from 45, more for a while after one left untreated; 80–300万円 on Japan's scale, in the money of the country he lives
 * in; drawn from a stream of its own), the plan paying its share. `decide` may take the bill to ask him how to be treated (it returns
 * true when it asks); otherwise he is treated at a hospital, as before. Returns the lines (kind, text).
 */
export function careYear(s: LifeState, decide?: (b: CareBill) => boolean): { kind: LogKind; text: string }[] {
  const out: { kind: LogKind; text: string }[] = []
  if (!s.shop || s.age < 18) return out
  const { insurance, diet } = s.shop
  if (diet && diet !== 'free') {
    const d = DIETS[diet]
    if (s.money >= d.cost * 2) {
      s.money -= d.cost
      s.status.health = Math.min(100, s.status.health + d.health)
    }
  }
  if (insurance) {
    const p = INSURANCES[insurance]
    s.money -= p.premium
    const r = makeRng(hashSeed(s.config.seed ^ Math.imul(s.age + 1, 0x3c6ef372) ^ 0x63617265))
    // an illness left untreated (or only half treated) comes back more often for a while
    let again = 0
    for (const k of Object.keys(CARE_WAYS) as CareWay[]) {
      const at = s.flags?.[careFlag(k)]
      if (at !== undefined && s.age - at <= CARE_WAYS[k].years) again = Math.max(again, CARE_WAYS[k].again)
    }
    if (r.chance((s.age >= 45 ? 0.1 : 0.06) + again)) {
      const scale = PROFILES[residenceOf(s)]?.scale ?? 1
      const bill = Math.max(1, Math.round((80 + Math.round(r.next() * 220)) * scale))
      const b = { bill, own: Math.round(bill * (1 - p.cover)) }
      if (!decide?.(b)) out.push(treatCare(s, b, 'hospital'))
    }
  }
  return out
}

/** the savings at the start of each year, kept for the trend chart (only in a life that uses the screen) */
export function recordHist(s: LifeState): void {
  if (!s.shop || s.age < 18) return
  const h = (s.shop.hist ??= [])
  if (h.length && h[h.length - 1][0] === s.age) h[h.length - 1][1] = s.money
  else h.push([s.age, Math.round(s.money)])
}

/** the spare money: what is above a year's income (and at least 100 万円) */
export const spareMoney = (s: LifeState): number => Math.max(0, s.money - Math.max(100, s.income))

/**
 * The year of the spare money, once a year: only for a man who chose a vehicle other than the deposit. The swing is drawn from a stream
 * of its own (the seed and the age). Returns the gain (万円), 0 when nothing was done.
 */
export function portfolioYear(s: LifeState): number {
  const v = s.shop?.vehicle
  if (!v || v === 'deposit' || s.age < 18) return 0
  const base = spareMoney(s)
  if (base <= 0) return 0
  const r = makeRng(hashSeed(s.config.seed ^ Math.imul(s.age + 1, 0x7f4a7c15) ^ 0x706f7274))
  const spec = VEHICLES[v]
  const gain = Math.round(base * (spec.mean + spec.sd * r.normal()))
  s.money += gain
  return gain
}

/**
 * The repeating spending, once a year: for each kind he turned on, the first paid option of the event when it is open to him, and
 * only if the savings are at least three times its cost and a year's income would still be left (the rule the screen states).
 * Returns the lines to write (the caller puts them in the year's log).
 */
export function autoShopYear(s: LifeState): LogEntry[] {
  const auto = s.shop?.auto
  if (!auto || auto.length === 0 || s.age < 18) return []
  const out: LogEntry[] = []
  for (const topic of auto) {
    for (const spec of SOURCE) {
      if (topicOf(spec.id) !== topic || !eligible(s, spec)) continue
      const o = option(s, spec.choices![0], 0)
      if (!o.open || o.cost <= 0 || s.money < o.cost * 3 || s.money - o.cost < s.income) continue
      const r = buyShop(s, spec.id, 0)
      if (r.ok) out.push(...r.lines)
    }
  }
  return out
}
