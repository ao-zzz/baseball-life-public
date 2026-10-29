import type { LifeState } from '../types.ts'
import { companyJob, flagAge, hasFlag, type EventSpec, holdsJob, hasGrandkids, youngKin, hasFamily, hasSibling, sameJobSince } from './spec.ts'
import { multiYearWeight } from '../contractTiming.ts'

// Choices with a price (PROJECT_PLAN §11.17): no answer is the right one. Each decision weighs a gain now against a
// risk later, or one value against another (family or career, security or a bet, saving or spending, the
// parents' way or one's own), sets the facts that the follow-up reads a few years on, and several follow-ups read
// facts set long before by other events (studying, a friendship kept or let go, a captain's duty, an English
// habit, the way the future was chosen at school). The おまかせ choice only sets facts or does nothing
// (spec.ts NEUTRAL_FORBIDDEN). All texts are original.

const X = { extra: true, career: true } as const
const A = { extra: true } as const
const AF = { extra: true, followOnly: true } as const
const XF = { extra: true, career: true, followOnly: true } as const
const working = (s: LifeState) => !!s.after?.work && !s.after.retired
const kids = (s: LifeState, lo: number, hi: number) => (s.family.kids ?? []).filter((k) => k >= lo && k <= hi).length
const parentsAlive = (s: LifeState) => s.family.father !== null || s.family.mother !== null
const self = (s: LifeState) => s.after?.work?.employer === 'self'
const has = (f: string) => (s: LifeState) => hasFlag(s, f)
/** he plays in a team now (school, company, independent, pro, abroad): the condition of a follow-up line about his play */
const active = (s: LifeState) => !!s.bb && ['hs', 'univ', 'company', 'indep', 'proMinor', 'pro', 'abroad'].includes(s.career.phase)
/** he plays as a pro (Japan or abroad) */
const pro = (s: LifeState) => !!s.bb && ['proMinor', 'pro', 'abroad'].includes(s.career.phase)
/** 1 + the weight of each fact in the list that is set */
const lift = (s: LifeState, ...fs: [string, number][]) => fs.reduce((a, [f, w]) => a + (hasFlag(s, f) ? w : 0), 1)

export const BRANCH_LIFE: EventSpec[] = [
  // ---------------------------------------------------------------- the way chosen at school, and what comes of it
  {
    ...X,
    id: 'x.route.advice',
    category: 'pathTalk',
    stages: ['hs'],
    when: (s) => s.career.phase === 'hs' && !!s.bb && s.career.phaseYears >= 2 && !hasFlag(s, 'route.parents') && !hasFlag(s, 'route.coachWay') && !hasFlag(s, 'route.ownWay'),
    weight: 60,
    maxPerLife: 1,
    title: '進路の相談',
    body: '卒業後の進路について、親、監督、そして自分の気持ちが、それぞれ別の方向を向いています。三者面談の席で、沈黙が続きました。',
    auto: 3,
    choices: [
      { label: '親の勧める、堅実な進学の道を選ぶ', hint: '安心だが、野球での挑戦は小さくなる', flag: 'route.parents', follow: [{ id: 'x.route.adviceBack', after: 2, within: 4 }], effects: { know: 3, rel: 3, conf: -2 }, outcomes: [{ text: '親の目を見て「わかった」と答えました。親の肩の力が抜けたのが、わかりました。' }] },
      { label: '監督が紹介する、野球で力を伸ばせる環境に進む', hint: '力は伸びるが、監督への依存が強くなる', flag: 'route.coachWay', follow: [{ id: 'x.route.adviceBack', after: 2, within: 4 }], effects: { eval: 4, rel: -2, fatigue: 4 }, outcomes: [{ text: '監督の紹介状を預かり、次の環境の練習を見学に行く日取りが決まりました。' }] },
      { label: '周りの反対を押し切り、自分の決めた道に進む', hint: '納得はいくが、うまくいかなければ責任は自分だけにある', flag: 'route.ownWay', follow: [{ id: 'x.route.adviceBack', after: 2, within: 4 }], effects: { conf: 4, rel: -4, happy: 2 }, outcomes: [{ text: '「自分で決めた」と言い切り、親にも監督にも、頭を下げました。' }] },
      { label: '結論を出さず、各方面の話をもう少し聞く', outcomes: [{ text: '三者面談は持ち越しになり、答えは年が明けるまで先送りになりました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.route.adviceBack',
    category: 'pathTalk',
    stages: ['univ', 'amateur', 'pro', 'adult'],
    // (the lines that hold for where he is now: the parents' steady road for one who no longer plays (not for a pro two years on),
    // the coach's environment for one who plays there; otherwise the booking waits, then lapses)
    when: (s) => hasFlag(s, 'route.ownWay') || (hasFlag(s, 'route.coachWay') && active(s)) || (hasFlag(s, 'route.parents') && !active(s)),
    outcomes: [
      { when: has('route.parents'), weight: 2, text: '親の勧めに従った道は、勉強も生活も安定していました。ときどき「もしあのとき」と思うことはありますが、後悔はありません。', effects: { know: 3, happy: 3, rel: 3 } },
      { when: has('route.parents'), weight: 1, text: '堅実な道を選んだはずなのに、野球への未練が消えず、練習の様子を見に行く足が止まりませんでした。', effects: { happy: -3, conf: -2 } },
      { when: has('route.coachWay'), weight: 2, text: '監督の紹介してくれた環境は、実力をぐんぐん伸ばしてくれました。恩を感じる一方で、自分で決める力は育っていないとも思います。', effects: { eval: 4, gain: 0.03, conf: 2 } },
      { when: has('route.coachWay'), weight: 1, text: '紹介された環境は、思っていた雰囲気と違いました。断りにくい関係だったことを、苦く思い返します。', effects: { conf: -3, rel: -2 } },
      { when: has('route.ownWay'), weight: (s) => 0.7 + Math.max(0, s.z * 0.5), text: '自分で決めた道に、迷いはありませんでした。壁にぶつかっても、誰のせいにもできないぶん、粘ることができました。', effects: { conf: 5, gain: 0.03, happy: 3 } },
      { when: has('route.ownWay'), weight: 1, text: '押し切って選んだ道で壁にぶつかり、あのとき止めてくれた人の顔が浮かびました。それでも、やり直す覚悟はできています。', effects: { conf: -5, rel: -1, happy: -2, know: 2 } },
    ],
  },
  {
    ...X,
    id: 'x.in.sideLife',
    category: 'moneyLife',
    stages: ['amateur'],
    when: (s) => !!s.bb && s.career.phase === 'indep' && !hasFlag(s, 'side.work') && !hasFlag(s, 'side.allIn'),
    weight: 40,
    maxPerLife: 1,
    title: '生活と練習',
    body: '独立リーグの給料では、家賃と食費でほとんど消えてしまいます。バイトを増やすか、練習に全力を注ぐか。',
    auto: 3,
    choices: [
      { label: '昼は物流倉庫で働き、夜に練習する', hint: '生活は安定するが、体と練習の時間を削る', flag: 'side.work', follow: [{ id: 'x.in.sideLifeBack', after: 1, within: 3 }], effects: { money: 60, fatigue: 10, gain: -0.01 }, outcomes: [{ text: '朝は倉庫、夜はナイター。睡眠は削られましたが、通帳の数字は、少しずつ増えていきました。' }] },
      { label: '貯金を崩し、練習に全力を注ぐ', hint: '力は伸びるが、お金が尽きれば終わる', flag: 'side.allIn', follow: [{ id: 'x.in.sideLifeBack', after: 1, within: 3 }], effects: { money: -50, gain: 0.04, conf: 3 }, outcomes: [{ text: 'アルバイトを辞め、朝から晩まで、練習と体づくりだけに集中する日々が始まりました。' }] },
      { label: '実家に仕送りをお願いする', effects: { money: 40, rel: -2, happy: -2 }, outcomes: [{ text: '電話で事情を話すと、母が黙って、翌週に振り込んでくれました。' }] },
      { label: '今の暮らしのまま、様子を見る', outcomes: [{ text: '節約を重ねながら、今の暮らしを続けることにしました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.in.sideLifeBack',
    category: 'moneyLife',
    stages: ['amateur', 'pro', 'adult'],
    // (its lines speak of the season: it comes only while he plays; after he has stopped, the booking waits, then lapses)
    when: (s) => active(s) && (hasFlag(s, 'side.work') || hasFlag(s, 'side.allIn')),
    outcomes: [
      { when: has('side.work'), weight: 2, text: '倉庫の仲間と親しくなり、引退後は「うちに来ないか」と声をかけてもらえるようになりました。', effects: { rel: 3, money: 30, flag: 'in.prep' } },
      { when: has('side.work'), weight: 1, text: '二重生活の疲れが抜けず、プレーの切れが戻らないまま、シーズンが終わりました。', effects: { conf: -4, fatigue: 6 } },
      { when: has('side.allIn'), weight: (s) => 0.8 + Math.max(0, s.z * 0.5), text: '練習に打ち込んだ成果が出て、スカウトの目に留まりました。貯金は尽きかけましたが、手応えがあります。', effects: { gain: 0.03, eval: 4, conf: 4 } },
      { when: has('side.allIn'), weight: 1, text: '貯金が底をつき、シーズン途中でアルバイトに戻らざるを得ませんでした。練習の遅れが痛手でした。', effects: { money: -20, conf: -4 } },
    ],
  },
  {
    ...X,
    id: 'x.pro.contractYear',
    category: 'proContract',
    stages: ['pro'],
    when: (s) => !!s.bb && s.career.phase === 'pro' && s.career.proDebut && s.career.proSeasons >= 3 && multiYearWeight(s) > 0 && !hasFlag(s, 'contract.safe') && !hasFlag(s, 'contract.bet'),
    // (a multi-year talk belongs to the last year before free agency: 22 then, little a year earlier, none before; contractTiming.ts)
    weight: (s) => 22 * multiYearWeight(s),
    maxPerLife: 1,
    title: '契約の最終年',
    body: '今季で契約が切れます。球団は複数年の安定した契約を提示してきましたが、数字は控えめです。',
    auto: 2,
    choices: [
      { label: '複数年の安定契約にサインする', hint: '生活は安定するが、評価を上げる機会は逃す', flag: 'contract.safe', follow: [{ id: 'x.pro.contractYearBack', after: 2, within: 4 }], effects: { money: 80, conf: -1 }, outcomes: [{ text: '数年先まで続く契約書にサインして、家族に報告の電話を入れました。' }] },
      { label: '1年契約で、結果を出して評価を上げに行く', hint: '大きく伸びるかもしれないが、結果が出なければ後がない', flag: 'contract.bet', follow: [{ id: 'x.pro.contractYearBack', after: 2, within: 4 }], effects: { conf: 3, fatigue: 5 }, outcomes: [{ text: '「もう一度、自分の数字で評価してほしい」と伝え、1年契約を選びました。' }] },
      { label: '球団の提示を聞いて、そのまま決める', outcomes: [{ text: '代理人（担当者）の提示に目を通し、深く考えずに判を押しました。' }] },
    ],
  },
  {
    ...AF,
    id: 'x.pro.contractYearBack',
    category: 'proContract',
    // (every line speaks of his play and his contract: only while he is a pro)
    stages: ['pro'],
    when: (s) => pro(s) && (hasFlag(s, 'contract.safe') || hasFlag(s, 'contract.bet')),
    outcomes: [
      { when: has('contract.safe'), weight: 2, text: '安定した契約のおかげで、焦りなく体づくりに専念できました。家族との時間も増えました。', effects: { money: 60, rel: 3, happy: 3 } },
      { when: has('contract.safe'), weight: 1, text: '安定したぶん、チームの中での危機感が薄れ、気づけば若手に追い抜かれていました。', effects: { eval: -4, conf: -3 } },
      { when: has('contract.bet'), weight: (s) => 0.6 + Math.max(0, s.z * 0.4), text: '賭けた一年は、数字がついてきました。次の契約は、桁が変わっていました。', effects: { money: 280, eval: 5, conf: 6 } },
      { when: has('contract.bet'), weight: 1, text: '賭けた一年は思うような結果が出ず、球団から契約を更新しない可能性を告げられました。', effects: { eval: -5, conf: -5, money: -30 } },
    ],
  },
  {
    ...X,
    id: 'x.pro.mlbTalk',
    category: 'overseas',
    stages: ['pro'],
    when: (s) => !!s.bb && s.career.phase === 'pro' && s.career.proSeasons >= 3 && s.z >= 1.5 && !hasFlag(s, 'mlb.dream') && !hasFlag(s, 'mlb.stay'),
    weight: 26,
    maxPerLife: 1,
    title: '海の向こうの関心',
    body: '海外の球団の編成担当が、練習を視察に来ているという噂が耳に入りました。挑戦するか、いまの場所に残るか。',
    auto: 2,
    choices: [
      { label: '代理人を通じて、挑戦の意思を伝える', hint: '夢には近づくが、今の球団との関係は変わる', flag: 'mlb.dream', follow: [{ id: 'x.pro.mlbTalkBack', after: 1, within: 3 }], effects: { conf: 3, rel: -2, eval: -1 }, outcomes: [{ text: '球団の担当者に、将来的に海外での挑戦を考えていると、正直に伝えました。' }] },
      { label: '残留を表明し、いまのチームでタイトルを目指す', flag: 'mlb.stay', follow: [{ id: 'x.pro.mlbTalkBack', after: 1, within: 3 }], effects: { rel: 3, eval: 3, happy: 2 }, outcomes: [{ text: '「このチームで勝ちたい」と口にすると、チームメイトが拍手をしてくれました。' }] },
      { label: '特に何も言わず、目の前の試合に集中する', outcomes: [{ text: '噂は聞き流し、いつもどおり、次の試合の準備を続けました。' }] },
    ],
  },
  {
    ...AF,
    id: 'x.pro.mlbTalkBack',
    category: 'overseas',
    stages: ['pro', 'adult'],
    // (its lines speak of his play and his club: only while he is a pro)
    when: (s) => pro(s) && (hasFlag(s, 'mlb.dream') || hasFlag(s, 'mlb.stay')),
    outcomes: [
      { when: has('mlb.dream'), weight: (s) => lift(s, ['study.english', 1.5]), text: '英語の勉強を続けていたおかげで、現地の担当者との面談も、通訳なしで、自分の言葉で話すことができました。', effects: { conf: 6, eval: 4, rel: 3 } },
      { when: has('mlb.dream'), weight: 1, text: '面談では言葉の壁が大きく、思いを十分に伝えられませんでした。語学を後回しにした自分を、悔やみました。', effects: { conf: -3 } },
      { when: has('mlb.stay'), weight: 2, text: '残留を選んだ年、チームはリーグで優勝争いをし、最後までシーズンを戦い抜けました。', effects: { happy: 5, rel: 3, conf: 3 } },
      { when: has('mlb.stay'), weight: 1, text: '残留を選んだものの、「あのとき行っていれば」という思いが、ときどき胸をよぎりました。', effects: { happy: -2 } },
    ],
  },
  // ---------------------------------------------------------------- work, family and money in the middle years
  {
    ...A,
    id: 'x.life.careerFamily',
    category: 'careerMove',
    stages: ['adult'],
    ages: [30, 52],
    when: (s) => companyJob(s) && kids(s, 0, 17) > 0 && !!s.family.spouse && !hasFlag(s, 'family.apart') && !hasFlag(s, 'family.first'),
    weight: 3,
    cooldown: 6,
    maxPerLife: 1,
    title: '単身赴任の打診',
    body: '会社から、遠方の支店への異動を打診されました。昇進を伴いますが、家族は連れていけません。',
    auto: 2,
    choices: [
      { label: '受けて、単身で赴任する', hint: '役職と収入は上がるが、家族と離れる', flag: 'family.apart', follow: [{ id: 'x.life.careerFamilyBack', after: 3, within: 5 }], effects: { sat: 3, money: 60, level: 1, rel: -5, happy: -3 }, outcomes: [{ text: '週末ごとに新幹線で家に戻る生活が始まりました。子どもの寝顔を見る時間が、減りました。' }] },
      { label: '断って、今の部署で働き続ける', hint: '家族との時間は守れるが、昇進の道は細くなる', flag: 'family.first', follow: [{ id: 'x.life.careerFamilyBack', after: 3, within: 5 }], effects: { sat: -3, rel: 4, happy: 3 }, outcomes: [{ text: '上司に頭を下げて断ると、「わかった」と言われたものの、声に温度はありませんでした。' }] },
      { label: '返事を保留して、時期を見る', outcomes: [{ text: '「家族と相談します」と答え、決断を先送りにしました。' }] },
    ],
  },
  {
    ...AF,
    id: 'x.life.careerFamilyBack',
    category: 'careerMove',
    stages: ['adult', 'senior'],
    when: (s) => (hasFlag(s, 'family.apart') && sameJobSince(s, 'family.apart')) || (hasFlag(s, 'family.first') && sameJobSince(s, 'family.first')),
    outcomes: [
      { when: has('family.apart'), weight: 2, text: '赴任先で実績を積み、本社に戻るころには、部門を率いる立場になっていました。家族は、不在の時間を受け入れてくれました。', effects: { level: 1, sat: 4, money: 120, rel: 1 } },
      { when: has('family.apart'), weight: 1, text: '子どもが「お父さんは、いつ帰ってくるの」と母に聞いていたと知りました。取り戻せない時間があることを、思い知りました。', effects: { happy: -5, rel: -3 } },
      { when: has('family.first'), weight: 2, text: '子どもの運動会、入学式、卒業式。すべてに立ち会えました。昇進は遅れましたが、あの時間は、何にも代えがたいものでした。', effects: { happy: 6, rel: 5 } },
      { when: has('family.first'), weight: 1, text: '同期が役職に就く中、自分だけが取り残されたと感じる日があります。選んだ道だと、自分に言い聞かせました。', effects: { sat: -3, happy: -1 } },
    ],
  },
  {
    ...A,
    id: 'x.life.careLeave',
    category: 'parentCare',
    stages: ['adult'],
    ages: [40, 63],
    when: (s) => parentsAlive(s) && (s.after?.care === true || hasFlag(s, 'after.parentCare')) && !hasFlag(s, 'care.leave') && !hasFlag(s, 'care.home') && !hasFlag(s, 'care.mixed'),
    weight: 6,
    maxPerLife: 1,
    title: '親の介護の進め方',
    // (the question reads right with or without a job; the answer's line follows the job he has when he answers)
    body: '親の介護が、日常になってきました。暮らしも家族も自分の体も、どれも手放せない中で、方針を決めなければなりません。',
    auto: 3,
    choices: [
      // (he really leaves the job he holds (effect job: the same leaving as a lay-off) and looks for none while the parent lives (afterEvents
      // work.search): the lost pay is the year's real income from now, so the sum here is only what the care itself costs)
      { label: '介護に専念して、自分の手で看る', hint: '親との時間は持てるが、勤めていれば辞めることになる。体の負担も大きい', flag: 'care.leave', follow: [{ id: 'x.life.careLeaveBack', after: 2, within: 4 }], effects: { sat: -6, money: -40, rel: 5, health: -4, happy: -2, job: 'quit' }, outcomes: [{ text: (s) => (flagAge(s, 'job.quit') === 0 ? '退職届を出した日、上司に深く頭を下げて、親の部屋の模様替えを始めました。' : '介護に専念すると決め、親の部屋の模様替えを始めました。') }] },
      { label: '施設に入ってもらい、できる範囲で通う', hint: '費用はかかり、後ろめたさも残るが、共倒れは避けられる', flag: 'care.home', follow: [{ id: 'x.life.careLeaveBack', after: 2, within: 4 }], effects: { money: -90, happy: -2, health: 1 }, outcomes: [{ text: '施設を何軒も見学して、静かで日当たりのよい一室に決めました。' }] },
      { label: 'ヘルパーと分担して、無理なく続ける', flag: 'care.mixed', follow: [{ id: 'x.life.careLeaveBack', after: 2, within: 4 }], effects: { sat: -2, money: -40, rel: 3, fatigue: 5 }, outcomes: [{ text: (s) => (working(s) ? '会社と話し合い、時短勤務を認めてもらい、平日の昼はヘルパーに頼むことにしました。' : '平日の昼はヘルパーに頼み、自分は朝と夜を受け持つことにしました。') }] },
      // (a brother only for a man who has one: the model keeps none but the younger brother of his boyhood story)
      { label: '介護は人に任せて、費用を出す', outcomes: [{ text: (s) => (hasSibling(s) ? '弟と話し合い、介護の役割は弟が担い、費用は自分が出すことになりました。' : '介護は訪問介護の人たちに任せ、費用は自分が出すことになりました。') }] },
    ],
  },
  {
    ...AF,
    id: 'x.life.careLeaveBack',
    category: 'parentCare',
    stages: ['adult', 'senior'],
    when: (s) => hasFlag(s, 'care.leave') || hasFlag(s, 'care.home') || hasFlag(s, 'care.mixed'),
    outcomes: [
      { when: has('care.leave'), weight: 2, text: '最期まで、そばで看取ることができました。「ありがとう」の言葉は、一生、胸に残るものになりました。', effects: { happy: 4, rel: 5, health: -1 } },
      { when: has('care.leave'), weight: 1, text: '介護を終えたとき、自分の再就職の道が狭くなっていることに気づきました。', effects: { sat: -4, money: -40 } },
      { when: has('care.home'), weight: 2, text: '施設の職員と顔なじみになり、親も穏やかに過ごせました。来るたびに、笑顔が見られました。', effects: { happy: 3, rel: 3 } },
      { when: has('care.home'), weight: 1, text: '「あのとき自分が見ていれば」という思いが、親の死後も、折にふれて浮かびます。', effects: { happy: -3 } },
      { when: has('care.mixed'), weight: 2, text: (s) => `${holdsJob(s) ? '仕事を続けられたことで、収入も気持ちも安定しました。' : '無理のない分担で、暮らしも気持ちも安定しました。'}親の信頼するヘルパーさんが、家族のように感じられました。`, effects: { sat: 2, happy: 2, rel: 2 } },
      { when: has('care.mixed'), weight: 1, text: '仕事と介護の両立で心身が限界を迎え、診察室で「少し休みましょう」と言われました。', effects: { health: -3, fatigue: 6 } },
    ],
  },
  {
    ...A,
    id: 'x.life.eduFund',
    category: 'kids',
    stages: ['adult'],
    when: (s) => kids(s, 10, 17) > 0 && !hasFlag(s, 'edu.loan') && !hasFlag(s, 'edu.save') && !hasFlag(s, 'edu.public'),
    weight: 6,
    maxPerLife: 1,
    title: '子どもの進学費用',
    body: '子どもが、進学先のことを話し始めました。希望する学校は、学費のかかる私立。家計との相談が必要です。',
    auto: 3,
    choices: [
      { label: '貯金を取り崩してでも、本人の希望の学校に通わせる', hint: '子どもの意欲に応えられるが、老後の備えが薄くなる', flag: 'edu.save', follow: [{ id: 'x.life.eduFundBack', after: 3, within: 6 }], effects: { money: -200, happy: 3, rel: 3 }, outcomes: [{ text: '通帳を前に家族会議を開き、「ここまで出せる」と数字を示しました。' }] },
      { label: '奨学金を使うことを前提に、本人にも責任を持たせる', hint: '家計は守れるが、子どもの返済が長く続く', flag: 'edu.loan', follow: [{ id: 'x.life.eduFundBack', after: 3, within: 6 }], effects: { money: -50, rel: 1 }, outcomes: [{ text: '奨学金の仕組みを、一緒に調べて、返済の見通しを子どもに説明しました。', effects: { know: 1 } }] },
      { label: '学費の安い公立に絞るよう、話し合う', hint: '費用は抑えられるが、子どもの夢を狭めるかもしれない', flag: 'edu.public', follow: [{ id: 'x.life.eduFundBack', after: 3, within: 6 }], effects: { money: 30, rel: -2 }, outcomes: [{ text: '子どもの話をじっくり聞いたうえで、公立の中から探してみようと提案しました。' }] },
      { label: '成績や状況を見てから、改めて考える', outcomes: [{ text: '今は方向だけを確かめ、お金の話は、志望校が絞れてからにしました。' }] },
    ],
  },
  {
    ...AF,
    id: 'x.life.eduFundBack',
    category: 'kids',
    stages: ['adult', 'senior'],
    when: (s) => hasFlag(s, 'edu.save') || hasFlag(s, 'edu.loan') || hasFlag(s, 'edu.public'),
    outcomes: [
      { when: has('edu.save'), weight: (s) => lift(s, ['kid.lesson', 0.6], ['kid.lessonOther', 0.6]), text: '子どもは学校で大きく伸び、夢の仕事に就きました。「あのとき出してくれて、ありがとう」と言われ、貯金の減りも、気になりません。', effects: { happy: 6, rel: 4 } },
      { when: has('edu.save'), weight: 1, text: '学費を出したぶん、自分たちの老後の蓄えは心もとなくなりました。子どもに頼らず、働く期間を延ばすことにしました。', effects: { money: -60, sat: -1 } },
      { when: has('edu.loan'), weight: 2, text: '子どもは自分で返す責任を感じて、バイトと勉強を両立させ、たくましく成長しました。', effects: { happy: 3, rel: 3 } },
      { when: has('edu.loan'), weight: 1, text: '奨学金の返済に追われる子どもの姿を見て、もっと助けてやれたのではと、胸が痛みました。', effects: { happy: -3 } },
      { when: has('edu.public'), weight: 2, text: '公立で伸び伸びと過ごした子どもは、地元に就職し、家の近くで暮らしています。', effects: { happy: 4, rel: 3 } },
      { when: has('edu.public'), weight: 1, text: '子どもが、「本当は行きたい学校があった」とぽつりとこぼしました。言葉を失いました。', effects: { happy: -4, rel: -2 } },
    ],
  },
  {
    ...A,
    id: 'x.life.loanChoice',
    category: 'moneyLife',
    stages: ['adult'],
    ages: [32, 60],
    when: (s) => (s.after?.loan ?? 0) > 500 && s.money >= 150 && !hasFlag(s, 'loan.early') && !hasFlag(s, 'loan.invest'),
    weight: 4,
    maxPerLife: 1,
    title: 'まとまったお金の使い道',
    body: '貯金がたまり、まとまった余裕ができました。住宅ローンを早く返すか、増やすことを考えるか。',
    auto: 3,
    choices: [
      { label: 'ローンを繰り上げ返済して、利子を減らす', hint: '確実に負担は軽くなるが、手元の現金は減る', flag: 'loan.early', follow: [{ id: 'x.life.loanChoiceBack', after: 3, within: 6 }], effects: { money: -200 }, outcomes: [{ text: '銀行の窓口で手続きを済ませると、ローンの残りが目に見えて減りました。', effects: { happy: 2 } }] },
      { label: '返済は予定どおりにして、投資に回す', hint: '増えるかもしれないが、減るかもしれない', flag: 'loan.invest', follow: [{ id: 'x.life.loanChoiceBack', after: 3, within: 6 }], effects: { money: -120 }, outcomes: [{ text: '証券会社で、リスクを抑えた分散型の商品を選び、長期で持つことにしました。', effects: { know: 1 } }] },
      { label: '手元に残して、急な出費に備える', effects: { happy: 1 }, outcomes: [{ text: 'まとまった金額は普通預金に置き、使い道は、必要が生じたときに考えることにしました。' }] },
      { label: '家計簿を見直してから、考える', outcomes: [{ text: '焦らず、一か月かけて、家計の収支を整理することにしました。' }] },
    ],
  },
  {
    ...AF,
    id: 'x.life.loanChoiceBack',
    category: 'moneyLife',
    stages: ['adult', 'senior'],
    when: (s) => hasFlag(s, 'loan.early') || hasFlag(s, 'loan.invest'),
    outcomes: [
      { when: has('loan.early'), weight: 2, text: 'ローンを早く減らしたおかげで、老後に向けた貯蓄に回すお金が増え、気持ちにも余裕が生まれました。', effects: { money: 90, happy: 3 } },
      { when: has('loan.early'), weight: 1, text: '繰り上げ返済の直後に、急な出費が重なり、手元の現金の少なさに焦りました。', effects: { money: -30, happy: -2 } },
      { when: has('loan.invest'), weight: 2, text: '数年で、投資した分はふくらみ、ローンの金利を上回る収益を得られました。', effects: { money: 160, happy: 3 } },
      { when: has('loan.invest'), weight: 1, text: '相場が崩れた時期に重なり、投資した分は元本を割り込んでしまいました。', effects: { money: -70, happy: -3 } },
    ],
  },
  {
    ...A,
    id: 'x.life.friendLoan',
    category: 'friendship',
    stages: ['adult'],
    ages: [28, 58],
    when: (s) => s.money >= 120 && !hasFlag(s, 'friend.lent') && !hasFlag(s, 'friend.refused'),
    weight: 2,
    maxPerLife: 1,
    title: '友人からの頼み',
    body: '昔からの友人が、事業の資金繰りに困っているので、お金を貸してほしいと頭を下げてきました。',
    auto: 3,
    choices: [
      { label: '信じて、まとまった額を貸す', hint: '友情を守れるかもしれないが、戻らないこともある', flag: 'friend.lent', follow: [{ id: 'x.life.friendLoanBack', after: 2, within: 4 }], effects: { money: -100, rel: 3 }, outcomes: [{ text: '借用書は作りましたが、握手の力強さのほうを、信じました。' }] },
      { label: '貸さずに、別の形で手を貸す（仕事の紹介など）', flag: 'friend.refused', follow: [{ id: 'x.life.friendLoanBack', after: 2, within: 4 }], effects: { rel: -1, money: -10 }, outcomes: [{ text: 'お金は断りつつ、知り合いの会社を紹介して、仕事の口を探す手伝いをしました。' }] },
      { label: '少額を、あげるつもりで渡す', effects: { money: -20, rel: 1 }, outcomes: [{ text: '貸すのではなく、「祝儀と思って」と、封筒を黙って渡しました。' }] },
      { label: 'はっきりと、断る', outcomes: [{ text: '長い沈黙のあと、「そうか」と言って、友人は去っていきました。' }] },
    ],
  },
  {
    ...AF,
    id: 'x.life.friendLoanBack',
    category: 'friendship',
    stages: ['adult', 'senior'],
    when: (s) => hasFlag(s, 'friend.lent') || hasFlag(s, 'friend.refused'),
    outcomes: [
      // a friendship that was kept (a rival who became a friend, an apology made) is likelier to be repaid
      { when: has('friend.lent'), weight: (s) => lift(s, ['rival.friend', 1], ['friend.apologized', 1], ['rival.fierce', 0.3]), text: '数年後、友人が菓子折りを持って訪ねてきて、全額を返してくれました。「あのとき信じてくれて、ありがとう」と。', effects: { money: 100, rel: 5, happy: 5 } },
      { when: has('friend.lent'), weight: (s) => (hasFlag(s, 'friend.distance') ? 2 : 1), text: '返済の約束は果たされないまま、友人とは連絡が途絶えました。お金より、友人を失ったことが堪えました。', effects: { rel: -5, happy: -4 } },
      { when: has('friend.refused'), weight: 2, text: '紹介した仕事で友人は立ち直り、「お金より、あれが一番助かった」と言ってくれました。', effects: { rel: 4, happy: 3 } },
      { when: has('friend.refused'), weight: 1, text: '友人はその後、事業を畳みました。距離はできましたが、年賀状だけは、今も届きます。', effects: { rel: -1, happy: -1 } },
    ],
  },
  {
    ...A,
    id: 'x.life.midlife',
    category: 'careerMove',
    stages: ['adult'],
    ages: [42, 56],
    when: (s) => working(s) && s.after!.work!.years >= 8 && !hasFlag(s, 'mid.reskill') && !hasFlag(s, 'mid.startup'),
    // (a question about the job he holds: not asked once he has lost it earlier in the same year)
    requires: working,
    weight: 3,
    maxPerLife: 1,
    title: '残りの働き方',
    // (a man who works for himself has no 定年 and no boss; the small business is started beside the job he keeps, as his life records it:
    // the job stays, and its follow-up waits while he has one)
    body: (s) => `${self(s) ? '引退' : '定年'}までの時間が、少しずつ見えてきました。今の仕事を続けるか、学び直すか、思い切って自分の事業を始めるか。`,
    auto: 3,
    choices: [
      { label: '夜間の講座で、新しい分野を学び直す', hint: '時間と体力を使うが、選択肢が広がる', flag: 'mid.reskill', follow: [{ id: 'x.life.midlifeBack', after: 3, within: 5 }], effects: { know: 5, fatigue: 5, money: -30, happy: 1 }, outcomes: [{ text: '二十年ぶりに教室に座り、周りの若い学生に混じって、ノートを取りました。' }] },
      { label: '貯金を元手に、小さな事業を始める', hint: '当たれば大きいが、失敗すれば貯金を失う', flag: 'mid.startup', follow: [{ id: 'x.life.midlifeBack', after: 3, within: 5 }], effects: { money: -120, sat: 2, fatigue: 6 }, outcomes: [{ text: (s) => (self(s) ? '今の商売と並行して、小さな事務所を借り、新しい看板を掲げました。' : '勤めを続けながら、週末に小さな事務所を借りて、看板を掲げました。') }] },
      { label: '今の職場で、あと少し役割を広げる', effects: { sat: 1 }, outcomes: [{ text: (s) => (self(s) ? '若い人に仕事を教え、少しずつ任せていく役割を、新たに引き受けました。' : '上司と話して、後輩の育成を担う役割を、新たに引き受けました。') }] },
      { label: '今は特に変えない', outcomes: [{ text: '先のことを考えるのはやめて、目の前の仕事に集中することにしました。' }] },
    ],
  },
  {
    ...AF,
    id: 'x.life.midlifeBack',
    category: 'careerMove',
    stages: ['adult', 'senior'],
    // (its lines speak of his job: it waits while he has none; PROJECT_PLAN §11.61)
    when: (s) => (hasFlag(s, 'mid.reskill') || hasFlag(s, 'mid.startup')) && holdsJob(s),
    outcomes: [
      // a habit of studying (the exam years, English) makes a second start likelier to work; so does having chosen one's own way at school
      { when: has('mid.reskill'), weight: (s) => lift(s, ['exam.study', 1], ['study.english', 0.7], ['mental.care', 0.2]), text: '学び直した分野で、新しい役割が生まれました。四十代の後半になって、仕事が、もう一度面白くなりました。', effects: { sat: 5, money: 90, level: 1 } },
      { when: has('mid.reskill'), weight: 1, text: '学んだことを活かせる場は、すぐには見つかりませんでした。それでも、学ぶこと自体が、日々の張り合いになりました。', effects: { happy: 1, know: 2, money: -60, sat: -3 } },
      { when: has('mid.startup'), weight: (s) => lift(s, ['route.ownWay', 0.8], ['job.changed', 0.5], ['side.work', 0.3]), text: '小さな事業は、少しずつ軌道に乗り、取引先との信頼で、仕事が仕事を呼ぶようになりました。', effects: { money: 220, sat: 6, happy: 4 } },
      { when: has('mid.startup'), weight: 1.3, text: '事業は資金繰りに行き詰まり、半年を待たずに畳むことになりました。借金は残りませんでしたが、貯金の多くを失いました。', effects: { money: -120, sat: -4, happy: -4 } },
    ],
  },
  // ---------------------------------------------------------------- the later years
  {
    ...A,
    id: 'x.life.grandRole',
    category: 'seniorLife',
    stages: ['senior'],
    ages: [62, 86],
    // (only a man with grandchildren, as the life records them: a child of 25 or more is not a grandchild yet)
    when: (s) => hasGrandkids(s) && !hasFlag(s, 'grand.care') && !hasFlag(s, 'grand.own'),
    weight: 4,
    maxPerLife: 1,
    title: '孫の世話と自分の時間',
    body: '共働きの子どもから、孫を毎週預かってほしいと頼まれました。嬉しい頼みですが、自分の楽しみにしていた予定も、ありました。',
    auto: 2,
    choices: [
      { label: '毎週、孫を預かって世話をする', hint: '孫との絆が深まるが、体力と自分の時間を差し出す', flag: 'grand.care', follow: [{ id: 'x.life.grandRoleBack', after: 3, within: 6 }], effects: { rel: 5, happy: 3, fatigue: 6, health: -1 }, outcomes: [{ text: '毎週、孫の好きなおやつを用意して、玄関で待つのが、習慣になりました。' }] },
      { label: '自分の予定を優先し、預かるのは月に一度だけ', flag: 'grand.own', follow: [{ id: 'x.life.grandRoleBack', after: 3, within: 6 }], effects: { happy: 2, health: 1, rel: -1 }, outcomes: [{ text: '月に一度の「じいじの日」と決めて、残りは自分の趣味に時間を使うことにしました。' }] },
      { label: '子どもと話し合って、方針を決めるのを先送りにする', outcomes: [{ text: '「少し考えさせて」と答え、返事は次の帰省のときに持ち越しました。' }] },
    ],
  },
  {
    ...AF,
    id: 'x.life.grandRoleBack',
    category: 'seniorLife',
    stages: ['senior'],
    when: (s) => hasFlag(s, 'grand.care') || hasFlag(s, 'grand.own'),
    outcomes: [
      { when: has('grand.care'), weight: 2, text: '孫は、成長してからも「じいじのおやつが一番」と言ってくれました。毎週の時間は、自分の宝物になりました。', effects: { happy: 6, rel: 5 } },
      { when: has('grand.care'), weight: 1, text: '体力的に限界を感じて、膝を痛めて通院することになりました。それでも、孫の笑顔があれば、続けられると思っています。', effects: { health: -3, happy: 2 } },
      { when: has('grand.own'), weight: 2, text: '自分の時間を守ったことで、趣味の仲間との旅行も続けられました。孫との時間は少ないぶん、会う日は、特別になりました。', effects: { happy: 4, health: 2 } },
      { when: has('grand.own'), weight: 1, text: '孫は、あまり預かってもらえなかったからか、祖父とは距離ができたと感じているようでした。', effects: { rel: -3, happy: -2 } },
    ],
  },
  {
    ...A,
    id: 'x.life.digital',
    category: 'seniorLife',
    stages: ['senior'],
    ages: [64, 84],
    when: (s) => !hasFlag(s, 'digital.learned'),
    weight: 4,
    maxPerLife: 1,
    title: 'スマートフォン',
    body: (s) => `${youngKin(s)}から、「ビデオ通話で顔が見られるよ」と、スマートフォンを勧められました。慣れない操作に、少し身構えています。`,
    auto: 2,
    choices: [
      { label: '教わりながら、一から覚える', hint: '最初は苦労するが、世界が広がる', flag: 'digital.learned', follow: [{ id: 'x.life.digitalBack', after: 2, within: 4 }], effects: { know: 3, rel: 3, fatigue: 2 }, outcomes: [{ text: (s) => `${youngKin(s)}の隣で、画面の小さな文字を指でなぞりながら、「ここを押すんだよ」を何度も繰り返しました。` }] },
      { label: '電話とはがきで十分だと、断る', hint: '慣れた暮らしは守れるが、窓口や連絡の手段が減っていく', flag: 'digital.declined', follow: [{ id: 'x.life.digitalDeclinedBack', after: 2, within: 5 }], effects: { happy: 1 }, outcomes: [{ text: '慣れた電話機と万年筆で、これまでのやり方を貫くことにしました。' }] },
      { label: '必要になったら考える', outcomes: [{ text: '勧められた箱は、玄関の棚の上にしまっておきました。' }] },
    ],
  },
  {
    ...AF,
    id: 'x.life.digitalBack',
    category: 'seniorLife',
    stages: ['senior'],
    when: (s) => hasFlag(s, 'digital.learned'),
    outcomes: [
      { when: hasGrandkids, weight: 2, text: '遠くに暮らす孫と、毎週ビデオ通話をするのが楽しみになりました。画面越しに、成長の様子がよくわかります。', effects: { happy: 5, rel: 5 } },
      { weight: 1, text: '昔の仲間とのグループが作られ、野球部の同期と、毎日冗談を言い合うようになりました。', effects: { happy: 4, rel: 4 } },
      { weight: 0.8, text: (s) => `見慣れないメッセージに慌てて返信しそうになりましたが、${youngKin(s)}に見せると「それ、詐欺だよ」と一瞬で見抜かれました。以来、怪しい連絡は必ず誰かに見せています。`, effects: { rel: 2, know: 2 } },
      { weight: 0.5, text: '画面の案内に従って操作するうち、使うつもりのなかった有料の登録をしてしまい、数か月分の料金を払ってしまいました。', effects: { money: -15, happy: -2 } },
    ],
  },
  {
    ...AF,
    id: 'x.life.digitalDeclinedBack',
    category: 'seniorLife',
    stages: ['senior'],
    when: (s) => hasFlag(s, 'digital.declined'),
    outcomes: [
      { when: hasGrandkids, weight: (s) => 1 + (hasFlag(s, 'grand.care') ? 0.8 : 0), text: '孫への手書きのはがきは、孫の部屋の壁に貼られていました。「じいじの字は読みやすい」と言ってもらえました。', effects: { rel: 4, happy: 4 } },
      { weight: (s) => 1 + Math.max(0, (s.age - 74) / 10), text: '役所や銀行の手続きが、次々と画面の操作に変わり、窓口には長い列ができていました。待つ時間が、とても長く感じました。', effects: { fatigue: 4, happy: -3 } },
      { weight: 0.8, text: '連絡の手段が電話だけになり、遠くの友人からの便りが、少しずつ減っていきました。', effects: { rel: -3, happy: -2 } },
      { weight: 0.7, text: '毎年の手書きの年賀状を楽しみにしている、という返事が、野球部の同期から届きました。', effects: { rel: 3, happy: 2 } },
    ],
  },
  {
    ...A,
    id: 'x.life.petAdopt',
    category: 'hobbyLife',
    stages: ['adult', 'senior'],
    ages: [30, 82],
    when: (s) => !hasFlag(s, 'pet.adopted') && !hasFlag(s, 'pet.declined'),
    weight: 2,
    maxPerLife: 1,
    title: '犬を迎えるか',
    body: '知人の家で生まれた子犬の、もらい手を探しているそうです。毎日の世話ができるか、自分に聞いてみました。',
    auto: 2,
    choices: [
      { label: '迎えて、毎日の散歩を日課にする', hint: '体は動かすようになるが、旅行や泊まりの自由は減る', flag: 'pet.adopted', follow: [{ id: 'x.life.petAdoptBack', after: 3, within: 6 }], effects: { happy: 4, health: 2, fatigue: 2, money: -20 }, outcomes: [{ text: '子犬を抱いて帰った夜、新しいクッションの上で、すぐに眠り込みました。' }] },
      { label: '縁がなかったと、丁寧に断る', hint: '旅行や外出の自由は守れるが、家の中は静かなまま', flag: 'pet.declined', follow: [{ id: 'x.life.petDeclinedBack', after: 3, within: 6 }], outcomes: [{ text: (s) => `${hasFamily(s) ? '家族' : '暮らし'}の事情を説明して、別のもらい手が見つかることを願いました。`, effects: { happy: -1 } }] },
      { label: 'もう少し、考えさせてほしいと伝える', outcomes: [{ text: '返事を保留にしましたが、その後、別の家に決まったと知らされました。' }] },
    ],
  },
  {
    ...AF,
    id: 'x.life.petAdoptBack',
    category: 'hobbyLife',
    stages: ['adult', 'senior'],
    when: (s) => hasFlag(s, 'pet.adopted'),
    outcomes: [
      { weight: 2, text: '毎朝の散歩で、近所の人と挨拶を交わすようになりました。犬のおかげで、知り合いが増えました。', effects: { rel: 4, happy: 4, health: 2 } },
      { weight: 1, text: '犬が年老いて、動物病院に通う日が増えました。別れの日のことを考えて、涙ぐむことがあります。', effects: { happy: -2, money: -30 } },
      { when: hasGrandkids, weight: (s) => (hasFlag(s, 'grand.care') || hasFlag(s, 'grand.own') ? 1.2 : 0.3), text: '孫が遊びに来るたびに、犬と庭を走り回ります。孫は「じいじの家」ではなく「犬のいる家」と呼ぶようになりました。', effects: { rel: 4, happy: 3 } },
      { weight: (s) => (s.age >= 70 ? 1.2 : 0.5), text: '雨の日も雪の日も散歩に出るうちに、足腰が衰えず、医師から「年齢のわりに丈夫です」と言われました。', effects: { health: 3, happy: 2 } },
    ],
  },
  {
    ...AF,
    id: 'x.life.petDeclinedBack',
    category: 'hobbyLife',
    stages: ['adult', 'senior'],
    when: (s) => hasFlag(s, 'pet.declined'),
    outcomes: [
      { weight: 2, text: '犬を迎えなかったおかげで、思い立ってすぐに旅行へ出かけられます。去年は、長めの旅を二回楽しみました。', effects: { happy: 3, money: -25 } },
      { weight: 1, text: '近所で犬を連れた人を見るたびに、あのとき断ったことを思い出します。家の静けさが、ときどき身にしみます。', effects: { happy: -2 } },
      { weight: (s) => (s.family.spouse ? 0.4 : 1), text: '一人暮らしの夜、犬の鳴き声が聞こえる隣の家がうらやましくなりました。散歩仲間のいる暮らしを、想像しました。', effects: { rel: -1, happy: -1 } },
    ],
  },
  // ---------------------------------------------------------------- teenage years
  {
    ...A,
    id: 'x.life.partTimeChoice',
    category: 'moneyLife',
    stages: ['hs', 'student'],
    ages: [16, 18],
    when: (s) => !hasFlag(s, 'job.earlyWork') && !hasFlag(s, 'job.noWork'),
    weight: 20,
    maxPerLife: 1,
    title: 'アルバイトをするか',
    body: '家計は決して楽ではありません。友人は皆、アルバイトを始めています。部活や勉強の時間と、天秤にかけて考えます。',
    auto: 3,
    choices: [
      { label: '飲食店で週に三日、働き始める', hint: '収入と社会経験は得られるが、部活や勉強の時間が減る', flag: 'job.earlyWork', follow: [{ id: 'x.life.partTimeChoiceBack', after: 2, within: 4 }], effects: { money: 18, rel: 2, fatigue: 8, know: -2 }, outcomes: [{ text: '制服に着替えて、初めて接客に立った日、声が思うように出ませんでした。' }] },
      { label: '働かず、部活と勉強に集中する', hint: '時間は守れるが、お金の余裕はできない', flag: 'job.noWork', follow: [{ id: 'x.life.partTimeChoiceBack', after: 2, within: 4 }], effects: { know: 2, fatigue: -2 }, outcomes: [{ text: '家の事情を理解したうえで、親が「勉強のほうが大事」と背中を押してくれました。' }] },
      { label: '長い休みの間だけ、短期のバイトをする', effects: { money: 8, fatigue: 3 }, outcomes: [{ text: '夏休みの間だけ、地元の引っ越し会社で働き、汗だくで日々を過ごしました。' }] },
      { label: '親と相談して、結論を先送りにする', outcomes: [{ text: '家計と進学の見通しを親と一緒に確かめて、決断は、進路が決まってからにしました。' }] },
    ],
  },
  {
    ...AF,
    id: 'x.life.partTimeChoiceBack',
    category: 'moneyLife',
    stages: ['hs', 'student', 'univ', 'adult'],
    when: (s) => hasFlag(s, 'job.earlyWork') || hasFlag(s, 'job.noWork'),
    outcomes: [
      { when: has('job.earlyWork'), weight: 2, text: '飲食店の店長に仕事ぶりを認められ、卒業後の就職を勧められました。仕事というものの手応えを、早く知れました。', effects: { sat: 3, rel: 3, money: 20 } },
      { when: has('job.earlyWork'), weight: 1, text: 'アルバイトで疲れ、授業中に眠ることが増えて、成績が落ちました。お金と引き換えに、失ったものがありました。', effects: { know: -3, fatigue: 4 } },
      { when: has('job.noWork'), weight: 2, text: '勉強と練習に集中できた分、実力も成績も伸びました。親の支えのありがたみを、あらためて感じます。', effects: { know: 3, conf: 3 } },
      { when: has('job.noWork'), weight: 1, text: '友人と遊びに行くお金がなく、周りの話題に入れない日が続き、少し孤独を感じました。', effects: { rel: -3, happy: -2 } },
    ],
  },
  {
    ...A,
    id: 'x.life.friendCircle',
    category: 'friendship',
    stages: ['jhs', 'hs'],
    ages: [13, 17],
    when: (s) => !!s.bb && !hasFlag(s, 'friends.ball') && !hasFlag(s, 'friends.school'),
    weight: 4,
    maxPerLife: 1,
    title: '野球仲間と、クラスの友人',
    body: '練習で毎日顔を合わせる野球仲間と、教室で話すクラスの友人。休み時間も放課後も、どちらと過ごすか、選ぶ場面が増えてきました。',
    auto: 2,
    choices: [
      { label: '野球仲間と過ごす時間を、いちばん大切にする', hint: '結束は強まるが、クラスでは浮きやすい', flag: 'friends.ball', follow: [{ id: 'x.life.friendCircleBack', after: 3, within: 6 }], effects: { rel: 3, conf: 2, happy: 2 }, outcomes: [{ text: '昼休みは野球部の部室で弁当を広げ、くだらない話で笑い合う時間が、毎日の楽しみになりました。' }] },
      { label: 'クラスの友人とも、意識して付き合う', hint: '世界は広がるが、練習の話題で温度差が出る', flag: 'friends.school', follow: [{ id: 'x.life.friendCircleBack', after: 3, within: 6 }], effects: { rel: 3, know: 1, fatigue: 2 }, outcomes: [{ text: '放課後の誘いに時々応じて、教室の友人と、ゲームセンターや図書室に出かけるようになりました。' }] },
      { label: 'どちらにも深入りせず、一人の時間を守る', outcomes: [{ text: '付き合いは広く浅く。練習のあとの静かな時間を、自分のために使うことにしました。' }] },
    ],
  },
  {
    ...AF,
    id: 'x.life.friendCircleBack',
    category: 'friendship',
    stages: ['hs', 'univ', 'amateur', 'pro', 'adult', 'senior'],
    when: (s) => hasFlag(s, 'friends.ball') || hasFlag(s, 'friends.school'),
    outcomes: [
      { when: has('friends.ball'), weight: 2, text: '野球仲間とは、何十年たっても、顔を合わせれば、あの部室の空気がよみがえります。', effects: { rel: 5, happy: 4 } },
      { when: has('friends.ball'), weight: 1, text: '野球をやめたとき、野球仲間以外の友人が少ないことに気づき、世界の狭さを痛感しました。', effects: { rel: -2, happy: -2 } },
      { when: has('friends.school'), weight: 2, text: '教室の友人の一人が、野球をやめた自分に最初に声をかけてくれました。広い付き合いが、救いになりました。', effects: { rel: 4, happy: 4 } },
      { when: has('friends.school'), weight: 1, text: '練習漬けの日々で、教室の友人との約束を何度も破り、少しずつ、距離ができてしまいました。', effects: { rel: -3 } },
    ],
  },
  {
    ...A,
    id: 'x.life.dualIncome',
    category: 'familyLife',
    stages: ['adult'],
    ages: [28, 48],
    when: (s) => !!s.family.spouse && kids(s, 0, 8) > 0 && working(s) && !hasFlag(s, 'dual.both') && !hasFlag(s, 'dual.home'),
    weight: 4,
    maxPerLife: 1,
    title: '共働きか、片方が家に入るか',
    body: '子どもが小さいうちの、働き方を話し合っています。二人で働けば家計は楽ですが、時間に追われます。',
    auto: 3,
    choices: [
      { label: '二人とも働き続け、保育を頼る', hint: '収入は安定するが、子どもとの時間は少なくなる', flag: 'dual.both', follow: [{ id: 'x.life.dualIncomeBack', after: 3, within: 6 }], effects: { money: 90, fatigue: 8, rel: -2 }, outcomes: [{ text: '朝は保育園へ駆け込み、夜は食事を作りながら、翌日の準備をする日々が始まりました。' }] },
      { label: '一方が仕事を減らして、家庭に比重を置く', hint: '子どもとの時間は増えるが、収入と復帰の道は細くなる', flag: 'dual.home', follow: [{ id: 'x.life.dualIncomeBack', after: 3, within: 6 }], effects: { money: -60, rel: 4, happy: 3, sat: -2 }, outcomes: [{ text: '話し合いの末、片方が勤務を減らし、子どもの送り迎えと家事を中心に担うことになりました。' }] },
      { label: '祖父母や地域の力を借りて、工夫する', effects: { rel: 3, fatigue: 3 }, outcomes: [{ text: '近所の祖父母に週に二日、子どもを預ける体制を整えて、やりくりすることにしました。' }] },
      { label: '今の暮らしのまま、様子を見る', outcomes: [{ text: '大きくは変えず、疲れが溜まったときに、また話し合おうと決めました。' }] },
    ],
  },
  {
    ...AF,
    id: 'x.life.dualIncomeBack',
    category: 'familyLife',
    stages: ['adult', 'senior'],
    when: (s) => hasFlag(s, 'dual.both') || hasFlag(s, 'dual.home'),
    outcomes: [
      { when: has('dual.both'), weight: 2, text: '二人で働いた収入のおかげで、家のローンも教育費も、見通しが立ちました。忙しかったぶん、休日の過ごし方は、とても大切にしました。', effects: { money: 120, happy: 2 } },
      { when: has('dual.both'), weight: 1, text: '時間に追われる日々で、夫婦の会話が減り、すれ違う日が続いたと、あとで振り返ります。', effects: { rel: -4, happy: -2 } },
      { when: has('dual.home'), weight: 2, text: '子どもとの時間が増えたおかげで、成長の一つひとつに立ち会えました。復職の準備も、少しずつ進んでいます。', effects: { happy: 5, rel: 4 } },
      { when: has('dual.home'), weight: 1, text: '収入が減ったぶん、家計のやりくりに苦労し、将来への不安が、ときどき頭をよぎります。', effects: { money: -40, happy: -2 } },
    ],
  },
]
