import type { LifeState } from '../types.ts'
import { hasFlag, type EventSpec, youngKin, hasFamily } from './spec.ts'

// Old age (PROJECT_PLAN §11.12): from the mid-seventies to the nineties and beyond — old teammates, the
// notebook, the park, the stands, a rival's card, a grandchild. The おまかせ path is neutral (spec.ts);
// the other choices change happiness, relations, health a little and money, with follow-ups.
// All texts are original.

const X = { extra: true } as const
const played = (s: LifeState) => s.career.highestRank >= 3

export const LATE_LIFE: EventSpec[] = [
  {
    ...X,
    id: 'x.late.reunion',
    category: 'oldFriends',
    stages: ['senior'],
    ages: [75, 100],
    when: played,
    weight: 3,
    cooldown: 5,
    maxPerLife: 2,
    title: '昔のチームメートからの便り',
    body: '同期の一人から、仲間うちの集まりへの誘いの手紙が届きました。',
    auto: 1,
    choices: [
      {
        label: '遠くても会いに行く',
        hint: '気持ちは弾むが、体に響くこともある',
        effects: { happy: 4, money: -5, health: -1 },
        outcomes: [{ text: '電車を乗り継いで集まりに顔を出し、夜どおし昔話をしました。', effects: { flag: 'late.reunion' }, follow: [{ id: 'x.late.reunionEcho', after: 1 }] }],
      },
      { label: '返事だけ出して欠席する', outcomes: [{ text: '体を気づかって欠席し、近況を書いた返事だけを出しました。' }] },
    ],
  },
  {
    ...X,
    id: 'x.late.reunionEcho',
    category: 'oldFriends',
    stages: ['senior'],
    followOnly: true,
    when: (s) => hasFlag(s, 'late.reunion'),
    outcomes: [
      { weight: 3, text: '集まりで撮った写真が届き、玄関の棚に飾りました。', effects: { happy: 3 } },
      { weight: 1, text: '集まりの翌月、仲間の一人の訃報が届きました。会えてよかったと思いました。', effects: { happy: -2, rel: 2 } },
    ],
  },
  {
    ...X,
    id: 'x.late.memoir',
    category: 'memory',
    stages: ['senior'],
    ages: [75, 100],
    when: (s) => played(s) && !hasFlag(s, 'late.memoir'),
    weight: 3,
    maxPerLife: 1,
    title: '自分史を書く？',
    body: (s) => `${youngKin(s)}に「野球をしていたころの話を聞きたい」と頼まれました。`,
    auto: 1,
    choices: [
      { label: 'ノートに少しずつ書き残す', hint: '時間はかかるが、形に残る', effects: { happy: 3 }, outcomes: [{ text: '毎朝一ページずつ、ノートに昔の試合のことを書き始めました。', effects: { flag: 'late.memoir' }, follow: [{ id: 'x.late.memoirDone', after: 2, within: 3 }] }] },
      { label: '口で話して聞かせる', outcomes: [{ text: 'ノートは書かず、縁側で何度か昔話を聞かせました。' }] },
    ],
  },
  {
    ...X,
    id: 'x.late.memoirDone',
    category: 'memory',
    stages: ['senior'],
    followOnly: true,
    when: (s) => hasFlag(s, 'late.memoir'),
    outcomes: [{ text: (s) => `書き上げたノートを、${hasFamily(s) ? '家族' : '昔の仲間'}が小さな冊子にまとめてくれました。`, effects: { happy: 5, rel: 3 } }],
  },
  {
    ...X,
    id: 'x.late.walkers',
    category: 'neighbors',
    stages: ['senior'],
    ages: [75, 100],
    when: (s) => !hasFlag(s, 'late.walkers'),
    weight: 3,
    maxPerLife: 1,
    title: '散歩仲間',
    body: '朝の公園で顔を合わせる人たちが、毎日一緒に歩かないかと誘ってくれました。',
    auto: 1,
    choices: [
      { label: '仲間に入る', hint: '体を動かし、話し相手もできる', effects: { rel: 3, happy: 3, health: 1 }, outcomes: [{ text: '毎朝七時に公園に集まり、ゆっくり二周するのが日課になりました。', effects: { flag: 'late.walkers' } }] },
      { label: '断って家で過ごす', outcomes: [{ text: '誘いはありがたく断り、朝は家で新聞を読んで過ごしました。' }] },
    ],
  },
  {
    ...X,
    id: 'x.late.ballpark',
    category: 'fans',
    stages: ['senior'],
    ages: [75, 100],
    when: played,
    weight: 2,
    cooldown: 4,
    maxPerLife: 2,
    title: '球場へ行く',
    body: '近くの球場で、高校野球の地方大会が開かれると聞きました。',
    auto: 1,
    choices: [
      {
        label: '一人でスタンドへ見に行く',
        hint: '懐かしさがこみ上げるが、暑さが体にこたえる',
        effects: { happy: 4, money: -3 },
        outcomes: [
          { weight: 2, text: '三塁側のスタンドで、昔の自分と同じ背番号の選手を目で追いました。' },
          { weight: 1, text: '暑さにやられて、二回で帰ることになりました。', effects: { health: -2 } },
        ],
      },
      { label: '家のテレビで見る', outcomes: [{ text: '冷たい麦茶を片手に、テレビで試合を最後まで見ました。' }] },
    ],
  },
  {
    ...X,
    id: 'x.late.rivalCard',
    category: 'oldFriends',
    stages: ['senior'],
    ages: [70, 100],
    when: (s) => !!s.evHist?.['hs.rival'] && !hasFlag(s, 'late.rival'),
    weight: 4,
    maxPerLife: 1,
    title: '昔のライバルから',
    body: '高校のとき同じポジションを争った相手の名前で、年賀状が届きました。',
    auto: 1,
    choices: [
      { label: '返事を書く', hint: '縁が戻るかもしれない', effects: { happy: 2 }, outcomes: [{ text: '「あのときはお互い必死だったな」と書いて、返事を出しました。', effects: { flag: 'late.rival' }, follow: [{ id: 'x.late.rivalCall', after: 1 }] }] },
      { label: '返さずにしまっておく', outcomes: [{ text: '返事は書かず、年賀状を引き出しの奥にしまいました。' }] },
    ],
  },
  {
    ...X,
    id: 'x.late.rivalCall',
    category: 'oldFriends',
    stages: ['senior'],
    followOnly: true,
    when: (s) => hasFlag(s, 'late.rival'),
    outcomes: [
      { weight: 2, text: '年明けに電話があり、二時間も当時の試合の話をしました。', effects: { happy: 4, rel: 3 } },
      { weight: 1, text: '電話口の相手は、すっかり耳が遠くなっていました。それでも笑い合いました。', effects: { happy: 2 } },
    ],
  },
  {
    ...X,
    id: 'x.late.grandCatch',
    category: 'family',
    stages: ['senior'],
    ages: [70, 95],
    when: (s) => s.career.achievements.includes('孫'),
    weight: 3,
    cooldown: 3,
    maxPerLife: 2,
    title: '孫とキャッチボール',
    body: '孫が、庭でキャッチボールをしてほしいとグローブを持ってきました。',
    auto: 1,
    choices: [
      {
        label: 'グローブを出して相手をする',
        hint: '喜んでもらえるが、肩と腰に負担がかかる',
        effects: { happy: 5, rel: 3 },
        outcomes: [
          { weight: 3, text: '山なりのボールでも、孫は「じいじ、すごい」と笑いました。' },
          { weight: 1, text: '張り切りすぎて肩を痛め、数日は腕が上がりませんでした。', effects: { health: -2 } },
        ],
      },
      { label: '縁側で見守る', outcomes: [{ text: '縁側に座り、孫がひとりで壁に投げる音を聞いていました。' }] },
    ],
  },
]
