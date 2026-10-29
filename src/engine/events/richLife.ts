import type { LifeState } from '../types.ts'
import { hasFlag, type EventSpec, holdsJob, hasFamily } from './spec.ts'
import { orgById, orgLabel } from '../../data/orgs.ts'

// More of the long life (PROJECT_PLAN §11.14): the pros' gear contracts, winters and veterans, teams that are
// crowded or small, and for the years after baseball a side job, trips, savings, the old coach, the alumni
// of the team, and the back. Each has choices with different effects, outcomes that differ and follow-ups;
// the おまかせ choice and the happenings only set facts (spec.ts NEUTRAL_FORBIDDEN). No team name appears in
// a bad line. All texts are original.

const P = { extra: true, career: true } as const
const A = { extra: true } as const
const pro = (s: LifeState) => s.career.phase === 'pro' && !!s.bb
const proAny = (s: LifeState) => (s.career.phase === 'pro' || s.career.phase === 'proMinor') && !!s.bb
const played = (s: LifeState) => s.career.highestRank >= 3
const working = (s: LifeState) => !!s.after?.work && !s.after.retired
const role = (s: LifeState) => s.bb?.role

/** where he played, for a line that is a good one (a real school, team or league the game placed him in) */
function homeTeam(s: LifeState): string {
  return s.schools?.univ?.name || s.career.amateurTeam || orgLabel(orgById(s.career.orgId)) || s.schools?.hs?.name || 'あのチーム'
}

export const RICH_LIFE: EventSpec[] = [
  // ---------------------------------------------------------------- pro
  {
    ...P,
    id: 'x.pro.endorse',
    category: 'gearDeal',
    stages: ['pro'],
    when: (s) => pro(s) && s.career.proDebut && s.career.proSeasons >= 1 && !hasFlag(s, 'pro.gearDeal'),
    weight: 8,
    maxPerLife: 1,
    title: '用具の契約',
    body: '用具メーカーから、バットとグラブの使用契約の話が来ました。',
    auto: 2,
    choices: [
      {
        label: '提示された条件で契約する',
        hint: '用具が支給され、契約金も入る。選手の好みに合わない品もある',
        effects: { money: 120, eval: 1 },
        outcomes: [
          { weight: 3, text: '契約書にサインし、新しい用具一式が届きました。手に取ると、使い慣れた感触に近いものでした。', effects: { conf: 2, flag: 'pro.gearDeal' }, follow: [{ id: 'x.pro.gearBack', after: 1 }] },
          { weight: 1, text: '契約した用具は手になじまず、慣らすのに時間がかかりました。', effects: { conf: -2, flag: 'pro.gearDeal' }, follow: [{ id: 'x.pro.gearBack', after: 1 }] },
        ],
      },
      { label: '複数のメーカーを比べて、条件を詰める', hint: '時間がかかるが、よい条件を引き出せる', effects: { fatigue: 3 }, outcomes: [{ weight: 1, text: '数社の担当者と話し合い、用具の質と条件の両方で納得できる一社を選びました。', effects: { money: 160, conf: 2, flag: 'pro.gearDeal' } }, { weight: 1, text: '比べているうちに話がまとまらず、契約の話は立ち消えになりました。', effects: { conf: -1 } }] },
      { label: '契約はせず、自分で選んだ用具を使う', outcomes: [{ text: '好みの用具を自分で買い、契約の話は丁重に断りました。' }] },
    ],
  },
  {
    ...P,
    id: 'x.pro.gearBack',
    category: 'gearDeal',
    stages: ['pro'],
    followOnly: true,
    when: (s) => pro(s) && hasFlag(s, 'pro.gearDeal'),
    outcomes: [
      { weight: 2, text: 'メーカーの担当者がグラウンドまで来て、グラブの型を細かく調整してくれました。', effects: { skill: { fielding: 0.1 }, conf: 3 } },
      { weight: 1, text: '契約の用具を使う試合が続き、取材で用具の話ばかり聞かれるようになりました。', effects: { happy: -1 } },
    ],
  },
  {
    ...P,
    id: 'x.pro.winter',
    category: 'offSeason',
    stages: ['pro'],
    when: (s) => proAny(s) && s.age <= 34,
    weight: 2,
    cooldown: 3,
    maxPerLife: 2,
    title: 'オフの過ごし方',
    body: 'シーズンが終わりました。来季までの数か月、何に時間を使うかを決める時期です。',
    auto: 2,
    choices: [
      {
        label: '先輩の自主トレに加わり、基礎から鍛え直す',
        hint: '技術が伸びるが、休みは減る',
        effects: { gain: 0.03, fatigue: 8, rel: 2 },
        outcomes: [
          { weight: 3, text: '先輩の自主トレに加わり、ウォーミングアップから走り方まで細かく教わりました。', effects: { skill: { stamina: 0.1, fielding: 0.1 }, flag: 'pro.mentor' }, follow: [{ id: 'x.pro.mentorBack', after: 1 }] },
          { weight: 1, text: '自主トレのペースについていけず、年明けに疲れを残してしまいました。', effects: { fatigue: 10, conf: -2 } },
        ],
      },
      {
        label: '海外のウィンターリーグに参加する',
        hint: '経験になるが、言葉と環境の壁がある。費用もかかる',
        effects: { money: -80, gain: 0.02, fatigue: 10 },
        outcomes: [
          { weight: 2, text: '海外のウィンターリーグで、国籍の違う選手たちとチームを組みました。試合の進め方が日本とは違いました。', effects: { conf: 4, flag: 'pro.winterLeague' } },
          { weight: 1, text: '慣れない環境で体調を崩し、予定していた試合の半分に出られませんでした。', effects: { conf: -3, health: -2 } },
        ],
      },
      { label: '体を休め、家族や友人との時間を持つ', outcomes: [{ text: '冬は旅行や友人との食事で気分転換をして、休養に充てました。' }] },
    ],
  },
  {
    ...P,
    id: 'x.pro.mentorBack',
    category: 'offSeason',
    stages: ['pro'],
    followOnly: true,
    when: (s) => proAny(s) && hasFlag(s, 'pro.mentor'),
    outcomes: [
      { weight: 2, text: '教わった走り方が試合でも自然に出るようになり、故障の少ない一年になりました。', effects: { conf: 4, gain: 0.02 } },
      { weight: 1, text: '先輩が移籍することになり、自主トレの習慣を一人で続ける形になりました。', effects: { conf: 1 } },
    ],
  },
  // ---------------------------------------------------------------- crowded and small teams
  {
    ...P,
    id: 'x.team.crowded',
    category: 'teamDepth',
    stages: ['hs', 'univ'],
    // a team that is strong and large: many players ahead, the player is not a regular
    when: (s) => !!s.bb && (s.career.phase === 'hs' || s.career.phase === 'univ') && (s.bb.teamSize ?? 0) >= 50 && (s.bb.teamStrength ?? 0) >= 0.8 && (role(s) === 'bench' || role(s) === 'outside'),
    weight: 8,
    cooldown: 3,
    maxPerLife: 2,
    title: '層の厚いチームで',
    body: (s) => `部員は${s.bb?.teamSize ?? 0}人。同じポジションには、自分より実績のある選手が何人も並んでいます。`,
    auto: 2,
    choices: [
      {
        label: '誰よりも早く来て、最後まで練習を続ける',
        flag: 'team.early',
        follow: [{ id: 'x.team.depthBack', after: 1, within: 3 }],
        hint: '少しずつ評価が上がるが、体に無理がかかる',
        effects: { gain: 0.03, fatigue: 12 },
        outcomes: [
          { weight: 2, text: '朝練の一番乗りが習慣になり、コーチが名前を覚えてくれました。', effects: { eval: 4, conf: 2 } },
          { weight: 1, text: '張り切りすぎて体が悲鳴を上げ、数日練習を休む羽目になりました。', effects: { fatigue: 8, conf: -3 } },
        ],
      },
      { label: '代打・守備固めなど、役割を一つに絞って磨く', flag: 'team.roleOnly', follow: [{ id: 'x.team.depthBack', after: 1, within: 3 }], effects: { eval: 3, conf: -1, skill: { speed: 0.08, fielding: 0.08 } }, outcomes: [{ text: '出番のかぎられる状況を受け入れ、一つの役割で必要とされる選手を目指すことにしました。' }] },
      { label: '周りの選手のよいところを観察して学ぶ', outcomes: [{ text: '強いチームの選手が、何を意識して練習しているかを、日々観察しました。' }] },
    ],
  },
  {
    ...P,
    id: 'x.team.small',
    category: 'teamDepth',
    stages: ['hs', 'univ', 'amateur'],
    // a small or weak team where a good player stands out: more is asked of him
    when: (s) => !!s.bb && ['hs', 'univ', 'company', 'indep'].includes(s.career.phase) && (s.bb.teamStrength ?? 0) < 0.3 && role(s) === 'starter' && s.z > 0.5,
    weight: 8,
    cooldown: 3,
    maxPerLife: 2,
    title: 'チームの柱として',
    body: 'チームの中で、あなたの力が頭ひとつ抜けています。試合の流れを決める場面が、どんどん回ってきます。',
    auto: 2,
    choices: [
      {
        label: '周りを引っぱり、練習の中心になる',
        flag: 'team.lead',
        follow: [{ id: 'x.team.depthBack', after: 1, within: 3 }],
        hint: 'チームが変わるが、背負うものが増える',
        effects: { rel: 3, fatigue: 8, eval: 2 },
        outcomes: [
          { weight: 2, text: '率先して声を出し、下級生に練習のやり方を教えるうち、チームが一つにまとまってきました。', effects: { conf: 4 } },
          { weight: 1, text: '期待を背負いすぎて、自分の打撃を見失う時期が続きました。', effects: { conf: -3, fatigue: 4 } },
        ],
      },
      { label: '自分の練習に専念し、上のレベルを目指す', flag: 'team.solo', follow: [{ id: 'x.team.depthBack', after: 1, within: 3 }], effects: { gain: 0.03, rel: -1 }, outcomes: [{ text: '周りとのレベル差を感じながら、自分のためのメニューを黙々と続けました。', effects: { skill: { contact: 0.08 } } }] },
      { label: 'いつもどおりのプレーを続ける', outcomes: [{ text: 'チームのために、できることを淡々と続けました。' }] },
    ],
  },
  {
    ...P,
    id: 'x.team.crowdedMove',
    category: 'teamDepth',
    stages: ['amateur'],
    when: (s) => !!s.bb && ['company', 'indep'].includes(s.career.phase) && (role(s) === 'outside' || role(s) === 'bench') && s.career.phaseYears >= 2,
    weight: 6,
    cooldown: 3,
    maxPerLife: 1,
    title: '出番のない日々',
    body: 'この数年、試合に出る機会がほとんどありません。他のチームから、うちに来ないかと打診がありました。',
    auto: 1,
    choices: [
      { label: '環境を変えて、新しいチームで挑戦する', hint: '出番は増えるかもしれないが、人間関係はゼロから', effects: { moveTeam: true, rel: -3, conf: 3 }, outcomes: [{ text: '誘いを受けて新しいチームに移り、練習の初日から出場機会を与えられました。', effects: { eval: 4 } }] },
      { label: '今のチームで、もう少し粘る', outcomes: [{ text: '誘いは断り、今のチームで出番を勝ち取ると決めました。' }] },
    ],
  },
  // ---------------------------------------------------------------- after baseball
  {
    ...A,
    id: 'x.life.sideJob',
    category: 'sideJob',
    stages: ['adult'],
    ages: [30, 58],
    when: (s) => working(s) && !hasFlag(s, 'life.sideJob'),
    weight: 2,
    maxPerLife: 1,
    title: '副業の話',
    body: '同僚が、休日にネットで手作りの品を売って、ちょっとした収入を得ていると話してくれました。',
    auto: 1,
    choices: [
      {
        label: '自分も、得意なことで休日の副業を始める',
        hint: '収入が増えるかもしれないが、休みが減る',
        effects: { money: -15 },
        outcomes: [{ text: '野球で覚えたノックの技術を生かし、休日に子ども向けの野球教室を開くことにしました。', effects: { flag: 'life.sideJob' }, follow: [{ id: 'x.life.sideJobResult', after: 2, within: 3 }] }],
      },
      { label: '本業に力を入れ、副業はしない', outcomes: [{ text: '休日は体を休めて、本業に力を注ぐことにしました。' }] },
    ],
  },
  {
    ...A,
    id: 'x.life.sideJobResult',
    category: 'sideJob',
    stages: ['adult', 'senior'],
    followOnly: true,
    // (its lines speak of his job: it waits while he has none; PROJECT_PLAN §11.61)
    when: (s) => hasFlag(s, 'life.sideJob') && holdsJob(s),
    outcomes: [
      { weight: 2, text: '副業の教室は口コミで広がり、毎週満員になりました。本業とは別の張り合いが生まれました。', effects: { money: 90, happy: 4 } },
      { weight: 2, text: '教室の参加者が増えず、準備の手間ばかりかかって、結局やめることにしました。', effects: { money: -10, happy: -2 } },
    ],
  },
  {
    ...A,
    id: 'x.life.travel',
    category: 'travelLife',
    stages: ['adult', 'senior'],
    ages: [28, 78],
    when: (s) => s.money >= 120,
    weight: 2,
    cooldown: 4,
    maxPerLife: 3,
    title: '久しぶりの旅行',
    // (with a job or without one, and if it ends later in the same year)
    body: 'しばらく、時間に余裕ができそうです。どこかへ出かけてみようかと考えています。',
    auto: 2,
    choices: [
      {
        label: '家族や友人と、少し贅沢な国内旅行に出かける',
        hint: '思い出が増える。出費は大きい',
        effects: { money: -40, happy: 4, rel: 3 },
        outcomes: [
          { weight: 3, text: (s) => `温泉宿の食事を囲みながら、${hasFamily(s) ? '家族で' : '友人と'}ゆっくり話をしました。`, effects: { health: 1 } },
          { weight: 1, text: '渋滞と悪天候が重なり、帰り道はぐったりでした。', effects: { happy: -2 } },
        ],
      },
      {
        label: '一人で、遠い海外の野球場を見に行く',
        hint: '刺激は大きいが、お金も体力もいる',
        effects: { money: -70, happy: 3 },
        outcomes: [
          { weight: 2, text: '海外のスタジアムで、現地のファンと肩を組んで観戦しました。', effects: { rel: 2, flag: 'life.ballparkTrip' }, follow: [{ id: 'x.life.tripAlbum', after: 2, within: 5 }] },
          { weight: 1, text: '言葉が通じずに苦労しましたが、地元の人の優しさに助けられました。', effects: { know: 1 } },
        ],
      },
      { label: '近所を散歩して、のんびり過ごす', outcomes: [{ text: '遠出はせず、近所の公園と商店街を歩いて過ごしました。' }] },
    ],
  },
  {
    ...A,
    id: 'x.life.savings',
    category: 'moneyLife',
    stages: ['adult'],
    ages: [28, 60],
    when: (s) => working(s) && !hasFlag(s, 'life.savings'),
    weight: 2,
    cooldown: 5,
    maxPerLife: 1,
    title: '家計の見直し',
    // (written when the year is planned: words that read right even if he retires later in the same year)
    body: '貯蓄と保険を、一度見直してみないかと知人に勧められました。',
    auto: 2,
    choices: [
      {
        label: '毎月の積立を始める',
        hint: '少しずつ増えるが、使えるお金が減る',
        effects: { money: -30 },
        outcomes: [{ text: '毎月の収入の一部を自動で積み立てる設定をして、通帳の数字が増えていくのを楽しみにすることにしました。', effects: { flag: 'life.savings' }, follow: [{ id: 'x.life.savingsResult', after: 3, within: 4 }] }],
      },
      { label: '保険の内容を見直して、無駄を減らす', effects: { money: 20, know: 1 }, outcomes: [{ text: '保険の担当者と一件ずつ内容を確認し、使っていない特約を外して支払いを減らしました。' }] },
      { label: '今のままにしておく', outcomes: [{ text: '忙しさを理由に、見直しは来年に回しました。' }] },
    ],
  },
  {
    ...A,
    id: 'x.life.savingsResult',
    category: 'moneyLife',
    stages: ['adult', 'senior'],
    followOnly: true,
    when: (s) => hasFlag(s, 'life.savings'),
    outcomes: [
      { weight: 2, text: '積立の残高がまとまった額になり、急な出費にも慌てずに済むようになりました。', effects: { money: 120, happy: 2 } },
      { weight: 1, text: '相場が下がって、積み立てた額が一時的に目減りしました。', effects: { money: -20, happy: -1 } },
    ],
  },
  {
    ...A,
    id: 'x.life.coachVisit',
    category: 'mentorLife',
    stages: ['adult', 'senior'],
    ages: [26, 72],
    when: (s) => played(s) && !hasFlag(s, 'life.coachVisit'),
    weight: 2,
    maxPerLife: 1,
    title: '恩師の知らせ',
    body: (s) => `${homeTeam(s)}で指導してくれた恩師が、体調を崩して入院されたと聞きました。`,
    auto: 2,
    choices: [
      {
        label: '都合をつけて、見舞いに行く',
        effects: { rel: 4, happy: 3 },
        outcomes: [
          { weight: 3, text: '病室で、恩師は昔と同じ口調で近況を尋ねてくれました。帰り際、「いい顔になったな」と言われました。', effects: { flag: 'life.coachVisit' } },
          { weight: 1, text: '面会はごく短く、恩師はうとうとと眠っていました。それでも会えてよかったと感じました。', effects: { flag: 'life.coachVisit', happy: -1 } },
        ],
      },
      { label: '手紙とお見舞いの品を送る', effects: { money: -3, rel: 1 }, outcomes: [{ text: '近況と感謝の気持ちを便箋に書き、見舞いの品と一緒に送りました。', effects: { flag: 'life.coachLetter' }, follow: [{ id: 'x.life.coachReply', after: 1, within: 3 }] }] },
      { label: '忙しさを理由に、連絡を後回しにする', outcomes: [{ text: '連絡しなければと思いながら、日々の仕事に追われて過ぎていきました。' }] },
    ],
  },
  {
    ...A,
    id: 'x.life.tripAlbum',
    category: 'travelLife',
    stages: ['adult', 'senior'],
    followOnly: true,
    when: (s) => hasFlag(s, 'life.ballparkTrip'),
    outcomes: [
      { weight: 2, text: '旅の写真を整理していて、あの夜のスタンドの笑顔が目に留まりました。アルバムを作って、仲間に送りました。', effects: { happy: 4, rel: 3 } },
      { weight: 1, text: '写真を見返すうち、また行きたい気持ちが湧いてきました。来年の休みの予定に、小さく印をつけました。', effects: { happy: 2 } },
    ],
  },
  {
    ...A,
    id: 'x.life.coachReply',
    category: 'mentorLife',
    stages: ['adult', 'senior'],
    followOnly: true,
    when: (s) => hasFlag(s, 'life.coachLetter'),
    outcomes: [
      { weight: 2, text: '恩師から、癖のある太い字の返事が届きました。「元気でやっているなら、それでいい」と結んでありました。', effects: { happy: 4, rel: 3 } },
      { weight: 1, text: '返事は来ませんでした。あとで、恩師が筆まめでない人だったと思い出して、笑いました。', effects: { happy: 1 } },
    ],
  },
  {
    ...A,
    id: 'x.life.obMeet',
    category: 'alumniLife',
    stages: ['adult', 'senior'],
    ages: [30, 78],
    when: (s) => played(s) && !hasFlag(s, 'life.obMeet'),
    weight: 2,
    cooldown: 5,
    maxPerLife: 2,
    title: 'OB会の案内',
    body: (s) => `${homeTeam(s)}のOB会から、今年の集まりの案内が届きました。`,
    auto: 2,
    choices: [
      {
        label: '幹事を引き受ける',
        hint: '大役だが、世代を超えたつながりができる',
        effects: { rel: 5, happy: 2 },
        outcomes: [
          { weight: 3, text: '同期と一緒に会場を押さえ、名簿を整理して当日を迎えました。思い出話が、深夜まで続きました。', effects: { flag: 'life.obMeet' }, follow: [{ id: 'x.life.obMeetBack', after: 2, within: 4 }] },
          { weight: 1, text: '連絡のつかない先輩が多く、準備に手間取りました。当日は人数も少なめでした。', effects: { happy: -1, flag: 'life.obMeet' } },
        ],
      },
      { label: '参加する', effects: { rel: 2, happy: 2 }, outcomes: [{ text: '久しぶりに顔を出すと、白髪の増えた仲間が笑顔で迎えてくれました。' }] },
      { label: '都合が合わず、欠席する', outcomes: [{ text: '日程が合わず、欠席の返事を出しました。' }] },
    ],
  },
  {
    ...A,
    id: 'x.life.obMeetBack',
    category: 'alumniLife',
    stages: ['adult', 'senior'],
    followOnly: true,
    when: (s) => hasFlag(s, 'life.obMeet'),
    outcomes: [
      { weight: 2, text: 'OB会で再会した後輩から、仕事の相談を受けました。昔の縁が、いまの仕事にもつながりました。', effects: { rel: 3, money: 30 } },
      { weight: 1, text: 'OB会の恒例の試合で、久しぶりにバットを握りました。翌日は筋肉痛でした。', effects: { happy: 3, health: -1 } },
    ],
  },
  {
    ...A,
    id: 'x.life.backPain',
    category: 'bodyAche',
    stages: ['adult', 'senior'],
    ages: [35, 72],
    when: (s) => played(s) && s.status.health < 75,
    weight: 2,
    cooldown: 4,
    maxPerLife: 2,
    title: '腰の痛み',
    body: '朝、布団から起き上がるときに腰が重く、痛むようになりました。若いころの無理が、いまごろ出てきたのかもしれません。',
    auto: 2,
    choices: [
      { label: '整形外科で診てもらい、リハビリに通う', hint: '時間と費用がかかるが、根本から治せる', effects: { health: 3, money: -10 }, outcomes: [{ text: '画像検査のあと、体幹を鍛えるリハビリのメニューをもらい、週に一度通い始めました。' }] },
      { label: 'ストレッチと筋トレで、鍛え直す', effects: { health: 1, happy: 1 }, outcomes: [{ weight: 2, text: '毎朝のストレッチを続けるうち、腰の重さが和らいできました。' }, { weight: 1, text: '張り切りすぎてぎっくり腰になり、しばらく動けませんでした。', effects: { health: -3 } }] },
      { label: '湿布で様子を見る', outcomes: [{ text: '痛みは波があるだけだと思い、湿布を貼って様子を見ることにしました。' }] },
    ],
  },
]
