import type { EventDef, EventStage } from './events.ts'
import type { LifeState } from './types.ts'

// Stage 1 catalog: the everyday lines that used to be drawn from fixed lists, now as events with
// conditions, a per-life limit and categories (PROJECT_PLAN §11.2). Text only: no effect on the life.
// All texts are original.

interface Line {
  /** the line, or the line as it reads for the state (the same event and draw either way) */
  text: string | ((s: LifeState) => string)
  category: string
  ages?: [number, number]
  when?: (s: LifeState) => boolean
}

function lines(prefix: string, stages: EventStage[], list: Line[]): EventDef[] {
  return list.map((l, i) => ({
    id: `${prefix}.${i + 1}`,
    category: l.category,
    stages,
    ages: l.ages,
    when: l.when,
    flavorOnly: true,
    maxPerLife: 1,
    run: (c) => c.add('normal', typeof l.text === 'string' ? l.text : l.text(c.s)),
  }))
}

const hasFamily = (s: LifeState) => s.family.spouse !== null || s.family.children > 0
const working = (s: LifeState) => !!s.job && s.job !== '引退' && s.job !== '大学生'
const playedBaseball = (s: LifeState) => s.career.highestRank > 0

export const BASE_EVENTS: EventDef[] = [
  ...lines('child', ['child'], [
    { text: 'はじめて一人で立ちました。', category: 'growth', ages: [1, 1] },
    { text: 'ボールを転がすと、うれしそうに追いかけます。', category: 'play', ages: [1, 1] },
    { text: '公園の砂場が好きです。', category: 'play', ages: [2, 2] },
    { text: '「もういっかい」が口ぐせになりました。', category: 'growth', ages: [2, 2] },
    { text: '保育園に通いはじめました。', category: 'growth', ages: [3, 3] },
    { text: 'やわらかいボールを投げると、両手でかかえて受け止めます。', category: 'play', ages: [3, 3] },
    { text: '家族で河川敷を散歩するのが日課です。', category: 'family', ages: [4, 4] },
    { text: '雨の日は、窓の外をずっと見ています。', category: 'growth', ages: [4, 4] },
    { text: '自転車の補助輪がとれました。', category: 'growth', ages: [5, 5] },
    { text: 'テレビで野球中継を見て、まねをしてバットを振りました。', category: 'play', ages: [5, 5] },
    { text: 'ベビーカーの上から、通りすがりの犬に必死で手を振っていました。', category: 'play', ages: [1, 1] },
    { text: '絵本の同じページを、「もういっかい」と十回読まされました。', category: 'growth', ages: [1, 2] },
    { text: '階段をのぼりきって、ふり返って得意そうな顔をしました。', category: 'growth', ages: [2, 2] },
    { text: 'お風呂のおもちゃのアヒルに、毎晩話しかけています。', category: 'play', ages: [2, 3] },
    { text: '祖父母の家で、はじめてスイカを丸ごと見て、目を丸くしました。', category: 'family', ages: [3, 3], when: (s) => s.family.mother !== null || s.family.father !== null },
    { text: '公園のすべり台を逆から登って、他の子に順番を譲られました。', category: 'play', ages: [3, 4] },
    { text: '「大きくなったら何になる？」と聞かれ、毎回ちがう答えを言いました。', category: 'growth', ages: [4, 5] },
    { text: '七夕の短冊に、「やきゅうせんしゅ」と、鏡文字で書きました。', category: 'play', ages: [4, 5] },
    { text: '運動会のかけっこで、ゴールの先まで走りすぎて、先生に止められました。', category: 'play', ages: [4, 5] },
    { text: '節分の豆まきで、鬼より先にお父さんに豆をぶつけました。', category: 'family', ages: [4, 4], when: (s) => s.family.father !== null },
    { text: '雨上がりの水たまりを、全部踏まないと家に帰れませんでした。', category: 'play', ages: [5, 5] },
    { text: '夜、星を見上げて「あれ、ぜんぶボール？」と聞きました。', category: 'growth', ages: [5, 5] },  ]),
  ...lines('youth', ['youth'], [
    { text: '練習試合で、はじめてヒットを打ちました。', category: 'game' },
    { text: '日曜の朝は、グラウンドの石拾いから始まります。', category: 'team' },
    { text: '夏の大会は2回戦で負けました。帰りの車で寝てしまいました。', category: 'game' },
    { text: '監督に「声が出ていていい」とほめられました。', category: 'coach' },
    { text: '雨で練習が中止になり、家で素振りをしました。', category: 'practice' },
    { text: 'お当番の日、母がグラウンドで麦茶を配っていました。', category: 'family', when: (s) => s.family.mother !== null },
    { text: '新しいスパイクを買ってもらいました。', category: 'family' },
    { text: '市の大会でベスト8に入りました。', category: 'game' },
    { text: '背番号をもらいました。家に帰って何度も見返しました。', category: 'team' },
    { text: '夏の練習のあと、みんなで食べたかき氷の色が、全員の舌を染めました。', category: 'team' },
    { text: 'ノックの球が股の間を抜けて、笑い話になりました。', category: 'practice' },
    { text: '遠征の車で、友だちとしりとりを延々と続けました。', category: 'team' },
    { text: 'グラブに名前を書き忘れて、他の子のグラブと間違えてしまいました。', category: 'family' },
    { text: '試合のあとの球場の外で食べたおにぎりが、いつもよりおいしく感じました。', category: 'game' },
    { text: 'コーチの口ぐせを、チーム全員が無意識にまねしていました。', category: 'coach' },
    { text: 'ホームランを打った友だちが、ダイヤモンドを走りながら泣き笑いしていました。', category: 'game' },
    { text: '土のグラウンドに、夕日で長く伸びた影が、整列していました。', category: 'practice' },  ]),
  ...lines('jhs', ['jhs'], [
    { text: '新人戦で、はじめて先発メンバーに入りました。', category: 'game' },
    { text: '朝練のあと、授業中に眠くなります。', category: 'school' },
    { text: '練習試合で、ライト線に二塁打を打ちました。', category: 'game' },
    { text: '体が大きくなり、制服を買い替えました。', category: 'growth' },
    { text: 'テスト期間は部活が休みになり、少し落ち着きません。', category: 'school' },
    { text: '先輩の引退試合で、ベンチから声を出し続けました。', category: 'team' },
    { text: '県大会の初戦で、延長の末に負けました。', category: 'game' },
    { text: '部活の帰りに寄るコンビニで、同じ味のアイスを買う日課ができました。', category: 'team' },
    { text: '試合の前の晩、母が黙って洗濯してくれたユニフォームを、そっとたたみました。', category: 'family', when: (s) => s.family.mother !== null },
    { text: '体育祭で、野球部の仲間がリレーでごぼう抜きをして、校庭がわきました。', category: 'school' },
    { text: '定期テストの前日、ベンチの隅で単語帳をめくりました。', category: 'school' },
    { text: '同じ部活の仲間と、駅までの道を毎日走って競争しました。', category: 'team' },
    { text: '三年生が引退し、グラウンドが急に広く感じられました。', category: 'team' },
    { text: '給食のおかわりじゃんけんは、野球部が最強でした。', category: 'school' },
    { text: '修学旅行の夜、先生の見回りをやりすごすための作戦会議が、旅行の目玉でした。', category: 'school' },  ]),
  {
    id: 'jhs.height13',
    category: 'growth',
    stages: ['jhs'],
    ages: [13, 13],
    flavorOnly: true,
    weight: 2,
    run: (c) => c.add('normal', c.s.person.heightCm - 155 > 18 ? '1年で身長が10センチ近く伸びました。' : '背の順は前から数えたほうが早いままです。'),
  },
  ...lines('hs', ['hs'], [
    { text: '1年生の仕事は、グラウンド整備と声出しです。', category: 'team', ages: [15, 15] },
    { text: '夏休みは毎日、日が暮れるまでノックを受けました。', category: 'practice' },
    // (squad places are announced by the season model; this line only follows a place on the bench)
    { text: '秋の大会のベンチで、最後まで声を出し続けました。', category: 'game', ages: [15, 16], when: (s) => s.bb?.role === 'bench' },
    { text: '冬の走り込みで、何度も吐きそうになりました。', category: 'practice' },
    { text: '練習試合で、強豪校の投手の速さに驚きました。', category: 'game' },
    { text: '後輩ができて、教える側にまわりました。', category: 'team', ages: [16, 17] },
    { text: '雨の日は、室内でひたすら素振りをしました。', category: 'practice' },
  ]),
  ...lines('univ', ['univ'], [
    // (squad places are announced by the season model, stage 4; these lines do not contradict them)
    { text: 'リーグ戦で、はじめて神経がすり減るような接戦を経験しました。', category: 'game', when: (s) => s.bb?.role === 'starter' || s.bb?.role === 'bench' },
    { text: '寮の食事当番が回ってきました。', category: 'team' },
    { text: 'リーグ戦の前の晩は、寮の部屋でなかなか眠れませんでした。', category: 'game' },
    { text: '練習の合間に、教職の授業も取っています。', category: 'school' },
  ]),
  ...lines('amateur', ['amateur'], [
    { text: '朝は職場、午後は練習という毎日です。', category: 'work', when: (s) => s.career.phase === 'company' },
    { text: '遠征のバスで、仲間と将棋をさしました。', category: 'team' },
    { text: '地域の野球教室で、子どもたちに投げ方を教えました。', category: 'community' },
    { text: '練習試合で、プロの2軍と対戦しました。', category: 'game' },
  ]),
  ...lines('pro', ['pro'], [
    // (the season model, stage 4, sets the role each year: 'starter' 1軍 regular, 'bench' 1軍 part-time, 'outside' mostly 2軍)
    { text: '3桁の背番号で、2軍の試合に出ています。', category: 'game', when: (s) => s.career.phase === 'proMinor' },
    { text: '早朝の室内練習場は、いつも育成の選手が一番乗りです。', category: 'practice', when: (s) => s.career.phase === 'proMinor' },
    { text: '2軍で結果を出そうと、もがいています。', category: 'game', when: (s) => s.career.phase === 'pro' && (!s.career.proDebut || s.bb?.role === 'outside') },
    { text: '1軍のベンチで、出番を待つ日が続きました。', category: 'game', when: (s) => s.career.phase === 'pro' && s.career.proDebut && s.bb?.role === 'bench' },
    { text: 'お立ち台に上がり、ファンの声援を浴びました。', category: 'fans', when: (s) => s.career.phase === 'pro' && s.career.proDebut && (s.bb?.role === 'starter' || s.bb?.role === 'bench') },
    // (an absence only for one who has been hurt: the others' line keeps the same draw)
    { text: (s) => ((s.bb?.injuries ?? 0) > 0 || s.career.injured > 0 ? '故障で2か月離脱しましたが、夏に戻ってきました。' : '疲れのたまる夏場も、トレーナーと相談しながら乗り切りました。'), category: 'health', when: (s) => s.career.phase === 'pro' && s.career.proDebut },
    { text: '移動の飛行機の中で、英語の単語帳を開きました。', category: 'daily', when: (s) => s.career.phase === 'abroad' },
    { text: '敵地のスタジアムで、日本から来たファンに手を振られました。', category: 'fans', when: (s) => s.career.phase === 'abroad' },
  ]),
  ...lines('adult', ['adult'], [
    { text: '休みの日に、近所の公園でキャッチボールをしました。', category: 'baseballLife', when: playedBaseball },
    // (drinking only from 20 at the start of the year, the legal age in Japan for the whole year: before, the same meeting without it)
    { text: (s) => (s.age >= 20 ? '久しぶりに昔のチームメートと飲みに行きました。' : '久しぶりに昔のチームメートと集まり、ファミレスで遅くまで話し込みました。'), category: 'friends', when: playedBaseball },
    { text: 'テレビの高校野球中継を、最後まで見てしまいました。', category: 'baseballLife' },
    { text: '職場の野球好きと、ひいきの球団の話で盛り上がりました。', category: 'work', when: working },
    { text: '引っ越しで、古いグローブが段ボールから出てきました。', category: 'home', when: (s) => playedBaseball(s) && !!s.after && s.after.home !== 'parents' },
    { text: '健康診断で、体重について注意されました。', category: 'health', ages: [30, 64] },
    { text: '週末に、家族で温泉に行きました。', category: 'family', when: hasFamily },
  ]),
  ...lines('senior', ['senior'], [
    { text: '朝の散歩が日課になりました。', category: 'health' },
    { text: '孫にせがまれて、昔の試合の話をしました。', category: 'family', when: (s) => s.career.achievements.includes('孫') && playedBaseball(s) },
    { text: '膝が痛み、階段がつらくなりました。', category: 'health', ages: [70, 120] },
    { text: '同窓会で、昔のチームメートと再会しました。', category: 'friends', when: playedBaseball },
    { text: '庭の手入れに、時間を使うようになりました。', category: 'home' },
  ]),
]
