import type { LifeState } from '../types.ts'
import { careerOf } from '../careers.ts'
import { hasFlag, sameJobSince, tenure, type EventSpec } from './spec.ts'

// the licensed work after a university of its course (license.ts, feedback r11 A8: 歯科大学 → 歯科医師, not an ordinary clerk): a clinic
// or a pharmacy of his own (the 開業 that can make a dentist well off, or leave him with a loan), the nights of a hospital, the old
// team's doctor, and the years when he hands the practice on. The おまかせ answer only sets facts; opening a practice is always the
// player's own answer. All money figures are game assumptions.

const A = { extra: true } as const
const AF = { extra: true, followOnly: true } as const
const has = (f: string) => (s: LifeState) => hasFlag(s, f)
/** a doctor or a dentist in a hospital's or another's clinic (not his own yet) */
const practitioner = (s: LifeState) => (careerOf(s) === 'dentist' || careerOf(s) === 'doctor') && !hasFlag(s, 'lic.open')
const medical = (s: LifeState) => ['doctor', 'dentist', 'pharmacist', 'nurse'].includes(careerOf(s) ?? '')

export const LICENSE_LIFE: EventSpec[] = [
  {
    ...A,
    id: 'x.lic.clinic',
    category: 'licenseWork',
    // (needs the earlier choice of a university of a licensed course: rare in おまかせ's lives)
    needsChoice: true,
    stages: ['adult'],
    ages: [30, 55],
    when: (s) => practitioner(s) && tenure(s, 5),
    weight: 6,
    maxPerLife: 1,
    title: '開業の話',
    body: (s) => `${careerOf(s) === 'dentist' ? '歯科医院' : '診療所'}を開くのにちょうどよい物件が、駅の近くに空きました。開業すれば、収入も責任も自分のものになります。`,
    auto: 2,
    choices: [
      {
        label: '借り入れをして、自分の医院を開く',
        hint: '軌道に乗れば収入は大きいが、借金と経営の責任を背負う',
        flag: 'lic.open',
        effects: { money: -800, happy: 2 },
        outcomes: [{ text: '内装の打ち合わせを重ね、自分の名前の入った看板が掛かった日、入口で深く息を吸いました。', kind: 'big', key: true, follow: [{ id: 'x.lic.clinicBack', after: 3, within: 3 }] }],
      },
      { label: '勤めのまま、腕を磨き続ける', hint: '収入は安定。経営の苦労はない', flag: 'lic.stay', effects: { know: 2, sat: 2 }, outcomes: [{ text: '物件の資料は返し、明日の予約表を開きました。' }] },
      { label: '今は考えない', flag: 'lic.later', outcomes: [{ text: '開業の話は、もう少し先のことにしました。' }] },
    ],
  },
  {
    ...AF,
    id: 'x.lic.clinicBack',
    category: 'licenseWork',
    stages: ['adult', 'senior'],
    when: (s) => hasFlag(s, 'lic.open') && sameJobSince(s, 'lic.open'),
    outcomes: [
      { weight: 1.3, text: '丁寧な説明が口コミで広がり、予約は数週間先まで埋まるようになりました。借り入れは、予定より早く返し終えました。', kind: 'good', key: true, effects: { payScale: 1.6, money: 500, happy: 5, sat: 4 } },
      { weight: 1, text: '近くに大きな医院ができ、患者さんは思うように増えませんでした。毎月の返済の通知が、重く感じます。', kind: 'bad', effects: { payScale: 0.8, money: -200, happy: -4, sat: -3 } },
    ],
  },
  {
    ...A,
    id: 'x.lic.night',
    category: 'licenseWork',
    // (needs the earlier choice of a university of a licensed course: rare in おまかせ's lives)
    needsChoice: true,
    stages: ['adult'],
    ages: [25, 50],
    when: (s) => (careerOf(s) === 'doctor' || careerOf(s) === 'nurse') && tenure(s, 2) && !hasFlag(s, 'lic.nightDone'),
    weight: 5,
    maxPerLife: 1,
    title: '夜勤と当直',
    body: '病院の夜勤と当直が続き、眠りが浅くなってきました。同僚からは、日勤中心の職場の話も聞きます。',
    auto: 2,
    choices: [
      {
        label: '今の病院で、夜勤を続ける',
        hint: '経験と手当は増えるが、体がもつかどうか',
        flag: 'lic.nightStay',
        effects: { health: -3, payScale: 1.1 },
        outcomes: [{ text: '夜明け前の病棟を回り、救急の受け入れにも慣れていきました。', follow: [{ id: 'x.lic.nightBack', after: 3, within: 3 }] }],
      },
      {
        label: '日勤中心の職場に移る',
        hint: '収入は少し下がるが、暮らしは整う',
        flag: 'lic.nightMove',
        effects: { payScale: 0.9, health: 2, happy: 3 },
        outcomes: [{ text: '外来中心の病院に移り、夕食を家で食べられる日が増えました。', follow: [{ id: 'x.lic.nightBack', after: 3, within: 3 }] }],
      },
      { label: '同僚と勤務の組み方を相談する', flag: 'lic.nightDone', outcomes: [{ text: '勤務表の組み方を同僚と話し合い、連続する夜勤を少し減らしてもらいました。' }] },
    ],
  },
  {
    ...AF,
    id: 'x.lic.nightBack',
    category: 'licenseWork',
    stages: ['adult'],
    when: (s) => hasFlag(s, 'lic.nightStay') || hasFlag(s, 'lic.nightMove'),
    outcomes: [
      { when: has('lic.nightStay'), weight: 1, text: '救急の現場で鍛えた判断の速さを買われ、若い同僚を指導する立場になりました。', kind: 'good', effects: { sat: 5, payScale: 1.1, flag: 'lic.nightDone' } },
      { when: has('lic.nightStay'), weight: 1, text: '無理が重なり、体調を崩してしばらく休みました。復帰後は、夜勤を減らしてもらいました。', kind: 'bad', effects: { health: -4, happy: -3, flag: 'lic.nightDone' } },
      { when: has('lic.nightMove'), weight: 1, text: '日勤の暮らしにも慣れ、休日には家族や友人と過ごせるようになりました。', effects: { happy: 4, rel: 3, flag: 'lic.nightDone' } },
      { when: has('lic.nightMove'), weight: 1, text: '落ち着いた職場には慣れましたが、救急の現場の緊張感を、ときどき懐かしく思います。', effects: { sat: -2, flag: 'lic.nightDone' } },
    ],
  },
  {
    ...A,
    id: 'x.lic.pharmacy',
    category: 'licenseWork',
    // (needs the earlier choice of a university of a licensed course: rare in おまかせ's lives)
    needsChoice: true,
    stages: ['adult'],
    ages: [32, 55],
    when: (s) => careerOf(s) === 'pharmacist' && tenure(s, 6) && !hasFlag(s, 'lic.open'),
    weight: 6,
    maxPerLife: 1,
    title: '自分の薬局',
    body: '長く勤めた薬局の店主が引退を考えていて、店を継がないかと声をかけられました。',
    auto: 2,
    choices: [
      {
        label: '店を引き継ぎ、自分の薬局にする',
        hint: '経営の苦労はあるが、地域の顔になれる',
        flag: 'lic.open',
        effects: { money: -500, happy: 2 },
        outcomes: [{ text: '店の看板はそのままに、自分の名前で薬局の開設の届けを出しました。', kind: 'big', key: true, follow: [{ id: 'x.lic.pharmacyBack', after: 3, within: 3 }] }],
      },
      { label: '勤めの薬剤師を続ける', hint: '収入は安定。責任は軽い', flag: 'lic.stay', effects: { happy: 1 }, outcomes: [{ text: '礼を言って話は断り、新しい店主のもとでも働き続けることにしました。' }] },
      { label: '返事を保留する', flag: 'lic.later', outcomes: [{ text: '店主には、少し考えさせてほしいと伝えました。' }] },
    ],
  },
  {
    ...AF,
    id: 'x.lic.pharmacyBack',
    category: 'licenseWork',
    stages: ['adult', 'senior'],
    when: (s) => hasFlag(s, 'lic.open') && sameJobSince(s, 'lic.open'),
    outcomes: [
      { weight: 1.2, text: '近所の診療所との連携が深まり、薬局には、薬のことを相談しに来る人が絶えなくなりました。', kind: 'good', effects: { payScale: 1.4, money: 200, happy: 4, rel: 3 } },
      { weight: 1, text: '大手の薬局が近くに出店し、処方せんの数は少しずつ減っていきました。', kind: 'bad', effects: { payScale: 0.8, happy: -3, sat: -2 } },
    ],
  },
  {
    ...A,
    id: 'x.lic.teamDoctor',
    category: 'licenseWork',
    // (needs the earlier choice of a university of a licensed course: rare in おまかせ's lives)
    needsChoice: true,
    stages: ['adult', 'senior'],
    ages: [30, 65],
    when: (s) => medical(s) && s.career.highestRank >= 3 && !hasFlag(s, 'lic.team'),
    weight: 4,
    maxPerLife: 1,
    title: '母校の野球部から',
    body: (s) => `母校の野球部の監督から、${careerOf(s) === 'nurse' || careerOf(s) === 'pharmacist' ? '選手の体のことで' : 'チームドクターとして'}力を貸してほしいと頼まれました。`,
    auto: 1,
    choices: [
      { label: '引き受けて、週末にグラウンドへ通う', hint: '休日は減るが、野球とまたつながる', flag: 'lic.team', effects: { happy: 4, rel: 3, fatigue: 2 }, outcomes: [{ text: '久しぶりのグラウンドで、けがをした後輩の足首を診て、無理をさせないよう監督に伝えました。', kind: 'good' }] },
      { label: '仕事が忙しく、今回は断る', flag: 'lic.teamNo', outcomes: [{ text: '丁寧に断り、代わりに信頼できる知り合いを紹介しました。' }] },
    ],
  },
  {
    ...A,
    id: 'x.lic.handOver',
    category: 'licenseWork',
    // (needs the earlier choice of a university of a licensed course: rare in おまかせ's lives)
    needsChoice: true,
    stages: ['senior'],
    ages: [64, 74],
    when: (s) => medical(s) && !hasFlag(s, 'lic.handOver'),
    weight: 5,
    maxPerLife: 1,
    title: '後進に譲るか',
    body: (s) => (hasFlag(s, 'lic.open') ? '自分の店を始めて長い年月がたちました。若い後継ぎを探す時期かもしれません。' : '長く勤めた職場で、若い人に仕事を譲る時期が近づいてきました。'),
    auto: 2,
    choices: [
      { label: '後進に譲り、仕事を退く', hint: '肩の荷は下りるが、収入はなくなる', flag: 'lic.handOver', effects: { job: 'retire', happy: 3, money: 100 }, outcomes: [{ text: '最後の日、長年の患者さんたちから寄せ書きを受け取りました。', kind: 'good', key: true }] },
      { label: '日数を減らして、もう少し続ける', hint: '頼りにしてくれる人がいるうちは', flag: 'lic.handOverLater', effects: { payScale: 0.6, sat: 2 }, outcomes: [{ text: '週に三日だけ通うことにし、若い同僚に少しずつ仕事を引き継ぎました。' }] },
      { label: '今はまだ決めない', flag: 'lic.handOverWait', outcomes: [{ text: '引き際のことは、もう少し考えることにしました。' }] },
    ],
  },
]
