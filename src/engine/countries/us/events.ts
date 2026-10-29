import type { LifeState } from '../../types.ts'
import { hasFlag, type EventSpec } from '../../events/spec.ts'

// Events of a US life (PROJECT_PLAN §11.31): a first set, written for the stages of the American road (the showcase circuit,
// the classroom, playing time and the summer leagues in college, the minors' bus rides, the call-up talk, arbitration, life
// after baseball). They use the declarative spec of the Japanese catalog (events/spec.ts) and only meet US lives. The おまかせ
// choice and the happenings are neutral (NEUTRAL_FORBIDDEN), so a life played on screen is the headless life. All texts are
// original; no school or club name appears in them.

const X = { extra: true, career: true, country: 'US' } as const
const hs = (s: LifeState) => s.career.phase === 'hs' && !!s.bb
const college = (s: LifeState) => s.career.phase === 'univ' && !!s.bb
const minors = (s: LifeState) => s.career.phase === 'proMinor' && !!s.bb
const majors = (s: LifeState) => s.career.phase === 'pro' && !!s.bb
const role = (s: LifeState) => s.bb?.role

export const US_SPECS: EventSpec[] = [
  {
    ...X,
    id: 'us.hs.showcase',
    category: 'usShowcase',
    stages: ['hs'],
    when: (s) => hs(s) && s.career.phaseYears >= 1 && !hasFlag(s, 'us.showcase'),
    weight: 8,
    maxPerLife: 1,
    title: '夏のショーケース',
    body: '夏休みに、各地の大学とプロのスカウトが集まる、選手を見せるための大会が開かれます。参加費と遠征の費用がかかります。',
    auto: 1,
    choices: [
      {
        label: '費用を工面して、遠くの会場まで出る',
        hint: '見てもらえる機会が増える。費用は家の負担になる',
        effects: { rel: -1 },
        outcomes: [
          { weight: 2, text: '会場でスカウトのスピードガンの前に立ち、手応えのある投球と打席を見せられました。', effects: { conf: 4, eval: 2, flag: 'us.showcase' } },
          { weight: 1, text: '緊張で力を出せず、見ていた大人の顔は変わりませんでした。', effects: { conf: -3, flag: 'us.showcase' } },
        ],
      },
      { label: '近くの会場だけ出る', outcomes: [{ text: '近場の小さな会場に一度だけ出て、いつもどおりに投げ、打ちました。' }] },
      { label: '出ずに、地元のチームの練習に打ち込む', hint: '費用はかからない。名前は知られにくい', effects: { fatigue: 4 }, outcomes: [{ text: '夏の間は地元のグラウンドに通い、基本の練習を重ねました。', effects: { skill: { fielding: 0.1 } } }] },
    ],
  },
  {
    ...X,
    id: 'us.hs.academics',
    category: 'usClassroom',
    stages: ['hs'],
    when: (s) => hs(s) && s.career.phaseYears >= 1 && !hasFlag(s, 'us.grades'),
    weight: 8,
    maxPerLife: 1,
    title: '成績と部活',
    body: '学校には、試合に出るために一定の成績を保つ決まりがあります。成績表の数字が下がってきました。',
    auto: 2,
    choices: [
      {
        label: '放課後の補習に出て、成績を戻す',
        hint: '練習の時間は減るが、大学への道は広がる',
        effects: { know: 3, fatigue: 3 },
        outcomes: [
          { weight: 3, text: '補習の甲斐があって、成績は元に戻りました。', effects: { conf: 2, flag: 'us.grades' } },
          { weight: 1, text: '補習に通ううちに疲れがたまり、練習で集中が切れる日が増えました。', effects: { fatigue: 6, flag: 'us.grades' } },
        ],
      },
      {
        label: '練習を優先して、成績は後回しにする',
        hint: '野球には打ち込めるが、出場停止の恐れもある',
        effects: { know: -2 },
        outcomes: [
          { weight: 2, text: '成績は上がらないまま、練習にだけは毎日出ました。', effects: { eval: 1, flag: 'us.grades' } },
          { weight: 1, text: '成績が基準に届かず、一試合だけ出場を止められました。', effects: { eval: -2, conf: -3, flag: 'us.grades' } },
        ],
      },
      { label: '先生に相談して様子を見る', outcomes: [{ text: '先生に相談すると、次の試験までは様子を見ようと言われました。' }] },
    ],
  },
  {
    ...X,
    id: 'us.col.playingTime',
    category: 'usPlayingTime',
    stages: ['univ'],
    when: (s) => college(s) && (role(s) === 'bench' || role(s) === 'outside') && !hasFlag(s, 'us.talked'),
    weight: 8,
    maxPerLife: 1,
    title: '出場機会',
    body: '入ったときは主力の候補と言われたのに、リーグ戦のベンチにも入れない日が続いています。',
    auto: 2,
    choices: [
      {
        label: 'コーチに、何が足りないか直接聞く',
        hint: '評価につながるが、厳しい答えが返ってくるかもしれない',
        outcomes: [
          { weight: 2, text: 'コーチは、相手投手の左右で起用を変えていると教えてくれました。課題がはっきりしました。', effects: { eval: 3, conf: 1, flag: 'us.talked' } },
          { weight: 1, text: '「練習で見せろ」とだけ言われ、話はそこで終わりました。', effects: { eval: -1, conf: -2, flag: 'us.talked' } },
        ],
      },
      {
        label: '別の大学への編入を考える',
        hint: '出番はあるかもしれないが、手続きと環境の変化がある',
        effects: { rel: -2, conf: 1 },
        outcomes: [
          { weight: 1, text: '編入先のコーチに連絡を取りましたが、返事が来る前に学期が終わりました。', effects: { flag: 'us.talked' } },
          { weight: 1, text: '編入の書類を準備するあいだに、いまのチームの仲間と話す機会が増えました。', effects: { rel: 2, flag: 'us.talked' } },
        ],
      },
      { label: '黙って練習を続ける', outcomes: [{ text: '何も言わずに、与えられたメニューをこなしました。' }] },
    ],
  },
  {
    ...X,
    id: 'us.col.summer',
    category: 'usSummer',
    stages: ['univ'],
    when: (s) => college(s) && s.career.phaseYears >= 1 && !hasFlag(s, 'us.summerLeague'),
    weight: 8,
    maxPerLife: 1,
    title: '夏のリーグ',
    body: '学期が終わると、全米の大学選手が集まる夏のリーグに参加する道があります。住み込みで、木製バットで試合をします。',
    auto: 1,
    choices: [
      {
        label: '夏のリーグに参加する',
        hint: '木製バットで力を試せる。休みはなく、疲れがたまる',
        effects: { fatigue: 8 },
        outcomes: [
          { weight: 2, text: '木製バットの感触に慣れたころには、打球の質が変わっていました。', effects: { skill: { contact: 0.15 }, eval: 3, flag: 'us.summerLeague' } },
          { weight: 1, text: '連戦の疲れで調子を崩し、夏の終わりには思うように打てなくなりました。', effects: { conf: -3, health: -1, flag: 'us.summerLeague' } },
        ],
      },
      { label: '実家に戻って、アルバイトをする', outcomes: [{ text: '夏は実家に戻って働き、貯金を少し増やしました。' }] },
      { label: '大学に残って、トレーニングに専念する', hint: '体は作れるが、試合の経験は増えない', effects: { gain: 0.01 }, outcomes: [{ text: '朝から夜までウエイトルームに通い、体に厚みが出てきました。', effects: { fatigue: 4 } }] },
    ],
  },
  {
    ...X,
    id: 'us.minor.bus',
    category: 'usBus',
    stages: ['pro'],
    when: (s) => minors(s) && !hasFlag(s, 'us.bus'),
    weight: 8,
    maxPerLife: 1,
    title: '遠征のバス',
    body: '試合のあとは、夜通しのバス移動です。次の町に着くのは、朝になります。',
    auto: 2,
    choices: [
      {
        label: '車中で眠って、体を休める',
        hint: '睡眠は取れるが、座席は狭い',
        effects: { health: 1 },
        outcomes: [
          { weight: 2, text: '座席を倒して眠り、着いた朝は体が軽くなっていました。', effects: { fatigue: -4, flag: 'us.bus' } },
          { weight: 1, text: '揺れで眠れないまま夜が明け、試合前から体が重いままでした。', effects: { fatigue: 4, flag: 'us.bus' } },
        ],
      },
      { label: '仲間と話して過ごす', hint: '絆は深まるが、寝不足になる', effects: { rel: 3, fatigue: 3 }, outcomes: [{ text: '明け方まで仲間と将来の話をして、同じ夢を持つ顔ぶれが増えました。', effects: { flag: 'us.bus' } }] },
      { label: '席で映像を見返して過ごす', outcomes: [{ text: '前の試合の映像を見返しながら、次の町へ着くのを待ちました。' }] },
    ],
  },
  {
    ...X,
    id: 'us.minor.callRumor',
    category: 'usCallUp',
    stages: ['pro'],
    when: (s) => minors(s) && (s.flags?.['us.level'] ?? 0) >= 2 && !hasFlag(s, 'us.callTalk'),
    weight: 8,
    maxPerLife: 1,
    title: '昇格の噂',
    body: '上のチームの故障者が出て、球団の中で名前が挙がっているという話が耳に入りました。',
    auto: 2,
    choices: [
      {
        label: '球団の担当者に、準備はできていると伝える',
        hint: '意欲は伝わるが、期待して落胆することもある',
        outcomes: [
          { weight: 2, text: '担当者は「見ている」とだけ答えました。その日から打席での一球に力が入りました。', effects: { eval: 2, conf: 2, flag: 'us.callTalk' } },
          { weight: 1, text: '声をかけたことが空回りして、その週は力みが出てしまいました。', effects: { conf: -3, flag: 'us.callTalk' } },
        ],
      },
      { label: '噂は気にせず、目の前の試合に集中する', hint: '落ち着いて過ごせる', effects: { conf: 2 }, outcomes: [{ text: '噂には触れず、毎日の試合に集中して過ごしました。' }] },
      { label: '特に何もせず、様子を見る', outcomes: [{ text: '噂は噂として、聞き流しました。' }] },
    ],
  },
  {
    ...X,
    id: 'us.mlb.arbitration',
    category: 'usArbitration',
    stages: ['pro'],
    when: (s) => majors(s) && s.career.proSeasons >= 3 && s.career.proSeasons <= 5 && !hasFlag(s, 'us.arb'),
    weight: 8,
    maxPerLife: 1,
    title: '年俸調停',
    body: '3年のサービスタイムを積み、年俸調停の資格を得ました。球団との交渉が始まります。',
    auto: 2,
    choices: [
      {
        label: '調停の聴聞会まで進む',
        hint: '勝てば大きく上がるが、球団との関係がきしむこともある',
        outcomes: [
          { weight: 1, text: '聴聞会で自分の成績が評価され、希望に近い額が認められました。', effects: { money: 400, conf: 3, flag: 'us.arb' } },
          { weight: 1, text: '聴聞会で球団の主張が通り、思ったほど上がりませんでした。球団との間に気まずさが残りました。', effects: { money: 100, eval: -2, flag: 'us.arb' } },
        ],
      },
      { label: '球団の提示を受け入れて合意する', hint: '安定している。上がり幅は控えめ', effects: { rel: 1 }, outcomes: [{ text: '球団の提示を受け入れて、聴聞会に進む前に合意しました。', effects: { money: 150, flag: 'us.arb' } }] },
      { label: '代理人に任せる', outcomes: [{ text: '代理人に交渉を任せ、結果の連絡を待ちました。' }] },
    ],
  },
  {
    ...X,
    id: 'us.after.coach',
    category: 'usAfterCoach',
    stages: ['adult'],
    when: (s) => s.age >= 28 && s.age <= 55 && s.career.endedAge !== null && s.career.highestRank >= 4 && !hasFlag(s, 'us.youthCoach'),
    weight: 6,
    maxPerLife: 1,
    title: '地元のチームのコーチ',
    body: '息子や近所の子どものチームで、コーチが足りないと声をかけられました。',
    auto: 2,
    choices: [
      {
        label: '週末だけ、ボランティアのコーチを引き受ける',
        hint: '野球とのつながりが戻る。週末の時間は減る',
        effects: { happy: 3, rel: 2 },
        outcomes: [
          { weight: 2, text: '子どもたちの前でノックを打つと、昔のグラウンドの匂いが戻ってきました。', effects: { happy: 2, flag: 'us.youthCoach' } },
          { weight: 1, text: '保護者との調整に手間取り、週末が思ったより忙しくなりました。', effects: { sat: -1, flag: 'us.youthCoach' } },
        ],
      },
      { label: '忙しいと断る', hint: '時間は守れる', effects: { rel: -1 }, outcomes: [{ text: '仕事が忙しいと断り、試合は観客席から見守りました。' }] },
      { label: '返事を先延ばしにする', outcomes: [{ text: '返事を保留していると、別の保護者がコーチを引き受けました。' }] },
    ],
  },
  {
    ...X,
    id: 'us.after.checkup',
    category: 'usAfterHealth',
    stages: ['adult', 'senior'],
    when: (s) => s.age >= 40 && s.career.endedAge !== null && !hasFlag(s, 'us.checkup'),
    weight: 6,
    maxPerLife: 1,
    title: '健康診断',
    body: '長年の野球で酷使してきた肩と膝が、年齢とともにうずくようになりました。',
    auto: 2,
    choices: [
      {
        label: '医師に相談して、運動の習慣を見直す',
        hint: '費用と時間はかかるが、体を守れる',
        effects: { money: -10, health: 2 },
        outcomes: [
          { weight: 2, text: '医師から負担の少ない運動を勧められ、毎朝の散歩を始めました。', effects: { happy: 2, flag: 'us.checkup' } },
          { weight: 1, text: '検査で早めに見つかった小さな異常を、治療できました。', effects: { health: 3, flag: 'us.checkup' } },
        ],
      },
      { label: '痛み止めでしのぐ', hint: '手軽だが、無理が積み重なる', effects: { health: -1 }, outcomes: [{ text: '痛み止めを飲みながら、これまでどおりの生活を続けました。' }] },
      { label: 'しばらく様子を見る', outcomes: [{ text: '痛みの程度が変わらないので、診察は先に延ばしました。' }] },
    ],
  },
]
