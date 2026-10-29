import type { LifeState } from '../../types.ts'
import type { EventSpec } from '../../events/spec.ts'
import { livesIn } from '../index.ts'

// Daily life of a US player (PROJECT_PLAN §11.36): health, work, friends, community and the things that get posted. They are
// declarative specs of the same kind as Japan's (events/spec.ts) and take part in the same draws, cooldowns and limits, so a screen
// life and the headless life of the same man meet the same ones, with the same おまかせ answers (`auto`, fixed or a function of the
// state). Each one is told apart by what it does:
//   news  - a line and no change at all (the things that get posted: a clip, a celebration, a fireworks night)
//   life  - a decision or a happening that moves money, relations, happiness, knowledge or a post (never the calibrated career,
//           the injuries, the ability or the death rate: those need `career: true`, which none of these has)
// Where each came from: "← x.…" is the Japanese event it is written again from (the US's money, system and manners); the others
// are the US's own. Every spec is tied to where he lives (`lives: 'US'`, `livesIn`), not where he was born, and is drawn by the
// resident pass (events.ts runResidentPass), not by the table of a birth country.
// The sums and the chances are game assumptions, not statistics; the systems named (college athletes' paid use of their name,
// health insurance, a retirement plan) are described in general terms only. All texts are original.

const PLAY: EventSpec['stages'] = ['hs', 'univ', 'pro']
const ALL: EventSpec['stages'] = ['hs', 'univ', 'pro', 'adult', 'senior']
// (a Japanese in the MLB is in phase 'abroad')
const inMlb = (s: LifeState) => s.career.phase === 'pro' || s.career.phase === 'abroad'
const farm = (s: LifeState) => s.career.phase === 'proMinor'
const working = (s: LifeState) => !!s.after?.work && !s.after.retired

/** the everyday subject of each category of this file (events.ts themeOf: one event of a subject a year across the tables) */
export const US_THEME: Record<string, string> = { usPosted: 'media', usHoliday: 'holiday', usSchool: 'school', usHealth: 'health', usWork: 'work', usFriends: 'friends', usCommunity: 'community' }

/**
 * a spec of daily life in the US: tied to the country he lives in (`lives`), not to the one he was born in, so a Japanese who plays in
 * the MLB meets it too (PROJECT_PLAN §11.37); `when` asks again, for the follow-ups that run outside the resident pass
 */
const us = (spec: EventSpec): EventSpec => ({ ...spec, lives: 'US', theme: US_THEME[spec.category], when: (s) => livesIn(s, 'US') && (!spec.when || spec.when(s)) })

export const US_DAILY_SPECS: EventSpec[] = [
  // ================================================================ news: a line, no change (what gets posted)
  us({ id: 'us.news.clip', category: 'usPosted', stages: PLAY, weight: 1.5, cooldown: 4, maxPerLife: 3, outcomes: [{ text: '試合中のダイビングキャッチの動画がSNSで拡散し、見知らぬ人から次々と「いいね」が届きました。', kind: 'good' }] }),
  us({ id: 'us.news.celebration', category: 'usPosted', stages: ['univ', 'pro'], weight: 1.2, cooldown: 5, maxPerLife: 2, outcomes: [{ text: 'ホームランを打った選手を迎える、ベンチの手作りの儀式が話題になりました。ファンが真似をする動画を投稿しています。', kind: 'good' }] }),
  us({ id: 'us.news.sign', category: 'usPosted', stages: ['pro'], weight: 1.2, cooldown: 5, maxPerLife: 2, outcomes: [{ text: '外野席で、子どもが「次のホームランはおばあちゃんのために」と書いたボードを掲げていました。その写真が広まりました。', kind: 'good' }] }),
  us({ id: 'us.news.anthem', category: 'usPosted', stages: ['hs', 'univ', 'pro'], weight: 1, cooldown: 6, maxPerLife: 2, outcomes: [{ text: '試合前の国歌斉唱を、地元の小学生の合唱団が務めました。帽子を胸に当てて聴く球場が静まり返り、その動画が拡散しました。', kind: 'normal' }] }),
  us({ id: 'us.news.mascotRace', category: 'usPosted', stages: ['pro'], weight: 1.2, cooldown: 5, maxPerLife: 2, when: (s) => inMlb(s) || farm(s), outcomes: [{ text: '五回の終わりのマスコットのレースで、先頭を走っていた着ぐるみが転び、球場中が笑いに包まれました。', kind: 'normal' }] }),
  us({ id: 'us.news.fireworks', category: 'usHoliday', stages: ALL, ages: [14, 90], weight: 1.4, cooldown: 4, maxPerLife: 5, outcomes: [{ text: '独立記念日の夜、球場の外野席から打ち上げ花火を見上げました。子どもも大人も、夜空に歓声を上げていました。', kind: 'normal' }] }),
  us({ id: 'us.news.tailgate', category: 'usSchool', stages: ['univ'], weight: 1.2, cooldown: 4, maxPerLife: 2, outcomes: [{ text: 'フットボールの試合のある週末、キャンパスの駐車場はテントと煙で埋まりました。野球部の仲間も、学校のTシャツを着て参加しました。', kind: 'normal' }] }),
  us({ id: 'us.news.friday', category: 'usSchool', stages: ['hs'], ages: [14, 17], weight: 1.5, cooldown: 3, maxPerLife: 2, outcomes: [{ text: '金曜の夜は、町中がフットボールの試合に集まりました。野球部の仲間と、スタンドの一番上で声を張り上げました。', kind: 'normal' }] }),
  us({ id: 'us.news.prom', category: 'usSchool', stages: ['hs'], ages: [16, 17], weight: 1.2, cooldown: 2, maxPerLife: 1, outcomes: [{ text: '最終学年の春、卒業前のダンスパーティー（プロム）がありました。写真に収まる仲間たちは、みんな照れくさそうに笑っていました。', kind: 'good' }] }),
  us({ id: 'us.news.diner', category: 'usPosted', stages: ['pro', 'univ'], weight: 1.2, cooldown: 4, maxPerLife: 3, outcomes: [{ text: '遠征の帰りに寄ったダイナーで、深夜の朝食を食べました。店員が、昔の試合を覚えていてくれました。', kind: 'good' }] }),
  us({ id: 'us.news.rainDelay', category: 'usPosted', stages: ['pro'], weight: 1, cooldown: 5, maxPerLife: 2, when: (s) => inMlb(s) || farm(s), outcomes: [{ text: '雨天中断の間、ブルペンの選手たちが防水シートの上を滑り、その動画が話題になりました。', kind: 'normal' }] }),
  us({ id: 'us.news.rookieCostume', category: 'usPosted', stages: ['pro'], weight: 1, cooldown: 8, maxPerLife: 1, when: (s) => inMlb(s) && s.career.proSeasons <= 2, outcomes: [{ text: '遠征の移動日、新人の選手は全員仮装をして空港を歩く伝統に従いました。着ぐるみ姿の写真が、SNSに並びました。', kind: 'good' }] }),
  us({ id: 'us.news.parade', category: 'usPosted', stages: ['adult', 'senior', 'pro'], ages: [22, 90], weight: 0.8, cooldown: 6, maxPerLife: 2, outcomes: [{ text: '地元のパレードを、道端の椅子に座って眺めました。バンドの演奏と紙吹雪の中、子どもたちが手を振っていました。', kind: 'normal' }] }),

  // ================================================================ posted (life): what to do with it
  us({
    id: 'us.sns.attention',
    category: 'usPosted',
    stages: PLAY,
    ages: [15, 40],
    weight: 1.5,
    cooldown: 5,
    maxPerLife: 2,
    title: '動画が広まった',
    body: '試合の動画が思わぬ形で拡散し、知らない人からメッセージが届くようになりました。ファンの数も一気に増えています。',
    auto: 1,
    choices: [
      { label: '自分でも投稿して、広まりに乗る', hint: '注目は集まるが、言葉には気を付ける', flag: 'sns.posted', follow: [{ id: 'us.sns.attentionBack', after: 1, within: 3 }], effects: { rel: 2, happy: 2 }, outcomes: [{ text: '試合後に感謝のひと言と写真を投稿すると、返信が瞬く間に積み重なりました。' }] },
      { label: '球団・学校の広報に任せ、練習に集中する', outcomes: [{ text: '広報の担当者が、返信と取材の窓口を引き受けてくれました。' }] },
      { label: '通知を切り、しばらくアプリを開かない', effects: { happy: 1, know: 1 }, outcomes: [{ text: 'スマートフォンの通知を切ると、静かな夜が戻ってきました。' }] },
    ],
  }),
  us({
    id: 'us.sns.attentionBack',
    category: 'usPosted',
    stages: PLAY,
    followOnly: true,
    when: (s) => s.flags?.['sns.posted'] !== undefined,
    outcomes: [
      { weight: 2, text: '投稿を見たファンが、試合のたびにスタンドで名前を呼んでくれるようになりました。', effects: { happy: 4, rel: 3 } },
      { weight: 1, text: '冗談のつもりの一言が切り取られて炎上し、謝罪の投稿を出すことになりました。', effects: { happy: -4, rel: -2 } },
    ],
  }),
  us({
    id: 'us.sns.hate',
    category: 'usPosted',
    stages: ['hs', 'univ', 'pro'],
    ages: [15, 38],
    when: (s) => s.status.happiness < 62,
    weight: 1.4,
    cooldown: 5,
    maxPerLife: 2,
    title: '心ない書き込み',
    body: '不調が続くなか、SNSに自分を名指しした中傷が並びました。見ないようにしても、つい画面を開いてしまいます。',
    auto: 1,
    choices: [
      { label: '言い返す', effects: { happy: -2 }, outcomes: [{ weight: 1, text: '強い言葉で言い返すと、さらに火が付き、一晩中通知が止まりませんでした。', effects: { happy: -3, rel: -2 } }, { weight: 1, text: '落ち着いた言い方で答えると、応援の声のほうが多く集まりました。', effects: { rel: 2 } }] },
      { label: 'ブロックして、見るのをやめる', outcomes: [{ text: '問題のアカウントをブロックし、スマートフォンから該当のアプリを消しました。', effects: { happy: 2 } }] },
      { label: '家族や仲間に打ち明ける', effects: { rel: 2 }, outcomes: [{ text: '打ち明けると、仲間が「見るな」と笑い飛ばしてくれました。胸のつかえが取れました。', effects: { happy: 3 } }] },
    ],
  }),
  us({
    id: 'us.sns.sponsor',
    category: 'usPosted',
    stages: ['pro'],
    ages: [20, 40],
    when: (s) => inMlb(s) && s.career.highestRank >= 8,
    weight: 1.4,
    cooldown: 5,
    maxPerLife: 2,
    title: '商品紹介の誘い',
    body: 'スポーツ用品メーカーから、SNSで商品を紹介してほしいという依頼が来ました。謝礼の話も出ています。',
    auto: 1,
    choices: [
      { label: '本当に使っている商品だけ、受ける', hint: '信頼は守れるが、収入は限られる', effects: { money: 40, rel: 1 }, outcomes: [{ text: '普段から使っているグラブを、自分の言葉で紹介しました。ファンの反応は上々でした。' }] },
      { label: '好条件の依頼を、数多く引き受ける', effects: { money: 120 }, outcomes: [{ weight: 1, text: '広告の投稿が続くと、ファンから「宣伝ばかり」という声が出てきました。', effects: { rel: -3, happy: -1 } }, { weight: 2, text: '収入は増えましたが、投稿の準備に追われる日が増えました。', effects: { happy: -1 } }] },
      { label: '野球に専念するため、すべて断る', outcomes: [{ text: '丁寧な断りの返事を書き、練習に戻りました。' }] },
    ],
  }),
  us({
    id: 'us.sns.nil',
    category: 'usPosted',
    stages: ['univ'],
    ages: [18, 21],
    weight: 1.6,
    cooldown: 5,
    maxPerLife: 1,
    title: '名前と顔を使った契約',
    body: '大学の選手でも、自分の名前や顔を使った報酬を受け取れる時代です。地元の店から、広告に出てほしいという話が来ました。',
    auto: 1,
    choices: [
      { label: '地元の店の広告に出て、報酬を受け取る', effects: { money: 30, rel: 2 }, outcomes: [{ text: '店のポスターと動画に出演しました。近所の人から声を掛けられるようになりました。' }] },
      { label: '先輩やコーチに相談してから決める', effects: { know: 2 }, outcomes: [{ text: '契約書の見方を教わり、条件を一つずつ確認してから返事をしました。' }] },
      { label: '学業と野球に集中するため、断る', outcomes: [{ text: '今は学業と練習で手一杯だと伝え、話は断りました。' }] },
    ],
  }),

  // ================================================================ health (no change to the ability, the injuries or the death rate)
  us({
    id: 'us.health.sleep',
    category: 'usHealth',
    stages: PLAY,
    ages: [14, 38],
    weight: 1.6,
    cooldown: 4,
    maxPerLife: 2,
    title: '睡眠の乱れ',
    body: 'ゲームと動画で寝るのが遅くなり、朝の練習で眠気が残るようになりました。コーチも気づいているようです。',
    auto: 1,
    choices: [
      { label: '夜は決まった時間にスマートフォンを置く', effects: { know: 1, happy: 1 }, outcomes: [{ text: '寝る一時間前に画面を閉じる約束を、自分に課しました。朝の体が軽くなりました。' }] },
      { label: '気にせず、今のリズムを続ける', outcomes: [{ text: '眠気はコーヒーでごまかして、夜は相変わらず遅くまで起きていました。' }] },
      { label: '睡眠の記録アプリを使い、数字で確かめる', effects: { know: 2, money: -3 }, outcomes: [{ text: '睡眠の記録を一週間つけると、思ったより短い睡眠が続いていることが分かりました。' }] },
    ],
  }),
  us({
    id: 'us.health.nutrition',
    category: 'usHealth',
    stages: ['hs', 'univ', 'pro'],
    ages: [15, 38],
    weight: 1.5,
    cooldown: 4,
    maxPerLife: 2,
    title: '食事のとり方',
    body: '遠征が続くと、食事がファストフードに偏ります。チームの栄養士から、食事の見直しを勧められました。',
    auto: 2,
    choices: [
      { label: '栄養士の指導を受け、食事を組み立て直す', hint: '手間と費用がかかる', effects: { know: 2, money: -10 }, outcomes: [{ text: '栄養士と一緒に遠征用のメニューを作り、クーラーボックスに果物とヨーグルトを詰めました。' }] },
      { label: '仲間と一緒に、いつものハンバーガーを楽しむ', effects: { rel: 2, happy: 1 }, outcomes: [{ text: '遠征の夜は、仲間と大きなハンバーガーを分け合いました。笑い声が絶えませんでした。' }] },
      { label: '好きなものを食べつつ、量だけ気を付ける', outcomes: [{ text: '好物はやめず、量と時間だけ気を付けるという、ほどほどの方針に落ち着きました。' }] },
    ],
  }),
  us({
    id: 'us.health.bill',
    category: 'usHealth',
    stages: ['pro', 'adult'],
    ages: [20, 60],
    weight: 1.4,
    cooldown: 5,
    maxPerLife: 2,
    title: '医療費の請求書',
    body: '通院のあとで、予想より高い請求書が届きました。保険がどこまで負担してくれるのか、よく分かりません。',
    auto: 0,
    choices: [
      { label: '内容を確認して、そのまま支払う', effects: { money: -40 }, outcomes: [{ text: '請求書を確認し、貯金から支払いました。痛い出費でした。' }] },
      { label: '保険会社に問い合わせ、明細を取り寄せる', hint: '手間はかかるが、減額されることもある', effects: { know: 2 }, outcomes: [{ weight: 1, text: '何度も電話をかけた末に、請求が二重になっていたことが分かり、一部が取り消されました。', effects: { money: -10 } }, { weight: 1, text: '長い待ち時間の末、請求は正しいと分かりました。結局、全額を支払いました。', effects: { money: -40, happy: -1 } }] },
    ],
  }),
  us({
    id: 'us.health.mind',
    category: 'usHealth',
    stages: ALL,
    ages: [14, 70],
    when: (s) => s.status.happiness < 55,
    weight: 1.8,
    cooldown: 5,
    maxPerLife: 2,
    title: '気持ちの落ち込み',
    body: '理由のはっきりしない疲れが続き、好きなことにも気が向かなくなりました。朝、起き上がるのが重く感じます。',
    auto: 1,
    choices: [
      { label: 'カウンセラーに相談する', hint: '時間と費用がかかるが、話すことで軽くなる', flag: 'mind.talked', follow: [{ id: 'us.health.mindBack', after: 1, within: 3 }], effects: { money: -15, happy: 2 }, outcomes: [{ text: '学校や球団が紹介してくれた専門家と、はじめて自分の気持ちを言葉にしました。' }] },
      { label: '信頼できる仲間や家族に話す', effects: { rel: 2 }, outcomes: [{ text: '話を聞いてもらううちに、一人で抱え込んでいたことに気づきました。', effects: { happy: 2 } }] },
      { label: '誰にも言わず、一人で乗り切ろうとする', effects: { happy: -2 }, outcomes: [{ text: '何も言わずに過ごしましたが、疲れだけが静かに積み重なっていきました。' }] },
    ],
  }),
  us({
    id: 'us.health.mindBack',
    category: 'usHealth',
    stages: ALL,
    followOnly: true,
    when: (s) => s.flags?.['mind.talked'] !== undefined,
    outcomes: [
      { weight: 2, text: '相談を続けるうちに、朝の重さが少しずつ取れていきました。同じ悩みを持つ仲間にも、勧めてみました。', effects: { happy: 4, rel: 2 } },
      { weight: 1, text: '通うのをやめてしまいましたが、相談した事実が支えになり、なんとか日々を過ごしています。', effects: { happy: 1 } },
    ],
  }),
  us({
    id: 'us.health.knee',
    category: 'usHealth',
    stages: ['adult', 'senior'],
    ages: [38, 80],
    weight: 1.5,
    cooldown: 6,
    maxPerLife: 2,
    title: '古傷が痛む',
    body: '野球をしていた頃の古傷が、雨の日になると痛みます。階段の上り下りもつらくなってきました。',
    auto: 0,
    choices: [
      { label: '理学療法士のもとで、運動を続ける', hint: '時間と費用がかかる', effects: { money: -20, health: 1 }, outcomes: [{ text: '週に二度の運動療法に通いました。膝の痛みが和らぎ、歩くのが楽になりました。' }] },
      { label: '痛み止めでごまかし、様子を見る', effects: { health: -1 }, outcomes: [{ text: '痛み止めに頼る日が増え、膝をかばう歩き方がくせになりました。' }] },
    ],
  }),

  // ================================================================ work (← x.life.partTimeChoice, x.contract.agent, x.life.jobChange, x.after.venture)
  us({
    id: 'us.work.lawn',
    category: 'usWork',
    stages: ['hs'],
    ages: [14, 17],
    weight: 1.4,
    cooldown: 3,
    maxPerLife: 2,
    title: '夏の小遣い稼ぎ',
    body: '夏休みに、近所の庭の芝刈りを頼まれました。練習や遠征の合間にできる、短い仕事です。',
    auto: 1,
    choices: [
      { label: '近所をまわって、芝刈りの仕事を請け負う', effects: { money: 6, know: 1, rel: 1 }, outcomes: [{ text: '芝刈り機を借りて近所をまわりました。夏が終わるころには、小さな貯金ができました。' }] },
      { label: '練習と遠征に専念し、お小遣いで間に合わせる', outcomes: [{ text: '稼ぐより練習を優先し、お小遣いの範囲でやり繰りしました。' }] },
    ],
  }),
  us({
    id: 'us.work.offseason',
    category: 'usWork',
    stages: ['pro'],
    ages: [20, 38],
    when: (s) => farm(s) || (inMlb(s) && s.career.proSeasons <= 4),
    weight: 1.8,
    cooldown: 3,
    maxPerLife: 3,
    title: 'オフの副業',
    body: 'マイナーの給料は多くありません。シーズンオフの間に、収入になる仕事を探す選手が大勢います。',
    auto: 2,
    choices: [
      { label: '地元のスポーツ施設で、子どもに野球を教える', effects: { money: 25, rel: 2 }, outcomes: [{ text: '冬の室内練習場で、少年少女にバッティングを教えました。親たちとも顔見知りになりました。' }] },
      { label: '配送や運転の仕事で、集中的に稼ぐ', effects: { money: 45, happy: -2 }, outcomes: [{ text: '早朝から夜まで、荷物を運びました。体はきつかったものの、通帳の残高は目に見えて増えました。' }] },
      { label: 'トレーニングと家族との時間に専念する', outcomes: [{ text: '稼ぎよりも、体づくりと家族との時間を優先して冬を過ごしました。' }] },
    ],
  }),
  us({
    id: 'us.work.agent',
    category: 'usWork',
    stages: ['univ', 'pro'],
    ages: [19, 36],
    when: (s) => s.career.phase === 'univ' || farm(s),
    weight: 1.4,
    cooldown: 6,
    maxPerLife: 1,
    title: 'エージェントを選ぶ',
    body: '契約や進路の話が増え、代理人をつけるかどうか考える時期になりました。何人かの代理人が連絡をくれています。',
    auto: 1,
    choices: [
      { label: '実績のある大手の代理人に任せる', hint: '手数料は高いが、情報と交渉力がある', effects: { money: -15, know: 1 }, outcomes: [{ text: '大手の代理人と契約しました。契約書の読み方まで、丁寧に教わりました。' }] },
      { label: '知人の弁護士に、契約書だけ見てもらう', effects: { money: -5, know: 2 }, outcomes: [{ text: '知り合いの弁護士に条項を確認してもらい、気になる点だけ修正しました。' }] },
      { label: 'すべて自分で交渉する', outcomes: [{ weight: 1, text: '自分で交渉した条件は思った以上に良く、胸を張って契約書にサインしました。', effects: { money: 15 } }, { weight: 1, text: '条項の意味を読み違え、後から不利な条件に気づきました。', effects: { money: -20, happy: -2 } }] },
    ],
  }),
  us({
    id: 'us.work.degree',
    category: 'usWork',
    stages: ['univ', 'pro'],
    ages: [19, 35],
    weight: 1.3,
    cooldown: 6,
    maxPerLife: 1,
    title: '学位をどうするか',
    body: '野球が終わったあとの人生を考えると、学位は大きな意味を持ちます。遠征や契約のなかで、授業をどう組むか悩んでいます。',
    auto: 1,
    choices: [
      { label: 'オンラインの授業で、少しずつ単位を取る', effects: { know: 4, happy: -1, money: -10 }, outcomes: [{ text: '遠征のバスの中でノートパソコンを開き、課題を提出しました。' }] },
      { label: '野球が終わってから考える', outcomes: [{ text: '今は野球のことだけを考え、学位の話は後回しにしました。' }] },
    ],
  }),
  us({
    id: 'us.work.venture',
    category: 'usWork',
    stages: ['pro', 'adult'],
    ages: [24, 55],
    when: (s) => s.money >= 200,
    weight: 1.3,
    cooldown: 8,
    maxPerLife: 1,
    title: '友人の事業の誘い',
    body: '昔からの友人が、地元でスポーツ用品店を開く計画に誘ってくれました。出資者を探しているそうです。',
    auto: 1,
    choices: [
      { label: '出資する', hint: '成功すれば配当があるが、失敗すれば戻らない', flag: 'us.venture', follow: [{ id: 'us.work.ventureBack', after: 3, within: 5 }], effects: { money: -100 }, outcomes: [{ text: '友人と一緒に事業計画を読み込み、出資の契約書にサインしました。' }] },
      { label: '出資せず、客として店を応援する', outcomes: [{ text: '出資は丁重に断りつつ、開店の日に最初の客として顔を出すと約束しました。' }] },
    ],
  }),
  us({
    id: 'us.work.ventureBack',
    category: 'usWork',
    stages: ['pro', 'adult', 'senior'],
    followOnly: true,
    when: (s) => s.flags?.['us.venture'] !== undefined,
    outcomes: [
      { weight: 2, text: '店は地元の少年野球チームに支えられ、軌道に乗りました。出資した分に、配当が付いて戻ってきました。', effects: { money: 160, happy: 3 } },
      { weight: 1, text: '大型店の進出に押され、店は閉店しました。出資金は戻ってきませんでした。', effects: { happy: -3 } },
    ],
  }),
  us({
    id: 'us.work.promotion',
    category: 'usWork',
    stages: ['adult'],
    ages: [27, 58],
    when: working,
    weight: 1.6,
    cooldown: 5,
    maxPerLife: 2,
    title: '昇進の打診',
    body: '職場の上司から、チームを任せたいという話が出ました。責任が増える分、給料も上がります。',
    auto: 0,
    choices: [
      { label: '引き受ける', effects: { sat: 3, level: 1, money: 30, happy: -1 }, outcomes: [{ text: '新しい肩書の名刺を作り、部下との面談を始めました。' }] },
      { label: '今の仕事のまま、時間を優先する', effects: { sat: 1, rel: 1 }, outcomes: [{ text: '家族や趣味の時間を守るため、打診は丁重に断りました。' }] },
    ],
  }),

  // ================================================================ friends (← x.univ.roommate, x.life.reunion, friends.wedding, x.life.friendCircle)
  us({
    id: 'us.friends.roommate',
    category: 'usFriends',
    stages: ['univ'],
    ages: [18, 21],
    weight: 1.6,
    cooldown: 4,
    maxPerLife: 1,
    title: '同室の仲間',
    body: '寮の同室になったのは、他の競技の学生でした。生活の時間帯がまるで違い、最初はぎくしゃくしています。',
    auto: 1,
    choices: [
      { label: '時間を決めて、お互いの生活を尊重し合う', flag: 'us.roommate', follow: [{ id: 'us.friends.roommateBack', after: 2, within: 4 }], effects: { rel: 2, know: 1 }, outcomes: [{ text: '消灯の時間と掃除の分担を紙に書いて、ドアに貼りました。' }] },
      { label: '部屋ではあまり関わらず、野球部の仲間と過ごす', outcomes: [{ text: '部屋には寝に帰るだけにして、食事も練習も野球部の仲間と過ごしました。' }] },
    ],
  }),
  us({
    id: 'us.friends.roommateBack',
    category: 'usFriends',
    stages: ['univ', 'pro', 'adult'],
    followOnly: true,
    when: (s) => s.flags?.['us.roommate'] !== undefined,
    outcomes: [
      { weight: 2, text: '同室だった友人が、試合に足を運んでくれました。競技は違っても、一番の理解者になっていました。', effects: { rel: 4, happy: 3 } },
      { weight: 1, text: '卒業と同時に連絡が途絶えました。それでも、あの狭い部屋の夜は忘れていません。', effects: { happy: 1 } },
    ],
  }),
  us({
    id: 'us.friends.hometown',
    category: 'usFriends',
    stages: ['univ', 'pro'],
    ages: [19, 35],
    weight: 1.5,
    cooldown: 4,
    maxPerLife: 3,
    title: '地元の旧友',
    body: '高校時代の友人たちが、地元に帰ってきたら集まろうと連絡をくれました。ちょうどオフの時期です。',
    auto: 0,
    choices: [
      { label: '帰って集まりに顔を出す', effects: { rel: 3, happy: 3, money: -10 }, outcomes: [{ text: '昔のあだ名で呼ばれ、夜遅くまでバーベキューの火を囲んで話し込みました。' }] },
      { label: 'トレーニングを優先して、断る', effects: { rel: -1 }, outcomes: [{ text: '予定を理由に断りました。写真だけが後からグループに届きました。' }] },
    ],
  }),
  us({
    id: 'us.friends.bachelor',
    category: 'usFriends',
    stages: ['pro', 'adult'],
    ages: [23, 40],
    weight: 1.2,
    cooldown: 5,
    maxPerLife: 3,
    title: '友人の独身最後のパーティー',
    body: '親しい友人が結婚することになり、独身最後の週末の旅行に誘われました。遠方で、練習や仕事の休みも取らなければなりません。',
    auto: 0,
    choices: [
      { label: '休みを取って、参加する', effects: { rel: 3, happy: 3, money: -40 }, outcomes: [{ text: '山小屋での釣りとバーベキューで、新郎を囲んで一晩中笑い合いました。' }] },
      { label: '祝いのメッセージと贈り物だけ送る', effects: { money: -10 }, outcomes: [{ text: '参加はできませんでしたが、心のこもった贈り物と動画のメッセージを送りました。' }] },
    ],
  }),
  us({
    id: 'us.friends.neighbors',
    category: 'usFriends',
    stages: ['adult', 'senior', 'pro'],
    ages: [24, 85],
    when: (s) => s.after?.home !== 'parents',
    weight: 1.3,
    cooldown: 4,
    maxPerLife: 3,
    title: '隣人のバーベキュー',
    body: '隣の家から、週末のバーベキューに誘われました。まだ、あまり話したことのない人たちです。',
    auto: 0,
    choices: [
      { label: '飲み物を持って、顔を出す', effects: { rel: 3, happy: 2 }, outcomes: [{ text: '焼けた肉を囲み、犬の話や学校の話で盛り上がりました。次の週末は、自分の家に招く約束をしました。' }] },
      { label: '用事があると言って、断る', outcomes: [{ text: '丁寧に断りましたが、庭先から聞こえる笑い声が、一晩中耳に残りました。' }] },
    ],
  }),
  us({
    id: 'us.friends.rookie',
    category: 'usFriends',
    stages: ['pro'],
    ages: [19, 28],
    when: (s) => s.career.proSeasons <= 2 || farm(s),
    weight: 1.4,
    cooldown: 4,
    maxPerLife: 2,
    title: '先輩のおごり',
    body: '遠征先の夜、年上の選手が「新人はついてこい」と、チームの食事会に誘ってくれました。支払いは任せる、と目配せされています。',
    auto: 0,
    choices: [
      { label: '礼を言って、席に着く', effects: { rel: 3, happy: 2 }, outcomes: [{ text: '先輩たちの昔話に笑いながら、野球の考え方を聞かせてもらいました。' }] },
      { label: '体調管理を理由に、早く休む', outcomes: [{ text: '礼を言ってホテルに戻り、翌朝の試合に向けて早く眠りました。' }] },
    ],
  }),

  // ================================================================ community (← x.fan.club, x.trainer.kidClinic, x.after.localFestival)
  us({
    id: 'us.community.hospital',
    category: 'usCommunity',
    stages: ['hs', 'univ', 'pro'],
    ages: [15, 40],
    weight: 1.5,
    cooldown: 4,
    maxPerLife: 3,
    title: '小児病院の訪問',
    body: '地域の小児病院から、選手に訪問してほしいという依頼が来ました。入院している子どもたちが待っています。',
    auto: 0,
    choices: [
      { label: '仲間と一緒に病棟を訪ね、一人ひとりと話す', effects: { rel: 3, happy: 3 }, outcomes: [{ text: 'サインボールを手渡すと、子どもたちの顔がぱっと明るくなりました。' }] },
      { label: '寄付だけして、訪問は見送る', effects: { money: -20 }, outcomes: [{ text: '日程が合わず、グッズと寄付金を病院に届けてもらうことにしました。' }] },
    ],
  }),
  us({
    id: 'us.community.clinic',
    category: 'usCommunity',
    stages: ['univ', 'pro', 'adult'],
    ages: [19, 60],
    weight: 1.4,
    cooldown: 4,
    maxPerLife: 3,
    title: '少年野球教室',
    body: '地域のリトルリーグから、週末の野球教室を手伝ってほしいという頼みがありました。無償のボランティアです。',
    auto: 0,
    choices: [
      { label: '引き受けて、子どもたちに教える', effects: { rel: 3, happy: 3 }, outcomes: [{ text: '小さな選手たちが、ミットを構えて真剣な顔で投げ返してくれました。' }] },
      { label: '忙しいので、今回は断る', outcomes: [{ text: '日程が詰まっていて、今回は断りました。代わりの講師を紹介しました。' }] },
    ],
  }),
  us({
    id: 'us.community.charityGame',
    category: 'usCommunity',
    stages: ['pro', 'adult'],
    ages: [22, 55],
    when: (s) => inMlb(s) || s.career.highestRank >= 8,
    weight: 1.2,
    cooldown: 5,
    maxPerLife: 2,
    title: 'チャリティーの試合',
    body: '地元の基金が、元選手と現役選手を集めた慈善試合を開くことになりました。収益は地域の学校に寄付されます。',
    auto: 0,
    choices: [
      { label: '出場して、一日付き合う', effects: { rel: 3, happy: 3, money: -5 }, outcomes: [{ text: '観客席に家族連れが並び、サイン会の列が球場の外まで伸びました。' }] },
      { label: '寄付金だけを出す', effects: { money: -30 }, outcomes: [{ text: '日程の都合で出場はできず、寄付金を届けました。' }] },
    ],
  }),
  us({
    id: 'us.community.volunteer',
    category: 'usCommunity',
    stages: ['adult', 'senior'],
    ages: [30, 85],
    weight: 1.4,
    cooldown: 5,
    maxPerLife: 3,
    title: '地域の手伝い',
    body: '町内の学校で、スポーツ大会の運営ボランティアを募集していました。顔見知りの先生が、声をかけてくれました。',
    auto: 0,
    choices: [
      { label: '週末を使って手伝う', effects: { rel: 3, happy: 2 }, outcomes: [{ text: '旗を振り、水を配り、子どもたちのゴールを一緒に喜びました。' }] },
      { label: '今は手が回らないので、見送る', outcomes: [{ text: '日程が重なり、今回は見送りました。' }] },
    ],
  }),
  us({
    id: 'us.community.reading',
    category: 'usCommunity',
    stages: ['pro', 'univ'],
    ages: [19, 36],
    weight: 1.1,
    cooldown: 5,
    maxPerLife: 2,
    title: '学校の読み聞かせ',
    body: '地元の小学校から、選手に本を読み聞かせてほしいという誘いがありました。教室は、グローブの絵で飾られているそうです。',
    auto: 0,
    choices: [
      { label: '引き受けて、教室を訪ねる', effects: { rel: 2, happy: 3, know: 1 }, outcomes: [{ text: '教室で、野球の絵本を読みました。子どもたちが、質問を次々と投げかけてくれました。' }] },
      { label: '用事があって、断る', outcomes: [{ text: '日程が合わず、手紙だけ送りました。' }] },
    ],
  }),
]

/** which of the specs only tell something ("news") and which change a life ("life"): derived from what they do */
export const US_DAILY_KINDS: Record<string, 'news' | 'life'> = Object.fromEntries(
  US_DAILY_SPECS.map((s) => {
    const outs = [...(s.outcomes ?? []), ...(s.choices ?? []).flatMap((c) => c.outcomes)]
    const changes = !!s.choices || outs.some((o) => (o.effects && Object.keys(o.effects).length > 0) || (o.follow && o.follow.length > 0))
    return [s.id, changes ? 'life' : 'news'] as const
  }),
)
