import type { LifeState } from '../../types.ts'
import type { EventSpec } from '../../events/spec.ts'
import { hasFamily, hasFlag } from '../../events/spec.ts'
import type { CountryCode } from '../../../data/types.ts'
import { livesIn } from '../index.ts'

// The events of Korea and Cuba (PROJECT_PLAN §11.46): daily life, the road of baseball, love and marriage, the family, money, and life after
// baseball. They are declarative specs of the same kind as the US's (events/spec.ts, countries/us/daily.ts), tied to the country he LIVES
// in (`lives`), drawn by the resident pass at the pace of the birth country's own draws, with the same limits and おまかせ answers (`auto`).
// What they change: money, happiness, relations, knowledge and flags only, never the calibrated career, the injuries or the death rate
// (none has `career: true`). The state of love (a partner, a spouse, children) is made by the shared yearly flow (usLifeYear), and these
// events ask for it. The sums are in 万円 on the scale of each country's household (after.ts HOUSEHOLDS: Korea 0.9, Cuba 0.2 of Japan's
// table). EVERY NUMBER AND EVERY CUSTOM HERE IS A GAME ASSUMPTION written from general knowledge, never a statistic or a statement of fact
// about the country (stats krModel, cuModel); the political and economic conditions are the game's model, not a claim. All texts are original.

const NONE = (label: string, text: string) => ({ label, outcomes: [{ text }] })
const ALL: EventSpec['stages'] = ['hs', 'univ', 'pro', 'adult', 'senior']
const ADULT: EventSpec['stages'] = ['adult', 'senior']

const partner = (s: LifeState) => !!s.family.partner && !s.family.spouse
const married = (s: LifeState) => !!s.family.spouse
const parentAlive = (s: LifeState) => s.family.father !== null || s.family.mother !== null
const kidsAtHome = (s: LifeState) => (s.family.kids ?? []).some((k) => k < 18)
const retiredPlayer = (s: LifeState) => s.career.endedAge !== null && s.career.highestRank >= 6 && !PLAYING.has(s.career.phase)
const PLAYING = new Set(['univ', 'company', 'indep', 'proMinor', 'pro', 'abroad'])
const inFirst = (s: LifeState) => s.career.phase === 'pro'

/** a spec of the country: tied to where he lives, with its subject (themes: one event of a subject a year) */
const make = (cc: CountryCode) => (spec: EventSpec, theme: string): EventSpec => ({ ...spec, lives: cc, theme, when: (s) => livesIn(s, cc) && (!spec.when || spec.when(s)) })

// ================================================================ Korea
const kr = make('KR')

export const KR_SPECS: EventSpec[] = [
  // ---------------------------------------------------------------- daily life (news: a line and no change)
  kr({ id: 'kr.news.cheer', category: 'krNews', stages: ['univ', 'pro'], weight: 1.3, cooldown: 4, maxPerLife: 3, outcomes: [{ text: '応援団長の掛け声に合わせて、スタンド全体が応援歌を歌いました。選手の名前が、リズムに乗って球場に響きました。', kind: 'good' }] }, 'media'),
  kr({ id: 'kr.news.chimaek', category: 'krNews', stages: ALL, ages: [18, 80], weight: 1.2, cooldown: 4, maxPerLife: 3, outcomes: [{ text: '試合のあとは、仲間とチキンとビールを囲んで、その日のプレーを肴に語り合いました。', kind: 'normal' }] }, 'friends'),
  kr({ id: 'kr.news.exam', category: 'krNews', stages: ['hs'], ages: [16, 16], weight: 2, cooldown: 3, maxPerLife: 1, outcomes: [{ text: '大学入試の日、静まり返った朝の街で、受験生を乗せるために電車が増発され、先輩たちが校門で応援していました。', kind: 'normal' }] }, 'school'),
  kr({ id: 'kr.news.pcbang', category: 'krNews', stages: ['hs', 'univ'], weight: 1.1, cooldown: 4, maxPerLife: 2, outcomes: [{ text: '練習のあとの寄り道は、仲間と通ったネットカフェでした。夜遅くまで、画面の前で笑い合いました。', kind: 'normal' }] }, 'friends'),

  // ---------------------------------------------------------------- holidays and family customs
  kr({
    id: 'kr.daily.chuseok',
    category: 'krHoliday',
    stages: ALL,
    ages: [14, 90],
    when: (s) => parentAlive(s),
    weight: 1.6,
    cooldown: 3,
    maxPerLife: 4,
    title: '秋夕（チュソク）の帰省',
    body: '秋の大きな連休の時期です。親戚が実家に集まり、先祖に感謝を捧げ、食卓を囲みます。移動の道は、どこも混みます。',
    auto: 2,
    choices: [
      { label: '実家に帰り、親戚と一緒に過ごす', hint: '交通費と手土産。約10万円', effects: { money: -10, rel: 3, happy: 2 }, outcomes: [{ text: '長い渋滞を越えて実家に着くと、祖母がチヂミを焼いて待っていました。親戚の子どもたちが、野球の話を聞きたがりました。' }] },
      { label: '贈り物と電話だけで済ませる', hint: '約5万円', effects: { money: -5, rel: 1 }, outcomes: [{ text: '果物の詰め合わせを送り、夜に電話をかけました。「無理をしないで」と、母が言いました。' }] },
      { label: '何もせず、予定どおり過ごす', outcomes: [{ text: '連休も、いつもどおりの日課を続けました。実家の食卓の話は、あとで聞くことにしました。' }] },
    ],
  }, 'holiday'),
  kr({
    id: 'kr.family.support',
    category: 'krFamily',
    stages: ['pro', 'adult', 'senior'],
    ages: [24, 70],
    when: (s) => parentAlive(s) && s.money >= 100,
    weight: 1.4,
    cooldown: 4,
    maxPerLife: 3,
    title: '親への孝行',
    body: '親の体が、少しずつ弱ってきました。生活費や医療費を、どう支えるか考える時期です。',
    auto: 2,
    choices: [
      { label: '毎月、決まった額を仕送りする', hint: '約40万円（年）', effects: { money: -40, rel: 2, happy: 2 }, outcomes: [{ text: '毎月の仕送りに、母から「ありがとう」の短い手紙が届くようになりました。' }] },
      { label: '病院の検査を、一緒に受けに行く', hint: '約20万円', effects: { money: -20, rel: 2, know: 1 }, outcomes: [{ text: '二人で検査を受けた帰りに、昔の試合の話をしながら、食堂でクッパを食べました。' }] },
      NONE('今は、お金の面は様子を見る', '親の様子は電話で聞くだけにして、支援は、もう少し先に延ばしました。'),
    ],
  }, 'family'),
  kr({
    id: 'kr.love.greeting',
    category: 'krLove',
    stages: ['univ', 'pro', 'adult'],
    when: (s) => partner(s),
    weight: 2,
    cooldown: 3,
    maxPerLife: 2,
    title: '両親へのあいさつ',
    body: '交際している人の両親に、あいさつをする時期になりました。野球の仕事のことを、どう伝えたらいいか迷っています。',
    auto: 0,
    choices: [
      { label: '手土産を持って、正式にあいさつに行く', hint: '約15万円', flag: 'kr.greeted', effects: { money: -15, rel: 3, happy: 2 }, outcomes: [{ weight: 2, text: '緊張で手が汗ばんでいましたが、お父さんが野球好きで、話が弾みました。' }, { weight: 1, text: '仕事の安定について、遠回しな質問をいくつも受けましたが、誠実に答えました。', effects: { know: 1 } }] },
      NONE('もう少し先にする', 'あいさつは、シーズンが落ち着いてからにすることにしました。'),
    ],
  }, 'love'),
  kr({
    id: 'kr.love.wedding',
    category: 'krLove',
    stages: ['pro', 'adult'],
    when: (s) => married(s) && s.family.spouse!.years <= 1,
    weight: 6,
    cooldown: 1,
    maxPerLife: 1,
    title: '結婚式と祝い金',
    body: '結婚式の準備です。招待客の数も、式場の大きさも、周りの目も気になります。',
    auto: 1,
    choices: [
      { label: '式場で、親族と仲間を招いて式を挙げる', hint: '約300万円（ご祝儀が一部戻る）', when: (s) => s.money >= 320, effects: { money: -300, happy: 5, rel: 4 }, outcomes: [{ text: '式場は、チームの仲間と親戚でいっぱいになりました。ご祝儀の袋を数える夜が、最後の仕事でした。', effects: { money: 120 } }] },
      { label: '小さな式と、家族だけの食事にする', hint: '約60万円', when: (s) => s.money >= 80, effects: { money: -60, happy: 3, rel: 2 }, outcomes: [{ text: '近しい人だけを呼んだ静かな式でした。二人の笑顔の写真が、いちばんの記念になりました。' }] },
      NONE('式は、落ち着いてから考える', '式は先送りにして、入籍だけを済ませることにしました。'),
    ],
  }, 'family'),
  kr({
    id: 'kr.family.tutor',
    category: 'krFamily',
    stages: ['pro', 'adult'],
    when: (s) => kidsAtHome(s),
    weight: 1.7,
    cooldown: 3,
    maxPerLife: 3,
    title: '子どもの塾',
    body: '子どもの友だちが、次々と放課後の学習塾（ハグォン）に通い始めました。わが家も、どうするか迷っています。',
    auto: 2,
    choices: [
      { label: '塾と習い事を増やす', hint: '約80万円（年）', when: (s) => s.money >= 120, effects: { money: -80, know: 1, rel: 1 }, outcomes: [{ weight: 2, text: '塾から帰る子どもの鞄は重くなりましたが、成績表の数字は少しずつ上がりました。' }, { weight: 1, text: '週の予定が塾で埋まり、子どもが「友だちと遊ぶ時間がない」とこぼしました。', effects: { happy: -1 } }] },
      { label: '家で一緒に勉強し、塾は絞る', hint: '約20万円', effects: { money: -20, rel: 3 }, outcomes: [{ text: '夕食のあとの一時間は、子どもの宿題を一緒に見る時間になりました。' }] },
      NONE('子どもの希望を聞いてから決める', '子どもが何をやりたいか、ゆっくり聞いてから決めることにしました。'),
    ],
  }, 'school'),
  kr({
    id: 'kr.money.jeonse',
    category: 'krMoney',
    stages: ['pro', 'adult'],
    ages: [26, 50],
    when: (s) => !!s.after && s.after.home !== 'own' && s.money >= 800,
    weight: 1.3,
    cooldown: 6,
    maxPerLife: 2,
    title: '住まいの保証金（チョンセ）',
    body: '大きな保証金を家主に預ければ、月々の家賃のかからない部屋に住める仕組みがあります。貯金の大半を、預けることになります。',
    auto: 2,
    choices: [
      { label: '保証金を預けて、部屋を借りる', hint: '約800万円（戻ることが前提）', effects: { money: -800, happy: 2, home: 'rent' }, follow: [{ id: 'kr.money.jeonseBack', after: 4, within: 6 }], outcomes: [{ text: '大きな額を振り込み、新しい部屋の鍵を受け取りました。しばらくは、家賃の心配がいりません。' }] },
      { label: '月払いの賃貸で、貯金は手元に残す', hint: '約40万円（年の追加）', effects: { money: -40, home: 'rent' }, outcomes: [{ text: '毎月の家賃は重くなりましたが、貯金はそのまま、手元に残りました。' }] },
      NONE('今は、今の住まいのままにする', '引っ越しは見送り、今の住まいに住み続けることにしました。'),
    ],
  }, 'home'),
  kr({
    id: 'kr.money.jeonseBack',
    category: 'krMoney',
    stages: ['pro', 'adult', 'senior'],
    followOnly: true,
    outcomes: [
      { weight: 3, text: '契約の満期を迎え、預けた保証金が全額戻ってきました。', effects: { money: 800, happy: 2 } },
      { weight: 1, text: '家主の事情で、保証金の返還が遅れました。数か月の交渉の末に戻りましたが、気をもむ日々でした。', effects: { money: 760, happy: -2 } },
    ],
  }, 'money'),

  // ---------------------------------------------------------------- the road of baseball
  kr({
    id: 'kr.base.lesson',
    category: 'krBase',
    stages: ['hs', 'univ'],
    ages: [14, 20],
    weight: 1.6,
    cooldown: 3,
    maxPerLife: 2,
    title: '元プロの個人指導',
    body: '元プロ選手が開いている個人レッスンの評判を聞きました。母は費用を気にしていますが、ドラフトを見すえるなら受けておきたい気持ちもあります。',
    auto: 2,
    choices: [
      { label: '個人レッスンに通う', hint: '家族の負担。約60万円（年）', effects: { conf: 3, know: 2, happy: 1 }, outcomes: [{ text: '元プロの指摘で、バットの出し方を直しました。映像で見ると、自分のフォームの癖がよく分かりました。' }] },
      { label: '先輩に頼んで、無料で教えてもらう', effects: { rel: 2, know: 1 }, outcomes: [{ text: '先輩が練習のあとに、ティー打撃に付き合ってくれました。その代わり、後片付けは自分の役目でした。' }] },
      NONE('部の練習に専念する', '個人指導は受けず、部の練習を丁寧にこなすことにしました。'),
    ],
  }, 'trainer'),
  kr({
    id: 'kr.base.scout',
    category: 'krBase',
    stages: ['hs', 'univ'],
    ages: [15, 20],
    when: (s) => s.career.highestRank >= 3,
    weight: 1.4,
    cooldown: 3,
    maxPerLife: 2,
    title: 'スカウトの視察',
    body: '練習試合に、プロ球団のスカウトが来ているという話が広がりました。スタンドの端で、メモを取る人が見えます。',
    auto: 1,
    choices: [
      { label: '力を入れて、積極的にアピールする', effects: { conf: -1, rel: 1 }, outcomes: [{ weight: 1, text: '力みすぎて空振りが続きましたが、最後の打席で外野の間を破りました。', effects: { conf: 3 } }, { weight: 1, text: '力みが空回りし、悔しさだけが残りました。', effects: { happy: -2 } }] },
      { label: 'いつものプレーを、いつも通りに', effects: { conf: 2 }, outcomes: [{ text: '視線を気にせず、いつもの動きに集中しました。試合のあとの握手の手は、少し汗ばんでいました。' }] },
      NONE('視察のことは、気にしないようにする', 'スカウトのことは考えないようにして、目の前の一球に集中しました。'),
    ],
  }, 'fans'),
  kr({
    id: 'kr.base.fans',
    category: 'krBase',
    stages: ['pro'],
    when: (s) => inFirst(s),
    weight: 1.6,
    cooldown: 4,
    maxPerLife: 3,
    title: 'ファンとの時間',
    body: '球団が、オフにファンとの交流会を開きます。サイン会や握手会の予定が詰まっています。',
    auto: 1,
    choices: [
      { label: '最後まで残って、一人ひとりと話す', effects: { rel: 4, happy: 2 }, outcomes: [{ text: '最後に並んでいた子どもが、「次の試合も絶対に見に行きます」と言って、帽子を差し出しました。' }] },
      { label: '予定の時間だけ参加する', effects: { rel: 1 }, outcomes: [{ text: '予定の時間にきっちり参加して、短い言葉を交わしました。' }] },
      { label: '自主トレを優先して、欠席する', effects: { rel: -2, conf: 2 }, outcomes: [{ text: '欠席の連絡を入れ、トレーニング施設で汗を流しました。ファンクラブの掲示板は、少しざわつきました。' }] },
    ],
  }, 'media'),
  kr({
    id: 'kr.base.commercial',
    category: 'krBase',
    stages: ['pro'],
    when: (s) => inFirst(s) && s.career.highestRank >= 8 && s.career.proSeasons >= 2,
    weight: 1.1,
    cooldown: 5,
    maxPerLife: 2,
    title: 'CMの出演依頼',
    body: '飲料メーカーから、CMへの出演依頼が来ました。撮影は数日で、謝礼もありますが、練習時間は削られます。',
    auto: 2,
    choices: [
      { label: '出演して、謝礼を受け取る', effects: { money: 150, rel: 2 }, outcomes: [{ text: '撮影は思ったより長く、何度も同じ笑顔を作りました。放送された映像を見た友人が、笑っていました。' }] },
      { label: '野球に専念するため、断る', effects: { conf: 2 }, outcomes: [{ text: '丁寧に断りの返事を書き、練習に戻りました。' }] },
      NONE('球団と相談してから決める', '球団の広報と相談し、返事は少し待ってもらうことにしました。'),
    ],
  }, 'media'),
  kr({
    id: 'kr.base.fa',
    category: 'krBase',
    stages: ['pro'],
    ages: [27, 40],
    when: (s) => inFirst(s) && s.career.proSeasons >= 8,
    weight: 1.8,
    cooldown: 4,
    maxPerLife: 2,
    title: 'FAの資格を得て',
    body: 'FAの資格を得ました。残留すれば安心ですが、他球団からの誘いもあります。',
    auto: 1,
    choices: [
      { label: '他球団の誘いを、じっくり聞いてみる', effects: { money: 120, know: 1, rel: -1 }, outcomes: [{ text: '何球団かの担当者と会い、条件を並べて比べました。慣れた球団を離れる寂しさが、決断を重くしました。' }] },
      { label: '残留して、長期の契約を結ぶ', effects: { money: 60, rel: 2, happy: 2 }, outcomes: [{ text: '慣れた球団と、長期の契約を結びました。ロッカーの名札は、そのままでした。' }] },
      NONE('結論は、シーズンが終わってから出す', '返事は保留にして、まず今シーズンを全力で戦うことにしました。'),
    ],
  }, 'work'),
  kr({
    id: 'kr.base.dormitory',
    category: 'krBase',
    stages: ['pro'],
    when: (s) => s.career.phase === 'proMinor',
    weight: 1.5,
    cooldown: 4,
    maxPerLife: 2,
    title: '2軍の寮の暮らし',
    body: '2軍の寮では、先輩と相部屋です。門限と掃除の当番、練習のあとの食堂の長い列が日課です。',
    auto: 1,
    choices: [
      { label: '先輩の洗濯や雑用も、進んで引き受ける', effects: { rel: 3, happy: -1 }, outcomes: [{ text: '雑用を引き受けるうちに、先輩が打撃のコツを教えてくれるようになりました。' }] },
      { label: '自分の役目だけを、きちんとこなす', effects: { rel: 1 }, outcomes: [{ text: '役目を丁寧に済ませ、空いた時間は自分の練習にあてました。' }] },
      { label: '寮を出て、外に部屋を借りる', hint: '約60万円（年）', when: (s) => s.money >= 100, effects: { money: -60, happy: 2, rel: -1 }, outcomes: [{ text: '寮を出て、小さなワンルームを借りました。静かな夜は、思ったより落ち着きました。' }] },
    ],
  }, 'teammates'),

  // ---------------------------------------------------------------- after baseball
  kr({
    id: 'kr.after.chicken',
    category: 'krAfter',
    stages: ADULT,
    ages: [30, 60],
    when: (s) => retiredPlayer(s) && !hasFlag(s, 'kr.shop') && s.money >= 700,
    weight: 1.6,
    cooldown: 6,
    maxPerLife: 1,
    title: '店を開く',
    body: '現役を退いた元選手が、チキン店や飲食店を開くという話は、よく耳にします。知り合いが、居抜きの店を紹介してくれました。',
    auto: 2,
    choices: [
      { label: '貯金を使って、自分の店を開く', hint: '約600万円', effects: { money: -600, happy: 2 }, flag: 'kr.shop', follow: [{ id: 'kr.after.shopBack', after: 3, within: 6 }], outcomes: [{ text: '元選手の名前が書かれた看板を掲げて、開店しました。最初の日は、昔のファンが列を作りました。' }] },
      { label: '知り合いの店で、まず働いてみる', effects: { money: 20, know: 2 }, outcomes: [{ text: '知り合いの店で、仕込みと接客を一から覚えることにしました。' }] },
      NONE('別の仕事を探す', '店を開くことは見送り、ほかの仕事を探すことにしました。'),
    ],
  }, 'work'),
  kr({
    id: 'kr.after.shopBack',
    category: 'krAfter',
    stages: ADULT,
    followOnly: true,
    when: (s) => hasFlag(s, 'kr.shop'),
    outcomes: [
      { weight: 2, text: '店は常連客に支えられ、数年たって、安定した売り上げになりました。', effects: { money: 700, happy: 3 } },
      { weight: 2, text: '最初の数年は忙しさのわりに利益が少なく、なんとか黒字になるところまで、続けました。', effects: { money: 250, happy: 1 } },
      { weight: 1, text: '近くに競合店が増え、売り上げが落ちて、店を畳むことになりました。', effects: { money: -150, happy: -4 }, kind: 'bad' },
    ],
  }, 'money'),
  kr({
    id: 'kr.after.coach',
    category: 'krAfter',
    stages: ADULT,
    ages: [28, 65],
    when: (s) => retiredPlayer(s) && !hasFlag(s, 'kr.coached'),
    weight: 1.6,
    cooldown: 5,
    maxPerLife: 1,
    title: '指導者の誘い',
    body: '母校や球団の知り合いから、コーチとして若い選手を教えないかという誘いが来ました。収入は多くありませんが、野球の世界にとどまれます。',
    auto: 2,
    choices: [
      { label: '母校の野球部のコーチになる', hint: '収入は少なめ', flag: 'kr.coached', effects: { money: 60, rel: 3, happy: 3 }, outcomes: [{ text: '後輩に基本から教えるうちに、自分の現役時代の癖にも気づきました。', effects: { know: 2 } }] },
      { label: '球団のスカウトとして、地方を回る', hint: '出張が多い', flag: 'kr.coached', effects: { money: 120, rel: 1, know: 2 }, outcomes: [{ text: '高校や大学を回り、才能のある選手を探す日々が始まりました。' }] },
      NONE('野球とは別の仕事を続ける', 'いまの仕事を続けることにして、誘いには丁寧に断りの返事をしました。'),
    ],
  }, 'secondCareer'),
  kr({
    id: 'kr.after.talk',
    category: 'krAfter',
    stages: ADULT,
    ages: [35, 70],
    when: (s) => married(s) && s.family.children > 0,
    weight: 1.3,
    cooldown: 5,
    maxPerLife: 2,
    title: '家族の老後の話',
    body: '子どもが大きくなり、夫婦でこれからの暮らしを話し合う時期になりました。年金だけで足りるのか、子どもに頼るのか。',
    auto: 2,
    choices: [
      { label: '貯金と年金を書き出して、計画を立てる', effects: { know: 2, rel: 2, happy: 1 }, outcomes: [{ text: '二人で通帳を並べ、毎月の支出を見直しました。数字が見えて、不安が少し軽くなりました。' }] },
      { label: '副業と貯蓄を、少しずつ増やす', effects: { money: -20, happy: 1 }, follow: [{ id: 'kr.after.talkBack', after: 4, within: 6 }], outcomes: [{ text: '空いた時間に小さな副業を始め、毎月の積み立ても少し増やしました。' }] },
      NONE('そのときになってから考える', '老後の話は、また今度ゆっくりしようと、話を終えました。'),
    ],
  }, 'family'),
  kr({
    id: 'kr.after.talkBack',
    category: 'krAfter',
    stages: ADULT,
    followOnly: true,
    outcomes: [
      { weight: 2, text: '数年続けた積み立てと副業が、老後の備えとして、目に見える額になりました。', effects: { money: 160, happy: 2 } },
      { weight: 1, text: '副業は思うように続かず、積み立てだけが、細々と残りました。', effects: { money: 40 } },
    ],
  }, 'money'),
]

// ================================================================ Cuba
const cu = make('CU')
const abroad = (s: LifeState) => s.flags?.['cu.mlb'] !== undefined
// (a Cuban who has gone abroad lives in the US: his own events are tied to the US and asked for by the flag)
const cuAbroad = make('US')

export const CU_SPECS: EventSpec[] = [
  // ---------------------------------------------------------------- daily life (news: a line and no change)
  cu({ id: 'cu.news.domino', category: 'cuNews', stages: ALL, ages: [14, 90], weight: 1.4, cooldown: 4, maxPerLife: 4, outcomes: [{ text: '夕方、近所の路地で、机を持ち出してドミノを打つ大人たちの音が響きました。勝負の声と笑い声が、夜まで途切れませんでした。', kind: 'normal' }] }, 'friends'),
  cu({ id: 'cu.news.corner', category: 'cuNews', stages: ALL, ages: [14, 90], weight: 1.3, cooldown: 4, maxPerLife: 3, outcomes: [{ text: '公園の一角では、今日も野球の議論が熱を帯びていました。誰もが自分の監督になり、誰も譲りませんでした。', kind: 'normal' }] }, 'community'),
  cu({ id: 'cu.news.music', category: 'cuNews', stages: ALL, ages: [14, 90], weight: 1.2, cooldown: 4, maxPerLife: 3, outcomes: [{ text: '通りのどこかから、ラジオの音楽と手拍子が聞こえてきました。足を止めた人たちが、いつの間にか踊り出しました。', kind: 'good' }] }, 'holiday'),
  cu({ id: 'cu.news.stadium', category: 'cuNews', stages: ['hs', 'univ', 'pro'], weight: 1.2, cooldown: 4, maxPerLife: 3, outcomes: [{ text: '夕暮れの球場は、大声の応援と打楽器でいっぱいでした。ベンチに向かって、あちこちから助言が飛びました。', kind: 'good' }] }, 'media'),

  // ---------------------------------------------------------------- daily life: scarcity, neighbours, the family at home
  cu({
    id: 'cu.daily.shortage',
    category: 'cuDaily',
    stages: ALL,
    ages: [14, 90],
    weight: 1.6,
    cooldown: 4,
    maxPerLife: 4,
    title: '手に入りにくいもの',
    body: '練習で使う靴や、日々の食材のいくつかが、店になかなか並びません。近所では、物を融通し合う人もいます。',
    auto: 2,
    choices: [
      { label: '近所の人と、持っているものを分け合う', effects: { rel: 3, happy: 1 }, outcomes: [{ text: '隣の家と、米と豆と、古い野球の道具を交換しました。それから、挨拶の声が少し大きくなりました。' }] },
      { label: '市場で、高めの値段でも買い足す', hint: '約8万円', when: (s) => s.money >= 20, effects: { money: -8, happy: 1 }, outcomes: [{ text: '少し高い値段を払って、必要なものを手に入れました。' }] },
      NONE('ないものは、工夫して済ませる', '靴は紐を結び直し、食材は手に入るもので、工夫して済ませました。'),
    ],
  }, 'money'),
  cu({
    id: 'cu.daily.blackout',
    category: 'cuDaily',
    stages: ALL,
    ages: [14, 90],
    weight: 1.3,
    cooldown: 4,
    maxPerLife: 3,
    title: '長い停電の夜',
    body: '夕方から、地区一帯が停電になりました。冷蔵庫の中身が心配で、暑さで部屋にいられません。',
    auto: 2,
    choices: [
      { label: '外に出て、近所の人と夜を過ごす', effects: { rel: 3, happy: 1 }, outcomes: [{ text: '路地に椅子を並べ、星の下で話し込みました。暗闇の中で、子どもたちが野球の真似をして走り回りました。' }] },
      // (alone: indoors, on the telephone, not with the neighbours of the first choice)
      { label: '家の中で、ランプをともして乗り切る', effects: { rel: 2 }, outcomes: [{ text: (s) => (hasFamily(s) ? '家族で小さなランプを囲み、昔の試合の話を聞かせてもらいました。' : '小さなランプをともし、昔のチームメートに電話をかけて、試合の思い出を語り合いました。') }] },
      NONE('早く寝て、朝を待つ', '暑さのなか、窓を開け放って、早めに眠りました。'),
    ],
  }, 'home'),
  cu({
    id: 'cu.family.support',
    category: 'cuFamily',
    stages: ['pro', 'adult', 'senior'],
    ages: [20, 80],
    when: (s) => parentAlive(s) && s.money >= 30,
    weight: 1.4,
    cooldown: 4,
    maxPerLife: 3,
    title: '家族の暮らしを支える',
    body: '家では、親の薬や、家の修理、日々の食べ物など、必要なものがいくつも重なっています。',
    auto: 2,
    choices: [
      { label: '収入の一部を、毎月家に入れる', hint: '約12万円（年）', effects: { money: -12, rel: 3, happy: 2 }, outcomes: [{ text: '給料日に、決まった額を実家に届けるのが習慣になりました。母は、封筒をすぐには開けませんでした。' }] },
      { label: '家の屋根と壁を、仲間と修理する', hint: '約20万円', when: (s) => s.money >= 40, effects: { money: -20, rel: 3, know: 1 }, outcomes: [{ text: '近所の仲間が手伝いに来てくれ、雨漏りがやっと止まりました。夕食に、みんなで豆の煮込みを食べました。' }] },
      NONE('今は、様子を見る', '家の様子は、会ったときに聞くだけにして、支援はもう少し先に延ばしました。'),
    ],
  }, 'family'),
  cu({
    id: 'cu.love.walk',
    category: 'cuLove',
    stages: ['univ', 'pro', 'adult'],
    when: (s) => partner(s),
    weight: 2,
    cooldown: 3,
    maxPerLife: 3,
    title: '海沿いの散歩',
    body: '休みの夕方、交際している人と、海沿いの通りを歩く約束をしました。音楽と潮の匂いが、街にあふれています。',
    auto: 0,
    choices: [
      { label: '花とアイスクリームを持って出かける', hint: '約4万円', effects: { money: -4, rel: 3, happy: 3 }, outcomes: [{ text: '二人で防波堤に腰かけ、日が沈むまで話しました。将来の話が、自然に出てきました。' }] },
      NONE('家の前の路地で、ゆっくり話す', '路地の椅子に並んで座り、夜が更けるまで話しました。'),
    ],
  }, 'love'),
  cu({
    id: 'cu.love.wedding',
    category: 'cuLove',
    stages: ['pro', 'adult'],
    when: (s) => married(s) && s.family.spouse!.years <= 1,
    weight: 6,
    cooldown: 1,
    maxPerLife: 1,
    title: '結婚の祝い',
    body: '家族と近所の人が、結婚の祝いの準備を始めました。音楽、食べもの、飲みものを、みんなで持ち寄ろうと言っています。',
    auto: 1,
    choices: [
      { label: '家の前の通りで、にぎやかな祝宴を開く', hint: '約25万円', when: (s) => s.money >= 40, effects: { money: -25, happy: 5, rel: 5 }, outcomes: [{ text: '近所の人が料理と音楽を持ち寄り、夜通しの祝宴になりました。足りないものは、誰かが何とかしてくれました。' }] },
      NONE('家族だけの食事で済ませる', '家族だけで集まり、ささやかな食事で、新しい暮らしを祝いました。'),
    ],
  }, 'family'),
  cu({
    id: 'cu.family.home',
    category: 'cuFamily',
    stages: ['pro', 'adult'],
    ages: [22, 55],
    when: (s) => !!s.after && s.after.home !== 'own' && (married(s) || s.family.children > 0),
    weight: 1.5,
    cooldown: 5,
    maxPerLife: 2,
    title: '家族の部屋の足りなさ',
    // (the parents' house while a parent lives; after them, the house they left)
    body: (s) => `家族が増え、${parentAlive(s) ? '親の家' : '親の残した家'}では部屋が足りなくなってきました。増築するか、別の家と交換するか、このまま暮らし続けるか。`,
    auto: 2,
    choices: [
      { label: '今の家に部屋を増築する', hint: '約50万円', when: (s) => s.money >= 70, effects: { money: -50, happy: 3, rel: 2, home: 'own' }, outcomes: [{ text: '近所の人の手を借りて、家の裏に小さな部屋を足しました。壁の色を、家族みんなで選びました。' }] },
      { label: '別の家の人と、住まいを交換する', effects: { happy: 1, rel: 1 }, outcomes: [{ weight: 1, text: '仲介の人を通して、条件のよい家との交換が成立しました。', effects: { happy: 2 } }, { weight: 1, text: '交換の相手探しは長引き、話はまとまらないまま、季節が過ぎました。', effects: { happy: -1 } }] },
      NONE('今のまま、暮らし続ける', '部屋を分け合って、今の暮らしを続けることにしました。'),
    ],
  }, 'home'),
  cu({
    id: 'cu.money.business',
    category: 'cuMoney',
    stages: ['pro', 'adult'],
    ages: [24, 60],
    when: (s) => s.money >= 120 && !hasFlag(s, 'cu.biz'),
    weight: 1.3,
    cooldown: 6,
    maxPerLife: 1,
    title: '小さな商売を始める',
    body: '知人が、自宅の一室を使った食堂や、民宿のような小さな商売を勧めてくれました。元手は貯金から出すことになります。',
    auto: 2,
    choices: [
      { label: '貯金を元手に、小さな商売を始める', hint: '約80万円', effects: { money: -80, happy: 1 }, flag: 'cu.biz', follow: [{ id: 'cu.money.businessBack', after: 3, within: 6 }], outcomes: [{ text: '部屋を片付けて食卓を並べ、小さな食堂を始めました。最初の客は、近所の昔なじみでした。' }] },
      { label: '知人の手伝いから、まず始める', effects: { money: 10, know: 2 }, outcomes: [{ text: '知人の店で、仕入れと帳簿のつけ方を教わりながら、少しずつ働き始めました。' }] },
      NONE('いまの仕事を続ける', '商売は見送って、いまの仕事を続けることにしました。'),
    ],
  }, 'work'),
  cu({
    id: 'cu.money.businessBack',
    category: 'cuMoney',
    stages: ['pro', 'adult', 'senior'],
    followOnly: true,
    when: (s) => hasFlag(s, 'cu.biz'),
    outcomes: [
      { weight: 2, text: '評判を聞いた人が通うようになり、小さな食堂は、家計を支える柱になりました。', effects: { money: 200, happy: 3 } },
      { weight: 2, text: '材料の仕入れに苦労しながらも、なんとか店を続け、少しだけ利益が残りました。', effects: { money: 60, happy: 1 } },
      { weight: 1, text: '材料が手に入らない日が続き、店を閉めることになりました。', effects: { money: -40, happy: -3 }, kind: 'bad' },
    ],
  }, 'money'),
  cu({
    id: 'cu.money.remittance',
    category: 'cuMoney',
    stages: ['pro', 'adult', 'senior'],
    when: (s) => s.money < 1500,
    weight: 0.7,
    cooldown: 6,
    maxPerLife: 2,
    outcomes: [{ text: '海外に暮らす親戚から、送金と、新しいスニーカーが届きました。家族みんなで、箱を開ける時間を楽しみました。', kind: 'good', effects: { money: 30, happy: 2, rel: 1 } }],
  }, 'family'),

  // ---------------------------------------------------------------- the road of baseball
  cu({
    id: 'cu.base.equipment',
    category: 'cuBase',
    stages: ['hs', 'jhs', 'univ'],
    ages: [11, 20],
    weight: 1.8,
    cooldown: 3,
    maxPerLife: 3,
    title: '道具が足りない',
    body: 'チームのバットは、ひびを巻いた一本を、みんなで回して使っています。グローブも、全員には行き渡りません。',
    auto: 1,
    choices: [
      { label: '仲間と、手づくりの道具を工夫する', effects: { rel: 3, conf: 1 }, outcomes: [{ text: '古いタイヤの切れ端でボールをつくり、棒切れで打ちました。工夫は、意外とよく飛びました。' }] },
      { label: '海外にいる親戚に、道具を送ってもらう', effects: { rel: 1, happy: 2 }, outcomes: [{ weight: 2, text: '数か月後、親戚から新品のグローブとバットが届きました。チームみんなで、順番に手をはめました。' }, { weight: 1, text: '送ってもらった荷物は、途中で行方が分からなくなってしまいました。', effects: { happy: -2 } }] },
      NONE('順番を待って、今ある道具を大切に使う', '順番が来るまでは、ベンチで声を出して、仲間のプレーを見て学びました。'),
    ],
  }, 'trainer'),
  cu({
    id: 'cu.base.scout',
    category: 'cuBase',
    stages: ['hs', 'pro'],
    ages: [16, 30],
    when: (s) => s.career.highestRank >= 3 && !hasFlag(s, 'cu.scouted'),
    weight: 1.4,
    cooldown: 4,
    maxPerLife: 2,
    title: '海外のスカウト',
    body: '練習のとき、見慣れない人が、スタンドの端から長い時間、プレーを見ていました。あとで、海外の球団と関係のある人だと聞きました。',
    auto: 1,
    choices: [
      { label: '声をかけて、話を聞いてみる', hint: '海外挑戦の道が開けるかもしれない', flag: 'cu.scouted', effects: { know: 1, conf: 2 }, outcomes: [{ text: '短い会話の中で、「いつか連絡する」と言われました。その言葉が、数日間頭を離れませんでした。' }] },
      NONE('気にせず、目の前の練習を続ける', 'スカウトのことは考えないようにして、目の前の練習に打ち込みました。'),
    ],
  }, 'fans'),
  cu({
    id: 'cu.base.travel',
    category: 'cuBase',
    stages: ['hs', 'pro'],
    weight: 1.5,
    cooldown: 4,
    maxPerLife: 3,
    title: '遠くの州への遠征',
    body: 'リーグの遠征で、国の反対側にある州まで、長い道のりを移動することになりました。バスは古く、エアコンは壊れています。',
    auto: 1,
    choices: [
      { label: '車内で仲間と戦術を話し合う', effects: { know: 2, rel: 2 }, outcomes: [{ text: '揺れるバスの中で、ノートを広げて、配球と守備位置の話をしました。' }] },
      { label: '眠って体力を残す', effects: { conf: 1 }, outcomes: [{ text: '長い移動の間は目を閉じ、到着した夜は、ぐっすり眠れました。' }] },
      { label: '地元の人の家に泊めてもらい、土地の話を聞く', effects: { rel: 3, happy: 2 }, outcomes: [{ text: '宿代わりに招かれた家で、地元の料理をごちそうになり、昔の名選手の話をたくさん聞きました。' }] },
    ],
  }, 'teammates'),
  cu({
    id: 'cu.base.income',
    category: 'cuBase',
    stages: ['pro'],
    when: (s) => s.career.phase === 'pro' && s.career.proSeasons >= 2,
    weight: 1.3,
    cooldown: 4,
    maxPerLife: 2,
    title: '野球だけでは足りない収入',
    body: 'リーグの給料だけでは、家族の暮らしがぎりぎりです。休みの日に、ほかの仕事をする仲間も多くいます。',
    auto: 2,
    choices: [
      { label: 'オフに、副業で収入を足す', effects: { money: 25, happy: -1, rel: 1 }, outcomes: [{ text: 'オフの間は、知人の食堂や運搬を手伝い、少しだけ家計が楽になりました。' }] },
      { label: '野球に専念し、家計は工夫でしのぐ', effects: { conf: 2, happy: 1 }, outcomes: [{ text: '出費を削り、野球の練習に打ち込みました。家族も、同じ気持ちで付き合ってくれました。' }] },
      NONE('いまのままで、様子を見る', 'いまの暮らしのまま、シーズンを続けることにしました。'),
    ],
  }, 'work'),

  // ---------------------------------------------------------------- the one who went abroad (he lives in the US: tied to the US and to the flag)
  cuAbroad({
    id: 'cu.abroad.remit',
    category: 'cuAbroad',
    stages: ['pro', 'adult', 'senior'],
    when: (s) => abroad(s) && parentAlive(s) && s.money >= 100,
    weight: 2,
    cooldown: 3,
    maxPerLife: 4,
    title: '故郷の家族への送金',
    body: '故郷の家族から、屋根の修理と薬代のために、少しでも送ってもらえないかという連絡が届きました。',
    auto: 2,
    choices: [
      { label: 'まとまった額を、家族に送る', hint: '約200万円', when: (s) => s.money >= 260, effects: { money: -200, rel: 4, happy: 3 }, outcomes: [{ text: '送金の手続きを終えると、電話の向こうで、母が泣きながら何度も「ありがとう」と言いました。' }] },
      { label: '毎月、少しずつ送る', hint: '約60万円（年）', effects: { money: -60, rel: 2, happy: 2 }, outcomes: [{ text: '毎月の送金が、家族にとって当たり前の支えになりました。' }] },
      NONE('自分の生活を立て直すのを優先する', '家族には事情を伝え、今回は送金を見送りました。電話は、いつもより短く終わりました。'),
    ],
  }, 'family'),
  cuAbroad({
    id: 'cu.abroad.homesick',
    category: 'cuAbroad',
    stages: ['pro', 'adult'],
    when: (s) => abroad(s),
    weight: 1.5,
    cooldown: 4,
    maxPerLife: 3,
    title: '故郷が恋しい夜',
    body: '遠征先のホテルの部屋で、故郷の家族の声が、急に聞きたくなりました。通話代は、決して安くありません。',
    auto: 2,
    choices: [
      { label: '長電話をして、家族の声を聞く', hint: '約3万円', effects: { money: -3, happy: 3, rel: 2 }, outcomes: [{ text: '電話口で、母が近所の話を長々と語りました。電話を切ると、不思議と体が軽くなっていました。' }] },
      { label: '同じ国の出身の仲間と、故郷の食事をつくる', effects: { rel: 3, happy: 2 }, outcomes: [{ text: '仲間の部屋に集まり、豆と米の料理をつくりました。母国語の笑い声が、部屋に響きました。' }] },
      NONE('眠って、翌日の試合に備える', '感傷を押し込んで早めに眠り、翌日の試合に備えました。'),
    ],
  }, 'friends'),

  // ---------------------------------------------------------------- after baseball
  cu({
    id: 'cu.after.coach',
    category: 'cuAfter',
    stages: ADULT,
    ages: [26, 65],
    when: (s) => retiredPlayer(s) && !hasFlag(s, 'cu.coached'),
    weight: 1.7,
    cooldown: 5,
    maxPerLife: 1,
    title: '子どもたちに教える',
    body: '近所の子どもたちが、野球を教えてほしいと頼みに来ました。公園の隅で、手づくりの道具を持って並んでいます。',
    auto: 1,
    choices: [
      { label: '毎週、子どもたちに野球を教える', hint: '収入は少ない', flag: 'cu.coached', effects: { rel: 4, happy: 4, know: 1 }, outcomes: [{ text: '子どもたちは、泥だらけになって走り回りました。数年後、その中から州の代表に選ばれる子が出ました。' }] },
      { label: '州のチームの指導者として働く', flag: 'cu.coached', effects: { money: 15, rel: 2, know: 2 }, outcomes: [{ text: '州の代表チームのコーチの職を得て、遠征に付き添う日々が始まりました。' }] },
      NONE('いまの仕事で、手一杯', '仕事で手一杯で、子どもたちには、また今度と伝えました。'),
    ],
  }, 'secondCareer'),
  cu({
    id: 'cu.after.talk',
    category: 'cuAfter',
    stages: ADULT,
    ages: [35, 75],
    when: (s) => parentAlive(s) || s.family.children > 0,
    weight: 1.1,
    cooldown: 5,
    maxPerLife: 2,
    title: '年を重ねたあとの暮らし',
    body: '年金だけで暮らしていけるのか、子どもや親戚に頼れるのか。年を重ねた先の暮らしを、家族で話しました。',
    auto: 2,
    choices: [
      // (the family he has: no brothers, whom the model does not keep; the parents' care only while a parent lives)
      { label: '家族で、世話の分担を決める', effects: { rel: 3, happy: 2 }, outcomes: [{ text: (s) => `家族で集まり、${parentAlive(s) ? '親の世話と家の維持' : 'これからの暮らしと家の維持'}の分担を決めました。紙に書き出すと、安心が広がりました。` }] },
      { label: '海外の親戚とも相談して、支え合いを探る', effects: { know: 1, rel: 2 }, outcomes: [{ text: '海外の親戚とビデオ通話をつなぎ、将来の送金や訪問について話し合いました。' }] },
      NONE('そのときになってから、考える', '先のことは、そのときになってから考えることにして、話を終えました。'),
    ],
  }, 'family'),
]

export const LEAGUE_SPECS: EventSpec[] = [...KR_SPECS, ...CU_SPECS]
