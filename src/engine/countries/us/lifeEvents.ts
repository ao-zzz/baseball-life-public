import { rotate, type EventCtx, type EventDef } from '../../events.ts'
import type { LifeState } from '../../types.ts'
import { clamp } from '../../math.ts'
import { US_DATING_FLAG, US_PARTNER_NAMES } from '../../../data/us.ts'
import { livesIn } from '../index.ts'
import { US_THEME } from './daily.ts'
import { hasGrandkids } from '../../events/spec.ts'
import { moveToOneOf, moveUnknown } from '../../place.ts'

/** the warm states a retired man moves to (the sun belt: a game's choice of places, not a statistic) */
const WARM_STATES = ['フロリダ州', 'アリゾナ州', 'テキサス州', 'ネバダ州', 'カリフォルニア州', 'ニューメキシコ州', 'サウスカロライナ州', 'ジョージア州', 'ハワイ州']

// Daily life of a man who lives in the US after baseball (PROJECT_PLAN §11.35). Three kinds, told apart in the `kind` of each entry:
//   arranged  - an event of Japan's catalog (afterEvents.ts, lifeStories.ts) written again for the US: the money, the system and the
//               wording are the US's
//   native    - something only this country has (its health insurance, its holidays, its college sports ties)
// (the events across a border are in lifeAbroadEvents.ts: they ask where he lives and plays, not where he was born)
// Every event asks `livesIn(s, 'US')` (where he lives now), and `country: 'US'` keeps them out of every other model's catalog.
// They are ordinary catalog events (the same draw, cooldown and limits as Japan's), so a screen life and the headless life of the
// same man meet the same ones, with the same おまかせ answers (fixed, or a function of the state). The chances and the sums of
// money are game assumptions, not statistics; the systems named (health insurance through a job, a retirement savings plan, college
// costs) are described in general terms only, without figures. All texts are original.

export type UsEventKind = 'arranged' | 'native'
/** which kind each event of this file is (the report and the tests read this) */
export const US_LIFE_KINDS: Record<string, UsEventKind> = {
  'us.insurance': 'native',
  'us.retirementPlan': 'arranged',
  'us.thanksgiving': 'native',
  'us.kidCollege': 'arranged',
  'us.divorce': 'arranged',
  'us.remeet': 'arranged',
  'us.homecoming': 'native',
  'us.coachOffer': 'arranged',
  'us.broadcast': 'arranged',
  'us.medicare': 'native',
  'us.familyVisit': 'arranged',
  'us.retireMove': 'native',
  'us.grandchild': 'arranged',
}

const here = (s: LifeState) => livesIn(s, 'US')
const working = (s: LifeState) => !!s.after?.work && !s.after.retired
const taken = (s: LifeState, f: string) => s.taken.includes(f)
const mark = (s: LifeState, f: string) => {
  if (!taken(s, f)) s.taken.push(f)
}

function bump(c: EventCtx, o: { happy?: number; rel?: number; know?: number; money?: number }) {
  const st = c.s.status
  if (o.happy) st.happiness = clamp(st.happiness + o.happy, 5, 100)
  if (o.rel) st.relations = clamp(st.relations + o.rel, 5, 100)
  if (o.know) st.knowledge = clamp(st.knowledge + o.know, 1, 99)
  if (o.money) c.s.money += o.money
}

const US: EventDef[] = [
  // ------------------------------------------------------------ native: health insurance through a job
  {
    id: 'us.insurance',
    category: 'usHealthcare',
    country: 'US',
    stages: ['adult'],
    ages: [26, 64],
    when: (s) => here(s) && working(s),
    weight: 2,
    cooldown: 6,
    maxPerLife: 2,
    run: (c) =>
      c.ask({
        id: 'us.insurance',
        weight: 'minor',
        title: '医療保険の更新',
        body: '勤め先の医療保険の更新の時期です。保険料の自己負担分が上がり、窓口で払う額も変わるという案内が届きました。',
        choices: [{ label: '勤め先の団体保険を、そのまま続ける' }, { label: '自分で保険を探し直し、保険料と自己負担を比べる', hint: '手間がかかる' }, { label: '保険料の安い、自己負担の大きい保険にして、貯金で備える' }],
        autoIndex: 0,
      }),
    resolve: (c, choice) => {
      if (choice === 0) {
        bump(c, { money: -20 })
        c.add('decision', '勤め先の保険を続けることにしました。保険料の天引きが、少し増えました。')
      } else if (choice === 1) {
        bump(c, { money: -10, know: 2 })
        c.add('decision', '何社もの保険を見比べ、夜遅くまで表を作りました。結局、補償の厚い保険を選び直しました。')
      } else if (c.rng.chance(0.25)) {
        bump(c, { money: -150, happy: -3 })
        c.add('bad', '年の途中で思わぬ通院があり、自己負担の上限まで払うことになりました。貯金が目に見えて減りました。')
      } else {
        bump(c, { money: 25 })
        c.add('good', '大きな病気もなく、保険料の差額だけ、貯金が増えました。')
      }
    },
  },
  // ------------------------------------------------------------ arranged: a retirement savings plan (Japan: x.life.invest)
  {
    id: 'us.retirementPlan',
    category: 'usMoney',
    country: 'US',
    stages: ['adult'],
    ages: [26, 60],
    when: (s) => here(s) && working(s) && s.money >= 100 && !taken(s, 'us.retirementPlan'),
    weight: 2,
    maxPerLife: 1,
    run: (c) =>
      c.ask({
        id: 'us.retirementPlan',
        weight: 'minor',
        title: '老後の積み立て',
        body: '勤め先から、老後に備える積み立ての制度の案内が届きました。会社が上乗せしてくれる分もあるといいます。',
        choices: [{ label: '上乗せが受けられる額まで、毎月積み立てる' }, { label: '少額だけ、始めてみる' }, { label: '今は生活を優先して、見送る' }],
        autoIndex: 0,
      }),
    resolve: (c, choice) => {
      mark(c.s, 'us.retirementPlan')
      if (choice === 0) {
        bump(c, { money: -60, know: 1 })
        c.add('decision', '給与から毎月の積み立てを天引きにしました。手取りは減りましたが、通帳には見えないところで残高が増えていきます。')
      } else if (choice === 1) {
        bump(c, { money: -20 })
        c.add('decision', 'まずは小さな金額から、積み立てを始めました。')
      } else c.add('decision', '手取りが減るのが不安で、案内は見送りました。')
    },
  },
  // ------------------------------------------------------------ native: Thanksgiving
  {
    id: 'us.thanksgiving',
    category: 'usHoliday',
    country: 'US',
    stages: ['adult', 'senior'],
    ages: [22, 95],
    when: (s) => here(s),
    weight: 1.2,
    cooldown: 4,
    maxPerLife: 5,
    run: (c) => {
      const s = c.s
      const family = s.family.spouse || s.family.children > 0
      bump(c, { happy: 2, rel: 1 })
      c.add(
        'good',
        family
          ? rotate(s, 'us.thanksgiving', ['感謝祭の日、家族みんなで食卓を囲みました。七面鳥を切り分けるのは、毎年のようにぎこちない役目です。', '感謝祭に、親戚が集まりました。食後はテレビでフットボールを見ながら、野球の話に花が咲きました。'])
          : rotate(s, 'us.thanksgiving', ['感謝祭は、友人の家に招かれました。持ち寄りの料理が食卓にあふれていました。', '感謝祭の連休に、実家へ帰りました。食卓には、昔と同じパイが並んでいました。']),
      )
    },
  },
  // ------------------------------------------------------------ arranged: a child leaves for college (Japan: family.kidLeave)
  {
    id: 'us.kidCollege',
    category: 'usKids',
    country: 'US',
    stages: ['adult', 'senior'],
    when: (s) => here(s) && (s.family.kids ?? []).some((k, i) => (k === 17 || k === 18) && !taken(s, `us.kidCollege.${i}`)),
    weight: 3,
    cooldown: 1,
    maxPerLife: 3,
    run: (c) => {
      const kids = c.s.family.kids ?? []
      const i = kids.findIndex((k, j) => (k === 17 || k === 18) && !taken(c.s, `us.kidCollege.${j}`))
      if (i < 0) return
      mark(c.s, `us.kidCollege.${i}`)
      c.ask(
        {
          id: 'us.kidCollege',
          weight: 'major',
          title: '子どもの進学と学費',
          body: kids.length > 1 ? `${i === 0 ? '上の子' : '下の子'}が大学に進むことになりました。学費の工面を、家族で話し合う時期です。` : '子どもが大学に進むことになりました。学費の工面を、家族で話し合う時期です。',
          choices: [{ label: '貯金から、学費をできるだけ出す', hint: '子どもの負担は軽いが、貯金が大きく減る' }, { label: '奨学金とアルバイトを組み合わせ、本人と分担する' }, { label: '本人が学生ローンを借りて、卒業後に返す' }],
          // おまかせ: pays from savings when he can (a function of the state)
          autoIndex: c.s.money >= 300 ? 0 : 1,
        },
        { kid: i },
      )
    },
    resolve: (c, choice) => {
      if (choice === 0) {
        bump(c, { money: -150, rel: 2, happy: 2 })
        c.add('decision', '貯金から学費を出すことにしました。子どもは何度も礼を言い、寮の部屋へ荷物を運び込みました。')
      } else if (choice === 1) {
        bump(c, { money: -40, rel: 2 })
        c.add('decision', '奨学金の書類を一緒に書き、子どもは学内のアルバイトを見つけました。')
      } else {
        bump(c, { rel: -1, happy: -1 })
        c.add('decision', '子どもが学生ローンを借りることになりました。返済の見通しを、二人で表にして確かめました。')
      }
    },
  },
  // ------------------------------------------------------------ arranged: a marriage that fails (Japan: life.divorce)
  {
    id: 'us.divorce',
    category: 'usLove',
    country: 'US',
    stages: ['adult'],
    ages: [28, 60],
    when: (s) => here(s) && !!s.family.spouse && s.family.spouse.years >= 3,
    weight: (s) => 0.3 * (s.status.relations < 40 ? 2.2 : s.status.relations < 55 ? 1.2 : 0.6),
    cooldown: 5,
    maxPerLife: 2,
    run: (c) =>
      c.ask({
        id: 'us.divorce',
        weight: 'major',
        title: 'すれ違いの果てに',
        body: `${c.s.family.spouse!.name}さんとの会話が減り、同じ家にいても、別々の時間を過ごすようになりました。`,
        choices: [{ label: '夫婦のカウンセリングを受け、立て直す', hint: '時間と費用がかかる' }, { label: '離婚を決める' }],
        autoIndex: 0,
      }),
    resolve: (c, choice) => {
      const sp = c.s.family.spouse
      if (!sp) return
      if (choice === 0) {
        bump(c, { money: -30, rel: 3, happy: 3 })
        c.add('good', `${sp.name}さんと一緒にカウンセリングに通いました。少しずつ、話せることが増えていきました。`)
      } else {
        const f = c.s.family
        f.spouse = null
        f.ended = 'divorce'
        f.endedAge = c.s.age
        bump(c, { happy: -12, rel: -4, money: -(300 + 80 * f.children) })
        c.add('big', `${sp.name}さんと離婚しました。弁護士費用と財産の分け方の話し合いで、貯金が減りました。${f.children ? '子どもとは、会う日を決めて過ごすことになりました。' : ''}`, { key: true })
      }
    },
  },
  // ------------------------------------------------------------ arranged: a new start after a divorce or a bereavement (Japan: love.meet)
  {
    id: 'us.remeet',
    category: 'usLove',
    country: 'US',
    stages: ['adult'],
    ages: [26, 60],
    when: (s) =>
      here(s) &&
      !s.family.spouse &&
      !s.family.partner &&
      !!s.family.ended &&
      s.age - (s.family.endedAge ?? -99) >= (s.family.ended === 'death' ? 2 : 1),
    weight: 2,
    cooldown: 2,
    maxPerLife: 3,
    run: (c) => {
      const name = c.rng.pick(US_PARTNER_NAMES)
      c.ask(
        {
          id: 'us.remeet',
          weight: 'minor',
          title: '新しい出会い',
          body: `友人の紹介で、${name}さんと知り合いました。話してみると、気が合うことが分かりました。`,
          choices: [{ label: '食事に誘ってみる' }, { label: '今は一人の時間を大切にする' }],
          autoIndex: c.rng.chance(0.6) ? 0 : 1,
        },
        { name },
      )
    },
    resolve: (c, choice, d) => {
      if (choice === 0 && c.rng.chance(clamp(0.5 + (c.s.status.relations - 50) / 100, 0.2, 0.85))) {
        c.s.family.partner = String(d.name)
        ;(c.s.flags ??= {})[US_DATING_FLAG] = c.s.age
        bump(c, { happy: 6 })
        c.add('good', `${d.name}さんと付き合い始めました。`)
      } else if (choice === 0) {
        bump(c, { happy: -2 })
        c.add('decision', '食事には行きましたが、友人のままでいることになりました。')
      } else c.add('decision', '今は一人の時間を大切にしたいと、丁寧に伝えました。')
    },
  },
  // ------------------------------------------------------------ native: homecoming at the college he played for
  {
    id: 'us.homecoming',
    category: 'usSchool',
    country: 'US',
    stages: ['adult', 'senior'],
    ages: [30, 75],
    // the college he played at (what he went to), not the country: a life that never played college ball does not meet it
    when: (s) => here(s) && s.timeline.some((t) => t.phase === 'univ') && !!s.schools?.univ,
    weight: 1.2,
    cooldown: 6,
    maxPerLife: 3,
    run: (c) =>
      c.ask({
        id: 'us.homecoming',
        weight: 'minor',
        title: `${c.s.schools?.univ?.name ?? '母校'}の同窓会`,
        body: 'ホームカミングの案内が届きました。母校の試合を観て、昔のチームメイトと会える催しです。',
        choices: [{ label: '観戦に行き、元チームメイトと再会する' }, { label: '野球部の後援会に寄付をする' }, { label: '今年は行かない' }],
        autoIndex: 0,
      }),
    resolve: (c, choice) => {
      if (choice === 0) {
        bump(c, { rel: 3, happy: 3, money: -10 })
        c.add('good', '観客席で肩を組んで校歌を歌い、昔のチームメイトと夜遅くまで話し込みました。')
      } else if (choice === 1) {
        bump(c, { money: -80, happy: 1 })
        c.add('decision', '後援会に寄付をしました。後日、グラウンドの新しい設備の写真が届きました。')
      } else c.add('decision', '仕事の予定が合わず、今年は見送りました。')
    },
  },
  // ------------------------------------------------------------ arranged: a job in baseball after playing (Japan: x.second.coachOffer)
  {
    id: 'us.coachOffer',
    category: 'usAfterWork',
    country: 'US',
    stages: ['adult'],
    ages: [26, 55],
    // a man who played beyond high school and stopped within the last ten years
    when: (s) => here(s) && s.career.highestRank >= 5 && s.career.endedAge !== null && s.age - s.career.endedAge <= 10 && !taken(s, 'us.coachOffer'),
    weight: (s) => (s.career.highestRank >= 8 ? 3.5 : 2.5),
    maxPerLife: 1,
    run: (c) =>
      c.ask({
        id: 'us.coachOffer',
        weight: 'major',
        title: '野球の仕事の誘い',
        body: 'かつての監督から連絡がありました。「若い選手に教える気はないか」という誘いです。野球界に残る道が、まだ開いています。',
        choices: [{ label: '高校のアシスタントコーチになる', hint: '教える立場に。収入は多くない' }, { label: '大学野球部のスタッフとして働く', hint: '長時間で低賃金だが、プロや大学の指導者への道が開ける' }, { label: '野球から離れて、別の仕事に専念する' }],
        // おまかせ: stays in baseball if he got far enough and has no other work yet (a function of the state)
        autoIndex: working(c.s) ? 2 : c.s.career.highestRank >= 7 ? 1 : 0,
      }),
    resolve: (c, choice) => {
      mark(c.s, 'us.coachOffer')
      if (choice === 0) {
        bump(c, { happy: 3, rel: 2, money: 15 })
        c.add('decision', '高校の野球部で、アシスタントコーチを始めました。放課後のグラウンドで、自分の高校時代と同じ顔をした選手たちを教えています。', { key: true })
      } else if (choice === 1) {
        bump(c, { happy: 2, rel: 3, money: 5, know: 1 })
        c.add('decision', '大学の野球部のスタッフになりました。遠征のバスで、ビデオの整理と選手の面談に追われる毎日です。', { key: true })
      } else {
        bump(c, { know: 1 })
        c.add('decision', '野球の誘いは丁重に断り、別の仕事に専念することにしました。')
      }
    },
  },
  // ------------------------------------------------------------ arranged: a voice on the air (Japan: x.second.broadcast)
  {
    id: 'us.broadcast',
    category: 'usAfterMedia',
    country: 'US',
    stages: ['adult'],
    ages: [30, 62],
    // a man who reached the major leagues, and has stopped
    when: (s) => here(s) && s.career.highestRank >= 8 && s.career.endedAge !== null && !taken(s, 'us.broadcast'),
    weight: 2,
    maxPerLife: 1,
    run: (c) =>
      c.ask({
        id: 'us.broadcast',
        weight: 'minor',
        title: '解説者の依頼',
        body: '地元の放送局から、試合中継の解説者になってほしいと誘われました。元選手の声は、ファンに喜ばれるそうです。',
        choices: [{ label: '解説者として、シーズンを通して契約する' }, { label: '単発の出演だけにする' }, { label: '人前で話すのは苦手なので、断る' }],
        autoIndex: 1,
      }),
    resolve: (c, choice) => {
      mark(c.s, 'us.broadcast')
      if (choice === 0) {
        bump(c, { money: 60, rel: 3, happy: 2 })
        c.add('good', '中継ブースで、選手の目線から配球や守備位置の理由を話しました。視聴者から手紙が届くようになりました。', { key: true })
      } else if (choice === 1) {
        bump(c, { money: 15, rel: 1 })
        c.add('decision', '特別番組に呼ばれ、現役時代の思い出を語りました。放送後、昔の仲間から連絡が来ました。')
      } else c.add('decision', '依頼には、丁重に断りの返事を書きました。')
    },
  },
  // ------------------------------------------------------------ native: public health insurance at 65
  {
    id: 'us.medicare',
    category: 'usAging',
    country: 'US',
    stages: ['adult', 'senior'],
    ages: [64, 66],
    when: (s) => here(s) && !taken(s, 'us.medicare'),
    weight: 6,
    maxPerLife: 1,
    run: (c) =>
      c.ask({
        id: 'us.medicare',
        weight: 'major',
        title: '65歳の医療保険',
        body: '65歳が近づき、高齢者向けの公的な医療保険に入る時期の案内が届きました。いま入るか、勤め先の保険を続けるか、手続きの期限もあります。',
        choices: [{ label: '案内どおり、公的な保険に加入する' }, { label: '働いているうちは勤め先の保険を続け、加入を遅らせる' }, { label: '加入せず、民間の保険だけで済ませる', hint: '保険料は安いが、大きな病気のときの備えが薄くなる' }],
        // おまかせ: enrols when he no longer works (a function of the state)
        autoIndex: working(c.s) ? 1 : 0,
      }),
    resolve: (c, choice) => {
      mark(c.s, 'us.medicare')
      if (choice === 0) {
        bump(c, { money: -10, know: 1 })
        c.add('decision', '窓口で書類を出し、公的な医療保険の加入を済ませました。病院の窓口で払う額が、思ったより少なくなりました。')
      } else if (choice === 1) {
        bump(c, { money: -25 })
        c.add('decision', '加入の時期を遅らせました。手続きの期限を、カレンダーに赤い丸で書き込みました。')
      } else if (c.rng.chance(0.3)) {
        bump(c, { money: -200, happy: -4 })
        c.add('bad', '加入しないまま入院することになり、請求額に青ざめました。貯金が大きく減りました。')
      } else {
        bump(c, { money: 15 })
        c.add('decision', '民間の保険だけで過ごしました。大きな病気もなく、保険料の差額が貯金に残りました。')
      }
    },
  },
  // ------------------------------------------------------------ arranged: the first grandchild (Japan: afterEvents family.grandchild)
  // (the same record, 孫, as Japan's: the visits and the move below and the end of the life read it, instead of guessing from a child's age)
  {
    id: 'us.grandchild',
    category: 'usGrandchild',
    country: 'US',
    stages: ['adult', 'senior'],
    when: (s) => here(s) && (s.family.kids ?? []).some((k) => k >= 26) && !s.career.achievements.includes('孫'),
    weight: 3,
    maxPerLife: 1,
    run: (c) => {
      c.s.career.achievements.push('孫')
      bump(c, { happy: 8 })
      c.add('big', '初孫が生まれました。', { key: true })
    },
  },
  // ------------------------------------------------------------ arranged: the children's families visit (Japan: x.life.grandRole)
  {
    id: 'us.familyVisit',
    category: 'usFamilyVisit',
    country: 'US',
    stages: ['adult', 'senior'],
    ages: [55, 90],
    when: (s) => here(s) && (s.family.kids ?? []).some((k) => k >= 26),
    weight: 2,
    cooldown: 3,
    maxPerLife: 4,
    // (the grandchildren only once his life records them (孫: afterEvents us.grandchild, family.grandchild); before, a grown child comes home)
    run: (c) =>
      c.ask({
        id: 'us.familyVisit',
        weight: 'minor',
        title: hasGrandkids(c.s) ? '子どもの家族の訪問' : '子どもの帰省',
        body: hasGrandkids(c.s) ? '遠くに暮らす子どもの家族が、休暇に泊まりに来ることになりました。孫たちは、庭でのキャッチボールを楽しみにしています。' : '遠くに暮らす子どもが、休暇に泊まりに来ることになりました。久しぶりの、庭でのキャッチボールを楽しみにしてくれています。',
        choices: [{ label: '庭でキャッチボールをして、ゆっくり一緒に過ごす' }, { label: '家族旅行を計画して、費用を出す', hint: '費用はかさむが、思い出が残る' }, { label: '体調を理由に、短い滞在にしてもらう' }],
        autoIndex: 0,
      }),
    resolve: (c, choice) => {
      const grand = hasGrandkids(c.s)
      if (choice === 0) {
        bump(c, { happy: 4, rel: 3 })
        c.add('good', grand ? '庭で孫にグローブの握り方を教えました。夕方まで、ボールの音が響いていました。' : '庭で子どもとキャッチボールをしました。夕方まで、ボールの音が響いていました。')
      } else if (choice === 1) {
        bump(c, { money: -60, happy: 4, rel: 4 })
        c.add('good', grand ? '国立公園へ家族みんなで出かけました。孫たちが焚き火の前で、夢中になって話を聞いてくれました。' : '国立公園へ家族みんなで出かけました。焚き火の前で、子どもと遅くまで話し込みました。')
      } else {
        bump(c, { rel: -1 })
        c.add('decision', `短い滞在になり、別れ際に、${grand ? '孫' : '子ども'}がもう少し居たいと言ってくれました。`)
      }
    },
  },
  // ------------------------------------------------------------ native: where to spend the later years
  {
    id: 'us.retireMove',
    category: 'usHome',
    country: 'US',
    stages: ['adult', 'senior'],
    ages: [60, 78],
    when: (s) => here(s) && s.after?.home !== 'parents' && !taken(s, 'us.retireMove') && (!working(s) || s.age >= 65),
    weight: 2,
    maxPerLife: 1,
    run: (c) =>
      c.ask({
        id: 'us.retireMove',
        weight: 'major',
        title: '老後の暮らす場所',
        // (the children and grandchildren only for a man who has them: the grandchildren as his life records them, 孫)
        body: `長く住んだ町の冬は、年を追うごとにこたえるようになりました。${(c.s.family.kids?.length ?? 0) > 0 ? '子どもたちは遠くに住み、' : ''}友人の多くはこの町にいます。`,
        choices: [{ label: '冬の暖かい州に引っ越す', hint: '気候は楽になるが、長年の友人とは離れる' }, (c.s.family.kids?.length ?? 0) > 0 ? { label: hasGrandkids(c.s) ? '子どもや孫の近くに移る' : '子どもの近くに移る' } : { label: '町の中の、駅に近い小さな家に移る' }, { label: '今の家と町に、住み続ける' }],
        autoIndex: 2,
      }),
    resolve: (c, choice) => {
      mark(c.s, 'us.retireMove')
      if (choice === 0) {
        bump(c, { money: -120, happy: 3, rel: -3 })
        // (a warm state other than his own: where he lives from now, place.ts)
        const to = moveToOneOf(c.s, WARM_STATES, 0x7a5)
        c.add('milestone', `家を売り、冬の暖かい${to ?? '州'}へ引っ越しました。庭のヤシの木の下で、隣人と挨拶を交わす朝が始まりました。`, { key: true })
      } else if (choice === 1) {
        bump(c, { money: -80, rel: 4, happy: 2 })
        const kids = c.s.family.kids ?? []
        // (near a child, whose place is not kept: a place the model does not know; the house near the station is in the same town)
        if (kids.length > 0) moveUnknown(c.s)
        c.add('milestone', kids.length === 0 ? '駅に近い小さな家に移りました。買い物も病院も、歩いて行けるようになりました。' : `子どもの家の近くに小さな家を買いました。${hasGrandkids(c.s) ? '週末には、孫たちが自転車で遊びに来ます。' : '週末には、子どもが顔を見せに来ます。'}`, { key: true })
      } else c.add('decision', '友人の多い町を離れず、手すりをつけて今の家に住み続けることにしました。')
    },
  },
]

const THEME: Record<string, string> = {
  ...US_THEME,
  usHealthcare: 'health',
  usMoney: 'work',
  usKids: 'family',
  usLove: 'love',
  usAfterWork: 'work',
  usAfterMedia: 'media',
  usAging: 'health',
  usFamilyVisit: 'family',
  usHome: 'home',
  usGrandchild: 'family',
}

/**
 * tied to the country he lives in (`lives`), drawn by the resident pass; the `country: 'US'` written above is dropped so that the
 * birth country's table does not decide (PROJECT_PLAN §11.37)
 */
export const US_LIFE_EVENTS: EventDef[] = US.map((d) => ({ ...d, country: undefined, lives: 'US' as const, theme: THEME[d.category] }))
