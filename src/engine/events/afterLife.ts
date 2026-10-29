import type { LifeState } from '../types.ts'
import { employed, hasFlag, type EventSpec, hasGrandkids, hasFamily, hasSibling, sameJobSince } from './spec.ts'

// After baseball, from the first job to the nineties (PROJECT_PLAN §11.13): work and money, friends from the
// team, family and parents, local life, health, and the last years. The quiet stretches of the event counts
// (after 80 above all) are what these fill. The おまかせ path is neutral (spec.ts NEUTRAL_FORBIDDEN).
// All texts are original.

const X = { extra: true } as const
const played = (s: LifeState) => s.career.highestRank >= 3
const working = (s: LifeState) => !!s.after?.work && !s.after.retired
const parentsAlive = (s: LifeState) => s.family.father !== null || s.family.mother !== null
const hasKids = (s: LifeState) => s.family.children > 0

export const AFTER_LIFE: EventSpec[] = [
  // ---------------------------------------------------------------- adult
  {
    ...X,
    id: 'x.after.venture',
    category: 'venture',
    stages: ['adult'],
    ages: [28, 55],
    when: (s) => played(s) && working(s) && !hasFlag(s, 'after.venture'),
    weight: 2,
    maxPerLife: 1,
    title: '旧友からの事業の誘い',
    body: '同じチームだった仲間から、野球用品のネット販売を一緒に始めないかと誘われました。',
    auto: 1,
    choices: [
      {
        label: '貯金の一部を出して話に乗る',
        hint: '当たれば大きいが、失う可能性もある',
        effects: { money: -60 },
        outcomes: [{ text: '休みの日に仲間と倉庫を借り、商品の仕入れと発送を始めました。', effects: { flag: 'after.venture' }, follow: [{ id: 'x.after.ventureResult', after: 2, within: 3 }] }],
      },
      { label: '出資せず、客として応援する', outcomes: [{ text: '出資は丁寧に断り、仲間の店の最初の客になることにしました。' }] },
    ],
  },
  {
    ...X,
    id: 'x.after.ventureResult',
    category: 'venture',
    stages: ['adult', 'senior'],
    followOnly: true,
    when: (s) => hasFlag(s, 'after.venture'),
    outcomes: [
      { weight: 2, text: '仲間と始めた店が軌道に乗り、出資した分以上の配当が戻ってきました。', effects: { money: 200, happy: 4 } },
      { weight: 2, text: '在庫を抱えて店は行き詰まり、出資した分は戻りませんでした。', effects: { money: -40, happy: -3 } },
    ],
  },
  {
    ...X,
    id: 'x.after.healthCheck',
    category: 'healthCheck',
    stages: ['adult'],
    ages: [40, 64],
    when: (s) => !hasFlag(s, 'after.fit'),
    weight: 3,
    cooldown: 5,
    maxPerLife: 2,
    title: '健康診断の結果',
    body: '健康診断で、血圧と血糖値に注意するように言われました。若いころの運動量とは、ずいぶん違います。',
    auto: 2,
    choices: [
      { label: '食事と運動の習慣を見直す', hint: '体は楽になるが、好きなものを控える', effects: { health: 2, happy: -1 }, outcomes: [{ text: '夕食の量を減らし、朝のウォーキングを日課にしました。', effects: { flag: 'after.fit' } }] },
      { label: '草野球に顔を出して体を動かす', effects: { health: 1, rel: 2 }, outcomes: [{ text: '昔の仲間が集まる草野球の朝に、久しぶりにグラウンドへ向かいました。' }] },
      { label: '様子を見る', outcomes: [{ text: '今のところ症状はないと、再検査の案内を机の引き出しにしまいました。' }] },
    ],
  },
  {
    ...X,
    id: 'x.after.parentCare',
    category: 'parentCare',
    stages: ['adult'],
    ages: [38, 64],
    when: (s) => parentsAlive(s) && !hasFlag(s, 'after.parentCare'),
    weight: 3,
    cooldown: 4,
    maxPerLife: 1,
    title: '親の入院',
    body: '離れて暮らす親が入院したと、病院から連絡がありました。',
    auto: 2,
    choices: [
      // (the question reads right with or without a job; the answer's line follows the job he has when he answers)
      { label: '予定を調整して付き添う', hint: '親との時間は持てるが、時間もお金もかかる', effects: { money: -20, rel: 3, sat: -2 }, outcomes: [{ text: (s) => `${working(s) ? '休暇を取り' : '毎日病院に通い'}、病室のそばで食事の介助と着替えの世話をしました。`, effects: { flag: 'after.parentCare' } }] },
      // (a brother only for a man who has one: the model keeps none but the younger brother of his boyhood story)
      { label: '週末ごとに見舞いに通う', effects: { rel: 2 }, outcomes: [{ text: (s) => (hasSibling(s) ? '弟と日を分けて、週末ごとに病院へ通うことにしました。' : '平日は病院に任せて、週末ごとに病院へ通うことにしました。') }] },
      { label: '費用だけ出して、見舞いは最低限にする', outcomes: [{ text: (s) => `${working(s) ? '仕事の都合で、' : ''}費用を援助して病院には時々顔を出すだけにしました。` }] },
    ],
  },
  {
    ...X,
    id: 'x.after.localFestival',
    category: 'localLife',
    stages: ['adult'],
    ages: [30, 64],
    when: (s) => !hasFlag(s, 'after.localLead'),
    weight: 3,
    cooldown: 4,
    maxPerLife: 1,
    title: '地域のお祭りの役員',
    body: '町内会から、秋祭りの実行委員を頼まれました。',
    auto: 1,
    choices: [
      { label: '引き受ける', hint: '地域の人との縁は深まるが、休みが減る', effects: { rel: 3, money: -5 }, outcomes: [{ text: '準備の会議と当日の運営を、二か月かけて取り仕切りました。', effects: { flag: 'after.localLead' }, follow: [{ id: 'x.after.localLeadPay', after: 2 }] }] },
      { label: '断る', outcomes: [{ text: '仕事が忙しいことを伝え、丁重に断りました。' }] },
    ],
  },
  {
    ...X,
    id: 'x.after.localLeadPay',
    category: 'localLife',
    stages: ['adult', 'senior'],
    followOnly: true,
    when: (s) => hasFlag(s, 'after.localLead'),
    outcomes: [
      { weight: 2, text: '祭りの運営ぶりが評価され、町内会の役員に推されました。', effects: { rel: 4, happy: 2 } },
      { weight: 1, text: '祭りの手伝いをきっかけに、近所の子どもたちから顔を覚えてもらえるようになりました。', effects: { rel: 3 } },
    ],
  },
  {
    ...X,
    id: 'x.after.certificate',
    category: 'learning',
    stages: ['adult'],
    ages: [28, 55],
    when: (s) => employed(s) && !hasFlag(s, 'after.cert'),
    weight: 2,
    maxPerLife: 1,
    title: '資格の勉強',
    body: '職場で、資格を持つ同僚が責任のある仕事を任されるようになってきました。',
    auto: 1,
    choices: [
      { label: '夜と休日を使って勉強する', hint: '評価につながるが、自由な時間が減る', effects: { know: 4, happy: -2, money: -10 }, outcomes: [{ text: '仕事のあとに机に向かい、半年かけて試験の範囲を一通り終えました。', effects: { flag: 'after.cert' }, follow: [{ id: 'x.after.certResult', after: 1 }] }] },
      { label: '今の仕事に集中する', outcomes: [{ text: '勉強の時間は取らず、目の前の仕事を確実にこなす道を選びました。' }] },
    ],
  },
  {
    ...X,
    id: 'x.after.certResult',
    category: 'learning',
    stages: ['adult'],
    followOnly: true,
    when: (s) => hasFlag(s, 'after.cert') && sameJobSince(s, 'after.cert'),
    outcomes: [
      { weight: 2, text: '試験に合格し、資格手当がつくとともに責任のある仕事を任されるようになりました。', effects: { level: 1, sat: 4, money: 30 } },
      { weight: 1, text: '試験には届きませんでしたが、勉強した内容は仕事に生きました。', effects: { know: 2 } },
    ],
  },
  // ---------------------------------------------------------------- old age
  {
    ...X,
    id: 'x.late.driving',
    category: 'driving',
    stages: ['senior'],
    ages: [75, 95],
    when: (s) => !hasFlag(s, 'late.licenseReturned'),
    weight: 3,
    maxPerLife: 1,
    title: '運転免許のこと',
    body: (s) => `${hasFamily(s) ? '家族' : '近所の人'}から、そろそろ運転をやめてはどうかと心配されています。`,
    auto: 1,
    choices: [
      { label: '免許を返納する', hint: '事故の心配はなくなるが、外出が減る', effects: { happy: -2, rel: 2, health: 0 }, outcomes: [{ text: (s) => `免許を返納し、買い物は${hasFamily(s) ? '家族の車とバス' : 'バスと宅配'}を使うようになりました。`, effects: { flag: 'late.licenseReturned' } }] },
      { label: '近所だけに限って運転を続ける', outcomes: [{ text: '遠出はやめて、近所の買い物だけに運転を限ることにしました。' }] },
    ],
  },
  {
    ...X,
    id: 'x.late.hospital',
    category: 'hospital',
    stages: ['senior'],
    ages: [80, 100],
    weight: 3,
    cooldown: 4,
    maxPerLife: 2,
    title: '入院のあとで',
    body: '転んで入院していましたが、退院の日が決まりました。家に戻ったあとの過ごし方を考える必要があります。',
    auto: 2,
    choices: [
      { label: 'リハビリに通って筋力を取り戻す', hint: '体は戻るが、通う負担がある', effects: { health: 2, money: -8 }, outcomes: [{ text: '週に三回、デイサービスのリハビリに通い、杖なしで歩けるようになりました。' }] },
      // (without children, a home with someone looking in on him: no relative of his is taken for granted)
      { label: '見守りのある暮らしに移る', effects: { rel: 3, happy: 1, money: -5 }, outcomes: [{ text: (s) => (hasKids(s) ? '子どもの家の一室に移り、毎日の食事を一緒に囲むようになりました。' : '見守りのある高齢者向けの住まいに移り、毎日の食事を、ほかの入居者と一緒に囲むようになりました。') }] },
      { label: '住み慣れた家で、できる範囲で暮らす', outcomes: [{ text: '退院後は住み慣れた家に戻り、ヘルパーの手を借りながら過ごしました。' }] },
    ],
  },
  {
    ...X,
    id: 'x.late.homeMove',
    category: 'housing',
    stages: ['senior'],
    ages: [80, 100],
    when: (s) => !hasFlag(s, 'late.movedNear'),
    weight: 2,
    maxPerLife: 1,
    title: '住まいの相談',
    // (without children, a home near the station and the hospital that he thinks of himself: no relative of his is taken for granted)
    body: (s) => (hasKids(s) ? '階段の上り下りがつらくなり、家族から、子どもの家の近くに移らないかと勧められました。' : '階段の上り下りがつらくなり、駅や病院に近い、段差の少ない住まいに移ることを考え始めました。'),
    auto: 1,
    choices: [
      // (near a child: where the child lives is not kept, so his place becomes one the model does not know; near the station: the same town)
      {
        label: '住まいを移す',
        hint: '安心だが、長年の近所づきあいと別れる',
        effects: { rel: 3, happy: -2, money: -30 },
        outcomes: [
          { when: hasKids, text: '長年住んだ家を手放し、子どもの家に近い小さな家へ引っ越しました。', effects: { flag: 'late.movedNear', move: 'unknown' } },
          { when: (s) => !hasKids(s), text: '長年住んだ家を手放し、駅や病院に近い、段差の少ない小さな家へ引っ越しました。', effects: { flag: 'late.movedNear' } },
        ],
      },
      { label: '住み慣れた家に残る', outcomes: [{ text: '近所の人たちに声をかけてもらいながら、住み慣れた家で暮らし続けることにしました。' }] },
    ],
  },
  {
    ...X,
    id: 'x.late.letter',
    category: 'farewell',
    stages: ['senior'],
    ages: [82, 100],
    when: (s) => !hasFlag(s, 'late.letter'),
    weight: 3,
    maxPerLife: 1,
    title: '大切な人への手紙',
    body: (s) => `最近、自分の気持ちを${hasFamily(s) ? '家族' : '世話になった人たち'}に伝えていないと気づきました。`,
    auto: 1,
    choices: [
      { label: '一人ひとりに宛てて手紙を書く', hint: '時間はかかるが、思いが残る', effects: { happy: 3, rel: 3 }, outcomes: [{ text: (s) => `${hasGrandkids(s) ? '子どもと孫' : hasKids(s) ? '子どもたち' : hasFamily(s) ? '家族や友人' : '友人や世話になった人たち'}のそれぞれに宛てて、便せんに一文字ずつ書き進めました。`, effects: { flag: 'late.letter' }, follow: [{ id: 'x.late.letterEcho', after: 1, within: 3 }] }] },
      { label: '食卓で顔を見て話す', outcomes: [{ text: (s) => (hasFamily(s) ? '手紙は書かず、次に家族が集まった食卓で、感謝の言葉を伝えました。' : '手紙は書かず、次に友人と食卓を囲んだときに、感謝の言葉を伝えました。') }] },
    ],
  },
  {
    ...X,
    id: 'x.late.letterEcho',
    category: 'farewell',
    stages: ['senior'],
    followOnly: true,
    when: (s) => hasFlag(s, 'late.letter'),
    outcomes: [
      { when: hasGrandkids, weight: 2, text: '孫から、宛てた手紙を学校の机に入れていると、うれしそうな返事が届きました。', effects: { happy: 4, rel: 2 } },
      { weight: 1, text: (s) => `${hasKids(s) ? '子ども' : '友人'}から電話があり、手紙を読んで少し泣いたと照れくさそうに話しました。`, effects: { happy: 3 } },
    ],
  },
  {
    ...X,
    id: 'x.late.celebration',
    category: 'longLife',
    stages: ['senior'],
    ages: [88, 105],
    weight: 5,
    cooldown: 5,
    maxPerLife: 2,
    title: '長寿のお祝い',
    body: (s) => `${hasFamily(s) ? '家族' : '近所の人たち'}が、長寿のお祝いの会を開きたいと言ってくれています。`,
    auto: 1,
    choices: [
      // (relatives only for a man with a family of his own)
      { label: '親しい人を大勢呼んで、盛大に祝う', hint: '大勢と会えるが、体には負担がかかる', effects: { happy: 4, rel: 3, money: -10, health: -1 }, outcomes: [{ text: (s) => (hasFamily(s) ? '親戚と遠くの旧友が集まり、写真を囲みながら昔話に花が咲きました。' : '遠くの旧友や近所の人が集まり、写真を囲みながら昔話に花が咲きました。') }] },
      { label: '身近な人だけで、ささやかに祝う', outcomes: [{ text: (s) => `${hasFamily(s) ? '家族だけで' : '身近な人たちと'}食卓を囲み、ケーキのろうそくを${hasGrandkids(s) ? '孫と一緒に' : ''}吹き消しました。` }] },
    ],
  },
]
