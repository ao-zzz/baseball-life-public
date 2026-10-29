import type { LifeState } from '../types.ts'
import { hasFlag, type EventSpec, holdsJob } from './spec.ts'

// Equipment that breaks, weights and the risk that comes with them, hiding a pain, the night before a big game, the
// dormitory, studying for the entrance examination, the family in the stands, a decision on surgery, the first
// winter as a rookie, the club's fans; after school the failed first choice, a move, the parents' house, a body
// that needs care for good (PROJECT_PLAN §11.16). Each decision has choices with different effects, outcomes
// that differ and follow-ups; the おまかせ choice only sets facts (spec.ts NEUTRAL_FORBIDDEN). All texts are original.

const X = { extra: true, career: true } as const
const F = { ...X, followOnly: true } as const
const A = { extra: true } as const
const AF = { extra: true, followOnly: true } as const
const inTeam = (s: LifeState) => !!s.bb && ['hs', 'univ', 'company', 'indep', 'proMinor', 'pro'].includes(s.career.phase)
const injuries = (s: LifeState) => s.bb?.injuries ?? 0
/** the last school he entered was his second choice, and that exam was this year or last (a high school at 14–15, a university at 17–19) */
const fellBack = (s: LifeState) => {
  const u = s.schools?.univ
  if (u) return !!u.fellBack && s.age <= 19
  return !!s.schools?.hs?.fellBack && s.age <= 15
}

export const MORE_LIFE: EventSpec[] = [
  // ---------------------------------------------------------------- gear and body
  {
    ...X,
    id: 'x.gear.breakage',
    category: 'gear',
    stages: ['hs', 'univ', 'amateur', 'pro'],
    when: (s) => inTeam(s) && !hasFlag(s, 'gear.newModel'),
    weight: 2,
    cooldown: 4,
    maxPerLife: 2,
    title: '道具が壊れた',
    body: '愛用していたバット（グラブ）が、練習中にひびが入って使えなくなりました。次の試合までに、代わりを用意しなければなりません。',
    auto: 2,
    choices: [
      { label: '最新のモデルを試して、買い替える', hint: '感覚が合えば伸びるが、慣れるまで時間がかかる', flag: 'gear.newModel', follow: [{ id: 'x.gear.newModelBack', after: 1, within: 2 }], effects: { money: -12, conf: -1 }, outcomes: [{ text: '店で何本も振り比べ、重心の違う新しいモデルを選びました。' }] },
      { label: '同じ型を探して、買い直す', effects: { money: -8, conf: 1 }, outcomes: [{ weight: 2, text: '同じ型がまだ売られていて、手に取った瞬間にしっくりきました。' }, { weight: 1, text: '同じ型でも、少し重さが違い、慣らすのに数週間かかりました。', effects: { conf: -1 } }] },
      { label: '仲間から借りて、しばらくしのぐ', outcomes: [{ text: '仲間のバット（グラブ）を借りて、違和感を抱えながら試合に臨みました。' }] },
    ],
  },
  {
    ...F,
    id: 'x.gear.newModelBack',
    category: 'gear',
    stages: ['hs', 'univ', 'amateur', 'pro'],
    when: (s) => inTeam(s) && hasFlag(s, 'gear.newModel'),
    outcomes: [
      { weight: 2, text: '新しい道具は、半年もすると体の一部のようになじみ、打球・球筋にも変化が表れました。', effects: { skill: { contact: 0.08, fielding: 0.06 }, conf: 3 } },
      { weight: 1, text: '新しい道具はどうしてもしっくりこず、結局、以前の型に戻しました。出費だけが残りました。', effects: { money: -8, conf: -2 } },
    ],
  },
  {
    ...X,
    id: 'x.strength.program',
    category: 'bodyBuild',
    stages: ['hs', 'univ', 'amateur', 'pro'],
    when: (s) => inTeam(s) && s.age >= 16 && !hasFlag(s, 'strength.heavy'),
    weight: 4,
    cooldown: 3,
    maxPerLife: 2,
    title: '筋力トレーニングの進め方',
    body: 'トレーニング室の使い方を、決めなければなりません。重い重量を扱うか、軽めの回数を重ねるか。意見は分かれています。',
    auto: 2,
    choices: [
      { label: '重い重量で、段階的に最大筋力を上げる', hint: '飛距離と球速が伸びるが、故障の危険も高まる', flag: 'strength.heavy', follow: [{ id: 'x.strength.heavyBack', after: 1, within: 3 }], effects: { gain: 0.03, fatigue: 8, skill: { power: 0.1 } }, outcomes: [{ text: '専用のメニューを組み、スクワットとデッドリフトの重量を週ごとに少しずつ上げていきました。', effects: { conf: 2 } }] },
      { label: '自重と体幹中心で、動ける体を作る', effects: { gain: 0.02, fatigue: 3, skill: { speed: 0.06, fielding: 0.06 } }, outcomes: [{ text: '器具に頼らず、自重のトレーニングと体幹の安定を重視した体づくりを続けました。' }] },
      { label: '今までどおり、チームのメニューに従う', outcomes: [{ text: '特別なことはせず、決められたメニューの回数をこなしました。' }] },
    ],
  },
  {
    ...F,
    id: 'x.strength.heavyBack',
    category: 'bodyBuild',
    stages: ['hs', 'univ', 'amateur', 'pro'],
    when: (s) => inTeam(s) && hasFlag(s, 'strength.heavy'),
    outcomes: [
      { weight: 2, text: '一年で扱える重量が大きく伸び、打球の勢いと球の伸びがはっきり変わりました。', effects: { gain: 0.04, skill: { power: 0.1, velocity: 0.08 }, conf: 4 } },
      // heavy loads and a history of injuries do not go well together: the weight grows with the injuries so far
      { weight: (s) => 0.6 + 0.8 * injuries(s), text: '重い重量を扱うフォームに無理があり、腰を痛めてしまいました。', kind: 'bad', effects: { injury: 1, conf: -4, health: -2 } },
    ],
  },
  {
    ...X,
    id: 'x.injury.warning',
    category: 'injuryRisk',
    stages: ['hs', 'univ', 'amateur', 'pro'],
    when: (s) => inTeam(s) && (s.bb?.fatigue ?? 0) >= 45 && s.career.injured === 0 && (role(s) === 'starter' || role(s) === 'bench'),
    weight: 20,
    cooldown: 3,
    maxPerLife: 2,
    title: '体の違和感',
    // (a pitcher feels it in the shoulder, a fielder in the knee)
    body: (s) => `大事な試合の前に、${s.person.position === 'P' ? '肩' : '膝'}に小さな違和感があります。まだ動かせますが、いつもと違います。`,
    auto: 2,
    choices: [
      { label: 'すぐに申告して、検査と休養を受ける', hint: '出番を失うかもしれないが、大きな故障を防げる', effects: { fatigue: -12, eval: -1, conf: -1 }, outcomes: [{ weight: 2, text: '検査で軽い炎症が見つかり、数日の休養と治療で、症状は消えました。', effects: { health: 1 } }, { weight: 1, text: '何も見つからず、「慎重すぎる」と言われましたが、安心して試合に臨めました。', effects: { conf: 1 } }] },
      { label: '黙って出場し続ける', hint: '出番は守れるが、悪化すれば長引く', flag: 'injury.hidden', follow: [{ id: 'x.injury.hiddenBack', after: 1, within: 2 }], effects: { eval: 2, fatigue: 4 }, outcomes: [{ text: '痛み止めを飲んで、何事もないふりをして試合に出続けました。' }] },
      { label: '様子を見ながら、いつもどおり練習する', outcomes: [{ text: '強い痛みではなかったため、練習の量だけを少し落として様子を見ました。' }] },
    ],
  },
  {
    ...F,
    id: 'x.injury.hiddenBack',
    category: 'injuryRisk',
    stages: ['hs', 'univ', 'amateur', 'pro'],
    when: (s) => inTeam(s) && hasFlag(s, 'injury.hidden'),
    outcomes: [
      { weight: (s) => 0.8 + 0.6 * injuries(s), text: '隠していた痛みは悪化し、ある日の練習で、ついに動けなくなりました。長い戦線離脱になりました。', kind: 'bad', effects: { injury: 2, conf: -6, health: -3 } },
      { weight: 2, text: '痛みはいつのまにか引き、何事もなく乗り切れました。ただ、運がよかっただけだと、自分でもわかっています。', effects: { conf: 2 } },
    ],
  },
  {
    ...X,
    id: 'x.injury.surgery',
    category: 'injuryRisk',
    stages: ['hs', 'univ', 'amateur', 'pro'],
    when: (s) => inTeam(s) && injuries(s) >= 2 && s.career.injured === 0 && !hasFlag(s, 'surgery.decided'),
    weight: 4,
    maxPerLife: 1,
    title: '手術か、保存療法か',
    body: '同じ箇所の故障が、これで何度目でしょうか。医師からは、手術をして根本から直す方法と、保存療法を続ける方法の二つが示されました。',
    auto: 2,
    choices: [
      { label: '手術を受けて、長いリハビリに入る', hint: '一年近く離れるが、根本から直せる', flag: 'surgery.decided', follow: [{ id: 'x.injury.surgeryBack', after: 2, within: 3 }], effects: { injury: 1, money: -40, conf: -5, health: -2 }, outcomes: [{ text: '手術台に上がる前の晩、天井を見ながら、復帰した自分の姿を何度も思い描きました。' }] },
      { label: '保存療法を続けながら、騙し騙しプレーを続ける', flag: 'surgery.decided', follow: [{ id: 'x.injury.conservativeBack', after: 1, within: 3 }], effects: { fatigue: 4 }, outcomes: [{ text: '定期的な注射と筋力トレーニングで、痛みを抑えながら続ける道を選びました。' }] },
      { label: '決断を先送りにして、様子を見る', outcomes: [{ text: '医師には、もう少し考えると伝えて、診察室をあとにしました。' }] },
    ],
  },
  {
    ...F,
    id: 'x.injury.surgeryBack',
    category: 'injuryRisk',
    stages: ['hs', 'univ', 'amateur', 'pro'],
    when: (s) => inTeam(s) && hasFlag(s, 'surgery.decided'),
    outcomes: [
      { weight: 2, text: 'リハビリを乗り越えて戻った体は、痛みなく、以前より思い切って動けるようになっていました。', effects: { gain: 0.05, conf: 6, health: 3 } },
      { weight: 1, text: 'リハビリは思うように進まず、元の水準に戻るまでに、予想以上の時間を要しました。', effects: { conf: -3, gain: 0.01 } },
    ],
  },
  {
    ...F,
    id: 'x.injury.conservativeBack',
    category: 'injuryRisk',
    stages: ['hs', 'univ', 'amateur', 'pro'],
    when: (s) => inTeam(s) && hasFlag(s, 'surgery.decided'),
    outcomes: [
      { weight: 1, text: '保存療法が功を奏し、痛みと付き合いながらも、シーズンを通して出場を続けられました。', effects: { conf: 3, eval: 2 } },
      { weight: (s) => 0.5 + 0.5 * injuries(s), text: '痛みは抑えきれず、結局、シーズン途中で離脱することになりました。', kind: 'bad', effects: { injury: 1, conf: -4 } },
    ],
  },
  // ---------------------------------------------------------------- the big game, the dormitory, the exam, the family
  {
    ...X,
    id: 'x.tourn.eve',
    category: 'tournament',
    stages: ['hs', 'univ'],
    when: (s) => inTeam(s) && (role(s) === 'starter' || role(s) === 'bench') && s.career.phaseYears >= 1,
    weight: 12,
    cooldown: 2,
    maxPerLife: 3,
    title: '大一番の前の夜',
    body: '明日は、勝てば全国が見える一戦です。ベッドに入っても、頭の中で何度も試合の場面が繰り返されます。',
    auto: 2,
    choices: [
      { label: '監督に電話して、ミーティングを開いてもらう', hint: '不安は消えるが、夜更かしになる', flag: 'eve.meeting', follow: [{ id: 'x.tourn.eveBack', after: 1, within: 2 }], effects: { rel: 3, fatigue: 4, eval: 1 }, outcomes: [{ text: '夜遅く、数人の仲間と監督の部屋に集まり、明日の入りの確認をしました。' }] },
      { label: '一人で好きな音楽を聴いて、気持ちを落ち着ける', effects: { conf: 2, fatigue: -3 }, outcomes: [{ text: 'イヤホンで好きな曲を聴きながら、いつのまにか眠りに落ちました。' }] },
      { label: 'いつもどおりに寝る', outcomes: [{ text: '何も考えないようにして、部屋の明かりを消しました。' }] },
    ],
  },
  {
    ...F,
    id: 'x.tourn.eveBack',
    category: 'tournament',
    stages: ['hs', 'univ'],
    when: (s) => inTeam(s) && hasFlag(s, 'eve.meeting'),
    outcomes: [
      { weight: 2, text: '前夜に確認したサインと守備位置が、接戦の終盤でぴたりとはまり、勝利をたぐり寄せました。', effects: { eval: 4, conf: 4, rel: 2 } },
      { weight: 1, text: '遅くまでの話し合いで睡眠不足になり、序盤に集中を欠いて、試合を壊しかけました。', effects: { conf: -3, fatigue: 5 } },
    ],
  },
  {
    ...X,
    id: 'x.hs.dorm',
    category: 'campusLife',
    stages: ['hs', 'univ'],
    when: (s) => inTeam(s) && s.career.strongSchool && s.career.phaseYears <= 1 && !hasFlag(s, 'dorm.life'),
    weight: 5,
    maxPerLife: 1,
    title: '寮の生活',
    body: '寮では、朝の掃除から夜の洗濯まで、上級生に合わせた生活が決まっています。慣れない集団生活に、心が疲れる日もあります。',
    auto: 2,
    choices: [
      { label: '同部屋の仲間と本音で話し、助け合う', hint: '絆ができるが、時間も気も使う', flag: 'dorm.life', follow: [{ id: 'x.hs.dormBack', after: 3, within: 6 }], effects: { rel: 5, happy: 3 }, outcomes: [{ text: '消灯後の暗い部屋で、お互いの悩みを小声で打ち明け合うようになりました。' }] },
      { label: '規則を守って黙々とこなし、野球に集中する', effects: { fatigue: 3, conf: 1 }, outcomes: [{ text: '決められたことをきちんとこなし、余計な付き合いは最小限にしました。' }] },
      { label: '週末の外出を楽しみに、日々をやり過ごす', outcomes: [{ text: '週末の外出許可を楽しみにして、平日を淡々と乗り切りました。' }] },
    ],
  },
  {
    ...F,
    id: 'x.hs.dormBack',
    category: 'campusLife',
    stages: ['hs', 'univ', 'amateur', 'pro', 'adult', 'senior'],
    when: (s) => hasFlag(s, 'dorm.life'),
    outcomes: [
      { weight: 3, text: '寮で寝食をともにした仲間とは、何年たっても、顔を合わせれば昨日の続きのように話せます。', effects: { rel: 5, happy: 4 } },
      { weight: 1, text: '寮の仲間の一人が、結婚式のスピーチを頼んでくれました。あのころの話を、笑い話にして語りました。', effects: { rel: 4, happy: 5 } },
    ],
  },
  {
    ...X,
    id: 'x.hs.entrance',
    category: 'studyLife',
    stages: ['hs'],
    when: (s) => s.career.phase === 'hs' && s.career.phaseYears >= 1 && !hasFlag(s, 'exam.study') && !hasFlag(s, 'exam.baseballOnly'),
    weight: 24,
    maxPerLife: 1,
    title: '進路と受験勉強',
    body: '先生から、卒業後の進路について、早めに考えるように言われました。野球の練習で疲れ切り、教科書を開く余力は多くありません。',
    auto: 2,
    choices: [
      { label: '練習のあとに、毎日一時間は机に向かう', hint: '疲れるが、学力で進路の選択肢が広がる', flag: 'exam.study', follow: [{ id: 'x.hs.entranceBack', after: 1, within: 2 }], effects: { know: 6, fatigue: 6, happy: -1 }, outcomes: [{ text: '寮（自宅）の机で、英単語と数学の問題集を、少しずつ進めるようになりました。' }] },
      { label: '野球に専念して、進路は推薦に賭ける', flag: 'exam.baseballOnly', follow: [{ id: 'x.hs.entranceBack', after: 1, within: 2 }], effects: { gain: 0.02, conf: 2, know: -2 }, outcomes: [{ text: '勉強は最低限にとどめ、練習と自主練に時間を注ぎ込むことにしました。' }] },
      { label: '成り行きに任せる', outcomes: [{ text: '進路のことは、夏の大会が終わってから考えることにしました。' }] },
    ],
  },
  {
    ...F,
    id: 'x.hs.entranceBack',
    category: 'studyLife',
    stages: ['hs'],
    when: (s) => hasFlag(s, 'exam.study') || hasFlag(s, 'exam.baseballOnly'),
    outcomes: [
      { when: (s) => hasFlag(s, 'exam.study'), weight: 2, text: '模擬試験で、志望していた大学の判定が上がりました。野球だけでなく、学力でも進路を選べるという自信がつきました。', effects: { know: 3, conf: 3 } },
      { when: (s) => hasFlag(s, 'exam.study'), weight: 1, text: '寝不足がたたって練習で集中を欠き、監督に注意されました。両立の難しさを痛感しました。', effects: { conf: -2, fatigue: 4 } },
      { when: (s) => hasFlag(s, 'exam.baseballOnly'), weight: 2, text: '野球の練習に打ち込んだ成果が、スカウトや大学の関係者の目に留まりました。', effects: { eval: 3, conf: 3 } },
      { when: (s) => hasFlag(s, 'exam.baseballOnly'), weight: 1, text: '勉強をおろそかにした分、一般入試という選択肢はほとんど残りませんでした。', effects: { know: -2, conf: -2 } },
    ],
  },
  {
    ...X,
    id: 'x.family.stand',
    category: 'familyLife',
    stages: ['hs', 'univ', 'amateur', 'pro'],
    when: (s) => inTeam(s) && (s.family.father !== null || s.family.mother !== null) && !hasFlag(s, 'family.stand'),
    weight: 3,
    maxPerLife: 1,
    title: 'スタンドの家族',
    body: '試合のたびに、家族が仕事を休んで、遠くの球場まで応援に来てくれます。ベンチから、スタンドの姿が見えます。',
    auto: 3,
    choices: [
      { label: '試合後に、直接「ありがとう」を伝える', flag: 'family.stand', follow: [{ id: 'x.family.standBack', after: 2, within: 5 }], effects: { rel: 5, happy: 4, conf: 2 }, outcomes: [{ text: '球場の出口で、少し照れながら、母（父）に「来てくれてありがとう」と言いました。' }] },
      { label: '結果で恩返しすると決め、黙って練習に打ち込む', effects: { gain: 0.02, fatigue: 5 }, outcomes: [{ text: '何も言わずに頭を下げ、今まで以上に練習に打ち込むようになりました。' }] },
      { label: '見に来なくていいと、断る', effects: { rel: -4 }, outcomes: [{ text: '恥ずかしさもあり、「来なくていい」と言ってしまい、家族の寂しそうな顔を見ました。' }] },
      { label: '特に何も言わず、いつもどおりに過ごす', outcomes: [{ text: '家族の姿に軽く手を上げただけで、ベンチに戻りました。' }] },
    ],
  },
  {
    ...F,
    id: 'x.family.standBack',
    category: 'familyLife',
    stages: ['hs', 'univ', 'amateur', 'pro', 'adult', 'senior'],
    when: (s) => hasFlag(s, 'family.stand'),
    outcomes: [
      { weight: 2, text: 'あの日スタンドにいた家族が、いまでも、あの試合のことを楽しそうに話します。', effects: { happy: 5, rel: 3 } },
      { weight: 1, text: '家族のアルバムに、スタンドから撮った自分の写真が、何枚も貼られていました。', effects: { happy: 6, rel: 2 } },
    ],
  },
  // ---------------------------------------------------------------- pro life
  {
    ...X,
    id: 'x.pro.rookie',
    category: 'rookieYear',
    stages: ['pro'],
    when: (s) => inTeam(s) && (s.career.phase === 'pro' || s.career.phase === 'proMinor') && s.career.phaseYears === 0 && !hasFlag(s, 'rookie.winter'),
    weight: 20,
    maxPerLife: 1,
    title: '新人の最初の冬',
    body: '入団して最初の冬。球団の寮には、全国から集まった同期が並びます。力の差を肌で感じる毎日です。',
    auto: 2,
    choices: [
      { label: '先輩の自主トレに加わり、プロの流儀を学ぶ', flag: 'rookie.winter', follow: [{ id: 'x.pro.rookieBack', after: 1, within: 2 }], effects: { gain: 0.03, rel: 3, fatigue: 8 }, outcomes: [{ text: '先輩に頭を下げて、合同の自主トレに加えてもらい、準備の姿勢から一つずつ盗みました。' }] },
      { label: '同期と競い合い、自分のペースで基礎を固める', effects: { gain: 0.02, rel: 2 }, outcomes: [{ text: '同期と練習量を競い合いながら、毎日の基礎メニューをこなしました。' }] },
      { label: '寮の生活に慣れることを最優先にする', outcomes: [{ text: '生活のリズムをつかむことを最優先にして、無理のない一冬を過ごしました。' }] },
    ],
  },
  {
    ...F,
    id: 'x.pro.rookieBack',
    category: 'rookieYear',
    stages: ['pro'],
    when: (s) => inTeam(s) && hasFlag(s, 'rookie.winter'),
    outcomes: [
      { weight: 2, text: '最初の冬に先輩から教わった準備の習慣が、一年目の春から、他の新人との差になって現れました。', effects: { eval: 4, conf: 4 } },
      { weight: 1, text: '先輩についていくだけで精一杯でしたが、体力の底上げにはなり、一年目を大きなけがなく乗り切れました。', effects: { fatigue: -4, conf: 1 } },
    ],
  },
  {
    ...X,
    id: 'x.fan.club',
    category: 'fans',
    stages: ['pro', 'amateur'],
    when: (s) => inTeam(s) && ['pro', 'indep', 'company'].includes(s.career.phase) && (role(s) === 'starter' || s.career.proDebut) && !hasFlag(s, 'fan.club'),
    weight: 3,
    maxPerLife: 1,
    title: 'ファン感謝デー',
    body: 'シーズンのあと、ファン感謝デーが開かれます。サイン会、トークショー、ゲームと、選手が前に出る一日です。',
    auto: 2,
    choices: [
      { label: '積極的に出て、一人ひとりと話す', flag: 'fan.club', follow: [{ id: 'x.fan.clubBack', after: 2, within: 5 }], effects: { rel: 4, happy: 3, fatigue: 4 }, outcomes: [{ text: '長い列の一人ひとりに、名前を聞いて、ひと言添えながらサインを書きました。' }] },
      { label: '裏方に徹して、イベントを支える', effects: { rel: 2, eval: 1 }, outcomes: [{ text: '荷物運びと誘導にまわり、運営スタッフに感謝されました。' }] },
      { label: '用事を理由に、参加を最小限にとどめる', outcomes: [{ text: '決められた時間だけ顔を出して、控えめに過ごしました。' }] },
    ],
  },
  {
    ...F,
    id: 'x.fan.clubBack',
    category: 'fans',
    stages: ['pro', 'amateur', 'adult', 'senior'],
    when: (s) => hasFlag(s, 'fan.club'),
    outcomes: [
      { weight: 2, text: 'あの日、サインを書いた子どもが、少年野球の選手になって、握手を求めに来てくれました。', effects: { happy: 6, rel: 3 } },
      { weight: 1, text: '引退のあとも、ファンから届く手紙が、静かに暮らしを励ましてくれました。', effects: { happy: 4, rel: 2 } },
    ],
  },
  // ---------------------------------------------------------------- life
  {
    ...A,
    id: 'x.life.fellBack',
    category: 'studyLife',
    stages: ['adult', 'student', 'hs', 'univ'],
    ages: [14, 19],
    when: (s) => fellBack(s) && !hasFlag(s, 'fell.handled'),
    weight: 20,
    maxPerLife: 1,
    title: '第一志望に落ちたあと',
    body: '第一志望の合格発表で、自分の番号はありませんでした。併願していた学校には受かっています。気持ちは、まだ整理がつきません。',
    auto: 2,
    choices: [
      { label: '悔しさをばねに、勉強を続ける', hint: '進学先に通いながら、塾にも通う。時間と費用がかかり、結果は保証されない', flag: 'fell.handled', follow: [{ id: 'x.life.fellBackBack', after: 1, within: 3 }], effects: { know: 5, money: -30, happy: -4 }, outcomes: [{ text: '進学先に通いながら塾の自習室にも通い、悔しさを机の上で燃やす一年が始まりました。' }] },
      { label: '併願先で、全力を出すと決める', flag: 'fell.handled', effects: { happy: 2, conf: 3 }, outcomes: [{ text: '入学式で顔を上げ、「ここで一番になる」と決めて、キャンパスの門をくぐりました。' }] },
      { label: '気持ちの整理がつくまで、何も考えない', outcomes: [{ text: '数日、部屋にこもったあと、母の作った夕食の匂いに釣られて台所へ出ていきました。' }] },
    ],
  },
  {
    ...AF,
    id: 'x.life.fellBackBack',
    category: 'studyLife',
    stages: ['adult', 'student', 'hs', 'univ'],
    when: (s) => hasFlag(s, 'fell.handled'),
    outcomes: [
      { weight: 2, text: '一年かけて学力が上がり、学校の成績でも上位に入るようになりました。回り道が、自信になりました。', effects: { know: 3, happy: 6, rel: 2 } },
      { weight: 1, text: '思うようには成績が伸びませんでした。それでも、粘った一年は無駄ではなかったと思えます。', effects: { know: 2, happy: -1 } },
    ],
  },
  {
    ...A,
    id: 'x.life.moveHouse',
    category: 'homeLife',
    stages: ['adult'],
    ages: [26, 58],
    when: (s) => s.after?.home === 'rent' && !hasFlag(s, 'move.house'),
    weight: 2,
    cooldown: 6,
    maxPerLife: 2,
    title: '引っ越しの季節',
    body: '契約更新の時期が来ました。家賃が上がると言われたうえ、今の部屋は家族が増えると手狭になります。',
    auto: 2,
    choices: [
      { label: '広い部屋に引っ越す', hint: '生活は楽になるが、家賃も上がる', flag: 'move.house', effects: { money: -50, happy: 3 }, outcomes: [{ weight: 2, text: '日当たりのよい新居で、暮らしの質が目に見えて変わりました。', effects: { health: 1 } }, { weight: 1, text: '新しい家賃が家計を圧迫し、節約の日々が続きました。', effects: { money: -30, happy: -2 } }] },
      { label: '郊外の安い部屋に移って、貯金に回す', effects: { money: 30, fatigue: 3 }, outcomes: [{ text: (s) => `${holdsJob(s) ? '通勤' : '駅'}は少し遠くなりましたが、静かな環境と安い家賃で、暮らしにゆとりができました。` }] },
      { label: '更新して、今の部屋に住み続ける', outcomes: [{ text: '大家と話し合い、小さな値上げを受け入れて、契約を更新しました。' }] },
    ],
  },
  {
    ...A,
    id: 'x.life.parentsHouse',
    category: 'familyLife',
    stages: ['adult', 'senior'],
    ages: [42, 80],
    when: (s) => s.family.father === null && s.family.mother === null && s.after?.home !== 'parents' && !hasFlag(s, 'parents.house'),
    weight: 4,
    maxPerLife: 1,
    title: '実家をどうするか',
    body: '両親が残した実家は、誰も住まないまま、庭の草が伸びています。このまま持ち続けるか、手放すか。',
    auto: 2,
    choices: [
      { label: '親族で話し合い、実家を売る', flag: 'parents.house', follow: [{ id: 'x.life.parentsHouseBack', after: 1, within: 3 }], effects: { money: 220, happy: -2, rel: -1 }, outcomes: [{ text: '最後の掃除をしながら、柱の傷や壁の落書きを、一つずつ写真に残しました。' }] },
      { label: '手入れしながら、週末の別宅として使う', effects: { money: -30, happy: 3, fatigue: 3 }, outcomes: [{ text: '庭の草を刈り、窓を開け放って空気を入れ替えました。家に、久しぶりに風が通りました。' }] },
      { label: '決められないまま、そのままにしておく', outcomes: [{ text: '鍵を引き出しにしまい、決断は先送りにしました。' }] },
    ],
  },
  {
    ...AF,
    id: 'x.life.parentsHouseBack',
    category: 'familyLife',
    stages: ['adult', 'senior'],
    when: (s) => hasFlag(s, 'parents.house'),
    outcomes: [
      { weight: 2, text: (s) => `売ったお金は、${(s.family.kids ?? []).some((k) => k <= 22) ? '子どもの学費や老後の備え' : '老後の備え'}に回しました。それでも、時々、あの家の匂いを思い出します。`, effects: { happy: 1, sat: 1 } },
      { weight: 1, text: '新しい持ち主から、「大切に住みます」という手紙が届き、肩の荷が下りた気がしました。', effects: { happy: 4 } },
    ],
  },
  {
    ...A,
    id: 'x.life.chronic',
    category: 'bodyLife',
    stages: ['adult', 'senior'],
    ages: [55, 90],
    when: (s) => s.status.health < 60 && !hasFlag(s, 'chronic.care'),
    weight: 3,
    maxPerLife: 1,
    title: '持病との付き合い',
    body: '診察のたびに、薬の数が増えていきます。医師からは、生活を見直さないと、いずれ大きな病気につながると言われました。',
    auto: 2,
    choices: [
      { label: '食事・運動・睡眠を、本気で立て直す', hint: '楽ではないが、体は応える', flag: 'chronic.care', follow: [{ id: 'x.life.chronicBack', after: 2, within: 4 }], effects: { health: 3, happy: -1, fatigue: 2 }, outcomes: [{ text: '毎朝の散歩と減塩の食事を日課にして、手帳に数値を記録し始めました。' }] },
      { label: '薬に頼りながら、いつもの暮らしを続ける', effects: { health: 1 }, outcomes: [{ text: '決められた薬だけは欠かさずに飲み、暮らしは大きく変えませんでした。' }] },
      { label: '考えると憂うつになるので、気にしない', outcomes: [{ text: '診察室を出ると、すぐに話を忘れたふりをして、いつもの店に寄り道しました。' }] },
    ],
  },
  {
    ...AF,
    id: 'x.life.chronicBack',
    category: 'bodyLife',
    stages: ['adult', 'senior'],
    when: (s) => hasFlag(s, 'chronic.care'),
    outcomes: [
      { weight: 3, text: '二年続けた生活改善で、検査の数値が目に見えて落ち着き、薬の量も減りました。', effects: { health: 5, happy: 4 } },
      { weight: 1, text: '数値はなかなか動かず、心が折れかけましたが、仲間の励ましで、続ける決意を新たにしました。', effects: { health: 2, rel: 2 } },
    ],
  },
]

function role(s: LifeState) {
  return s.bb?.role
}
