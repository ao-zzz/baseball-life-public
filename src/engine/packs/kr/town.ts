import { definePack } from '../kit.ts'

// Everyday Korea (a pack of the Korean lives, by the country of birth): the second team's bus driver, a dish that made a name in the
// military service and comes back at a comrade's wedding, a neighbour child in the lift, a taxi ride. Lines and the pack's own flags
// only (impact 'log'): no money, ability, health or career changes. The service is the model's (countries/league/year.ts, flag
// kr.mil), read, never changed. The people are made up; all texts are original. Chances a year: daily lines 0.1, a start of a later
// story 0.25, its continuation 0.2, baseball 0.5.

export const KR_TOWN = definePack({
  id: 'krTown',
  countries: ['KR'],
  impact: 'log',
  events: (k) => [
    k.log({
      id: 'busDriver',
      category: 'busDriver',
      stages: ['pro'],
      when: (s) => s.career.phase === 'proMinor',
      chance: 0.5,
      kind: 'good',
      text: '2軍の遠征バスの運転手さんが、30年前の名選手だと知りました。サインを頼むと、照れながら昔の背番号を書いてくれました。',
    }),
    k.log({
      id: 'eggRoll',
      category: 'egg',
      stages: ['pro'],
      // (the two years of the service: from the age in kr.mil)
      when: (s) => s.flags?.['kr.mil'] !== undefined && s.age - s.flags['kr.mil'] <= 1,
      chance: 0.5,
      flag: 'egg',
      text: '兵役中、炊事の当番で作った卵焼きが部隊で評判になり、「あの選手の卵焼き」と呼ばれるようになりました。',
    }),
    k.later(
      { flag: 'egg', years: [12, 25] },
      k.log({
        id: 'eggWedding',
        category: 'egg',
        stages: ['pro', 'adult', 'senior'],
        chance: 0.2,
        kind: 'good',
        text: '同じ部隊にいた人の結婚式に招かれました。新郎のスピーチに、なぜかあの卵焼きの話が出てきました。',
      }),
    ),
    k.log({
      id: 'elevator',
      category: 'elevator',
      stages: ['adult', 'senior'],
      ages: [50, 80],
      chance: 0.1,
      kind: 'good',
      text: 'エレベーターで毎朝会う小学生に、3年間「今日の天気」を聞かれ続けました。卒業の日、その子から手紙をもらいました。',
    }),
    k.happen({
      id: 'taxi',
      category: 'taxi',
      stages: ['adult', 'senior'],
      ages: [30, 70],
      chance: 0.1,
      outcomes: [
        {
          when: (s) => s.career.highestRank >= 6,
          kind: 'good',
          flag: 'taxiPro',
          text: 'タクシーの運転手に、昔のある試合の話を延々と聞かされました。自分がその試合に出ていたとは、最後まで言い出せませんでした。',
        },
        {
          when: (s) => s.career.highestRank < 6,
          flag: 'taxi',
          text: 'タクシーの運転手と野球の話で盛り上がるうちに、道を一本間違えられました。メーターは途中で止めてくれました。',
        },
      ],
    }),
  ],
})
