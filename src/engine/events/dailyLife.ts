import type { LifeState } from '../types.ts'
import { hasFlag, type EventSpec } from './spec.ts'
import { bestPosition, heightZ } from '../ability.ts'
import { heightAt, weightAt } from '../body.ts'
import { evaluate } from '../route/rating.ts'

// Baseball and everyday life while playing (PROJECT_PLAN §11.14): gear, supporters, rivals, ways of
// practising, the coach, away games and camps, results, the youth team, the position, school and friends,
// first love, the family's costs, sleep. Each has choices with different effects, outcomes that differ and
// follow-ups; the おまかせ choice and the happenings only set facts (spec.ts NEUTRAL_FORBIDDEN). The
// conditions use the player's ability, body, position and team where it makes sense. No team name
// appears in these texts. All texts are original.

const X = { extra: true, career: true } as const
const PLAY_PHASES = ['youth', 'jhs', 'hs', 'univ', 'company', 'indep']
const playing = (s: LifeState) => !!s.bb && PLAY_PHASES.includes(s.career.phase)
const adultPlaying = (s: LifeState) => !!s.bb && ['univ', 'company', 'indep', 'pro', 'proMinor'].includes(s.career.phase)
const role = (s: LifeState) => s.bb?.role
const strength = (s: LifeState) => s.bb?.teamStrength ?? 0
/** a student who left baseball (or never played), still in school */
const student = (s: LifeState) => !playing(s) && s.age < 22 && (s.age < 18 || s.job === '大学生')
const inSchool = (s: LifeState) => (playing(s) ? ['jhs', 'hs', 'univ'].includes(s.career.phase) : student(s))

export const DAILY_LIFE: EventSpec[] = [
  // ---------------------------------------------------------------- gear
  {
    ...X,
    id: 'x.gear.glove',
    category: 'gear',
    stages: ['youth', 'jhs', 'hs'],
    when: (s) => playing(s) && !hasFlag(s, 'gear.glove'),
    weight: 1.5,
    title: '新しいグラブ',
    body: '革が硬くなり、指のつけ根が破れかけています。買い替えの時期のようです。',
    auto: 2,
    choices: [
      {
        label: '店で、手になじむ一つをじっくり選ぶ',
        hint: '値は張るが、守備が安定しやすい',
        effects: { happy: 1, skill: { fielding: 0.1 } },
        outcomes: [
          { weight: 3, text: '店員と一緒に、ポケットの深さと革の硬さを確かめて選びました。初めての練習から、不思議と手に吸いつきました。', effects: { conf: 3, flag: 'gear.glove' }, follow: [{ id: 'x.gear.gloveCare', after: 1 }] },
          { weight: 1, text: '立派なグラブでしたが革が硬く、なじむまで半年ほどかかりました。', effects: { conf: -1, flag: 'gear.glove' } },
        ],
      },
      { label: '先輩のお下がりをもらう', hint: 'お金はかからない', effects: { rel: 3 }, outcomes: [{ text: '使い込まれた革のにおいがするグラブを譲ってもらい、先輩に何度もお礼を言いました。', effects: { flag: 'gear.glove' } }] },
      { label: '今のグラブを修理して使う', outcomes: [{ text: '革ひもを通し直して油を塗り、もう一年使うことにしました。', effects: { flag: 'gear.glove' } }] },
    ],
  },
  {
    ...X,
    id: 'x.gear.gloveCare',
    category: 'gear',
    stages: ['youth', 'jhs', 'hs'],
    followOnly: true,
    when: (s) => playing(s) && hasFlag(s, 'gear.glove'),
    outcomes: [
      { weight: 2, text: '毎晩の手入れが習慣になり、道具を大切にする姿勢を監督が褒めてくれました。', effects: { eval: 2, conf: 2 } },
      { weight: 1, text: '手入れを怠って革にカビが生え、ひどく叱られました。', effects: { eval: -2, conf: -2 } },
    ],
  },
  {
    ...X,
    id: 'x.gear.spikes',
    category: 'gear',
    stages: ['hs', 'univ', 'amateur'],
    when: (s) => adultPlaying(s) || s.career.phase === 'hs',
    weight: 3,
    cooldown: 3,
    maxPerLife: 2,
    title: 'スパイクの買い替え',
    body: 'スパイクの底がすり減り、雨の日には滑るようになりました。',
    auto: 2,
    choices: [
      {
        label: '足に合う高めの一足を選ぶ',
        flag: 'gear.premium',
        follow: [{ id: 'x.gear.spikesBack', after: 1, within: 3 }],
        hint: '走塁と守備の足元が安定する。出費は大きい',
        effects: { money: -4, skill: { speed: 0.1 }, conf: 1 },
        outcomes: [
          { weight: 3, text: '店で何度も試し履きをして選んだ一足は、踏み込みの感触がまるで違いました。', effects: { conf: 2 } },
          { weight: 1, text: '高い一足を選びましたが、靴ずれが治らず、慣らすのに苦労しました。', effects: { fatigue: 4 } },
        ],
      },
      {
        label: 'チームが用意してくれる品を使う',
        hint: '強いチームだけの選択',
        when: (s) => strength(s) >= 0.8,
        effects: { rel: 1 },
        outcomes: [{ text: 'チームの備品係から、サイズの合う一足を受け取りました。強いチームは、道具の面でも恵まれています。' }],
      },
      { label: '底を張り替えて、もう少し履く', outcomes: [{ text: '修理店で底を張り替えてもらい、同じスパイクでもう一シーズン戦うことにしました。' }] },
    ],
  },
  {
    ...X,
    id: 'x.gear.bat',
    category: 'gear',
    stages: ['hs', 'univ', 'amateur'],
    when: (s) => playing(s) && s.person.position !== 'P',
    weight: 3,
    cooldown: 3,
    maxPerLife: 2,
    title: 'バットを替える',
    body: '打球に力が伝わらず、バットが合っていないのかもしれないと思い始めました。',
    auto: 2,
    choices: [
      {
        label: '重く長いバットに替える',
        hint: '長打は増えるが、ミートは粗くなりがち',
        effects: { skill: { power: 0.15, contact: -0.08 } },
        outcomes: [
          { weight: 2, text: '重いバットを振り込むうち、打球が外野の頭を越えるようになりました。', effects: { conf: 3, flag: 'bat.heavy' }, follow: [{ id: 'x.gear.batResult', after: 1 }] },
          { weight: 1, text: '振り遅れが目立つようになり、軽いバットに戻すことになりました。', effects: { conf: -2 } },
        ],
      },
      {
        label: '軽く短いバットに替える',
        hint: '当てる技術が上がるが、飛距離は落ちる',
        effects: { skill: { contact: 0.15, power: -0.08 } },
        outcomes: [
          { weight: 2, text: '軽いバットで逆方向へ打つ練習を重ね、打率が安定しました。', effects: { conf: 3 } },
          { weight: 1, text: '当たりは増えたものの、打球が内野の頭を越えず、物足りなさが残りました。', effects: { conf: -1 } },
        ],
      },
      { label: '今のバットで振り方を直す', outcomes: [{ text: '道具は替えず、握りの位置とスイングの軌道を見直すことにしました。' }] },
    ],
  },
  {
    ...X,
    id: 'x.gear.batResult',
    category: 'gear',
    stages: ['hs', 'univ', 'amateur'],
    followOnly: true,
    when: (s) => playing(s) && hasFlag(s, 'bat.heavy'),
    outcomes: [
      { weight: 2, text: '一年かけて重いバットが体に合い、長打が目に見えて増えました。', effects: { skill: { power: 0.12 }, conf: 4 } },
      { weight: 1, text: '重さに腕が負け、肘に張りを感じるようになりました。', effects: { fatigue: 8, conf: -2 } },
    ],
  },
  // ---------------------------------------------------------------- supporters and rivals
  {
    ...X,
    id: 'x.fan.supporter',
    category: 'fans',
    stages: ['hs', 'univ', 'amateur', 'pro'],
    when: (s) => !!s.bb && s.career.phase !== 'youth' && (role(s) === 'starter' || role(s) === 'bench'),
    weight: (s) => 2 + Math.max(0, strength(s)),
    cooldown: 2,
    maxPerLife: 3,
    title: 'スタンドの声援',
    body: '試合のたびに、同じ人たちがスタンドで声を張り上げています。家族、同級生、近所の人、遠くから通うファンもいます。',
    auto: 1,
    choices: [
      {
        label: '試合のあと、応援してくれた人たちに挨拶に行く',
        hint: '縁が広がる。疲れているときは骨が折れる',
        effects: { rel: 3, fatigue: 3 },
        outcomes: [
          { weight: 3, text: '帰りの通路で頭を下げると、見知らぬ人が「次も見に来るよ」と声をかけてくれました。', effects: { conf: 3, happy: 2, flag: 'fan.regular' }, follow: [{ id: 'x.fan.letter', after: 1 }] },
          { weight: 1, text: '挨拶は短く済ませました。疲れで、ほとんど顔を覚えていません。', effects: { fatigue: 2 } },
        ],
      },
      { label: '集中を保ち、声援は気にしないようにする', outcomes: [{ text: '声援はありがたいと思いながらも、試合のことだけを考えて球場をあとにしました。' }] },
      { label: 'ファンに声をかけられても、そっけなく返す', effects: { rel: -2, eval: -1 }, outcomes: [{ text: '疲れていて愛想のいい返事ができず、帰りの電車で少し後悔しました。' }] },
    ],
  },
  {
    ...X,
    id: 'x.fan.letter',
    category: 'fans',
    stages: ['hs', 'univ', 'amateur', 'pro'],
    followOnly: true,
    when: (s) => !!s.bb && hasFlag(s, 'fan.regular'),
    outcomes: [
      { weight: 2, text: 'よく球場に来てくれる人から、短い手紙が届きました。「結果より、毎試合走っている姿が好きです」と書かれていました。', effects: { conf: 5, happy: 3 } },
      { weight: 1, text: '応援してくれていた人が、仕事の都合で球場に来られなくなったと聞きました。', effects: { happy: -1 } },
    ],
  },
  {
    ...X,
    id: 'x.rival.league',
    category: 'rival',
    stages: ['univ', 'amateur', 'pro'],
    when: (s) => adultPlaying(s) && !hasFlag(s, 'rival.league'),
    weight: 3,
    cooldown: 3,
    maxPerLife: 1,
    title: 'リーグで知られた相手',
    body: (s) => (s.person.position === 'P' ? 'リーグ屈指の強打者が、あなたの登板日を狙っているという話が耳に入りました。' : 'リーグで名前の通った投手が、次のカードの先発に決まりました。'),
    auto: 2,
    choices: [
      {
        label: '映像と記録を集めて、徹底的に研究する',
        hint: '勝負強くなるが、時間と体力を使う',
        effects: { eval: 2, fatigue: 5 },
        outcomes: [
          { weight: 2, text: '相手の癖を洗い出して臨んだ勝負で、狙いどおりの結果が出ました。', effects: { conf: 5, flag: 'rival.league' }, follow: [{ id: 'x.rival.reunion', after: 3, within: 6 }] },
          { weight: 1, text: '研究しすぎて、自分の形を崩してしまいました。相手に軽くあしらわれました。', effects: { conf: -4, flag: 'rival.league' }, follow: [{ id: 'x.rival.reunion', after: 3, within: 6 }] },
        ],
      },
      {
        label: '自分の形だけを信じて、真っ向勝負をする',
        effects: { conf: 2 },
        outcomes: [
          { weight: 1, text: '小細工なしの勝負は、内容で上回りました。試合のあと、相手が握手を求めてきました。', effects: { conf: 4, rel: 3, flag: 'rival.league' }, follow: [{ id: 'x.rival.reunion', after: 3, within: 6 }] },
          { weight: 1, text: '力勝負は完敗でした。悔しさが、次の冬の練習の火種になりました。', effects: { gain: 0.02, conf: -2, flag: 'rival.league' }, follow: [{ id: 'x.rival.reunion', after: 3, within: 6 }] },
        ],
      },
      { label: '相手のことは考えず、いつもの準備をする', outcomes: [{ text: '誰が相手でも、やることは変わりません。いつもの準備だけをして試合に入りました。', effects: { flag: 'rival.league' } }] },
    ],
  },
  {
    ...X,
    id: 'x.rival.reunion',
    category: 'rival',
    stages: ['univ', 'amateur', 'pro', 'adult'],
    followOnly: true,
    when: (s) => hasFlag(s, 'rival.league'),
    outcomes: [
      { weight: 2, text: 'あのとき対戦した相手と、別のグラウンドで再会しました。互いの近況を、時間を忘れて話しました。', effects: { rel: 3, happy: 3 } },
      { weight: 1, text: 'あの相手が現役をやめたと、人づてに聞きました。胸に小さな穴が開いたようでした。', effects: { happy: -2 } },
    ],
  },
  // ---------------------------------------------------------------- practice, body, coach
  {
    ...X,
    id: 'x.train.method',
    category: 'practiceMethod',
    stages: ['hs', 'univ', 'amateur'],
    when: playing,
    weight: 3,
    cooldown: 2,
    maxPerLife: 3,
    title: '練習のやり方を変える',
    body: '同じメニューを繰り返すうち、伸びが止まってきたと感じています。',
    auto: 3,
    choices: [
      {
        label: 'スマートフォンで自分の動きを撮り、見直す',
        hint: '癖に気づける。結果が出るまで時間がかかる',
        effects: { gain: 0.02, skill: { contact: 0.06, control: 0.06 } },
        outcomes: [
          { weight: 2, text: '撮った映像で、右肩が早く開く癖がはっきり見えました。修正に取りかかります。', effects: { flag: 'train.video', conf: 2 }, follow: [{ id: 'x.train.methodResult', after: 1 }] },
          { weight: 1, text: '映像を見るほど、気になる点が増えて混乱しました。', effects: { conf: -2 } },
        ],
      },
      {
        label: '体幹とバランスの練習を増やす',
        effects: { gain: 0.02, fatigue: 6, skill: { stamina: 0.06, fielding: 0.06 } },
        outcomes: [
          { weight: 2, text: '地味な体幹練習を続けるうち、軸がぶれにくくなってきました。', effects: { conf: 2, flag: 'train.core' }, follow: [{ id: 'x.train.methodResult', after: 1 }] },
          { weight: 1, text: '練習を増やしすぎて、疲れが抜けない週が続きました。', effects: { fatigue: 8 } },
        ],
      },
      { label: '走り込みと下半身の強化に絞る', effects: { gain: 0.02, fatigue: 8, skill: { speed: 0.1, stamina: 0.08 } }, outcomes: [{ text: '坂道ダッシュとスクワットを毎日の日課にし、脚が一回り太くなりました。', effects: { conf: 2 } }] },
      { label: '今のメニューを続ける', outcomes: [{ text: '焦らず、同じメニューを丁寧に続けることにしました。' }] },
    ],
  },
  {
    ...X,
    id: 'x.train.methodResult',
    category: 'practiceMethod',
    stages: ['hs', 'univ', 'amateur'],
    followOnly: true,
    when: (s) => playing(s) && (hasFlag(s, 'train.video') || hasFlag(s, 'train.core')),
    outcomes: [
      { weight: 2, text: '地道な見直しが形になり、試合での動きに無駄がなくなったと言われました。', effects: { gain: 0.03, conf: 4 } },
      { weight: 1, text: '見直した動きは、まだ試合の中では出てきません。我慢の時期が続きます。', effects: { conf: -1, gain: 0.01 } },
    ],
  },
  {
    ...X,
    id: 'x.train.body',
    category: 'bodyBuild',
    stages: ['hs', 'univ', 'amateur'],
    // the body against the build the position asks for: a tall, light player (above all a pitcher) is told to put on weight
    when: (s) => playing(s) && s.age >= 15 && heightZ(s) > -0.3 && weightAt(s) / Math.pow(heightAt(s) / 100, 2) < 20.3,
    weight: (s) => 2 + (s.person.position === 'P' ? 2 : 0) + Math.max(0, heightZ(s)),
    cooldown: 3,
    maxPerLife: 2,
    title: '細い体をどうするか',
    body: (s) => `身長は${Math.round(heightAt(s))}センチあるのに、体重が足りません。${s.person.position === 'P' ? '投げる球に体重が乗らないと指摘されました。' : '打球に力が伝わらないと指摘されました。'}`,
    auto: 2,
    choices: [
      {
        label: '食事の量を増やし、筋力トレーニングを始める',
        hint: '体ができれば球が変わるが、時間がかかる。疲れも出る',
        effects: { gain: 0.03, fatigue: 8, skill: { power: 0.12, velocity: 0.1 } },
        outcomes: [
          { weight: 3, text: '朝晩の丼飯と補食で、半年のあいだに体重が増えました。', effects: { conf: 3, flag: 'body.built' }, follow: [{ id: 'x.train.bodyResult', after: 1 }] },
          { weight: 1, text: '無理に食べて胃を壊し、食事そのものが苦痛になりました。', effects: { happy: -3, fatigue: 6 } },
        ],
      },
      {
        label: 'トレーナーや栄養士に相談してメニューを組む',
        hint: '安全だが、費用がかかる',
        effects: { money: -10, gain: 0.02, skill: { power: 0.08 } },
        outcomes: [{ text: '専門家の助言で、食事と練習を無理のない形に組み直しました。', effects: { conf: 2, flag: 'body.built' }, follow: [{ id: 'x.train.bodyResult', after: 1 }] }],
      },
      { label: '細い体のまま、技術で勝負する', outcomes: [{ text: '体の線は細いまま、身軽さと技術を武器にすることにしました。' }] },
    ],
  },
  {
    ...X,
    id: 'x.train.bodyResult',
    category: 'bodyBuild',
    stages: ['hs', 'univ', 'amateur'],
    followOnly: true,
    when: (s) => playing(s) && hasFlag(s, 'body.built'),
    outcomes: [
      { weight: 3, text: '一年たって、ユニフォームの肩まわりがきつくなりました。球の質が確かに変わっています。', effects: { gain: 0.03, conf: 4, skill: { velocity: 0.1 } } },
      { weight: 1, text: '体は大きくなったものの、動きが重く感じるようになりました。', effects: { conf: -2, skill: { speed: -0.1 } } },
    ],
  },
  {
    ...X,
    id: 'x.coach.trust',
    category: 'coachBond',
    stages: ['hs', 'univ', 'amateur'],
    when: (s) => playing(s) && (role(s) === 'starter' || role(s) === 'bench') && !hasFlag(s, 'coach.trust'),
    weight: 12,
    cooldown: 3,
    maxPerLife: 1,
    title: '監督に呼ばれる',
    body: '練習のあと、監督から「少し話そう」と声をかけられました。',
    auto: 1,
    choices: [
      {
        label: '進路や将来の希望を率直に話す',
        hint: '信頼されれば後押ししてもらえる。見る目は厳しくなる',
        effects: { eval: 3 },
        outcomes: [
          { weight: 3, text: '「そこまで考えているなら、手伝おう」と監督が言ってくれました。', effects: { rel: 3, conf: 3, flag: 'coach.trust' }, follow: [{ id: 'x.coach.letter', after: 1, within: 3 }] },
          { weight: 1, text: '「まず目の前の試合に集中しろ」と、話を切られました。', effects: { conf: -2 } },
        ],
      },
      { label: '指示に従う姿勢を見せる', outcomes: [{ text: '「はい」「分かりました」と答え、監督の話を最後まで聞きました。', effects: { flag: 'coach.listened' } }] },
      { label: '自分のやり方を主張する', hint: '個性は伝わるが、衝突しやすい', effects: { conf: 3, eval: -3, rel: -2 }, outcomes: [{ text: '自分の考えをはっきり伝えると、監督は黙って腕を組みました。' }] },
    ],
  },
  {
    ...X,
    id: 'x.coach.letter',
    category: 'coachBond',
    stages: ['hs', 'univ', 'amateur'],
    followOnly: true,
    when: (s) => !!s.bb && hasFlag(s, 'coach.trust'),
    outcomes: [
      { weight: 2, text: '監督が、進路先の関係者に電話をかけて、あなたのことを話してくれていたと知りました。', effects: { eval: 3, conf: 4, rel: 2 } },
      { weight: 1, text: '監督は推薦状を書いてくれましたが、「あとは自分の力だ」と念を押されました。', effects: { eval: 2, conf: 2 } },
    ],
  },
  // ---------------------------------------------------------------- away games, camps, results
  {
    ...X,
    id: 'x.trip.away',
    category: 'trip',
    stages: ['jhs', 'hs', 'univ', 'amateur'],
    when: (s) => playing(s) && s.career.phase !== 'youth',
    weight: 1.5,
    cooldown: 2,
    maxPerLife: 3,
    title: '遠征の夜',
    body: '遠方での試合のため、宿に泊まっています。消灯までの自由時間が残りました。',
    auto: 2,
    choices: [
      { label: '宿の食堂で、仲間と作戦を話し合う', flag: 'trip.meeting', follow: [{ id: 'x.trip.awayBack', after: 1, within: 3 }], effects: { rel: 3, eval: 1 }, outcomes: [{ text: '食堂のテーブルにメモを広げて、明日の守備位置とサインを確かめ合いました。', effects: { conf: 2 } }] },
      {
        label: '町を少し歩き、気分を変える',
        flag: 'trip.walk',
        follow: [{ id: 'x.trip.awayBack', after: 1, within: 3 }],
        hint: '気持ちが軽くなるが、門限に遅れることもある',
        effects: { happy: 3 },
        outcomes: [
          { weight: 3, text: '知らない町の商店街を仲間と歩き、コロッケを食べました。遠征のいい思い出になりました。', effects: { rel: 2 } },
          { weight: 1, text: 'つい長く歩きすぎ、門限ぎりぎりに戻って叱られました。', effects: { eval: -2 } },
        ],
      },
      { label: '早めに布団に入る', outcomes: [{ text: '同部屋の話し声を聞きながら、早めに眠りにつきました。' }] },
    ],
  },
  {
    ...X,
    id: 'x.trip.camp',
    category: 'trip',
    stages: ['hs', 'univ'],
    when: (s) => playing(s) && (s.career.phase === 'hs' || s.career.phase === 'univ'),
    weight: 3,
    cooldown: 2,
    maxPerLife: 2,
    title: '夏の合宿',
    body: '朝から晩まで練習が詰まった夏合宿が始まりました。三日目で、体力の限界を感じています。',
    auto: 2,
    choices: [
      {
        label: '歯を食いしばって全メニューをこなす',
        flag: 'camp.grit',
        follow: [{ id: 'x.trip.campBack', after: 1, within: 3 }],
        hint: '心身が鍛えられるが、故障の危険もある',
        effects: { gain: 0.02, fatigue: 14, eval: 2 },
        outcomes: [
          { weight: 3, text: '最終日、同じ部屋の全員で顔を見合わせて笑いました。やり切った実感が残りました。', effects: { conf: 5, rel: 3 } },
          { weight: 1, text: '最終日の前日に足首をひねり、残りのメニューを見学することになりました。', effects: { injury: 1, conf: -3 } },
        ],
      },
      { label: 'つらい日は、コーチに申告して軽めに調整する', flag: 'camp.adjust', follow: [{ id: 'x.trip.campBack', after: 1, within: 3 }], effects: { fatigue: 4, eval: 1 }, outcomes: [{ text: '正直に申告して、午後の走り込みを軽くしてもらいました。大きく崩れずに合宿を終えました。' }] },
      { label: 'ペースを守って最後まで乗り切る', outcomes: [{ text: '無理も手抜きもせず、決められたメニューを淡々とこなしました。' }] },
    ],
  },
  {
    ...X,
    id: 'x.game.afterLoss',
    category: 'afterGame',
    stages: ['hs', 'univ', 'amateur'],
    // after a tournament or a league season that ended without a title (this year's, or last year's still on his mind)
    when: (s) => playing(s) && (s.bb?.rec?.tournaments ?? []).some((t) => (t.age === s.age || t.age === s.age - 1) && t.result !== '優勝'),
    weight: 3,
    cooldown: 2,
    maxPerLife: 3,
    title: '負けた大会のあとで',
    body: '大会が終わってしばらくたちました。優勝には届かず、まだ気持ちの整理がつかないまま、一人で帰り道を歩いています。',
    auto: 2,
    choices: [
      {
        label: '悔しさを書き出して、次の課題をノートにまとめる',
        effects: { gain: 0.02, conf: 2 },
        outcomes: [
          { weight: 2, text: 'ノートの最初の一行に「ここで終わらない」と書きました。次の目標がはっきりしました。', effects: { eval: 2, flag: 'afterGame.note' }, follow: [{ id: 'x.game.noteBack', after: 1 }] },
          { weight: 1, text: '書き出すほどに悔しさが増しました。その夜は、なかなか眠れませんでした。', effects: { fatigue: 4 } },
        ],
      },
      { label: '仲間と食事に行って気持ちを切り替える', effects: { rel: 3, happy: 2 }, outcomes: [{ text: '誰かが馬鹿な話を始め、最後には全員で笑っていました。' }] },
      { label: '何も考えず、早く寝る', outcomes: [{ text: '今夜は何も考えないことにして、早めに床につきました。' }] },
    ],
  },
  {
    ...X,
    id: 'x.game.noteBack',
    category: 'afterGame',
    stages: ['hs', 'univ', 'amateur'],
    followOnly: true,
    when: (s) => playing(s) && hasFlag(s, 'afterGame.note'),
    outcomes: [
      { weight: 2, text: '引き出しの奥から、去年書いたノートが出てきました。課題の半分は、もう消えています。', effects: { conf: 4 } },
      { weight: 1, text: '去年のノートと同じ課題が、また書かれていました。簡単には変われないと苦笑いしました。', effects: { conf: -1, gain: 0.01 } },
    ],
  },
  // ---------------------------------------------------------------- selection, position, recruiters
  {
    ...X,
    id: 'x.rep.youth',
    category: 'selection',
    stages: ['jhs', 'hs', 'univ', 'amateur'],
    // only players the selectors can see: a good evaluation (ability, standing, record, body for the position)
    when: (s) => playing(s) && s.career.phase !== 'youth' && !hasFlag(s, 'rep.youth') && evaluate(s).total >= 0.9,
    weight: (s) => 1 + Math.max(0, evaluate(s).total - 0.9) * 2,
    maxPerLife: 1,
    title: '代表の選考会',
    // (the team by his age: U-15 in junior high, U-18 in high school; 日本代表, not the trademark of the top team: feedback r11 B7)
    body: (s) =>
      s.career.phase === 'jhs'
        ? 'U-15日本代表の選考会の案内が届きました。全国から、有望な中学生が集まります。'
        : s.career.phase === 'hs'
          ? 'U-18日本代表の選考会の案内が届きました。全国から、有望な高校生が集まります。'
          : '各地の有望な選手が集まる、代表チームの選考会の案内が届きました。',
    auto: 0,
    choices: [
      {
        label: '選考会に参加する',
        hint: '選ばれれば大きな経験になる。落選することもある',
        outcomes: [
          {
            weight: (s) => Math.max(0.2, evaluate(s).total - 0.6),
            text: '選考会の最終日、代表メンバーの名前に自分が入っていました。全国から集まった同世代と、同じユニフォームで戦います。',
            kind: 'big',
            key: true,
            effects: { flag: 'rep.youth' },
            follow: [{ id: 'x.rep.after', after: 1 }],
          },
          { weight: 1.2, text: '最終選考で名前は呼ばれませんでした。それでも、全国の同世代の力を間近で見ることができました。', effects: { flag: 'rep.seen' } },
        ],
      },
      { label: '怪我の予防を優先して、見送る', hint: '体は休まるが、全国の目に触れる機会を逃す', effects: { fatigue: -12, conf: -1 }, outcomes: [{ text: '連戦が続いていたため、体を休めることを選びました。' }] },
    ],
  },
  {
    ...X,
    id: 'x.rep.after',
    category: 'selection',
    stages: ['hs', 'univ', 'amateur', 'pro', 'adult'],
    followOnly: true,
    when: (s) => hasFlag(s, 'rep.youth'),
    outcomes: [
      { weight: 2, text: '代表で一緒だった選手たちとは、今も連絡を取り合っています。同じ時間を過ごした仲間は、特別な存在です。', effects: { flag: 'rep.bond' } },
      { weight: 1, text: '代表の仲間の活躍を、ニュースで目にしました。励みにも、焦りにもなります。', effects: { flag: 'rep.spur' } },
    ],
  },
  {
    ...X,
    id: 'x.pos.view',
    category: 'positionTalk',
    stages: ['hs', 'univ', 'amateur'],
    // somebody who watches him says that the body and skills suit another position better (the fit, height only tilting it)
    when: (s) => playing(s) && s.age >= 15 && bestPosition(s).pos !== s.person.position && bestPosition(s).gain >= 0.1 && !hasFlag(s, 'pos.talked'),
    weight: 6,
    maxPerLife: 1,
    title: 'ポジションを変えないか',
    body: (s) => {
      const b = bestPosition(s).pos
      const tall = heightZ(s) > 0.6 ? '身長を生かすなら' : heightZ(s) < -0.6 ? '小柄な体と身のこなしを生かすなら' : '体つきと動きを見るかぎり'
      const name = { P: 'ピッチャー', C: 'キャッチャー', IF: '内野', OF: '外野' }[b]
      return `練習を見ていた指導者から、「${tall}、${name}のほうが向いている」と言われました。`
    },
    auto: 2,
    choices: [
      {
        label: '助言を受け入れて、ポジションを変える',
        hint: '合えば伸びるが、慣れるまで出番が減る',
        effects: { gain: -0.02, fatigue: 5, position: 'best' },
        outcomes: [
          { weight: 3, text: '新しいポジションでの練習が始まりました。最初はぎこちなくても、体が自然に動く感覚があります。', effects: { conf: 2, flag: 'pos.talked' }, follow: [{ id: 'x.pos.settle', after: 1 }] },
          { weight: 1, text: '慣れないポジションで失敗が続き、出番が減りました。', effects: { conf: -4, eval: -2, flag: 'pos.talked' }, follow: [{ id: 'x.pos.settle', after: 1 }] },
        ],
      },
      { label: '今のポジションを貫き、弱点を補う', hint: '得意を磨くことで評価される', effects: { gain: 0.01, conf: 2 }, outcomes: [{ text: '「このポジションで勝負する」と決めて、足りない点の練習を増やしました。', effects: { flag: 'pos.talked' } }] },
      { label: '特に何も決めず、様子を見る', outcomes: [{ text: '助言には礼を言い、そのまま練習に戻りました。', effects: { flag: 'pos.talked' } }] },
    ],
  },
  {
    ...X,
    id: 'x.pos.settle',
    category: 'positionTalk',
    stages: ['hs', 'univ', 'amateur'],
    followOnly: true,
    when: (s) => playing(s) && hasFlag(s, 'pos.talked'),
    outcomes: [
      { weight: 2, text: 'ポジションに慣れ、守りの動きに迷いがなくなりました。使われ方が変わったと感じています。', effects: { conf: 4, eval: 3 } },
      { weight: 1, text: '一年たっても、新しいポジションはしっくりきません。気持ちが揺れています。', effects: { conf: -2 } },
    ],
  },
  {
    ...X,
    id: 'x.hs.visit',
    category: 'recruit',
    stages: ['hs'],
    // a third-year the universities may look at: a standing, or at least a club that is not tiny
    when: (s) => s.career.phase === 'hs' && !!s.bb && s.career.phaseYears >= 2 && !hasFlag(s, 'hs.visitUniv') && evaluate(s).total >= 0.2,
    // (the third year is crowded with the school's own events: a higher weight, so that it is met in about a fifth of the lives)
    weight: 80,
    maxPerLife: 1,
    title: '大学の練習会',
    body: '進路先の候補にしている大学から、練習会への参加を誘われました。',
    auto: 2,
    choices: [
      {
        label: '練習会に参加して、実力を見てもらう',
        hint: '評価につながるが、力不足を知ることもある',
        effects: { fatigue: 4 },
        outcomes: [
          { weight: 2, text: '練習会で、大学の監督が何度もあなたのプレーに目を留めていました。', effects: { conf: 4, flag: 'hs.visitUniv' } },
          { weight: 1, text: '練習会の周りは自分よりずっと上手な選手ばかりでした。通用しない点が見つかりました。', effects: { conf: -3, gain: 0.02, flag: 'hs.visitUniv' } },
        ],
      },
      { label: '受験勉強を優先して、見送る', hint: '一般入試に向けて学力を伸ばす', effects: { know: 3 }, outcomes: [{ text: '練習会の日は、図書館で過去問を解いて過ごしました。' }] },
      { label: '当日の体調を見て決める', outcomes: [{ text: '当日の朝まで決めず、体調を見ながら周りの様子をうかがいました。', effects: { flag: 'hs.visitUndecided' } }] },
    ],
  },
  // ---------------------------------------------------------------- school, friends, love, family
  {
    ...X,
    id: 'x.study.exam',
    category: 'studyLife',
    stages: ['jhs', 'hs', 'student', 'univ', 'adult'],
    when: (s) => inSchool(s) && s.age >= 12,
    weight: 1.5,
    cooldown: 2,
    maxPerLife: 3,
    title: '試験前の一週間',
    body: (s) => (playing(s) ? '部活の練習と、定期試験の勉強が重なりました。' : '定期試験が近づいてきました。'),
    auto: 2,
    choices: [
      {
        label: '練習や遊びを減らして、勉強に集中する',
        flag: 'study.focus',
        follow: [{ id: 'x.study.examBack', after: 1, within: 3 }],
        hint: '成績は上がる。体はなまる',
        effects: { know: 4, fatigue: -4 },
        outcomes: [
          { weight: 3, text: '夜の机に向かう日々が続き、試験で目標どおりの点が取れました。', effects: { conf: 1, happy: 2 } },
          { weight: 1, text: '詰め込みすぎて、肝心の試験当日に寝不足で頭が働きませんでした。', effects: { happy: -2 } },
        ],
      },
      {
        label: '睡眠を削って、練習も勉強も両方やる',
        flag: 'study.both',
        follow: [{ id: 'x.study.examBack', after: 1, within: 3 }],
        hint: '無理がきく若さの賭け',
        effects: { know: 2, fatigue: 8 },
        outcomes: [
          { weight: 1, text: '両方をやり切り、試験も練習も満足のいく結果で終わりました。', effects: { conf: 3, happy: 3 } },
          { weight: 2, text: '寝不足がたたり、練習で集中が切れて打球を見失いました。', effects: { conf: -2, fatigue: 4 } },
        ],
      },
      { label: 'いつもどおりに過ごす', outcomes: [{ text: '特別なことはせず、授業の復習と普段の練習を続けました。' }] },
    ],
  },
  {
    ...X,
    id: 'x.study.language',
    category: 'studyLife',
    stages: ['hs', 'student', 'univ', 'adult'],
    when: (s) => inSchool(s) && s.age >= 15 && !hasFlag(s, 'study.english'),
    weight: 2,
    maxPerLife: 1,
    title: '英語の勉強を始めるか',
    body: '野球の動画や海外の選手の記事で、英語に触れる機会が増えました。',
    auto: 1,
    choices: [
      {
        label: '毎日少しずつ、英語の勉強を続ける',
        hint: '時間を取られるが、海外へ進む道が開く',
        effects: { know: 3, fatigue: 2 },
        outcomes: [
          { weight: 3, text: '朝の通学時間にリスニングを続けるうち、短い会話が聞き取れるようになりました。', effects: { flag: 'study.english', conf: 2 } },
          { weight: 1, text: '勉強は続きましたが、練習の疲れで長続きしませんでした。', effects: { happy: -1 } },
        ],
      },
      { label: '野球と学校の勉強で手いっぱいなので、やらない', outcomes: [{ text: '英語は後回しにして、いまはやるべきことに集中することにしました。' }] },
    ],
  },
  {
    ...X,
    id: 'x.friend.trouble',
    category: 'friendship',
    stages: ['jhs', 'hs', 'student', 'univ'],
    when: (s) => inSchool(s) && s.age >= 12,
    weight: 1.5,
    cooldown: 3,
    maxPerLife: 2,
    title: '仲のいい友人との行き違い',
    body: '同じクラスの友人と、些細なことで気まずくなってしまいました。何日も口をきいていません。',
    auto: 2,
    choices: [
      {
        label: '自分から声をかけて謝る',
        flag: 'friend.apologized',
        follow: [{ id: 'x.friend.troubleBack', after: 1, within: 3 }],
        hint: '関係は戻りやすい。気まずさは残る',
        effects: { rel: 2 },
        outcomes: [
          { weight: 3, text: '「ごめん、言いすぎた」と言うと、相手も「俺もだ」と笑ってくれました。', effects: { rel: 4, happy: 3 } },
          { weight: 1, text: '謝ったものの、相手の態度はぎこちないままでした。', effects: { happy: -2 } },
        ],
      },
      { label: 'しばらく距離を置いて、相手の出方を見る', flag: 'friend.distance', follow: [{ id: 'x.friend.troubleBack', after: 1, within: 3 }], effects: { rel: -2 }, outcomes: [{ text: '話しかけるきっかけが見つからないまま、日が過ぎていきました。', effects: { happy: -2 } }] },
      { label: '気にしないふりをして、普段どおり過ごす', outcomes: [{ text: 'いつもの調子で他の友人と過ごすうち、いつの間にか自然に話せるようになりました。' }] },
    ],
  },
  {
    ...X,
    id: 'x.love.confess',
    category: 'loveLife',
    stages: ['hs', 'student', 'univ', 'adult'],
    ages: [15, 26],
    when: (s) => (inSchool(s) || s.age <= 26) && !hasFlag(s, 'love.first') && !s.family.partner && !s.family.spouse,
    weight: 2,
    maxPerLife: 1,
    title: '気になる人',
    body: '同じ学校（職場）の、話しやすい人のことが気になるようになりました。',
    auto: 1,
    choices: [
      {
        label: '思い切って気持ちを伝える',
        hint: '受け入れられれば励みになる。断られれば落ち込む',
        outcomes: [
          { weight: 2, text: '勇気を出して気持ちを伝えると、「私も」と返事をもらえました。野球以外に、会いたい人ができました。', kind: 'good', effects: { happy: 6, rel: 3, flag: 'love.first' }, follow: [{ id: 'x.love.distance', after: 2, within: 4 }] },
          { weight: 2, text: '「ごめんなさい」と断られました。しばらく何も手につきませんでした。', kind: 'bad', effects: { happy: -5, conf: -2 } },
        ],
      },
      { label: '友人のままでいる', outcomes: [{ text: '今の距離感が心地よく、特に何も言わずにいつもどおり話しました。' }] },
    ],
  },
  {
    ...X,
    id: 'x.love.distance',
    category: 'loveLife',
    stages: ['hs', 'univ', 'amateur', 'pro', 'adult'],
    followOnly: true,
    when: (s) => hasFlag(s, 'love.first') && !s.family.spouse,
    outcomes: [
      { weight: 2, text: '進む道が分かれても、毎週のビデオ通話を欠かさず、関係は続いています。', effects: { happy: 4, rel: 3 } },
      { weight: 2, text: '会える時間が減り、すれ違いが重なって、自然に連絡が途絶えました。', effects: { happy: -3 } },
    ],
  },
  {
    ...X,
    id: 'x.family.cost',
    category: 'familyMoney',
    stages: ['jhs', 'hs', 'univ'],
    when: (s) => playing(s) && s.career.phase !== 'youth' && s.person.wealth <= 3,
    weight: (s) => 2 + (3 - s.person.wealth),
    cooldown: 3,
    maxPerLife: 2,
    title: '野球にかかるお金',
    body: '遠征費や用具代、食事の補助など、野球には思った以上にお金がかかります。親が何も言わずに工面してくれていることに気づきました。',
    auto: 2,
    choices: [
      {
        label: 'アルバイトを始めて、少しでも負担を減らす',
        hint: '親は助かるが、練習の時間と体力が減る',
        effects: { money: 15, fatigue: 8, rel: 2 },
        outcomes: [
          { weight: 2, text: '休みの日に、近所のコンビニで働き始めました。初めての給料は、まず親への感謝に使いました。', effects: { happy: 3, eval: -1 } },
          { weight: 1, text: '仕事が忙しくなり、練習に遅れる日が増えて、監督に注意されました。', effects: { eval: -3, conf: -2 } },
        ],
      },
      { label: '奨学金や学費の支援制度を調べる', hint: '手続きに時間がかかるが、長く効く', effects: { know: 2, money: 5 }, outcomes: [{ text: '学校の先生に相談して、返済のいらない給付型の支援制度に申し込みました。', effects: { happy: 2, flag: 'family.support' }, follow: [{ id: 'x.family.supportBack', after: 1, within: 3 }] }] },
      { label: '親に感謝して、そのまま野球に打ち込む', outcomes: [{ text: '「頑張りなさい」とだけ言う親に、結果で応えようと誓いました。' }] },
    ],
  },
  {
    ...X,
    id: 'x.family.supportBack',
    category: 'familyMoney',
    stages: ['jhs', 'hs', 'univ', 'student', 'adult'],
    followOnly: true,
    when: (s) => hasFlag(s, 'family.support'),
    outcomes: [
      { weight: 2, text: '申し込んだ給付型の支援が決まり、通知が届きました。親と並んで読んで、肩の力が抜けました。', effects: { money: 40, happy: 4, rel: 2 } },
      { weight: 1, text: '支援の審査には通りませんでした。親が「別の方法を考えよう」と言ってくれました。', effects: { happy: -2, rel: 2 } },
    ],
  },
  {
    ...X,
    id: 'x.health.sleep',
    category: 'bodyCare',
    stages: ['jhs', 'hs', 'univ', 'amateur', 'pro'],
    when: (s) => !!s.bb && ['jhs', 'hs', 'univ', 'company', 'indep', 'pro', 'proMinor'].includes(s.career.phase) && s.bb.fatigue >= 45,
    weight: 10,
    cooldown: 2,
    maxPerLife: 3,
    title: '眠りと疲れ',
    body: '朝になっても疲れが抜けません。最近、夜遅くまで起きていることが続いています。',
    auto: 2,
    choices: [
      {
        label: '生活のリズムを整える。夜は早く寝る',
        flag: 'sleep.routine',
        follow: [{ id: 'x.health.sleepBack', after: 1, within: 3 }],
        hint: '調子が戻る。夜の自由時間は減る',
        effects: { fatigue: -15, happy: -1 },
        outcomes: [
          { weight: 3, text: '就寝時間を決めて守るうち、朝の体が軽くなりました。', effects: { conf: 2, health: 1 } },
          { weight: 1, text: '早く寝ようとしても、気持ちが高ぶってなかなか眠れませんでした。', effects: { fatigue: 4 } },
        ],
      },
      { label: '睡眠の質を上げる道具を買ってみる', flag: 'sleep.gadget', follow: [{ id: 'x.health.sleepBack', after: 1, within: 3 }], effects: { money: -3, fatigue: -8 }, outcomes: [{ text: '寝具を替えて、スマートフォンを枕元から離す習慣を作りました。' }] },
      { label: '気合いで乗り切る', outcomes: [{ text: '疲れは気のせいだと言い聞かせ、いつもどおり朝の練習に向かいました。' }] },
    ],
  },
]
