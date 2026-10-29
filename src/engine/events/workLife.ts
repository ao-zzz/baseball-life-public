import type { LifeState } from '../types.ts'
import { careerOf } from '../careers.ts'
import { companyJob, employed, formerJob, hasFlag, holdsJob, sameJobSince, selfEmployed, tenure, type EventSpec } from './spec.ts'

// business and employment (2026-10-24, careers.ts): a company of his own (an idea, the money, the first hire, the cash running out, a
// change of course, the debt of a failure or the growth, and at the very end of the chain a listing or a sale), the restaurant he
// opened (a second shop, a review that spreads, a regular's last meal, the shop handed on), a manager's years (a team, an order to cut
// it, a junior's mistake), a move (a headhunter, another trade), the years after losing a job (the first year back at work, a younger
// boss), a side job that may become the main one, the end of a working life (a firm of one, an advisor's days) and looking back.
// Each line is guarded by the state of his work (spec.ts employed / companyJob / selfEmployed / tenure / sameJobSince): a shop owner
// hears nothing of bosses or posts, and a man who lost his job hears of the old one only as the past. The おまかせ answer only sets
// facts; starting a company (career 'founder') is always the player's own answer. All money figures are game assumptions.

const A = { extra: true } as const
const AF = { extra: true, followOnly: true } as const
const has = (f: string) => (s: LifeState) => hasFlag(s, f)
/** 1 + the weight of each fact in the list that is set */
const lift = (s: LifeState, ...fs: [string, number][]) => fs.reduce((a, [f, w]) => a + (hasFlag(s, f) ? w : 0), 1)
/** he runs the company he founded in the chain of this pack (not a later job, not the firm of one started near sixty) */
const ownCompany = (s: LifeState) => careerOf(s) === 'founder' && sameJobSince(s, 'wl.found')
/** the restaurant he opened himself (the job offer 飲食店の経営: his own, food, no career kind) */
const myShop = (s: LifeState) => selfEmployed(s) && s.after!.work!.industry === 'food' && !s.after!.work!.kind
/** the last job ended without his own leaving (a lay-off, a shop closed, a company folded): not one he quit (job.quit, a parent's care) */
function lostJob(s: LifeState) {
  const p = s.after?.pastJobs?.at(-1)
  if (!p || p.end !== 'lost') return undefined
  if (s.flags?.['job.quit'] === p.to) return undefined
  return p
}
/** he lost a job and holds a new one, taken since, within four years */
const restarted = (s: LifeState) => {
  const p = lostJob(s)
  return !!p && holdsJob(s) && s.age - p.to <= 4 && (s.after!.work!.since ?? s.age) >= p.to
}
/** a grown child (22 or more) who could take the shop on */
const grownChild = (s: LifeState) => s.family.children > 0 && (s.family.kids ?? [30]).some((k) => k >= 22)
/** the job he held longest, from the record of the jobs that ended */
const longestJob = (s: LifeState) => {
  const jobs = s.after?.pastJobs ?? []
  let best = jobs[0]
  for (const j of jobs) if (j.to - (j.from ?? j.to) > best.to - (best.from ?? best.to)) best = j
  return best?.title ?? '仕事'
}

export const WORK_LIFE: EventSpec[] = [
  // ================================================================ a company of his own
  {
    ...A,
    id: 'x.work.startupIdea',
    category: 'startup',
    stages: ['adult'],
    ages: [27, 48],
    when: (s) => companyJob(s) && tenure(s, 3) && !hasFlag(s, 'wl.found') && !hasFlag(s, 'wl.ideaSide') && !hasFlag(s, 'wl.ideaInside') && !hasFlag(s, 'wl.ideaDrop'),
    requires: companyJob,
    weight: 3,
    title: '温めてきた事業の案',
    body: '毎日の仕事で感じてきた不便を、まとめて解決できる仕組みを思いつき、一年かけてノートに書きためてきました。この案を、どうしますか。',
    auto: 3,
    choices: [
      { label: '会社を辞めて、自分で起業する', hint: '貯金を使い、収入は不安定になる。当たれば大きい', when: (s) => s.money >= 100, flag: 'wl.found', effects: { career: 'founder', money: -100, happy: 3 }, outcomes: [{ follow: [{ id: 'x.work.startupFunding', after: 1, within: 2 }], text: '退職の挨拶を終えた翌週、法務局に書類を出し、自宅の一室に小さな会社の看板を掛けました。' }] },
      { label: '勤めながら、週末に試作を進める', hint: '本業は守れるが、休みがなくなる', flag: 'wl.ideaSide', effects: { money: -20, know: 3, happy: -1 }, outcomes: [{ follow: [{ id: 'x.work.ideaSideBack', after: 2, within: 3 }], text: '土曜の朝は喫茶店の隅で、ノートパソコンに向かうのが決まりになりました。' }] },
      { label: '社内の新規事業として提案する', hint: '会社の力を借りられるが、自分のものではなくなる', flag: 'wl.ideaInside', effects: { sat: 3, rel: 2 }, outcomes: [{ follow: [{ id: 'x.work.ideaInsideBack', after: 2, within: 3 }], text: '企画書を二十枚にまとめ、役員の前で十五分間、声を震わせながら説明しました。' }] },
      { label: '今は胸にしまっておく', flag: 'wl.ideaDrop', outcomes: [{ text: 'ノートは机の引き出しの奥にしまい、いつもの通勤電車に乗りました。' }] },
    ],
  },
  {
    ...AF,
    id: 'x.work.ideaSideBack',
    category: 'startup',
    stages: ['adult'],
    when: (s) => holdsJob(s) && hasFlag(s, 'wl.ideaSide'),
    outcomes: [
      { weight: (s) => lift(s, ['intern.long', 0.4]), text: '週末に作った試作品を知人の店で使ってもらううちに、口コミで「うちにも」という声が届き始めました。', effects: { money: 40, happy: 3 }, follow: [{ id: 'x.work.sideToMain', after: 1, within: 2 }] },
      { weight: 1, text: '試作は三度作り直しても形にならず、ノートパソコンを開かない週末が増えていきました。', effects: { money: -30, happy: -2 } },
    ],
  },
  {
    ...AF,
    id: 'x.work.ideaInsideBack',
    category: 'startup',
    stages: ['adult'],
    when: (s) => companyJob(s) && sameJobSince(s, 'wl.ideaInside'),
    outcomes: [
      { weight: (s) => 1 + (s.status.relations - 50) / 60, text: '提案は正式な事業になり、言い出した本人として、小さなチームの責任者を任されました。', effects: { level: 1, sat: 6, money: 40 } },
      { weight: 1, text: '提案は「時期尚早」の四文字で棚上げになりました。二年後、よく似たサービスを他社が始めたと知りました。', effects: { sat: -5, happy: -2 } },
    ],
  },
  {
    ...AF,
    id: 'x.work.startupFunding',
    category: 'startup',
    stages: ['adult', 'senior'],
    when: ownCompany,
    requires: ownCompany,
    title: '開業資金をどう集めるか',
    body: '最初の製品は動き始めましたが、人を雇い、広めていくには、手元のお金では足りません。資金をどこから集めますか。',
    auto: 2,
    choices: [
      { label: '投資家から出資を受ける', hint: '大きく伸ばせるが、成果を厳しく求められる', flag: 'wl.vc', effects: { money: 250, payScale: 1.2, happy: -1 }, outcomes: [{ follow: [{ id: 'x.work.firstHire', after: 1, within: 2 }], text: '十社目に訪ねた投資会社（架空）が出資を決め、契約書に初めて代表取締役として判を押しました。' }] },
      { label: '銀行と公的な融資で借りる', hint: '経営は自分で握れるが、返済が毎月のしかかる', flag: 'wl.bank', effects: { money: 150, happy: -2 }, outcomes: [{ follow: [{ id: 'x.work.firstHire', after: 1, within: 2 }], text: '事業計画書を何度も書き直し、窓口で三度目の面談を終えた日に、融資の知らせが届きました。' }] },
      { label: '自己資金だけで、小さく回す', flag: 'wl.boot', outcomes: [{ follow: [{ id: 'x.work.firstHire', after: 1, within: 2 }], text: '借りず、出資も受けず、売り上げの範囲で一歩ずつ進めることにしました。' }] },
    ],
  },
  {
    ...AF,
    id: 'x.work.firstHire',
    category: 'startup',
    stages: ['adult', 'senior'],
    when: ownCompany,
    requires: ownCompany,
    title: '最初の社員',
    body: '注文が増え、一人では夜中まで手が回らなくなりました。初めての社員を雇うなら、誰に声をかけますか。',
    auto: 2,
    choices: [
      { label: '昔の野球仲間を誘う', hint: '気心は知れているが、仕事の経験は浅い', flag: 'wl.hireMate', effects: { rel: 4, money: -60 }, outcomes: [{ follow: [{ id: 'x.work.startupYears', after: 2, within: 3 }], text: 'グラウンドで声を掛け合った仲間が、「お前の会社なら」と、前の勤め先に退職届を出してくれました。' }] },
      { label: '大きな会社の経験者を、高い給料で迎える', hint: '即戦力だが、人件費が重い', flag: 'wl.hirePro', effects: { money: -120, payScale: 1.2 }, outcomes: [{ follow: [{ id: 'x.work.startupYears', after: 2, within: 3 }], text: '十年以上の経験を持つ人が、自分の年収より高い条件で、入社を決めてくれました。' }] },
      { label: 'もうしばらく、一人で回す', flag: 'wl.solo', outcomes: [{ follow: [{ id: 'x.work.startupYears', after: 2, within: 3 }], text: '求人の文面は下書きのまま保存し、もう少し一人で踏ん張ることにしました。' }] },
    ],
  },
  {
    ...AF,
    id: 'x.work.startupYears',
    category: 'startup',
    stages: ['adult', 'senior'],
    when: ownCompany,
    outcomes: [
      { weight: (s) => lift(s, ['wl.vc', 0.4], ['wl.hirePro', 0.5], ['wl.hireMate', 0.2]) + (s.status.knowledge - 50) / 100, text: '大口の取引先が付き、会社は三期目で初めて黒字になりました。オフィスを借り、机が五つに増えました。', effects: { payScale: 1.5, money: 150, happy: 4, sat: 4 }, follow: [{ id: 'x.work.growth', after: 2, within: 3 }] },
      { weight: (s) => 1.3 + (hasFlag(s, 'wl.bank') ? 0.3 : 0), text: '頼りにしていた取引先が契約を打ち切り、通帳の残高が、月末の支払いに足りなくなりそうです。', effects: { payScale: 0.7, happy: -4 }, follow: [{ id: 'x.work.cashCrunch', after: 1, within: 1 }] },
    ],
  },
  {
    ...AF,
    id: 'x.work.cashCrunch',
    category: 'startup',
    stages: ['adult', 'senior'],
    when: ownCompany,
    requires: ownCompany,
    decision: 'major',
    title: '資金が尽きかけている',
    body: '来月の給料日を越えられるかどうか、という所まで来ました。会社をどうしますか。',
    auto: 3,
    choices: [
      { label: '事業の向きを大きく変える', hint: '今の製品を捨て、別の客に賭ける', flag: 'wl.pivot', effects: { payScale: 0.8, happy: -2, know: 3 }, outcomes: [{ follow: [{ id: 'x.work.crunchAfter', after: 2, within: 2 }], text: '二年かけた製品の開発を止め、問い合わせの多かった別の使い道に、全員で向き直りました。' }] },
      { label: '個人で保証をして、追加の借り入れをする', hint: '時間は買えるが、失敗すれば借金は自分に残る', flag: 'wl.guarantee', effects: { money: 200, happy: -3 }, outcomes: [{ follow: [{ id: 'x.work.crunchAfter', after: 2, within: 2 }], text: '連帯保証の欄に自分の名前を書き、印鑑を押す手が、少しだけ止まりました。' }] },
      { label: '傷が浅いうちに、会社をたたむ', hint: '借金は残るが、これ以上は膨らまない', flag: ['wl.closed', 'wl.debt'], effects: { job: 'quit', money: -350, happy: -8 }, outcomes: [{ follow: [{ id: 'x.work.debtLife', after: 1, within: 2 }], text: '社員一人ひとりに頭を下げ、次の勤め先の紹介状を書いてから、会社の登記を閉じました。' }] },
      { label: '支払いを待ってもらい、耐える', flag: 'wl.endure', outcomes: [{ follow: [{ id: 'x.work.crunchAfter', after: 2, within: 2 }], text: '取引先を一軒ずつ回り、支払いの期日を二か月延ばしてもらいました。' }] },
    ],
  },
  {
    ...AF,
    id: 'x.work.crunchAfter',
    category: 'startup',
    stages: ['adult', 'senior'],
    when: (s) => ownCompany(s) && (hasFlag(s, 'wl.pivot') || hasFlag(s, 'wl.guarantee') || hasFlag(s, 'wl.endure')),
    outcomes: [
      { when: has('wl.pivot'), weight: 1.2, text: '向きを変えた先に、思いがけない需要がありました。新しいサービスは、半年で前の製品の三倍の売り上げになりました。', effects: { payScale: 1.8, money: 200, sat: 6, happy: 5 }, follow: [{ id: 'x.work.growth', after: 2, within: 3 }] },
      { when: has('wl.pivot'), weight: 1, text: '方向を変えても、客は思ったほど集まりませんでした。会社は細々と続いていますが、給料は会社員時代の半分ほどです。', effects: { payScale: 0.7, happy: -3, sat: -4 } },
      { when: has('wl.guarantee'), weight: 1, text: '借りたお金で耐えた一年の間に、新しい取引先が見つかり、会社はどうにか息を吹き返しました。', effects: { money: 100, sat: 4, happy: 3 } },
      { when: has('wl.guarantee'), weight: 1.2, text: '借り入れでつないだ時間は、売り上げの回復に届きませんでした。会社は倒産し、保証した借金が、そのまま自分の肩に残りました。', effects: { job: 'quit', money: -500, happy: -9, flag: 'wl.debt' }, follow: [{ id: 'x.work.debtLife', after: 1, within: 2 }] },
      { when: has('wl.endure'), weight: 1, text: '延ばしてもらった期日のあいだに、小さな注文が少しずつ戻ってきました。派手さはありませんが、会社は続いています。', effects: { payScale: 1.1, sat: 2 } },
      { when: has('wl.endure'), weight: 1, text: '耐えるだけの一年が過ぎ、取引先への支払いを最後に済ませてから、静かに会社を閉じました。', effects: { job: 'quit', money: -150, happy: -5, flag: 'wl.closed' } },
    ],
  },
  {
    ...AF,
    id: 'x.work.debtLife',
    category: 'startup',
    stages: ['adult', 'senior'],
    when: has('wl.debt'),
    decision: 'major',
    title: '会社の借金',
    body: '会社はなくなりましたが、保証人として背負った借金は、まだ約500万円残っています。弁護士は、いくつかの道があると言いました。',
    auto: 2,
    choices: [
      { label: '自己破産の手続きをする', hint: '借金はなくなるが、しばらくは信用を失う', flag: 'wl.bankrupt', effects: { money: 300, happy: -5, rel: -2 }, outcomes: [{ follow: [{ id: 'x.work.debtBack', after: 5, within: 4 }], text: '裁判所の廊下の長椅子で、名前を呼ばれるのを待ちました。思っていたより、事務的な手続きでした。' }] },
      { label: '働きながら、少しずつ返していく', hint: '時間はかかるが、自分の手で始末をつけられる', flag: 'wl.repay', effects: { money: -150, happy: -2, rel: 2 }, outcomes: [{ follow: [{ id: 'x.work.debtBack', after: 5, within: 4 }], text: '返済の計画表を作り、毎月の振込日を、手帳の赤い丸で囲みました。' }] },
      { label: '弁護士に任せて、結論を急がない', flag: 'wl.debtWait', outcomes: [{ text: '書類の束を弁護士に預け、まずは目の前の暮らしを立て直すことにしました。' }] },
    ],
  },
  {
    ...AF,
    id: 'x.work.debtBack',
    category: 'startup',
    stages: ['adult', 'senior'],
    when: (s) => hasFlag(s, 'wl.repay') || hasFlag(s, 'wl.bankrupt'),
    outcomes: [
      { when: has('wl.repay'), weight: 2, text: '最後の振込を終えた日、銀行の前の自販機で缶コーヒーを買い、一人で小さく乾杯しました。', effects: { happy: 8, rel: 2 } },
      { when: has('wl.repay'), weight: 1, text: '返済はまだ半分残っています。それでも、毎月の振込を一度も遅らせなかったことが、今の支えです。', effects: { money: -80, happy: 1 } },
      { when: has('wl.bankrupt'), weight: 1, text: '手続きから五年が過ぎ、ようやく新しいカードが作れました。失敗の話を、笑って人に話せるようになりました。', effects: { happy: 4, know: 2 } },
    ],
  },
  {
    ...AF,
    id: 'x.work.growth',
    category: 'startup',
    stages: ['adult', 'senior'],
    when: ownCompany,
    requires: ownCompany,
    decision: 'major',
    title: '会社の行き先',
    body: '社員は三十人を超え、業界の雑誌にも名前が載るようになりました。証券会社と、同業の大手（架空）の両方から、話が来ています。',
    auto: 2,
    choices: [
      { label: '株式の上場を目指す', hint: '大きな成功の道だが、審査と準備に何年もかかる', flag: 'wl.ipoPrep', effects: { payScale: 1.2, money: -100, happy: -2 }, outcomes: [{ follow: [{ id: 'x.work.exit', after: 3, within: 3 }], text: '監査法人と契約を結び、社内の規則を一から作り直す、長い準備が始まりました。' }] },
      { label: '大手に会社を売却する', hint: 'まとまったお金が入るが、会社は自分の手を離れる', flag: 'wl.sold', effects: { job: 'quit', money: 1500, happy: 3 }, outcomes: [{ text: '売却の契約に署名した夜、空になった社長室の椅子に、しばらく座っていました。' }] },
      { label: '今の規模で、堅実に続ける', flag: 'wl.steady', outcomes: [{ text: 'どちらの話も丁重に断り、目の届く大きさの会社のまま、続けることにしました。' }] },
    ],
  },
  {
    ...AF,
    id: 'x.work.exit',
    category: 'startup',
    stages: ['adult', 'senior'],
    when: (s) => ownCompany(s) && hasFlag(s, 'wl.ipoPrep'),
    outcomes: [
      // (the rare top of the chain: idea, money, growth, then three years of preparation)
      { weight: (s) => 0.35 * lift(s, ['wl.vc', 0.5], ['wl.hirePro', 0.3]), key: true, kind: 'big', text: '上場の日、取引所の鐘を社員と一緒に鳴らしました。自宅の一室から始めた会社に、初めて株価が付きました。', effects: { achieve: '上場企業の創業者', money: 3000, fame: 8, payScale: 1.8, happy: 8 }, follow: [{ id: 'x.work.listedYears', after: 3, within: 3 }] },
      { weight: 1, text: '準備の途中で、大手から買収の申し出があり、受け入れることにしました。上場の夢は、別の形で区切りを迎えました。', effects: { job: 'quit', money: 1200, happy: 2, flag: 'wl.sold' } },
      { weight: 1, text: '審査で管理体制の甘さを指摘され、上場は延期になりました。準備にかけた費用だけが、重く残りました。', effects: { payScale: 0.85, money: -200, happy: -4, sat: -3 } },
    ],
  },
  {
    ...AF,
    id: 'x.work.listedYears',
    category: 'startup',
    stages: ['adult', 'senior'],
    when: ownCompany,
    requires: ownCompany,
    title: '上場企業の社長として',
    body: '株主総会では、毎年のように厳しい質問が飛びます。創業の頃からの社員には、もう名前を覚えきれないほど、新しい顔が増えました。',
    auto: 2,
    choices: [
      { label: '後任の社長を育てて、会長に退く', hint: '会社は次の世代に渡るが、自分の居場所は小さくなる', flag: 'wl.chair', effects: { job: 'retire', money: 800, happy: 3 }, outcomes: [{ text: '十年かけて見込んだ部下に社長の席を譲り、創業の日に撮った写真を、彼の机に置いていきました。' }] },
      { label: '株主の声に応えて、もう一段の拡大に挑む', hint: '会社は大きくなるが、休む間はない', flag: 'wl.expand', effects: { payScale: 1.3, happy: -3, fame: 4 }, outcomes: [{ text: '海外に拠点を出す計画を発表し、その月は三つの国を飛行機で回りました。' }] },
      { label: '今のまま、社長を続ける', flag: 'wl.stayCeo', outcomes: [{ text: '大きな発表はせず、毎朝いちばんに出社する習慣を、変えずに続けました。' }] },
    ],
  },
  {
    ...A,
    id: 'x.work.founderLate',
    // (only a man who founded a company: always his own answer)
    needsChoice: true,
    category: 'startup',
    stages: ['senior'],
    ages: [65, 85],
    when: (s) => hasFlag(s, 'wl.found') || hasFlag(s, 'wl.soloFirm'),
    weight: 4,
    title: '若い起業家からの相談',
    body: (s) =>
      `${s.career.achievements.includes('上場企業の創業者') ? '上場まで会社を育てた話を聞きつけて' : hasFlag(s, 'wl.closed') || hasFlag(s, 'wl.debt') ? '会社をたたんだ経験を聞きたいと言って' : '自分で会社を興した経験を聞きたいと言って'}、二十代の若者が訪ねてきました。手には、かつての自分と同じような、書き込みだらけのノートがあります。`,
    auto: 2,
    choices: [
      {
        label: '少額を出資して、応援する',
        hint: 'お金は戻らないかもしれない',
        flag: 'wl.angel',
        effects: { money: -200 },
        outcomes: [
          { weight: 1, text: '出資した会社は五年後に大きく伸び、受け取った配当で、昔の社員たちを招いて食事をしました。', effects: { money: 600, happy: 5 } },
          { weight: 2, text: '出資した会社は三年で解散しました。若者からの丁寧な詫び状を、本棚にしまいました。', effects: { happy: -1 } },
        ],
      },
      { label: '月に一度、話を聞く相談役になる', hint: 'お金は出さず、経験を渡す', flag: 'wl.mentorYoung', effects: { rel: 4, happy: 3 }, outcomes: [{ text: '毎月第一土曜、駅前の喫茶店で、若者の資金繰りの表に赤ペンを入れるのが楽しみになりました。' }] },
      { label: '昔話だけして、送り出す', flag: 'wl.oldTalk', outcomes: [{ text: '自分の失敗談を三つだけ話し、「あとは自分で転んで覚えなさい」と送り出しました。' }] },
    ],
  },

  // ================================================================ side work, and a side job that becomes the main one
  {
    ...A,
    id: 'x.work.sideJob',
    category: 'sideJob',
    stages: ['adult'],
    ages: [26, 55],
    when: (s) => companyJob(s) && tenure(s, 2) && !hasFlag(s, 'wl.sideCoach') && !hasFlag(s, 'wl.sideDesk') && !hasFlag(s, 'wl.sideFarm') && !hasFlag(s, 'wl.sideNone'),
    requires: companyJob,
    weight: 2.5,
    title: '副業の解禁',
    body: '会社の就業規則が変わり、届け出をすれば副業をしてよいことになりました。空いた時間を、どう使いますか。',
    auto: 3,
    choices: [
      { label: '週末に、子ども向けの野球教室を開く', hint: '昔の経験が活きる。土日は埋まる', when: (s) => s.career.highestRank >= 3, flag: 'wl.sideCoach', effects: { money: 20, rel: 3, happy: 2 }, outcomes: [{ follow: [{ id: 'x.work.sideJobBack', after: 2, within: 3 }], text: '河川敷のグラウンドを借り、最初の日曜日には、小学生が四人集まりました。' }] },
      { label: '夜に、在宅でウェブの仕事を請ける', hint: '収入は増えるが、睡眠が削られる', flag: 'wl.sideDesk', effects: { money: 40, happy: -2, know: 2 }, outcomes: [{ follow: [{ id: 'x.work.sideJobBack', after: 2, within: 3 }], text: '仲介サイトに登録し、夜十時からの二時間を、請け負った作業に充てるようになりました。' }] },
      { label: '知り合いの農家を、週末に手伝う', hint: 'お金は少ないが、気分が晴れる', flag: 'wl.sideFarm', effects: { money: 15, happy: 3 }, outcomes: [{ follow: [{ id: 'x.work.sideJobBack', after: 2, within: 3 }], text: '朝五時に起きて畑へ向かい、昼には泥だらけの長靴で、おにぎりを頬張りました。' }] },
      { label: '本業に専念する', flag: 'wl.sideNone', outcomes: [{ text: '届け出の用紙は受け取りましたが、記入しないまま、机の引き出しに入れました。' }] },
    ],
  },
  {
    ...AF,
    id: 'x.work.sideJobBack',
    category: 'sideJob',
    stages: ['adult'],
    when: (s) => holdsJob(s) && (hasFlag(s, 'wl.sideCoach') || hasFlag(s, 'wl.sideDesk') || hasFlag(s, 'wl.sideFarm')),
    outcomes: [
      { when: has('wl.sideCoach'), weight: 1, text: '教室の生徒は三十人を超え、保護者から「平日の教室も作ってほしい」と頼まれるようになりました。', effects: { money: 30, rel: 3 }, follow: [{ id: 'x.work.sideToMain', after: 1, within: 2 }] },
      { when: has('wl.sideCoach'), weight: 1, text: '週末の教室と平日の仕事の両立に疲れ、教室は知り合いのコーチに引き継ぎました。', effects: { happy: -1, sat: -2 } },
      { when: has('wl.sideDesk'), weight: 1, text: '夜の仕事の評判が広がり、名指しで依頼してくる取引先が、いくつもできました。', effects: { money: 60, know: 2 }, follow: [{ id: 'x.work.sideToMain', after: 1, within: 2 }] },
      { when: has('wl.sideDesk'), weight: 1, text: '寝不足が続いて本業で大きなミスをし、夜の仕事は、きっぱりやめることにしました。', effects: { happy: -4, sat: -3, money: 20 } },
      { when: has('wl.sideFarm'), weight: 2, text: '畑の手伝いの礼にもらう野菜で、台所がいつもにぎやかです。土の匂いが、平日の疲れを抜いてくれます。', effects: { happy: 4, money: 10 } },
      { when: has('wl.sideFarm'), weight: 1, text: '慣れない農作業で腰を痛め、収穫の季節を前に、手伝いを休むことになりました。', effects: { happy: -2 } },
    ],
  },
  {
    ...AF,
    id: 'x.work.sideToMain',
    category: 'sideJob',
    stages: ['adult'],
    when: (s) => employed(s) && (hasFlag(s, 'wl.ideaSide') || hasFlag(s, 'wl.sideCoach') || hasFlag(s, 'wl.sideDesk')),
    requires: employed,
    decision: 'major',
    title: '副業を本業に',
    body: '副業の収入が、本業の給料に迫ってきました。このまま二足のわらじを続けるか、どちらかを選ぶ時が来たようです。',
    auto: 2,
    choices: [
      { label: '勤めを辞め、会社を作って独立する', hint: '自分の事業に賭ける', when: (s) => !hasFlag(s, 'wl.found'), flag: 'wl.found', effects: { career: 'founder', money: -80, happy: 4 }, outcomes: [{ follow: [{ id: 'x.work.startupFunding', after: 1, within: 2 }], text: '勤め先に退職届を出し、副業で付き合ってきた取引先に、新しい会社の名刺を配って回りました。' }] },
      { label: '事業ごと、信頼できる知人に譲る', hint: 'まとまったお金が入り、本業に戻れる', flag: 'wl.sideSold', effects: { money: 150, happy: -1 }, outcomes: [{ text: '顧客の一覧と手順書を知人に渡し、譲渡の代金を受け取りました。少し寂しい気持ちが残りました。' }] },
      { label: '副業のまま、続ける', flag: 'wl.sideKeep', outcomes: [{ text: '大きな決断は先送りにして、平日と週末の二つの顔を、もうしばらく続けることにしました。' }] },
    ],
  },

  // ================================================================ the restaurant he opened (only for one who chose to open it)
  {
    ...A,
    id: 'x.work.shopBranch',
    needsChoice: true,
    category: 'shopOwner',
    stages: ['adult'],
    ages: [30, 62],
    when: (s) => myShop(s) && tenure(s, 4) && !hasFlag(s, 'wl.branch') && !hasFlag(s, 'wl.renovate') && !hasFlag(s, 'wl.oneShop'),
    requires: myShop,
    weight: 4,
    title: '二号店の話',
    body: '店は昼も夜も満席の日が続いています。隣の駅の商店街に、ちょうどいい空き物件が出たと、不動産屋が知らせてきました。',
    auto: 2,
    choices: [
      { label: '借り入れをして、二号店を出す', hint: '当たれば売り上げは倍。人手が要る', flag: 'wl.branch', effects: { money: -300, sat: 3 }, outcomes: [{ follow: [{ id: 'x.work.shopBranchBack', after: 2, within: 3 }], text: '同じ暖簾をもう一枚あつらえ、隣駅の店の開店の朝、自分で最初の一杯を作りました。' }] },
      { label: '今の店を改装して、席を増やす', hint: '目は届くが、工事の間は休業になる', flag: 'wl.renovate', effects: { money: -120, sat: 2, happy: 1 }, outcomes: [{ follow: [{ id: 'x.work.shopBranchBack', after: 2, within: 3 }], text: '二週間店を閉めて壁を一枚抜き、カウンターの奥に、八人掛けの座敷を作りました。' }] },
      { label: '一軒の店を、自分の手で守る', flag: 'wl.oneShop', outcomes: [{ text: '不動産屋には礼を言って断り、いつもの仕込みに戻りました。' }] },
    ],
  },
  {
    ...AF,
    id: 'x.work.shopBranchBack',
    category: 'shopOwner',
    stages: ['adult', 'senior'],
    when: (s) => myShop(s) && (hasFlag(s, 'wl.branch') || hasFlag(s, 'wl.renovate')),
    outcomes: [
      { when: has('wl.branch'), weight: 1, text: '二号店にも行列ができ、本店で育てた若い料理人が、店長を任されるまでになりました。', effects: { money: 450, sat: 6, happy: 3 } },
      { when: has('wl.branch'), weight: 1.2, text: '二号店は人手が集まらず、一年足らずで閉めることになりました。借りたお金の返済だけが残りました。', effects: { money: -250, happy: -5, sat: -4 } },
      { when: has('wl.renovate'), weight: 2, text: '座敷ができたおかげで、会社の宴会や法事の予約が入るようになりました。', effects: { money: 180, sat: 3 } },
      { when: has('wl.renovate'), weight: 1, text: '広くなった店は、昔からの常連には落ち着かないようで、顔を見せる回数が減りました。', effects: { rel: -2, money: -40 } },
    ],
  },
  {
    ...A,
    id: 'x.work.shopReview',
    needsChoice: true,
    category: 'shopOwner',
    stages: ['adult', 'senior'],
    ages: [25, 72],
    when: (s) => myShop(s) && tenure(s, 2) && !hasFlag(s, 'wl.revSorry') && !hasFlag(s, 'wl.revFight') && !hasFlag(s, 'wl.revQuiet'),
    requires: myShop,
    weight: 4,
    title: '店の悪評が広まった',
    body: '「店主の態度が最悪だった」という客の投稿が、店の写真つきで一晩に何万回も拡散されました。混んでいた日のことで、言い分もあります。どう応じますか。',
    auto: 2,
    choices: [
      { label: '事実を確かめ、謝罪と改善を伝える', hint: '非を認めることになるが、誠実さは伝わる', flag: 'wl.revSorry', effects: { money: -30, rel: 3 }, outcomes: [{ follow: [{ id: 'x.work.shopReviewBack', after: 1, within: 2 }], text: '店の入り口に手書きの貼り紙を出し、同じ文面を、店のアカウントにも載せました。' }] },
      { label: '誇張されている点に、はっきり反論する', hint: '常連は分かってくれるかもしれないが、火に油の恐れもある', flag: 'wl.revFight', effects: { happy: -2, rel: -3 }, outcomes: [{ follow: [{ id: 'x.work.shopReviewBack', after: 1, within: 2 }], text: '閉店後の厨房で、当日の伝票を見返しながら、長い反論の文章を書き上げました。' }] },
      { label: '何も言わず、いつも通り店を開ける', flag: 'wl.revQuiet', outcomes: [{ text: '鳴り続ける電話の線を抜き、翌朝も、いつもの時間に暖簾を出しました。' }] },
    ],
  },
  {
    ...AF,
    id: 'x.work.shopReviewBack',
    category: 'shopOwner',
    stages: ['adult', 'senior'],
    when: (s) => myShop(s) && (hasFlag(s, 'wl.revSorry') || hasFlag(s, 'wl.revFight')),
    outcomes: [
      { when: has('wl.revSorry'), weight: 1.5, text: '貼り紙の文面が「潔い」と話題になり、騒ぎのあと、かえって遠くから訪ねてくる客が増えました。', effects: { money: 120, happy: 3 } },
      { when: has('wl.revSorry'), weight: 1, text: '謝罪のあとも客足はなかなか戻らず、半年ほど、空いた席の目立つ夜が続きました。', effects: { money: -80, happy: -2 } },
      { when: has('wl.revFight'), weight: 1, text: '反論の文章がさらに拡散され、店の電話には、見知らぬ人からの抗議が一か月続きました。', effects: { money: -150, happy: -4 } },
      { when: has('wl.revFight'), weight: 1, text: '常連たちが「あの店はそんな店じゃない」と次々に書き込み、騒ぎは一週間ほどで収まりました。', effects: { rel: 3, happy: 2 } },
    ],
  },
  {
    ...A,
    id: 'x.work.shopRegular',
    needsChoice: true,
    category: 'shopOwner',
    stages: ['adult', 'senior'],
    ages: [30, 75],
    when: (s) => myShop(s) && tenure(s, 6),
    requires: myShop,
    weight: 4,
    title: '常連さんの最後の注文',
    body: '開店の年から毎週通ってくれた年配の常連さんが、遠くの施設に移ることになりました。「最後に、いつもの定食をもう一度」と言います。',
    auto: 2,
    choices: [
      { label: 'その日は貸し切りにして、常連仲間を呼ぶ', hint: '一日の売り上げはなくなる', effects: { money: -20, rel: 4, happy: 4 }, outcomes: [{ text: '貸し切りの札を掛けた店に、顔なじみが十人以上集まり、最後は全員で記念写真を撮りました。' }] },
      { label: 'いつもの味の作り方を書いて、渡す', hint: '店の味が、店の外に出る', effects: { happy: 2, sat: 3 }, outcomes: [{ text: '煮物の分量と火加減を便箋三枚に書き、「施設の台所の人に」と添えて手渡しました。' }] },
      { label: '普段どおりに迎え、普段どおりに送る', flag: 'wl.regularPlain', outcomes: [{ text: 'いつもの席に、いつもの定食を出し、「またどうぞ」とだけ言って見送りました。' }] },
    ],
  },
  {
    ...A,
    id: 'x.work.shopHandover',
    needsChoice: true,
    category: 'shopOwner',
    stages: ['adult', 'senior'],
    ages: [60, 75],
    when: (s) => myShop(s) && tenure(s, 10),
    requires: myShop,
    weight: 4,
    decision: 'major',
    title: '店を誰に渡すか',
    body: '朝の仕込みで、重い鍋を持ち上げるのがつらくなってきました。店のこれからを、決める時が来たようです。',
    auto: 3,
    choices: [
      { label: '長く働いてくれた弟子に、店を譲る', hint: '味は残るが、自分の店ではなくなる', flag: 'wl.handApprentice', effects: { job: 'retire', happy: 4, rel: 3 }, outcomes: [{ follow: [{ id: 'x.work.shopHandoverBack', after: 3, within: 4 }], text: '最後の営業の夜、厨房の包丁を一本ずつ研ぎ直して、弟子に手渡しました。' }] },
      { label: '子どもに、店を継いでもらう', hint: '店は身内に残るが、苦労も引き継がせる', when: grownChild, flag: 'wl.handKid', effects: { job: 'retire', rel: 5, happy: 3, money: -50 }, outcomes: [{ follow: [{ id: 'x.work.shopHandoverBack', after: 3, within: 4 }], text: '店の名義を書き換え、改装の費用の一部を、開店祝いとして出してやりました。' }] },
      { label: '店と土地を売って、引退する', hint: 'まとまったお金になるが、店は消える', flag: 'wl.handSold', effects: { job: 'retire', money: 600, happy: -1 }, outcomes: [{ follow: [{ id: 'x.work.shopHandoverBack', after: 3, within: 4 }], text: '最後の日、常連に配る手ぬぐいを百本用意し、閉店の貼り紙を自分で書きました。' }] },
      { label: '体が動くうちは、自分で続ける', flag: 'wl.handKeep', outcomes: [{ text: '鍋を一回り小さいものに替え、夜の営業を週に三日に減らして、店を続けることにしました。' }] },
    ],
  },
  {
    ...AF,
    id: 'x.work.shopHandoverBack',
    category: 'shopOwner',
    stages: ['adult', 'senior'],
    when: (s) => hasFlag(s, 'wl.handApprentice') || hasFlag(s, 'wl.handKid') || hasFlag(s, 'wl.handSold'),
    outcomes: [
      { when: has('wl.handApprentice'), weight: 2, text: '客として店のカウンターに座りました。弟子の煮物は少しだけ味が濃く、それが、なぜか嬉しく感じられました。', effects: { happy: 5 } },
      { when: has('wl.handApprentice'), weight: 1, text: '弟子は店の名前を変え、品書きも半分入れ替えました。分かっていても、看板を見るたびに胸が痛みます。', effects: { happy: -2, rel: -1 } },
      { when: has('wl.handKid'), weight: 1, text: '継いだ店は若い客にも人気が出て、昼どきに手伝いに立つのが、何よりの楽しみになりました。', effects: { happy: 5, rel: 3 } },
      { when: has('wl.handSold'), weight: 1, text: '店のあった場所はコインパーキングになりました。それでも、自由になった朝の散歩を楽しんでいます。', effects: { happy: 2, rel: -2 } },
    ],
  },

  // ================================================================ a manager's years at a company
  {
    ...A,
    id: 'x.work.teamLead',
    category: 'manager',
    stages: ['adult'],
    ages: [28, 55],
    when: (s) => companyJob(s) && s.after!.work!.level >= 1 && tenure(s, 4) && !hasFlag(s, 'wl.lead') && !hasFlag(s, 'wl.leadAuto'),
    requires: companyJob,
    weight: 3,
    title: '初めての部下たち',
    body: '新しい部署で、五人の部下を持つことになりました。年上の人も、入ったばかりの新人もいます。どんなやり方で、チームをまとめますか。',
    auto: 3,
    choices: [
      { label: '自分が先頭に立って、手本を見せる', hint: '結果は早いが、自分が抜けられない', flag: ['wl.lead', 'wl.leadFront'], effects: { sat: 3, rel: -1 }, outcomes: [{ follow: [{ id: 'x.work.teamLeadBack', after: 2, within: 3 }], text: '誰よりも早く出社し、難しい客先には、必ず自分が最初に足を運びました。' }] },
      { label: '仕事を任せて、育てる側に回る', hint: '人は育つが、成果は遅れる', flag: ['wl.lead', 'wl.leadCoach'], effects: { rel: 3, sat: -1 }, outcomes: [{ follow: [{ id: 'x.work.teamLeadBack', after: 2, within: 3 }], text: '毎週の面談で、一人ひとりに「次は何をやってみたいか」を聞くことから始めました。' }] },
      { label: '数字で管理し、成果を厳しく求める', hint: '成績は上がるが、空気が硬くなる', flag: ['wl.lead', 'wl.leadNum'], effects: { money: 30, rel: -3 }, outcomes: [{ follow: [{ id: 'x.work.teamLeadBack', after: 2, within: 3 }], text: 'ホワイトボードに全員の月間目標を書き出し、毎朝、進み具合を確かめることにしました。' }] },
      { label: '前任者のやり方を引き継ぐ', flag: 'wl.leadAuto', outcomes: [{ text: '前任者の残したファイルを一通り読み、しばらくは同じやり方で進めることにしました。' }] },
    ],
  },
  {
    ...AF,
    id: 'x.work.teamLeadBack',
    category: 'manager',
    stages: ['adult'],
    when: (s) => companyJob(s) && sameJobSince(s, 'wl.lead'),
    outcomes: [
      { when: has('wl.leadFront'), weight: 1, text: 'チームの成績は社内で一番になり、その働きぶりが認められて、一つ上の役職に推されました。', effects: { level: 1, money: 40, sat: 3 } },
      { when: has('wl.leadFront'), weight: 1, text: '何でも自分で抱え込むうちに、休日も電話が鳴りやまなくなり、心身ともに疲れ切ってしまいました。', effects: { happy: -4, sat: -3 } },
      { when: has('wl.leadCoach'), weight: 1.5, text: '任された新人が大きな契約を取り、社内表彰の壇上で、真っ先にこちらに頭を下げてくれました。', effects: { rel: 4, sat: 4, happy: 2 } },
      { when: has('wl.leadCoach'), weight: 1, text: '目に見える成果が出るまでに時間がかかり、上からは「甘い」と評価を下げられました。', effects: { sat: -2, money: -20 } },
      { when: has('wl.leadNum'), weight: 1, text: '数字はぐんと伸び、ボーナスの査定も上がりました。会議室の空気は、相変わらず張り詰めています。', effects: { money: 60, level: 1 } },
      { when: has('wl.leadNum'), weight: 1, text: 'チームの二人が、相次いで辞めたいと言ってきました。引き留めの面談で、返す言葉が見つかりませんでした。', effects: { rel: -4, sat: -4 } },
    ],
  },
  {
    ...A,
    id: 'x.work.hardCall',
    category: 'manager',
    stages: ['adult'],
    ages: [38, 62],
    when: (s) => companyJob(s) && s.after!.work!.level >= 2 && !hasFlag(s, 'wl.hardShield') && !hasFlag(s, 'wl.hardCut') && !hasFlag(s, 'wl.hardPlace') && !hasFlag(s, 'wl.hardAuto'),
    requires: companyJob,
    weight: 3,
    decision: 'major',
    title: '管理職の重い判断',
    body: '会社の業績が落ち込み、自分の課から二人を、他部署への異動か早期退職に回すよう求められました。誰を、どう選びますか。',
    auto: 3,
    choices: [
      { label: '自分の評価を下げてでも、全員を守る交渉をする', hint: '部下には慕われるが、上からの目は厳しくなる', flag: 'wl.hardShield', effects: { sat: -2, rel: 5, money: -30 }, outcomes: [{ follow: [{ id: 'x.work.hardCallBack', after: 2, within: 3 }], text: '役員室に三度足を運び、課の仕事を減らさずに人件費を削る案を、自分で作って出しました。' }] },
      { label: '方針どおり、公平な基準で二人を選ぶ', hint: '会社の信頼は得るが、心が痛む', flag: 'wl.hardCut', effects: { level: 1, happy: -5, rel: -3 }, outcomes: [{ follow: [{ id: 'x.work.hardCallBack', after: 2, within: 3 }], text: '評価表だけを根拠に二人を選び、面談の部屋で、決まった文面を最後まで読み上げました。' }] },
      { label: '一人ひとりの次の行き先を探して回る', hint: '手間はかかるが、誰も放り出さない', flag: 'wl.hardPlace', effects: { rel: 3, sat: 2, happy: -2 }, outcomes: [{ follow: [{ id: 'x.work.hardCallBack', after: 2, within: 3 }], text: '昔の取引先や他部署の知り合いに頭を下げて回り、二人の受け入れ先を探しました。' }] },
      { label: '人事部の判断に任せる', flag: 'wl.hardAuto', outcomes: [{ text: '候補の名前は人事部に一任し、自分は課の仕事の割り振りを組み直すことにしました。' }] },
    ],
  },
  {
    ...AF,
    id: 'x.work.hardCallBack',
    category: 'manager',
    stages: ['adult', 'senior'],
    when: (s) => (hasFlag(s, 'wl.hardShield') && companyJob(s)) || hasFlag(s, 'wl.hardCut') || hasFlag(s, 'wl.hardPlace'),
    outcomes: [
      { when: (s) => hasFlag(s, 'wl.hardShield') && companyJob(s), weight: 1, text: '守り抜いた課の全員が奮起し、翌年の成績で、会社に借りを返してくれました。', effects: { rel: 3, sat: 4 } },
      { when: (s) => hasFlag(s, 'wl.hardShield') && companyJob(s), weight: 1, text: '上に逆らった管理職として見られ、次の人事で、出世の道から外れた部署に回されました。', effects: { level: -1, sat: -5 } },
      { when: (s) => hasFlag(s, 'wl.hardCut') && companyJob(s), weight: 1, text: '昇進の辞令を受け取った夜、あの面談の部屋の白い壁を思い出して、なかなか眠れませんでした。', effects: { money: 80, happy: -2 } },
      { when: has('wl.hardCut'), weight: 1, text: '選んだ一人と、駅前で偶然会いました。「新しい職場のほうが合っていました」と笑ってくれました。', effects: { happy: 3, rel: 1 } },
      { when: has('wl.hardPlace'), weight: 1.5, text: '二人とも新しい部署で居場所を見つけました。年末に届いた礼状を、手帳に挟んでいます。', effects: { happy: 5, rel: 2 } },
      { when: has('wl.hardPlace'), weight: 1, text: '一人の行き先は、最後まで見つかりませんでした。できる限りのことをしたはずなのに、悔いが残りました。', effects: { happy: -3 } },
    ],
  },
  {
    ...A,
    id: 'x.work.mentee',
    category: 'manager',
    stages: ['adult'],
    ages: [32, 58],
    when: (s) => companyJob(s) && tenure(s, 6) && !hasFlag(s, 'wl.menteeCover') && !hasFlag(s, 'wl.menteeOwn') && !hasFlag(s, 'wl.menteeUp'),
    requires: companyJob,
    weight: 2.5,
    title: '後輩の大きなミス',
    body: '目をかけてきた入社三年目の後輩が、取引先への見積もりの桁を間違え、会社に大きな損を出しかけました。本人は青い顔で黙り込んでいます。',
    auto: 2,
    choices: [
      { label: '自分が前に出て、取引先に頭を下げる', hint: '後輩は救われるが、自分の評価に傷がつく', flag: 'wl.menteeCover', effects: { rel: 4, sat: -2, happy: -1 }, outcomes: [{ follow: [{ id: 'x.work.menteeBack', after: 5, within: 6 }], text: '菓子折りを持って取引先を訪ね、「確認を怠ったのは私です」と、深く頭を下げました。' }] },
      { label: '本人に謝りに行かせ、後ろで支える', hint: '本人は苦しむが、自分で立ち直る力がつく', flag: 'wl.menteeOwn', effects: { rel: 2, sat: 2 }, outcomes: [{ follow: [{ id: 'x.work.menteeBack', after: 5, within: 6 }], text: '謝罪の言葉を一緒に考え、取引先の応接室では、後輩の一歩後ろに黙って座っていました。' }] },
      { label: '上司に報告して、判断を任せる', flag: 'wl.menteeUp', outcomes: [{ text: '経緯を三行にまとめて上司に報告し、その先の判断は任せることにしました。' }] },
    ],
  },
  {
    ...AF,
    id: 'x.work.menteeBack',
    category: 'manager',
    stages: ['adult', 'senior'],
    when: (s) => hasFlag(s, 'wl.menteeCover') || hasFlag(s, 'wl.menteeOwn'),
    outcomes: [
      { when: has('wl.menteeCover'), weight: 1.5, text: 'あの時かばった後輩が課長になり、「あの日の背中を、今も覚えています」と書いた手紙をくれました。', effects: { happy: 4, rel: 3 } },
      { when: has('wl.menteeCover'), weight: 1, text: '後輩はその後、別の会社へ移りました。年に一度、短い近況だけを書いた葉書が届きます。', effects: { happy: 1 } },
      { when: has('wl.menteeOwn'), weight: 1.5, text: '自分で謝りに行ったあの後輩は、今では取引先から名指しで頼られる担当者になりました。', effects: { happy: 5, know: 1 } },
      { when: has('wl.menteeOwn'), weight: 1, text: '後輩はしばらく、こちらを避けるようになりました。突き放されたと感じていたと、ずっと後に聞きました。', effects: { rel: -2, happy: -1 } },
    ],
  },

  // ================================================================ a move: a headhunter, another trade
  {
    ...A,
    id: 'x.work.headhunter',
    category: 'jobChange',
    stages: ['adult'],
    ages: [30, 52],
    when: (s) => companyJob(s) && tenure(s, 5) && !hasFlag(s, 'wl.hunted') && !hasFlag(s, 'wl.leverage') && !hasFlag(s, 'wl.huntNo'),
    requires: companyJob,
    weight: 2.5,
    title: 'ヘッドハンターからの電話',
    body: '人材紹介会社の担当者から、同じ業界の会社が、今より二割高い年収で迎えたいと言っている、と電話がありました。',
    auto: 2,
    choices: [
      { label: '好条件を受けて、移る', hint: '収入は上がるが、一から信頼を作り直す', flag: 'wl.hunted', effects: { job: 'change', money: 60, happy: 2 }, outcomes: [{ follow: [{ id: 'x.work.headhunterBack', after: 2, within: 3 }], text: '送別会で花束を受け取り、翌月から、ライバルだった会社の入館証を首に下げて通い始めました。' }] },
      { label: '誘いを材料に、今の会社と待遇を話し合う', hint: '給料は上がるかもしれないが、信頼が揺らぐ', flag: 'wl.leverage', effects: { money: 40, rel: -2, sat: -1 }, outcomes: [{ follow: [{ id: 'x.work.headhunterBack', after: 2, within: 3 }], text: '上司との面談で、他社から誘われていることを、言葉を選びながら打ち明けました。' }] },
      { label: '丁寧に断る', flag: 'wl.huntNo', outcomes: [{ text: '「今の仕事を最後までやりたいので」と答え、担当者の名刺は名刺入れの奥にしまいました。' }] },
    ],
  },
  {
    ...AF,
    id: 'x.work.headhunterBack',
    category: 'jobChange',
    stages: ['adult'],
    when: (s) => holdsJob(s) && ((hasFlag(s, 'wl.hunted') && sameJobSince(s, 'wl.hunted')) || (hasFlag(s, 'wl.leverage') && sameJobSince(s, 'wl.leverage'))),
    outcomes: [
      { when: has('wl.hunted'), weight: 1.5, text: '新しい会社では前の職場での経験がそのまま活き、入って一年で、大きな案件の責任者に選ばれました。', effects: { sat: 6, money: 80 } },
      { when: has('wl.hunted'), weight: 1, text: '新しい会社の空気になじめず、会議で発言するたびに、前の職場との違いを思い知らされました。', effects: { sat: -6, happy: -3 } },
      { when: has('wl.leverage'), weight: 1, text: '給料は上がりましたが、「いつか出ていく人」と見られているのを、大事な会議に呼ばれないことで感じます。', effects: { sat: -3, money: 30 } },
      { when: has('wl.leverage'), weight: 1, text: '正直に話したことで、上司との距離がかえって縮まり、新しい役割を任されるようになりました。', effects: { level: 1, sat: 2 } },
    ],
  },
  {
    ...A,
    id: 'x.work.tradeChange',
    category: 'jobChange',
    stages: ['adult'],
    ages: [28, 45],
    when: (s) => employed(s) && tenure(s, 3) && !hasFlag(s, 'wl.switch') && !hasFlag(s, 'wl.switchPrep') && !hasFlag(s, 'wl.switchNo'),
    requires: employed,
    weight: 2.5,
    title: '別の業界へ移るか',
    body: '今の仕事に大きな不満はありません。ただ、まったく別の業界で人を探している、という知り合いの話が、頭から離れません。',
    auto: 2,
    choices: [
      { label: '今の仕事を辞めて、未経験の業界に飛び込む', hint: '一からの出直し。収入はしばらく下がる', flag: 'wl.switch', effects: { job: 'quit', know: 4, money: -40, happy: 2 }, outcomes: [{ follow: [{ id: 'x.work.tradeChangeBack', after: 2, within: 3 }], text: (s) => `${formerJob(s) ?? '長く続けた仕事'}の机を片付け、新しい業界の入門書を三冊、鞄に詰めました。` }] },
      { label: '働きながら資格を取り、時機を待つ', hint: '遠回りだが、足場は失わない', flag: 'wl.switchPrep', effects: { know: 5, money: -15, happy: -1 }, outcomes: [{ follow: [{ id: 'x.work.tradeChangeBack', after: 3, within: 3 }], text: '通信講座に申し込み、昼休みの二十分を、テキストを読む時間に充てました。' }] },
      { label: '今の業界で、続ける', flag: 'wl.switchNo', outcomes: [{ text: '知り合いの話には礼を言い、自分の持ち場で、もう少し力を試すことにしました。' }] },
    ],
  },
  {
    ...AF,
    id: 'x.work.tradeChangeBack',
    category: 'jobChange',
    stages: ['adult'],
    when: (s) => holdsJob(s) && (hasFlag(s, 'wl.switch') || hasFlag(s, 'wl.switchPrep')),
    outcomes: [
      { when: has('wl.switch'), weight: 1.3, text: '新しく選んだ仕事は、思っていた以上に性に合いました。朝、目覚ましより先に起きる日が増えました。', effects: { sat: 6, happy: 4 } },
      { when: has('wl.switch'), weight: 1, text: '出直した仕事の給料は、前より月に約5万円少なく、通帳を見るたびに、あの決断を思い返します。', effects: { money: -60, sat: -2 } },
      { when: has('wl.switchPrep'), weight: 1, text: '取った資格が評価され、今の仕事でも、新しい分野の担当を任されるようになりました。', effects: { money: 40, sat: 3 } },
      { when: has('wl.switchPrep'), weight: 1, text: '資格は取れましたが、使う機会のないまま、免状は額に入って壁に掛かっています。', effects: { happy: -1, know: 1 } },
    ],
  },

  // ================================================================ after losing a job
  {
    ...A,
    id: 'x.work.jobLost',
    category: 'jobLoss',
    stages: ['adult'],
    ages: [30, 59],
    // (the year he lost it, before the search finds the next one: a short window, hence the weight)
    when: (s) => s.career.phase === 'retired' && !holdsJob(s) && !s.after?.retired && !!lostJob(s) && s.age - lostJob(s)!.to <= 1 && !hasFlag(s, 'wl.jobless'),
    weight: 6,
    outcomes: [
      {
        text: (s) =>
          `${formerJob(s) ?? '前の仕事'}としての日々が終わり、ハローワークの待合室で番号札を握りました。${s.age >= 45 ? '求人票の年齢欄を見るたびに、ため息が出ました。' : '思ったより若い人が多いことに驚きました。'}`,
        effects: { flag: 'wl.jobless' },
        follow: [{ id: 'x.work.restart', after: 1, within: 2 }],
      },
    ],
  },
  {
    ...AF,
    id: 'x.work.restart',
    category: 'jobLoss',
    stages: ['adult'],
    // (the questions and lines of a newcomer at a workplace: for one who works for someone again, not for one who opened a shop)
    when: (s) => employed(s) && hasFlag(s, 'wl.jobless'),
    requires: employed,
    title: '再出発の一年目',
    body: (s) => `仕事を失ってから、${s.job || '新しい仕事'}として働き始めました。前と同じようにはいかないことばかりです。この一年を、どう過ごしますか。`,
    auto: 3,
    choices: [
      { label: '公共の職業訓練の夜間講座に通う', hint: '学び直せるが、体力とお金を使う', flag: 'wl.training', effects: { know: 5, money: -15, happy: -1 }, outcomes: [{ follow: [{ id: 'x.work.restartBack', after: 2, within: 3 }], text: '仕事帰りに訓練校の教室へ通い、十歳以上年下の受講生と、同じ課題に取り組みました。' }] },
      { label: '新入りとして、何でも引き受ける', hint: '信頼は早くできるが、プライドは脇に置く', flag: 'wl.newcomer', effects: { rel: 3, sat: 3, happy: -1 }, outcomes: [{ follow: [{ id: 'x.work.restartBack', after: 2, within: 3 }], text: '朝の掃除当番から電話番まで、頼まれたことは一つも断らずに引き受けました。' }] },
      { label: '夜と週末に、配達の仕事も掛け持ちする', hint: '収入は戻るが、休む時間がなくなる', flag: 'wl.gig', effects: { money: 45, happy: -3 }, outcomes: [{ follow: [{ id: 'x.work.restartBack', after: 2, within: 3 }], text: 'スマートフォンのアプリに登録し、自転車で夜の住宅街を走り回るようになりました。' }] },
      { label: '目の前の仕事を、淡々とこなす', flag: 'wl.restartPlain', outcomes: [{ text: '先のことは考えすぎず、決められた時間に行き、決められた仕事をこなす毎日を送りました。' }] },
    ],
  },
  {
    ...AF,
    id: 'x.work.restartBack',
    category: 'jobLoss',
    stages: ['adult'],
    when: (s) => employed(s) && (hasFlag(s, 'wl.training') || hasFlag(s, 'wl.newcomer') || hasFlag(s, 'wl.gig')),
    outcomes: [
      { when: (s) => hasFlag(s, 'wl.training') && companyJob(s), weight: 1.3, text: '訓練校で取った資格を見た小さな会社から声がかかり、経験者として迎えられることになりました。', effects: { job: 'change', sat: 5, money: 30 } },
      { when: has('wl.training'), weight: 1, text: '資格は取れたものの、年齢の壁は思ったより高く、書類選考の不採用通知が束になりました。', effects: { happy: -3, know: 1 } },
      { when: has('wl.newcomer'), weight: 1.5, text: '何でも引き受けるうちに頼られるようになり、二年目には、新人の教育を任されるまでになりました。', effects: { rel: 4, sat: 4 } },
      { when: has('wl.newcomer'), weight: 1, text: '若い同僚たちとの話題の違いに、昼休みの輪の中で、ときどき居心地の悪さを感じます。', effects: { sat: -3, happy: -1 } },
      { when: has('wl.gig'), weight: 1, text: '掛け持ちの稼ぎで、失業していた間に減った貯金を、ほぼ元に戻すことができました。', effects: { money: 60, happy: -2 } },
      { when: has('wl.gig'), weight: 1, text: '夜の配達で膝を痛め、掛け持ちは一年でやめました。体が資本だと、身にしみて分かりました。', effects: { happy: -4, money: 20 } },
    ],
  },
  {
    ...A,
    id: 'x.work.youngBoss',
    category: 'jobLoss',
    stages: ['adult'],
    ages: [38, 59],
    when: (s) => employed(s) && restarted(s) && !hasFlag(s, 'wl.bossHumble') && !hasFlag(s, 'wl.bossVoice') && !hasFlag(s, 'wl.bossQuiet'),
    requires: employed,
    weight: 10,
    title: '年下の上司',
    body: '再就職した先で、仕事を教えてくれる上司は、自分より十五歳も年下でした。前の仕事で積んだ経験を、ここでどう扱えばいいのか迷います。',
    auto: 2,
    choices: [
      { label: '一から教わる姿勢を貫く', hint: '関係は良くなるが、言いたいことは飲み込む', flag: 'wl.bossHumble', effects: { rel: 3, sat: 2, happy: -1 }, outcomes: [{ follow: [{ id: 'x.work.youngBossBack', after: 2, within: 3 }], text: 'メモ帳を一冊用意し、上司に言われたことを、その日のうちに清書するようにしました。' }] },
      { label: '経験から気づいたことは、遠慮せず提案する', hint: '役に立てるが、出過ぎると煙たがられる', flag: 'wl.bossVoice', effects: { sat: 3, rel: -1, know: 1 }, outcomes: [{ follow: [{ id: 'x.work.youngBossBack', after: 2, within: 3 }], text: '朝礼のあとに時間をもらい、前の仕事で使っていた段取りの工夫を、紙一枚にまとめて渡しました。' }] },
      { label: '余計なことは言わず、様子を見る', flag: 'wl.bossQuiet', outcomes: [{ text: '最初の半年は、言われたことだけを言われた通りにこなすと決めました。' }] },
    ],
  },
  {
    ...AF,
    id: 'x.work.youngBossBack',
    category: 'jobLoss',
    stages: ['adult'],
    when: (s) => employed(s) && (hasFlag(s, 'wl.bossHumble') || hasFlag(s, 'wl.bossVoice')),
    outcomes: [
      { when: has('wl.bossHumble'), weight: 1.5, text: '年下の上司から「相談しやすい人」と頼られるようになり、昇給の推薦をもらいました。', effects: { money: 30, rel: 3 } },
      { when: has('wl.bossHumble'), weight: 1, text: '黙って従ううちに、自分の意見がどこにあるのか、分からなくなる日がありました。', effects: { sat: -3, happy: -2 } },
      { when: has('wl.bossVoice'), weight: 1.3, text: '提案した段取りが職場の標準になり、上司が会議で「あの人の発案です」と紹介してくれました。', effects: { sat: 5, happy: 3 } },
      { when: has('wl.bossVoice'), weight: 1, text: '提案を重ねるうちに「前の会社の話ばかり」と陰で言われていると知り、口数を減らしました。', effects: { rel: -3, sat: -2 } },
    ],
  },

  // ================================================================ the end of a working life
  {
    ...A,
    id: 'x.work.secondCareer',
    category: 'lateCareer',
    stages: ['adult'],
    ages: [57, 63],
    // (not for one who has already chosen his way past 定年 in x.late.retire: the same question twice)
    when: (s) => companyJob(s) && tenure(s, 10) && !['wl.soloFirm', 'wl.advisor', 'wl.toEnd', 'retire.keep', 'retire.full', 'retire.small'].some((f) => hasFlag(s, f)),
    requires: companyJob,
    weight: 3,
    title: '二枚目の名刺',
    body: '長年の取引先の社長から、「定年したら、うちを手伝ってくれないか」と声をかけられました。自分の経験を売り物に、一人で商売を始める道もあります。',
    auto: 2,
    choices: [
      { label: '一人で小さな会社を立ち上げる', hint: '自分の裁量で働けるが、仕事は自分で取ってくる', flag: 'wl.soloFirm', effects: { career: 'founder', money: -50, happy: 3 }, outcomes: [{ follow: [{ id: 'x.work.secondCareerBack', after: 2, within: 3 }], text: '退職金の一部で事務机とプリンターを買い、肩書きの欄に「代表」と刷った名刺を作りました。' }] },
      { label: '取引先の顧問として、週に二日だけ通う', hint: '収入は減るが、体は楽になる', flag: 'wl.advisor', effects: { job: 'retire', money: 150, happy: 2 }, outcomes: [{ follow: [{ id: 'x.work.secondCareerBack', after: 2, within: 3 }], text: '会社を早めに退き、火曜と金曜だけ、取引先の小さな応接室に通う生活が始まりました。' }] },
      { label: '定年まで、今の会社で勤め上げる', flag: 'wl.toEnd', outcomes: [{ text: '「ありがたいお話ですが」と頭を下げ、残りの年月を、今の会社で過ごすことにしました。' }] },
    ],
  },
  {
    ...AF,
    id: 'x.work.secondCareerBack',
    category: 'lateCareer',
    stages: ['adult', 'senior'],
    when: (s) => (hasFlag(s, 'wl.soloFirm') && careerOf(s) === 'founder' && sameJobSince(s, 'wl.soloFirm')) || hasFlag(s, 'wl.advisor'),
    outcomes: [
      { when: (s) => careerOf(s) === 'founder' && sameJobSince(s, 'wl.soloFirm'), weight: 1.3, text: '昔の取引先が次々に仕事を回してくれ、一人の会社は、会社員時代の終わりより忙しくなりました。', effects: { payScale: 1.4, sat: 5, money: 80 } },
      { when: (s) => careerOf(s) === 'founder' && sameJobSince(s, 'wl.soloFirm'), weight: 1, text: '思ったほど依頼は来ず、二年で会社を閉じました。これからは、のんびり暮らすことにしました。', effects: { job: 'retire', happy: -2 } },
      { when: has('wl.advisor'), weight: 1.5, text: '顧問として若い社員の相談に乗るうちに、社内勉強会の講師まで頼まれるようになりました。', effects: { happy: 4, rel: 3 } },
      { when: has('wl.advisor'), weight: 1, text: '顧問の席は名前だけのもので、相談に来る人はほとんどいませんでした。一年で、自分から身を引きました。', effects: { happy: -2, know: -1 } },
    ],
  },
  {
    ...A,
    id: 'x.work.lookBack',
    category: 'lateCareer',
    stages: ['senior'],
    ages: [66, 84],
    when: (s) => !holdsJob(s) && (s.after?.pastJobs?.length ?? 0) >= 1,
    weight: 2.5,
    title: '働いた年月を語る',
    body: (s) => `地元の高校から、就職を控えた生徒たちに、自分の仕事人生を話してほしいと頼まれました。いちばん長く続けたのは、${longestJob(s)}でした。`,
    auto: 2,
    choices: [
      { label: '失敗も含めて、ありのままを話す', hint: '人前に立つのは緊張する', flag: 'wl.talkDone', effects: { rel: 3, happy: 3 }, outcomes: [{ text: '体育館の壇上で、うまくいかなかった年の話をすると、いちばん後ろの列の生徒が、身を乗り出して聞いていました。' }] },
      { label: '話す代わりに、働いた記録を冊子にまとめて贈る', hint: '時間と印刷代がかかる', flag: 'wl.talkBook', effects: { know: 2, happy: 2, money: -15 }, outcomes: [{ text: '古い手帳を読み返しながら、四十ページの冊子を書き上げ、進路指導室に二十部届けました。' }] },
      { label: '人前に出るのは、辞退する', flag: 'wl.talkNo', outcomes: [{ text: '電話口で丁寧に断り、その夜、久しぶりに昔の名刺入れを開いてみました。' }] },
    ],
  },
]
