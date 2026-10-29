import type { LifeState } from '../types.ts'
import { hasFlag, type EventSpec } from './spec.ts'

// What comes of a choice, a year or two on (PROJECT_PLAN §11.15): follow-ups that read the facts set by the choices of
// the school, company, independent and pro years, the choices of the team room, the exam and the friend. Only a choice
// that is not the おまかせ one books them, so the おまかせ lives are untouched (spec.ts NEUTRAL_FORBIDDEN). All texts
// are original; no team name appears in them.

const X = { extra: true, career: true, followOnly: true } as const
const has = (f: string) => (s: LifeState) => hasFlag(s, f)
const playing = (s: LifeState) => !!s.bb

export const FOLLOW_LIFE: EventSpec[] = [
  // ---------------------------------------------------------------- high school and university
  {
    ...X,
    id: 'x.hs.teamMealBack',
    category: 'teamRoom',
    stages: ['hs'],
    when: (s) => playing(s) && (hasFlag(s, 'hs.mealTalk') || hasFlag(s, 'hs.meetingTalk')),
    outcomes: [
      { when: has('hs.mealTalk'), weight: 2, text: 'あの食事会のあと、先輩と後輩の距離が縮まり、練習中の声がよく通るようになりました。', effects: { rel: 4, conf: 3 } },
      { when: has('hs.mealTalk'), weight: 1, text: '食事会で話した内容が尾ひれをつけて広まり、気まずい空気が残ってしまいました。', effects: { rel: -2, conf: -2 } },
      { when: has('hs.meetingTalk'), weight: 2, text: 'ミーティングで決めた約束事が定着し、監督から「チームが締まってきた」と言われました。', effects: { eval: 3, conf: 2 } },
      { when: has('hs.meetingTalk'), weight: 1, text: '約束事をめぐって意見が割れ、数人とぎくしゃくしました。', effects: { rel: -3, eval: 1 } },
    ],
  },
  {
    ...X,
    id: 'x.hs.winterBodyBack',
    category: 'bodyBuild',
    stages: ['hs'],
    when: (s) => playing(s) && (hasFlag(s, 'hs.bulkUp') || hasFlag(s, 'hs.stayLight')),
    outcomes: [
      { when: has('hs.bulkUp'), weight: 2, text: '冬の食事と筋力トレーニングが実り、春には打球の飛び方が変わりました。', effects: { gain: 0.03, skill: { power: 0.12, velocity: 0.08 }, conf: 3 } },
      { when: has('hs.bulkUp'), weight: 1, text: '体は大きくなりましたが、動きが重くなり、走塁で遅れが目立ちました。', effects: { skill: { speed: -0.1 }, conf: -2 } },
      { when: has('hs.stayLight'), weight: 2, text: '走り込みと柔軟を続けた体は軽く、守備範囲が一歩広がりました。', effects: { gain: 0.02, skill: { speed: 0.1, fielding: 0.08 }, conf: 2 } },
      { when: has('hs.stayLight'), weight: 1, text: '体を軽く保つあまり、打球に力が伝わらなくなったと指摘されました。', effects: { skill: { power: -0.08 }, conf: -1 } },
    ],
  },
  {
    ...X,
    id: 'x.univ.raceBack',
    category: 'positionRace',
    stages: ['univ'],
    when: (s) => playing(s) && (hasFlag(s, 'univ.raceGrind') || hasFlag(s, 'univ.raceAsk')),
    outcomes: [
      { when: has('univ.raceGrind'), weight: 2, text: '練習量で積み上げた一年が評価され、リーグ戦のベンチ入りメンバーに名前が載りました。', effects: { eval: 4, conf: 4 } },
      { when: has('univ.raceGrind'), weight: 1, text: '練習で追い込みすぎて膝に違和感が出て、春のリーグ戦を見送ることになりました。', effects: { injury: 1, conf: -3 } },
      { when: has('univ.raceAsk'), weight: 2, text: '教わったコツを自分の形に落とし込むうち、守備の無駄な動きが減りました。', effects: { skill: { fielding: 0.12 }, rel: 2, eval: 2 } },
      { when: has('univ.raceAsk'), weight: 1, text: '教わった通りにやろうとして、自分の感覚を見失う時期が続きました。', effects: { conf: -2 } },
    ],
  },
  {
    ...X,
    id: 'x.univ.captainBack',
    category: 'teamLead',
    stages: ['univ'],
    when: (s) => playing(s) && (hasFlag(s, 'univ.capCaptain') || hasFlag(s, 'univ.capVice')),
    outcomes: [
      { when: has('univ.capCaptain'), weight: 2, text: '主将として一年を走り抜けました。下級生が「この人についていく」と言ってくれた夜を、忘れません。', effects: { rel: 5, happy: 4, conf: 3 } },
      { when: has('univ.capCaptain'), weight: 1, text: '部の運営に追われ、自分の練習の時間が削られました。チームはまとまりましたが、打撃は戻りません。', effects: { rel: 3, conf: -3, fatigue: 8 } },
      { when: has('univ.capVice'), weight: 2, text: '主将を陰で支える役割が合っていました。部員の相談がいつも自分のところに集まりました。', effects: { rel: 4, eval: 2 } },
      { when: has('univ.capVice'), weight: 1, text: '主将と意見がぶつかる場面が増えましたが、話し合って、最後は笑って握手しました。', effects: { rel: 2, happy: 2 } },
    ],
  },
  // ---------------------------------------------------------------- company, independent, pro
  {
    ...X,
    id: 'x.co.fightBack',
    category: 'roleFight',
    stages: ['amateur'],
    when: (s) => playing(s) && (hasFlag(s, 'co.fought') || hasFlag(s, 'co.learned')),
    outcomes: [
      { when: has('co.fought'), weight: (s) => 1.4 + Math.max(0, s.z * 0.5), text: '補強選手との争いに競り勝ち、予選のスタメンの座を守りました。', effects: { eval: 4, conf: 5 } },
      { when: has('co.fought'), weight: 1, text: '一歩及ばず、予選は控えに回りました。ベンチで声を出し続けるしかありませんでした。', effects: { conf: -3, eval: 1 } },
      { when: has('co.learned'), weight: 2, text: '補強選手から盗んだ配球の読みが、次の大会の打席で生きました。', effects: { skill: { contact: 0.12 }, conf: 3 } },
      { when: has('co.learned'), weight: 1, text: '真似ようとしたことが自分の形を崩し、しばらく調子を落としました。', effects: { conf: -3 } },
    ],
  },
  {
    ...X,
    id: 'x.co.studyBack',
    category: 'tournament',
    stages: ['amateur'],
    when: (s) => playing(s) && hasFlag(s, 'co.analyst'),
    outcomes: [
      { weight: 2, text: '映像で相手を研究する習慣が、チームの中で重宝されるようになりました。コーチから、分析の手伝いを頼まれました。', effects: { eval: 4, rel: 2 } },
      { weight: 1, text: '研究に時間を使いすぎて、肝心の練習が疎かになる時期がありました。', effects: { fatigue: 6, conf: -1 } },
    ],
  },
  {
    ...X,
    id: 'x.in.negotiateBack',
    category: 'contract',
    stages: ['amateur'],
    when: (s) => playing(s) && (hasFlag(s, 'in.negotiated') || hasFlag(s, 'in.sideWork')),
    outcomes: [
      { when: has('in.negotiated'), weight: 1, text: '一年前の交渉が球団の記憶に残っていて、今季の更改では先に増額の提案がありました。', effects: { money: 40, conf: 3 } },
      { when: has('in.negotiated'), weight: 1, text: '交渉の印象が悪かったのか、今季の更改では、淡々と据え置きの条件を示されました。', effects: { conf: -2 } },
      { when: has('in.sideWork'), weight: 2, text: '冬のアルバイト先の社員に気に入られ、シーズン後の働き口の話を聞かせてもらいました。', effects: { money: 20, rel: 3 } },
      { when: has('in.sideWork'), weight: 1, text: '冬の仕事で体を酷使し、春のキャンプの出遅れにつながりました。', effects: { fatigue: 10, conf: -2 } },
    ],
  },
  {
    ...X,
    id: 'x.pro.campBack',
    category: 'campGoal',
    stages: ['pro'],
    when: (s) => playing(s) && (hasFlag(s, 'pro.campForm') || hasFlag(s, 'pro.campBody') || hasFlag(s, 'pro.campApp')),
    outcomes: [
      { when: has('pro.campForm'), weight: 2, text: '改造したフォームが一年かけて体になじみ、球の質がはっきり変わりました。', effects: { gain: 0.04, conf: 5, skill: { control: 0.1 } } },
      { when: has('pro.campForm'), weight: 1, text: 'フォームの改造は実らず、元の形に戻すのに半年を費やしました。', effects: { conf: -4, gain: -0.02 } },
      { when: has('pro.campBody'), weight: 2, text: '体づくりを優先した一年で、故障が減り、シーズンを通して試合に出られました。', effects: { gain: 0.03, conf: 3, fatigue: -6 } },
      { when: has('pro.campBody'), weight: 1, text: '体は仕上がりましたが、技術の練習不足を首脳陣に指摘されました。', effects: { eval: -2, conf: -1 } },
      { when: has('pro.campApp'), weight: 2, text: 'キャンプでのアピールが首脳陣の目に留まり、開幕を1軍帯同で迎えました。', effects: { eval: 5, conf: 4 } },
      { when: has('pro.campApp'), weight: 1, text: '力みすぎたアピールが空回りして、評価はむしろ下がりました。', effects: { eval: -3, conf: -3 } },
    ],
  },
  {
    ...X,
    id: 'x.pro.callUpBack',
    category: 'firstTeam',
    stages: ['pro'],
    when: (s) => playing(s) && (hasFlag(s, 'pro.sellSelf') || hasFlag(s, 'pro.farmNumbers')),
    outcomes: [
      { when: has('pro.sellSelf'), weight: 2, text: '持ち味を直接伝えたことで、起用法が自分に合う形に変わりました。', effects: { eval: 4, conf: 3 } },
      { when: has('pro.sellSelf'), weight: 1, text: '主張が強すぎたと受け取られ、しばらく起用の機会が減りました。', effects: { eval: -3 } },
      { when: has('pro.farmNumbers'), weight: 2, text: '2軍で積み上げた数字が評価され、次の入れ替えで名前が挙がりました。', effects: { eval: 4, conf: 4 } },
      { when: has('pro.farmNumbers'), weight: 1, text: '数字は残しても、上の枠は空きませんでした。気持ちの置きどころに悩みました。', effects: { conf: -2, happy: -2 } },
    ],
  },
  {
    ...X,
    id: 'x.pro.rehabBack',
    category: 'rehab',
    stages: ['pro'],
    when: (s) => playing(s) && (hasFlag(s, 'pro.rehabFast') || hasFlag(s, 'pro.rehabPlan')),
    outcomes: [
      { when: has('pro.rehabFast'), weight: 1, text: '予定より早く戻った体は、開幕に間に合いました。ただ、完全には戻っていません。', effects: { conf: 3, fatigue: 8 } },
      { when: has('pro.rehabFast'), weight: 1, text: '焦って早めた復帰で、同じ箇所を再び痛めてしまいました。', effects: { injury: 1, health: -2, conf: -5 } },
      { when: has('pro.rehabPlan'), weight: 3, text: 'トレーナーの計画どおりに戻した体は、前よりもバランスよく動きました。', effects: { gain: 0.03, conf: 3 } },
    ],
  },
  {
    ...X,
    id: 'x.pro.tradeBack',
    category: 'trade',
    stages: ['pro'],
    when: (s) => playing(s) && hasFlag(s, 'pro.tradeMoved'),
    outcomes: [
      { weight: 2, text: '新しい球団の起用法が合い、出場機会が増えました。移ってよかったと思える一年になりました。', effects: { eval: 4, conf: 4, happy: 3 } },
      { weight: 1, text: '新しい環境になじめず、同じ時期に移った選手と食事に行くことが増えました。', effects: { rel: 2, conf: -2 } },
    ],
  },
  {
    ...X,
    id: 'x.team.depthBack',
    category: 'teamDepth',
    stages: ['hs', 'univ', 'amateur'],
    when: (s) => playing(s) && (hasFlag(s, 'team.early') || hasFlag(s, 'team.roleOnly') || hasFlag(s, 'team.lead') || hasFlag(s, 'team.solo')),
    outcomes: [
      { when: has('team.early'), weight: 2, text: '朝練の習慣が実り、いつのまにかコーチが最初に声をかける選手になりました。', effects: { eval: 4, conf: 3 } },
      { when: has('team.roleOnly'), weight: 2, text: '一つの役割を磨いた成果で、大事な試合の終盤に必ず名前を呼ばれるようになりました。', effects: { eval: 3, conf: 4 } },
      { when: has('team.lead'), weight: 2, text: '練習の中心になったことで、チームの練習が締まり、周りから頼られるようになりました。', effects: { rel: 4, conf: 3 } },
      { when: has('team.solo'), weight: 2, text: '自分のメニューに専念した成果が数字に表れましたが、チーム内では少し浮き始めています。', effects: { gain: 0.02, rel: -2 } },
    ],
  },
  // ---------------------------------------------------------------- school, friends, travel, sleep, gear
  {
    ...X,
    id: 'x.study.examBack',
    category: 'studyLife',
    stages: ['jhs', 'hs', 'student', 'univ', 'adult'],
    when: (s) => hasFlag(s, 'study.focus') || hasFlag(s, 'study.both'),
    outcomes: [
      { when: has('study.focus'), weight: 2, text: '勉強に集中した学期の成績が上がり、担任から推薦の話が出ました。', effects: { know: 3, rel: 1, flag: 'hs.hyoutei' } },
      { when: has('study.focus'), weight: 1, text: '点数は伸びましたが、練習を離れたぶん、体が重くなったと感じています。', effects: { know: 2, fatigue: 4 } },
      { when: has('study.both'), weight: 1, text: '睡眠を削った生活が続き、風邪をこじらせて数日寝込みました。', effects: { health: -2, fatigue: 8 } },
      { when: has('study.both'), weight: 1, text: '両方をやり切った経験が自信になり、時間の使い方がうまくなりました。', effects: { know: 2, conf: 3 } },
    ],
  },
  {
    ...X,
    id: 'x.friend.troubleBack',
    category: 'friendship',
    stages: ['jhs', 'hs', 'student', 'univ', 'adult'],
    when: (s) => hasFlag(s, 'friend.apologized') || hasFlag(s, 'friend.distance'),
    outcomes: [
      { when: has('friend.apologized'), weight: 2, text: '仲直りした友人は、その後も何かと味方になってくれました。', effects: { rel: 4, happy: 3 } },
      { when: has('friend.apologized'), weight: 1, text: '仲直りはしましたが、互いに遠慮して、昔のようには話せませんでした。', effects: { rel: 1 } },
      { when: has('friend.distance'), weight: 1, text: '距離を置いたまま、いつのまにか連絡が途絶えました。ふと、寂しくなる夜があります。', effects: { rel: -2, happy: -2 } },
      { when: has('friend.distance'), weight: 1, text: '時間を置いたことで、相手のほうから「あのときはごめん」と連絡がありました。', effects: { rel: 3, happy: 3 } },
    ],
  },
  {
    ...X,
    id: 'x.trip.campBack',
    category: 'trip',
    stages: ['hs', 'univ'],
    when: (s) => playing(s) && (hasFlag(s, 'camp.grit') || hasFlag(s, 'camp.adjust')),
    outcomes: [
      { when: has('camp.grit'), weight: 2, text: '夏合宿をやり切った仲間とは、いまも「あの合宿の話」で笑い合える仲です。', effects: { rel: 4, conf: 3 } },
      { when: has('camp.grit'), weight: 1, text: '合宿の疲れが秋まで残り、秋の大会で調子が上がりませんでした。', effects: { fatigue: 8, conf: -2 } },
      { when: has('camp.adjust'), weight: 2, text: '体の声を聞いて調整したことで、秋の大会までコンディションを保てました。', effects: { conf: 3, fatigue: -6 } },
    ],
  },
  {
    ...X,
    id: 'x.health.sleepBack',
    category: 'bodyCare',
    stages: ['jhs', 'hs', 'univ', 'amateur', 'pro'],
    when: (s) => playing(s) && (hasFlag(s, 'sleep.routine') || hasFlag(s, 'sleep.gadget')),
    outcomes: [
      { when: has('sleep.routine'), weight: 2, text: '規則正しい生活が身につき、朝の体の切れが違うと言われるようになりました。', effects: { fatigue: -10, conf: 3 } },
      { when: has('sleep.gadget'), weight: 1, text: '買った寝具が体に合い、朝まで目が覚めなくなりました。', effects: { fatigue: -8, conf: 2 } },
      { when: has('sleep.gadget'), weight: 1, text: '道具に頼っても生活は変わらず、結局、夜更かしは直りませんでした。', effects: { fatigue: 3 } },
    ],
  },
  {
    ...X,
    id: 'x.gear.spikesBack',
    category: 'gear',
    stages: ['hs', 'univ', 'amateur'],
    when: (s) => playing(s) && hasFlag(s, 'gear.premium'),
    outcomes: [
      { weight: 2, text: '選んだ一足を履いた日は、一歩目の踏み出しが軽く、盗塁のスタートも切れました。', effects: { skill: { speed: 0.1 }, conf: 3 } },
      { weight: 1, text: '高価な一足は見た目ほど長持ちせず、半年で底が割れました。', effects: { money: -5 } },
    ],
  },
  {
    ...X,
    id: 'x.trip.awayBack',
    category: 'trip',
    stages: ['jhs', 'hs', 'univ', 'amateur'],
    when: (s) => playing(s) && (hasFlag(s, 'trip.meeting') || hasFlag(s, 'trip.walk')),
    outcomes: [
      { when: has('trip.meeting'), weight: 2, text: '遠征の夜に決めた守備位置とサインが、翌日の接戦で見事にはまりました。', effects: { eval: 3, rel: 2, conf: 3 } },
      { when: has('trip.walk'), weight: 2, text: '遠征先の町で仲間と歩いた夜は、いまでも話題に上ります。', effects: { rel: 4, happy: 3 } },
      { when: has('trip.walk'), weight: 1, text: '遠征先で夜更かしした翌朝、体が重く、試合の入りで出遅れました。', effects: { fatigue: 6, conf: -2 } },
    ],
  },
]
