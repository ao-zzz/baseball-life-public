import { residenceOf } from '../../countries/index.ts'
import { definePack } from '../kit.ts'

// Everyday Cuba (a pack of the Cuban lives, by the country of birth): a rookie's name on the radio, a chess player in the park, a video
// call with home after going abroad, a chalk target on a neighbour's wall that someone else's child aims at years later. Lines and the
// pack's own flags only (impact 'log'): no money, ability, health or career changes. Going abroad is the model's (flag cu.mlb), read,
// never changed, and told as a family's tie, never as a joke. The people are made up; all texts are original. Chances a year: daily
// lines 0.1, a start of a later story 0.25, its continuation 0.2, baseball 0.5 (the rookie's radio 0.6, in his first two seasons).

const parentAlive = (s: { family: { father: number | null; mother: number | null } }) => s.family.father !== null || s.family.mother !== null

export const CU_TOWN = definePack({
  id: 'cuTown',
  countries: ['CU'],
  impact: 'log',
  events: (k) => [
    k.log({
      id: 'radioName',
      category: 'radioName',
      stages: ['pro'],
      // (the national series at home, in his first two seasons: proSeasons counts them)
      when: (s) => s.career.phase === 'pro' && s.flags?.['cu.mlb'] === undefined && s.career.proSeasons <= 2,
      chance: 0.6,
      kind: 'good',
      text: '国内リーグの新人のころ、ラジオの実況が名字を三通りに間違えて読みました。その三つとも、近所であだ名になりました。',
    }),
    k.log({
      id: 'chess',
      category: 'chess',
      stages: ['adult', 'senior'],
      ages: [55, 85],
      when: (s) => residenceOf(s) === 'CU',
      chance: 0.1,
      text: '公園のチェス盤で、80歳の人に3連敗しました。帰り際、「次は守備位置を考えてから来なさい」と言われました。',
    }),
    k.log({
      id: 'videoCall',
      category: 'videoCall',
      stages: ['pro', 'adult'],
      ages: [19, 50],
      when: (s) => s.flags?.['cu.mlb'] !== undefined && parentAlive(s),
      chance: 0.5,
      kind: 'good',
      text: '海の向こうの母と、ビデオ通話で同じ試合を見ました。回線が遅れて、母の歓声は自分の打席の5秒あとに届きました。',
    }),
    k.log({
      id: 'wall',
      category: 'wall',
      stages: ['youth', 'jhs', 'hs', 'student'],
      ages: [8, 14],
      when: (s) => residenceOf(s) === 'CU',
      chance: 0.25,
      flag: 'wall',
      text: '近所の壁にチョークで的を描き、毎日ボールを当てていました。壁の持ち主は、何も言わずに見ていました。',
    }),
    k.later(
      { flag: 'wall', years: [20, 40] },
      k.happen({
        id: 'wallLater',
        category: 'wall',
        stages: ['adult', 'senior'],
        chance: 0.2,
        outcomes: [
          {
            when: (s) => residenceOf(s) === 'CU',
            kind: 'good',
            flag: 'wallSeen',
            text: 'あの近所の壁の前で、知らない子どもがチョークの的にボールを当てていました。線の引き方まで、そっくりでした。',
          },
          {
            when: (s) => residenceOf(s) !== 'CU',
            kind: 'good',
            flag: 'wallPhoto',
            text: 'いとこから届いた写真に、あの近所の壁が写っていました。知らない子どもが、同じ場所に的を描いていました。',
          },
        ],
      }),
    ),
  ],
})
