import { definePack } from '../kit.ts'

// Small-town America (a pack of the US lives, by the country of birth): a day at a minor-league park, a quiz night, a glove bought at a
// garage sale that comes back decades later, and a name for the youth team. Lines and the pack's own flags only (impact 'log'): no
// money, ability, health or career changes. The people and places are made up; all texts are original. Each event has a chance a
// year of its own (packs/kit.ts `chance`): daily lines 0.1, a start of a later story 0.25, its continuation 0.2, baseball 0.5.

export const US_TOWN = definePack({
  id: 'usTown',
  countries: ['US'],
  impact: 'log',
  events: (k) => [
    k.log({
      id: 'dogDay',
      category: 'dogDay',
      stages: ['pro'],
      when: (s) => s.career.phase === 'proMinor',
      chance: 0.5,
      kind: 'good',
      text: 'マイナーの球場で「犬と観戦する日」が開かれました。ファウルボールを追って三匹が外野に駆け込み、試合が3分止まりました。',
    }),
    k.log({
      id: 'quiz',
      category: 'quiz',
      stages: ['adult', 'senior'],
      ages: [35, 70],
      chance: 0.1,
      text: '近所の店のクイズ大会で、野球の問題だけ全問正解しました。ほかは全部はずれて、チームは最下位でした。',
    }),
    k.log({
      id: 'glove',
      category: 'glove',
      stages: ['youth', 'jhs', 'hs', 'student'],
      ages: [10, 15],
      chance: 0.25,
      flag: 'glove',
      text: 'ガレージセールで、1ドルの古いグラブを買いました。内側に、知らない少年の名前が刺繍してありました。',
    }),
    k.later(
      { flag: 'glove', years: [30, 55] },
      k.log({
        id: 'gloveOwner',
        category: 'glove',
        stages: ['adult', 'senior'],
        chance: 0.2,
        kind: 'good',
        key: true,
        text: '少年野球にあの古いグラブを持っていくと、見物の老人が黙り込みました。60年前に手放した、自分のグラブでした。',
      }),
    ),
    k.choice({
      id: 'teamName',
      category: 'teamName',
      stages: ['adult', 'senior'],
      ages: [28, 50],
      chance: 0.1,
      title: 'チーム名の募集',
      body: '近所の少年野球チームが、新しいチーム名の案を募っています。紙に一つ書いて、箱に入れるだけです。',
      auto: 0,
      choices: [
        { label: 'まじめな名前を書く', outcomes: [{ text: '考え抜いた名前は2票でした。選ばれたのは、隣の家の子の案でした。', flag: 'nameSerious' }] },
        {
          label: 'ふざけた名前を書く',
          outcomes: [
            { text: '冗談で書いた「火曜日のアライグマズ」が選ばれ、そのままユニフォームに刺繍されました。', kind: 'good', flag: 'nameWon' },
            { text: '冗談の名前は読み上げられ、会場は笑いましたが、採用はされませんでした。', flag: 'nameLaughed' },
          ],
        },
      ],
    }),
  ],
})
