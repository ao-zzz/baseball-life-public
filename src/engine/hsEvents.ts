import { rotate, type EventCtx, type EventDef } from './events.ts'
import type { LifeState, Menu, Position, SkillKey } from './types.ts'
import { MENU_LABEL, SKILL_LABEL, skillsFor, subRoleLabel } from './ability.ts'
import { clamp } from './math.ts'

// High-school (and middle-school) events with effects (PROJECT_PLAN §11.2, stage 2).
// Choices change the skill profile, fatigue, confidence, the coach's evaluation, relations and the
// growth of the overall ability (bb.gain). School names never appear in these texts (§11.1-5).
// All texts are original.

const POS_NAME: Record<Position, string> = { P: '投手', C: '捕手', IF: '内野手', OF: '外野手' }

function bb(s: LifeState) {
  return s.bb!
}
const has = (s: LifeState) => !!s.bb
const grade = (s: LifeState) => s.career.phaseYears + 1

function bump(c: EventCtx, o: { eval?: number; conf?: number; fatigue?: number; gain?: number; happy?: number; rel?: number; know?: number; health?: number }) {
  const b = bb(c.s)
  if (o.eval) b.coachEval = clamp(b.coachEval + o.eval, 0, 100)
  if (o.conf) b.confidence = clamp(b.confidence + o.conf, 0, 100)
  if (o.fatigue) b.fatigue = clamp(b.fatigue + o.fatigue, 0, 100)
  if (o.gain) b.gain += o.gain
  const st = c.s.status
  if (o.happy) st.happiness = clamp(st.happiness + o.happy, 5, 100)
  if (o.rel) st.relations = clamp(st.relations + o.rel, 5, 100)
  if (o.know) st.knowledge = clamp(st.knowledge + o.know, 1, 99)
  if (o.health) st.health = clamp(st.health + o.health, 5, 100)
}

function weakest(s: LifeState): SkillKey {
  const ks = skillsFor(s.person.position)
  return ks.reduce((a, k) => (bb(s).skills[k] < bb(s).skills[a] ? k : a), ks[0])
}

function strongest(s: LifeState): SkillKey {
  const ks = skillsFor(s.person.position)
  return ks.reduce((a, k) => (bb(s).skills[k] > bb(s).skills[a] ? k : a), ks[0])
}

const MENUS_FOR = (pos: Position): Menu[] => (pos === 'P' ? ['pitching', 'body', 'balanced', 'defense'] : ['batting', 'defense', 'body', 'balanced'])

export const HS_EVENTS: EventDef[] = [
  {
    id: 'hs.menu',
    category: 'practice',
    stages: ['hs', 'jhs'],
    when: has,
    weight: 3,
    cooldown: 1,
    maxPerLife: 4,
    run: (c) => {
      const menus = MENUS_FOR(c.s.person.position)
      const auto = menus.indexOf(c.s.person.position === 'P' ? 'pitching' : c.rng.chance(0.5) ? 'batting' : 'defense')
      c.ask(
        {
          id: 'hs.menu',
          weight: 'minor',
          title: 'この1年の練習の重点',
          body: `新しい学年が始まります。${POS_NAME[c.s.person.position]}として、どこを伸ばしますか。`,
          choices: menus.map((m) => ({ label: MENU_LABEL[m], hint: m === 'body' ? '体重が増え、長打や球速が伸びやすい' : m === 'balanced' ? '弱点が少なくなる' : undefined })),
          autoIndex: Math.max(0, auto),
        },
        { menus: menus.join(',') },
      )
    },
    resolve: (c, choice, d) => {
      const menus = String(d.menus).split(',') as Menu[]
      const m = menus[choice] ?? 'balanced'
      bb(c.s).menu = m
      const label = MENU_LABEL[m]
      const year = c.s.career.phaseYears + 1
      c.add('decision', year === 1 ? `この1年は「${label}」を重点に練習することにしました。` : year === 2 ? `2年目の練習は「${label}」を重点にしました。` : `最後の1年は「${label}」に力を入れることにしました。`)
    },
  },
  {
    id: 'hs.selfPractice',
    category: 'effort',
    stages: ['hs'],
    when: has,
    weight: 2,
    cooldown: 1,
    maxPerLife: 2,
    run: (c) =>
      c.ask({
        id: 'hs.selfPractice',
        weight: 'minor',
        title: '全体練習のあと',
        body: '全体練習が終わったあとの時間を、どう使いますか。',
        choices: [
          { label: '毎日残って自主練習をする', hint: '伸びるが、疲れがたまる（野球の伸び↑↑・疲労+22・自信+4）' },
          { label: '週末だけ自主練習をする', hint: 'ほどほどに（野球の伸び↑・疲労+8）' },
          { label: '体を休めて、勉強の時間にする', hint: '疲れが取れ、成績も上がる（疲労−15・知識+4）' },
        ],
        autoIndex: bb(c.s).fatigue > 65 ? 2 : 1,
      }),
    resolve: (c, choice) => {
      if (choice === 0) {
        bump(c, { gain: 0.06, fatigue: 22, conf: 4 })
        c.add('decision', '毎日、日が暮れるまで残って練習することにしました。')
      } else if (choice === 1) {
        bump(c, { gain: 0.03, fatigue: 8 })
        c.add('decision', '週末だけ、自主練習の時間をつくることにしました。')
      } else {
        bump(c, { fatigue: -15, know: 4 })
        c.add('decision', '練習のあとは体を休め、勉強に時間を使うことにしました。')
      }
    },
  },
  {
    id: 'hs.advice',
    category: 'coach',
    stages: ['hs', 'jhs'],
    when: has,
    weight: 2,
    cooldown: 1,
    maxPerLife: 3,
    run: (c) => {
      const k = weakest(c.s)
      bb(c.s).skills[k] += 0.15
      bump(c, { eval: 3 })
      const skill = SKILL_LABEL[k]
      c.add('normal', rotate(c.s, 'hs.advice', [`監督から${skill}について助言をもらい、練習の仕方を変えました。`, `コーチに${skill}の課題を指摘され、居残りで取り組みました。`, `監督の一言で、${skill}の練習のやり方を見直しました。`]))
    },
  },
  {
    id: 'hs.scolded',
    category: 'coach',
    stages: ['hs'],
    when: (s) => has(s) && bb(s).coachEval < 60,
    weight: 1.5,
    cooldown: 2,
    maxPerLife: 2,
    run: (c) =>
      c.ask({
        id: 'hs.scolded',
        weight: 'minor',
        title: '監督に叱られた',
        body: '練習試合で凡ミスをして、ベンチで監督に強く注意されました。',
        choices: [
          { label: '受け止めて、練習で取り返す', hint: '評価は上がるが、自信は少し下がる' },
          { label: '納得できないと伝える', hint: '自分の考えは言えるが、評価は下がる' },
          { label: '何も言わずに耐える' },
        ],
        autoIndex: 0,
      }),
    resolve: (c, choice) => {
      if (choice === 0) {
        bump(c, { eval: 6, conf: -4, gain: 0.02 })
        c.add('decision', '翌日から、誰よりも早くグラウンドに来るようにしました。')
      } else if (choice === 1) {
        bump(c, { eval: -6, conf: 3 })
        c.add('decision', '自分の考えを監督に伝えました。気まずい空気が数日続きました。')
      } else {
        bump(c, { conf: -6, happy: -3 })
        c.add('decision', '何も言わずに頭を下げました。帰り道は足取りが重くなりました。')
      }
    },
  },
  {
    id: 'hs.praise',
    category: 'coach',
    stages: ['hs'],
    when: (s) => has(s) && bb(s).coachEval >= 60,
    weight: 1,
    cooldown: 2,
    maxPerLife: 2,
    run: (c) => {
      bump(c, { conf: 8, happy: 4 })
      c.add('good', `「${SKILL_LABEL[strongest(c.s)]}はチームでも上のほうだ」と、監督にほめられました。`)
    },
  },
  {
    id: 'hs.interview',
    category: 'coach',
    stages: ['hs'],
    ages: [16, 16],
    when: has,
    weight: 3,
    maxPerLife: 1,
    run: (c) =>
      c.ask({
        id: 'hs.interview',
        weight: 'minor',
        title: '監督との面談',
        body: '新チームになる前に、監督と一対一で話す時間がありました。これからの役割について聞かれました。',
        choices: [
          { label: 'レギュラーを目指したいと伝える', hint: '練習の量が増える（野球の伸び↑・疲労+10・自信+3）' },
          { label: 'チームの役に立てる役割を探す', hint: '監督の評価が上がる（監督の評価+6・人間関係+3）' },
          { label: '勉強とも両立したいと伝える', hint: '成績が上がる（知識+5・監督の評価−2）' },
        ],
        autoIndex: bb(c.s).role === 'starter' ? 0 : 1,
      }),
    resolve: (c, choice) => {
      if (choice === 0) {
        bump(c, { gain: 0.03, fatigue: 10, conf: 3 })
        c.add('decision', '「レギュラーを取りたい」と伝えました。監督は黙ってうなずきました。')
      } else if (choice === 1) {
        bump(c, { eval: 6, rel: 3 })
        bb(c.s).subRole = bb(c.s).subRole ?? (bb(c.s).skills.speed > 0 ? '代走' : '守備固め')
        c.add('decision', `「${subRoleLabel(c.s)}でも、チームのためにやれることをやります」と伝えました。`)
      } else {
        bump(c, { know: 5, eval: -2 })
        c.add('decision', '勉強とも両立したいと正直に伝えました。')
      }
    },
  },
  {
    id: 'hs.starterRace',
    category: 'competition',
    stages: ['hs'],
    when: (s) => has(s) && (bb(s).role === 'bench' || bb(s).role === 'outside') && grade(s) >= 1,
    weight: 2.5,
    cooldown: 1,
    maxPerLife: 2,
    run: (c) =>
      c.ask({
        id: 'hs.starterRace',
        weight: 'minor',
        title: 'スタメン争い',
        body: `同じポジションの選手と、先発の座を争っています。いまは${bb(c.s).role === 'bench' ? 'ベンチ入り' : 'ベンチ外'}です。`,
        choices: [
          { label: '打撃でアピールする', hint: 'ミートと長打が伸びる。疲れがたまる' },
          { label: '守備と走塁でアピールする', hint: '守備と走力が伸びる' },
          { label: '別のポジションに挑戦する', hint: '空いている場所なら出番が増える' },
          { label: '今の役割を極める', hint: `${subRoleLabel(c.s)}としての出番を狙う` },
        ],
        autoIndex: c.rng.chance(0.5) ? 0 : 1,
      }),
    resolve: (c, choice) => {
      const sk = bb(c.s).skills
      if (choice === 0) {
        sk.contact += 0.2
        sk.power += 0.15
        bump(c, { fatigue: 12, gain: 0.02 })
        c.add('decision', '練習試合で、打撃のアピールを続けることにしました。')
      } else if (choice === 1) {
        sk.fielding += 0.2
        sk.speed += 0.15
        bump(c, { fatigue: 10, gain: 0.02 })
        c.add('decision', 'ノックの数を増やし、守備と走塁で勝負することにしました。')
      } else if (choice === 2) {
        changePosition(c)
      } else {
        const r = bb(c.s).subRole ?? '代打'
        bb(c.s).subRole = r
        if (r === '代走') sk.speed += 0.25
        else if (r === '守備固め') sk.fielding += 0.25
        else sk.contact += 0.25
        bump(c, { eval: 3 })
        c.add('decision', `${subRoleLabel(c.s)}として、一度の出番で結果を出す準備をすることにしました。`)
      }
    },
  },
  {
    id: 'hs.convert',
    category: 'coach',
    stages: ['hs'],
    ages: [15, 16],
    when: (s) => has(s) && bb(s).role !== 'starter',
    weight: 1,
    maxPerLife: 1,
    run: (c) =>
      c.ask({
        id: 'hs.convert',
        weight: 'minor',
        title: 'コンバートの打診',
        body: `監督から、${otherPosition(c.s.person.position) === 'P' ? '投手' : POS_NAME[otherPosition(c.s.person.position)]}をやってみないかと言われました。`,
        choices: [{ label: '挑戦する', hint: '出番が増えるかもしれない' }, { label: '今のポジションで勝負する' }],
        autoIndex: 0,
      }),
    resolve: (c, choice) => {
      if (choice === 0) changePosition(c)
      else {
        bump(c, { conf: 4, eval: -2 })
        c.add('decision', '今のポジションで勝負したいと伝えました。')
      }
    },
  },
  {
    id: 'hs.captain',
    category: 'leadership',
    stages: ['hs'],
    ages: [16, 16],
    when: (s) => has(s) && s.status.relations >= 55 && bb(s).coachEval >= 50,
    weight: 4,
    maxPerLife: 1,
    run: (c) => {
      const asCaptain = bb(c.s).coachEval >= 62 && c.s.status.relations >= 65
      c.ask(
        {
          id: 'hs.captain',
          weight: 'major',
          title: asCaptain ? '主将に指名された' : '副主将を決める話し合い',
          body: asCaptain ? '3年生が引退し、新チームの主将に指名されました。' : '新チームの副主将を決める話し合いで、名前が挙がりました。',
          choices: [
            { label: '引き受ける', hint: '仲間との関係が深まる。練習以外の仕事も増える' },
            { label: '辞退して、自分のプレーに集中する', hint: '練習に専念できる' },
          ],
          autoIndex: 0,
        },
        { captain: asCaptain },
      )
    },
    resolve: (c, choice, d) => {
      if (choice === 0) {
        bb(c.s).captain = d.captain ? 'captain' : 'vice'
        bump(c, { rel: 8, eval: 6, fatigue: 8, conf: 4 })
        c.s.career.achievements.push(d.captain ? '主将' : '副主将')
        c.add('decision', d.captain ? '主将を引き受けました。チームの前で、最初のあいさつをしました。' : '副主将を引き受けました。主将を支える役目です。', { key: !!d.captain })
      } else {
        bump(c, { gain: 0.02 })
        c.add('decision', '辞退して、自分のプレーに集中することにしました。')
      }
    },
  },
  {
    id: 'hs.senpai',
    category: 'relations',
    stages: ['hs'],
    ages: [15, 15],
    when: has,
    weight: 2,
    maxPerLife: 1,
    run: (c) =>
      c.ask({
        id: 'hs.senpai',
        weight: 'minor',
        title: '先輩との関係',
        body: '同じポジションの先輩から、練習のやり方について厳しく言われることが続いています。',
        choices: [
          { label: '素直に教わる', hint: '技術が伸びる' },
          { label: '同級生と相談して、距離を置く', hint: '同級生との絆が深まる' },
          { label: '監督に相談する' },
        ],
        autoIndex: 0,
      }),
    resolve: (c, choice) => {
      if (choice === 0) {
        bb(c.s).skills[weakest(c.s)] += 0.15
        bump(c, { conf: -2, happy: -2 })
        c.add('decision', '先輩のやり方を素直にまねてみました。少しずつ、言われることの意味がわかってきました。')
      } else if (choice === 1) {
        bump(c, { rel: 5, happy: 2 })
        c.add('decision', '同級生と励まし合いながら、自分たちのやり方で練習することにしました。')
      } else {
        bump(c, { eval: 2, rel: -2 })
        c.add('decision', '監督に相談しました。しばらくして、練習の雰囲気が少し変わりました。')
      }
    },
  },
  {
    id: 'hs.kohai',
    category: 'relations',
    stages: ['hs'],
    ages: [16, 17],
    when: has,
    weight: 1.5,
    maxPerLife: 1,
    run: (c) => {
      bump(c, { rel: 5, conf: 3 })
      c.add('good', '後輩に打撃のこつを聞かれ、居残りで一緒に練習しました。')
    },
  },
  {
    id: 'hs.teamwork',
    category: 'relations',
    stages: ['hs', 'jhs'],
    when: has,
    weight: 1,
    cooldown: 2,
    maxPerLife: 2,
    run: (c) => {
      bump(c, { rel: 4, gain: 0.01 })
      c.add('normal', '同級生とバッテリーを組み、休みの日も一緒に練習しました。')
    },
  },
  {
    id: 'hs.slump',
    category: 'form',
    stages: ['hs'],
    when: (s) => has(s) && bb(s).condition <= 0,
    weight: 1.5,
    cooldown: 2,
    maxPerLife: 2,
    run: (c) => {
      bb(c.s).condition = -2
      c.ask({
        id: 'hs.slump',
        weight: 'minor',
        title: 'スランプ',
        body: c.s.person.position === 'P' ? '何をしてもストライクが入りません。' : 'もう3週間、まともな当たりが出ていません。',
        choices: [
          { label: 'フォームを見直す', hint: '直れば一気に伸びる。崩れることもある' },
          { label: '基本の練習に立ち返る', hint: '時間はかかるが確か' },
          { label: '数日、野球から離れる', hint: '疲れが取れる' },
        ],
        autoIndex: 1,
      })
    },
    resolve: (c, choice) => {
      const b = bb(c.s)
      if (choice === 0) {
        const ok = c.rng.chance(0.55)
        b.condition = ok ? 1 : -1
        b.skills[strongest(c.s)] += ok ? 0.2 : -0.1
        bump(c, { conf: ok ? 8 : -6 })
        c.add('decision', ok ? 'フォームを見直したら、嘘のように感覚が戻ってきました。' : 'フォームを変えたら、かえって感覚がわからなくなりました。')
      } else if (choice === 1) {
        b.condition = 0
        bump(c, { gain: 0.01, conf: 2 })
        c.add('decision', 'キャッチボールと素振りからやり直しました。少しずつ、もとに戻ってきました。')
      } else {
        b.condition = 0
        bump(c, { fatigue: -20, happy: 3 })
        c.add('decision', '数日、ボールを持たずに過ごしました。気持ちが少し軽くなりました。')
      }
    },
  },
  {
    id: 'hs.hot',
    category: 'form',
    stages: ['hs', 'jhs'],
    when: (s) => has(s) && bb(s).condition >= 0,
    weight: 1,
    cooldown: 2,
    maxPerLife: 2,
    run: (c) => {
      bb(c.s).condition = 2
      bump(c, { conf: 8, eval: 3 })
      c.add('good', c.s.person.position === 'P' ? '投げるたびに、ミットが気持ちのいい音を立てます。絶好調です。' : 'ボールが止まって見えるほど、打撃の調子が上がっています。')
    },
  },
  {
    id: 'hs.injury',
    category: 'health',
    stages: ['hs'],
    when: (s) => has(s) && s.career.injured === 0,
    weight: (s) => (s.bb ? 0.2 + Math.max(0, s.bb.fatigue - 50) / 25 : 0),
    cooldown: 2,
    maxPerLife: 2,
    run: (c) => {
      const part = c.s.person.position === 'P' ? '肘' : c.rng.pick(['腰', '足首', '肩', '太もも'])
      c.ask(
        {
          id: 'hs.injury',
          weight: 'major',
          title: `${part}のけが`,
          body: `練習中に${part}を痛めました。医師には、しばらく休むように言われています。`,
          choices: [
            { label: '痛みをこらえて試合に出る', hint: '評価は上がるが、悪化するおそれがある' },
            { label: '治療に専念する', hint: 'しばらく出番はない' },
          ],
          autoIndex: 1,
        },
        { part },
      )
    },
    resolve: (c, choice, d) => {
      const b = bb(c.s)
      if (choice === 0) {
        bump(c, { eval: 4, fatigue: 15 })
        if (c.rng.chance(0.4)) {
          c.s.career.injured = 2
          bump(c, { health: -8, conf: -10, happy: -6 })
          c.add('bad', `無理をして出た試合で、${d.part}の痛みが悪化しました。長い離脱になりました。`, { key: true })
        } else {
          c.add('decision', `${d.part}をテーピングで固めて、試合に出続けました。`)
        }
      } else {
        c.s.career.injured = 1
        b.fatigue = clamp(b.fatigue - 30, 0, 100)
        bump(c, { conf: -4 })
        c.add('decision', `治療に専念することにしました。${d.part}が治るまで、グラウンドの外から仲間を見ています。`)
      }
    },
  },
  {
    id: 'hs.comeback',
    category: 'health',
    stages: ['hs', 'univ', 'amateur', 'pro'],
    when: (s) => has(s) && s.career.injured === 0 && (s.evHist?.['hs.injury']?.[0] ?? -9) === s.age - 1,
    weight: 5,
    maxPerLife: 1,
    run: (c) => {
      bump(c, { conf: 6, happy: 5 })
      c.add('good', 'けがから復帰し、久しぶりに練習試合のグラウンドに立ちました。', { key: true })
    },
  },
  {
    id: 'hs.careerTalk',
    category: 'future',
    stages: ['hs'],
    ages: [17, 17],
    when: has,
    weight: 6,
    maxPerLife: 1,
    run: (c) =>
      c.ask({
        id: 'hs.careerTalk',
        weight: 'minor',
        title: '進路相談',
        body: '3年生の春、進路について先生と監督に相談しました。卒業後、野球とどう向き合いたいですか。',
        choices: [
          { label: 'プロを目指したい', hint: '練習の強度を上げる（野球の伸び↑・疲労+10）' },
          { label: '大学で野球を続けたい', hint: '勉強の時間も取る（知識+3）' },
          { label: '就職して、できれば社会人野球で' },
          { label: '野球は高校までにする' },
        ],
        autoIndex: c.s.z > 1.6 ? 0 : c.s.status.knowledge > 55 ? 1 : 2,
      }),
    resolve: (c, choice) => {
      const goals = ['pro', 'univ', 'work', 'quit'] as const
      bb(c.s).goal = goals[choice] ?? 'univ'
      if (choice === 0) bump(c, { gain: 0.03, fatigue: 10 })
      if (choice === 1) bump(c, { know: 3 })
      c.add('decision', ['プロを目指したいと伝えました。', '大学で野球を続けたいと伝えました。', '就職して、できれば社会人野球を続けたいと伝えました。', '野球は高校までにすると決めました。'][choice] ?? '')
    },
  },
  {
    id: 'hs.test',
    category: 'school',
    stages: ['hs', 'jhs'],
    when: has,
    weight: 1,
    cooldown: 2,
    maxPerLife: 2,
    run: (c) =>
      c.ask({
        id: 'hs.test',
        weight: 'minor',
        title: '定期試験の前',
        body: '試験が近いのに、大会も迫っています。',
        choices: [{ label: '練習を優先する', hint: '成績は下がる（野球の伸び↑・知識−3）' }, { label: '試験勉強を優先する', hint: '監督の評価は少し下がる（知識+5・監督の評価−2）' }],
        autoIndex: c.s.status.knowledge < 40 ? 1 : 0,
      }),
    resolve: (c, choice) => {
      if (choice === 0) {
        bump(c, { gain: 0.01, know: -3 })
        c.add('decision', '試験よりも練習を優先しました。結果は聞かないでください。')
      } else {
        bump(c, { know: 5, eval: -2 })
        c.add('decision', '試験勉強を優先しました。赤点は免れました。')
      }
    },
  },
  {
    id: 'hs.rival',
    category: 'competition',
    stages: ['hs'],
    when: has,
    weight: 1,
    maxPerLife: 1,
    run: (c) => {
      bump(c, { gain: 0.015, conf: -2 })
      c.add('normal', `同じ学年に、同じ${POS_NAME[c.s.person.position]}のライバルがいます。負けたくない気持ちが、練習の量を増やしています。`)
    },
  },
  {
    id: 'hs.family',
    category: 'family',
    stages: ['hs'],
    when: has,
    weight: 1,
    maxPerLife: 1,
    run: (c) => {
      bump(c, { happy: 4 })
      c.add('normal', c.s.person.wealth >= 3 ? '遠征の費用を、両親が何も言わずに出してくれました。' : '遠征費のために、母がパートを増やしてくれたと知りました。')
    },
  },
]

function otherPosition(p: Position): Position {
  return p === 'P' ? 'OF' : p === 'OF' ? 'IF' : p === 'IF' ? 'OF' : 'IF'
}

function changePosition(c: EventCtx) {
  const from = c.s.person.position
  const to = otherPosition(from)
  c.s.person.position = to
  const b = bb(c.s)
  // the new position's skills start a little behind (assumption)
  for (const k of skillsFor(to)) if (!skillsFor(from).includes(k)) b.skills[k] -= 0.1
  b.role = b.role === 'starter' ? 'bench' : b.role
  bump(c, { conf: -3, eval: 3 })
  c.add('decision', `${POS_NAME[from]}から${POS_NAME[to]}に転向しました。`, { key: true })
}
