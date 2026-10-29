import type { LifeState } from '../types.ts'
import { hasFlag, type EventSpec } from './spec.ts'

// Choices of the potential mode (PROJECT_PLAN §11.20), met only there (`potentialOnly`): a test of ability, a private coach, a
// stall, a summer of hard training, what the scouts think of his promise, a coach he does not suit, a gift for study, a
// gift for people. Each answer changes how well he is developed (nurture), his talent or speed, how much of it is known,
// how the scouts see him or how he suits the coach, and sets a fact that a follow-up reads some years on; the results depend
// on the hidden talent (g, the aptitudes, the fit with the coach), so the same choice does not give the same to everyone.
// The おまかせ choice only sets facts. All texts are original.

const X = { extra: true, career: true, potentialOnly: true } as const
const A = { extra: true, potentialOnly: true } as const
const XF = { extra: true, career: true, potentialOnly: true, followOnly: true } as const
const PLAY = ['youth', 'jhs', 'hs', 'univ', 'company', 'indep', 'proMinor', 'pro']
const playing = (s: LifeState) => !!s.bb && PLAY.includes(s.career.phase)
const has = (f: string) => (s: LifeState) => hasFlag(s, f)
const g = (s: LifeState) => s.pot?.g ?? 0.9

export const POTENTIAL_LIFE: EventSpec[] = [
  // ---------------------------------------------------------------- a test of ability: what is learned, and what is done with it
  {
    ...A,
    id: 'x.pot.measure',
    category: 'potMeasure',
    stages: ['youth', 'jhs'],
    ages: [9, 13],
    when: (s) => playing(s) && !hasFlag(s, 'pot.tested') && !hasFlag(s, 'pot.untested'),
    weight: 18,
    maxPerLife: 1,
    title: '体力・運動能力の測定会',
    body: '地域のスポーツ教室が、子ども向けの測定会を開きます。結果は、保護者にも本人にも伝えられるそうです。',
    auto: 2,
    choices: [
      {
        label: '測定会に参加する',
        hint: '自分の素質が少し分かるが、数字に気持ちが揺れるかもしれない',
        flag: 'pot.tested',
        follow: [{ id: 'x.pot.measureBack', after: 2, within: 4 }],
        effects: { fatigue: 2, pot: { reveal: 0.25 } },
        outcomes: [
          { when: (s) => g(s) >= 1.3, weight: 1, text: '握力も投げる力も走る力も、同じ学年の中で上位。係の人が「これは楽しみな子ですね」と言って、親が照れくさそうに笑いました。', effects: { conf: 4, happy: 2 } },
          { when: (s) => g(s) < 1.3 && g(s) >= 0.6, weight: 1, text: '全体としては、学年の真ん中あたり。ただ、一つだけ、飛び抜けて良い項目がありました。', effects: { conf: 1 } },
          { when: (s) => g(s) < 0.6, weight: 1, text: '多くの項目が平均を下回りました。帰り道に、母が「数字がすべてじゃないよ」と、何度も言いました。', effects: { conf: -4, happy: -2 } },
        ],
      },
      {
        label: '参加せず、これまでどおり練習する',
        hint: '数字に惑わされないが、自分の素質を知る機会を逃す',
        flag: 'pot.untested',
        follow: [{ id: 'x.pot.measureBack', after: 2, within: 4 }],
        effects: { happy: 2, pot: { nurture: 0.05 } },
        outcomes: [{ text: '「測らなくても、やることは同じ」と決めて、その日は友だちと近所の空き地で投げ合いました。' }],
      },
      { label: '親と相談して、決める', outcomes: [{ text: '「どうしたい？」と聞かれて、うまく答えられず、返事は先延ばしになりました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.pot.measureBack',
    category: 'potMeasure',
    stages: ['jhs', 'hs', 'student'],
    when: (s) => hasFlag(s, 'pot.tested') || hasFlag(s, 'pot.untested'),
    outcomes: [
      { when: (s) => hasFlag(s, 'pot.tested') && g(s) >= 1.3, weight: 1.4, text: '「期待されている」という言葉に応えようと、誰より早くグラウンドに来る毎日が続きました。', effects: { conf: 3, pot: { nurture: 0.12 } } },
      { when: (s) => hasFlag(s, 'pot.tested') && g(s) >= 1.3, weight: 1, text: '「自分は才能がある」と思い込み、基本の反復をおろそかにするようになりました。周りに追いつかれて、初めて気づきました。', effects: { conf: -2, pot: { nurture: -0.12 } } },
      { when: (s) => hasFlag(s, 'pot.tested') && g(s) < 1.3, weight: 1.3, text: '測定の数字を見返すのが悔しくて、数字に出ない粘りと工夫で勝負しようと、決めました。', effects: { conf: 2, pot: { nurture: 0.12 } } },
      { when: (s) => hasFlag(s, 'pot.tested') && g(s) < 1.3, weight: 1, text: '数字を気にするようになり、「どうせ自分は」と、全力を出し切る前に諦める癖がつきました。', effects: { conf: -3, pot: { nurture: -0.12 } } },
      { when: has('pot.untested'), weight: 1.5, text: '先入観なく挑戦を続けた日々が、思いがけない成長につながりました。限界を知らないことが、強みでした。', effects: { conf: 2, pot: { nurture: 0.08 } } },
      { when: has('pot.untested'), weight: 1, text: '自分の得意と不得意を知らないまま、遠回りの練習を重ねた時期があります。あとで測っておけばと、思いました。', effects: { fatigue: 3, pot: { nurture: -0.05 } } },
    ],
  },
  // ---------------------------------------------------------------- a private coach, or teaching himself
  {
    ...X,
    id: 'x.pot.mentor',
    category: 'potMentor',
    stages: ['jhs', 'hs', 'univ'],
    ages: [13, 20],
    when: (s) => playing(s) && !hasFlag(s, 'pot.mentor') && !hasFlag(s, 'pot.selfTaught'),
    weight: 12,
    maxPerLife: 1,
    title: '個別に教えてくれる人',
    body: '知り合いの紹介で、元選手が、個別に教えてくれることになりました。月謝は決して安くありません。チームの指導とは、考え方が違うようです。',
    auto: 2,
    choices: [
      {
        label: '個別指導を受ける',
        hint: '合えば大きく伸びるが、合わなければお金と時間を失う',
        flag: 'pot.mentor',
        follow: [{ id: 'x.pot.mentorBack', after: 2, within: 4 }],
        effects: { money: -24, fatigue: 3 },
        outcomes: [
          { weight: (s) => 1.6 + 5 * (s.pot?.coachFit ?? 0), text: '言葉の選び方も練習のメニューも、体に合いました。「そういうことか」と、毎週のように新しい気づきがありました。', effects: { conf: 4, pot: { nurture: 0.2, reveal: 0.1 } } },
          { weight: (s) => 1 - 3 * (s.pot?.coachFit ?? 0), text: 'チームの指導と食い違い、どちらを信じればいいのか分からなくなりました。毎週の練習が、少し重くなりました。', effects: { conf: -3, pot: { nurture: -0.06 } } },
        ],
      },
      {
        label: '動画や本で、自分で研究する',
        hint: 'お金はかからないが、遠回りになり、間違いに気づきにくい',
        flag: 'pot.selfTaught',
        follow: [{ id: 'x.pot.mentorBack', after: 2, within: 4 }],
        effects: { fatigue: 2, know: 1, pot: { nurture: 0.05 } },
        outcomes: [{ text: '夜、机の上にノートを広げ、一流選手の動きをコマ送りにして、自分の体と見比べました。' }],
      },
      { label: '今のチームの指導に、任せる', outcomes: [{ text: '「まずは、いまの練習を信じてやってみる」と決めて、断りの連絡を入れました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.pot.mentorBack',
    category: 'potMentor',
    stages: ['jhs', 'hs', 'univ', 'amateur', 'student'],
    when: (s) => hasFlag(s, 'pot.mentor') || hasFlag(s, 'pot.selfTaught'),
    outcomes: [
      { when: has('pot.mentor'), weight: (s) => 1 + 2 * Math.max(0, s.pot?.nurture ?? 0), text: '教わった体の使い方が土台になり、練習の中で、自分で直せるようになりました。いまも、あの人の言葉を思い出します。', effects: { conf: 3, eval: 3, pot: { rate: 0.05 } } },
      { when: has('pot.mentor'), weight: 1, text: '通うのが負担になり、費用も重なって、続けられなくなりました。教わったことのすべてが、身についたわけではありません。', effects: { money: -12, conf: -1 } },
      { when: has('pot.selfTaught'), weight: (s) => 1 + 0.6 * Math.max(0, (s.pot?.mind ?? 0)), text: '自分で考えて試した工夫が、はまりました。考える力が、練習の質を押し上げました。', effects: { conf: 3, pot: { nurture: 0.08, revealMind: 0.15 } } },
      { when: has('pot.selfTaught'), weight: (s) => 1 + 0.6 * Math.max(0, -(s.pot?.mind ?? 0)), text: '誤った解釈のまま練習を続け、肘と肩に負担がかかっていました。人に見てもらう大切さを、あとで知りました。', effects: { health: -2, conf: -2, pot: { nurture: -0.08 } } },
    ],
  },
  // ---------------------------------------------------------------- a stall
  {
    ...X,
    id: 'x.pot.plateau',
    category: 'potPlateau',
    stages: ['hs', 'univ', 'amateur'],
    ages: [15, 23],
    when: (s) => {
      const p = s.pot
      if (!p || !playing(s) || hasFlag(s, 'pot.rebuild') || hasFlag(s, 'pot.polish') || hasFlag(s, 'pot.restBody')) return false
      const last = p.hist.at(-1)
      return (p.pattern === 'plateau' && !p.unlocked && s.age >= 15) || (!!last && last.q < 0.85 && p.hist.length >= 2)
    },
    weight: 25,
    maxPerLife: 1,
    title: '伸びが止まったとき',
    body: '数字も、手応えも、この一年は、ほとんど動きません。周りは少しずつ前に進んでいるように見えます。',
    auto: 3,
    choices: [
      {
        label: 'フォームを根本から作り直す',
        hint: '壁を越えるかもしれないが、しばらくは悪くなる',
        flag: 'pot.rebuild',
        follow: [{ id: 'x.pot.plateauBack', after: 2, within: 3 }],
        effects: { conf: -2, fatigue: 3, pot: { nurture: -0.1 } },
        outcomes: [
          { weight: 1.3, text: '一から作り直す日々は、苦しいものでした。それでも、ある朝、体の使い方が噛み合う感覚がありました。', effects: { conf: 3, pot: { unlock: true, nurture: 0.15 } } },
          { weight: 1, text: '作り直しは思うように進まず、試合では以前のフォームの良さまで失ってしまいました。', effects: { conf: -4, eval: -3 } },
        ],
      },
      {
        label: '今の形を、もう一度磨き直す',
        hint: '大きくは崩れないが、壁は越えにくい',
        flag: 'pot.polish',
        follow: [{ id: 'x.pot.plateauBack', after: 2, within: 3 }],
        effects: { conf: 1, pot: { nurture: 0.06 } },
        outcomes: [{ text: '毎日の基本練習を、いつもより丁寧に重ねました。結果は劇的には変わらなくても、土台は固まりました。' }],
      },
      {
        label: '練習を減らして、体と気持ちを休める',
        hint: '疲れが取れれば伸びるが、周りに置いていかれる不安がある',
        flag: 'pot.restBody',
        follow: [{ id: 'x.pot.plateauBack', after: 2, within: 3 }],
        effects: { fatigue: -10, health: 2, happy: 3, pot: { nurture: 0.1 } },
        outcomes: [{ text: '二週間、ボールを持たずに過ごしました。散歩と読書で、頭の中が静かになっていきました。' }],
      },
      { label: 'もう少しだけ、様子を見る', outcomes: [{ text: '「焦らない」と自分に言い聞かせて、いつもの練習を続けました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.pot.plateauBack',
    category: 'potPlateau',
    stages: ['hs', 'univ', 'amateur', 'pro', 'student'],
    when: (s) => hasFlag(s, 'pot.rebuild') || hasFlag(s, 'pot.polish') || hasFlag(s, 'pot.restBody'),
    outcomes: [
      { when: has('pot.rebuild'), weight: 1.5, text: '作り直した形が定着し、翌シーズンは、自己最高の数字を残しました。あの苦しい期間は、無駄ではなかったと思えます。', effects: { eval: 4, conf: 4, pot: { rate: 0.05 } } },
      { when: has('pot.rebuild'), weight: 1, text: '時間をかけて作り直したものの、元の形に戻したほうがよかったのではと、悩む日が続いています。', effects: { conf: -2, pot: { nurture: -0.05 } } },
      { when: has('pot.polish'), weight: 1.5, text: '磨き直した基本が、疲れた終盤の試合で、ものをいいました。崩れにくい選手になった、と言われました。', effects: { eval: 3, conf: 2 } },
      { when: has('pot.polish'), weight: 1, text: '壁を前にしながら、同じことを繰り返しているのではないかという疑いが、消えませんでした。', effects: { conf: -3, pot: { nurture: -0.04 } } },
      { when: has('pot.restBody'), weight: (s) => 1 + Math.max(0, ((s.bb?.fatigue ?? 20) - 40) / 40), text: '休んだことで、疲労の抜けた体が、練習の成果をようやく吸収し始めました。久しぶりに、手応えが戻りました。', effects: { conf: 4, health: 2, pot: { nurture: 0.1 } } },
      { when: has('pot.restBody'), weight: 1, text: '休んだ間に、レギュラー争いで一歩遅れました。気持ちは楽になりましたが、焦りがぶり返す夜があります。', effects: { eval: -3, conf: -2 } },
    ],
  },
  // ---------------------------------------------------------------- a summer of hard training
  {
    ...X,
    id: 'x.pot.overtrain',
    category: 'potTrain',
    stages: ['hs', 'univ'],
    ages: [15, 21],
    when: (s) => playing(s) && (s.bb?.fatigue ?? 0) >= 55 && !hasFlag(s, 'pot.grind') && !hasFlag(s, 'pot.paced'),
    weight: 20,
    maxPerLife: 1,
    title: '追い込みの夏',
    body: '大会前の最後の夏。周りは練習量を増やしています。体は重く、膝や肘に、小さな違和感があります。',
    auto: 2,
    choices: [
      {
        label: '周りに負けないよう、さらに追い込む',
        hint: '大きく伸びるかもしれないが、体を壊せば素質を失う',
        flag: 'pot.grind',
        follow: [{ id: 'x.pot.overtrainBack', after: 1, within: 3 }],
        effects: { fatigue: 8, gain: 0.03 },
        outcomes: [
          { weight: 1, text: '歯を食いしばって練習量を増やした夏。体は悲鳴を上げましたが、秋には、球の質が変わっていました。', effects: { conf: 4, pot: { nurture: 0.15 } } },
          { weight: 1.1, text: '夏の終わり、練習中に膝へ鋭い痛みが走りました。診断は、疲労の蓄積による故障でした。', effects: { health: -3, injury: 1, conf: -3, pot: { g: -0.08 } } },
        ],
      },
      {
        label: '計画を立てて、休養を入れながら進める',
        hint: '体は守れるが、周りとの差が気になる',
        flag: 'pot.paced',
        follow: [{ id: 'x.pot.overtrainBack', after: 1, within: 3 }],
        effects: { fatigue: -4, health: 1, pot: { nurture: 0.06 } },
        outcomes: [{ text: '週に一度の完全休養日を、手帳に書き込みました。友人たちには、少し不思議な顔をされました。' }],
      },
      { label: '監督やトレーナーの指示に、従う', outcomes: [{ text: '「お前は、こっちのメニューだ」と書かれた紙を受け取り、翌日からそのとおりに動きました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.pot.overtrainBack',
    category: 'potTrain',
    stages: ['hs', 'univ', 'amateur'],
    when: (s) => hasFlag(s, 'pot.grind') || hasFlag(s, 'pot.paced'),
    outcomes: [
      { when: has('pot.grind'), weight: 1.2, text: '追い込んだ夏の積み重ねが、最後の大会で実を結びました。限界を一度越えた経験は、自信になりました。', effects: { eval: 4, conf: 4 } },
      { when: has('pot.grind'), weight: 1, text: '無理がたたり、同じ場所を痛めて戻ってきました。あの夏がなければ、と考えてしまう日があります。', effects: { health: -2, fatigue: 4, conf: -3, pot: { g: -0.05 } } },
      { when: has('pot.paced'), weight: 1.6, text: '休みを入れた計画が、シーズン終盤の安定につながりました。大きな怪我なく、一年を走りきれました。', effects: { health: 2, eval: 2, pot: { nurture: 0.05 } } },
      { when: has('pot.paced'), weight: 1, text: '周りが追い込む中、自分だけ休んでいるようで、不安が消えない夏でした。結果が出るまで、半信半疑でした。', effects: { conf: -2 } },
    ],
  },
  // ---------------------------------------------------------------- what the scouts think of his promise
  {
    ...X,
    id: 'x.pot.scoutView',
    category: 'potScout',
    stages: ['hs', 'univ', 'amateur'],
    ages: [17, 23],
    when: (s) => playing(s) && !!s.pot && Math.abs(s.pot.scoutBias) >= 0.25 && !hasFlag(s, 'pot.trustScout') && !hasFlag(s, 'pot.proveIt'),
    weight: 25,
    maxPerLife: 1,
    title: 'スカウトの見立て',
    body: (s) =>
      (s.pot?.scoutBias ?? 0) > 0
        ? 'ある球団の担当者が、「まだ荒削りだが、伸びしろは相当に大きい」と、周囲に話しているそうです。いまの数字より、将来への期待が先に立っているようです。'
        : '担当者の評価は、「安定していて悪くないが、これ以上の伸びは見込みにくい」というものだそうです。将来性を、低く見られているようです。',
    auto: 2,
    choices: [
      {
        label: '評価を信じて、上のレベルに早く挑む',
        hint: '評価が合っていれば道が開くが、外れていれば苦しむ',
        flag: 'pot.trustScout',
        follow: [{ id: 'x.pot.scoutViewBack', after: 2, within: 4 }],
        effects: { conf: 2, fatigue: 3 },
        outcomes: [
          { weight: (s) => 1 + Math.max(0, g(s) - 0.9), text: '早い段階で上のレベルの練習に加わり、周りの速さに圧倒されながらも、毎日が吸収の連続でした。', effects: { eval: 3, pot: { nurture: 0.12, reveal: 0.15 } } },
          { weight: (s) => 1 + Math.max(0, 0.9 - g(s)), text: '上のレベルの速さに追いつけず、期待ほどの力はないと、早々に周囲の目が変わっていくのが分かりました。', effects: { conf: -4, eval: -3, pot: { reveal: 0.15 } } },
        ],
      },
      {
        label: '自分の力で、評価を覆す結果を出す',
        hint: '実績で見る目を変えられるが、時間がかかる',
        flag: 'pot.proveIt',
        follow: [{ id: 'x.pot.scoutViewBack', after: 2, within: 4 }],
        effects: { fatigue: 4, conf: 1, pot: { scoutBias: -0.2 } },
        outcomes: [{ text: '「数字で見せる」と決めて、地道に結果を積み上げる日々を選びました。' }],
      },
      { label: '評価は気にせず、目の前の練習を続ける', outcomes: [{ text: '噂話は聞き流して、いつもどおりに道具を磨きました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.pot.scoutViewBack',
    category: 'potScout',
    stages: ['hs', 'univ', 'amateur', 'pro'],
    when: (s) => hasFlag(s, 'pot.trustScout') || hasFlag(s, 'pot.proveIt'),
    outcomes: [
      { when: has('pot.trustScout'), weight: (s) => 0.6 + Math.max(0, g(s) - 0.7), text: '早くから高いレベルに身を置いたことが、成長を後押ししました。あのとき挑戦してよかったと、今は思います。', effects: { eval: 4, conf: 4, pot: { rate: 0.05 } } },
      { when: has('pot.trustScout'), weight: (s) => 0.6 + Math.max(0, 1.1 - g(s)), text: '期待が先に立っていた分、結果が追いつかないと失望の声も出ました。評価がひるがえる怖さを、知りました。', effects: { conf: -3, eval: -4, pot: { scoutBias: -0.3 } } },
      { when: has('pot.proveIt'), weight: 1.5, text: '積み重ねた数字が、徐々に見る目を変えていきました。いつのまにか、「地に足のついた選手」と呼ばれるようになりました。', effects: { eval: 3, conf: 3, pot: { scoutBias: 0.15 } } },
      { when: has('pot.proveIt'), weight: 1, text: '実績を積んでも、評価はなかなか変わりませんでした。見る目を変えるのは、数字だけではないと感じました。', effects: { conf: -2, fatigue: 3 } },
    ],
  },
  // ---------------------------------------------------------------- a coach he does not suit
  {
    ...X,
    id: 'x.pot.coachClash',
    category: 'potCoach',
    stages: ['hs', 'univ', 'amateur', 'pro'],
    when: (s) => playing(s) && !!s.pot && s.pot.coachFit <= -0.08 && !hasFlag(s, 'pot.talkIt') && !hasFlag(s, 'pot.changeScene') && !hasFlag(s, 'pot.endure'),
    weight: 25,
    maxPerLife: 1,
    title: '指導者と、うまくいかない',
    body: '指導者の教え方が、どうしても自分の体と頭に合いません。言われたとおりにやるほど、動きがぎこちなくなっていきます。',
    auto: 3,
    choices: [
      {
        label: '率直に話し合い、やり方を擦り合わせる',
        hint: '歩み寄れれば伸びるが、反発と受け取られる危険がある',
        flag: 'pot.talkIt',
        follow: [{ id: 'x.pot.coachClashBack', after: 1, within: 3 }],
        effects: { rel: -1, fatigue: 2, pot: { coachFit: 0.1 } },
        outcomes: [{ text: '練習のあと、監督室の前で何度も深呼吸をしてから、ドアを叩きました。' }],
      },
      {
        label: '環境を変える道を探す',
        hint: '合う場所が見つかれば伸びるが、実績と人間関係を手放す',
        flag: 'pot.changeScene',
        follow: [{ id: 'x.pot.coachClashBack', after: 1, within: 3 }],
        effects: { rel: -3, eval: -2, pot: { coachFit: 'redraw' } },
        outcomes: [{ text: '親や信頼できる先輩に相談し、別のチームや練習環境を、探し始めました。' }],
      },
      {
        label: '我慢して従う',
        hint: '波風は立たないが、素質が活きないまま時間が過ぎるかもしれない',
        flag: 'pot.endure',
        follow: [{ id: 'x.pot.coachClashBack', after: 1, within: 3 }],
        effects: { conf: -2, happy: -2, pot: { nurture: -0.04 } },
        outcomes: [{ text: '言いたいことを飲み込んで、毎日、言われたとおりに体を動かしました。' }],
      },
      { label: '何もせず、時間が解決するのを待つ', outcomes: [{ text: '「そのうち慣れる」と思いながら、同じ練習を続けました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.pot.coachClashBack',
    category: 'potCoach',
    stages: ['hs', 'univ', 'amateur', 'pro', 'student'],
    when: (s) => hasFlag(s, 'pot.talkIt') || hasFlag(s, 'pot.changeScene') || hasFlag(s, 'pot.endure'),
    outcomes: [
      { when: has('pot.talkIt'), weight: 1.5, text: '話し合いのあと、メニューの一部を調整してもらえました。お互いの考えを知ったことで、指導の言葉が、少し届くようになりました。', effects: { rel: 3, eval: 3, conf: 2 } },
      { when: has('pot.talkIt'), weight: 1, text: '「注文をつけるな」と一蹴され、関係はかえってぎくしゃくしました。それでも、言うべきことは言ったと思います。', effects: { rel: -3, eval: -3 } },
      { when: has('pot.changeScene'), weight: 1.4, text: '新しい環境では、教え方が体に合い、数か月で見違えるほど動きが変わりました。環境の力を、思い知りました。', effects: { conf: 4, eval: 3, pot: { nurture: 0.1 } } },
      { when: has('pot.changeScene'), weight: 1, text: '新しい場所でも、人間関係から作り直す苦労があり、期待したほどの変化は得られませんでした。', effects: { rel: -2, conf: -2 } },
      { when: has('pot.endure'), weight: 1, text: '耐えた日々のおかげで、自分で工夫する癖がつきました。素質が活きなかった悔しさも、同時に残りました。', effects: { conf: 1, pot: { nurture: -0.03 } } },
      { when: has('pot.endure'), weight: 1.3, text: '我慢を重ねるうちに、野球を楽しむ気持ちが細っていきました。何のためにやっているのか、分からなくなる夜があります。', effects: { happy: -4, conf: -3, fatigue: 3 } },
    ],
  },
  // ---------------------------------------------------------------- aptitudes beside baseball
  {
    ...A,
    id: 'x.pot.study',
    category: 'potMind',
    stages: ['youth', 'jhs', 'hs', 'student'],
    ages: [10, 17],
    when: (s) => !!s.pot && s.pot.mind >= 0.7 && !hasFlag(s, 'pot.studyDeep') && !hasFlag(s, 'pot.studyLight'),
    weight: 25,
    maxPerLife: 1,
    title: '勉強が面白くなってきた',
    body: '授業で習ったことが、不思議なほど頭に入ってきます。先生にも、「物事の筋道を考えるのが得意ですね」と言われました。',
    auto: 2,
    choices: [
      {
        label: '勉強にも本気で打ち込む',
        hint: '学力と判断力が伸びるが、野球の練習時間は減る',
        flag: 'pot.studyDeep',
        follow: [{ id: 'x.pot.studyBack', after: 2, within: 5 }],
        effects: { know: 4, fatigue: 3, pot: { revealMind: 0.3, mind: 0.2 } },
        outcomes: [{ text: '放課後の図書室で、解き方を考える時間が、思いのほか楽しくなりました。' }],
      },
      {
        label: '野球を優先し、勉強は人並みにとどめる',
        hint: '野球には集中できるが、頭の良さを活かす機会は減る',
        flag: 'pot.studyLight',
        follow: [{ id: 'x.pot.studyBack', after: 2, within: 5 }],
        effects: { conf: 1, pot: { nurture: 0.05 } },
        outcomes: [{ text: '「勉強は最低限」と決めて、空いた時間を素振りと走り込みにあてました。' }],
      },
      { label: '今のままで、様子を見る', outcomes: [{ text: '先生の言葉は嬉しかったものの、特に何かを変えようとはしませんでした。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.pot.studyBack',
    category: 'potMind',
    stages: ['hs', 'univ', 'student', 'amateur', 'adult'],
    when: (s) => hasFlag(s, 'pot.studyDeep') || hasFlag(s, 'pot.studyLight'),
    outcomes: [
      { when: has('pot.studyDeep'), weight: 1.5, text: '考える力が、野球にも活きました。相手の配球や、状況ごとの最善手を読む力が、周囲に一目置かれました。', effects: { eval: 4, conf: 3, skill: { calling: 0.06 } } },
      { when: has('pot.studyDeep'), weight: 1, text: '勉強に時間を使ったぶん、体づくりが追いつかず、練習の質が落ちたと感じる時期がありました。', effects: { fatigue: 3, conf: -2, pot: { nurture: -0.05 } } },
      { when: has('pot.studyLight'), weight: 1.2, text: '練習に集中できた時間の分だけ、技術が磨かれました。ただ、頭を使う場面では、周囲に差をつけられました。', effects: { eval: 2, know: -2 } },
      { when: has('pot.studyLight'), weight: 1, text: '勉強を後回しにしたため、進路の選択肢が狭まったことに、あとで気づきました。', effects: { know: -4, conf: -2 } },
    ],
  },
  {
    ...A,
    id: 'x.pot.people',
    category: 'potSoc',
    stages: ['jhs', 'hs', 'univ', 'amateur'],
    ages: [13, 22],
    when: (s) => playing(s) && !!s.pot && s.pot.soc >= 0.7 && !hasFlag(s, 'pot.leadTeam') && !hasFlag(s, 'pot.backStage'),
    weight: 25,
    maxPerLife: 1,
    title: '人を引きつける力',
    body: 'チームの中で、いつのまにか自分のまわりに人が集まるようになりました。ケンカの仲裁や、新入生の面倒を、自然に頼まれます。',
    auto: 2,
    choices: [
      {
        label: 'まとめ役を引き受けて、前に立つ',
        hint: '信頼は集まるが、自分の練習時間が削られる',
        flag: 'pot.leadTeam',
        follow: [{ id: 'x.pot.peopleBack', after: 2, within: 5 }],
        effects: { rel: 4, fatigue: 3, pot: { revealSoc: 0.3, soc: 0.2 } },
        outcomes: [{ text: '声をかける順番、座る場所、言葉の選び方。人を動かすことの難しさと面白さを、同時に知りました。' }],
      },
      {
        label: '前には出ず、裏方で支える',
        hint: '自分の野球に集中できるが、持っている力は目立たない',
        flag: 'pot.backStage',
        follow: [{ id: 'x.pot.peopleBack', after: 2, within: 5 }],
        effects: { conf: 1, pot: { nurture: 0.05 } },
        outcomes: [{ text: '「頼まれたら手伝う」くらいの距離を保って、自分の練習を優先しました。' }],
      },
      { label: '特に意識せず、普段どおりに過ごす', outcomes: [{ text: '人が集まるのは気のせいだと思って、いつもの席でお弁当を食べました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.pot.peopleBack',
    category: 'potSoc',
    stages: ['hs', 'univ', 'amateur', 'pro', 'adult'],
    // (its lines speak of the team: it comes only while he plays; after he has stopped, the booking waits, then lapses)
    when: (s) => playing(s) && (hasFlag(s, 'pot.leadTeam') || hasFlag(s, 'pot.backStage')),
    outcomes: [
      { when: has('pot.leadTeam'), weight: 1.5, text: '周りをまとめた経験が、指導者の信頼になりました。チームのまとまりが、自分の成績にもつながりました。', effects: { rel: 4, eval: 3, pot: { coachFit: 0.06 } } },
      { when: has('pot.leadTeam'), weight: 1, text: '周りに気を配るあまり、自分の調整が後回しになり、大事な時期に調子を崩しました。', effects: { conf: -3, fatigue: 4 } },
      { when: has('pot.backStage'), weight: 1.2, text: '自分のことに集中して、技術は着実に伸びました。それでも、人の輪の中心にいなかったことを、時々思い返します。', effects: { eval: 2, rel: -2 } },
      { when: has('pot.backStage'), weight: 1, text: '目立たない存在でも、人づきあいの良さが評価され、思いがけない推薦や紹介につながりました。', effects: { rel: 3, eval: 2 } },
    ],
  },
]
