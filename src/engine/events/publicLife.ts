import type { LifeState } from '../types.ts'
import type { CountryCode } from '../../data/types.ts'
import { employed, flagAge, hasFlag, type EventSpec } from './spec.ts'
import { COUNTRY_INFO, livesAbroad, livesIn, residenceOf } from '../countries/index.ts'
import { LANG_LABEL, LANG_OF, levelOf, localLevel } from '../language.ts'
import { fameOf } from '../lifeLoveEvents.ts'
import { affordable } from './spending.ts'

// What is talked about (PROJECT_PLAN §11.41): the news of a place and its calendar, a second background, a language to learn, the
// large turns of a life (a foundation, a disaster, a quarrel in public, an office, a uniform). They are events of daily life tied to
// where he lives (`lives`, the resident pass), one set per country with a profile, some for every country, some for one:
//   news      - a line and no change in the life (the event has no effect and no follow-up)
//   life      - changes money, relations, happiness, knowledge, a language or a fact
//   office    - a chain of steps; each needs the one before (a flag, the years since it, the age) and happens once or twice at most
// A man who has not stopped playing does not stand for office; one who is not in the country does not meet its offices. As in the
// spending events, what costs or changes something is a choice: the choice that does nothing is always there and is the おまかせ answer.
// Chances are game assumptions (an election is won more often by a man of a name, but never certain; a prime ministership almost never).

const POST_HS: EventSpec['stages'] = ['univ', 'amateur', 'pro', 'adult', 'senior']
const LATER: EventSpec['stages'] = ['pro', 'adult', 'senior']
const PLAY = new Set(['univ', 'company', 'indep', 'proMinor', 'pro', 'abroad'])
const playing = (s: LifeState) => PLAY.has(s.career.phase)
const retired = (s: LifeState) => s.career.phase === 'retired' && s.career.endedAge !== null
/** how well known his baseball made him, for good (0 none, 1 played beyond high school, 2 reached the first team of a pro league) */
const named = (s: LifeState): number => (s.career.highestRank >= 8 ? 2 : s.career.highestRank >= 5 ? 1 : 0)

const NONE = (label: string, text: string) => ({ label, outcomes: [{ text }] })

type Spec = Omit<EventSpec, 'id' | 'category' | 'lives'> & { stages: EventSpec['stages'] }
function make(cc: CountryCode, id: string, category: string, theme: string, spec: Spec): EventSpec {
  return { ...spec, choices: affordable(spec.choices), id, category, theme, lives: cc, when: (s) => livesIn(s, cc) && (!spec.when || spec.when(s)) }
}

// ================================================================ for every country with a profile
const COMMON = (cc: CountryCode, w: { disaster: string; disasterWhere: string; star: string; foundation: string; kind: string }): EventSpec[] => {
  const tag = cc.toLowerCase()
  const m = (topic: string, theme: string, spec: Spec) => make(cc, `pub.${topic}.${tag}`, `pub.${topic}`, theme, spec)
  return [
    m('charity', 'public', {
      stages: LATER,
      ages: [28, 75],
      when: (s) => !hasFlag(s, 'pub.foundation') && s.money >= 800 && (named(s) >= 2 || s.money >= 2000),
      weight: 1.2,
      cooldown: 8,
      maxPerLife: 2,
      title: '社会貢献',
      body: `${w.foundation}を作らないかという話が来ました。野球で得たものを、${w.kind}に返す方法を探している人は少なくありません。`,
      auto: 2,
      choices: [
        { label: `自分の名前を冠した${w.foundation}を設立する`, hint: '費用が大きい。続けられるかが問われる', when: (s) => s.money >= 1000, flag: 'pub.foundation', follow: [{ id: `pub.charityBack.${tag}`, after: 3, within: 5 }], effects: { money: -500, rel: 4, happy: 3 }, outcomes: [{ text: `${w.foundation}の設立を発表しました。記者会見には、懐かしい顔ぶれも集まりました。`, kind: 'big', key: true }] },
        { label: '既存の団体に、毎年寄付を続ける', effects: { money: -100, rel: 2, happy: 2 }, outcomes: [{ text: '団体の担当者と相談し、毎年一定額を寄付する約束をしました。', kind: 'good' }] },
        NONE('今は自分の生活を固める', '社会貢献の話は、余裕ができたら改めて考えると答えました。'),
      ],
    }),
    m('charityBack', 'public', {
      stages: LATER,
      followOnly: true,
      outcomes: [
        { weight: 2, text: `${w.foundation}の支援を受けた子どもたちが、野球の大会で笑顔を見せてくれました。活動の手応えを感じました。`, kind: 'good', effects: { happy: 5, rel: 3 } },
        { weight: 1, text: `${w.foundation}の運営費が足りず、追加の寄付を迫られました。活動の難しさを知りました。`, effects: { money: -150, happy: -1, know: 2 } },
      ],
    }),
    m('disaster', 'public', {
      stages: POST_HS,
      ages: [20, 80],
      weight: 0.7,
      cooldown: 8,
      maxPerLife: 2,
      title: w.disaster,
      body: `${w.disasterWhere}が大きな被害を受け、テレビは連日、現地の様子を伝えています。何かできることはないかと考えています。`,
      auto: 2,
      choices: [
        { label: '現地に入り、ボランティアとして泥をかき出す', hint: '時間と体力を使う', when: (s) => s.age < 70, effects: { money: -30, rel: 4, happy: 3 }, outcomes: [{ text: '現地で、野球を通じて知り合った人たちと並び、一日中スコップを握りました。', kind: 'good' }] },
        { label: 'まとまった額を寄付し、グッズを提供する', when: (s) => s.money >= 150, effects: { money: -80, rel: 3, happy: 1 }, outcomes: [{ text: 'サイン入りのグッズを支援団体に託し、寄付を届けました。' }] },
        NONE('募金箱に入れ、無事を祈る', '募金箱に気持ちだけを入れ、被災した人たちの無事を祈りました。'),
      ],
    }),
    m('celebrity', 'media', {
      stages: LATER,
      ages: [22, 60],
      when: (s) => named(s) >= 2,
      weight: 1,
      cooldown: 6,
      maxPerLife: 3,
      outcomes: [{ text: `${w.star}との会食に招かれました。野球の話で盛り上がり、帰りに一緒に撮った写真が、翌日の話題になりました。`, kind: 'good' }],
    }),
    m('controversy', 'media', {
      stages: LATER,
      ages: [22, 70],
      when: (s) => fameOf(s) >= 0.5 || (named(s) >= 2 && !playing(s)),
      weight: 0.9,
      cooldown: 8,
      maxPerLife: 2,
      title: '発言が波紋を呼ぶ',
      body: 'インタビューでの何気ない一言が切り取られ、ネット上で大きな議論になりました。広報や知人から、対応を求める連絡が来ています。',
      auto: 2,
      choices: [
        { label: '誤解を招いたことを認め、率直に謝る', effects: { happy: -1, rel: 1 }, outcomes: [{ text: '短い言葉で謝ると、批判の声は次第に静まりました。', kind: 'good' }] },
        { label: '真意を丁寧に説明し、反論もする', outcomes: [{ weight: 1, text: '長い説明が受け入れられ、支持の声のほうが大きくなりました。', effects: { rel: 3, happy: 1 } }, { weight: 1, text: '説明がかえって火に油を注ぎ、批判が広がりました。', kind: 'bad', effects: { rel: -4, happy: -4 } }] },
        NONE('何も言わず、嵐が過ぎるのを待つ', '何も答えずにいると、話題は数日で別の出来事に移っていきました。'),
      ],
    }),
  ]
}

// ================================================================ a second background and a language to learn
const HERITAGE = (cc: CountryCode): EventSpec[] => {
  const tag = cc.toLowerCase()
  const m = (topic: string, theme: string, spec: Spec) => make(cc, `her.${topic}.${tag}`, `her.${topic}`, theme, spec)
  const land = (s: LifeState) => COUNTRY_INFO[s.person.heritage ?? 'JP'].label
  const hlang = (s: LifeState) => LANG_OF[s.person.heritage ?? 'JP']
  return [
    m('visit', 'heritage', {
      stages: POST_HS,
      ages: [18, 70],
      when: (s) => !!s.person.heritage && s.person.heritage !== residenceOf(s) && s.money >= 60,
      weight: 1.2,
      cooldown: 6,
      maxPerLife: 3,
      title: '親の国を訪ねる',
      body: (s) => `親の出身国、${land(s)}の親戚から、久しぶりに顔を見せに来ないかという連絡が来ました。${LANG_LABEL[hlang(s)]}で話すのは、子どもの頃以来です。`,
      auto: 2,
      choices: [
        { label: '休みを使って、親戚を訪ねる', hint: '費用と日数がかかる', effects: { money: -60, rel: 3, happy: 3, lang: ['heritage', 20] }, outcomes: [{ text: '親戚の家に泊まり、台所で昔の話を聞きました。食卓の言葉が、少しずつ耳に戻ってきました。', kind: 'good' }] },
        { label: 'ビデオ通話で、近況を伝え合う', effects: { money: -2, rel: 1 }, outcomes: [{ text: '画面越しに、親戚のみんなと近況を話しました。通話の最後は、みんな笑顔でした。' }] },
        NONE('忙しいので、今回は見送る', '訪問は見送り、手紙と写真を送りました。'),
      ],
    }),
    m('team', 'heritage', {
      stages: POST_HS,
      ages: [19, 34],
      when: (s) => !!s.person.heritage && !hasFlag(s, 'her.team') && s.career.highestRank >= 5 && s.person.heritage !== s.person.country,
      weight: 1.4,
      cooldown: 10,
      maxPerLife: 1,
      title: 'どの代表で戦うか',
      body: (s) => `${land(s)}の連盟から、代表に入らないかという打診が届きました。生まれ育った国の代表への思いもあり、心が揺れています。`,
      auto: 2,
      choices: [
        { label: '親の出身国の代表の誘いを受ける', flag: ['her.team', 'her.teamHeritage'], effects: { rel: 2, happy: 2 }, outcomes: [{ text: 'ユニフォームの胸に、親の国の名前を付けて戦うことにしました。親戚から祝福の連絡が届きました。', kind: 'good', key: true }] },
        { label: '生まれ育った国の代表を目指す', flag: ['her.team', 'her.teamHome'], effects: { rel: 1, happy: 2 }, outcomes: [{ text: '生まれ育った国の代表を目指すと決め、親の国の連盟には感謝を伝えました。', kind: 'good' }] },
        NONE('今はどちらにも答えず、所属チームに集中する', '代表の話は保留にして、目の前のシーズンに集中することにしました。'),
      ],
    }),
    m('study', 'language', {
      stages: POST_HS,
      ages: [14, 70],
      when: (s) => (livesAbroad(s) && localLevel(s) < 85) || (!!s.person.heritage && levelOf(s, hlang(s)) < 85 && s.person.heritage !== residenceOf(s)),
      weight: 1.6,
      cooldown: 2,
      maxPerLife: 6,
      title: '言葉を学ぶ',
      body: (s) => {
        const lang = livesAbroad(s) ? LANG_OF[residenceOf(s)] : hlang(s)
        return `${LANG_LABEL[lang]}は、いまのところ「${levelOf(s, lang) < 30 ? '片言' : levelOf(s, lang) < 60 ? '日常会話' : '仕事ができる'}」の水準です。もっと話せるようになれば、暮らしも野球も楽になりそうです。`
      },
      auto: 2,
      choices: [
        { label: '語学教室に通い、先生について本格的に学ぶ', hint: '費用と時間がかかる。一度に伸びる量には限りがある', when: (s) => s.money >= 40, effects: { money: -20, know: 1, lang: ['focus', 25] }, outcomes: [{ text: '毎週の授業と宿題に追われましたが、聞き取れる言葉が確かに増えました。', kind: 'good' }] },
        { label: '日常の会話で、少しずつ覚える', effects: { money: -2, lang: ['focus', 10] }, outcomes: [{ text: '店の人や近所の人とできるだけ話し、聞いた言い回しを夜にメモしました。' }] },
        NONE('今は余裕がないので、見送る', '言葉の勉強は、余裕ができるまで後回しにしました。'),
      ],
    }),
  ]
}

// ================================================================ the calendar and the news of a place (no change in the life)
/** a line of news: key, subject, and the text (or the text as it reads for the state: the same event and draw either way) */
type NewsLine = [string, string, string | ((s: LifeState) => string)]
/**
 * he goes to a workplace with colleagues: a job with an employer after baseball, or a company team's player who still holds the
 * company's job (one who works for himself, a shop, a studio, his own company, has no 送別会 of colleagues: feedback r11 A3)
 */
const atWork = (s: LifeState) => employed(s) || (s.career.phase === 'company' && !!s.after?.work && !s.after.retired)
const NEWS_JP: NewsLine[] = [
  ['obon', 'holiday', 'お盆の時期、新幹線の駅は帰省する人の波で埋まりました。実家の食卓に並ぶ、そうめんとスイカの匂いが懐かしく思い出されました。'],
  ['newyear', 'holiday', '正月の朝、初詣の列に並びながら、箱根駅伝の中継をラジオで聞きました。おみくじは、中吉でした。'],
  ['hanami', 'holiday', '春の花見の季節、川沿いの桜並木の下でブルーシートを広げる人たちを見かけました。缶ビールの音が、そこかしこで聞こえます。'],
  ['koshien', 'school', '夏の甲子園の中継を、テレビの前で見入ってしまいました。球児の汗が、自分の昔の夏を思い出させました。'],
  ['festival', 'community', '秋祭りの神輿が通りを練り歩き、威勢のいい掛け声に、道ばたの子どもたちが飛び跳ねていました。'],
  ['yearend', 'holiday', '年末の大掃除で、押し入れの奥から昔の試合のスコアブックが出てきました。気づけば半日、読みふけっていました。'],
  ['tanabata', 'holiday', '七夕の飾りの短冊に、近所の子どもが「プロ野球選手になれますように」と書いているのを見かけました。'],
  ['setsubun', 'holiday', '節分の夜、恵方巻きを無言で食べる家族の姿が、SNSにあふれていました。'],
  ['rainy', 'media', '梅雨の長雨で、予定されていた試合が三日続けて中止になりました。ニュースは各地の川の水位を伝えていました。'],
  // (the izakaya only from 20 at the start of the year, the legal drinking age in Japan for the whole year: before, the same party without it;
  // without a workplace (a player, a student, one without a job or retired), the season seen in the town, with no one in particular)
  ['sendoff', 'community', (s) => (!atWork(s) ? '年度末、街のあちこちで送別会が開かれる季節になりました。駅前では、花束を抱えた人が拍手で送られていました。' : s.age >= 20 ? '年度末の送別会で、異動する人が拍手に送られました。居酒屋の座敷は、涙と笑いでいっぱいでした。' : '年度末の送別会で、異動する人が花束と拍手に送られました。会場は、涙と笑いでいっぱいでした。')],
]
const NEWS_US: NewsLine[] = [
  ['superbowl', 'holiday', (s) => `スーパーボウルの日曜日、町じゅうの人が同じ試合を見ていました。CMのほうが話題になる年もあり、翌日は${atWork(s) ? '職場' : '町'}でその話ばかりでした。`],
  ['halloween', 'holiday', 'ハロウィンの夜、近所の子どもたちが仮装して玄関を訪ねてきました。お菓子が足りなくなりそうで、慌てて買い足しました。'],
  ['openingday', 'media', '開幕戦の日、町の店は「今日は野球の日」と看板を出しました。仕事を休んで球場に向かう人たちの行列ができていました。'],
  ['memorial', 'holiday', '戦没者を追悼する連休、近所の庭で、旗を飾ったバーベキューが開かれていました。煙の向こうで、子どもたちが走り回っていました。'],
  ['fair', 'community', '夏の州の祭りで、巨大なバターの像と揚げ菓子の屋台が人気を集めていました。農産物の品評会にも、長い列ができていました。'],
  ['lllws', 'school', '夏の終わり、少年野球の世界大会の中継を見ました。全米と世界から集まった子どもたちの涙と笑顔が、画面にあふれていました。'],
]
const newsSpecs = (cc: CountryCode, list: NewsLine[]): EventSpec[] =>
  list.map(([k, theme, text]) =>
    make(cc, `nw.${k}.${cc.toLowerCase()}`, `nw.${k}`, theme, { stages: POST_HS, ages: [18, 90], weight: 1, cooldown: 5, maxPerLife: 3, outcomes: [{ text, kind: 'normal' }] }),
  )

// ================================================================ offices: each step needs the one before
/** an election: the chance of winning follows how well known he is (a game assumption); a loss is a lesson, not the end */
// (the office won is kept with his achievements, so the result screen tells it; a step that needs the one before comes oftener once he
// holds it (`weight`): before, a man elected to a city council was asked about the Diet about once in a lifetime, if at all)
// (2026-10-24: an office won is his job from then on, the career 'politician' of careers.ts with the pay of the office (`pay`, a factor
// on the career's own pay; game assumptions): before, an office was only a flag and an achievement, and he kept his old job. A man
// already retired from working keeps his retirement; the office is then the flag and the achievement only, as before)
const election = (cc: CountryCode, id: string, spec: { stages?: EventSpec['stages']; ages: [number, number]; need: (s: LifeState) => boolean; cost: number; title: string; body: string; flag: string; office: string; weight?: number; won: string; lost: string; weightWin: (s: LifeState) => number; weightLose: number; follow?: string; support: string; decline: string; pay?: number }): EventSpec =>
  make(cc, id, `pol.${id}`, 'public', {
    stages: spec.stages ?? ['adult', 'senior'],
    ages: spec.ages,
    when: (s) => retired(s) && !playing(s) && !hasFlag(s, spec.flag) && spec.need(s),
    weight: spec.weight ?? 0.6,
    cooldown: 6,
    maxPerLife: 2,
    title: spec.title,
    body: spec.body,
    auto: 2,
    choices: [
      {
        label: '立候補する',
        hint: `費用 約${spec.cost}万円。名前が知られていても、勝てるとは限らない`,
        when: (s) => s.money >= spec.cost + 100,
        effects: { money: -spec.cost },
        outcomes: [
          { weight: spec.weightWin, when: (s) => !s.after?.retired, text: spec.won, kind: 'big', key: true, effects: { flag: spec.flag, achieve: spec.office, rel: 5, happy: 5, career: 'politician', ...(spec.pay ? { payScale: spec.pay } : {}) }, follow: spec.follow ? [{ id: spec.follow, after: 3, within: 5 }] : undefined },
          { weight: spec.weightLose, text: spec.lost, kind: 'bad', effects: { happy: -4, rel: 1 } },
          // (the same line in the other state, kept after the loss so that the outcomes read [win, loss] as before: written as a function
          // so that the near-repeat check does not compare it with itself)
          { weight: spec.weightWin, when: (s) => !!s.after?.retired, text: () => spec.won, kind: 'big', key: true, effects: { flag: spec.flag, achieve: spec.office, rel: 5, happy: 5 }, follow: spec.follow ? [{ id: spec.follow, after: 3, within: 5 }] : undefined },
        ],
      },
      { label: '応援する側にまわる', effects: { rel: 2, money: -20 }, outcomes: [{ text: spec.support }] },
      NONE('政治には関わらない', spec.decline),
    ],
  })

const win = (base: number) => (s: LifeState) => base + named(s) * 1.5 + (s.status.knowledge >= 65 ? 1 : 0)

const OFFICES_JP: EventSpec[] = [
  election('JP', 'jp.pub.council', {
    ages: [35, 68], need: (s) => named(s) >= 1 || (s.status.knowledge >= 65 && s.money >= 400), cost: 150, flag: 'pol.council', office: '市議会議員',
    title: '市議会議員選挙', body: '地元の有力者から、市議会議員選挙への立候補を勧められました。野球で知られた名前は、選挙でも力になるかもしれません。',
    won: '市議会議員に当選しました。選挙事務所の旗の前で、花束を抱えて万歳をしました。', lost: '惜しくも次点で落選しました。後援会の人たちが、肩を叩いて励ましてくれました。', weightWin: win(0.8), weightLose: 4, follow: 'jp.pub.councilBack', support: '立候補する知人の応援演説に立ち、選挙事務所で夜遅くまで手伝いました。', decline: '地元の政治の誘いには、野球人としての立場を理由に、丁寧に断りを入れました。',
  }),
  make('JP', 'jp.pub.councilBack', 'pol.jp.councilBack', 'public', { stages: ['adult', 'senior'], followOnly: true, outcomes: [{ weight: 2, text: '議会での質問が地元紙に載り、少年野球場の整備が決まりました。住民から感謝の声が届きました。', kind: 'good', effects: { rel: 4, happy: 4 } }, { weight: 1, text: '予算をめぐる対立が長引き、議会の控え室で、肩を落とす日が増えました。', effects: { happy: -3, know: 2 } }] }),
  election('JP', 'jp.pub.diet', {
    ages: [40, 68], need: (s) => hasFlag(s, 'pol.council') && flagAge(s, 'pol.council') >= 4, cost: 600, flag: 'pol.diet', office: '衆議院議員', weight: 3, pay: 2.4,
    title: '衆議院議員選挙', body: '市議会での実績が評価され、党から、衆議院議員選挙への出馬を打診されました。全国の舞台に立つ、重い決断です。',
    won: '衆議院議員に当選しました。国会の赤いじゅうたんを、緊張して歩きました。', lost: '小選挙区で敗れました。選挙後の挨拶回りで、何度も頭を下げました。', weightWin: (s) => 0.5 + named(s), weightLose: 5, support: '党の候補者の街頭演説に並んで、国政選挙の遊説を手伝いました。', decline: '国政への出馬は、家族と相談したうえで、きっぱり辞退しました。',
  }),
  make('JP', 'jp.pub.minister', 'pol.jp.minister', 'public', {
    stages: ['adult', 'senior'], ages: [50, 76], when: (s) => hasFlag(s, 'pol.diet') && flagAge(s, 'pol.diet') >= 6 && !hasFlag(s, 'pol.minister'), weight: 3, cooldown: 6, maxPerLife: 1,
    title: '入閣の打診', body: '首相官邸から連絡がありました。内閣改造で、大臣として入閣してほしいという打診です。スポーツを所管する大臣という話もあります。', auto: 1,
    choices: [
      { label: '大臣を引き受ける', outcomes: [{ text: '皇居での認証式に臨み、大臣に就任しました。記者団の前で、最初の抱負を語りました。', kind: 'big', key: true, effects: { flag: 'pol.minister', achieve: '大臣', title: '大臣', rel: 5, happy: 4 } }] },
      NONE('議員の仕事に専念したいと、辞退する', '入閣は辞退し、一議員として地元の課題に向き合うことにしました。'),
    ],
  }),
  make('JP', 'jp.pub.pm', 'pol.jp.pm', 'public', {
    stages: ['adult', 'senior'], ages: [55, 78], when: (s) => hasFlag(s, 'pol.minister') && flagAge(s, 'pol.minister') >= 3 && !hasFlag(s, 'pol.pm'), weight: 2, cooldown: 6, maxPerLife: 1,
    title: '党の代表選挙', body: '政権が揺らぐなか、党内から、次の代表選挙への出馬を求める声が上がりました。代表に選ばれれば、首相に指名される可能性があります。', auto: 1,
    choices: [
      {
        label: '代表選挙に立候補する', hint: '費用は大きく、勝つ可能性は低い', when: (s) => s.money >= 1500, effects: { money: -1000 },
        outcomes: [
          { weight: 1, text: '党の代表選挙に勝ち、国会で内閣総理大臣に指名されました。野球を通じて学んだ「チーム」の言葉が、就任の会見に出ました。', kind: 'big', key: true, effects: { flag: 'pol.pm', achieve: '内閣総理大臣', title: '内閣総理大臣', rel: 8, happy: 8 }, follow: [{ id: 'jp.pub.pmBack', after: 2, within: 4 }] },
          { weight: 9, text: '代表選挙では、決選投票で敗れました。握手を交わした相手が、静かに首を振りました。', kind: 'bad', effects: { happy: -5 } },
        ],
      },
      NONE('出馬を見送る', '代表選挙への出馬は見送り、陣営の一員として別の候補を支えました。'),
    ],
  }),
  make('JP', 'jp.pub.pmBack', 'pol.jp.pmBack', 'public', { stages: ['adult', 'senior'], followOnly: true, outcomes: [{ weight: 1, text: '在任中の最後の記者会見で、一年一年を振り返りました。内閣は、世論の厳しい評価の中で終わりました。', kind: 'big', key: true, effects: { happy: 2, know: 4 } }] }),
]

const OFFICES_US: EventSpec[] = [
  election('US', 'us.pub.local', {
    ages: [30, 68], need: (s) => named(s) >= 1 || (s.status.knowledge >= 65 && s.money >= 300), cost: 100, flag: 'pol.local', office: '町議会議員', pay: 0.4,
    title: '町議会の選挙', body: '近所の人たちから、町議会の選挙に出てほしいと頼まれました。元野球選手の名前は、投票所で票になるかもしれません。',
    won: '町議会議員に当選しました。最初の会議では、公園の野球場の予算が議題に上りました。', lost: '惜しくも落選しました。投票所の外で、握手をしてくれた人の顔が忘れられません。', weightWin: win(0.8), weightLose: 4, support: '町議会の候補者のポスター貼りを手伝い、戸別訪問にもついて回りました。', decline: '町の政治には深入りせず、遠くから見守ることにしました。',
  }),
  election('US', 'us.pub.state', {
    ages: [35, 70], need: (s) => hasFlag(s, 'pol.local') && flagAge(s, 'pol.local') >= 3, cost: 400, flag: 'pol.state', office: '州議会議員', weight: 3, pay: 0.9,
    title: '州議会の選挙', body: '町議会での活動が評判になり、党の地区委員会から、州議会議員選挙への出馬を打診されました。州都で働く、新しい挑戦です。',
    won: '州議会議員に当選しました。州議事堂の階段で、家族と記念写真を撮りました。', lost: '州議会の選挙で敗れました。選挙後、ボランティアの人たちと小さな慰労会を開きました。', weightWin: (s) => 0.6 + named(s), weightLose: 4, support: '州議会の候補者の集会で、始球式の経験談を話して聴衆を沸かせました。', decline: '州の政治には関わらず、地元の野球場の応援を続けることにしました。',
  }),
  election('US', 'us.pub.congress', {
    ages: [40, 72], need: (s) => hasFlag(s, 'pol.state') && flagAge(s, 'pol.state') >= 4, cost: 1500, flag: 'pol.congress', office: '連邦下院議員', weight: 3, pay: 2.9,
    title: '連邦議会の選挙', body: '州議会での実績を見込んだ支持者から、連邦議会の下院議員選挙への出馬を求められました。選挙費用は大きく、競争も激しい戦いです。',
    won: '連邦議会の下院議員に当選しました。首都ワシントンで、野球場の観客席にいた頃とは違う、長い会議が始まりました。', lost: '連邦議会の選挙で敗れました。それでも、地元の支持者が最後まで拍手で迎えてくれました。', weightWin: (s) => 0.4 + named(s) * 0.8, weightLose: 5, support: '連邦議会の候補者の資金集めの夕食会に招かれ、野球の話で場を和ませました。', decline: '首都での政治は自分の道ではないと、支援者に頭を下げて断りました。',
  }),
]

const MILITARY_US: EventSpec[] = [
  make('US', 'us.mil.enlist', 'mil.enlist', 'public', {
    stages: ['adult'], ages: [18, 26], when: (s) => retired(s) && !hasFlag(s, 'mil.served') && s.job !== '大学生' && s.career.highestRank < 8, weight: 0.9, cooldown: 4, maxPerLife: 1,
    title: '軍に入るか', body: '野球の道が閉ざされ、次の進路を考えています。近所の募集所の係官が、学費の補助と安定した給料、職業訓練の話をしてくれました。', auto: 1,
    choices: [
      { label: '入隊する', hint: '数年の勤務。規律と、除隊後の学費の補助が得られる', flag: ['mil.served', 'us.veteran'], follow: [{ id: 'us.mil.serviceBack', after: 4, within: 6 }], effects: { know: 3, rel: 4, happy: -1 }, outcomes: [{ text: '宣誓の言葉を読み上げ、新兵訓練所に向かうバスに乗りました。', kind: 'big', key: true }] },
      NONE('入隊せず、別の進路を探す', '入隊の誘いは断り、別の進路を探すことにしました。'),
    ],
  }),
  make('US', 'us.mil.serviceBack', 'mil.service', 'public', {
    stages: ['adult', 'senior'], followOnly: true,
    outcomes: [
      // (the rank at the end of a first enlistment of four years or so: a game assumption)
      { weight: 3, text: '軍曹として勤務を終え、除隊しました。同期との絆と、規律の習慣と、学費の補助という財産が残りました。', kind: 'good', effects: { money: 60, know: 3, rel: 4, happy: 3, achieve: '米軍で兵役（軍曹）' } },
      { weight: 1, text: '伍長として除隊しました。長い勤務の中で、心と体に重い疲れが残り、除隊後はしばらく静かに過ごしました。', effects: { happy: -3, know: 2, money: 40, achieve: '米軍で兵役（伍長）' } },
    ],
  }),
  make('US', 'us.mil.veterans', 'mil.veterans', 'public', {
    stages: ['adult', 'senior'], ages: [35, 85], when: (s) => hasFlag(s, 'mil.served'), weight: 1.2, cooldown: 6, maxPerLife: 3,
    title: '退役軍人の日', body: '退役軍人の日の式典に、地元の仲間から誘われました。昔の戦友に、久しぶりに会えるかもしれません。', auto: 1,
    choices: [
      { label: '式典に参加し、少年野球の始球式も務める', effects: { rel: 4, happy: 3 }, outcomes: [{ text: '式典で国旗に敬礼し、戦友と肩を並べて写真を撮りました。', kind: 'good' }] },
      NONE('家で静かに、黙祷だけを捧げる', '式典には出ず、家の庭で、黙祷だけを静かに捧げました。'),
    ],
  }),
]

// ================================================================ what goes in the registry
export const PUBLIC_SPECS_JP: EventSpec[] = [
  ...COMMON('JP', { disaster: '大きな地震', disasterWhere: '遠くの町', star: '有名な俳優', foundation: '野球教室の基金', kind: '地元の子どもたち' }),
  ...HERITAGE('JP'),
  ...newsSpecs('JP', NEWS_JP),
  ...OFFICES_JP,
]
export const PUBLIC_SPECS_US: EventSpec[] = [
  ...COMMON('US', { disaster: '大型ハリケーンの被害', disasterWhere: '南部の海岸の町', star: '映画の主演俳優', foundation: '少年野球の財団', kind: '出身の町の子どもたち' }),
  ...HERITAGE('US'),
  ...newsSpecs('US', NEWS_US),
  ...OFFICES_US,
  ...MILITARY_US,
]
// Korea and Cuba (PROJECT_PLAN §11.46): the common public life (a charity, a disaster, a star's visit) and the second background
export const PUBLIC_SPECS_KR: EventSpec[] = [
  ...COMMON('KR', { disaster: '大きな洪水の被害', disasterWhere: '地方の町', star: '人気の歌手', foundation: '野球教室の基金', kind: '地元の子どもたち' }),
  ...HERITAGE('KR'),
]
export const PUBLIC_SPECS_CU: EventSpec[] = [
  ...COMMON('CU', { disaster: '大きなハリケーンの被害', disasterWhere: '東部の町', star: '有名な音楽家', foundation: '少年野球の基金', kind: '地区の子どもたち' }),
  ...HERITAGE('CU'),
]
export const PUBLIC_SPECS: EventSpec[] = [...PUBLIC_SPECS_JP, ...PUBLIC_SPECS_US, ...PUBLIC_SPECS_KR, ...PUBLIC_SPECS_CU]
