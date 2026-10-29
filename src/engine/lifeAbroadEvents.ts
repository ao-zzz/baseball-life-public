import { rotate, type EventDef } from './events.ts'
import type { LifeState } from './types.ts'
import type { CountryCode } from '../data/types.ts'
import { clamp } from './math.ts'
import { COUNTRY_INFO, livesAbroad, residenceOf } from './countries/index.ts'
import { LANG_OF, LANG_LABEL, localLevel, studyLang } from './language.ts'

// Life across a border (PROJECT_PLAN §11.35): a man who has gone to play in another country meets the daily life of THAT country
// (a home that is not his, another language, friends and family far away), whatever country he was born in. The conditions ask where he
// lives (`residenceOf`) and where he plays, never only where he was born, and nothing here happens to a man who has not gone.
// They are drawn by runLifePass (own stream, only the playing years) and answer おまかせ with a line of text and no change of
// state, so the calibrated lives are as they were; the other choices carry the trade-offs. Today the only crossing the model makes
// is a Japanese who plays in the MLB (phase 'abroad'); a move to another country will set `LifeState.residence`. All texts are
// original and all effects are game assumptions.

/** the language of a country, for the texts (add a country here when it can be lived in) */
const LANGUAGE: Partial<Record<CountryCode, string>> = { US: '英語', JP: '日本語' }

const here = (s: LifeState) => COUNTRY_INFO[residenceOf(s)].label
const tongue = (s: LifeState) => LANGUAGE[residenceOf(s)] ?? '現地の言葉'

/** playing in a country that is not his own */
const abroadNow = (s: LifeState) => livesAbroad(s) && (s.career.phase === 'abroad' || s.career.phase === 'pro')

function bump(s: LifeState, o: { happy?: number; rel?: number; know?: number; money?: number }) {
  const st = s.status
  if (o.happy) st.happiness = clamp(st.happiness + o.happy, 5, 100)
  if (o.rel) st.relations = clamp(st.relations + o.rel, 5, 100)
  if (o.know) st.knowledge = clamp(st.knowledge + o.know, 1, 99)
  if (o.money) s.money += o.money
}

const LIFE: EventDef[] = [
  {
    id: 'life.abroad.settle',
    category: 'lifeAbroad',
    stages: ['pro'],
    ages: [20, 45],
    when: (s) => abroadNow(s) && s.career.phaseYears <= 2,
    weight: 3,
    cooldown: 3,
    maxPerLife: 2,
    lifePass: true,
    extra: true,
    run: (c) =>
      c.ask({
        id: 'life.abroad.settle',
        weight: 'minor',
        title: `${here(c.s)}での暮らし`,
        body: `契約を結び、${here(c.s)}での生活が始まりました。住まいも食事も${tongue(c.s)}の看板も、何もかもが新しく、慣れるまでには時間がかかりそうです。`,
        choices: [{ label: '球団が用意した住まいと通訳に頼り、まず野球に集中する' }, { label: `${tongue(c.s)}の教室に通い、自分の言葉で話せるようになる`, hint: '時間と体力を使う' }, { label: '近所に出て、現地の人たちと積極的に交わる' }],
        // おまかせ: no change of state
        autoIndex: 0,
      }),
    resolve: (c, choice) => {
      if (choice === 0) c.add('decision', rotate(c.s, 'life.abroad.settle', ['通訳を介して話し、用意された部屋と球場を往復する毎日になりました。', '食事も移動も球団の手配に任せ、まずは野球に慣れることを優先しました。']))
      else if (choice === 1) {
        bump(c.s, { know: 3, happy: -1 })
        studyLang(c.s, LANG_OF[residenceOf(c.s)], 30)
        c.add('good', `夜は${tongue(c.s)}の教室に通いました。数か月後には、ロッカールームの冗談が少し分かるようになりました。`)
      } else {
        bump(c.s, { rel: 3, happy: 2, money: -10 })
        c.add('good', '近所の店の常連になり、隣人に誘われて家のバーベキューに顔を出しました。顔見知りが少しずつ増えました。')
      }
    },
  },
  {
    id: 'life.abroad.distance',
    category: 'lifeAbroad',
    stages: ['pro'],
    ages: [20, 46],
    when: (s) => abroadNow(s) && (!!s.family.partner || !!s.family.spouse || s.family.father !== null || s.family.mother !== null),
    weight: 2,
    cooldown: 3,
    maxPerLife: 3,
    lifePass: true,
    extra: true,
    run: (c) => {
      const s = c.s
      const who = s.family.spouse ? `${s.family.spouse.name}さんと子どもたち` : s.family.partner ? `${s.family.partner}さん` : '実家の家族'
      const kind = s.family.spouse ? '別々に暮らす日々' : s.family.partner ? '遠く離れた恋愛' : '遠く離れた家族'
      c.ask({
        id: 'life.abroad.distance',
        weight: 'minor',
        title: kind,
        body: `${here(s)}と${who}のいる場所は、遠く離れています。時差もあり、電話をかける時間を合わせるだけでも一苦労です。`,
        choices: [{ label: '決まった曜日に、通話の時間を作る' }, { label: 'オフのたびに、長い移動をして会いに行く', hint: '費用と体力がかかる' }, { label: '会う回数は減らして、シーズンに専念する' }],
        // おまかせ: no change of state
        autoIndex: 0,
      })
    },
    resolve: (c, choice) => {
      if (choice === 0) c.add('decision', rotate(c.s, 'life.abroad.distance', ['毎週日曜の朝に、画面越しに顔を見て話す習慣ができました。', '時差のなかで、短い通話の時間だけは欠かさないと決めました。']))
      else if (choice === 1) {
        bump(c.s, { happy: 3, rel: 2, money: -60 })
        c.add('good', '長い移動の末に会えた数日間は、短くても、次のシーズンを乗り切る力になりました。')
      } else {
        bump(c.s, { happy: -2, rel: -3 })
        c.add('decision', '連絡の間隔は少しずつ空き、シーズンが終わるころには、話すことも減っていました。')
      }
    },
  },
  {
    id: 'life.abroad.culture',
    category: 'lifeAbroad',
    stages: ['pro'],
    ages: [20, 46],
    when: (s) => abroadNow(s) && s.career.phaseYears >= 1,
    weight: 1.5,
    cooldown: 4,
    maxPerLife: 2,
    lifePass: true,
    extra: true,
    run: (c) =>
      c.ask({
        id: 'life.abroad.culture',
        weight: 'minor',
        title: '現地の習慣',
        body: `チームメイトに、地元の行事を兼ねた食事会に誘われました。${here(c.s)}の習慣には、まだ戸惑うことが多くあります。`,
        choices: [{ label: '顔を出して、現地の流儀に合わせてみる' }, { label: 'いつもの食事と生活のリズムを守り、断る' }],
        // おまかせ: no change of state
        autoIndex: 1,
      }),
    resolve: (c, choice) => {
      if (choice === 0) {
        bump(c.s, { rel: 3, happy: 2 })
        c.add('good', '慣れない席でしたが、身ぶりまじりに話すうち、チームメイトとの距離が縮まりました。')
      } else c.add('decision', rotate(c.s, 'life.abroad.culture', ['誘いは丁重に断り、自分の食事と睡眠のリズムを守りました。', '行事には出ず、いつもの練習と食事の習慣を続けました。']))
    },
  },
  {
    id: 'life.abroad.clubhouse',
    category: 'lifeAbroad',
    stages: ['pro'],
    ages: [20, 45],
    when: (s) => abroadNow(s),
    weight: 2,
    cooldown: 3,
    maxPerLife: 3,
    lifePass: true,
    extra: true,
    run: (c) =>
      c.ask({
        id: 'life.abroad.clubhouse',
        weight: 'minor',
        title: 'クラブハウスの会話',
        body: `チームメイトの冗談が飛び交うクラブハウスで、話の輪に入れずにいる自分に気づきました。${LANG_LABEL[LANG_OF[residenceOf(c.s)]]}は、いま「${localLevel(c.s) < 30 ? '片言' : localLevel(c.s) < 60 ? '日常会話' : '仕事ができる'}」の水準です。`,
        choices: [{ label: '通訳に頼り、必要な話だけにする' }, { label: '片言でも、自分から話しかけてみる', hint: '失敗も恥ずかしさもあるが、言葉が身につく' }, { label: '同じ国の仲間とだけ過ごす' }],
        // おまかせ: no change of state
        autoIndex: 0,
      }),
    resolve: (c, choice) => {
      if (choice === 0) c.add('decision', rotate(c.s, 'life.abroad.clubhouse', ['通訳を介して必要な話だけを済ませ、ロッカーの隅で静かに支度をしました。', '大事な連絡は通訳に任せ、冗談には笑顔で応じるだけにしました。']))
      else if (choice === 1) {
        // the better he speaks it, the likelier the try lands; a miss still teaches (once a year at most, see studyLang)
        const lands = c.rng.chance(clamp(0.25 + localLevel(c.s) / 120, 0.2, 0.9))
        studyLang(c.s, LANG_OF[residenceOf(c.s)], 12)
        if (lands) {
          bump(c.s, { rel: 3, happy: 2 })
          c.add('good', '片言の冗談が通じ、ロッカーが笑いに包まれました。その日から、名前で呼ばれることが増えました。')
        } else {
          bump(c.s, { rel: 1, happy: -1 })
          c.add('decision', '言い間違いで周りが固まりましたが、すぐに笑い話になりました。恥ずかしさと一緒に、新しい言い回しを覚えました。')
        }
      } else {
        bump(c.s, { rel: -1, happy: 1 })
        c.add('decision', '同じ国の仲間とだけ食事をし、母国語で気楽に過ごしました。チームの輪との距離は、変わりませんでした。')
      }
    },
  },
  {
    id: 'life.abroad.contractTalk',
    category: 'lifeAbroad',
    stages: ['pro'],
    ages: [22, 42],
    when: (s) => abroadNow(s) && s.career.highestRank >= 8,
    weight: 1.2,
    cooldown: 5,
    maxPerLife: 2,
    lifePass: true,
    extra: true,
    run: (c) =>
      c.ask({
        id: 'life.abroad.contractTalk',
        weight: 'minor',
        title: '契約の交渉の席',
        body: '次の契約の話し合いの席に、代理人と通訳が座っています。細かい条項の言い回しを、自分の耳で確かめたい気持ちもあります。',
        choices: [{ label: '代理人と通訳に、すべて任せる' }, { label: '自分も言葉で交渉に加わる', hint: '言葉の力しだいで、結果が変わる' }],
        // おまかせ: no change of state
        autoIndex: 0,
      }),
    resolve: (c, choice) => {
      if (choice === 0) {
        c.add('decision', '代理人と通訳に任せ、自分は署名の前に条項の要点を聞くだけにしました。')
        return
      }
      const lv = localLevel(c.s)
      if (lv >= 60) {
        bump(c.s, { money: 40, rel: 1 })
        c.add('good', '自分の言葉で希望を伝えると、球団側の担当者が表情を和らげました。小さな条件が一つ、上乗せされました。')
      } else if (lv >= 30) {
        bump(c.s, { money: 10 })
        c.add('decision', '通訳の助けを借りながら、要点を自分の言葉で伝えました。結果はほぼ代理人の見立てどおりでした。')
      } else {
        bump(c.s, { money: -20, happy: -2 })
        c.add('bad', '言葉の行き違いで、小さな条件が不利な形で決まってしまいました。代理人が、静かに肩を叩きました。')
      }
    },
  },]

export const LIFE_ABROAD_EVENTS: EventDef[] = LIFE
