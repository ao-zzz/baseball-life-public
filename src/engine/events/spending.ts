import type { LifeState } from '../types.ts'
import type { CountryCode } from '../../data/types.ts'
import { hasFlag, hasFamily, holdsJob, type ChoiceSpec, type Effect, type EventSpec, type OutcomeSpec } from './spec.ts'
import { livesIn } from '../countries/index.ts'

// Spending money and investing it (PROJECT_PLAN §11.41). One set of events, written once as a function of a country's profile
// (its words, its sums, its customs) and made for every country that has a profile: the Japanese and the American today, the others
// by adding a profile. They are events of daily life tied to where he lives (`lives`, drawn by the resident pass), so they follow a
// man who has moved. What a man may choose depends on what he has (`choice.when`: savings, home, family, age); the choice that costs
// nothing is always there and is the おまかせ answer. So a life that never chooses keeps its money as it was, in Japan above all
// (the fingerprint of the Japanese lives), and the money and the other states change only by a choice, and by its follow-up.
// Not repeated here: the homes of a man who has stopped playing (afterEvents.ts, the US's usLifeYear), the stocks of x.life.invest
// (this set takes its flag 'invest.started', so only one of the two is met), the house repairs and the education fund of Japan
// (x.life.reform, x.life.eduFund). The sums (万円) and the chances are game assumptions, not prices or returns.

export interface Profile {
  cc: CountryCode
  /** the stages in which the profile's events may happen (Japan's: after high school, where nothing calibrated reads these states) */
  stages: EventSpec['stages']
  carNew: string
  carNewCost: number
  carUsed: string
  carUsedCost: number
  hobby: string
  club: string
  tripNear: string
  tripFar: string
  neighbourhood: string
  localGroup: string
  gym: string
  /** whether this country's homes are also bought while playing (Japan's are, in its adult table, after baseball only) */
  homeWhilePlaying: boolean
  homeWord: string
  /** the lessons, the courses and the culture of the country (for the texts) */
  lesson: string
  cert: string
  culture: string
  downPayment: number
  loan: number
  /** the size of the country's money against Japan's table (after.ts HOUSEHOLDS scale; absent = 1): every sum of the topics is written on Japan's scale and made smaller here (PROJECT_PLAN §11.46) */
  scale?: number
}

export const PROFILES: Partial<Record<CountryCode, Profile>> = {
  JP: {
    cc: 'JP', stages: ['univ', 'amateur', 'pro', 'adult', 'senior'], carNew: '国産のコンパクトカー', carNewCost: 180, carUsed: '中古の軽自動車', carUsedCost: 50,
    hobby: '釣り', club: '地元の釣りの会', tripNear: '近くの温泉', tripFar: '少し足を延ばした海辺の旅館', neighbourhood: '町内会', localGroup: '商店街の祭りの実行委員',
    gym: '駅前のスポーツジム', homeWhilePlaying: true, homeWord: 'マンション', lesson: 'そろばんや水泳などの習い事', cert: '簿記や宅建などの資格講座', culture: '美術館や歌舞伎', downPayment: 400, loan: 2800,
  },
  US: {
    cc: 'US', stages: ['univ', 'pro', 'adult', 'senior'], carNew: '大きなピックアップトラック', carNewCost: 260, carUsed: '中古のセダン', carUsedCost: 70,
    hobby: 'ゴルフ', club: '地元のゴルフクラブ', tripNear: '近くの湖のキャビン', tripFar: '国立公園へのキャンピングカーの旅', neighbourhood: '近所の自治会', localGroup: '町のリトルリーグの運営委員',
    gym: '町の大きなジム', homeWhilePlaying: false, homeWord: '庭つきの一軒家', lesson: '野球やピアノのレッスンと課外活動', cert: '地域のカレッジの職業講座', culture: '博物館や劇場', downPayment: 500, loan: 3200,
  },
  // Korea and Cuba (PROJECT_PLAN §11.46): the same topics in the words and the sums of the country (an estimate of a customary choice, not a
  // price list). The sums are on Japan's scale and made smaller by `scale` (Cuba's purse is a quarter of Japan's in the model).
  KR: {
    cc: 'KR', stages: ['univ', 'pro', 'adult', 'senior'], carNew: '国産のセダン', carNewCost: 220, carUsed: '中古の小型車', carUsedCost: 60,
    hobby: '登山', club: '地元の登山会', tripNear: '東海岸の海辺の宿', tripFar: '済州島への旅行', neighbourhood: '町内の集まり', localGroup: '地域の祭りの実行委員',
    gym: '町のフィットネスクラブ', homeWhilePlaying: false, homeWord: 'マンション', lesson: '塾や習い事', cert: '資格学院の講座', culture: '博物館や映画', downPayment: 1200, loan: 5000,
  },
  CU: {
    cc: 'CU', stages: ['univ', 'pro', 'adult', 'senior'], carNew: '小型の乗用車', carNewCost: 500, carUsed: '中古のバイク', carUsedCost: 80,
    hobby: 'ドミノ', club: '近所のドミノ仲間', tripNear: '近くの海岸', tripFar: '遠い州の親戚の家への旅', neighbourhood: '地区の集まり', localGroup: '地区の祭りの実行委員',
    gym: '近所の体操場', homeWhilePlaying: false, homeWord: '自分の家', lesson: '音楽や野球の教室', cert: '職業訓練の講座', culture: '音楽と踊りの催し', downPayment: 600, loan: 0, scale: 0.25,
  },
}

/**
 * A spec on the scale of a country's money: every sum (effects and the 約N万円 of the hints) multiplied by `k`, and every condition that
 * reads his savings asked with them divided by `k` (so "he has 500" means 500 on Japan's scale). The sums of the topics are written once,
 * on Japan's scale, and each country with a smaller or larger purse gets the same topics in its own money.
 */
function scaled(spec: EventSpec, k: number): EventSpec {
  if (k === 1) return spec
  const m = (n: number) => (n === 0 ? 0 : Math.sign(n) * Math.max(1, Math.round(Math.abs(n) * k)))
  const eff = (e?: Effect): Effect | undefined => (e && e.money !== undefined ? { ...e, money: m(e.money) } : e)
  const hint = (h?: string) => h?.replace(/約([\d,]+)万円/g, (_, n: string) => `約${Math.max(1, Math.round(Number(n.replace(/,/g, '')) * k)).toLocaleString()}万円`)
  const out = (o: OutcomeSpec): OutcomeSpec => ({ ...o, effects: eff(o.effects) })
  const inner = (s: LifeState): LifeState => ({ ...s, money: s.money / k })
  const wrap = (f?: (s: LifeState) => boolean) => (f ? (s: LifeState) => f(inner(s)) : f)
  return {
    ...spec,
    when: wrap(spec.when),
    outcomes: spec.outcomes?.map(out),
    choices: spec.choices?.map((c) => ({ ...c, hint: hint(c.hint), when: wrap(c.when), effects: eff(c.effects), outcomes: c.outcomes.map(out) })),
  }
}

/** the fact that he has a hobby, by the profiles' hobby (the same facts as afterEvents ADULT_HOBBIES) */
const HOBBY_FLAG: Record<string, string> = { 釣り: 'hobby.fish', ゴルフ: 'hobby.golf', 登山: 'hobby.climb', ドミノ: 'hobby.domino' }

const PLAY = new Set(['univ', 'company', 'indep', 'proMinor', 'pro', 'abroad'])
const playing = (s: LifeState) => PLAY.has(s.career.phase)
const kidsUnder = (s: LifeState, n: number) => (s.family.kids ?? []).filter((k) => k < n).length
const family = (s: LifeState) => !!s.family.spouse || kidsUnder(s, 18) > 0
const rich = (s: LifeState, n: number) => s.money >= n

/** a spending spec: tied to the country he lives in, a subject of its own, the stages of the profile */
function make(p: Profile, topic: string, raw: Omit<EventSpec, 'id' | 'category' | 'lives' | 'stages'> & { stages?: EventSpec['stages'] }): EventSpec {
  const tag = p.cc.toLowerCase()
  const spec = scaled(raw as EventSpec, p.scale ?? 1)
  return {
    ...spec,
    choices: affordable(spec.choices),
    // (the free answer's line is the same every time: at most three times in a life, the limit of the log's repetition test)
    maxPerLife: Math.min(3, spec.maxPerLife ?? 1),
    id: `sp.${topic}.${tag}`,
    category: `sp.${topic}`,
    lives: p.cc,
    theme: spec.theme ?? 'money',
    stages: spec.stages ?? p.stages,
    when: (s) => livesIn(s, p.cc) && (!spec.when || spec.when(s)),
  }
}
const follow = (p: Profile, topic: string) => `sp.${topic}.${p.cc.toLowerCase()}`
const NONE = (label: string, text: string): ChoiceSpec => ({ label, outcomes: [{ text }] })

/**
 * A choice that costs money is offered only to a man who can pay it with something to spare: the savings must cover the cost and 20 more
 * (a condition of its own, when it has none). One rule for every event that spends, so that no dialog shows a choice he cannot make.
 */
export function affordable(choices: ChoiceSpec[] | undefined): ChoiceSpec[] | undefined {
  return choices?.map((c) => {
    const cost = -Math.min(0, c.effects?.money ?? 0)
    return cost > 0 && !c.when ? { ...c, when: (s: LifeState) => s.money >= cost + 20 } : c
  })
}

function topics(p: Profile): EventSpec[] {
  const out: EventSpec[] = []
  const add = (topic: string, spec: Parameters<typeof make>[2]) => out.push(make(p, topic, spec))

  // ------------------------------------------------------------ a car
  add('car', {
    ages: [20, 70],
    when: (s) => !hasFlag(s, 'own.car') && (s.money >= p.carUsedCost + 20 || s.age >= 30),
    weight: 1.6,
    cooldown: 6,
    maxPerLife: 2,
    title: '車を持つか',
    // (the away games only while he plays)
    body: (s) => `移動のたびに時間を取られます。自分の車があれば、${playing(s) ? '遠征のない日の' : '毎日の'}動きが楽になりそうです。`,
    auto: 2,
    choices: [
      { label: `${p.carNew}を新車で買う`, hint: `約${p.carNewCost}万円`, when: (s) => rich(s, p.carNewCost + 100), flag: 'own.car', effects: { money: -p.carNewCost, happy: 3 }, outcomes: [{ text: `${p.carNew}を契約しました。納車の日、ハンドルを握る手が少し震えました。`, kind: 'good' }] },
      { label: `${p.carUsed}を買う`, hint: `約${p.carUsedCost}万円`, when: (s) => rich(s, p.carUsedCost + 20), flag: 'own.car', effects: { money: -p.carUsedCost, happy: 1 }, outcomes: [{ weight: 3, text: `${p.carUsed}を手に入れました。走りは地味でも、行きたい場所へ自由に動けます。` }, { weight: 1, text: `買った${p.carUsed}は、すぐに修理が必要になりました。思わぬ出費です。`, effects: { money: -15, happy: -1 } }] },
      NONE('買わずに、公共交通と相乗りで済ませる', '車は持たず、電車やバス、仲間との相乗りで済ませることにしました。'),
    ],
  })

  // ------------------------------------------------------------ a home while still playing
  if (p.homeWhilePlaying) {
    add('home', {
      stages: ['amateur', 'pro'],
      ages: [25, 45],
      when: (s) => s.after?.home !== 'own' && s.after?.home !== undefined && playing(s) && rich(s, p.downPayment + 100),
      weight: 1.4,
      cooldown: 6,
      maxPerLife: 1,
      title: '家を買うか',
      body: `貯金がたまり、${p.homeWord}を買うことを考えるようになりました。引っ越しの多い野球の暮らしで、持ち家は重い選択です。`,
      auto: 2,
      choices: [
        { label: `頭金を出して${p.homeWord}を買う`, hint: `頭金 約${p.downPayment}万円、ローン${p.loan}万円`, when: (s) => rich(s, p.downPayment + 100), effects: { money: -p.downPayment, happy: 3, know: 1, home: 'own', loan: p.loan }, follow: [{ id: follow(p, 'homeBack'), after: 3, within: 5 }], outcomes: [{ text: `${p.homeWord}の契約書にサインしました。ローンの長い道のりが始まりました。`, kind: 'big', key: true }] },
        { label: '賃貸のまま、身軽にしておく', effects: { money: 10 }, outcomes: [{ text: '契約の更新だけを済ませ、貯金はそのまま残しました。' }] },
        NONE('今は決めない', '住まいの話は、シーズンが終わってから考えることにしました。'),
      ],
    })
    out.push(
      make(p, 'homeBack', {
        followOnly: true,
        stages: ['univ', 'amateur', 'pro', 'adult', 'senior'],
        outcomes: [
          { weight: 2, text: '移籍の話が出ても、住まいの心配は要らなくなりました。家族と過ごす家があることが、心の支えです。', effects: { happy: 3, rel: 2 } },
          { weight: 1, text: '契約の都合で遠くへ移ることになり、持ち家を貸すか売るかで頭を悩ませました。', effects: { money: -30, happy: -1 } },
        ],
      }),
    )
  }

  // ------------------------------------------------------------ investing: what he can risk depends on what he has
  add('invest', {
    ages: [24, 75],
    when: (s) => rich(s, 100) && !hasFlag(s, 'inv.pending'),
    weight: 2,
    cooldown: 5,
    maxPerLife: 2,
    title: '貯金の置き場所',
    body: '預金が口座に眠っています。どこまでの危険を取るかで、置き場所は変わります。',
    auto: 5,
    choices: [
      { label: '少額を、毎月の積み立てに回す', hint: '手元が少なくても始められる。ゆっくり増える', when: (s) => rich(s, 100), flag: ['invest.started', 'inv.pending', 'inv.index'], follow: [{ id: follow(p, 'investBack'), after: 3, within: 5 }], effects: { money: -60, know: 1 }, outcomes: [{ text: '証券口座を開き、毎月の積み立てを決めました。', kind: 'good' }] },
      { label: '個別の株に、まとまった額を入れる', hint: '大きく増えることも、減ることもある', when: (s) => rich(s, 400), flag: ['invest.started', 'inv.pending', 'inv.stocks'], follow: [{ id: follow(p, 'investBack'), after: 3, within: 5 }], effects: { money: -200, know: 2 }, outcomes: [{ text: '調べた会社の株を、まとめて買いました。毎朝の値動きが気になります。' }] },
      { label: '賃貸用の不動産に、頭金を出す', hint: '資産が大きい人向け。空室や修繕のリスクがある', when: (s) => rich(s, 1500), flag: ['invest.started', 'inv.pending', 'inv.estate'], follow: [{ id: follow(p, 'investBack'), after: 4, within: 6 }], effects: { money: -800, know: 2 }, outcomes: [{ text: '賃貸用の部屋を一つ買い、管理会社と契約しました。' }] },
      { label: '知人の事業に出資する', hint: '成功すれば大きいが、全額を失うこともある', when: (s) => rich(s, 700), flag: ['invest.started', 'inv.pending', 'inv.venture'], follow: [{ id: follow(p, 'investBack'), after: 3, within: 5 }], effects: { money: -300, rel: 1 }, outcomes: [{ text: '知人の新しい事業に、出資の契約を交わしました。' }] },
      { label: '勉強してから、また考える', effects: { know: 2 }, outcomes: [{ text: '本を何冊か買い込み、仕組みを勉強することにしました。', effects: { money: -3 } }] },
      NONE('預金のままにしておく', '預金は預金のまま、手を付けないことにしました。'),
    ],
  })
  out.push(
    make(p, 'investBack', {
      followOnly: true,
      stages: ['univ', 'amateur', 'pro', 'adult', 'senior'],
      outcomes: [
        // an index saver: usually a gain
        { when: (s) => hasFlag(s, 'inv.index'), weight: 4, text: '積み立ては、淡々と続けた分だけ、確かなふくらみになりました。', effects: { money: 130, happy: 2, unflag: ['inv.pending', 'inv.index'] } },
        { when: (s) => hasFlag(s, 'inv.index'), weight: 1, text: '相場が崩れた年に怖くなって売り、積み立てた分を少し割り込みました。', effects: { money: 45, happy: -2, unflag: ['inv.pending', 'inv.index'] } },
        { when: (s) => hasFlag(s, 'inv.stocks'), weight: 2, text: '選んだ会社が大きく伸び、売った額は、入れた額の数倍になりました。', kind: 'good', effects: { money: 650, happy: 4, unflag: ['inv.pending', 'inv.stocks'] } },
        { when: (s) => hasFlag(s, 'inv.stocks'), weight: 2, text: '株価は上がったり下がったりしながら、入れた額より少し増えた程度で落ち着きました。', effects: { money: 240, unflag: ['inv.pending', 'inv.stocks'] } },
        { when: (s) => hasFlag(s, 'inv.stocks'), weight: 2, text: '業績の悪化で株価が崩れ、入れた額の半分も戻りませんでした。', kind: 'bad', effects: { money: 80, happy: -4, unflag: ['inv.pending', 'inv.stocks'] } },
        { when: (s) => hasFlag(s, 'inv.estate'), weight: 3, text: '部屋の家賃が安定して入り、売却のときには、買った値段を上回る額になりました。', kind: 'good', effects: { money: 1400, happy: 3, unflag: ['inv.pending', 'inv.estate'] } },
        { when: (s) => hasFlag(s, 'inv.estate'), weight: 2, text: '空室が続き、修繕費もかさんで、ほとんど儲けのないまま手放しました。', effects: { money: 760, happy: -2, unflag: ['inv.pending', 'inv.estate'] } },
        { when: (s) => hasFlag(s, 'inv.venture'), weight: 1, text: '出資した事業が当たり、会社は大きくなりました。持ち分の価値は、何倍にもなりました。', kind: 'big', key: true, effects: { money: 1500, happy: 6, rel: 2, unflag: ['inv.pending', 'inv.venture'] } },
        { when: (s) => hasFlag(s, 'inv.venture'), weight: 2, text: '事業は軌道に乗らず、出資したお金は少し戻っただけでした。', effects: { money: 90, happy: -3, unflag: ['inv.pending', 'inv.venture'] } },
        { when: (s) => hasFlag(s, 'inv.venture'), weight: 2, text: '事業は行き詰まり、出資したお金は戻ってきませんでした。', kind: 'bad', effects: { happy: -6, rel: -2, unflag: ['inv.pending', 'inv.venture'] } },
      ],
    }),
  )

  // ------------------------------------------------------------ the family and the neighbourhood
  // (a hobby he already has, from this event or another (afterEvents hobby.adult, lifeStories x.life.hobby), is not offered again)
  const hobbyFlag = HOBBY_FLAG[p.hobby] ?? `hobby.${p.cc.toLowerCase()}`
  add('hobby', {
    ages: [22, 80],
    // (one who tried it once with borrowed gear is not invited the same way again: feedback r11 A6)
    when: (s) => !hasFlag(s, hobbyFlag) && !hasFlag(s, `${hobbyFlag}.tried`),
    weight: 1.3,
    cooldown: 6,
    maxPerLife: 2,
    title: '趣味に使う',
    body: `知人から、${p.hobby}の道具を一式そろえてみないかと誘われました。時間もお金もかかりますが、気分転換にはなりそうです。`,
    auto: 2,
    choices: [
      { label: `${p.hobby}の道具をそろえ、${p.club}に入る`, hint: '費用は大きいが、仲間ができる', when: (s) => rich(s, 80), flag: [hobbyFlag, 'hobby.started'], effects: { money: -50, happy: 4, rel: 3 }, outcomes: [{ text: `${p.club}の会員になり、週末の${p.hobby}が楽しみになりました。`, kind: 'good' }] },
      { label: '道具は借りて、気軽に一度行ってみる', flag: `${hobbyFlag}.tried`, effects: { money: -6, happy: 2 }, outcomes: [{ text: `借りた道具で${p.hobby}を試すと、思ったより夢中になりました。` }] },
      NONE('今は余裕がないので、見送る', '趣味の誘いは、余裕ができるまで見送ることにしました。'),
    ],
  })
  add('trip', {
    ages: [24, 85],
    when: family,
    weight: 1.5,
    cooldown: 4,
    maxPerLife: 3,
    title: '家族の休暇',
    body: '家族が、休みにどこかへ出かけたがっています。遠出をするか、近場で済ませるか、予算と相談です。',
    auto: 2,
    choices: [
      { label: `${p.tripFar}へ、家族で出かける`, hint: '費用はかさむが、思い出が残る', when: (s) => rich(s, 150), effects: { money: -60, happy: 4, rel: 4 }, outcomes: [{ text: `${p.tripFar}で、家族みんなで過ごしました。写真を何枚も撮りました。`, kind: 'good' }] },
      // (a family of two, without young children: the wife sleeps on the way back)
      { label: `${p.tripNear}で、短い休みを過ごす`, effects: { money: -15, happy: 2, rel: 2 }, outcomes: [{ text: (s) => `${p.tripNear}へ日帰りで出かけました。帰りの車の中で、${kidsUnder(s, 18) > 0 ? '子どもたちは' : '妻は助手席で'}眠っていました。` }] },
      NONE('家で、のんびり過ごす', '休みは家で過ごし、昼寝をして終わりました。'),
    ],
  })
  add('community', {
    ages: [24, 85],
    when: (s) => !hasFlag(s, 'spent.community'),
    weight: 1.4,
    cooldown: 6,
    maxPerLife: 2,
    title: '地域のために使う',
    body: `${p.neighbourhood}の人たちから、地域の行事への協力を頼まれました。時間も、お金も、少しずつ出し合っています。`,
    auto: 2,
    choices: [
      { label: `${p.localGroup}を引き受ける`, hint: '時間をとられるが、顔が広がる', flag: 'spent.community', effects: { money: -20, rel: 5, happy: 2 }, outcomes: [{ text: `${p.localGroup}として、会議と準備に追われました。当日の笑顔が、何よりの報酬でした。`, kind: 'good' }] },
      { label: '寄付だけ、まとまった額を出す', when: (s) => rich(s, 120), effects: { money: -60, rel: 2 }, outcomes: [{ text: '寄付を届けると、ポスターに名前が載りました。少し照れくさい気持ちでした。' }] },
      NONE('忙しいので、今回は断る', `${p.neighbourhood}には丁重に断りを入れ、行事は遠くから応援しました。`),
    ],
  })

  // ------------------------------------------------------------ baseball: where to put money into the game itself
  add('training', {
    stages: ['univ', 'amateur', 'pro'],
    ages: [19, 36],
    career: true,
    when: playing,
    weight: 1.6,
    cooldown: 4,
    maxPerLife: 3,
    title: 'トレーニングの環境',
    body: `練習の質を上げるには、環境への投資も手です。${p.gym}の会員にもなれますが、専用の設備を自分で整える道もあります。`,
    auto: 2,
    choices: [
      { label: '自宅に専用のトレーニング設備を整える', hint: '費用は大きいが、毎日使える', when: (s) => rich(s, 250), effects: { money: -120, gain: 0.02, fatigue: -3, conf: 2 }, outcomes: [{ text: '部屋の一角を、ラックとマットとボール置き場に作り替えました。', kind: 'good' }] },
      { label: `${p.gym}の会員になる`, when: (s) => rich(s, 40), effects: { money: -12, fatigue: -2, conf: 1 }, outcomes: [{ text: `${p.gym}に通い、器具の使い方を教わりました。` }] },
      NONE('これまでの練習環境で続ける', '環境は変えず、今ある設備で工夫して練習を続けることにしました。'),
    ],
  })
  add('coach', {
    stages: ['univ', 'amateur', 'pro'],
    ages: [18, 36],
    when: playing,
    weight: 1.5,
    cooldown: 4,
    maxPerLife: 3,
    title: '個人コーチ',
    body: '自分のフォームを見てくれる人がほしくなりました。実績のある人に頼むと費用はかかりますが、客観的な目が得られます。',
    auto: 2,
    choices: [
      { label: '実績のある個人コーチと、シーズンを通して契約する', hint: '費用が大きい。映像と数字で見てもらえる', when: (s) => rich(s, 200), effects: { money: -90, conf: 3, know: 2 }, outcomes: [{ weight: 3, text: '毎週、動画を見ながらフォームの癖を直しました。迷いが少し消えました。' }, { weight: 1, text: '方針が合わず、教わるほどに迷いが増えました。契約は途中で切り上げました。', effects: { conf: -3, money: 40 } }] },
      { label: '短期の講習会に参加する', when: (s) => rich(s, 40), effects: { money: -15, conf: 1, know: 1 }, outcomes: [{ text: '週末の講習会で、基本の確認と新しい練習法を持ち帰りました。' }] },
      NONE('今のコーチと仲間の意見で続ける', '外部の指導は頼まず、チームの練習と仲間との確認で続けることにしました。'),
    ],
  })
  add('gear', {
    stages: ['univ', 'amateur', 'pro'],
    ages: [18, 38],
    when: playing,
    weight: 1.3,
    cooldown: 3,
    maxPerLife: 3,
    title: '用具を新しくする',
    body: 'グラブとバットの傷みが目立ってきました。最高級にするか、手入れで持たせるか、迷っています。',
    auto: 2,
    choices: [
      { label: '最高級のグラブとバットを、一式そろえる', when: (s) => rich(s, 120), effects: { money: -45, conf: 3 }, outcomes: [{ text: '新しい用具の革の匂いに、気持ちが引き締まりました。' }] },
      { label: '手入れと修理に出して、使い続ける', effects: { money: -6, conf: 1 }, outcomes: [{ text: '手入れの店で、グラブの革が生き返りました。愛着も増しました。' }] },
      NONE('今ある用具を、そのまま使う', '用具は買い替えず、紐を締め直して試合に臨みました。'),
    ],
  })
  add('body', {
    stages: ['univ', 'amateur', 'pro'],
    ages: [19, 40],
    career: true,
    when: playing,
    weight: 1.4,
    cooldown: 4,
    maxPerLife: 3,
    title: '体のケアにお金をかける',
    body: '疲れが抜けにくくなりました。専門のトレーナーのケアを受けるか、自分で整えるか。体は資本です。',
    auto: 2,
    choices: [
      { label: '専属のトレーナーと、定期的なケアを契約する', when: (s) => rich(s, 150), effects: { money: -70, health: 1, fatigue: -5 }, outcomes: [{ text: '毎週のケアで、張りの抜け方が変わりました。体が軽くなりました。', kind: 'good' }] },
      { label: '整体や温熱の店に、たまに通う', when: (s) => rich(s, 30), effects: { money: -10, fatigue: -3 }, outcomes: [{ text: '近くの店で、肩と腰をほぐしてもらいました。眠りが深くなりました。' }] },
      NONE('睡眠とストレッチで、自分で整える', 'お金はかけず、早く寝て、毎晩のストレッチを欠かさないことにしました。'),
    ],
  })
  add('academy', {
    stages: ['pro', 'adult'],
    ages: [28, 60],
    when: (s) => !hasFlag(s, 'biz.academy') && rich(s, 600) && s.career.highestRank >= 7,
    weight: 1.2,
    cooldown: 8,
    maxPerLife: 1,
    title: '野球の事業',
    body: '野球の経験を生かして、子ども向けの野球教室や、打撃練習場を開く話が持ち込まれました。出資するかどうかの決断です。',
    auto: 2,
    choices: [
      { label: '打撃練習場と教室に、大きく出資する', hint: '成功すれば野球界での顔が広がる。失敗もありうる', when: (s) => rich(s, 800), flag: 'biz.academy', follow: [{ id: follow(p, 'academyBack'), after: 4, within: 6 }], effects: { money: -400, rel: 2 }, outcomes: [{ text: '共同経営者と一緒に、練習場の契約書にサインしました。', kind: 'big', key: true }] },
      { label: '出資は小さくして、講師として手伝う', flag: 'biz.academy', effects: { money: -80, rel: 3, happy: 2 }, outcomes: [{ text: '週末の講師として、子どもたちに打ち方を教える仕事を始めました。' }] },
      NONE('事業には手を出さない', '事業の話は、丁寧に断りました。野球は、現役の間はプレーだけで十分です。'),
    ],
  })
  out.push(
    make(p, 'academyBack', {
      followOnly: true,
      stages: ['pro', 'adult', 'senior'],
      outcomes: [
        { weight: 2, text: '練習場は地元の少年少女で賑わい、出資した分は、利益を上乗せして戻ってきました。', kind: 'good', effects: { money: 850, happy: 4, rel: 3 } },
        { weight: 1, text: '競合の施設に押され、練習場は赤字が続きました。出資の半分ほどが戻っただけでした。', effects: { money: 200, happy: -2 } },
      ],
    }),
  )

  // ------------------------------------------------------------ the family: parents, children, a partner
  add('parents', {
    ages: [24, 75],
    when: (s) => s.family.father !== null || s.family.mother !== null,
    weight: 1.4,
    cooldown: 4,
    maxPerLife: 4,
    title: '親の暮らしを支える',
    body: '実家の親が、年を重ねて、病院に通う回数が増えてきました。暮らしの支えをどうするか、考える時期です。',
    auto: 2,
    choices: [
      { label: '毎月の仕送りと、医療費の支援を始める', hint: '費用は大きいが、親の暮らしが安定する', effects: { money: -60, rel: 4, happy: 2 }, outcomes: [{ text: '毎月の送金を決め、病院の付き添いも手配しました。電話口の親の声が、明るくなりました。', kind: 'good' }] },
      { label: '帰省のたびに、手伝いと食材を持っていく', effects: { money: -12, rel: 2 }, outcomes: [{ text: '帰省のたびに、重い荷物を運び、冷蔵庫をいっぱいにして帰りました。' }] },
      NONE('今は親に任せ、様子を見る', '親の暮らしには口を出さず、電話で近況を聞くだけにしました。'),
    ],
  })
  add('lessons', {
    ages: [24, 55],
    when: (s) => kidsUnder(s, 18) > 0,
    weight: 1.5,
    cooldown: 4,
    maxPerLife: 4,
    title: '子どもの教育',
    body: `子どもに、${p.lesson}を受けさせるかどうかの時期です。費用と、子どもの希望のかねあいが悩みどころです。`,
    auto: 2,
    choices: [
      { label: '希望を聞いて、いくつかの習い事に通わせる', hint: '送り迎えと費用が続く', effects: { money: -60, rel: 3, happy: 1 }, outcomes: [{ text: '子どもの時間割はいっぱいになりましたが、楽しそうに通っています。', kind: 'good' }] },
      { label: '本人が選んだ一つだけに絞る', effects: { money: -20, rel: 2 }, outcomes: [{ text: '子どもが選んだ習い事に絞り、週末は付き添いました。' }] },
      NONE('家での遊びと学びを大切にする', '外には通わせず、家で本を読み、キャッチボールをして過ごす時間を増やしました。'),
    ],
  })
  // ------------------------------------------------------------ late in life: money for the children and grandchildren (PROJECT_PLAN §11.61)
  // (the grandchildren are known only as the achievement 孫 of the life after baseball; a choice for them only when he has them)
  const grown = (s: LifeState) => (s.family.kids ?? []).some((k) => k >= 18)
  const grand = (s: LifeState) => s.career.achievements.includes('孫')
  add('allowance', {
    ages: [55, 90],
    when: (s) => (s.family.kids ?? []).length > 0 && s.money >= 150,
    weight: 1.3,
    cooldown: 4,
    maxPerLife: 3,
    title: '家族へのお小遣い',
    body: (s) => `貯金に少し余裕ができました。${grand(s) ? '子どもや孫' : '子ども'}に、何か渡してあげたい気持ちがあります。`,
    auto: 3,
    choices: [
      { label: '子どもに、まとまったお金を贈る', hint: '約100万円。暮らしの足しにしてもらう', when: (s) => grown(s) && rich(s, 120), effects: { money: -100, rel: 4, happy: 3 }, outcomes: [{ text: '子どもに、暮らしの足しにと、まとまったお金を渡しました。「大事に使うよ」と言われ、胸が温かくなりました。', kind: 'good' }] },
      { label: '孫にお小遣いをあげる', hint: '約10万円', when: (s) => grand(s) && rich(s, 30), effects: { money: -10, rel: 2, happy: 3 }, outcomes: [{ text: '孫にお小遣いを渡すと、目を輝かせて「ありがとう」と言いました。何に使うのか、聞くのが楽しみです。', kind: 'good' }] },
      { label: '家族みんなで食事に出かけ、ごちそうする', hint: '約8万円', when: (s) => rich(s, 28), effects: { money: -8, rel: 3, happy: 2 }, outcomes: [{ text: '家族を集めて食事に出かけ、会計は自分が持ちました。にぎやかな食卓に、時間を忘れました。' }] },
      NONE('老後の暮らしのために取っておく', 'お金は、これからの暮らしのために取っておくことにしました。'),
    ],
  })
  add('outing', {
    ages: [19, 60],
    when: (s) => !!s.family.partner && !s.family.spouse,
    weight: 1.5,
    cooldown: 2,
    maxPerLife: 5,
    title: '二人の外出',
    body: `${'交際相手'}との外出の予定を考えています。思い切って特別な一日にするか、気軽に過ごすか。`,
    auto: 2,
    choices: [
      { label: '少し奮発して、特別な場所へ出かける', effects: { money: -40, happy: 3, rel: 4 }, outcomes: [{ text: '予約したレストランで、夜景を見ながら食事をしました。帰り道、二人は黙って歩きました。', kind: 'good' }] },
      { label: '気軽な散歩と食事で過ごす', effects: { money: -8, happy: 1, rel: 2 }, outcomes: [{ text: '公園を歩き、屋台で買ったものを分け合いました。ささやかですが、満ち足りた一日でした。' }] },
      NONE('会うのは家で、のんびりと', '外出はせず、家で映画を観て、一日を過ごしました。'),
    ],
  })
  // ------------------------------------------------------------ learning and culture
  add('course', {
    ages: [20, 62],
    weight: 1.4,
    cooldown: 4,
    maxPerLife: 3,
    title: '自分の学び',
    body: `${p.cert}の案内が目に留まりました。勉強は大変ですが、野球のあとの人生の幅が広がりそうです。`,
    auto: 2,
    choices: [
      { label: '教室に通って、資格の取得を目指す', hint: '費用と時間がかかるが、知識が身につく', effects: { money: -25, know: 4, happy: -1 }, outcomes: [{ text: '夜と週末を勉強に充て、テキストの付箋が日ごとに増えていきました。', kind: 'good' }] },
      { label: 'オンラインの講座を、少しずつ受ける', effects: { money: -5, know: 1 }, outcomes: [{ text: '移動中に講義の動画を観て、すきま時間に学びを重ねました。' }] },
      NONE('今は学びより、休む時間を優先する', '勉強の誘いは、今年は見送ることにしました。'),
    ],
  })
  add('culture', {
    ages: [18, 85],
    weight: 1.2,
    cooldown: 3,
    maxPerLife: 4,
    title: '文化に触れる',
    body: `${p.culture}に出かけてみないかという誘いがありました。野球とは違う世界に、少し触れてみたい気持ちもあります。`,
    auto: 2,
    choices: [
      { label: `${p.culture}にきちんと出かけ、ゆっくり味わう`, effects: { money: -12, happy: 3, know: 2 }, outcomes: [{ text: '展示や舞台の前で足を止め、野球場とは違う空気を吸い込みました。', kind: 'good' }] },
      { label: '地元の無料の催しに、気軽に顔を出す', effects: { money: -2, happy: 1 }, outcomes: [{ text: '町の広場の小さな催しに立ち寄り、見知らぬ人と並んで拍手をしました。' }] },
      NONE('今回は出かけない', '誘いは丁重に断り、家で静かに過ごしました。'),
    ],
  })
  // ------------------------------------------------------------ the home
  add('moving', {
    ages: [20, 60],
    when: (s) => s.after?.home === 'rent',
    weight: 1.3,
    cooldown: 5,
    maxPerLife: 3,
    title: '引っ越し',
    body: '賃貸の契約の更新の時期です。いまの部屋に不満はなくても、住まいを変える選択もあります。',
    auto: 2,
    choices: [
      { label: '広くて新しい部屋に引っ越す', hint: '敷金と引っ越し費用、家賃も上がる', effects: { money: -30, happy: 3, home: 'rent' }, outcomes: [{ text: '段ボールを積み上げ、新しい部屋の窓から、知らない景色を眺めました。', kind: 'good' }] },
      // (the ballpark for a player, the workplace for one who works, the station for the rest; the line after it follows the same)
      { label: '職場や球場、駅に近い部屋に移る', effects: { money: -18, happy: 1, rel: 1, home: 'rent' }, outcomes: [{ text: (s) => (holdsJob(s) || playing(s) ? '通勤の時間が短くなり、朝のゆとりができました。' : '駅が近くなり、出かけるのが楽になりました。') }] },
      NONE('契約を更新して、住み続ける', '更新の書類に判を押し、いまの部屋に住み続けることにしました。'),
    ],
  })
  add('fixup', {
    ages: [26, 80],
    when: (s) => s.after?.home === 'own',
    weight: 1.2,
    cooldown: 6,
    maxPerLife: 3,
    title: '住まいの設備',
    body: '給湯器や台所の設備が古くなってきました。まとめて新しくするか、壊れた分だけ直すか。',
    auto: 2,
    choices: [
      { label: '台所と水まわりを、まとめて新しくする', effects: { money: -150, happy: 4 }, outcomes: [{ text: (s) => (hasFamily(s) ? '工事が終わった日、新しい台所で、家族みんなで最初の食事をしました。' : '工事が終わった日、新しい台所で、さっそく最初の食事を作りました。'), kind: 'good' }] },
      { label: '壊れた設備だけ、交換する', effects: { money: -25, happy: 1 }, outcomes: [{ text: '業者を呼んで、古い給湯器を新しいものに取り替えてもらいました。' }] },
      NONE('だましだまし使い続ける', '設備は直さず、様子を見ながら使い続けることにしました。'),
    ],
  })
  // ------------------------------------------------------------ baseball: the off-season, the table, the mind, the life after
  add('camp', {
    stages: ['univ', 'amateur', 'pro'],
    ages: [19, 38],
    career: true,
    when: playing,
    weight: 1.4,
    cooldown: 3,
    maxPerLife: 4,
    title: 'オフの自主トレ',
    body: 'シーズンが終わり、オフの過ごし方を考える時期です。専門の施設で合同自主トレをするか、地元で一人で整えるか。',
    auto: 2,
    choices: [
      { label: '専門施設の合同自主トレに参加する', hint: '費用は大きいが、質の高い練習と人脈が得られる', when: (s) => rich(s, 150), effects: { money: -70, gain: 0.01, conf: 3, fatigue: -2, rel: 2 }, outcomes: [{ text: '早朝から夜まで、同じ志の選手たちと汗を流しました。夜の食堂で交わした言葉が、翌年の力になりました。', kind: 'good' }] },
      { label: '地元の球場で、一人で自主トレをする', effects: { money: -5, conf: 1, fatigue: -1 }, outcomes: [{ text: '冷たい風のなか、一人でノックを受け、黙々とスイングを繰り返しました。' }] },
      NONE('オフは、しっかり休むことを優先する', 'オフは野球から離れ、体を休めて過ごしました。'),
    ],
  })
  add('table', {
    stages: ['univ', 'amateur', 'pro'],
    ages: [18, 40],
    when: playing,
    weight: 1.3,
    cooldown: 4,
    maxPerLife: 3,
    title: '食事の管理',
    body: '体づくりは、食事から。栄養士に献立を組んでもらうか、自分で気を付けるか、考えています。',
    auto: 2,
    choices: [
      { label: '栄養士の献立と、食事の記録を契約する', effects: { money: -40, fatigue: -4, conf: 1, know: 2 }, outcomes: [{ text: '毎食の写真を送り、栄養士の返事を待つ日々が始まりました。体の張りが、少し変わりました。', kind: 'good' }] },
      { label: '自炊を増やし、食べる量と時間を見直す', effects: { money: -8, fatigue: -2, know: 1 }, outcomes: [{ text: '朝食を抜かないこと、夜遅くに食べないことを、自分への決まりにしました。' }] },
      NONE('今までどおり、食べたいものを食べる', '食事は変えず、これまでの習慣のままで続けました。'),
    ],
  })
  add('rehab', {
    stages: ['univ', 'amateur', 'pro'],
    ages: [18, 42],
    when: (s) => playing(s) && (s.career.injured > 0 || (s.bb?.injuries ?? 0) > 0),
    weight: 1.6,
    cooldown: 4,
    maxPerLife: 3,
    title: 'リハビリの環境',
    body: '古い故障がまだ気になります。専門のリハビリ施設で見てもらうか、チームのトレーナーとの調整で続けるか。',
    auto: 2,
    choices: [
      { label: '専門のリハビリ施設に通う', hint: '費用はかかるが、専門の目で見てもらえる', when: (s) => rich(s, 120), effects: { money: -80, fatigue: -5, conf: 2, know: 1 }, outcomes: [{ text: '専門の施設で動きを確かめ、弱い部分を一つずつ鍛え直しました。', kind: 'good' }] },
      { label: 'チームのトレーナーと、メニューを調整する', effects: { money: -4, fatigue: -2 }, outcomes: [{ text: 'トレーナーと週ごとの負荷を細かく相談し、無理のない復帰の計画を立てました。' }] },
      NONE('痛みと付き合いながら、今のメニューで続ける', '痛みを抱えたまま、これまでのメニューで続けることにしました。'),
    ],
  })
  add('study', {
    stages: ['univ', 'amateur', 'pro'],
    ages: [18, 40],
    when: playing,
    weight: 1.3,
    cooldown: 4,
    maxPerLife: 3,
    title: '野球の学び',
    body: '動作の分析や、投打の理論を学ぶ教材やセミナーが、いくつも出回っています。自分の野球を深めたい気持ちがあります。',
    auto: 2,
    choices: [
      { label: '専門家のセミナーに参加し、仲間と議論する', effects: { money: -30, know: 3, conf: 2, rel: 1 }, outcomes: [{ text: '数字と映像を前に、他チームの選手と夜まで議論しました。自分の癖に、はっきり気づきました。', kind: 'good' }] },
      { label: '本と動画で、自分のペースで学ぶ', effects: { money: -10, know: 2, conf: 1 }, outcomes: [{ text: '消灯前の一時間を学びの時間にして、ノートを少しずつ埋めていきました。' }] },
      NONE('学ぶより、体を動かすことを優先する', '理論の勉強は後回しにして、練習の量で勝負することにしました。'),
    ],
  })
  add('prep', {
    stages: ['univ', 'amateur', 'pro'],
    ages: [22, 40],
    when: (s) => playing(s) && !hasFlag(s, 'second.coach') && !hasFlag(s, 'second.broadcast'),
    weight: 1.1,
    cooldown: 6,
    maxPerLife: 2,
    title: '野球のあとへの準備',
    body: '現役を終えたあとのことが、ふと頭をよぎるようになりました。野球の経験を生かせる道に、いまから準備を始められます。',
    auto: 2,
    choices: [
      { label: '指導者の講習を受け、少年野球の手伝いを始める', flag: 'second.coach', effects: { money: -30, know: 2, rel: 3 }, outcomes: [{ text: '休みの日に地元の少年チームを手伝い、教える側の難しさと面白さを知りました。', kind: 'good' }] },
      { label: '解説やメディアの仕事の勉強を始める', flag: 'second.broadcast', effects: { money: -20, know: 2, rel: 2 }, outcomes: [{ text: '試合を観ながら、自分の言葉で局面を説明する練習を、録音して聞き返しました。' }] },
      NONE('今は現役に集中する', '引退後のことは考えず、目の前の一年に集中することにしました。'),
    ],
  })

  return out
}

/** every spending spec of the countries that have a profile */
export const SPENDING_SPECS: EventSpec[] = Object.values(PROFILES).flatMap((p) => (p ? topics(p) : []))
export const spendingSpecsOf = (cc: CountryCode): EventSpec[] => SPENDING_SPECS.filter((s) => s.lives === cc)
