import type { CareerKind, LifeState } from '../types.ts'
import { careerOf } from '../careers.ts'
import { companyJob, flagAge, hasFlag, holdsJob, sameJobSince, tenure, type EventSpec } from './spec.ts'

// Baseball careers after playing (2026-10-24, careers.ts): the commentator, the coach (a high school team, a pro club's farm team, the
// rare manager's chair), the scout and the front office, and the ballpark memories of a former player. Built on the first steps of
// diamondLife.ts (the flags second.coach and second.broadcast), on the job offers of after.ts and on the club staff post that life.ts
// assignSecondCareer gives a released NPB player. Entries are offers opened by the playing career (highestRank) or by that staff post;
// the years inside a career are `needsChoice` events (a career starts only on a choice of his own) and followOnly chains, the rare
// tops (the manager, the GM and the club president, Koshien as a coach, a scouted player's title) at the end of a chain. The おまかせ
// path sets flags only (spec.ts NEUTRAL_FORBIDDEN). Pay, odds and offers are game assumptions; teams and stations are unnamed.

const X = { extra: true } as const
const XN = { extra: true, needsChoice: true } as const
const XF = { extra: true, followOnly: true } as const

/** baseball is over for him (stage adult/senior) */
const done = (s: LifeState) => s.career.phase === 'retired'
const rank = (s: LifeState) => s.career.highestRank
/** no career of careers.ts now and not retired from work: open to an offer */
const free = (s: LifeState) => careerOf(s) === undefined && !s.after?.retired
const is = (k: CareerKind) => (s: LifeState) => careerOf(s) === k
const commentator = is('commentator')
const coach = is('coach')
const scout = is('scout')
const front = is('frontOffice')
/** the club staff post a released NPB player is given (life.ts assignSecondCareer, after.ts bbstaff) */
const clubStaff = (s: LifeState) => holdsJob(s) && s.after!.work!.title.startsWith('球団スタッフ')
const teacher = (s: LifeState) => holdsJob(s) && s.after!.work!.title === '教員'
/** he leads a high school team: as a coach of careers.ts, or as the teacher who took the team */
const coachingHs = (s: LifeState) =>
  (coach(s) && hasFlag(s, 'bbc.amCoach') && !hasFlag(s, 'bbc.proCoach') && !hasFlag(s, 'bbc.indepCoach')) || (hasFlag(s, 'bbc.teacherCoach') && sameJobSince(s, 'bbc.teacherCoach'))
const coachedOnce = (s: LifeState) => ['bbc.amCoach', 'bbc.proCoach', 'bbc.indepCoach', 'bbc.teacherCoach'].some((f) => hasFlag(s, f))

export const BASEBALL_CAREER: EventSpec[] = [
  // ================================================================ 解説者 (commentator)
  {
    ...X,
    id: 'x.bbc.micOffer',
    category: 'bbBroadcast',
    stages: ['adult'],
    ages: [26, 55],
    when: (s) => done(s) && rank(s) >= 7 && free(s) && !hasFlag(s, 'bbc.mic'),
    weight: 4,
    maxPerLife: 1,
    decision: 'major',
    title: '解説者の席',
    body: '現役を退いたと知った放送局から、プロ野球中継の解説者として一年契約を結ばないかと連絡がありました。シーズン中は、球場から球場へ移る暮らしになります。',
    auto: 2,
    choices: [
      {
        label: '契約して、解説者になる',
        hint: '顔と声が知られる。収入は評判しだい',
        flag: 'bbc.mic',
        effects: { career: 'commentator', fame: 3 },
        outcomes: [{ follow: [{ id: 'x.bbc.micDebut', after: 1, within: 2 }], text: '契約書に名前を書き、局のアナウンサーと初めての打ち合わせをしました。' }],
      },
      { label: '地元局のゲスト出演だけ引き受ける', hint: '気楽だが、続く仕事にはならない', effects: { money: 30, happy: 2 }, outcomes: [{ text: '月に一度、地元局の中継にゲストとして呼ばれ、現役時代の配球の裏話を披露しました。' }] },
      { label: '今の暮らしを続ける', flag: 'bbc.micPass', outcomes: [{ text: '話はありがたく受け止めたうえで、マイクの前に座ることは見送りました。' }] },
    ],
  },
  {
    ...XN,
    id: 'x.bbc.micFromGuest',
    category: 'bbBroadcast',
    stages: ['adult'],
    ages: [28, 58],
    // (the guest commentary of diamondLife.ts x.second.broadcast, taken on a choice of his own)
    when: (s) => done(s) && hasFlag(s, 'second.broadcast') && free(s) && !hasFlag(s, 'bbc.mic'),
    weight: 6,
    maxPerLife: 1,
    decision: 'major',
    title: '専属解説の話',
    body: 'ゲスト解説を重ねるうち、局のプロデューサーから、来季は専属の解説者として全試合を担当してほしいと頼まれました。',
    auto: 2,
    choices: [
      { label: '専属契約を結ぶ', hint: '話す仕事が本業になる', flag: 'bbc.mic', effects: { career: 'commentator', fame: 2 }, outcomes: [{ follow: [{ id: 'x.bbc.micDebut', after: 1, within: 2 }], text: '今の仕事に区切りをつけ、局の名前の入った入館証を首から下げるようになりました。' }] },
      { label: '今の暮らしと両立できる範囲で続ける', effects: { money: 40, rel: 2 }, outcomes: [{ text: '専属は断り、声がかかった週末の試合だけ、これまでどおり解説席に座りました。' }] },
      { label: '返事をせずに、話を流す', flag: 'bbc.micPass', outcomes: [{ text: '迷っているうちに締め切りが過ぎ、専属の席は別の元選手に決まりました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.bbc.micDebut',
    category: 'bbBroadcast',
    stages: ['adult'],
    when: commentator,
    outcomes: [
      { weight: 2, text: '初めての中継で、投手の癖を交えた解説が好評で、局には視聴者から「分かりやすい」という声が届きました。', effects: { fame: 3, payScale: 1.1, happy: 4 } },
      { weight: 1, text: '初めての中継は緊張で言葉が出ず、アナウンサーに何度も助け舟を出してもらいました。帰りの車で、録画を見返して反省しました。', effects: { happy: -3, know: 1 } },
    ],
  },
  {
    ...XN,
    id: 'x.bbc.famousCall',
    category: 'bbBroadcast',
    stages: ['adult'],
    ages: [28, 64],
    when: (s) => commentator(s) && tenure(s, 1) && !hasFlag(s, 'bbc.call'),
    weight: 10,
    maxPerLife: 1,
    title: '優勝の決まる一球',
    body: 'リーグ優勝が決まる試合の解説を任されました。最後の打者を迎えた場面で、何を言葉にするかは自分しだいです。',
    auto: 2,
    choices: [
      { label: '胸に浮かんだ言葉を、そのまま口にする', hint: '心に残るか、空回りするか', flag: 'bbc.call', effects: { fame: 4 }, outcomes: [{ follow: [{ id: 'x.bbc.callEcho', after: 1, within: 2 }], text: '優勝の瞬間、思わず漏れた一言が、実況の声と重なって全国に流れました。' }] },
      { label: '最後まで、配球の分析に徹する', effects: { sat: 3, know: 1 }, outcomes: [{ text: '歓声のなかでも、捕手のサインの意図と次の球の狙いを、淡々と説明し続けました。' }] },
      { label: '実況に任せて、静かに見守る', flag: 'bbc.callQuiet', outcomes: [{ text: '決着の瞬間は実況アナウンサーの声に譲り、一呼吸置いてから選手たちをたたえました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.bbc.callEcho',
    category: 'bbBroadcast',
    stages: ['adult', 'senior'],
    when: (s) => commentator(s) && hasFlag(s, 'bbc.call'),
    outcomes: [
      { weight: 2, text: 'あの日の一言は翌朝のスポーツ紙の見出しになり、年末の名場面を振り返る番組でも何度も流れました。', kind: 'big', effects: { fame: 6, payScale: 1.2, happy: 5 } },
      { weight: 1, text: '感情的すぎたと一部で批判され、局からは、次からは抑えめにと注意を受けました。', effects: { fame: 1, happy: -2 } },
    ],
  },
  {
    ...XN,
    id: 'x.bbc.gaffe',
    category: 'bbBroadcast',
    stages: ['adult'],
    ages: [28, 64],
    when: (s) => commentator(s) && tenure(s, 1),
    weight: 8,
    maxPerLife: 1,
    title: '中継での失言',
    body: '中継中、不調の若手選手を笑いの種にするような言い方をしてしまいました。放送のあと、批判の書き込みが一気に広がっています。',
    auto: 2,
    choices: [
      {
        label: 'すぐに謝罪し、本人にも直接詫びる',
        hint: '傷は浅く済むが、しばらく出番が減る',
        flag: 'bbc.apology',
        effects: { fame: -2, payScale: 0.85, happy: -2 },
        outcomes: [{ follow: [{ id: 'x.bbc.gaffeAfter', after: 1, within: 2 }], text: '翌日の放送の冒頭で頭を下げ、選手の所属球団を通じて手紙も届けました。' }],
      },
      {
        label: '真意は違うと反論する',
        effects: { fame: -6, payScale: 0.6, happy: -4 },
        outcomes: [
          { weight: 2, kind: 'bad', text: '反論の言葉がさらに火に油を注ぎ、担当していた中継のいくつかから外されました。' },
          { weight: 1, text: '擁護する声も少しずつ出てきて、騒ぎはひと月ほどで収まりました。', effects: { rel: 2 } },
        ],
      },
      { label: '局の判断に任せる', flag: 'bbc.gaffeQuiet', outcomes: [{ text: '対応は局の広報に預け、自分は次の中継の資料づくりに戻りました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.bbc.gaffeAfter',
    category: 'bbBroadcast',
    stages: ['adult'],
    when: (s) => commentator(s) && hasFlag(s, 'bbc.apology'),
    outcomes: [
      { weight: 2, text: '謝罪を受け取った選手がそのオフに番組へ出てくれて、二人で笑い合う姿が話題になりました。', effects: { fame: 4, rel: 4, payScale: 1.15 } },
      { weight: 1, text: '謝罪は受け入れられたものの、局の判断で、翌季のレギュラー中継からは外れることになりました。', effects: { payScale: 0.8, happy: -3 } },
    ],
  },
  {
    ...XN,
    id: 'x.bbc.showOffer',
    category: 'bbBroadcast',
    stages: ['adult'],
    ages: [32, 62],
    when: (s) => commentator(s) && tenure(s, 3) && !hasFlag(s, 'bbc.show'),
    weight: 8,
    maxPerLife: 1,
    title: '毎週の野球番組',
    body: '深夜の野球情報番組で、毎週の解説コーナーを持たないかと誘われました。シーズンオフも含めて、一年中の仕事になります。',
    auto: 2,
    choices: [
      { label: 'コーナーを引き受ける', hint: '収入は安定するが、休みは減る', flag: 'bbc.show', effects: { payScale: 1.3, fame: 4, happy: -1 }, outcomes: [{ follow: [{ id: 'x.bbc.showYears', after: 5, within: 4 }], text: '局の小さな会議室で、毎週の企画を若いディレクターと練る日々が始まりました。' }] },
      { label: '球場の解説だけに絞る', effects: { happy: 3, rel: 2 }, outcomes: [{ text: 'テレビの仕事は増やさず、空いた時間は草野球の仲間と過ごすことにしました。' }] },
      { label: '返事を保留する', flag: 'bbc.showWait', outcomes: [{ text: '考えさせてほしいと伝えるうちに、その話は別の解説者に回りました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.bbc.showYears',
    category: 'bbBroadcast',
    stages: ['adult', 'senior'],
    when: (s) => commentator(s) && hasFlag(s, 'bbc.show'),
    outcomes: [
      { weight: 2, text: '気がつけば番組は十年近く続き、駅のホームで「あのコーナーの人だ」と声をかけられるようになりました。', key: true, effects: { fame: 6, happy: 5, achieve: '長寿番組の解説コーナー' } },
      { weight: 1, text: '視聴率が伸びず、番組は春の改編で打ち切られました。最終回の収録のあと、スタッフと静かに乾杯しました。', effects: { payScale: 0.75, happy: -2 } },
    ],
  },
  {
    ...XN,
    id: 'x.bbc.channelGuest',
    category: 'bbBroadcast',
    stages: ['adult'],
    ages: [28, 64],
    when: (s) => commentator(s) && tenure(s, 2),
    weight: 6,
    maxPerLife: 1,
    title: '後輩の動画チャンネル',
    body: 'かつてのチームの後輩が始めた動画チャンネルから、出演の依頼が来ました。中継を見ない若いファンが多く集まる場所です。',
    auto: 2,
    choices: [
      {
        label: '出演して、現役時代の裏話を語る',
        effects: { fame: 3, rel: 2 },
        outcomes: [
          { weight: 2, text: '撮影は後輩の部屋で気楽に進み、公開された回は、中継の解説よりも多くの人に見られました。', effects: { happy: 3 } },
          { weight: 1, text: '話が長すぎると編集でばっさり切られ、映ったのは数分だけでした。', effects: { happy: -1 } },
        ],
      },
      { label: '中継の仕事に専念すると断る', effects: { sat: 2 }, outcomes: [{ text: '局との契約もあるため、出演は丁重に断りました。' }] },
      { label: '局に相談してから決める', flag: 'bbc.channelAsk', outcomes: [{ text: '返事は局と相談してからにすると伝え、話はそれきりになりました。' }] },
    ],
  },
  {
    ...XN,
    id: 'x.bbc.micLate',
    category: 'bbBroadcast',
    stages: ['adult', 'senior'],
    ages: [60, 75],
    when: (s) => commentator(s) && hasFlag(s, 'bbc.mic'),
    weight: 10,
    maxPerLife: 1,
    title: '解説席を譲る年',
    body: '長く座ってきた解説席に、引退したばかりの選手が座る日が増えてきました。局からは、今季限りで勇退してはどうかと打診がありました。',
    auto: 2,
    choices: [
      { label: '最後の中継で、後進に席を譲る', effects: { job: 'retire', happy: 4, fame: 2 }, outcomes: [{ text: '最後の中継の終わりに、長年の視聴者へ短く礼を述べ、ヘッドセットを外しました。', key: true }] },
      { label: '年に数試合だけ続ける', effects: { payScale: 0.4, sat: 2 }, outcomes: [{ text: '大きな試合の数試合に絞り、細く長く解説を続けることにしました。' }] },
      { label: '局の判断に任せる', flag: 'bbc.micAsk', outcomes: [{ text: '自分から区切りは決めず、声がかかるうちは続けることにしました。' }] },
    ],
  },

  // ================================================================ 指導者 (coach): a high school team
  {
    ...X,
    id: 'x.bbc.coachHs',
    category: 'bbCoach',
    stages: ['adult'],
    ages: [28, 58],
    when: (s) => done(s) && rank(s) >= 5 && free(s) && !hasFlag(s, 'bbc.amCoach'),
    weight: 4,
    maxPerLife: 1,
    decision: 'major',
    title: '母校の監督に',
    body: (s) =>
      `母校の高校の野球部から、監督として戻ってきてほしいと頼まれました。${holdsJob(s) ? '今の仕事を辞めて、指導に専念する形です。' : '学校の常勤職員として、指導に専念できる話です。'}`,
    auto: 2,
    choices: [
      {
        label: '引き受けて、監督になる',
        hint: '選手と向き合う毎日。結果は自分の責任になる',
        flag: 'bbc.amCoach',
        effects: { career: 'coach' },
        outcomes: [{ follow: [{ id: 'x.bbc.firstSquad', after: 1, within: 2 }], text: '着任の日、グラウンドの隅のバックネットが、自分の現役のころのままなのに気づきました。' }],
      },
      { label: '週末だけ、技術指導を手伝う', effects: { happy: 3, rel: 2 }, outcomes: [{ text: '平日は今の暮らしを続け、土曜の練習で打撃の指導だけを受け持ちました。' }] },
      { label: '今は引き受けられない', flag: 'bbc.amPass', outcomes: [{ text: '気持ちは動きましたが、今の暮らしを変える決心はつかず、監督の話は辞退しました。' }] },
    ],
  },
  {
    ...XN,
    id: 'x.bbc.coachFromWeekend',
    category: 'bbCoach',
    stages: ['adult'],
    ages: [28, 60],
    // (the weekend coaching of diamondLife.ts x.second.coachOffer, taken on a choice of his own)
    when: (s) => done(s) && hasFlag(s, 'second.coach') && free(s) && !hasFlag(s, 'bbc.amCoach'),
    weight: 6,
    maxPerLife: 1,
    decision: 'major',
    title: '外部コーチから監督へ',
    body: '週末に通ってきた母校で、監督が退くことになりました。学校から、後任として正式に指揮を執ってほしいと頼まれています。',
    auto: 2,
    choices: [
      { label: '後任を引き受ける', hint: '仕事を辞めて、指導が本業になる', flag: 'bbc.amCoach', effects: { career: 'coach' }, outcomes: [{ follow: [{ id: 'x.bbc.firstSquad', after: 1, within: 2 }], text: '週末だけだったグラウンド通いが、朝練から夜の片づけまでの毎日に変わりました。' }] },
      { label: '外部コーチのまま支える', effects: { rel: 3, happy: 1 }, outcomes: [{ text: '監督には若い教員が就き、自分は週末の守備練習を受け持つ形で残りました。' }] },
      { label: '新しい監督に任せて身を引く', flag: 'bbc.amPass', outcomes: [{ text: '区切りのいい時期だと考え、新監督の着任を見届けてから、週末の手伝いも終えました。' }] },
    ],
  },
  {
    ...X,
    id: 'x.bbc.coachTeacher',
    category: 'bbCoach',
    stages: ['adult'],
    ages: [24, 58],
    when: (s) => teacher(s) && rank(s) >= 4 && !hasFlag(s, 'bbc.teacherCoach') && !hasFlag(s, 'bbc.teacherPass'),
    weight: 4,
    maxPerLife: 1,
    title: '野球部の監督を任される',
    body: '勤める学校で、野球部の監督が異動することになりました。校長から、経験者として後を継いでほしいと頼まれています。',
    auto: 2,
    choices: [
      {
        label: '監督を引き受ける',
        hint: '放課後も休日も、野球部に費やす',
        flag: 'bbc.teacherCoach',
        effects: { sat: 4, happy: 2, rel: -1 },
        outcomes: [{ follow: [{ id: 'x.bbc.firstSquad', after: 1, within: 2 }], text: '授業を終えると着替えてグラウンドへ向かう、教師と監督の二重の毎日が始まりました。' }],
      },
      { label: '副部長として、事務を支える', effects: { sat: 2, rel: 2 }, outcomes: [{ text: '遠征の手配や部費の管理を受け持ち、監督の座には若い同僚が就きました。' }] },
      { label: '担任の仕事を優先して断る', flag: 'bbc.teacherPass', outcomes: [{ text: '受け持ちの学級のことを考え、監督の話は別の先生に譲りました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.bbc.firstSquad',
    category: 'bbCoach',
    stages: ['adult'],
    when: coachingHs,
    outcomes: [
      {
        weight: 2,
        text: '最初の夏、部員の名前と癖をすべて覚え、ノックの一本一本に声をかけるうち、チームの目つきが変わってきました。',
        effects: { sat: 4, happy: 3 },
        follow: [{ id: 'x.bbc.koshienRun', after: 2, within: 3 }],
      },
      {
        weight: 1,
        text: '練習の方針をめぐって保護者と意見がぶつかり、最初の一年は話し合いの場ばかりが増えました。',
        effects: { sat: -4, happy: -2, rel: -2 },
        follow: [{ id: 'x.bbc.koshienRun', after: 3, within: 3 }],
      },
    ],
  },
  {
    ...XN,
    id: 'x.bbc.coachMethod',
    category: 'bbCoach',
    stages: ['adult'],
    ages: [26, 64],
    when: (s) => (coach(s) || coachingHs(s)) && !hasFlag(s, 'bbc.method'),
    weight: 10,
    maxPerLife: 1,
    title: '指導の方針',
    body: '新しいチームが始まりました。練習量で鍛えるか、選手に考えさせるか、今年の方針を決めなければなりません。',
    auto: 2,
    choices: [
      {
        label: '走り込みと反復で、厳しく鍛える',
        hint: '体は強くなる。ついてこられない選手も出る',
        flag: ['bbc.method', 'bbc.strict'],
        effects: { sat: 2, rel: -2 },
        outcomes: [
          { weight: 2, text: '冬の間の走り込みで、選手たちの体つきが見違えるほど変わりました。', effects: { happy: 2 } },
          { weight: 1, text: '練習の厳しさに耐えかねて、数人の選手が去っていきました。', effects: { happy: -3 } },
        ],
      },
      {
        label: '選手に考えさせ、メニューも任せる',
        hint: '自分で考える力がつく。締まりがなくなることもある',
        flag: ['bbc.method', 'bbc.free'],
        effects: { rel: 3 },
        outcomes: [
          { weight: 2, text: 'ミーティングで選手自身が課題を出し合うようになり、練習の空気が明るくなりました。', effects: { sat: 3 } },
          { weight: 1, text: '自由にさせたぶん試合前の準備が甘くなり、格下の相手への取りこぼしが続きました。', effects: { sat: -2 } },
        ],
      },
      { label: '去年までのやり方を続ける', flag: 'bbc.method', outcomes: [{ text: '大きくは変えず、前の年と同じメニューで新しいチームを始めました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.bbc.koshienRun',
    category: 'bbCoach',
    stages: ['adult'],
    when: coachingHs,
    outcomes: [
      {
        // (rare: one of the some 3,400 schools of each summer; a method he chose himself lifts it a little; an assumption)
        weight: (s) => 0.08 + (hasFlag(s, 'bbc.strict') || hasFlag(s, 'bbc.free') ? 0.04 : 0),
        kind: 'big',
        key: true,
        text: '夏の県大会を勝ち抜き、監督として甲子園の土を踏みました。ベンチから見る景色は、選手のころとまるで違いました。',
        effects: { achieve: '監督として甲子園', fame: 6, happy: 10, sat: 6 },
      },
      { weight: 1.2, text: '夏の県大会では準々決勝まで勝ち進み、地元の新聞に、監督としての談話が小さく載りました。', effects: { sat: 3, happy: 3 } },
      { weight: 1, text: '夏は初戦で敗れ、泣き崩れる三年生にかける言葉が、なかなか見つかりませんでした。', effects: { happy: -3, sat: -2 } },
    ],
  },

  // ================================================================ 指導者 (coach): the pros, the manager's chair
  {
    ...X,
    id: 'x.bbc.proCoachOffer',
    category: 'bbCoach',
    stages: ['adult'],
    ages: [32, 60],
    when: (s) => done(s) && rank(s) >= 7 && (free(s) || commentator(s)) && !hasFlag(s, 'bbc.proCoach') && !hasFlag(s, 'bbc.indepCoach'),
    weight: 4,
    maxPerLife: 1,
    decision: 'major',
    title: '古巣からのコーチ要請',
    body: (s) => `古巣の球団から、二軍の${s.person.position === 'P' ? '投手' : '打撃'}コーチとして戻ってこないかと連絡がありました。若手の育成を任せたいそうです。`,
    auto: 2,
    choices: [
      {
        label: '二軍のコーチを引き受ける',
        hint: '球団に戻れる。結果が出なければ一年で契約が切れる',
        flag: 'bbc.proCoach',
        effects: { career: 'coach' },
        outcomes: [{ follow: [{ id: 'x.bbc.proCoachYears', after: 3, within: 3 }], text: '久しぶりに袖を通した球団のジャージは、背番号だけが現役のころと違いました。' }],
      },
      {
        label: '独立リーグのコーチなら引き受ける',
        hint: '給料は低いが、自分のやり方を試せる',
        flag: 'bbc.indepCoach',
        effects: { career: 'coach', payScale: 0.45 },
        outcomes: [
          { weight: 2, text: '地方の独立リーグ球団（架空）で、若い選手と同じ寮に住み込み、寝食を共にしながら教え始めました。', effects: { happy: 3 } },
          { weight: 1, text: '独立リーグ球団（架空）の資金繰りは苦しく、コーチの仕事に加えて、試合の日はグッズ売り場にも立ちました。', effects: { happy: -1, rel: 2 } },
        ],
      },
      { label: '今の道を続ける', flag: 'bbc.proPass', outcomes: [{ text: '球団への恩は感じつつも、ユニフォームに戻る話は断りました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.bbc.proCoachYears',
    category: 'bbCoach',
    stages: ['adult'],
    when: (s) => coach(s) && hasFlag(s, 'bbc.proCoach'),
    outcomes: [
      {
        // (the manager's chair: only for a former star of the first team, after years of coaching)
        when: (s) => rank(s) >= 8,
        weight: 0.5,
        text: '教えた若手が次々と一軍に定着し、球団の中で「育てるコーチ」と呼ばれるようになりました。一軍のベンチに上がる話も出ています。',
        effects: { sat: 5, payScale: 1.2, fame: 3, flag: 'bbc.coachGood' },
        follow: [{ id: 'x.bbc.managerCall', after: 3, within: 5 }],
      },
      { weight: 1.2, text: '担当した選手の成績が上がり、翌年は一軍のコーチに昇格しました。', effects: { sat: 4, payScale: 1.1 } },
      { weight: 1, text: 'チームの低迷の責任を問われる形で、二軍の巡回コーチに配置換えとなりました。', effects: { sat: -4, happy: -2 } },
    ],
  },
  {
    ...XF,
    id: 'x.bbc.managerCall',
    category: 'bbCoach',
    stages: ['adult'],
    when: (s) => coach(s) && rank(s) >= 8 && hasFlag(s, 'bbc.coachGood') && flagAge(s, 'bbc.proCoach') >= 5,
    decision: 'major',
    title: '監督の要請',
    body: '球団の社長室に呼ばれ、来季から一軍の監督を任せたいと告げられました。現役時代の名前と、コーチとしての歩みが買われたのです。',
    auto: 2,
    choices: [
      {
        label: '監督を引き受ける',
        hint: '年俸は跳ね上がる。負ければ一年で終わる',
        flag: 'bbc.manager',
        effects: { achieve: 'プロ野球の監督', fame: 10, payScale: 2.5 },
        outcomes: [{ follow: [{ id: 'x.bbc.managerSeason', after: 1, within: 2 }], kind: 'big', key: true, text: '就任会見で新しい背番号のユニフォームに袖を通し、一斉にフラッシュを浴びました。' }],
      },
      { label: 'ヘッドコーチとして支える', effects: { payScale: 1.3, sat: 3 }, outcomes: [{ text: '監督の座は別の人に譲り、自分は参謀として作戦を支える立場を選びました。' }] },
      { label: '今の持ち場に残る', flag: 'bbc.managerPass', outcomes: [{ text: '身に余る話だと辞退し、若手を育てる今の仕事を続けました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.bbc.managerSeason',
    category: 'bbCoach',
    stages: ['adult'],
    when: (s) => coach(s) && hasFlag(s, 'bbc.manager'),
    outcomes: [
      { weight: 0.25, kind: 'big', key: true, text: '采配がかみ合い、就任一年目でリーグ優勝を果たしました。胴上げで、夜空が何度も近づきました。', effects: { achieve: '監督としてリーグ優勝', fame: 10, happy: 12, payScale: 1.2 } },
      { weight: 1, text: 'チームは最後まで上位争いに加わり、球団から契約を二年延長されました。', effects: { sat: 5, payScale: 1.1 } },
      {
        weight: 0.8,
        kind: 'bad',
        text: '連敗が止まらずに最下位へ沈み、シーズンの終わりとともに、責任を取って監督を退きました。',
        effects: { job: 'quit', happy: -6, fame: -3, flag: 'bbc.leftBench' },
        follow: [{ id: 'x.bbc.afterBench', after: 1, within: 2 }],
      },
    ],
  },
  {
    ...XN,
    id: 'x.bbc.badSeason',
    category: 'bbCoach',
    stages: ['adult'],
    ages: [28, 64],
    when: (s) => coach(s) && tenure(s, 2) && !hasFlag(s, 'bbc.manager'),
    weight: 8,
    maxPerLife: 1,
    title: '負けが込んだシーズン',
    body: '指導してきたチームの成績が振るわず、シーズンの終わりに、周囲から責任を問う声が上がっています。',
    auto: 2,
    choices: [
      {
        label: '自ら身を引く',
        hint: 'けじめはつくが、次の仕事は白紙になる',
        flag: 'bbc.leftBench',
        effects: { job: 'quit', happy: -4 },
        outcomes: [{ follow: [{ id: 'x.bbc.afterBench', after: 1, within: 2 }], text: '最後の練習のあと、選手たちに頭を下げ、グラウンドを後にしました。' }],
      },
      {
        label: '続投を願い出て、立て直しを誓う',
        effects: { sat: -3, payScale: 0.9, rel: 2 },
        outcomes: [
          { weight: 2, text: '翌年、選手と一から話し合って臨んだシーズンは、見違えるような戦いぶりになりました。', effects: { happy: 4 } },
          { weight: 1, text: '続投しても流れは変わらず、針のむしろに座るような一年を過ごしました。', effects: { happy: -4 } },
        ],
      },
      { label: '周りの判断を待つ', flag: 'bbc.waitVerdict', outcomes: [{ text: '身の振り方は周りに預け、オフの練習計画だけは淡々と作り続けました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.bbc.afterBench',
    category: 'bbCoach',
    stages: ['adult'],
    when: (s) => hasFlag(s, 'bbc.leftBench') && free(s),
    outcomes: [
      {
        weight: (s) => (rank(s) >= 7 ? 1.5 : 0.3),
        text: 'ユニフォームを脱いで一年、放送局から解説の話が届き、今度はマイクを通して野球と向き合うことになりました。',
        effects: { career: 'commentator', flag: 'bbc.mic', fame: 2 },
      },
      { weight: 1, text: '近所の少年野球チームに誘われ、勝ち負けから離れた場所で、キャッチボールの楽しさから教え直すことにしました。', effects: { happy: 5, rel: 3, flag: 'bbc.kids' } },
    ],
  },
  {
    ...XN,
    id: 'x.bbc.coachLegacy',
    category: 'bbCoach',
    stages: ['adult', 'senior'],
    ages: [60, 85],
    when: coachedOnce,
    weight: 8,
    maxPerLife: 1,
    title: '教え子たちの集まり',
    body: (s) =>
      hasFlag(s, 'bbc.proCoach')
        ? 'かつて教えた選手たちが、指導者としての節目を祝う会を開いてくれることになりました。まだプロで現役の顔もあるそうです。'
        : 'かつて教えた部員たちが、指導者としての節目を祝う会を開いてくれることになりました。父親になった顔も並ぶそうです。',
    auto: 2,
    choices: [
      { label: '会に出て、一人ひとりと語り合う', effects: { happy: 6, rel: 4 }, outcomes: [{ text: '乾杯のあと、教え子が順番に壇上に立ち、ノックで泥だらけになった日の話で会場が沸きました。' }] },
      {
        label: '指導の記録を、一冊の本にまとめる',
        hint: '時間はかかるが、形に残る',
        effects: { know: 2, fame: 2, money: 20 },
        outcomes: [
          { weight: 2, text: '練習ノートを読み返しながら書いた本は、地元の書店の棚に平積みにされました。', effects: { happy: 3 } },
          { weight: 1, text: '書き上げた原稿は自費で少部数だけ刷り、教え子たちに一冊ずつ配りました。', effects: { money: -30 } },
        ],
      },
      { label: '照れくさいので、手紙だけ送る', flag: 'bbc.legacyNote', outcomes: [{ text: '出席は辞退し、一人ひとりに宛てた短い手紙を幹事に託しました。' }] },
    ],
  },

  // ================================================================ スカウト (scout) and the club staff post
  {
    ...X,
    id: 'x.bbc.staffRole',
    category: 'bbScout',
    stages: ['adult'],
    ages: [24, 58],
    when: (s) => done(s) && clubStaff(s) && careerOf(s) === undefined && tenure(s, 1) && !hasFlag(s, 'bbc.staffRole'),
    weight: 5,
    maxPerLife: 1,
    decision: 'major',
    title: '球団での持ち場',
    body: '球団スタッフとして一年が過ぎ、編成の担当者から、来季からの持ち場について希望を聞かれました。',
    auto: 3,
    choices: [
      { label: 'スカウトとして全国を回る', hint: '選手を見る目が問われる。出張が多い', flag: ['bbc.staffRole', 'bbc.scout'], effects: { career: 'scout' }, outcomes: [{ text: '担当地区の高校と大学の一覧を渡され、車の走行距離が一気に伸びる一年が始まりました。' }] },
      {
        label: '二軍のコーチとして若手を教える',
        hint: '現場に戻れる。結果で評価される',
        flag: ['bbc.staffRole', 'bbc.proCoach'],
        effects: { career: 'coach' },
        outcomes: [{ follow: [{ id: 'x.bbc.proCoachYears', after: 3, within: 3 }], text: 'ブルペンの脇に自分の名前の入った椅子が置かれ、若手の練習を朝から見る日々が始まりました。' }],
      },
      { label: '球団事務所で、営業や企画を担う', hint: '背広の仕事。球団の経営に関われる', flag: ['bbc.staffRole', 'bbc.front'], effects: { career: 'frontOffice' }, outcomes: [{ text: '背広に着替え、チケット販売とスポンサー回りの部署に机をもらいました。' }] },
      { label: '今の仕事を続ける', flag: 'bbc.staffRole', outcomes: [{ text: '用具の管理と練習の手伝いという、今の裏方の仕事を続けたいと伝えました。' }] },
    ],
  },
  {
    ...X,
    id: 'x.bbc.scoutInvite',
    category: 'bbScout',
    stages: ['adult'],
    ages: [28, 55],
    when: (s) => done(s) && rank(s) >= 5 && free(s) && !clubStaff(s) && !hasFlag(s, 'bbc.scout') && !hasFlag(s, 'bbc.scoutPass'),
    weight: 3,
    maxPerLife: 1,
    decision: 'major',
    title: 'スカウトにならないか',
    body: '球団の編成部に入った昔のチームメイトから、地区担当のスカウトを探していると声がかかりました。アマチュア野球の現場を知る目が欲しいそうです。',
    auto: 2,
    choices: [
      { label: 'スカウトになる', hint: '今の仕事を辞める。目利きの仕事', flag: 'bbc.scout', effects: { career: 'scout' }, outcomes: [{ text: 'ストップウォッチとスピードガンを鞄に入れ、平日の高校のグラウンドを巡る日々が始まりました。' }] },
      { label: '情報提供だけ手伝う', effects: { money: 15, rel: 3 }, outcomes: [{ text: '地元の有望な選手の話を、ときどき電話で伝える関係になりました。' }] },
      { label: '今の暮らしを離れられない', flag: 'bbc.scoutPass', outcomes: [{ text: '今の暮らしを手放す決心はつかず、礼を言って電話を切りました。' }] },
    ],
  },
  {
    ...XN,
    id: 'x.bbc.hiddenGem',
    category: 'bbScout',
    stages: ['adult'],
    ages: [26, 64],
    when: (s) => scout(s) && !hasFlag(s, 'bbc.gem') && !hasFlag(s, 'bbc.gemSkip'),
    weight: 12,
    maxPerLife: 1,
    title: '無名の逸材',
    body: '担当地区の、部員が十数人しかいない高校の練習試合で、目を疑うような球を投げる二年生を見つけました。まだ、どの球団も名前を知らないようです。',
    auto: 2,
    choices: [
      {
        label: '上司に強く推し、指名候補に入れてもらう',
        hint: '外れれば、自分の目が疑われる',
        flag: 'bbc.gem',
        effects: { sat: 2 },
        outcomes: [{ follow: [{ id: 'x.bbc.gemDraft', after: 1, within: 2 }], text: '翌週から毎週通い、球速と体の伸びをノートに記録して、編成会議で熱弁を振るいました。' }],
      },
      {
        label: '評価の定まった有名選手の視察を優先する',
        hint: '確実だが、掘り出し物は逃すかもしれない',
        flag: 'bbc.gemSkip',
        effects: { sat: -1, payScale: 1.05 },
        outcomes: [{ follow: [{ id: 'x.bbc.missedTalent', after: 3, within: 4 }], text: '上位で消える選手の視察に時間を割き、無名の二年生のことは報告書の隅に書くだけにしました。' }],
      },
      { label: 'もう一年、様子を見る', flag: 'bbc.gemWait', outcomes: [{ text: '体ができあがるまで待とうと、名前だけを手帳に書き留めました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.bbc.gemDraft',
    category: 'bbScout',
    stages: ['adult'],
    when: (s) => scout(s) && hasFlag(s, 'bbc.gem'),
    outcomes: [
      {
        weight: 2,
        text: 'ドラフト会議の下位で、あの投手の名前が読み上げられました。指名のあいさつに行くと、本人より高校の監督のほうが泣いていました。',
        effects: { happy: 5, sat: 4 },
        follow: [{ id: 'x.bbc.gemStar', after: 3, within: 4 }],
      },
      { weight: 1, text: '会議では他の候補に押され、あの投手は指名から漏れました。本人には、自分の口から結果を伝えに行きました。', effects: { sat: -3, happy: -3 } },
    ],
  },
  {
    ...XF,
    id: 'x.bbc.gemStar',
    category: 'bbScout',
    stages: ['adult', 'senior'],
    when: (s) => hasFlag(s, 'bbc.gem'),
    outcomes: [
      {
        weight: 0.35,
        kind: 'big',
        key: true,
        text: '下位指名だったあの投手が、エースとして最多勝のタイトルを獲りました。表彰式で、最初に見つけてくれたスカウトへの感謝を口にしてくれました。',
        effects: { happy: 10, fame: 4, achieve: '見出した選手がタイトル獲得' },
      },
      { weight: 1, text: 'あの投手は一軍と二軍を行き来しながらも、中継ぎとして息の長い選手になりました。', effects: { happy: 3 } },
      { weight: 0.6, text: 'あの投手は肩を痛め、一軍に上がれないまま三年で戦力外になりました。担当として、次の勤め先探しを手伝いました。', effects: { happy: -4, rel: 2 } },
    ],
  },
  {
    ...XF,
    id: 'x.bbc.missedTalent',
    category: 'bbScout',
    stages: ['adult', 'senior'],
    when: (s) => hasFlag(s, 'bbc.gemSkip'),
    outcomes: [
      { weight: 1.2, text: '報告書の隅に書いただけのあの二年生が、他球団の育成枠から這い上がり、オールスターに選ばれました。中継を、複雑な思いで見ました。', effects: { happy: -4, sat: -3 } },
      { weight: 1, text: '見送ったあの選手は社会人で野球を続けたものの、大きく伸びることはありませんでした。自分の見立ては外れていなかったようです。', effects: { sat: 2 } },
    ],
  },
  {
    ...XN,
    id: 'x.bbc.scoutRoad',
    category: 'bbScout',
    stages: ['adult'],
    ages: [30, 64],
    when: (s) => scout(s) && tenure(s, 3),
    weight: 8,
    maxPerLife: 1,
    title: '年に二百日の出張',
    body: 'スカウトの仕事は、一年の半分以上が出張です。担当地区を広げる話と、地元に近い地区へ移る話が、同時に来ました。',
    auto: 2,
    choices: [
      { label: '広い地区を受け持つ', hint: '評価は上がるが、家を空ける日が増える', effects: { payScale: 1.15, rel: -3 }, outcomes: [{ text: '担当は三つの県にまたがり、車の後部座席が着替えと資料で埋まりました。' }] },
      { label: '地元に近い地区へ移る', hint: '暮らしは落ち着く。評価は控えめになる', effects: { rel: 4, payScale: 0.95 }, outcomes: [{ text: '移動の時間が減り、週末の夕食を家で取れる日が増えました。' }] },
      { label: '今の地区のままでいい', flag: 'bbc.roadStay', outcomes: [{ text: '慣れた地区の監督たちとの付き合いを大事にして、持ち場は変えませんでした。' }] },
    ],
  },

  // ================================================================ 球団フロント (front office)
  {
    ...X,
    id: 'x.bbc.frontInvite',
    category: 'bbFront',
    stages: ['adult'],
    ages: [30, 58],
    when: (s) => done(s) && rank(s) >= 5 && companyJob(s) && tenure(s, 3) && careerOf(s) === undefined && !hasFlag(s, 'bbc.front') && !hasFlag(s, 'bbc.frontPass'),
    weight: 3,
    maxPerLife: 1,
    decision: 'major',
    title: '球団の運営スタッフ',
    body: '地元の独立リーグ球団（架空）から、会社勤めの経験と野球の経歴を生かして、運営スタッフとして来てほしいと誘われました。',
    auto: 2,
    choices: [
      { label: '会社を辞めて、球団に移る', hint: '給料は下がるが、好きな世界で働ける', flag: 'bbc.front', effects: { career: 'frontOffice', payScale: 0.6 }, outcomes: [{ text: '送別会の翌週から、スタジアムの事務所でチケットの販売計画を立てる仕事が始まりました。' }] },
      { label: '会社員のまま、休日に手伝う', effects: { happy: 3, rel: 2 }, outcomes: [{ text: '休日の試合で、場内アナウンスと入場口の案内を手伝うようになりました。' }] },
      { label: '会社に残る', flag: 'bbc.frontPass', outcomes: [{ text: '今の会社での責任を考え、誘いには礼状を書いて断りました。' }] },
    ],
  },
  {
    ...XN,
    id: 'x.bbc.trade',
    category: 'bbFront',
    stages: ['adult'],
    ages: [30, 64],
    when: (s) => front(s) && tenure(s, 2) && !hasFlag(s, 'bbc.trade'),
    weight: 12,
    maxPerLife: 1,
    title: 'トレードの交渉',
    body: '優勝を狙うために、即戦力の投手が欲しいという現場の声があります。相手球団は、こちらの若手の有望株を求めてきました。',
    auto: 2,
    choices: [
      { label: '有望株を出して、即戦力を取る', hint: '今年は勝てる。数年後に悔やむかもしれない', flag: 'bbc.trade', effects: { sat: 3 }, outcomes: [{ follow: [{ id: 'x.bbc.tradeResult', after: 1, within: 2 }], text: '電話で最後の条件を詰め、深夜に両球団の発表文を確かめました。' }] },
      { label: '若手を守り、交渉を打ち切る', effects: { rel: 3, sat: -2 }, outcomes: [{ text: '現場には時間をくださいと頭を下げ、育てる方針を貫きました。' }] },
      { label: '上司の判断に委ねる', flag: 'bbc.tradeAsk', outcomes: [{ text: '交渉の経過だけを報告書にまとめ、決めるのは上の人たちに任せました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.bbc.tradeResult',
    category: 'bbFront',
    stages: ['adult'],
    when: (s) => front(s) && hasFlag(s, 'bbc.trade'),
    outcomes: [
      {
        weight: 1.2,
        text: '獲得した投手がフル回転し、チームは最後まで優勝を争いました。球団の中で、交渉をまとめた手腕が評価されました。',
        effects: { sat: 5, payScale: 1.2, flag: 'bbc.frontWin' },
        follow: [{ id: 'x.bbc.gmCall', after: 3, within: 5 }],
      },
      { weight: 1, kind: 'bad', text: '放出した若手が移籍先で一気に開花し、ファンからの厳しい声が事務所の電話に届きました。', effects: { happy: -4, fame: -2 } },
    ],
  },
  {
    ...XN,
    id: 'x.bbc.fanIdea',
    category: 'bbFront',
    stages: ['adult'],
    ages: [28, 64],
    when: (s) => front(s) && !hasFlag(s, 'bbc.fanIdea'),
    weight: 10,
    maxPerLife: 1,
    title: 'ファンを呼ぶ企画',
    body: '空席の目立つ平日の試合に、どうやって人を呼ぶか。企画会議で、案を出すよう求められました。',
    auto: 2,
    choices: [
      {
        label: '地元の小学生を無料で招待する日を作る',
        hint: '目先の売上は減るが、将来のファンを育てる',
        flag: 'bbc.fanIdea',
        effects: { rel: 3, sat: 2 },
        outcomes: [
          { weight: 2, text: '招待日には外野席が子どもたちの声で埋まり、翌年から親子での来場が目に見えて増えました。', effects: { fame: 2, payScale: 1.1 } },
          { weight: 1, text: '招待日は雨で中止になり、学校との振り替えの調整に追われました。', effects: { happy: -2 } },
        ],
      },
      {
        label: '昔のユニフォームを復刻して売り出す',
        hint: '当たれば大きい。外れれば在庫が残る',
        flag: 'bbc.fanIdea',
        effects: { sat: 1 },
        outcomes: [
          { weight: 2, text: '復刻ユニフォームは発売日に売り切れ、古くからのファンが球場に戻ってきました。', effects: { payScale: 1.15, happy: 3 } },
          { weight: 1, text: '数を作りすぎて、売れ残った段ボール箱が倉庫の一角を占めました。', effects: { sat: -3 } },
        ],
      },
      { label: '先輩社員の案に乗る', flag: 'bbc.fanFollow', outcomes: [{ text: '自分の案は引っ込め、先輩が温めてきた花火大会の企画を手伝いました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.bbc.gmCall',
    category: 'bbFront',
    stages: ['adult'],
    when: (s) => front(s) && hasFlag(s, 'bbc.frontWin'),
    decision: 'major',
    title: '編成の責任者に',
    body: '球団の編成を取り仕切るゼネラルマネージャーの席が空き、オーナーから後任に指名されました。',
    auto: 2,
    choices: [
      {
        label: 'ゼネラルマネージャーを引き受ける',
        hint: '全権を握る。結果が出なければ矢面に立つ',
        flag: 'bbc.gm',
        effects: { achieve: '球団のゼネラルマネージャー', payScale: 1.6, fame: 5 },
        outcomes: [{ follow: [{ id: 'x.bbc.presidentCall', after: 4, within: 6 }], kind: 'big', key: true, text: '就任の日、編成会議の長机の一番奥の席に座りました。' }],
      },
      { label: '現場の部長にとどまる', effects: { sat: 3, happy: 2 }, outcomes: [{ text: '肩書きより現場との距離を選び、今の部署で働き続けることにしました。' }] },
      { label: 'オーナーと話してから決める', flag: 'bbc.gmTalk', outcomes: [{ text: '返事の前にオーナーと何度も話し合ううち、席には外から招かれた人が座りました。' }] },
    ],
  },
  {
    ...XF,
    id: 'x.bbc.presidentCall',
    category: 'bbFront',
    stages: ['adult', 'senior'],
    when: (s) => front(s) && hasFlag(s, 'bbc.gm'),
    outcomes: [
      {
        weight: 0.4,
        kind: 'big',
        key: true,
        text: 'ゼネラルマネージャーとしての数年の実績が認められ、球団社長に就任しました。選手出身の社長は、球団の歴史で初めてです。',
        effects: { achieve: '球団社長', payScale: 1.5, fame: 6, happy: 8 },
      },
      { weight: 1, text: '任期を終えたあとも相談役として球団に籍を残し、若い職員の相談に乗る立場になりました。', effects: { sat: 3, happy: 3 } },
      { weight: 0.6, kind: 'bad', text: '補強の失敗が続き、ゼネラルマネージャーを解任されました。それでも、球界を離れる気にはなりませんでした。', effects: { payScale: 0.6, happy: -5, fame: -3 } },
    ],
  },

  // ================================================================ ballpark memories
  {
    ...X,
    id: 'x.bbc.reunion',
    category: 'bbMemory',
    stages: ['adult', 'senior'],
    ages: [35, 82],
    when: (s) => done(s) && rank(s) >= 4 && !hasFlag(s, 'bbc.reunion'),
    weight: 3,
    maxPerLife: 1,
    title: '球場での再会',
    body: (s) =>
      hasFlag(s, 'rival.fierce') || hasFlag(s, 'rival.friend')
        ? '久しぶりに足を運んだ球場で、現役時代に同じポジションを争った相手と、通路でばったり顔を合わせました。'
        : '久しぶりに足を運んだ球場で、高校時代の監督が、スタンドの端に一人で座っているのを見つけました。',
    auto: 2,
    choices: [
      {
        label: '声をかけ、試合のあとで食事に誘う',
        flag: 'bbc.reunion',
        effects: { rel: 4, happy: 3 },
        outcomes: [
          { weight: 2, text: '焼き鳥屋のカウンターで、あの夏の一球の話を、互いの記憶違いに笑いながら何度も繰り返しました。', effects: { happy: 2 } },
          { weight: 1, text: '話は弾みましたが、相手の体調が思わしくないと聞き、帰り道は少し胸が重くなりました。', effects: { happy: -2 } },
        ],
      },
      { label: '隣の席で、一緒に試合を観る', flag: 'bbc.reunion', effects: { happy: 3 }, outcomes: [{ text: '言葉は少なく、打球が上がるたびに、二人で同じ方向を見上げました。' }] },
      { label: '遠くから会釈だけする', flag: 'bbc.reunion', outcomes: [{ text: '目が合った気がして小さく頭を下げ、そのまま自分の席に戻りました。' }] },
    ],
  },
  {
    ...X,
    id: 'x.bbc.oldRecord',
    category: 'bbMemory',
    stages: ['adult', 'senior'],
    ages: [40, 85],
    when: (s) => done(s) && (s.career.achievements.includes('甲子園') || rank(s) >= 5) && !hasFlag(s, 'bbc.record'),
    weight: 3,
    maxPerLife: 1,
    title: '並ばれた記録',
    body: '新聞のスポーツ面に、自分が現役のころに残した大会記録に、今年の若い選手が並んだという記事が載っていました。遠い日の自分の名前が、記事の中にあります。',
    auto: 2,
    choices: [
      {
        label: '球場へ足を運んで、若い選手を祝う',
        flag: 'bbc.record',
        effects: { happy: 4, rel: 2 },
        outcomes: [
          { weight: 2, text: '試合のあと花束を持って声をかけると、相手は自分の名前を知っていて、深々と頭を下げてくれました。', effects: { happy: 2 } },
          { weight: 1, text: '球場まで行ったものの人垣に阻まれて近づけず、スタンドから拍手を送るだけになりました。' },
        ],
      },
      { label: '記者の取材に応じ、当時を語る', flag: 'bbc.record', effects: { fame: 2, happy: 2 }, outcomes: [{ text: '電話取材で、あの日の天気から打席の数まで、覚えていることを全部話しました。' }] },
      { label: '記事を切り抜いて、しまっておく', flag: 'bbc.record', outcomes: [{ text: '記事を丁寧に切り抜き、古いスコアブックの間に挟みました。' }] },
    ],
  },
]
