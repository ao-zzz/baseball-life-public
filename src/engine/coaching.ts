import type { EventCtx, EventDef, EventRegistry, EventStage } from './events.ts'
import { markSeen, stageOf, tagged, weightOf } from './events.ts'
import type { CoachLevel, CoachSeason, LifeState } from './types.ts'
import { compileSpec, applyEffect, flagAge, hasFlag, sameJobSince, tenure, type EventSpec } from './events/spec.ts'
import { careerOf, scalePay } from './careers.ts'
import { clamp } from './math.ts'
import { honoursOf, STAT_TITLES } from './titles.ts'

// The coach's road after playing (2026-11-16, feedback 「引退後の指導者の道がなんも無さすぎてつまらない」). Before, a coach met about
// two scenes in eighteen years, and most first-team players were never asked. Now:
// - the way in: a Japanese player who played in the NPB 1軍 is asked, the year he retires, whether he stays with the club as a farm
//   coach or goes back to his old high school as its manager (x.cy.retireOffer; おまかせ: neither, flags only);
// - the years: while he coaches, a pass of its own (runCoachingPass, its own stream, after the year's other passes) draws a scene
//   most years: the pros (his pupils, the camp, a promotion to the first team, the head coach's chair, another club's offer, the
//   national team, the manager's chair) and the amateur teams (recruits, too few players, a strong private school's offer, a
//   university's or a company team's offer);
// - the seasons: a manager's team plays a season every year, kept in LifeState.coaching and shown on the result screen: an NPB
//   club's place in the league, its record, the Climax Series, the Japan Series and the end of his time on the bench; a high
//   school's spring and summer (the prefectural rounds, Koshien and its rounds); a university's league and the national
//   championship; a company team's 都市対抗.
// Only a man who chose to coach is concerned (careers.ts career 'coach', or the teacher who took the team): おまかせ never coaches
// (spec.ts NEUTRAL_FORBIDDEN on the offers of events/baseballCareer.ts, the おまかせ answer of x.cy.retireOffer), so a headless life
// and the calibrated checks do not move. Every figure of the seasons is a game assumption (stats coachSeasonModel), except the
// number of schools and Koshien's places (jpHsSchools, jpKoshien).

// ---------------------------------------------------------------- who leads what

const jp = (s: LifeState) => (s.person.country ?? 'JP') === 'JP'
const done = (s: LifeState) => s.career.phase === 'retired'
const coach = (s: LifeState) => careerOf(s) === 'coach'
const title = (s: LifeState) => s.after?.work?.title ?? ''
/** he coaches at an NPB club (the farm team, the first team, the head coach, the manager) */
export const proCoach = (s: LifeState) => coach(s) && hasFlag(s, 'bbc.proCoach')
/** he manages an NPB club */
export const proManager = (s: LifeState) => proCoach(s) && hasFlag(s, 'bbc.manager') && title(s) === '監督'
/** he manages a university's team / a company team */
export const univManager = (s: LifeState) => coach(s) && hasFlag(s, 'bbc.univCoach') && !hasFlag(s, 'bbc.proCoach')
export const corpManager = (s: LifeState) => coach(s) && hasFlag(s, 'bbc.corpCoach') && !hasFlag(s, 'bbc.proCoach') && !hasFlag(s, 'bbc.univCoach')
/** he leads a high school team: as a coach of careers.ts, or as the teacher who took the team (events/baseballCareer.ts) */
export const hsManager = (s: LifeState) =>
  (coach(s) && hasFlag(s, 'bbc.amCoach') && !['bbc.proCoach', 'bbc.indepCoach', 'bbc.univCoach', 'bbc.corpCoach'].some((f) => hasFlag(s, f))) ||
  (hasFlag(s, 'bbc.teacherCoach') && sameJobSince(s, 'bbc.teacherCoach'))
const farmCoach = (s: LifeState) => proCoach(s) && !['一軍コーチ', 'ヘッドコーチ', '監督'].includes(title(s))
const firstTeamCoach = (s: LifeState) => proCoach(s) && title(s) === '一軍コーチ'
const headCoach = (s: LifeState) => proCoach(s) && title(s) === 'ヘッドコーチ'
const benchCoach = (s: LifeState) => firstTeamCoach(s) || headCoach(s)
/** what he does: the pass draws only among the scenes of his kind */
export function coachKind(s: LifeState): 'proCoach' | 'proManager' | 'amateur' | undefined {
  if (!jp(s)) return undefined
  if (proManager(s)) return 'proManager'
  if (proCoach(s)) return 'proCoach'
  if (hsManager(s) || univManager(s) || corpManager(s)) return 'amateur'
  return undefined
}
const rank = (s: LifeState) => s.career.highestRank
const stats = (s: LifeState) => s.coaching?.seasons ?? []
const lastSeason = (s: LifeState, level?: CoachLevel) => [...stats(s)].reverse().find((x) => !level || x.level === level)
/** a son of the 1軍 who won titles: the names the national team and the bench look for */
const titled = (s: LifeState) => honoursOf(s).filter((h) => h.id === 'mvp' || STAT_TITLES.includes(h.id)).length
/** a name the clubs look for: a former major leaguer, a title holder or MVP, an All-Star three times */
const star = (s: LifeState) => rank(s) >= 9 || titled(s) >= 1 || honoursOf(s).filter((h) => h.id === 'allstar').length >= 3
const pos = (s: LifeState) => (s.person.position === 'P' ? '投手陣' : '野手陣')
const posWho = (s: LifeState) => (s.person.position === 'P' ? '投手' : '打者')

/** a scene of the coaching years: only after his own choice to coach, at any age he still coaches */
const C = { needsChoice: true, stages: ['adult', 'senior'] as EventStage[] } as const
/** the season before this one (the pass plays this year's season before its scenes) */
const prevSeason = (s: LifeState, level: CoachLevel) => [...stats(s)].reverse().find((x) => x.level === level && x.age < s.age)

// ---------------------------------------------------------------- the scenes

export const COACHING_SPECS: EventSpec[] = [
  // ================================================================ the way in: the year he retires from the NPB
  {
    id: 'x.cy.retireOffer',
    category: 'cyEntry',
    stages: ['adult'],
    ages: [22, 50],
    when: (s) => jp(s) && done(s) && rank(s) >= 8 && s.age - (s.career.endedAge ?? s.age) <= 1 && !coach(s) && !hasFlag(s, 'cy.retireOffer') && !hasFlag(s, 'bbc.proCoach'),
    weight: 1,
    decision: 'major',
    title: 'ユニフォームを脱ぐとき',
    body: '現役を退くにあたって、球団から、二軍のコーチとしてチームに残ってほしいと打診がありました。母校の高校からも、学生野球の資格を回復する研修を受けて、監督として戻ってきてほしいという話が届いています。',
    auto: 2,
    choices: [
      {
        label: '二軍のコーチとして球団に残る',
        hint: '若手を育てる。一軍のコーチや監督への道もある',
        flag: ['cy.retireOffer', 'bbc.proCoach'],
        effects: { career: 'coach', title: '二軍コーチ' },
        outcomes: [{ follow: [{ id: 'x.bbc.proCoachYears', after: 3, within: 3 }], text: '引退会見から数日後、コーチ用の新しいジャージと、若手の練習計画の束を受け取りました。' }],
      },
      {
        label: '母校の高校の監督になる',
        hint: '研修を受けて、高校生と甲子園を目指す',
        flag: ['cy.retireOffer', 'bbc.amCoach'],
        effects: { career: 'coach', title: '高校野球部の監督' },
        outcomes: [{ follow: [{ id: 'x.bbc.firstSquad', after: 1, within: 2 }], text: '学生野球の資格を回復する研修を終え、春から母校のグラウンドに立つことになりました。' }],
      },
      { label: '今は、ユニフォームを脱ぐ', flag: 'cy.retireOffer', outcomes: [{ text: 'どちらの話にも礼を言い、しばらくは野球から離れて、これからのことを考えることにしました。' }] },
    ],
  },

  // ================================================================ an NPB coach
  {
    ...C,
    id: 'x.cy.firstPupil',
    category: 'cyPro',
    when: (s) => proCoach(s) && tenure(s, 1),
    weight: 6,
    maxPerLife: 2,
    cooldown: 3,
    outcomes: [
      {
        weight: 2,
        text: (s) => `二軍で一緒に汗を流してきた${posWho(s)}が、一軍で初めての${s.person.position === 'P' ? '勝利' : '本塁打'}を記録しました。記念のボールを持って、真っ先に報告に来てくれました。`,
        effects: { happy: 4, sat: 3 },
      },
      { weight: 1, text: (s) => `期待をかけて教えてきた${posWho(s)}が、一軍に上がってすぐに壁にぶつかり、二軍に戻ってきました。もう一度、一から積み直すことにしました。`, effects: { sat: -2, rel: 2 } },
    ],
  },
  {
    ...C,
    id: 'x.cy.camp',
    category: 'cyPro',
    when: (s) => proCoach(s) && !proManager(s),
    weight: 5,
    maxPerLife: 3,
    cooldown: 4,
    title: '秋季キャンプの方針',
    body: (s) => `秋季キャンプで、若手の${pos(s)}を任されました。どんな練習で鍛えるかは、自分に任されています。`,
    choices: [
      {
        label: '数をこなして、体に覚えさせる',
        hint: '基礎が固まる。故障する選手も出るかもしれない',
        flag: 'cy.campVolume',
        effects: { sat: 2 },
        outcomes: [
          { weight: 2, text: '一日に何百球という練習を続けるうち、若手の動きから迷いが消えていきました。', effects: { happy: 2 } },
          { weight: 1, text: '練習量を増やした矢先に、若手の一人が故障で離脱しました。やり方を少し見直すことにしました。', effects: { happy: -3, sat: -2 } },
        ],
      },
      {
        label: '映像とデータで、一人ずつ課題を示す',
        hint: '納得して取り組める。慣れるまで時間がかかる',
        flag: 'cy.campData',
        effects: { know: 2 },
        outcomes: [
          { weight: 2, text: '球の回転や打球の角度を数字で見せると、若手のほうから質問に来るようになりました。', effects: { sat: 3 } },
          { weight: 1, text: '数字の説明に時間をかけすぎて、ベテランのコーチから「現場は理屈じゃない」とたしなめられました。', effects: { rel: -2 } },
        ],
      },
      { label: '選手ごとに、自分で考えさせる', flag: 'cy.campFree', effects: { rel: 3 }, outcomes: [{ text: '練習の組み立ては選手に任せ、自分は気づいたことを一言ずつ伝える役に回りました。' }] },
    ],
    auto: 2,
  },
  {
    ...C,
    id: 'x.cy.formClash',
    category: 'cyPro',
    when: (s) => proCoach(s) && tenure(s, 1),
    weight: 4,
    maxPerLife: 2,
    cooldown: 4,
    title: 'フォームを変えたくない若手',
    body: (s) => `才能はあるのに結果の出ない若手の${posWho(s)}に、フォームの修正を勧めました。ところが本人は「今の形を変えたくない」と言って聞きません。`,
    choices: [
      {
        label: 'コーチとして、修正を押し通す',
        hint: '化けるかもしれない。心が離れるかもしれない',
        effects: { sat: 1 },
        outcomes: [
          { weight: 1, kind: 'good', text: '半年かけて作り直したフォームで、若手は一軍に定着しました。「あのとき言ってもらえてよかった」と言われました。', effects: { happy: 5, sat: 3 } },
          { weight: 1, text: '無理に変えたフォームがしっくりこないまま、若手は自信をなくしてしまいました。教えることの難しさを思い知りました。', effects: { happy: -4 } },
        ],
      },
      { label: '本人のやり方を尊重する', effects: { rel: 3 }, outcomes: [{ text: '形はそのままにして、体の使い方だけを一緒に探ることにしました。若手は少しずつ心を開いてくれました。' }] },
      { label: '映像を並べて、一緒に確かめる', flag: 'cy.clashTalk', outcomes: [{ text: '良かったころと今の映像を並べて見せ、どうするかは本人が決めるのを待ちました。' }] },
    ],
    auto: 2,
  },
  {
    ...C,
    id: 'x.cy.promote',
    category: 'cyPro',
    when: (s) => farmCoach(s) && tenure(s, 2),
    weight: 8,
    maxPerLife: 2,
    title: '一軍のベンチへ',
    body: '二軍で若手を育ててきた働きが認められ、来季は一軍のコーチとしてベンチに入ってほしいと言われました。',
    choices: [
      {
        label: '一軍のコーチになる',
        hint: '勝ち負けの責任を負う。年俸も上がる',
        effects: { title: '一軍コーチ', payScale: 1.2, sat: 3 },
        outcomes: [{ text: '開幕戦、一軍のベンチから見るグラウンドは、選手のころより少し広く見えました。' }],
      },
      { label: '二軍で若手を育て続ける', effects: { happy: 2, rel: 2 }, outcomes: [{ text: '若手の成長を最後まで見届けたいと伝え、二軍のグラウンドに残りました。' }] },
      { label: '球団の判断に任せる', flag: 'cy.promoteAsk', outcomes: [{ text: '自分からは答えを出さず、球団の決めた配置に従うことにしました。今年も二軍の担当です。' }] },
    ],
    auto: 2,
  },
  {
    ...C,
    id: 'x.cy.head',
    category: 'cyPro',
    ages: [34, 66],
    when: (s) => firstTeamCoach(s) && tenure(s, 4) && rank(s) >= 8,
    weight: 6,
    maxPerLife: 2,
    title: 'ヘッドコーチの打診',
    body: '監督から、来季はヘッドコーチとして、作戦とコーチ陣のまとめ役を担ってほしいと頼まれました。',
    choices: [
      {
        label: 'ヘッドコーチを引き受ける',
        hint: '監督の右腕になる。監督の座が近づく',
        flag: 'cy.headDone',
        effects: { title: 'ヘッドコーチ', payScale: 1.2, sat: 3 },
        outcomes: [{ text: '試合前のミーティングで、監督の隣の席に座るようになりました。' }],
      },
      { label: '今の担当に残る', effects: { happy: 2 }, outcomes: [{ text: '自分には選手と向き合う今の仕事が合っていると伝え、話は別のコーチに回りました。' }] },
      { label: '返事を先に延ばす', flag: 'cy.headWait', outcomes: [{ text: '少し考えさせてほしいと伝えるうちに、ヘッドコーチは外から招かれることになりました。' }] },
    ],
    auto: 2,
  },
  {
    ...C,
    id: 'x.cy.poach',
    category: 'cyPro',
    ages: [32, 64],
    when: (s) => proCoach(s) && !proManager(s) && tenure(s, 3),
    weight: 3,
    maxPerLife: 2,
    cooldown: 5,
    title: '他球団からの誘い',
    body: '別の球団から、今より良い条件でコーチとして迎えたいという話が来ました。今の球団にも、育てている若手がいます。',
    choices: [
      { label: '新しい球団に移る', hint: '条件は良い。一から信頼を築き直す', flag: 'cy.moved', effects: { payScale: 1.25, rel: -2 }, outcomes: [{ text: '新しい球団の寮で、初めて会う若手たちの名前を一人ずつ覚えるところから始めました。' }] },
      { label: '今の球団に残る', effects: { rel: 3, sat: 2 }, outcomes: [{ text: '誘いを断ったことを知った若手たちが、その日の練習でいつも以上に声を出していました。' }] },
      { label: '球団に相談する', flag: 'cy.poachAsk', outcomes: [{ text: '球団に話を伝えると、来季の契約を一年延ばすという返事が来て、そのまま残ることになりました。' }] },
    ],
    auto: 2,
  },
  {
    ...C,
    id: 'x.cy.national',
    category: 'cyPro',
    ages: [36, 66],
    when: (s) => benchCoach(s) && (rank(s) >= 9 || titled(s) >= 2),
    weight: 4,
    title: '日本代表のコーチに',
    body: '国際大会に臨む日本代表の監督から、コーチとして加わってほしいと連絡がありました。シーズンの合間に、合宿と大会が入ります。',
    choices: [
      {
        label: '日本代表のコーチを引き受ける',
        hint: '大きな舞台に立てる。休みはなくなる',
        effects: { achieve: '日本代表のコーチ', fame: 4, happy: 3, rel: -2 },
        outcomes: [
          { weight: 1, kind: 'big', key: true, text: '大会では、ベンチから選手を送り出し続け、最後は優勝の輪の中にいました。日の丸のついたユニフォームは、今も大切にしまってあります。', effects: { happy: 6 } },
          { weight: 2, text: '大会は準決勝で敗れました。それでも、各球団の主力と過ごした数週間で、教える側としての引き出しが増えました。', effects: { know: 2 } },
        ],
      },
      { label: '球団の仕事に専念する', effects: { sat: 2 }, outcomes: [{ text: 'シーズンの準備を優先したいと伝え、代表の話は辞退しました。' }] },
      { label: '球団に判断を任せる', flag: 'cy.nationalAsk', outcomes: [{ text: '球団と相談するうちに、代表のコーチは別の人に決まりました。' }] },
    ],
    auto: 2,
  },
  {
    ...C,
    id: 'x.cy.pupilTitle',
    category: 'cyPro',
    when: (s) => benchCoach(s) && tenure(s, 3),
    weight: 4,
    maxPerLife: 2,
    cooldown: 4,
    outcomes: [
      {
        weight: 1,
        kind: 'good',
        text: (s) => `担当してきた${posWho(s)}が、${s.person.position === 'P' ? '最多勝' : '首位打者'}のタイトルを獲りました。表彰式のスピーチで、自分の名前を挙げてくれました。`,
        effects: { happy: 6, sat: 4, fame: 1 },
      },
      { weight: 1, text: '担当してきた選手が、オフにメジャーリーグへの挑戦を表明しました。空港で見送ると、「向こうでも教わったことを続けます」と言われました。', effects: { happy: 3, rel: 2 } },
    ],
  },
  {
    ...C,
    id: 'x.cy.study',
    category: 'cyPro',
    ages: [30, 60],
    when: (s) => proCoach(s) && !proManager(s) && s.money >= 100,
    weight: 2,
    title: 'アメリカへのコーチ留学',
    body: 'オフの間、アメリカのマイナーリーグの球団でコーチの研修を受けられる話があります。費用の一部は自分持ちです。',
    choices: [
      {
        label: '留学して、向こうの指導を学ぶ',
        hint: 'お金はかかる。新しい教え方が身につく',
        flag: 'cy.studied',
        effects: { money: -80, know: 4, sat: 2 },
        outcomes: [{ text: '球場の隣のアパートに住み、若い選手たちと同じ時間にグラウンドへ通いました。帰りの飛行機で、ノートは三冊目になっていました。' }],
      },
      { label: '家族と過ごすオフにする', effects: { rel: 3, happy: 2 }, outcomes: [{ text: '留学は見送り、久しぶりに家でゆっくりとオフを過ごしました。' }] },
      { label: '次の機会を待つ', flag: 'cy.studyWait', outcomes: [{ text: '今年は見送り、話だけは聞いておくことにしました。' }] },
    ],
    auto: 2,
  },
  {
    ...C,
    id: 'x.cy.managerOffer',
    category: 'cyPro',
    ages: [38, 68],
    when: (s) => (headCoach(s) || (firstTeamCoach(s) && rank(s) >= 9)) && tenure(s, 5) && !hasFlag(s, 'bbc.manager') && !hasFlag(s, 'cy.managerPass'),
    // (twelve chairs: the clubs look first for a name, a former major leaguer, a title holder or an All-Star regular; an assumption)
    weight: (s) => (star(s) ? 6 : 0.5),
    decision: 'major',
    title: '監督の座',
    body: 'シーズンを終えて、オーナーから、来季は一軍の監督として指揮を執ってほしいと告げられました。コーチとして積み重ねてきた年月が買われたのです。',
    choices: [
      {
        label: '監督を引き受ける',
        hint: '年俸は大きく上がる。負ければ批判を浴びる',
        flag: 'bbc.manager',
        effects: { title: '監督', achieve: 'プロ野球の監督', fame: 8, payScale: 2.5 },
        outcomes: [{ kind: 'big', key: true, text: '就任会見で、新しい背番号のユニフォームに袖を通し、一斉にフラッシュを浴びました。' }],
      },
      { label: 'コーチとして支え続ける', effects: { sat: 2, payScale: 1.1 }, outcomes: [{ text: '監督の座は別の人に譲り、自分はこれまでどおり、ベンチで選手を支えることにしました。' }] },
      { label: '身に余ると辞退する', flag: 'cy.managerPass', outcomes: [{ text: '自分にはまだ早いと考え、話を丁重に断りました。' }] },
    ],
    auto: 2,
  },

  // ================================================================ an NPB manager
  {
    ...C,
    id: 'x.cy.draft',
    category: 'cyManager',
    when: proManager,
    weight: 5,
    maxPerLife: 5,
    cooldown: 2,
    outcomes: [
      { weight: 1, kind: 'good', text: 'ドラフト会議で、競合した一位指名の抽選に臨みました。開いたくじに「交渉権確定」の文字を見つけ、思わず右手を突き上げました。', effects: { happy: 5, flag: 'cy.draftWon' } },
      { weight: 2, text: 'ドラフト会議で、競合した一位指名の抽選を引きましたが、外れでした。会場の拍手は、隣の球団の監督に向けられていました。', effects: { happy: -2 } },
    ],
  },
  {
    ...C,
    id: 'x.cy.critics',
    category: 'cyManager',
    when: (s) => proManager(s) && (lastSeason(s, 'pro')?.finish ?? 0) >= 4,
    weight: 6,
    maxPerLife: 3,
    cooldown: 2,
    title: '采配への批判',
    body: '負けが込み、スポーツ紙やファンの間で、継投や代打の采配を責める声が大きくなっています。',
    choices: [
      { label: '自分のやり方を貫く', hint: '信じた道を行く。結果が出なければ責任は重い', effects: { sat: 2, fame: -1 }, outcomes: [{ text: '記者の質問には「最後は結果で示します」とだけ答え、翌日も同じ顔ぶれで試合に臨みました。' }] },
      { label: 'コーチ陣を入れ替えて、空気を変える', hint: '流れが変わるかもしれない。古い仲間が去る', flag: 'cy.reshuffle', effects: { rel: -3 }, outcomes: [{ text: '長年の仲間だったコーチに配置換えを伝える夜は、なかなか寝つけませんでした。' }] },
      { label: '会見で、采配の意図を説明する', flag: 'cy.explain', outcomes: [{ text: '試合後の会見で、継投の判断の理由を一つずつ説明しました。翌朝の紙面には、その言葉がそのまま載りました。' }] },
    ],
    auto: 2,
  },
  {
    ...C,
    id: 'x.cy.reinforce',
    category: 'cyManager',
    when: proManager,
    weight: 5,
    maxPerLife: 3,
    cooldown: 3,
    title: 'オフの補強',
    body: '来季に向けて、球団から補強の方針を聞かれました。外から即戦力を取るか、若手を我慢して使うかです。',
    choices: [
      { label: '即戦力の補強を強く求める', hint: '来季は戦力が厚くなる。若手の出番は減る', flag: 'cy.reinforce', effects: { sat: 1 }, outcomes: [{ text: 'フロントと何度も話し合い、他球団で実績のある選手を迎えることになりました。' }] },
      { label: '若手を我慢して使い続ける', hint: 'すぐには勝てない。数年後に花開くかもしれない', flag: 'cy.youth', effects: { rel: 2 }, outcomes: [{ text: '開幕から若手を並べると決め、「数年後に強いチームを残す」と記者に語りました。' }] },
      { label: '球団の方針に任せる', flag: 'cy.reinforceAsk', outcomes: [{ text: '補強はフロントに任せ、自分は今いる選手でどう戦うかを考えることにしました。' }] },
    ],
    auto: 2,
  },
  {
    ...C,
    id: 'x.cy.ace',
    category: 'cyManager',
    when: (s) => proManager(s) && (lastSeason(s, 'pro')?.finish ?? 9) <= 3,
    weight: 4,
    maxPerLife: 2,
    cooldown: 2,
    title: '優勝争いの終盤',
    body: '優勝争いが続く九月、疲れの見えるエースを、間隔を詰めて先発させるかどうかの決断を迫られました。',
    choices: [
      {
        label: 'エースに託す',
        hint: '勝負をかける。故障すれば来季に響く',
        effects: { sat: 2 },
        outcomes: [
          { weight: 1, kind: 'good', text: 'エースは気迫の投球で応え、チームは大事な一戦をものにしました。', effects: { happy: 4, flag: 'cy.aceWin' } },
          { weight: 1, text: 'エースは序盤から打ち込まれ、試合のあとで肘の張りを訴えました。判断が正しかったのか、答えは出ませんでした。', effects: { happy: -4 } },
        ],
      },
      { label: '休ませて、若手を先発させる', effects: { rel: 2 }, outcomes: [{ text: '若手を先発に送り出し、エースには次の登板に備えてもらいました。' }] },
      { label: '投手コーチの意見に従う', flag: 'cy.aceAsk', outcomes: [{ text: '投手コーチの「もう一試合待ちましょう」という言葉を受け入れました。' }] },
    ],
    auto: 2,
  },
  {
    ...C,
    id: 'x.cy.allStar',
    category: 'cyManager',
    // (NPB: the All-Star teams are led by the managers who won the league the year before)
    when: (s) => proManager(s) && prevSeason(s, 'pro')?.age === s.age - 1 && prevSeason(s, 'pro')?.finish === 1,
    weight: 10,
    maxPerLife: 3,
    cooldown: 1,
    outcomes: [{ text: '前の年にリーグを制した監督として、オールスターゲームの指揮を執りました。他球団の主力を並べた打順を考えるのは、楽しい時間でした。', effects: { happy: 4, fame: 1 } }],
  },
  {
    ...C,
    id: 'x.cy.veteran',
    category: 'cyManager',
    when: (s) => proManager(s) && stats(s).filter((x) => x.level === 'pro').length >= 2,
    weight: 3,
    maxPerLife: 2,
    outcomes: [
      { weight: 1, text: '長くチームを支えてきたベテランが、今季限りでの引退を決めました。最後の打席に代打で送り出すと、球場全体が立ち上がりました。', effects: { happy: 3 } },
      { weight: 1, text: '出場の機会が減ったベテランから、起用への不満をぶつけられました。夜遅くまで話し込み、役割を伝え直しました。', effects: { rel: -1, sat: -1 } },
    ],
  },

  // ================================================================ the amateur teams: a high school, a university, a company team
  {
    ...C,
    id: 'x.cy.recruit',
    category: 'cyAmateur',
    when: (s) => hsManager(s) || univManager(s),
    weight: 5,
    maxPerLife: 4,
    cooldown: 3,
    title: '有望な選手の勧誘',
    body: (s) => (univManager(s) ? '全国大会で活躍した高校生に、うちの大学で野球を続けてほしいと思っています。強豪の大学も声をかけているようです。' : '地元の中学で評判の選手がいます。強豪の私立高校も声をかけているようです。'),
    choices: [
      {
        label: '何度も足を運んで、熱心に誘う',
        hint: 'チームが強くなる。ほかの部員への目配りが減る',
        flag: 'cy.recruit',
        effects: { sat: 2, rel: -1 },
        outcomes: [
          { weight: 1, kind: 'good', text: '家にも何度も通い、最後は本人が「この監督のもとでやりたい」と決めてくれました。', effects: { happy: 3 } },
          { weight: 1, text: '最後まで誘い続けましたが、本人は強豪校を選びました。それでも、送り出す言葉をかけることができました。', effects: { happy: -2 } },
        ],
      },
      { label: '今いる部員で、強いチームを作る', effects: { rel: 3, happy: 1 }, outcomes: [{ text: '勧誘には回らず、今いる部員の練習を一人ずつ見て回る時間を増やしました。' }] },
      { label: '本人の選ぶ道に任せる', flag: 'cy.recruitWait', outcomes: [{ text: '話をしに行くのはやめ、本人が自分で決めるのを待つことにしました。' }] },
    ],
    auto: 2,
  },
  {
    ...C,
    id: 'x.cy.fewPlayers',
    category: 'cyAmateur',
    when: (s) => hsManager(s) && !hasFlag(s, 'cy.hsPower'),
    weight: 3,
    maxPerLife: 2,
    cooldown: 5,
    title: '部員が足りない',
    body: '三年生が引退すると、部員が八人になってしまいました。このままでは秋の大会に出られません。',
    choices: [
      {
        label: '近くの学校と、連合チームを組む',
        hint: '大会には出られる。練習の時間を合わせるのが大変',
        effects: { sat: 1, rel: 2 },
        outcomes: [{ text: '近くの高校と合同で練習を始めました。最初はぎこちなかった部員たちも、秋には一つのベンチで声を出していました。' }],
      },
      {
        label: '校内を回って、部員を探す',
        hint: '自分たちだけで出られるかもしれない',
        flag: 'cy.fewSearch',
        effects: { happy: -1 },
        outcomes: [
          { weight: 1, kind: 'good', text: '陸上部とサッカー部をやめた一年生が加わり、ぎりぎり九人がそろいました。', effects: { happy: 4 } },
          { weight: 1, text: '声をかけ続けましたが、部員は増えませんでした。秋の大会は見送り、冬の間は基礎練習を続けました。', effects: { happy: -3 } },
        ],
      },
      { label: '春まで待つ', flag: 'cy.fewWait', outcomes: [{ text: '秋の大会は見送り、春に入ってくる一年生を待つことにしました。' }] },
    ],
    auto: 2,
  },
  {
    ...C,
    id: 'x.cy.heat',
    category: 'cyAmateur',
    when: hsManager,
    weight: 3,
    maxPerLife: 2,
    cooldown: 5,
    title: '真夏の練習',
    body: '連日の猛暑で、練習中に体調を崩す部員が出始めました。大会までの調整をどうするか、決めなければなりません。',
    choices: [
      { label: '練習を朝と夕方に分ける', hint: '安全が第一。練習の量は減る', effects: { rel: 2, sat: 1 }, outcomes: [{ text: '日中は教室で戦術の勉強に充て、グラウンドに出るのは涼しい時間だけにしました。' }] },
      {
        label: '水分と休憩を増やして、量は保つ',
        hint: '鍛えられる。無理が出るかもしれない',
        effects: { sat: 2 },
        outcomes: [
          { weight: 2, text: '休憩のたびに声をかけ、顔色を確かめながら、予定どおりの練習をやり切りました。', effects: { happy: 1 } },
          { weight: 1, kind: 'bad', text: '練習の終わりに部員が倒れ、救急車を呼びました。大事には至りませんでしたが、練習のやり方を根本から見直しました。', effects: { happy: -5, rel: -2 } },
        ],
      },
      { label: '例年どおりに進める', flag: 'cy.heatSame', outcomes: [{ text: '大きくは変えず、例年と同じ予定で夏の大会に備えました。' }] },
    ],
    auto: 2,
  },
  {
    ...C,
    id: 'x.cy.drafted',
    category: 'cyAmateur',
    when: (s) => (hsManager(s) || univManager(s) || corpManager(s)) && tenure(s, 3),
    weight: (s) => 1 + 2 * ((hasFlag(s, 'cy.recruit') ? 1 : 0) + (hasFlag(s, 'cy.hsPower') ? 1 : 0)),
    maxPerLife: 4,
    cooldown: 3,
    outcomes: [
      { weight: 1, kind: 'good', key: true, text: '教え子が、プロ野球のドラフト会議で指名されました。指名のあいさつに来た球団の人の前で、本人より先に涙がこぼれました。', effects: { happy: 8, sat: 4, achieve: '教え子がプロ入り' } },
      { weight: 1, text: '教え子が志望届を出しましたが、ドラフト会議で名前は呼ばれませんでした。社会人で野球を続ける道を、一緒に探しました。', effects: { happy: -2, rel: 2 } },
    ],
  },
  {
    ...C,
    id: 'x.cy.parents',
    category: 'cyAmateur',
    when: hsManager,
    weight: 2,
    maxPerLife: 2,
    cooldown: 5,
    outcomes: [
      { weight: 1, text: '保護者会が、雨でも練習できるようにと、室内練習場の資金を集めてくれました。完成の日、部員と一緒に頭を下げました。', effects: { happy: 4, rel: 3 } },
      { weight: 1, text: '起用をめぐって一部の保護者から強い不満が寄せられ、校長を交えた話し合いの場が何度も持たれました。', effects: { happy: -3, sat: -2 } },
    ],
  },
  {
    ...C,
    id: 'x.cy.hsPower',
    category: 'cyAmateur',
    ages: [32, 62],
    when: (s) => hsManager(s) && !hasFlag(s, 'bbc.teacherCoach') && tenure(s, 4) && !hasFlag(s, 'cy.hsPower'),
    weight: (s) => 1 + ((lastSeason(s, 'hs')?.wins ?? 0) >= 4 || lastSeason(s, 'hs')?.result === 'koshien' ? 3 : 0),
    title: '強豪校からの誘い',
    body: '甲子園の常連の私立高校から、次の監督として来てほしいと誘われました。設備も選手もそろっていますが、勝って当たり前と見られる学校です。',
    choices: [
      { label: '強豪校の監督になる', hint: '甲子園が近くなる。勝てなければ厳しく言われる', flag: 'cy.hsPower', effects: { payScale: 1.2, rel: -2 }, outcomes: [{ text: '寮のある新しい学校で、全国から集まった部員たちの前に立ちました。' }] },
      { label: '今の学校で甲子園を目指す', effects: { rel: 3, happy: 2 }, outcomes: [{ text: '誘いを断ったと聞いた部員たちが、その日の練習の終わりに、黙ってグラウンドを整えてくれていました。' }] },
      { label: 'しばらく考える', flag: 'cy.hsPowerWait', outcomes: [{ text: '答えを出せないうちに、その学校の監督には別の人が決まりました。' }] },
    ],
    auto: 2,
  },
  {
    ...C,
    id: 'x.cy.nextLevel',
    category: 'cyAmateur',
    ages: [35, 63],
    when: (s) => hsManager(s) && !hasFlag(s, 'bbc.teacherCoach') && tenure(s, 6) && rank(s) >= 5,
    weight: 2,
    title: '大学と社会人からの話',
    body: '高校で実績を重ねるうち、大学の野球部と、社会人の企業チームの両方から、監督として来てほしいという話が届きました。',
    choices: [
      { label: '大学の野球部の監督になる', hint: 'リーグ戦と全国大会を戦う。学生を社会に送り出す', flag: 'bbc.univCoach', effects: { title: '大学野球部の監督', payScale: 1.1 }, outcomes: [{ text: 'キャンパスの奥のグラウンドで、高校とはまた違う、体のできあがった選手たちを前にしました。' }] },
      { label: '社会人チームの監督になる', hint: '都市対抗を目指す。会社の看板を背負う', flag: 'bbc.corpCoach', effects: { title: '社会人チームの監督', payScale: 1.2 }, outcomes: [{ text: '会社の名前の入ったユニフォームを渡され、昼は社員として、夕方からは監督として働く毎日が始まりました。' }] },
      { label: '高校野球に残る', flag: 'cy.stayHs', effects: { rel: 2 }, outcomes: [{ text: '高校生と過ごす時間が自分には合っていると考え、どちらの話も断りました。' }] },
    ],
    auto: 2,
  },
]

/** the scenes, as events of their own kind: drawn only by runCoachingPass (events.ts leaves out an event with a pack) */
export const COACHING_EVENTS: EventDef[] = COACHING_SPECS.map((x) => ({ ...compileSpec(x), pack: 'coaching' }))

/** the scenes a coach of this kind may meet */
const KIND_CATS = { proCoach: ['cyPro'], proManager: ['cyManager'], amateur: ['cyAmateur'] } as const

// ---------------------------------------------------------------- the seasons (game assumptions, stat coachSeasonModel)

/**
 * an NPB club's season by its place (1–6): the share of wins, a game assumption of the order of NPB's (a champion near .580, the last
 * club near .430); the place comes from the club's strength against five rivals
 */
export const PRO_WINPCT = [0.58, 0.535, 0.505, 0.485, 0.46, 0.43]
/** the Climax Series: the first club reaches the Japan Series three times in four, the second and the third one time in eight each */
export const PRO_SERIES = [0.75, 0.125, 0.125, 0, 0, 0]
/** the chance he leaves the bench after a season, by place (dismissed or resigning; more after five years) */
export const PRO_EXIT = [0.03, 0.05, 0.08, 0.18, 0.3, 0.45]
/** Koshien: of the 3,746 schools (jpHsSchools), 49 play in the summer and 32 in the spring (jpKoshien) */
export const HS_SCHOOLS = 3746
export const KOSHIEN_SUMMER = 49 / HS_SCHOOLS
export const KOSHIEN_SPRING = 32 / HS_SCHOOLS
/** a prefectural tournament by the rounds won (the seventh would be the title: Koshien) */
const ROUND_WORDS = ['初戦で敗れました', '2回戦で敗れました', '3回戦で敗れました', 'ベスト16でした', 'ベスト8でした', 'ベスト4でした', '決勝で敗れました']
/** summer Koshien (49 schools: six wins for the title) by the wins */
const KOSHIEN_WORDS = ['初戦で敗れました', '2回戦で敗れました', '3回戦で敗れました', 'ベスト8まで勝ち進みました', 'ベスト4まで勝ち進みました', '決勝まで勝ち進みました', '優勝を果たしました']
/** a national tournament of about 32 teams (センバツ, the university championship, the 都市対抗: five wins for the title) by the wins */
const FIVE_WORDS = ['初戦で敗れました', '2回戦で敗れました', 'ベスト8まで勝ち進みました', 'ベスト4まで勝ち進みました', '決勝まで勝ち進みました', '優勝を果たしました']

const record = (s: LifeState) => (s.coaching ??= { seasons: [] })
const nth = (s: LifeState, level: CoachLevel) => stats(s).filter((x) => x.level === level).length + 1
const push = (s: LifeState, x: CoachSeason) => record(s).seasons.push(x)

function achieve(s: LifeState, a: string) {
  applyEffect(s, { achieve: a })
}

/** he leaves the bench: the job ends, and a year later the old club's commentary booth or the boys' team (baseballCareer.ts x.bbc.afterBench) */
function leaveBench(s: LifeState) {
  applyEffect(s, { job: 'quit', flag: 'bbc.leftBench', happy: -3 })
  ;(s.due ??= []).push({ id: 'x.bbc.afterBench', age: s.age + 1, until: s.age + 3, from: 'coaching' })
}

/** the season of the NPB club he manages */
function proSeasonOf(c: EventCtx) {
  const s = c.s
  const r = c.rng
  const rec = record(s)
  // (the club's strength: a random walk; a reinforcement helps at once, young players chosen two years ago help now)
  const lift = (flagAge(s, 'cy.reinforce') <= 1 ? 0.3 : 0) + (flagAge(s, 'cy.youth') >= 2 && flagAge(s, 'cy.youth') <= 5 ? 0.25 : 0) + (flagAge(s, 'cy.draftWon') <= 3 ? 0.1 : 0)
  rec.st = clamp(0.6 * (rec.st ?? 0.3 * r.normal()) + 0.25 * r.normal() + lift, -1.5, 1.5)
  const me = rec.st + 0.6 * r.normal()
  let finish = 1
  for (let k = 0; k < 5; k++) if (0.68 * r.normal() > me) finish++
  const d = r.int(0, 4)
  const pct = clamp(PRO_WINPCT[finish - 1] + 0.015 * r.normal(), 0.33, 0.68)
  const w = Math.round(pct * (143 - d))
  const l = 143 - d - w
  const n = nth(s, 'pro')
  const series = r.chance(PRO_SERIES[finish - 1])
  const champion = series && r.chance(0.5)
  const result = champion ? 'champion' : series ? 'series' : finish === 1 ? 'league' : undefined
  push(s, { age: s.age, level: 'pro', finish, w, l, d, ...(result ? { result } : {}) })
  const line = `${w}勝${l}敗${d}分`
  if (finish === 1) {
    c.add('big', `監督${n}年目、リーグ優勝を果たしました（${line}）。胴上げで、夜空が何度も近づきました。`, { key: true, statIds: ['coachSeasonModel'] })
    achieve(s, '監督としてリーグ優勝')
    scalePay(s, 1.1)
  } else c.add(finish <= 3 ? 'good' : finish === 6 ? 'bad' : 'normal', `監督${n}年目は、リーグ${finish}位でした（${line}）。`, { statIds: ['coachSeasonModel'] })
  if (series) {
    c.add('good', finish === 1 ? 'クライマックスシリーズを勝ち抜き、日本シリーズに進みました。' : `リーグ${finish}位からクライマックスシリーズを勝ち上がり、日本シリーズに進みました。`, { statIds: ['coachSeasonModel'] })
    if (champion) {
      c.add('big', '日本シリーズを制し、日本一になりました。ビールかけの輪の真ん中で、選手たちにもみくちゃにされました。', { key: true, statIds: ['coachSeasonModel'] })
      achieve(s, '監督として日本一')
      applyEffect(s, { fame: 4, happy: 6 })
    } else c.add('normal', '日本シリーズでは敗れ、日本一にはあと一歩届きませんでした。', { statIds: ['coachSeasonModel'] })
  }
  // the totals: a milestone of the record kept in the game
  const wins = stats(s).filter((x) => x.level === 'pro').reduce((a, x) => a + (x.w ?? 0), 0)
  for (const m of [500, 1000]) if (wins >= m && wins - w < m) c.add('big', `監督として通算${m}勝に到達しました（ゲーム内の記録）。`, { key: true })
  // after the season: the end of his time on the bench (more likely after a bad place, after five years, and at 66 or more)
  const exit = s.age >= 66 ? 1 : PRO_EXIT[finish - 1] + 0.04 * Math.max(0, n - 5)
  if (r.chance(exit)) {
    c.add(finish >= 4 ? 'bad' : 'milestone', s.age >= 66 || finish <= 3 ? `監督を${n}年務め、このシーズン限りで勇退しました。` : `成績不振の責任を取り、監督を退任しました（${n}年）。`, { key: true, statIds: ['coachSeasonModel'] })
    leaveBench(s)
  }
}

/** a high school's strength for the year (the years he has led it, his method, the recruits, a strong private school) */
function hsStrength(c: EventCtx): number {
  const s = c.s
  const since = Math.min(flagAge(s, 'bbc.amCoach'), flagAge(s, 'bbc.teacherCoach'))
  const years = Number.isFinite(since) ? since : 0
  return (
    -0.4 +
    Math.min(1, 0.08 * years) +
    (hasFlag(s, 'bbc.strict') || hasFlag(s, 'bbc.free') ? 0.15 : 0) +
    (flagAge(s, 'cy.recruit') <= 3 ? 0.3 : 0) +
    (hasFlag(s, 'cy.hsPower') ? 0.8 : 0) +
    (hasFlag(s, 'cy.studied') ? 0.1 : 0) +
    0.4 * c.rng.normal()
  )
}

/** wins in a row, each with this chance, up to the most */
function run(c: EventCtx, p: number, most: number): number {
  let k = 0
  while (k < most && c.rng.chance(p)) k++
  return k
}

/** a high school's spring (センバツ, rarely) and summer: the prefectural rounds or Koshien and its rounds */
function hsSeasonOf(c: EventCtx) {
  const s = c.s
  const st = hsStrength(c)
  const n = nth(s, 'hs')
  const lift = Math.exp(1.2 * st)
  const pWin = clamp(0.45 + 0.08 * st, 0.3, 0.65)
  // spring: センバツ
  let spring: number | undefined
  if (c.rng.chance(KOSHIEN_SPRING * lift)) {
    const k = run(c, pWin, 5)
    spring = k
    c.add(k >= 5 ? 'big' : 'good', `監督${n}年目の春、センバツに選ばれ、甲子園で${FIVE_WORDS[k]}。`, { key: true, statIds: ['jpKoshien', 'coachSeasonModel'] })
    achieve(s, '監督として甲子園')
    if (k >= 5) achieve(s, '監督として甲子園優勝')
  }
  // summer: the prefectural tournament, and Koshien for its winner
  if (c.rng.chance(KOSHIEN_SUMMER * lift)) {
    const k = run(c, pWin, 6)
    push(s, { age: s.age, level: 'hs', result: 'koshien', wins: k, ...(spring !== undefined ? { spring } : {}) })
    c.add(k >= 6 ? 'big' : 'good', `監督${n}年目の夏、県大会を勝ち抜いて甲子園に出場し、${KOSHIEN_WORDS[k]}。`, { key: true, statIds: ['jpKoshien', 'coachSeasonModel'] })
    achieve(s, '監督として甲子園')
    if (k >= 6) {
      achieve(s, '監督として甲子園優勝')
      applyEffect(s, { fame: 6, happy: 10 })
    }
  } else {
    const k = run(c, clamp(0.5 + 0.12 * st, 0.25, 0.85), 6)
    push(s, { age: s.age, level: 'hs', wins: k, ...(spring !== undefined ? { spring } : {}) })
    c.add(k >= 4 ? 'good' : 'normal', `監督${n}年目の夏、県大会は${ROUND_WORDS[k]}。`, { statIds: ['coachSeasonModel'] })
  }
}

/** a university's season: its league (six teams) and, for the champion, the national championship (全日本大学野球選手権) */
function univSeasonOf(c: EventCtx) {
  const s = c.s
  const st = -0.2 + Math.min(0.8, 0.08 * Math.max(0, flagAge(s, 'bbc.univCoach'))) + (flagAge(s, 'cy.recruit') <= 3 ? 0.3 : 0) + 0.45 * c.rng.normal()
  let finish = 1
  for (let k = 0; k < 5; k++) if (0.7 * c.rng.normal() > st) finish++
  const n = nth(s, 'univ')
  if (finish === 1) {
    const k = run(c, 0.5, 5)
    push(s, { age: s.age, level: 'univ', finish, result: 'league', wins: k })
    c.add(k >= 5 ? 'big' : 'good', `監督${n}年目、リーグ戦で優勝し、全日本大学野球選手権では${FIVE_WORDS[k]}。`, { key: k >= 5, statIds: ['coachSeasonModel'] })
    achieve(s, '監督として大学のリーグ優勝')
    if (k >= 5) achieve(s, '監督として大学日本一')
  } else {
    push(s, { age: s.age, level: 'univ', finish })
    c.add(finish === 2 ? 'good' : 'normal', `監督${n}年目のリーグ戦は、6校中${finish}位でした。`, { statIds: ['coachSeasonModel'] })
  }
}

/** a company team's season: the 都市対抗 (some one team in ten plays it: a game assumption) and its rounds */
function corpSeasonOf(c: EventCtx) {
  const s = c.s
  const st = -0.1 + Math.min(0.8, 0.08 * Math.max(0, flagAge(s, 'bbc.corpCoach'))) + 0.45 * c.rng.normal()
  const n = nth(s, 'corp')
  if (c.rng.chance(clamp(0.1 * Math.exp(1.2 * st), 0.02, 0.6))) {
    const k = run(c, 0.5, 5)
    push(s, { age: s.age, level: 'corp', result: 'toshi', wins: k })
    c.add(k >= 5 ? 'big' : 'good', `監督${n}年目、都市対抗野球の出場を決め、東京ドームで${FIVE_WORDS[k]}。`, { key: k >= 5, statIds: ['coachSeasonModel'] })
    achieve(s, '監督として都市対抗出場')
    if (k >= 5) achieve(s, '監督として都市対抗優勝')
  } else {
    push(s, { age: s.age, level: 'corp' })
    c.add('normal', `監督${n}年目は、都市対抗野球の予選で敗れ、本大会には届きませんでした。`, { statIds: ['coachSeasonModel'] })
  }
}

// ---------------------------------------------------------------- the pass

/** the chance of a scene in a year of coaching, and of a second */
export const COACH_SCENES = [0.75, 0.25]

function eligible(reg: EventRegistry, s: LifeState, cats: readonly string[]): EventDef[] {
  const hist = s.evHist ?? {}
  const stage = stageOf(s)
  return reg.all().filter((d) => {
    if (d.pack !== 'coaching' || !cats.includes(d.category) || !d.stages.includes(stage)) return false
    if (d.ages && (s.age < d.ages[0] || s.age > d.ages[1])) return false
    const h = hist[d.id]
    if (h && (h[1] >= (d.maxPerLife ?? 1) || s.age - h[0] < (d.cooldown ?? 3))) return false
    if (d.when && !d.when(s)) return false
    return weightOf(d, s) > 0
  })
}

/**
 * The coach's year (after the year's other passes, on its own stream): the offer of the year he retires; then, while he coaches,
 * the season of the team he manages and a scene or two of his kind. Nothing for a life that does not coach.
 */
export function runCoachingPass(reg: EventRegistry, c: EventCtx): string[] {
  const s = c.s
  if (!s.alive || !jp(s)) return []
  const ran: string[] = []
  const run1 = (d: EventDef) => {
    markSeen(s, d.id)
    ran.push(d.id)
    d.run(tagged(c, d))
  }
  // the way in: the year he retires from an NPB club's first team (asked whatever the year's other questions: the year after
  // baseball is often full of them, the job search and the like; it takes no room from them)
  const offer = eligible(reg, s, ['cyEntry'])
  if (offer.length && (c.askAlways || c.canAsk())) {
    const d = offer[0]
    markSeen(s, d.id)
    ran.push(d.id)
    const t = tagged(c, d)
    d.run(c.askAlways ? { ...t, ask: (q, data) => c.askAlways!(q, data) } : t)
    return ran
  }
  const kind = coachKind(s)
  if (!kind) return ran
  // the season of the team he manages (an NPB club, a high school, a university, a company team)
  if (kind === 'proManager') proSeasonOf(c)
  else if (univManager(s)) univSeasonOf(c)
  else if (corpManager(s)) corpSeasonOf(c)
  else if (hsManager(s)) hsSeasonOf(c)
  if (coachKind(s) !== kind) return ran
  // a scene or two of his kind
  let n = c.rng.chance(COACH_SCENES[0]) ? 1 : 0
  if (n === 1 && c.rng.chance(COACH_SCENES[1])) n++
  for (let k = 0; k < n; k++) {
    const pool = eligible(reg, s, KIND_CATS[kind]).filter((d) => !ran.includes(d.id) && !(d.resolve && !c.canAsk()))
    if (!pool.length) break
    run1(c.rng.weighted(pool, pool.map((d) => weightOf(d, s))))
  }
  return ran
}

/** the record of his years on the bench, for the result screen: the teams he managed and what they won */
export function coachingSummary(s: LifeState) {
  const seasons = stats(s)
  if (!seasons.length) return undefined
  const by = (level: CoachLevel) => seasons.filter((x) => x.level === level)
  const pro = by('pro')
  return {
    pro: pro.length
      ? {
          years: pro.length,
          w: pro.reduce((a, x) => a + (x.w ?? 0), 0),
          l: pro.reduce((a, x) => a + (x.l ?? 0), 0),
          d: pro.reduce((a, x) => a + (x.d ?? 0), 0),
          league: pro.filter((x) => x.finish === 1).length,
          champion: pro.filter((x) => x.result === 'champion').length,
        }
      : undefined,
    hs: by('hs').length
      ? {
          years: by('hs').length,
          koshien: by('hs').filter((x) => x.result === 'koshien').length + by('hs').filter((x) => x.spring !== undefined).length,
          won: by('hs').filter((x) => (x.result === 'koshien' && (x.wins ?? 0) >= 6) || (x.spring ?? 0) >= 5).length,
        }
      : undefined,
    univ: by('univ').length ? { years: by('univ').length, league: by('univ').filter((x) => x.finish === 1).length } : undefined,
    corp: by('corp').length ? { years: by('corp').length, toshi: by('corp').filter((x) => x.result === 'toshi').length } : undefined,
  }
}
