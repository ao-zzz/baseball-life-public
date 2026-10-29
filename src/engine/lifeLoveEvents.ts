import { rotate, type EventCtx, type EventDef } from './events.ts'
import type { LifeState } from './types.ts'
import { clamp } from './math.ts'
import { PARTNER_NAMES } from '../data/jp.ts'
import { addKid, bookProposal, drawPartner, infoWords, partnerWords } from './family.ts'
import { moveAway, moveUnknown } from './place.ts'

// Everyday life during the playing years (PROJECT_PLAN §11.33): meeting someone, going out, the strain of a ballplayer's calendar,
// marriage, the wish for a child and its birth, bringing up children, a marriage that fails, a new start after a divorce or a
// bereavement, the family at home, and the rumours that follow a known pro. They are drawn by runLifePass (events.ts) on a stream of
// their own, only in the university, company/independent and pro stages.
//
// The rule that keeps the calibrated lives as they were: every event that a life can meet WITHOUT having chosen one of these
// answers おまかせ with a line of text and no change of state (meeting someone: "not now"; the family call: "a phone call"; a
// rumour about a single man: a line). The state (a partner, a spouse, children) therefore changes only through a choice made on
// screen, and the later events (strain, proposal, child, divorce) need a partner or a spouse, so a headless life never reaches
// them. The marriage, child and bereavement flags are the ones the life after baseball already uses (family.wantKid, family.noKids),
// so a family begun here goes on there without a second marriage or a second "first child".
// Probabilities are model assumptions, not statistics (stats lifeEventModel). All texts are original.

const flagAge = (s: LifeState, f: string) => (s.flags?.[f] === undefined ? Infinity : s.age - s.flags[f])
const setFlag = (s: LifeState, f: string) => ((s.flags ??= {})[f] = s.age)
const clearFlag = (s: LifeState, f: string) => {
  if (s.flags) delete s.flags[f]
}
const taken = (s: LifeState, f: string) => s.taken.includes(f)
const seenAt = (s: LifeState, id: string) => s.evHist?.[id]?.[0] ?? -99
const single = (s: LifeState) => !s.family.partner && !s.family.spouse
const married = (s: LifeState) => !!s.family.spouse
const youngKids = (s: LifeState) => (s.family.kids ?? []).filter((k) => k <= 12).length

function bump(c: EventCtx, o: { happy?: number; rel?: number; money?: number }) {
  const st = c.s.status
  if (o.happy) st.happiness = clamp(st.happiness + o.happy, 5, 100)
  if (o.rel) st.relations = clamp(st.relations + o.rel, 5, 100)
  if (o.money) c.s.money += o.money
}

/**
 * how well known he is (0 = not at all): only a man who has played in the first team of a pro league and is still in the pros.
 * A modelled value (an assumption): the first team gives the base, each rung above it, the seasons played and Koshien add to it.
 */
export function fameOf(s: LifeState): number {
  if (s.career.phase !== 'pro' && s.career.phase !== 'abroad') return 0
  const r = s.career.highestRank
  if (r < 8) return 0
  return clamp(0.4 + 0.3 * (r - 8) + 0.04 * Math.min(s.career.proSeasons, 15) + (s.career.achievements.includes('甲子園') ? 0.3 : 0), 0, 2)
}

/** the marriage itself: the same state as the life after baseball writes in love.propose */
export function marry(c: EventCtx, name: string) {
  const f = c.s.family
  f.spouse = { name, years: 0 }
  f.everMarried = true
  f.marriedAge ??= c.s.age
  f.partner = undefined
  delete f.ended
  delete f.endedAge
  clearFlag(c.s, 'life.dating')
}

const MEET_PLACES = ['球団の関係者の紹介で', '友人の誘いで出かけた食事会で', '通っている店で', '遠征先の知人の紹介で', 'オフの帰省先で', '知り合いの結婚式で']

const LIFE: EventDef[] = [
  // ------------------------------------------------------------ meeting someone
  {
    id: 'life.meet',
    category: 'lifeLove',
    stages: ['univ', 'amateur', 'pro'],
    ages: [19, 38],
    // after a divorce a year, after a bereavement two years, before someone new
    when: (s) => single(s) && (s.family.ended === 'death' ? s.age - (s.family.endedAge ?? -99) >= 2 : s.family.ended === 'divorce' ? s.age - (s.family.endedAge ?? -99) >= 1 : true),
    weight: (s) => (s.age <= 30 ? 2 : 1.1) * (0.6 + s.status.relations / 120),
    cooldown: 2,
    maxPerLife: 5,
    lifePass: true,
    extra: true,
    run: (c) => {
      const name = c.rng.pick(PARTNER_NAMES)
      const again = !!c.s.family.ended
      // who they are (age, work): drawn on a stream of its own (family.ts), shown before he decides and kept if they date
      const info = drawPartner(c.s, name)
      c.ask(
        {
          id: 'life.meet',
          weight: 'minor',
          title: again ? '新しい出会い' : '出会い',
          body: `${c.rng.pick(MEET_PLACES)}、${name}さん${infoWords(c.s, info)}と知り合いました。野球の話を楽しそうに聞いてくれる人です。`,
          choices: [{ label: '食事に誘ってみる', hint: '野球の合間の時間を使う' }, { label: '今は野球に集中する' }],
          // おまかせ: no change of state
          autoIndex: 1,
        },
        { name, gap: info.gap, job: info.job },
      )
    },
    resolve: (c, choice, d) => {
      if (choice !== 0) {
        c.add('decision', rotate(c.s, 'life.meet', ['連絡先は交換せず、練習に戻りました。', '今は野球のことだけ考えようと、誘いは見送りました。', 'いい人だと思いましたが、それ以上は踏み込みませんでした。']))
        return
      }
      const fame = fameOf(c.s)
      const ok = c.rng.chance(clamp(0.45 + (c.s.status.relations - 50) / 100 + 0.1 * fame, 0.2, 0.85))
      if (ok) {
        c.s.family.partner = String(d.name)
        if (d.job !== undefined) c.s.family.partnerInfo = { name: String(d.name), gap: Number(d.gap), job: String(d.job) }
        setFlag(c.s, 'life.dating')
        bump(c, { happy: 6 })
        c.add('good', `${d.name}さんと付き合い始めました。`)
      } else {
        bump(c, { happy: -3 })
        c.add('decision', rotate(c.s, 'life.meet', ['何度か食事をしましたが、予定が合わず、自然に連絡が途絶えました。', '気持ちを伝えましたが、友人のままでいることになりました。', '誘ってみましたが、「試合の日は会えないでしょう」と、やんわり断られました。']))
      }
    },
  },
  // ------------------------------------------------------------ going out
  {
    id: 'life.strain',
    category: 'lifeLove',
    stages: ['univ', 'amateur', 'pro'],
    when: (s) => !!s.family.partner && !s.family.spouse && flagAge(s, 'life.dating') >= 1,
    weight: 1.5,
    cooldown: 2,
    maxPerLife: 3,
    lifePass: true,
    extra: true,
    run: (c) =>
      c.ask({
        id: 'life.strain',
        weight: 'minor',
        title: '会えない日々',
        body: `遠征や合宿が続き、${c.s.family.partner}さんと会えない日が増えました。電話の声も、少し元気がありません。`,
        choices: [{ label: '休みの日を空けて、会いに行く' }, { label: '野球を優先して、連絡も減らす' }],
        autoIndex: 0,
      }),
    resolve: (c, choice) => {
      const name = c.s.family.partner
      if (!name) return
      if (choice === 0) {
        bump(c, { happy: 3, rel: 2 })
        c.add('good', rotate(c.s, 'life.strain', [`短い休みに${name}さんのもとへ向かい、一緒に過ごした一日で、気持ちが落ち着きました。`, `${name}さんの部屋で手料理を食べ、遠征の疲れが抜けていきました。`]))
      } else if (c.rng.chance(0.4)) {
        c.s.family.partner = undefined
        clearFlag(c.s, 'life.dating')
        bump(c, { happy: -6, rel: -2 })
        c.add('bad', `${name}さんから、「このままでは続けられない」と告げられ、別れることになりました。`, { key: true })
      } else {
        bump(c, { happy: -2 })
        c.add('decision', `${name}さんは何も言いませんでしたが、返信までの間隔が少しずつ長くなりました。`)
      }
    },
  },
  // ------------------------------------------------------------ marriage
  {
    id: 'life.proposal',
    category: 'lifeLove',
    stages: ['amateur', 'pro'],
    ages: [22, 42],
    // after 「もう少しこのままでいる」 the question waits two years (love.wait, shared with love.propose and us.propose), then comes back
    // by itself (family.ts bookProposal); never twice in a year
    when: (s) => !!s.family.partner && !s.family.spouse && flagAge(s, 'life.dating') >= 2 && flagAge(s, 'love.wait') >= 2 && s.evHist?.['life.proposal']?.[0] !== s.age,
    // having talked about the future (life.futureTalk) makes it likelier
    weight: (s) => (s.flags?.['life.future'] ? 7 : 5),
    cooldown: 1,
    maxPerLife: 4,
    lifePass: true,
    extra: true,
    run: (c) =>
      c.ask({
        id: 'life.proposal',
        weight: 'major',
        title: '結婚',
        body: `${c.s.family.partner}さん${partnerWords(c.s)}との交際が${flagAge(c.s, 'life.dating')}年になりました。野球を続けながらの結婚を、考えるようになりました。`,
        choices: [{ label: '結婚を申し込む' }, { label: 'もう少しこのままでいる' }, { label: '別々の道を歩む' }],
        autoIndex: 0,
      }),
    resolve: (c, choice) => {
      const name = c.s.family.partner
      // never a second marriage on top of the first, never a proposal to nobody
      if (!name || c.s.family.spouse) return
      if (choice === 0) {
        marry(c, name)
        bump(c, { happy: 10, money: -80 })
        c.add('big', `${name}さんと結婚しました。`, { key: true })
      } else if (choice === 1) {
        setFlag(c.s, 'love.wait')
        bookProposal(c.s)
        bump(c, { happy: 1 })
        c.add('decision', rotate(c.s, 'life.proposal', ['結婚の話は、シーズンが終わってから考えることにしました。', '今の距離のまま、もう少し一緒に過ごすことにしました。']))
      } else {
        c.s.family.partner = undefined
        clearFlag(c.s, 'life.dating')
        bump(c, { happy: -6 })
        c.add('decision', `${name}さんとは、それぞれの道を歩むことになりました。`)
      }
    },
  },
  // ------------------------------------------------------------ children
  {
    id: 'life.childTalk',
    category: 'lifeFamily',
    stages: ['amateur', 'pro'],
    ages: [24, 44],
    when: (s) => married(s) && s.family.spouse!.years >= 1 && s.family.children < 3 && !taken(s, 'family.noKids') && !taken(s, 'family.wantKid'),
    weight: 2.5,
    cooldown: 3,
    maxPerLife: 3,
    lifePass: true,
    extra: true,
    run: (c) =>
      c.ask({
        id: 'life.childTalk',
        weight: 'major',
        title: '子どもについて',
        body: c.s.family.children === 0 ? `${c.s.family.spouse!.name}さんと、これからの家族について話し合いました。` : 'もう一人、子どもを望むかどうか話し合いました。',
        choices: [{ label: '子どもを望む' }, { label: '今はシーズンに集中する' }, { label: c.s.family.children === 0 ? '子どもは持たないと決める' : 'これ以上は望まない' }],
        autoIndex: 0,
      }),
    resolve: (c, choice) => {
      if (choice === 0) {
        if (!taken(c.s, 'family.wantKid')) c.s.taken.push('family.wantKid')
        c.add('decision', c.s.family.children === 0 ? '子どもを望むことにしました。' : 'もう一人、子どもを望むことにしました。')
      } else if (choice === 1) c.add('decision', rotate(c.s, 'life.childTalk', ['子どものことは、シーズンが落ち着いてから考えることにしました。', '今は二人で、野球に打ち込む暮らしを続けることにしました。']))
      else {
        if (!taken(c.s, 'family.noKids')) c.s.taken.push('family.noKids')
        c.add('decision', c.s.family.children === 0 ? '二人で生きていくと決めました。' : '今の家族で暮らしていくと決めました。')
      }
    },
  },
  {
    id: 'life.birth',
    category: 'lifeFamily',
    stages: ['amateur', 'pro'],
    ages: [24, 46],
    when: (s) => married(s) && taken(s, 'family.wantKid') && s.age - seenAt(s, 'life.childTalk') >= 1,
    weight: 6,
    cooldown: 1,
    maxPerLife: 6,
    lifePass: true,
    extra: true,
    run: (c) => {
      // not every wish comes true in a year (assumption, the same as family.birth)
      if (!c.rng.chance(0.7)) return
      const f = c.s.family
      f.children++
      const kid = addKid(c.s)
      c.s.taken = c.s.taken.filter((t) => t !== 'family.wantKid')
      bump(c, { happy: 10 })
      c.add('big', f.children === 1 ? `第一子の${kid}が生まれました。試合のない日を選んで、病院へ駆けつけました。` : `${f.children}人目の子ども、${kid}が生まれました。家族が一人増えました。`, { key: true })
    },
  },
  {
    id: 'life.parenting',
    category: 'lifeFamily',
    stages: ['amateur', 'pro'],
    when: (s) => youngKids(s) > 0 && married(s),
    weight: 1.8,
    cooldown: 3,
    maxPerLife: 4,
    lifePass: true,
    extra: true,
    run: (c) =>
      c.ask({
        id: 'life.parenting',
        weight: 'minor',
        title: '遠征続きの子育て',
        body: '遠征やキャンプで家を空けることが続き、子どもが玄関で「今度はいつ帰ってくるの」と聞いてきました。',
        choices: [{ label: '休みの日は、家族との時間を最優先にする' }, { label: '野球に専念し、家のことは任せる' }],
        autoIndex: 0,
      }),
    resolve: (c, choice) => {
      if (choice === 0) {
        bump(c, { happy: 4, rel: 3 })
        c.add('good', rotate(c.s, 'life.parenting', ['オフの日は、公園でキャッチボールをして過ごしました。子どもの笑い声が、何よりの休養になりました。', '遠征から戻った日は、すぐに子どもを風呂に入れました。']))
      } else {
        bump(c, { happy: -1, rel: -3 })
        c.add('decision', rotate(c.s, 'life.parenting', ['家のことは任せきりになり、帰宅した夜は、家族の会話に入れずにいました。', '育児はほとんど任せたまま、シーズンが過ぎていきました。']))
      }
    },
  },
  // ------------------------------------------------------------ a marriage that fails
  {
    id: 'life.divorce',
    category: 'lifeLove',
    stages: ['univ', 'amateur', 'pro'],
    ages: [24, 55],
    when: (s) => married(s) && s.family.spouse!.years >= 2,
    // the more strained his relations, the likelier (an assumption)
    weight: (s) => 0.35 * (s.status.relations < 40 ? 2.2 : s.status.relations < 55 ? 1.2 : 0.6) * (s.flags?.['life.apart'] ? 1.8 : 1),
    cooldown: 4,
    maxPerLife: 2,
    lifePass: true,
    extra: true,
    run: (c) =>
      c.ask({
        id: 'life.divorce',
        weight: 'major',
        title: 'すれ違いの果てに',
        body: `${c.s.family.spouse!.name}さんとの会話が減り、同じ家にいても、別々の時間を過ごすようになりました。`,
        choices: [{ label: '時間をかけて話し合い、関係を立て直す' }, { label: '離婚を決める' }, { label: 'しばらく距離を置いて、考える' }],
        autoIndex: 0,
      }),
    resolve: (c, choice) => {
      const sp = c.s.family.spouse
      if (!sp) return
      if (choice === 0) {
        bump(c, { rel: 3, happy: 3 })
        c.add('good', `${sp.name}さんと夜通し話し合いました。互いの気持ちがわかり、もう一度やり直すことにしました。`)
      } else if (choice === 2 && c.rng.chance(0.5)) {
        bump(c, { happy: -2 })
        c.add('decision', `しばらく別々に暮らして考えましたが、${sp.name}さんのもとへ戻り、やり直すことにしました。`)
      } else {
        const f = c.s.family
        f.spouse = null
        f.ended = 'divorce'
        f.endedAge = c.s.age
        bump(c, { happy: -12, rel: -4, money: -(200 + 60 * f.children) })
        c.add('big', `${sp.name}さんと離婚しました。${f.children ? '子どもとは、定期的に会う約束をしました。' : ''}`, { key: true })
      }
    },
  },
  // ------------------------------------------------------------ the family at home
  {
    id: 'life.homeCall',
    category: 'lifeFamily',
    stages: ['univ', 'amateur', 'pro'],
    ages: [19, 45],
    when: (s) => s.family.father !== null || s.family.mother !== null,
    weight: 1.5,
    cooldown: 3,
    maxPerLife: 5,
    lifePass: true,
    extra: true,
    run: (c) =>
      c.ask({
        id: 'life.homeCall',
        weight: 'minor',
        title: '実家から',
        body: '実家から電話がありました。「今度の休みには、顔を見せに帰ってこられるのか」と聞かれました。',
        choices: [{ label: '休みを使って、実家に帰る' }, { label: '電話で近況を伝えて済ませる' }],
        // おまかせ: no change of state
        autoIndex: 1,
      }),
    resolve: (c, choice) => {
      if (choice === 0) {
        bump(c, { happy: 3, rel: 2, money: -5 })
        c.add('good', rotate(c.s, 'life.homeCall', ['実家に帰ると、食卓には好物が並んでいました。親は試合の話を、何度も聞きたがりました。', '帰省した日、親が飾っていた古いユニフォームの前で、写真を撮りました。']))
      } else c.add('decision', rotate(c.s, 'life.homeCall', ['電話で近況を伝え、「今度は必ず帰る」と約束して切りました。', '忙しさを理由に、帰省は見送りました。']))
    },
  },
  // ------------------------------------------------------------ rumours of a known pro
  {
    id: 'life.rumor',
    category: 'lifeFame',
    stages: ['pro'],
    ages: [20, 45],
    // only a man who is known: the first team of a pro league and still in the pros; the better known, the likelier (an assumption)
    when: (s) => fameOf(s) > 0 && !s.family.spouse,
    weight: (s) => 0.7 * fameOf(s),
    cooldown: 3,
    maxPerLife: 3,
    lifePass: true,
    extra: true,
    run: (c) => {
      const s = c.s
      if (!s.family.partner) {
        // a single man: a rumour with nothing behind it, a line and no change (this is also the おまかせ answer)
        c.add('normal', rotate(s, 'life.rumor', ['週刊誌に、知人女性との食事が「熱愛か」と書かれました。ただの友人でしたが、しばらく球場で冷やかされました。', 'インターネットの掲示板で、根も葉もない交際の噂が広まりました。球団広報が、静かに対応してくれました。']))
        return
      }
      c.ask({
        id: 'life.rumor',
        weight: 'minor',
        title: '熱愛報道',
        body: `${s.family.partner}さんと並んで歩く姿が、週刊誌に撮られました。球団の広報から、どう答えるか尋ねられています。`,
        choices: [{ label: '交際を認めて、堂々と答える' }, { label: '「友人です」と、かわす' }, { label: '何も答えず、野球で応える' }],
        autoIndex: 0,
      })
    },
    resolve: (c, choice) => {
      const name = c.s.family.partner
      if (!name) return
      if (choice === 0) {
        bump(c, { happy: 3, rel: 2 })
        c.add('good', `交際を認めると、${name}さんへの祝福の声が、ファンからも届きました。`)
      } else if (choice === 1) {
        bump(c, { happy: -2, rel: -3 })
        c.add('decision', `「友人です」と答えたことを、${name}さんは何も言わずに聞いていました。`)
      } else {
        bump(c, { happy: 1 })
        c.add('decision', '記事には何も答えず、次の試合に集中しました。数日で話題は静まりました。')
      }
    },
  },
  ...more(),
]

/**
 * The relationship as it is lived (PROJECT_PLAN §11.45): distance, a quarrel and the making up, an anniversary, talking about the future,
 * the wedding, living apart for the job, the strain of an injury or a slump, time with the wife, and the talk about life after baseball.
 * Every one of them needs a partner or a spouse (which only a choice on screen can give), so a headless life never reaches them and the
 * calibrated lives are as they were. They set flags (`life.*`) that the later ones and the existing proposal and divorce read; the
 * money, happiness and relations change by the choice only, once. Probabilities and amounts are game assumptions.
 */
function more(): EventDef[] {
  const dating = (s: LifeState) => !!s.family.partner && !s.family.spouse && flagAge(s, 'life.dating') >= 1
  const duo = (s: LifeState) => !!s.family.partner || married(s)
  const who = (s: LifeState) => s.family.spouse?.name ?? s.family.partner ?? ''
  const end = (c: EventCtx) => {
    const name = c.s.family.partner
    c.s.family.partner = undefined
    clearFlag(c.s, 'life.dating')
    clearFlag(c.s, 'life.quarrel')
    return name
  }
  return [
    {
      id: 'life.distance',
      category: 'lifeLove',
      stages: ['univ', 'amateur', 'pro'],
      when: (s) => dating(s) && !s.flags?.['life.distance'],
      weight: 0.5,
      cooldown: 4,
      maxPerLife: 1,
      lifePass: true,
      extra: true,
      run: (c) =>
        c.ask({
          id: 'life.distance',
          weight: 'minor',
          title: '遠く離れて',
          body: `移動や転居で、${c.s.family.partner}さんと遠く離れて暮らすことになりました。`,
          choices: [{ label: '毎週、ビデオ通話の時間を決める' }, { label: '会える日に、まとめて会う' }, { label: '連絡は気が向いたときだけにする' }],
          autoIndex: 1,
        }),
      resolve: (c, choice) => {
        setFlag(c.s, 'life.distance')
        if (choice === 0) {
          bump(c, { happy: 2, rel: 3, money: -10 })
          c.add('good', `毎週決まった時間に、${c.s.family.partner}さんと顔を見て話す習慣ができました。`)
        } else if (choice === 1) {
          bump(c, { happy: 1, money: -20 })
          c.add('decision', '会える日は、移動に時間をかけても、一日を一緒に過ごすことにしました。')
        } else {
          setFlag(c.s, 'life.quarrel')
          bump(c, { happy: -3, rel: -2 })
          c.add('bad', `連絡が間遠になり、${c.s.family.partner}さんとの間に、少しずつ距離が生まれました。`)
        }
      },
    },
    {
      id: 'life.quarrel',
      category: 'lifeLove',
      stages: ['univ', 'amateur', 'pro'],
      when: (s) => dating(s) && !s.flags?.['life.quarrel'],
      weight: (s) => (s.flags?.['life.distance'] ? 1 : 0.4),
      cooldown: 3,
      maxPerLife: 3,
      lifePass: true,
      extra: true,
      run: (c) =>
        c.ask({
          id: 'life.quarrel',
          weight: 'minor',
          title: 'すれ違い',
          body: `約束の日に試合が入り、${c.s.family.partner}さんと言い争いになりました。`,
          choices: [{ label: 'すぐに謝って、話を聞く' }, { label: '時間を置いてから連絡する' }],
          autoIndex: 0,
        }),
      resolve: (c, choice) => {
        const name = c.s.family.partner
        if (!name) return
        if (choice === 0) {
          bump(c, { happy: 2, rel: 2 })
          c.add('good', `${name}さんの話を聞き、約束を守れなかったことを謝りました。仲直りはその日のうちにできました。`)
        } else {
          setFlag(c.s, 'life.quarrel')
          bump(c, { happy: -2 })
          c.add('decision', `${name}さんから、その後の連絡はありませんでした。`)
        }
      },
    },
    {
      id: 'life.makeup',
      category: 'lifeLove',
      stages: ['univ', 'amateur', 'pro'],
      when: (s) => !!s.family.partner && !s.family.spouse && flagAge(s, 'life.quarrel') >= 1,
      weight: 6,
      cooldown: 1,
      maxPerLife: 3,
      lifePass: true,
      extra: true,
      run: (c) =>
        c.ask({
          id: 'life.makeup',
          weight: 'major',
          title: '仲直り',
          body: `${c.s.family.partner}さんとは、あれから気まずいままです。`,
          choices: [{ label: '会いに行って、素直に気持ちを伝える' }, { label: 'このまま距離を置く' }],
          autoIndex: 0,
        }),
      resolve: (c, choice) => {
        const name = c.s.family.partner
        if (!name) return
        clearFlag(c.s, 'life.quarrel')
        if (choice === 0 && c.rng.chance(0.75)) {
          bump(c, { happy: 5, rel: 3, money: -10 })
          c.add('good', `${name}さんに会って気持ちを伝えると、「待っていた」と言われました。前より、お互いのことを話せるようになりました。`)
        } else if (choice === 0) {
          const n = end(c)
          bump(c, { happy: -5, rel: -2 })
          c.add('bad', `気持ちを伝えましたが、${n}さんの心は、もう離れていました。`, { key: true })
        } else {
          const n = end(c)
          bump(c, { happy: -4 })
          c.add('decision', `${n}さんとは、そのまま連絡を取らなくなりました。`)
        }
      },
    },
    {
      id: 'life.anniversary',
      category: 'lifeLove',
      stages: ['univ', 'amateur', 'pro'],
      when: (s) => dating(s) && flagAge(s, 'life.dating') >= 1,
      weight: 0.7,
      cooldown: 2,
      maxPerLife: 3,
      lifePass: true,
      extra: true,
      // (the paid answer only for one who can pay it; one who cannot is offered a present of his own making: never a choice that turns
      // into the other one)
      run: (c) =>
        c.ask(
          {
            id: 'life.anniversary',
            weight: 'minor',
            title: '記念日',
            body: `${c.s.family.partner}さんと付き合い始めて、${flagAge(c.s, 'life.dating')}年の記念日が近づいています。`,
            choices: [c.s.money >= 60 ? { label: '店を予約して、贈り物を用意する', hint: '約40万円' } : { label: '手作りの贈り物を用意する', hint: 'お金はかからないが、時間をかける' }, { label: '家で、ゆっくり過ごす' }],
            autoIndex: 1,
          },
          { paid: c.s.money >= 60 },
        ),
      resolve: (c, choice, d) => {
        if (choice === 0 && d.paid === true) {
          bump(c, { happy: 5, rel: 2, money: -40 })
          c.add('good', rotate(c.s, 'life.anniversary', ['予約した店で、二人で祝いました。贈り物を、大事そうに受け取ってくれました。', '少し背伸びした店での食事は、ふだんより長い会話になりました。']))
        } else if (choice === 0) {
          bump(c, { happy: 4, rel: 3 })
          c.add('good', '時間をかけて作った贈り物を渡すと、照れくさそうに笑ってくれました。')
        } else {
          bump(c, { happy: 2, rel: 1 })
          c.add('decision', rotate(c.s, 'life.anniversary', ['記念日は、家で手料理を食べて過ごしました。', '外には出ず、アルバムを見ながら、二人でゆっくり過ごしました。']))
        }
      },
    },
    {
      id: 'life.futureTalk',
      category: 'lifeLove',
      stages: ['amateur', 'pro'],
      ages: [22, 42],
      when: (s) => dating(s) && flagAge(s, 'life.dating') >= 2 && !s.flags?.['life.future'],
      weight: 2,
      cooldown: 2,
      maxPerLife: 1,
      lifePass: true,
      extra: true,
      run: (c) =>
        c.ask({
          id: 'life.futureTalk',
          weight: 'major',
          title: 'これからの話',
          body: `${c.s.family.partner}さんから、野球のあとの暮らしや、結婚をどう考えているのか尋ねられました。`,
          choices: [{ label: '将来のことを、正直に話し合う' }, { label: '「今は野球で精いっぱい」と答える' }],
          autoIndex: 0,
        }),
      resolve: (c, choice) => {
        if (choice === 0) {
          setFlag(c.s, 'life.future')
          bump(c, { happy: 3, rel: 3 })
          c.add('good', `${c.s.family.partner}さんと、住みたい街や子どものこと、野球のあとの仕事まで話し合いました。結婚を考える気持ちが、はっきりしました。`)
        } else {
          bump(c, { happy: -1, rel: -1 })
          c.add('decision', `${c.s.family.partner}さんは「わかった」とだけ答えました。`)
        }
      },
    },
    {
      id: 'life.weddingPrep',
      category: 'lifeLove',
      stages: ['amateur', 'pro'],
      when: (s) => married(s) && s.family.spouse!.years <= 1 && !s.flags?.['life.wedding'],
      weight: 6,
      cooldown: 1,
      maxPerLife: 1,
      lifePass: true,
      extra: true,
      // (the paid answers only for one who can pay them, a meal with the two families for one who cannot: the last answer, 先送り, is
      // always there and is おまかせ's)
      run: (c) => {
        const keys = [...(c.s.money >= 300 ? ['wedding'] : []), ...(c.s.money >= 80 ? ['photo'] : ['meal']), 'later']
        const all: Record<string, { label: string; hint?: string }> = {
          wedding: { label: '親族や球団の仲間を招いて、式を挙げる', hint: '約250万円' },
          photo: { label: '写真だけ残して、費用は新生活にあてる', hint: '約40万円' },
          meal: { label: '両家の家族だけで、食事会を開く', hint: 'お金はあまりかからない' },
          later: { label: '落ち着くまで、式は先送りにする' },
        }
        c.ask(
          {
            id: 'life.weddingPrep',
            weight: 'major',
            title: '結婚式と新生活',
            body: `${c.s.family.spouse!.name}さんとの、式や新しい暮らしの準備を考える時期です。`,
            choices: keys.map((k) => all[k]),
            autoIndex: keys.length - 1,
          },
          { keys: keys.join(',') },
        )
      },
      resolve: (c, choice, d) => {
        setFlag(c.s, 'life.wedding')
        // (a question asked before the keys were kept: the old three answers)
        const key = (d.keys === undefined ? ['wedding', 'photo', 'later'] : String(d.keys).split(','))[choice] ?? 'later'
        if (key === 'wedding' && c.s.money >= 300) {
          bump(c, { happy: 6, rel: 4, money: -250 })
          c.add('good', '式には家族と、監督やチームメートも駆けつけてくれました。')
        } else if (key === 'photo' && c.s.money >= 80) {
          bump(c, { happy: 3, rel: 2, money: -40 })
          c.add('decision', '二人で写真を撮り、残りは新居の家具にあてました。')
        } else if (key === 'meal') {
          bump(c, { happy: 3, rel: 3 })
          c.add('decision', '両家の家族だけで、小さな食事会を開きました。')
        } else {
          bump(c, { happy: 1 })
          c.add('decision', '式は、シーズンが落ち着いてから考えることにしました。')
        }
      },
    },
    {
      id: 'life.apart',
      category: 'lifeFamily',
      stages: ['amateur', 'pro'],
      when: (s) => married(s) && !s.flags?.['life.apart'] && !s.flags?.['life.apartStay'] && (s.family.children > 0 || s.family.spouse!.years >= 1),
      weight: 0.4,
      cooldown: 4,
      maxPerLife: 2,
      lifePass: true,
      extra: true,
      // (the reason to move follows his team: a company player's new place of work, a pro's club and its home ground; the second move is
      // told as a second one)
      run: (c) =>
        c.ask({
          id: 'life.apart',
          weight: 'major',
          title: '転居と家族',
          body: c.s.career.phase === 'company' ? '会社の新しい勤務地への異動が決まりました。家族をどうするか、決める必要があります。' : '球団の本拠地から離れた家では、移動の負担が大きくなってきました。家族をどうするか、決める必要があります。',
          // (a third way, feedback r11 A7: the two answers both moved him; staying put is a choice too. Added last: おまかせ is unchanged)
          choices: [
            { label: '家族で引っ越す', hint: '約60万円' },
            { label: c.s.career.phase === 'company' ? '単身で赴任し、家族は今の街に残す' : '自分だけ近くに部屋を借り、家族は今の街に残す' },
            c.s.career.phase === 'company'
              ? { label: '異動を断り、今の勤務地に残れないか会社と話す', hint: '家族の暮らしは変わらないが、会社での評価は下がるかもしれない' }
              : { label: '引っ越さず、今の家から通い続ける', hint: '家族の暮らしは変わらないが、移動の疲れは続く' },
          ],
          autoIndex: 0,
        }),
      resolve: (c, choice) => {
        if (choice === 0) {
          bump(c, { happy: 1, rel: 3, money: -60 })
          const again = (c.s.evHist?.['life.apart']?.[1] ?? 1) >= 2
          // (where they live from now, place.ts: the company's new office in another region; a pro club's home, which the game does not keep)
          let to: string | undefined
          if (c.s.career.phase === 'company') to = moveAway(c.s, 'far', 0x7a2)
          else moveUnknown(c.s)
          c.add(
            'decision',
            to || c.s.career.phase === 'company'
              ? `家族で${again ? '、また' : ''}${to ? `${to}の` : ''}新しい街に移りました。${c.s.family.spouse?.name ?? '妻'}さんも、新しい生活に慣れようとしています。`
              : `家族で${again ? '、また' : ''}球団の本拠地に近い街へ移りました。${c.s.family.spouse?.name ?? '妻'}さんも、新しい生活に慣れようとしています。`,
          )
        } else if (choice === 2) {
          // (no move: the family stays, the cost is his; a flag of its own keeps the question from coming back, not 'life.apart',
          // which would start life.apartEnd: the end of a time apart that never began)
          setFlag(c.s, 'life.apartStay')
          bump(c, c.s.career.phase === 'company' ? { happy: 1, rel: 2 } : { happy: -1, rel: 2 })
          c.add('decision', c.s.career.phase === 'company' ? '異動は断り、今の勤務地に残してもらえないか、上司と何度も話し合いました。家族の暮らしは、このまま続きます。' : '引っ越しはせず、今の家から本拠地へ通い続けることにしました。移動は長くても、家に帰れば家族がいます。')
        } else {
          setFlag(c.s, 'life.apart')
          bump(c, { happy: -3, rel: -2, money: -30 })
          c.add('decision', c.s.career.phase === 'company' ? '単身で赴任することにしました。休みの日は、家族のもとへ通います。' : '本拠地の近くに、一人で部屋を借りました。休みの日は、家族のもとへ通います。')
        }
      },
    },
    {
      id: 'life.apartEnd',
      category: 'lifeFamily',
      stages: ['amateur', 'pro'],
      when: (s) => married(s) && flagAge(s, 'life.apart') >= 2,
      weight: 6,
      cooldown: 1,
      maxPerLife: 2,
      lifePass: true,
      extra: true,
      run: (c) =>
        c.ask({
          id: 'life.apartEnd',
          weight: 'major',
          title: '別々の暮らしの終わりに',
          body: `単身赴任が続き、${c.s.family.spouse!.name}さんとは、月に数日しか会えていません。`,
          choices: [{ label: '家族を呼び寄せて、一緒に暮らす', hint: '約50万円' }, { label: 'もうしばらく、今の形で続ける' }],
          autoIndex: 0,
        }),
      resolve: (c, choice) => {
        if (choice === 0) {
          clearFlag(c.s, 'life.apart')
          bump(c, { happy: 5, rel: 4, money: -50 })
          c.add('good', '家族と同じ家で暮らせるようになりました。食卓に家族がいる日常が、戻ってきました。')
        } else {
          setFlag(c.s, 'life.apart')
          bump(c, { happy: -2, rel: -3 })
          c.add('decision', '別々の暮らしは、もうしばらく続くことになりました。電話の回数が、少しずつ減っていきます。')
        }
      },
    },
    {
      id: 'life.slumpTalk',
      category: 'lifeLove',
      stages: ['amateur', 'pro'],
      when: (s) => duo(s) && (s.status.health < 50 || s.status.happiness < 40),
      weight: 0.8,
      cooldown: 3,
      maxPerLife: 3,
      lifePass: true,
      extra: true,
      run: (c) =>
        c.ask({
          id: 'life.slumpTalk',
          weight: 'minor',
          title: '不調のとき',
          body: `故障や不振が続き、${who(c.s)}さんの前でも、口数が減っています。`,
          choices: [{ label: '弱音を打ち明けて、支えてもらう' }, { label: '一人で抱えて、野球に向き合う' }],
          autoIndex: 0,
        }),
      resolve: (c, choice) => {
        if (choice === 0) {
          bump(c, { happy: 4, rel: 3 })
          c.add('good', `${who(c.s)}さんは、黙って最後まで聞いてくれました。「どんな結果でも、味方でいる」と言ってくれました。`)
        } else {
          bump(c, { happy: -2, rel: -2 })
          c.add('decision', `何も話さないまま、${who(c.s)}さんは、少し離れたところから見守っていました。`)
        }
      },
    },
    {
      id: 'life.spouseTime',
      category: 'lifeFamily',
      stages: ['amateur', 'pro'],
      when: (s) => married(s),
      weight: 0.6,
      cooldown: 3,
      maxPerLife: 4,
      lifePass: true,
      extra: true,
      run: (c) =>
        c.ask({
          id: 'life.spouseTime',
          weight: 'minor',
          title: '二人の時間',
          body: `オフの日、${c.s.family.spouse!.name}さんから「たまには二人で出かけたい」と言われました。`,
          choices: [{ label: '練習を休んで、二人で出かける', hint: '約15万円' }, { label: '自主練習を優先する' }],
          autoIndex: 0,
        }),
      resolve: (c, choice) => {
        if (choice === 0) {
          bump(c, { happy: 4, rel: 3, money: -15 })
          c.add('good', rotate(c.s, 'life.spouseTime', ['二人で遠出をして、野球のことを一日忘れました。', '二人で映画を見て、帰りに食事をしました。']))
        } else {
          bump(c, { happy: -1, rel: -2 })
          c.add('decision', `自主練習を優先し、${c.s.family.spouse!.name}さんは、一人で出かけていきました。`)
        }
      },
    },
    {
      id: 'life.afterTalk',
      category: 'lifeFamily',
      stages: ['amateur', 'pro'],
      ages: [28, 45],
      when: (s) => duo(s) && !taken(s, 'life.afterTalk') && (s.career.phase === 'pro' || s.career.phase === 'abroad' ? s.career.proSeasons >= 6 : s.age >= 32),
      weight: 0.8,
      cooldown: 3,
      maxPerLife: 1,
      lifePass: true,
      extra: true,
      run: (c) =>
        c.ask({
          id: 'life.afterTalk',
          weight: 'major',
          title: '引退後の暮らし',
          body: `${who(c.s)}さんと、野球をやめたあとの仕事や暮らしについて、話す機会がありました。`,
          choices: [{ label: '貯金や仕事を、一緒に具体的に考える' }, { label: '決めるのは、そのときになってから' }],
          autoIndex: 1,
        }),
      resolve: (c, choice) => {
        if (choice === 0) {
          c.s.taken.push('life.afterTalk')
          bump(c, { happy: 3, rel: 3 })
          c.add('good', `${who(c.s)}さんと、野球のあとの仕事や、住む場所、必要なお金を書き出して話し合いました。先のことが、少し見えるようになりました。`)
        } else {
          c.add('decision', `${who(c.s)}さんは、「そのときは、一緒に考えよう」と言ってくれました。`)
        }
      },
    },
  ]
}

export const LIFE_LOVE_EVENTS: EventDef[] = LIFE
