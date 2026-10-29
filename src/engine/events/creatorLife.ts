import type { CareerKind, LifeState } from '../types.ts'
import { careerOf, fameOf } from '../careers.ts'
import { hasFlag, youngKin, type EventSpec } from './spec.ts'

// Creators and streamers (2026-10-24, careers.ts): a pro gamer (a tryout from 16, a team, prize money, the cut, coaching or casting
// later), a streamer (a channel, slow growth, a viral video, sponsored work, a flame, burnout, collaborations, the top only at the end
// of a chain), a manga artist (a prize, an editor, the serialization meeting, cancellation, a hit and, rarely, an anime; a baseball
// manga drawn from his own life), a novelist (a newcomers' prize, the debut, a slump, a memoir late in life) and an illustrator
// (freelance work, burnout, a commission that makes him known). Each career is started only by the player's own choice (never by
// おまかせ), so the events about a career in progress are follow-ups or `needsChoice`. People who try a creator path beside their job
// keep it (flags, money and happiness only). Incomes, prize money and odds are game assumptions. Teams, companies and fellow creators
// named here are fictional (架空). All texts are original.

const X = { extra: true } as const
const XF = { extra: true, followOnly: true } as const
const has = (f: string) => (s: LifeState) => hasFlag(s, f)
const CREATOR: CareerKind[] = ['gamer', 'streamer', 'manga', 'novelist', 'illustrator']
/** he follows one of the creator careers now */
const creator = (s: LifeState) => CREATOR.includes(careerOf(s) as CareerKind)
const is = (k: CareerKind) => (s: LifeState) => careerOf(s) === k
/** he may start a career: an adult after baseball, not a university student, not retired from work */
const canStart = (s: LifeState) => s.age >= 18 && s.career.phase === 'retired' && s.job !== '大学生' && !s.after?.retired

export const CREATOR_LIFE: EventSpec[] = [
  // ================================================================ pro gamer
  {
    ...X,
    id: 'x.creator.gameTeen',
    category: 'creatorGame',
    stages: ['student'],
    ages: [15, 17],
    when: (s) => !hasFlag(s, 'cr.gameTry') && !hasFlag(s, 'cr.gameHobby'),
    weight: 4,
    maxPerLife: 1,
    title: 'ゲームの腕を試すか',
    body: '野球をやめてから夢中になった対戦ゲームで、全国のランキングに名前が載りました。プロチームの入団テストは、十六歳から受けられるそうです。',
    auto: 2,
    choices: [
      { label: 'プロチームの入団テストに申し込む', hint: '早く挑めるが、学校との両立は苦しくなる', flag: 'cr.gameTry', effects: { happy: 3, know: -3 }, outcomes: [{ follow: [{ id: 'x.creator.gameTryout', after: 1, within: 2 }], text: '申込書の保護者の同意の欄に、親の判子を押してもらうまで、三晩かかりました。' }] },
      { label: '趣味のまま、勉強と両立する', hint: '学業は守れるが、勝負の場は遠のく', flag: 'cr.gameHobby', effects: { know: 3, happy: 1 }, outcomes: [{ text: '平日は一時間だけと決め、タイマーが鳴ったらコントローラーを置くことにしました。' }] },
      { label: 'ランキングを眺めて、満足する', outcomes: [{ text: '画面に映る自分の名前を写真に撮り、そっと保存しました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.creator.gameTryout',
    category: 'creatorGame',
    stages: ['student', 'adult'],
    when: has('cr.gameTry'),
    outcomes: [
      { weight: 1.5, text: '入団テストは二次で落ちました。上には上がいると、反応速度の数字が教えてくれました。', effects: { happy: -4, flag: 'cr.gameFail' } },
      { when: (s) => !canStart(s), weight: 1, text: '入団テストに育成枠で合格しました。いまの学校を終えるまでは、週末だけチームの練習に通う約束です。', effects: { flag: 'cr.gameYouth', happy: 4 }, follow: [{ id: 'x.creator.gameContract', after: 2, within: 4 }] },
      { when: canStart, weight: 1, text: '入団テストに合格し、プロチームと契約を結びました。寮の机に、新しいヘッドセットが置かれていました。', effects: { career: 'gamer', flag: 'cr.gamer', fame: 3 }, follow: [{ id: 'x.creator.gameRookie', after: 1 }] },
    ],
  },
  {
    ...XF,
    id: 'x.creator.gameContract',
    category: 'creatorGame',
    stages: ['adult'],
    ages: [18, 24],
    when: (s) => hasFlag(s, 'cr.gameYouth') && canStart(s) && !creator(s),
    title: 'プロ契約の話',
    body: '育成枠で通っていたチームから、正式なプロ契約の話が来ました。年俸は高くありませんが、大会の賞金は選手にも分けられます。',
    auto: 2,
    choices: [
      { label: 'プロ契約を結ぶ', hint: '夢に手が届くが、収入は不安定', flag: 'cr.gamer', effects: { career: 'gamer', fame: 2 }, outcomes: [{ follow: [{ id: 'x.creator.gameRookie', after: 1 }], text: '契約書にサインした日、チームの配信で新しいメンバーとして紹介されました。' }] },
      { label: '普通の仕事を選び、ゲームは趣味に戻す', hint: '暮らしは安定するが、あの舞台には戻れない', flag: 'cr.gameHobby', effects: { happy: -3, know: 2 }, outcomes: [{ text: 'チームの仲間に頭を下げ、ロッカー代わりの棚から、自分の名札を外しました。' }] },
      { label: '返事を先に延ばす', outcomes: [{ text: 'チームには少し考えさせてほしいと伝え、その年は答えを出しませんでした。' }] },
    ],
  },
  {
    ...X,
    id: 'x.creator.gameAdult',
    category: 'creatorGame',
    stages: ['adult'],
    ages: [18, 28],
    when: (s) => canStart(s) && !creator(s) && !hasFlag(s, 'cr.gamer') && !hasFlag(s, 'cr.gameTry') && !hasFlag(s, 'cr.gameSide') && !hasFlag(s, 'cr.gameDecline'),
    requires: canStart,
    weight: 2,
    maxPerLife: 1,
    title: 'オンライン大会の誘い',
    body: (s) => `${s.career.highestRank >= 4 ? '野球で鍛えた動体視力が、思わぬところで生きました。' : ''}対戦ゲームのオンライン大会で上位に入り、プロチーム（架空）から入団テストの誘いが届きました。`,
    auto: 2,
    choices: [
      {
        label: '入団テストを受け、プロを目指す',
        hint: '受かれば今の仕事を辞めてチームに入る。落ちれば何も残らない',
        flag: 'cr.gameTry',
        outcomes: [
          { weight: 1, text: '三日間のテストを最後まで勝ち抜き、チームと契約しました。練習場は、古い倉庫を改装した部屋でした。', effects: { career: 'gamer', flag: 'cr.gamer', fame: 3 }, follow: [{ id: 'x.creator.gameRookie', after: 1 }] },
          { weight: 1.5, text: '最終日に連敗して、テストは不合格でした。帰りの電車で、負けた試合の録画を何度も見返しました。', effects: { happy: -3, flag: 'cr.gameFail' } },
        ],
      },
      { label: '今の暮らしのまま、週末の大会に出る', hint: '賞金は少しだが、生活は崩れない', flag: 'cr.gameSide', effects: { happy: 3, money: 15, rel: -1 }, outcomes: [{ text: '土曜の夜は大会の日と決め、仲間三人とチームを組みました。賞金で、全員分の夕食代が出ました。' }] },
      { label: '誘いを断る', flag: 'cr.gameDecline', outcomes: [{ text: '誘いのメッセージには、丁寧なお礼だけを返しました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.creator.gameRookie',
    category: 'creatorGame',
    stages: ['adult'],
    when: is('gamer'),
    outcomes: [
      { weight: 1.2, text: 'デビューした年、チームは国内大会で準優勝しました。賞金の分け前と、年俸の上乗せが届きました。', effects: { money: 60, payScale: 1.4, fame: 5 }, follow: [{ id: 'x.creator.gamePeak', after: 1, within: 2 }] },
      { weight: 1, text: '一年目は控えのまま、練習相手を務める日々でした。ベンチから見る大会の照明は、まぶしすぎました。', effects: { happy: -3, sat: -4 }, follow: [{ id: 'x.creator.gameCut', after: 1, within: 2 }] },
    ],
  },
  {
    ...XF,
    id: 'x.creator.gamePeak',
    category: 'creatorGame',
    stages: ['adult'],
    when: is('gamer'),
    title: '世界大会の予選',
    body: '国内大会の結果で、世界大会の予選に出られることになりました。チームは合宿を組み、一日十二時間の練習を予定しています。',
    auto: 2,
    choices: [
      {
        label: '合宿に全てを注ぐ',
        hint: '勝てば大きいが、手首と目に負担がかかる',
        effects: { health: -2 },
        outcomes: [
          { weight: 0.6, text: '予選を勝ち上がり、世界大会の本戦で優勝しました。表彰台で掲げたトロフィーは、思ったより軽く感じました。', kind: 'big', key: true, effects: { achieve: 'eスポーツ世界大会優勝', fame: 12, money: 400, payScale: 1.8 }, follow: [{ id: 'x.creator.gameAfter', after: 3, within: 3 }] },
          { weight: 1, text: '予選の決勝で敗れ、世界にはあと一歩届きませんでした。それでも、チームの中での評価は上がりました。', effects: { payScale: 1.2, happy: -1 }, follow: [{ id: 'x.creator.gameAfter', after: 3, within: 3 }] },
        ],
      },
      { label: '練習を抑え、配信でファンを増やす', hint: '予選は厳しくなるが、名前は売れる', effects: { fame: 6, money: 30 }, outcomes: [{ text: '予選は初戦で負けましたが、練習の合間に続けた配信の視聴者は倍になりました。', effects: { payScale: 1.1 }, follow: [{ id: 'x.creator.gameAfter', after: 3, within: 3 }] }] },
      { label: 'チームの方針に従う', outcomes: [{ text: '合宿のメニューは監督に任せ、言われた時間だけ画面に向かいました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.creator.gameCut',
    category: 'creatorGame',
    stages: ['adult'],
    when: is('gamer'),
    title: '契約更新の席',
    body: 'シーズンの終わり、チームから来季の契約は難しいと告げられました。反応の速さで、若い選手に追い越されたのです。',
    auto: 2,
    choices: [
      {
        label: '他のチームの入団テストを回る',
        hint: '拾われれば続けられるが、条件は下がる',
        outcomes: [
          { weight: 1, text: '三つ目のテストで、地方のチーム（架空）が拾ってくれました。年俸は下がりましたが、まだ画面の前に座れます。', effects: { payScale: 0.7, happy: 2 }, follow: [{ id: 'x.creator.gameAfter', after: 2, within: 3 }] },
          { weight: 1, text: 'どのチームからも声はかかりませんでした。荷物をまとめ、ゲーミングチェアだけを抱えて引っ越しました。', effects: { job: 'quit', happy: -5, flag: 'cr.gameEnd' } },
        ],
      },
      { label: 'チームに残り、裏方の分析担当になる', hint: '収入は減るが、居場所は残る', flag: 'cr.gameCoach', effects: { payScale: 0.6, sat: 3 }, outcomes: [{ text: '試合の録画を一つずつ切り分け、相手の癖を表にまとめる仕事を任されました。' }] },
      { label: '答えを保留にして、契約満了を待つ', outcomes: [{ follow: [{ id: 'x.creator.gameAfter', after: 2, within: 3 }], text: '返事をしないまま、契約の満了日が、カレンダーの上で近づいてきました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.creator.gameAfter',
    category: 'creatorGame',
    stages: ['adult'],
    when: is('gamer'),
    title: '反応が落ちてきた',
    body: '練習の数字に、わずかな遅れが出るようになりました。選手を続ける時間は、もう長くはなさそうです。',
    auto: 3,
    choices: [
      { label: 'コーチとしてチームに残る', hint: '収入は下がるが、若手を育てる役割が残る', flag: 'cr.gameCoach', effects: { payScale: 0.8, sat: 5, rel: 3 }, outcomes: [{ text: '引退試合のあと、若い選手たちの前に立ち、最初の作戦会議を開きました。' }] },
      {
        label: '大会の実況と解説に転じる',
        hint: '人前に出る仕事で、名前は残るが不安定',
        flag: 'cr.gameCaster',
        effects: { fame: 5, payScale: 1.1 },
        outcomes: [
          { weight: 1.5, text: '落ち着いた声と的確な読みが評判になり、大きな大会の解説席に呼ばれるようになりました。', effects: { happy: 4, money: 40 } },
          { weight: 1, text: '話すことは思ったより難しく、二年目には解説の依頼が減っていきました。', effects: { happy: -3, payScale: 0.7 } },
        ],
      },
      { label: 'ゲームから離れ、別の仕事を探す', hint: '安定を取りに行くが、一から覚え直す', flag: 'cr.gameLeft', effects: { job: 'quit', happy: -2, know: 2 }, outcomes: [{ text: '愛用の椅子を後輩に譲り、ハローワークの窓口で、職歴の欄の書き方を相談しました。' }] },
      { label: 'もう一年だけ選手を続ける', outcomes: [{ text: 'あと一年と自分に言い聞かせ、次の大会の申し込みを済ませました。' }] },
    ],
  },
  {
    ...X,
    id: 'x.creator.gameLate',
    category: 'creatorGame',
    needsChoice: true,
    stages: ['senior'],
    ages: [65, 85],
    when: (s) => hasFlag(s, 'cr.gamer') || hasFlag(s, 'cr.gameSide') || hasFlag(s, 'cr.gameHobby'),
    weight: 5,
    maxPerLife: 1,
    title: '昔のゲーム仲間',
    body: (s) => `${youngKin(s)}に誘われて、昔遊んだ対戦ゲームを久しぶりに手に取りました。六十五歳以上の大会があると聞きました。`,
    auto: 2,
    choices: [
      { label: 'シニアの大会に出てみる', hint: '体は疲れるが、胸が躍る', effects: { happy: 5, rel: 2, money: -5 }, outcomes: [{ text: 'シニアの部で三位に入り、表彰式では、ずっと若い司会者に握手を求められました。' }] },
      { label: '若い人に、昔の戦い方を教える', hint: '感謝されるが、自分は遊べない', effects: { rel: 5, happy: 2 }, outcomes: [{ text: '地域の集会所でゲーム教室を開き、昔の大会で使った作戦を、身ぶりを交えて説明しました。' }] },
      { label: '眺めるだけにする', outcomes: [{ text: '若い人の手元を後ろから眺め、うまい一手が出ると、小さく声を上げました。' }] },
    ],
  },

  // ================================================================ streamer
  {
    ...X,
    id: 'x.creator.streamStart',
    category: 'creatorStream',
    stages: ['adult'],
    ages: [18, 50],
    when: (s) => !creator(s) && !s.after?.retired && !hasFlag(s, 'cr.stream') && !hasFlag(s, 'cr.streamSide') && !hasFlag(s, 'cr.streamPass'),
    weight: 2.5,
    maxPerLife: 1,
    title: '動画を始めてみるか',
    body: (s) =>
      s.career.highestRank >= 4
        ? '野球の練習法や試合の裏話を動画にすれば見てもらえる、と友人に勧められました。機材は、スマートフォン一台からでも始められます。'
        : '好きなことを動画にして配信する人が、身の回りにも増えてきました。機材は、スマートフォン一台からでも始められます。',
    auto: 2,
    choices: [
      { label: '配信を本業にする', hint: '当たれば大きいが、最初の数年はほぼ無収入', when: canStart, flag: 'cr.stream', effects: { career: 'streamer', money: -30 }, outcomes: [{ follow: [{ id: 'x.creator.streamGrow', after: 1, within: 2 }], text: '照明とマイクを買いそろえ、部屋の壁に防音材を貼って、最初の動画を投稿しました。' }] },
      { label: '仕事や学業の合間に、週末だけ投稿する', hint: '失うものは少ないが、伸びるのも遅い', flag: 'cr.streamSide', effects: { money: -8, happy: 2 }, outcomes: [{ follow: [{ id: 'x.creator.streamSideBack', after: 2, within: 3 }], text: '日曜の夜に一本、十分ほどの動画を上げると決めました。最初の投稿の再生回数は十七回でした。' }] },
      { label: '見る側にとどまる', flag: 'cr.streamPass', outcomes: [{ text: '寝る前に好きな配信者の動画を眺め、作る側に回るのは、もう少し先にしました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.creator.streamSideBack',
    category: 'creatorStream',
    stages: ['adult'],
    when: (s) => hasFlag(s, 'cr.streamSide') && !creator(s),
    title: '副業の動画',
    body: '週末に上げてきた動画に、少しずつ決まった視聴者がつき始めました。コメント欄に、次の動画を待つ声が並んでいます。',
    auto: 2,
    choices: [
      { label: '思い切って、配信を本業にする', hint: '時間は増えるが、収入の保証はなくなる', when: canStart, flag: 'cr.stream', effects: { career: 'streamer', happy: 3 }, outcomes: [{ follow: [{ id: 'x.creator.streamGrow', after: 1, within: 2 }], text: '本業を辞めた週に、これからは毎日投稿しますと宣言する動画を上げました。' }] },
      {
        label: '副業のまま、無理なく続ける',
        hint: '小遣い程度の収入と、楽しみが残る',
        effects: { money: 20, happy: 2 },
        outcomes: [
          { weight: 2, text: '広告の収入で、月に一度の外食代くらいは出るようになりました。' },
          { weight: 1, text: '本業が忙しくなり、更新は月に一本に減りましたが、待っていてくれる人がいます。', effects: { rel: 2 } },
        ],
      },
      { label: 'しばらく様子を見る', outcomes: [{ text: 'コメントの一つひとつにお礼を返し、それ以上のことは決めませんでした。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.creator.streamGrow',
    category: 'creatorStream',
    stages: ['adult'],
    when: is('streamer'),
    title: '伸びない再生回数',
    body: '配信を本業にして一年。登録者は数百人で止まり、広告の収入は家賃にも届きません。',
    auto: 2,
    choices: [
      {
        label: '毎日投稿で、数を打つ',
        hint: '当たる機会は増えるが、心身を削る',
        effects: { health: -2, happy: -2 },
        outcomes: [
          { weight: 1, text: '何気なく上げた、草野球の珍プレーを集めた動画が、一晩で百万回再生されました。通知が鳴りやまず、眠れませんでした。', kind: 'big', effects: { fame: 8, payScale: 2.5 }, follow: [{ id: 'x.creator.streamMoney', after: 1, within: 2 }] },
          { weight: 1.5, text: '投稿を続けても数字は伸びず、管理画面を開くのがつらくなってきました。', effects: { payScale: 0.8, sat: -4 }, follow: [{ id: 'x.creator.streamBurn', after: 1, within: 2 }] },
        ],
      },
      {
        label: '一本に時間をかけ、企画を練る',
        hint: '質は上がるが、投稿の間があく',
        effects: { money: -20 },
        outcomes: [
          { weight: 1.5, text: '三か月かけた検証動画が専門家の目に留まって紹介され、登録者が一気に増えました。', effects: { fame: 5, payScale: 1.8 }, follow: [{ id: 'x.creator.streamMoney', after: 1, within: 2 }] },
          { weight: 1, text: '凝った動画ほど見られず、編集に費やした時間だけが積み上がりました。', effects: { happy: -4 }, follow: [{ id: 'x.creator.streamBurn', after: 1, within: 2 }] },
        ],
      },
      { label: '今のやり方を続ける', outcomes: [{ follow: [{ id: 'x.creator.streamBurn', after: 2, within: 2 }], text: 'ペースも企画も変えず、淡々と投稿を続けました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.creator.streamMoney',
    category: 'creatorStream',
    stages: ['adult'],
    when: is('streamer'),
    title: '企業案件の話',
    body: '登録者が増え、商品紹介の依頼（企業案件）が届きました。報酬は、これまでの広告収入の半年分です。',
    auto: 2,
    choices: [
      {
        label: '案件を受ける',
        hint: 'お金になるが、視聴者の目は厳しい',
        effects: { money: 80 },
        outcomes: [
          { weight: 2, text: '使ってみて本当に良かった点だけを話した動画は、案件とは思えないと好評で、依頼が続くようになりました。', effects: { payScale: 1.4 }, follow: [{ id: 'x.creator.streamCollab', after: 1, within: 2 }] },
          { weight: 1, text: '紹介した商品に不具合が見つかり、コメント欄が批判で埋まりました。', effects: { fame: 2 }, follow: [{ id: 'x.creator.streamFlame', after: 1 }] },
        ],
      },
      { label: '断って、視聴者との距離を守る', hint: '信頼は増すが、収入は増えない', effects: { happy: 2, fame: 3 }, outcomes: [{ follow: [{ id: 'x.creator.streamCollab', after: 1, within: 2 }], text: '案件は受けないと動画で話すと、古くからの視聴者が喜んでくれました。' }] },
      { label: '返事を急がない', outcomes: [{ follow: [{ id: 'x.creator.streamCollab', after: 2, within: 2 }], text: '返事を一週間寝かせているうちに、依頼の期限が過ぎていました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.creator.streamFlame',
    category: 'creatorStream',
    stages: ['adult'],
    when: is('streamer'),
    title: '炎上',
    body: '動画の中の不用意な一言が切り取られ、拡散されました。通知の数が、見たことのない速さで増えていきます。',
    auto: 3,
    choices: [
      { label: 'すぐに謝罪の動画を出す', flag: 'cr.flameSorry', hint: '誠実さは伝わるが、しばらく数字は落ちる', effects: { happy: -4, payScale: 0.8 }, outcomes: [{ follow: [{ id: 'x.creator.streamComeback', after: 1, within: 2 }], text: '言い訳をせずに頭を下げた動画が、批判の声を少しずつ静めていきました。' }] },
      {
        label: '反論して、自分の考えを貫く',
        hint: '支持者は熱くなるが、敵も増える',
        effects: { fame: 6, rel: -5 },
        outcomes: [
          { weight: 1, text: '反論の動画はよく再生されましたが、同業者の多くが距離を置き、コラボの話は消えていきました。', effects: { payScale: 0.7, sat: -3 } },
          { weight: 1, text: '筋の通った説明に味方が増え、騒ぎは半月で収まりました。むしろ登録者が増えました。', effects: { payScale: 1.3, happy: 2 } },
        ],
      },
      { label: '活動を休止する', flag: 'cr.flameRest', hint: '心は守れるが、視聴者は離れていく', effects: { payScale: 0.5, happy: 2 }, outcomes: [{ follow: [{ id: 'x.creator.streamComeback', after: 1, within: 2 }], text: 'しばらくお休みしますとだけ投稿し、スマートフォンの通知を全部切りました。' }] },
      { label: '黙って嵐が過ぎるのを待つ', outcomes: [{ text: '何も言わずにいると、騒ぎは別の話題に押し流されていきました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.creator.streamBurn',
    category: 'creatorStream',
    stages: ['adult'],
    when: is('streamer'),
    title: '燃え尽き',
    body: 'カメラの前で笑う自分が、他人のように思えてきました。次の企画が、どうしても浮かびません。',
    auto: 3,
    choices: [
      { label: '半年、配信を休む', flag: 'cr.burnRest', hint: '回復できるが、戻る場所があるかは分からない', effects: { happy: 4, payScale: 0.6 }, outcomes: [{ follow: [{ id: 'x.creator.streamComeback', after: 1, within: 2 }], text: '機材に布をかけ、半年のあいだ、旅と散歩と昼寝だけをして過ごしました。' }] },
      { label: '配信をやめて、勤めに戻る', hint: '安定は戻るが、積み上げた登録者は手放す', flag: 'cr.streamQuit', effects: { job: 'quit', happy: 1, money: -10 }, outcomes: [{ text: '最後の動画で視聴者にお礼を言い、翌週から求人サイトの画面を開くようになりました。' }] },
      { label: '無理をしてでも続ける', hint: '数字は守れるが、体が持つかどうか', effects: { health: -3, payScale: 1.1 }, outcomes: [{ text: '睡眠を削って投稿を続け、再生回数だけは何とか保ちました。' }] },
      { label: '誰かに相談してから決める', outcomes: [{ text: '古くからの配信仲間に電話をかけ、夜が明けるまで話を聞いてもらいました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.creator.streamComeback',
    category: 'creatorStream',
    stages: ['adult'],
    when: is('streamer'),
    outcomes: [
      { weight: 1.5, text: '復帰の動画には、待っていたという声が数千件つきました。休む前より、肩の力が抜けた動画を作れるようになりました。', effects: { happy: 5, payScale: 1.5 }, follow: [{ id: 'x.creator.streamCollab', after: 1, within: 2 }] },
      { weight: 1, text: '戻ってみると、視聴者の多くは別の配信者に移っていました。もう一度、数百人から始めることになりました。', effects: { sat: -4, payScale: 0.7 } },
    ],
  },
  {
    ...XF,
    id: 'x.creator.streamCollab',
    category: 'creatorStream',
    stages: ['adult'],
    when: is('streamer'),
    title: 'コラボの誘い',
    body: '人気の配信者（架空）から、一緒に企画をやらないかと声がかかりました。',
    auto: 2,
    choices: [
      {
        label: '大物と組み、大きな企画に挑む',
        hint: '跳ねれば一気に知られるが、相手の影に隠れることもある',
        effects: { money: -20 },
        outcomes: [
          { weight: 1, text: '二人で草野球チームを作る企画が話題になり、登録者が一気に十倍になりました。', effects: { fame: 10, payScale: 2 }, follow: [{ id: 'x.creator.streamTop', after: 2, within: 3 }] },
          { weight: 1, text: '企画は相手の見せ場ばかりになり、自分の名前を覚えた人は、ほとんどいませんでした。', effects: { happy: -3 } },
        ],
      },
      { label: '同じ規模の仲間と、長く続く企画を作る', hint: '急には伸びないが、仲間が残る', effects: { rel: 5, fame: 3, payScale: 1.2 }, outcomes: [{ text: '登録者の近い四人で、毎月一本の合同企画を始めました。編集を分け合えるのも助かりました。' }] },
      { label: '一人のやり方を守る', outcomes: [{ text: '誘いには感謝を伝え、自分の部屋の、自分のカメラの前に戻りました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.creator.streamTop',
    category: 'creatorStream',
    stages: ['adult'],
    when: is('streamer'),
    outcomes: [
      { weight: (s) => (fameOf(s) >= 25 ? 1 : 0.2), text: '登録者が百万人を超え、記念の盾が届きました。動画の最後に、最初のころの視聴者たちの名前を読み上げました。', kind: 'big', key: true, effects: { achieve: '登録者100万人', fame: 10, payScale: 2, money: 200 } },
      { weight: 2, text: '登録者は五十万人の手前で伸びが止まりました。それでも、好きなことで暮らしを立てられています。', effects: { sat: 4, payScale: 1.1 } },
    ],
  },
  {
    ...X,
    id: 'x.creator.streamLate',
    category: 'creatorStream',
    needsChoice: true,
    stages: ['senior'],
    ages: [65, 85],
    when: (s) => hasFlag(s, 'cr.stream') || hasFlag(s, 'cr.streamSide'),
    weight: 5,
    maxPerLife: 1,
    title: '老後のチャンネル',
    body: '若いころに作ったチャンネルが、まだ残っています。昔の動画に、最近になってコメントがつき始めました。',
    auto: 2,
    choices: [
      { label: 'もう一度、カメラの前に座る', hint: '張り合いが出るが、慣れない機材に手こずる', effects: { happy: 5, fame: 2, money: -10 }, outcomes: [{ text: '老いた元球児の野球談義と題した動画に、思いのほか多くの若い人が集まりました。' }] },
      { label: 'チャンネルを若い人に引き継ぐ', hint: '縁は広がるが、自分の場ではなくなる', effects: { rel: 5, happy: 2 }, outcomes: [{ text: (s) => `${youngKin(s)}にチャンネルを任せ、昔の動画の編集のこつを一つずつ教えました。` }] },
      { label: '昔の動画を見返すだけにする', outcomes: [{ text: '夜、湯のみを片手に、若いころの自分の早口を聞いて、少し笑いました。' }] },
    ],
  },
  {
    ...X,
    id: 'x.creator.seniorChannel',
    category: 'creatorStream',
    stages: ['senior'],
    ages: [66, 82],
    when: (s) => !hasFlag(s, 'cr.stream') && !hasFlag(s, 'cr.streamSide') && !hasFlag(s, 'cr.lateChannel') && !hasFlag(s, 'cr.lateChannelNo'),
    weight: 2,
    maxPerLife: 1,
    title: '動画を撮ってみないか',
    body: (s) => `${youngKin(s)}に、野球の思い出話を動画にしてみたらと勧められました。撮影も編集も、手伝ってくれるそうです。`,
    auto: 2,
    choices: [
      { label: '撮ってもらい、思い出を話す', hint: '楽しみが増えるが、ネットの声に戸惑うかもしれない', flag: 'cr.lateChannel', effects: { happy: 3, money: -3 }, outcomes: [{ follow: [{ id: 'x.creator.lateChannelBack', after: 2, within: 3 }], text: '縁側で、子どものころの草野球の話を二十分ほどしました。撮り直しは三回で済みました。' }] },
      { label: '照れくさいので、断る', hint: '気楽だが、話す相手はいつもの顔ぶれ', flag: 'cr.lateChannelNo', effects: { rel: -1, happy: 1 }, outcomes: [{ text: '自分の話なんか誰も聞かないよと笑って、お茶を差し出しました。' }] },
      { label: '考えておくと答える', outcomes: [{ text: 'そのうちにと答え、その話はそのまま、お茶の時間の雑談に紛れました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.creator.lateChannelBack',
    category: 'creatorStream',
    stages: ['senior'],
    when: has('cr.lateChannel'),
    outcomes: [
      { weight: 1, text: '昔の試合の話が思いのほか見られ、知らない土地の野球好きから手紙が届くようになりました。', effects: { happy: 5, fame: 2, rel: 3 } },
      { weight: 1.5, text: '見てくれるのは親戚と近所の人だけでしたが、正月にはその動画を流して、みんなで笑いました。', effects: { happy: 3, rel: 2 } },
    ],
  },

  // ================================================================ manga artist
  {
    ...X,
    id: 'x.creator.mangaStart',
    category: 'creatorManga',
    stages: ['adult'],
    ages: [18, 38],
    when: (s) => !creator(s) && !s.after?.retired && !hasFlag(s, 'cr.mangaSub') && !hasFlag(s, 'cr.mangaHobby') && !hasFlag(s, 'cr.mangaPass'),
    weight: 2,
    maxPerLife: 1,
    title: '描きためた漫画',
    body: (s) =>
      s.career.highestRank >= 4
        ? '野球部の日々を思い出しながらノートに描きためてきた漫画が、一冊分の厚さになりました。'
        : '子どものころから描き続けてきた漫画が、一冊分の厚さになりました。',
    auto: 2,
    choices: [
      { label: '出版社の新人賞に投稿する', hint: '道が開けるかもしれないが、厳しい評価も届く', flag: 'cr.mangaSub', effects: { money: -5, happy: 2 }, outcomes: [{ follow: [{ id: 'x.creator.mangaEditor', after: 1, within: 2 }], text: '原稿を封筒に入れ、郵便局の窓口で、折り曲げ厳禁の判を押してもらいました。' }] },
      { label: 'SNSに載せて、反応を楽しむ', hint: '気楽に見てもらえるが、仕事にはつながりにくい', flag: 'cr.mangaHobby', effects: { happy: 3, rel: 2 }, outcomes: [{ text: '四ページずつ投稿すると、知らない人から続きが読みたいと感想が届きました。' }] },
      { label: '引き出しにしまっておく', flag: 'cr.mangaPass', outcomes: [{ text: '描き上げた原稿を机の引き出しに戻し、また白い紙を一枚取り出しました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.creator.mangaEditor',
    category: 'creatorManga',
    stages: ['adult'],
    when: has('cr.mangaSub'),
    outcomes: [
      { weight: 1, text: '新人賞で佳作に選ばれ、編集部から電話がありました。担当の編集者がつくことになりました。', effects: { flag: 'cr.mangaPrize', happy: 5, money: 10 }, follow: [{ id: 'x.creator.mangaChoice', after: 1, within: 2 }] },
      { weight: 1.5, text: '結果発表の誌面に、自分の名前はありませんでした。添えられた講評には、人物の表情が硬いとありました。', effects: { happy: -3, flag: 'cr.mangaFail' } },
    ],
  },
  {
    ...XF,
    id: 'x.creator.mangaChoice',
    category: 'creatorManga',
    stages: ['adult'],
    when: (s) => hasFlag(s, 'cr.mangaPrize') && !creator(s),
    title: '担当編集の提案',
    body: '担当の編集者から、連載を目指すなら、まずは人気作家のアシスタントで修業してはどうかと勧められました。',
    auto: 2,
    choices: [
      { label: '仕事を辞めて、漫画一本で生きる', hint: '連載への近道だが、収入は一気に減る', when: canStart, flag: 'cr.manga', effects: { career: 'manga' }, outcomes: [{ follow: [{ id: 'x.creator.mangaSerial', after: 2, within: 2 }], text: '先生の仕事場に通い、背景の電柱と窓枠を、毎晩何百本も描きました。' }] },
      {
        label: '今の暮らしのまま、夜に描き続ける',
        hint: '生活は守れるが、描ける量は限られる',
        flag: 'cr.mangaSide',
        effects: { happy: 2, health: -1, money: 15 },
        outcomes: [
          { weight: 1, text: '仕事のあとに描いた読み切りが、増刊号に載りました。原稿料で、新しいペンを買いました。' },
          { weight: 1, text: '夜ごと机に向かっても、ネームは編集者の赤字で埋まって返ってきました。', effects: { happy: -3 } },
        ],
      },
      { label: '答えを急がない', outcomes: [{ text: '少し考えますと返事をして、編集者の名刺を手帳に挟みました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.creator.mangaSerial',
    category: 'creatorManga',
    stages: ['adult'],
    when: is('manga'),
    outcomes: [
      { weight: 1, text: '連載会議を通り、ついに自分の名前で連載が始まりました。巻頭のカラーページを、何度も見返しました。', kind: 'big', effects: { flag: 'cr.mangaSerial', payScale: 2.5, fame: 6 }, follow: [{ id: 'x.creator.mangaHit', after: 3, within: 2 }] },
      { weight: 1.2, text: '連載会議で企画が落ちました。編集者は次があると言いましたが、その次がいつかは分かりません。', effects: { happy: -4, payScale: 0.8 }, follow: [{ id: 'x.creator.mangaRetry', after: 1, within: 2 }] },
    ],
  },
  {
    ...XF,
    id: 'x.creator.mangaRetry',
    category: 'creatorManga',
    stages: ['adult'],
    when: is('manga'),
    title: '何度目かのネーム',
    body: '連載会議で落ちるのは、これで三度目です。アシスタントの仕事は続いていますが、年齢のことも頭をよぎります。',
    auto: 3,
    choices: [
      {
        label: '諦めずに、新しいネームを出す',
        hint: '次で通るかもしれないし、通らないかもしれない',
        effects: { health: -2 },
        outcomes: [
          { weight: 1, text: '四度目の会議で企画が通り、連載が始まりました。担当の編集者と、居酒屋で乾杯しました。', effects: { flag: 'cr.mangaSerial', payScale: 2.2, happy: 6 }, follow: [{ id: 'x.creator.mangaHit', after: 3, within: 2 }] },
          { weight: 1.2, text: '新しいネームも通りませんでした。描きたいものと求められるものの差が、見えなくなってきました。', effects: { happy: -4 }, follow: [{ id: 'x.creator.mangaChange', after: 1, within: 2 }] },
        ],
      },
      { label: '絵の腕を活かし、イラストの仕事に移る', hint: '収入は安定するが、物語は描けなくなる', flag: 'cr.illust', effects: { career: 'illustrator', happy: -1 }, outcomes: [{ follow: [{ id: 'x.creator.illustWork', after: 1, within: 2 }], text: 'アシスタント仲間の紹介で、ゲームの背景画を描く仕事を請け負うことにしました。' }] },
      { label: '筆を置いて、別の仕事を探す', hint: '暮らしは立て直せるが、夢は終わる', flag: 'cr.mangaQuit', effects: { job: 'quit', happy: -4, know: 1 }, outcomes: [{ text: '描きかけの原稿を段ボールに詰め、押し入れの奥にしまいました。' }] },
      { label: 'アシスタントを続けながら考える', outcomes: [{ text: '先生の仕事場で背景を描き続けながら、答えは、もう少し先に延ばしました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.creator.mangaHit',
    category: 'creatorManga',
    stages: ['adult', 'senior'],
    when: (s) => is('manga')(s) && hasFlag(s, 'cr.mangaSerial'),
    outcomes: [
      { weight: 1.2, text: '人気投票の順位が上がらず、連載は二年で打ち切りになりました。最終回の最後のコマだけは、自分で決めさせてもらえました。', effects: { payScale: 0.4, happy: -6 }, follow: [{ id: 'x.creator.mangaChange', after: 1, within: 2 }] },
      { weight: 1.5, text: '派手さはないものの、根強い読者に支えられ、単行本は五巻を超えました。', effects: { payScale: 1.3, money: 120, sat: 4 }, follow: [{ id: 'x.creator.mangaBaseball', after: 2, within: 3 }] },
      { weight: 0.5, text: '単行本が重版を重ね、書店に専用の棚が作られるほどの人気作になりました。', kind: 'big', effects: { fame: 12, payScale: 2.2, money: 500 }, follow: [{ id: 'x.creator.mangaAnime', after: 2, within: 2 }] },
    ],
  },
  {
    ...XF,
    id: 'x.creator.mangaAnime',
    category: 'creatorManga',
    stages: ['adult', 'senior'],
    when: is('manga'),
    outcomes: [
      { weight: 2, text: '連載作品のアニメ化が決まりました。第一話の放送の夜、仕事場のテレビの前に、アシスタント全員が集まりました。', kind: 'big', key: true, effects: { achieve: '連載作品のアニメ化', fame: 10, payScale: 1.8 } },
      { weight: 1, text: 'アニメ化の企画は、制作会社の都合で立ち消えになりました。それでも、連載は変わらず続いています。', effects: { happy: -2, payScale: 1.1 } },
    ],
  },
  {
    ...XF,
    id: 'x.creator.mangaBaseball',
    category: 'creatorManga',
    stages: ['adult', 'senior'],
    when: is('manga'),
    title: '次の連載の題材',
    body: '次の連載の題材を決める打ち合わせで、編集者が、あなたにしか描けないものを描いてほしいと言いました。',
    auto: 2,
    choices: [
      {
        label: '自分の野球人生を下敷きに、野球漫画を描く',
        hint: '本物の手触りが出せるが、地味だと言われるかもしれない',
        flag: 'cr.mangaBall',
        outcomes: [
          { weight: 1.5, text: '汗のにおいまで伝わると評判になり、元球児の読者から長い手紙が何通も届きました。', effects: { fame: 5, payScale: 1.4, happy: 5 } },
          { weight: 1, text: '試合の描写が細かすぎると言われ、人気は伸び悩みました。それでも、描いてよかったと思っています。', effects: { payScale: 0.9, happy: 2 } },
        ],
      },
      { label: '流行りのジャンルで、確実に当てにいく', hint: '数字は読みやすいが、気持ちが乗らない', effects: { money: 60, sat: -4, payScale: 1.2 }, outcomes: [{ text: '流行の異世界ものを描き、単行本の初版は前作より多く刷られました。' }] },
      { label: '編集者の案に任せる', outcomes: [{ text: '題材は編集部の会議で決まり、自分は絵を描くことに集中しました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.creator.mangaChange',
    category: 'creatorManga',
    stages: ['adult', 'senior'],
    when: is('manga'),
    title: '描く場所を失って',
    body: (s) =>
      hasFlag(s, 'cr.mangaSerial')
        ? '連載が終わり、仕事場は静かになりました。アシスタントたちも、それぞれの次の現場へ移っていきました。'
        : '連載の企画が通らないまま、何年かが過ぎました。描きためたネームの束だけが、机の横で高くなっていきます。',
    auto: 3,
    choices: [
      {
        label: 'もう一度、新連載を目指す',
        hint: '再起の目はあるが、また落ちるかもしれない',
        outcomes: [
          { weight: 1, text: '新しい読者層を狙った作品で、ウェブでの連載を勝ち取りました。再出発の第一話には、前作の読者からも声が届きました。', effects: { payScale: 1.8, happy: 5, fame: 3 } },
          { weight: 1.2, text: '新しい企画も通らず、預金の残高ばかりが減っていきました。', effects: { payScale: 0.7, happy: -3, money: -40 } },
        ],
      },
      { label: '作画や背景の仕事を請け負う', hint: '収入は安定するが、自分の作品ではない', effects: { payScale: 0.9, money: 40, sat: -2 }, outcomes: [{ text: '他の作家の作品で背景を担当し、締め切りの前には泊まり込みで手伝いました。' }] },
      { label: '漫画をやめて、別の仕事に就く', hint: '暮らしは立て直せるが、描く時間はなくなる', flag: 'cr.mangaQuit', effects: { job: 'quit', happy: -3 }, outcomes: [{ text: 'ペン先とインクを箱にしまい、履歴書の職歴の欄に、漫画家と書きました。' }] },
      { label: 'しばらく何も描かずに休む', outcomes: [{ text: '仕事場の窓を開け放ち、描かない日々を、しばらく自分に許しました。' }] },
    ],
  },
  {
    ...X,
    id: 'x.creator.mangaLate',
    category: 'creatorManga',
    needsChoice: true,
    stages: ['senior'],
    ages: [65, 88],
    when: has('cr.manga'),
    weight: 5,
    maxPerLife: 1,
    title: '原画の行き先',
    body: '仕事場の棚には、何十年分の原稿が眠っています。地元の公民館から、原画を並べてみないかという話が来ました。',
    auto: 2,
    choices: [
      { label: '原画展を開く', hint: '昔の読者に会えるが、準備に費用がかかる', effects: { money: -30, happy: 6, fame: 2 }, outcomes: [{ text: '会場には昔の読者が子どもを連れて訪れ、色あせた単行本にサインを頼まれました。' }] },
      { label: '子ども向けの漫画教室を開く', hint: '次の世代に渡せるが、体力は使う', effects: { rel: 5, happy: 4 }, outcomes: [{ text: '小学生たちに、丸と線だけで顔を描くこつを教えると、教室中が笑い声でいっぱいになりました。' }] },
      { label: '原稿は棚に置いたままにする', outcomes: [{ text: '話は丁重に断り、原稿の束をそっと撫でて、棚の戸を閉めました。' }] },
    ],
  },

  // ================================================================ novelist
  {
    ...X,
    id: 'x.creator.novelStart',
    category: 'creatorWrite',
    stages: ['adult'],
    ages: [22, 60],
    when: (s) => !creator(s) && !s.after?.retired && !hasFlag(s, 'cr.novelSub') && !hasFlag(s, 'cr.novelBlog') && !hasFlag(s, 'cr.novelPass'),
    weight: 2,
    maxPerLife: 1,
    title: '小説を書いてみる',
    body: '寝る前に少しずつ書いてきた小説が、原稿用紙で三百枚を超えました。誰かに読んでもらいたい気持ちが、ふくらんでいます。',
    auto: 2,
    choices: [
      { label: '文芸誌の新人賞に応募する', hint: '評価を受けられるが、待つ時間は長い', flag: 'cr.novelSub', effects: { happy: 2, money: -2 }, outcomes: [{ follow: [{ id: 'x.creator.novelPrize', after: 1, within: 2 }], text: '締め切りの前夜に最後の章を書き直し、朝一番の郵便に間に合わせました。' }] },
      { label: '小説投稿サイトに載せる', hint: '読者の反応はすぐ来るが、埋もれやすい', flag: 'cr.novelBlog', effects: { happy: 3, rel: 1, know: 1 }, outcomes: [{ text: '一日一話ずつ公開すると、毎晩同じ時間に感想を書いてくれる読者が現れました。' }] },
      { label: '自分だけの楽しみにしておく', flag: 'cr.novelPass', outcomes: [{ text: '書き上げた原稿のファイルに日付をつけて保存し、次の話の構想を練り始めました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.creator.novelPrize',
    category: 'creatorWrite',
    stages: ['adult'],
    when: has('cr.novelSub'),
    outcomes: [
      { weight: 0.8, text: '新人賞の受賞の知らせは、昼休みの電話で届きました。授賞式の壇上で、手が震えました。', kind: 'big', effects: { flag: 'cr.novelWin', fame: 4, money: 50 }, follow: [{ id: 'x.creator.novelDebut', after: 1, within: 2 }] },
      { weight: 1.2, text: '最終候補の五作に残りましたが、受賞は逃しました。選評の一行に、次作に期待と書かれていました。', effects: { happy: 2, know: 2 } },
      { weight: 1.5, text: '一次選考の通過者の欄に、自分の名前はありませんでした。それでも、一つの長編を書き上げたことは残りました。', effects: { happy: -2 } },
    ],
  },
  {
    ...XF,
    id: 'x.creator.novelDebut',
    category: 'creatorWrite',
    stages: ['adult'],
    when: (s) => hasFlag(s, 'cr.novelWin') && !creator(s),
    title: 'デビュー作のあと',
    body: '受賞作が本になり、書店の新刊の棚に並びました。担当の編集者からは、次の作品を早くと急かされています。',
    auto: 2,
    choices: [
      { label: '仕事を辞めて、専業の作家になる', hint: '書く時間は増えるが、収入は本の売れ行き次第', when: canStart, flag: 'cr.novel', effects: { career: 'novelist' }, outcomes: [{ follow: [{ id: 'x.creator.novelSlump', after: 3, within: 3 }], text: '最後の出勤日に同僚から万年筆を贈られ、その夜から、次の長編の一行目を書き始めました。' }] },
      { label: '今の暮らしのまま、兼業で書く', hint: '暮らしは安定するが、執筆は休日と夜だけ', flag: 'cr.novelSide', effects: { money: 40, happy: 2, health: -1 }, outcomes: [{ text: '平日は朝五時に起きて二時間書き、休日は図書館の窓際の席で書き続けました。' }] },
      { label: 'しばらく次作の構想を練る', outcomes: [{ text: '新しい小説の構想ノートを三冊作り、どれから書くか、決めかねていました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.creator.novelSlump',
    category: 'creatorWrite',
    stages: ['adult', 'senior'],
    when: is('novelist'),
    title: '書けない日々',
    body: '二作目、三作目と、売れ行きは下がっていきました。書きかけの原稿は、どれも途中で止まっています。',
    auto: 3,
    choices: [
      {
        label: '苦しくても、書き続ける',
        hint: '突き抜けるか、沈むか',
        outcomes: [
          { weight: 1, text: '五年かけた長編が書評で取り上げられ、重版がかかりました。スランプの長いトンネルを、ようやく抜けました。', effects: { payScale: 2, fame: 5, happy: 5 } },
          { weight: 1.3, text: '書き上げた作品は、初版のまま書店の棚から消えていきました。', effects: { payScale: 0.6, happy: -4 } },
        ],
      },
      {
        label: '野球を題材に、自分の知る世界を書く',
        hint: '本物の言葉が書けるが、読者を選ぶ',
        flag: 'cr.novelBall',
        outcomes: [
          { weight: 1.5, text: 'ベンチの隅にいる選手を主人公にした小説が、スポーツ好きの読者の間で静かに広まりました。', effects: { payScale: 1.5, happy: 4 } },
          { weight: 0.3, text: 'その野球小説が文学賞に選ばれ、授賞式には、昔のチームメイトも駆けつけてくれました。', kind: 'big', key: true, effects: { achieve: '文学賞受賞', fame: 10, payScale: 2, money: 100 } },
        ],
      },
      { label: '筆を置き、勤めに出る', hint: '暮らしは安定するが、作家の肩書きは過去になる', flag: 'cr.novelQuit', effects: { job: 'quit', happy: -2 }, outcomes: [{ text: '出版社に最後の挨拶をして、求人誌の経験不問の文字に赤い丸をつけました。' }] },
      { label: '書かずに本を読む時間を持つ', outcomes: [{ text: '一年間、書くことから離れ、昔好きだった本を一冊ずつ読み返しました。' }] },
    ],
  },
  {
    ...X,
    id: 'x.creator.memoir',
    category: 'creatorWrite',
    stages: ['senior'],
    ages: [65, 85],
    when: (s) => !hasFlag(s, 'cr.memoir') && !hasFlag(s, 'cr.memoirFamily'),
    weight: 2,
    maxPerLife: 1,
    title: '野球人生を書き残す',
    body: (s) =>
      hasFlag(s, 'cr.novel')
        ? '作家として長く書いてきましたが、自分自身のことは書いたことがありません。野球に始まった人生を、一冊にまとめてみようかと考えています。'
        : '野球に始まった自分の人生を、文章に残しておきたいと思うようになりました。',
    auto: 3,
    choices: [
      { label: '出版社から回想録を出す', hint: '多くの人に読まれるが、書くのは骨が折れる', when: has('cr.novel'), flag: 'cr.memoir', effects: { money: 80, fame: 3, happy: 4 }, outcomes: [{ follow: [{ id: 'x.creator.memoirBack', after: 1, within: 2 }], text: '作家としての最後の仕事と決め、少年野球のグラウンドの土の色から書き起こしました。' }] },
      { label: '自費出版で、一冊の本にする', hint: '形に残るが、費用は自分持ち', flag: 'cr.memoir', effects: { money: -60, happy: 5 }, outcomes: [{ follow: [{ id: 'x.creator.memoirBack', after: 1, within: 2 }], text: '印刷所から届いた三百冊の段ボールを開け、表紙の自分の名前を指でなぞりました。' }] },
      { label: '身近な人のためだけに書く', hint: '費用はかからないが、読む人は限られる', flag: 'cr.memoirFamily', effects: { rel: 4, happy: 3 }, outcomes: [{ text: (s) => `ノート五冊に手書きでまとめ、${youngKin(s)}に、いつか読んでほしいと渡しました。` }] },
      { label: '書こうとして、まだ手をつけない', outcomes: [{ text: '白いノートを机に置いたまま、題名だけを何度も書き直しました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.creator.memoirBack',
    category: 'creatorWrite',
    stages: ['senior'],
    when: has('cr.memoir'),
    outcomes: [
      { weight: 1.5, text: '本を読んだ昔のチームメイトから、長い手紙が届きました。あの試合の記憶は、相手の側から見ると少し違っていました。', effects: { rel: 4, happy: 4 } },
      { weight: 1, text: '地元の図書館が本を蔵書に加えてくれ、郷土の資料の棚に並びました。', effects: { happy: 3, fame: 1 } },
    ],
  },

  // ================================================================ illustrator
  {
    ...X,
    id: 'x.creator.illustStart',
    category: 'creatorArt',
    stages: ['adult'],
    ages: [20, 48],
    when: (s) => !creator(s) && !s.after?.retired && !hasFlag(s, 'cr.illust') && !hasFlag(s, 'cr.illustSide') && !hasFlag(s, 'cr.illustPass'),
    weight: 2,
    maxPerLife: 1,
    title: '絵の依頼',
    body: 'SNSに上げてきた絵を見た人から、有料で描いてほしいという依頼が届きました。こうした依頼が、月に何件か来るようになっています。',
    auto: 2,
    choices: [
      { label: '独立して、フリーランスのイラストレーターになる', hint: '好きなことで食べていけるが、仕事は自分で取りに行く', when: canStart, flag: 'cr.illust', effects: { career: 'illustrator', money: -25 }, outcomes: [{ follow: [{ id: 'x.creator.illustWork', after: 1, within: 2 }], text: '液晶タブレットを分割払いで買い、開業届を出した日の夜、最初の依頼の下描きに取りかかりました。' }] },
      { label: '今の暮らしのまま、副業で依頼を受ける', hint: '小遣いになるが、休日が減る', flag: 'cr.illustSide', effects: { money: 25, happy: 1, health: -1 }, outcomes: [{ text: '週末ごとに一枚ずつ仕上げ、振り込まれた報酬で、新しい画材を買いました。' }] },
      { label: '依頼は受けず、好きな絵だけを描く', flag: 'cr.illustPass', outcomes: [{ text: '丁寧に断りの返事を書き、また気ままに、描きたいものを描きました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.creator.illustWork',
    category: 'creatorArt',
    stages: ['adult'],
    when: is('illustrator'),
    title: '依頼の波',
    body: 'フリーランスになって一年。仕事は増えてきましたが、単価の安い依頼も多く、締め切りが重なっています。',
    auto: 2,
    choices: [
      { label: '来た依頼は、すべて受ける', hint: '収入は増えるが、休む暇がなくなる', effects: { money: 60, health: -3 }, outcomes: [{ follow: [{ id: 'x.creator.illustBurn', after: 1, within: 2 }], text: '一日に三枚の締め切りを抱え、食事はキーボードの横で済ませるようになりました。' }] },
      { label: '単価と内容で、仕事を選ぶ', flag: 'cr.illustPick', hint: '質は保てるが、収入は一時的に減る', effects: { payScale: 0.85, happy: 3 }, outcomes: [{ follow: [{ id: 'x.creator.illustKnown', after: 2, within: 3 }], text: '料金表を作り直し、描きたい仕事にだけ、お受けしますと返すようにしました。' }] },
      { label: '流れに任せる', outcomes: [{ follow: [{ id: 'x.creator.illustKnown', after: 3, within: 3 }], text: '来た順に、できる範囲で依頼を片づけていきました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.creator.illustBurn',
    category: 'creatorArt',
    stages: ['adult'],
    when: is('illustrator'),
    title: 'ペンが止まる',
    body: '朝、タブレットの電源を入れても、線が一本も引けません。締め切りの通知だけが、画面に積み上がっていきます。',
    auto: 2,
    choices: [
      { label: '仕事を減らして休む', flag: 'cr.illustRest', hint: '回復はできるが、取引先は離れるかもしれない', effects: { payScale: 0.6, happy: 4, health: 2 }, outcomes: [{ follow: [{ id: 'x.creator.illustKnown', after: 2, within: 3 }], text: '取引先に事情を伝え、半年間は月に一枚だけ描くことにしました。' }] },
      { label: '会社勤めに戻る', hint: '安定は戻るが、描く時間は減る', flag: 'cr.illustQuit', effects: { job: 'quit', happy: 1 }, outcomes: [{ text: 'フリーランスの看板を下ろし、デザイン会社の求人に応募してみることにしました。' }] },
      { label: '締め切りを一つずつこなす', outcomes: [{ text: '止まった線を少しずつ引き直し、遅れた締め切りに一つずつ頭を下げました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.creator.illustKnown',
    category: 'creatorArt',
    stages: ['adult', 'senior'],
    when: is('illustrator'),
    outcomes: [
      { weight: 1, text: '表紙を描いた小説が売れ、その絵を見た出版社から、依頼が次々に届くようになりました。', effects: { fame: 6, payScale: 1.8 } },
      { weight: (s) => (s.career.highestRank >= 5 ? 1.2 : 0.5), text: '野球の経験を買われ、地元の球場（架空）の記念ポスターを任されました。描いた打者のフォームが本物らしいと評判になりました。', effects: { fame: 4, payScale: 1.3, happy: 4 } },
      { weight: 1.2, text: '大きな話題にはならないものの、決まった取引先との仕事が、静かに続いています。', effects: { sat: 4 } },
    ],
  },
  {
    ...X,
    id: 'x.creator.illustLate',
    category: 'creatorArt',
    needsChoice: true,
    stages: ['senior'],
    ages: [65, 88],
    when: (s) => hasFlag(s, 'cr.illust') || hasFlag(s, 'cr.illustSide'),
    weight: 5,
    maxPerLife: 1,
    title: '絵筆と老後',
    body: '長く描いてきた手は、細い線を引くのが少しずつ難しくなってきました。それでも、描きたいものはまだあります。',
    auto: 2,
    choices: [
      { label: '近所の喫茶店で、小さな個展を開く', hint: '人と会えるが、費用と手間がかかる', effects: { money: -15, happy: 5, rel: 3 }, outcomes: [{ text: '壁に二十枚の絵を並べ、来た人とコーヒーを飲みながら、一枚ずつ描いたときの話をしました。' }] },
      { label: '大きな紙に、思い切り描く', hint: '自分のための時間だが、誰の目にも触れない', effects: { happy: 6, rel: -1 }, outcomes: [{ text: '細い線をやめ、太い筆で、昔のグラウンドの夕焼けを大きく描きました。' }] },
      { label: 'いつもの小さな絵を描き続ける', outcomes: [{ text: '毎朝一枚、窓から見える景色を葉書の大きさで描く習慣を続けました。' }] },
    ],
  },
]
