import type { LifeState } from '../types.ts'
import { hasFlag, type EventSpec } from './spec.ts'

// Outside trainers and specialist coaching, from junior high to the pro years (PROJECT_PLAN §11.16): rare, they cost
// money (the family's, until 18) and the player's own choice, they may help the body, the technique and the
// risk of injury, and they never work for sure. A player whose family cannot pay, or who has no savings, does not
// see the paid choices. The おまかせ choice is always the cheap one and only sets facts (spec.ts NEUTRAL_FORBIDDEN).
// All texts are original; no name appears in them.

const X = { extra: true, career: true } as const
const playing = (s: LifeState) => !!s.bb && ['jhs', 'hs', 'univ', 'company', 'indep', 'proMinor', 'pro'].includes(s.career.phase)
/** whether the paid choice is within reach: the family's means until 18, his own savings after */
const affordable = (s: LifeState) => (s.age >= 18 ? s.money >= 50 : s.person.wealth >= 3)
const pitcher = (s: LifeState) => s.person.position === 'P'
const injuries = (s: LifeState) => s.bb?.injuries ?? 0

export const TRAINER_LIFE: EventSpec[] = [
  {
    ...X,
    id: 'x.trainer.offer',
    category: 'trainer',
    stages: ['jhs', 'hs', 'univ', 'amateur', 'pro'],
    when: (s) => playing(s) && s.age >= 12 && !hasFlag(s, 'trainer.regular'),
    // rare: about one life in six meets it in a playing career
    weight: 1.5,
    cooldown: 4,
    maxPerLife: 2,
    title: '専門のトレーナー',
    body: (s) =>
      pitcher(s)
        ? '知り合いから、肩や肘の使い方を見てくれる専門のトレーナーを紹介されました。チームの指導とは別の目で、投げ方を見てもらえるそうです。'
        : '知り合いから、体の使い方を専門に教えるトレーナーを紹介されました。打撃や守備の動きを、別の目で見てもらえるそうです。',
    auto: 2,
    choices: [
      {
        label: '専門のトレーナーのもとへ、定期的に通う',
        hint: '費用がかかる（家計の余裕か、自分の貯金が要る）。合えば伸びるが、合わなければ時間とお金を失う',
        when: affordable,
        flag: 'trainer.regular',
        follow: [{ id: 'x.trainer.review', after: 1, within: 3 }],
        effects: { money: -60, fatigue: 4 },
        outcomes: [
          { weight: 3, when: pitcher, text: '肩甲骨と股関節の使い方を一から見直し、同じ力でも球がまっすぐ伸びるようになりました。', effects: { gain: 0.04, conf: 3, skill: { velocity: 0.1, control: 0.08 } } },
          { weight: 3, when: (s) => !pitcher(s), text: '体の軸と足の使い方を細かく直してもらい、打球の質も守備の一歩目も変わってきました。', effects: { gain: 0.04, conf: 3, skill: { contact: 0.1, power: 0.06 } } },
          { weight: 1.5, text: 'トレーナーの理論とチームの指導が食い違い、どちらに従えばいいのか迷う時期が続きました。', effects: { conf: -3, eval: -1 } },
          { weight: 1, text: '定期的に体を診てもらううち、左右の差と痛みの原因が早めに見つかりました。', effects: { health: 2, conf: 2, flag: 'trainer.care' } },
        ],
      },
      {
        label: '週末の体験会や短いクリニックだけ受ける',
        hint: '費用は小さい。一度の助言で終わる',
        effects: { money: -8 },
        outcomes: [
          { weight: 2, text: '一日のクリニックで、自分では気づかなかった癖を一つ指摘されました。それだけでも収穫でした。', effects: { gain: 0.01, conf: 1 } },
          // (a day spent for nothing: a little disappointment, never the same as not going; for a minor the family pays, so the money
          // does not move either way)
          { weight: 1, text: '参加者が多く、一人ひとりを丁寧に見てもらう時間はありませんでした。期待していたぶん、物足りなさが残りました。', effects: { conf: -1 } },
        ],
      },
      { label: '動画とチームの指導で続ける', outcomes: [{ text: '紹介された話は丁重に断り、今の環境で続けることにしました。' }] },
    ],
  },
  {
    ...X,
    id: 'x.trainer.review',
    category: 'trainer',
    stages: ['jhs', 'hs', 'univ', 'amateur', 'pro'],
    followOnly: true,
    when: (s) => playing(s) && hasFlag(s, 'trainer.regular'),
    outcomes: [
      { weight: 3, text: '通い続けて一年。体の変化が記録にも表れ、トレーナーの教えが自分の言葉になってきました。', effects: { gain: 0.03, conf: 4, flag: 'trainer.care' } },
      { weight: 1.5, text: '費用の負担が重くなり、通う回数を減らすことになりました。教わった基本は続けています。', effects: { money: -20, conf: -1 } },
      { weight: 1, text: '同じトレーナーに通う他チームの選手と知り合い、練習の情報を交換する仲になりました。', effects: { rel: 3, skill: { stamina: 0.06 } } },
    ],
  },
  {
    ...X,
    id: 'x.trainer.rehab',
    category: 'trainer',
    stages: ['hs', 'univ', 'amateur', 'pro'],
    // after an injury: how to come back
    when: (s) => playing(s) && injuries(s) >= 1 && s.career.injured === 0 && !hasFlag(s, 'rehab.expert') && !hasFlag(s, 'rehab.cheap'),
    weight: 12,
    cooldown: 3,
    maxPerLife: 2,
    title: '故障のあとの付き合い方',
    body: '痛みは引きましたが、同じ場所をまた痛めるのではないかという不安が残っています。',
    auto: 2,
    choices: [
      {
        label: '専門の医師とトレーナーのもとで、段階的に戻す',
        hint: '費用と時間がかかるが、再発の不安を減らせる',
        when: affordable,
        flag: 'rehab.expert',
        effects: { money: -40, fatigue: -4 },
        outcomes: [
          { weight: 3, text: '画像と動きの検査をもとに、弱い部分を鍛え直すメニューを組んでもらい、痛みなく動けるようになりました。', effects: { health: 2, conf: 4, gain: 0.02, flag: 'trainer.care' } },
          { weight: 1, text: '慎重に戻したぶん復帰に時間がかかり、チームでの立場が少し下がりました。', effects: { conf: -2, eval: -2 } },
        ],
      },
      {
        label: '近くの整骨院に通いながら、様子を見る',
        hint: '費用は小さい。見落としがあると、再発することもある',
        flag: 'rehab.cheap',
        follow: [{ id: 'x.health.relapse', after: 1, within: 3 }],
        effects: { money: -10 },
        outcomes: [{ text: '近所の整骨院で、手当てとストレッチを続けながら、少しずつ練習に戻りました。', effects: { conf: 1 } }],
      },
      { label: 'チームのトレーナーの指示どおりに戻す', outcomes: [{ text: 'チームのトレーナーが示した順序で、時間をかけて練習に戻りました。' }] },
    ],
  },
  {
    ...X,
    id: 'x.health.relapse',
    category: 'injuryBack',
    stages: ['hs', 'univ', 'amateur', 'pro'],
    followOnly: true,
    when: (s) => playing(s) && hasFlag(s, 'rehab.cheap'),
    outcomes: [
      // a history of injuries makes a relapse likelier: the weight grows with the number of injuries so far
      { weight: (s) => 0.6 + 0.7 * injuries(s), text: '古い故障の箇所が、大事な時期にまた痛みました。治療のやり直しで、練習を離れることになりました。', kind: 'bad', effects: { injury: 1, conf: -4, health: -2 } },
      { weight: 2, text: '痛みが再発することはなく、古傷の箇所も練習の中で徐々に強くなりました。', effects: { conf: 3, health: 1 } },
    ],
  },
  {
    ...X,
    id: 'x.trainer.nutrition',
    category: 'trainer',
    stages: ['hs', 'univ', 'amateur', 'pro'],
    when: (s) => playing(s) && s.age >= 15 && !hasFlag(s, 'nutrition.expert'),
    weight: 3,
    cooldown: 4,
    maxPerLife: 1,
    title: '食事を見直す',
    body: '練習量のわりに体重が増えず、疲れも抜けにくくなっています。食事が足りていないのかもしれません。',
    auto: 1,
    choices: [
      {
        label: 'スポーツ栄養士に相談して、食事を組み直す',
        hint: '費用がかかるが、根拠のある食事になる',
        when: affordable,
        flag: 'nutrition.expert',
        effects: { money: -25 },
        outcomes: [
          { weight: 3, text: '食べる量とタイミングを具体的に決めて半年。体重が増え、練習のあとの疲れ方が軽くなりました。', effects: { fatigue: -10, gain: 0.02, conf: 3 } },
          { weight: 1, text: '決められた食事を守るのが負担になり、食べることが楽しくなくなってきました。', effects: { happy: -3 } },
        ],
      },
      { label: 'チームや寮の食事に合わせて、自分でも食べる量を増やす', outcomes: [{ text: '決まった食事に加えて、補食のおにぎりを毎日持っていくことにしました。' }] },
      { label: '自己流で食事を制限して、体を絞る', hint: '数字は動くが、体力を落とすおそれがある', effects: { fatigue: 8 }, outcomes: [{ weight: 1, text: '体は軽くなりましたが、後半にスタミナが切れる試合が増えました。', effects: { conf: -2, skill: { stamina: -0.1 } } }, { weight: 1, text: '数字は思いどおりに減ったものの、貧血気味で、風邪をひきやすくなりました。', effects: { health: -2, fatigue: 6 } }] },
    ],
  },
  {
    ...X,
    id: 'x.trainer.analysis',
    category: 'trainer',
    stages: ['univ', 'amateur', 'pro'],
    when: (s) => playing(s) && !hasFlag(s, 'analysis.done'),
    weight: 1.5,
    maxPerLife: 1,
    title: '動作解析',
    body: 'チームが、トラッキング機器と動作解析の測定会を開くことになりました。自分の数字が、はっきりと出ます。',
    auto: 2,
    choices: [
      {
        label: '数字を信じて、課題を大胆に改造する',
        hint: '当たれば大きいが、感覚を崩すことも多い',
        flag: 'analysis.done',
        effects: { fatigue: 6 },
        outcomes: [
          { weight: 2, text: '数字が示した弱点を直したところ、打球速度（球の回転）が目に見えて改善しました。', effects: { gain: 0.04, conf: 4, skill: { power: 0.08, control: 0.06 } } },
          { weight: 1.5, text: '数字を追うほど感覚が分からなくなり、しばらく結果が出なくなりました。', effects: { conf: -5, gain: -0.02 } },
        ],
      },
      { label: '参考程度にして、今のやり方を大きくは変えない', flag: 'analysis.done', effects: { eval: 1 }, outcomes: [{ text: '数字は課題のメモとして受け取り、練習の中で少しずつ取り入れました。', effects: { conf: 1 } }] },
      { label: '測定会は見送る', outcomes: [{ text: '測定会は欠席して、いつもの練習を続けました。' }] },
    ],
  },
  {
    ...X,
    id: 'x.trainer.kidClinic',
    category: 'trainer',
    stages: ['youth', 'jhs'],
    when: (s) => playing(s) && s.age <= 14,
    weight: 1.5,
    maxPerLife: 1,
    title: '野球教室',
    body: '地域で、元選手を招いた一日の野球教室が開かれることになりました。参加は自由です。',
    auto: 1,
    choices: [
      {
        label: '参加して、質問をいくつもぶつけてみる',
        hint: '憧れの人から直接教わる。刺激を受ける',
        effects: { happy: 3, rel: 2 },
        outcomes: [
          { weight: 2, text: '元選手が目の前でお手本を見せてくれて、「脚で投げる」の意味が少しだけ分かった気がしました。', effects: { conf: 4, skill: { control: 0.06 } } },
          { weight: 1, text: '質問しようとしたものの、緊張で声が出ませんでした。それでも、近くで見られただけで十分でした。', effects: { conf: 1 } },
        ],
      },
      { label: '見学だけにする', outcomes: [{ text: '端のほうで、静かに説明を聞いて帰りました。' }] },
    ],
  },
]
