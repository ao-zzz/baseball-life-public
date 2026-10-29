import { rotate, type EventCtx, type EventDef } from './events.ts'
import type { LifeState } from './types.ts'
import type { JobOffer } from './after.ts'
import { shownAge } from './displayAge.ts'
import { companyText, ensureAfter, firstYearIncome, jobOffers, loseWork, setWork, severance } from './after.ts'
import { clamp } from './math.ts'
import { PARTNER_NAMES } from '../data/jp.ts'
import { addKid, bookProposal, drawPartner, infoWords, kidNameOf, partnerWords } from './family.ts'
import { companyJob, employed, hasFamily, hasFlag, hasSibling } from './events/spec.ts'
import { moveAway } from './place.ts'
import { graduationAge } from './license.ts'

// Life after baseball: work, money and housing, family, friends and community, health, staying with
// baseball, goals and second attempts, old age (PROJECT_PLAN §11.6, stage 5).
// Probabilities here are model assumptions (stats workModel / householdModel / lifeEventModel),
// not statistics. Nothing is compulsory: marriage, children, coaching or a new job can all be declined.
// All texts are original.

const A = (s: LifeState) => ensureAfter(s)
const notPlaying = (s: LifeState) => !['youth', 'jhs', 'hs', 'univ', 'company', 'indep', 'proMinor', 'pro', 'abroad'].includes(s.career.phase)
const working = (s: LifeState) => !!s.after?.work && !s.after.retired
const played = (s: LifeState) => s.career.highestRank > 0
const flag = (s: LifeState, f: string) => s.taken.includes(f)
const setFlag = (s: LifeState, f: string) => {
  if (!s.taken.includes(f)) s.taken.push(f)
}
const seenAt = (s: LifeState, id: string) => s.evHist?.[id]?.[0] ?? -99
/**
 * the hobbies hobby.adult starts, each with the fact that he has it (s.flags; the same facts as lifeStories x.life.hobby and the
 * spending events' hobby, so that no event starts again a hobby he already has)
 */
const ADULT_HOBBIES = [
  ['hobby.fish', '休みの日に、釣りに出かけるようになりました。'],
  ['hobby.golf', 'ゴルフを始め、職場の仲間とコースを回りました。'],
  ['hobby.bike', '週末に、近所の川沿いを自転車で走るようになりました。'],
  ['hobby.books', '昔から好きだった歴史の本を、夜に少しずつ読んでいます。'],
] as const
const paidText =(paid: number) => (paid > 0 ? `退職金として${paid}万円を受け取りました。` : '')
/** which child: the name when it is known (family.ts), else 上の子, 下の子, … (kids are kept oldest first) */
function kidName(s: LifeState, i: number): string {
  const name = kidNameOf(s, i)
  if (name) return name
  const kids = s.family.kids ?? []
  if (kids.length <= 1) return '子ども'
  if (i === 0) return '上の子'
  if (i === kids.length - 1) return '下の子'
  return '真ん中の子'
}

function bump(c: EventCtx, o: { happy?: number; rel?: number; know?: number; health?: number; money?: number; sat?: number }) {
  const st = c.s.status
  if (o.happy) st.happiness = clamp(st.happiness + o.happy, 5, 100)
  if (o.rel) st.relations = clamp(st.relations + o.rel, 5, 100)
  if (o.know) st.knowledge = clamp(st.knowledge + o.know, 1, 99)
  if (o.health) st.health = clamp(st.health + o.health, 5, 100)
  if (o.money) c.s.money += o.money
  const w = c.s.after?.work
  if (o.sat && w) w.satisfaction = clamp(w.satisfaction + o.sat, 0, 100)
}

/** the age at which this person starts looking for work */
function workAge(s: LifeState): number {
  // (a student: when his course ends, 22 for four years, later for six or a late entrance; license.ts)
  return s.job === '大学生' ? graduationAge(s) : 18
}

const FACT_WAGE = '男性の一般労働者の賃金（月額）は、20〜24歳で245.7千円、55〜59歳で445.6千円が最も高い（厚生労働省、2025年）。ゲームの年収は、これに賞与や勤め先の差の仮定を足したもの。'
const FACT_JOBLESS = '2025年平均の男性の完全失業率は2.7%（総務省 労働力調査）。仕事を探している人の割合で、1年のうちに職を失う確率ではない。'

function jobDecision(c: EventCtx, id: string, title: string, body: string) {
  const offers = jobOffers(c.s, (n) => c.rng.int(0, n - 1))
  // three doors plus the part-time option, like a real job search
  // (the work of his licence is always among them: a licensed graduate is not left to chance among three doors; feedback r11 A8)
  const sure = (o: (typeof offers)[number]) => o.key === 'license' || (o.key === 'teacher' && c.s.license?.kind === 'teacher' && c.s.license.ok !== undefined)
  const picked: typeof offers = offers.filter(sure)
  const main = offers.filter((o) => o.key !== 'parttime' && !sure(o))
  while (picked.length < 3 && main.length) picked.push(main.splice(c.rng.int(0, main.length - 1), 1)[0])
  picked.push(offers.find((o) => o.key === 'parttime')!)
  // おまかせ prefers stable work (an assumption about what people usually choose); the licensed work first
  // (a graduate of an education university holds the teacher's licence: teaching comes first for him)
  const PREF = c.s.license?.kind === 'teacher' && c.s.license.ok !== undefined
    ? ['teacher', 'license', 'large', 'public', 'small', 'factory', 'sporting', 'family', 'care', 'shop', 'parttime']
    : ['license', 'large', 'public', 'teacher', 'small', 'factory', 'sporting', 'family', 'care', 'shop', 'parttime']
  const best = picked.reduce((a, o, i) => (PREF.indexOf(o.key) < PREF.indexOf(picked[a].key) ? i : a), 0)
  const search = id === 'work.search'
  c.ask(
    {
      id,
      weight: 'major',
      title,
      body,
      // each door with its pay: the same figure that is paid once he works there (after.ts firstYearIncome)
      choices: picked.map((o) => ({ label: o.label, hint: payHint(c.s, o, offers) })),
      autoIndex: best,
      factText: search ? FACT_JOBLESS : FACT_WAGE,
      factStatIds: search ? ['jpUnemployMale'] : ['jpWageMale', 'workModel'],
    },
    // the jobs exactly as offered (the employer of the factory is drawn here: the same one is taken)
    { keys: picked.map((o) => o.key).join(','), works: JSON.stringify(picked.map((o) => o.work)) },
  )
}

function payHint(s: LifeState, o: JobOffer, offers: JobOffer[]): string {
  const pay = `年収 約${firstYearIncome(s, o.work).toLocaleString()}万円（来年から）`
  const part = offers.find((x) => x.key === 'parttime')
  const fail = o.key === 'public' && part ? `。不合格ならアルバイト（年収 約${firstYearIncome(s, part.work).toLocaleString()}万円）` : ''
  const cost = o.key === 'shop' ? '。開業に200万円かかる' : ''
  // the employer: a fictional company, its business and size (after.ts companyFor)
  const where = o.work.company ? `${companyText(o.work.company)}。` : ''
  return `${where}${o.hint ? `${o.hint}。` : ''}${pay}${fail}${cost}`
}

function resolveJob(c: EventCtx, choice: number, d: Record<string, number | boolean | string>) {
  const keys = String(d.keys).split(',')
  const key = keys[choice] ?? 'small'
  const shown = d.works !== undefined ? (JSON.parse(String(d.works)) as JobOffer['work'][])[choice] : undefined
  const listed = jobOffers(c.s, () => 0).find((o) => o.key === key) ?? jobOffers(c.s, () => 0)[0]
  const offer = shown ? { ...listed, work: shown } : listed
  if (key === 'public' && !c.rng.chance(clamp(0.25 + (c.s.status.knowledge - 55) / 60, 0.1, 0.8))) {
    c.add('bad', rotate(c.s, c.s.evHist?.['work.search'] ? 'work.search' : 'work.first', ['公務員試験は不合格でした。しばらくアルバイトで食いつなぎます。', '公務員試験は、あと少しのところで届きませんでした。アルバイトをしながら次を考えます。', '今年も公務員試験には受かりませんでした。当面はアルバイトで暮らします。']))
    setWork(c.s, { ...jobOffers(c.s, () => 0).find((o) => o.key === 'parttime')!.work })
    return
  }
  if (key === 'shop') bump(c, { money: -200 })
  setWork(c.s, { ...offer.work })
  const t = offer.work.title
  const at = offer.work.company ? `${offer.work.company.name}で、` : ''
  c.add('decision', rotate(c.s, c.s.evHist?.['work.search'] ? 'work.search' : 'work.first', [`${at}${t}として働き始めました。`, `新しい職場${offer.work.company ? `の${offer.work.company.name}` : ''}で、${t}として再出発しました。`, `${at}${t}として、もう一度一から働き始めました。`]), { key: c.s.age < 30 })
}

/** the questions about the job he holds: one waiting in the year is dropped if an earlier answer cost him the job (EventDef.requires) */
const JOB_QUESTIONS = new Set(['work.promotion', 'work.transfer', 'work.boss', 'work.overwork', 'work.offer', 'work.layoff', 'work.shop', 'work.retire60', 'work.project', 'work.late', 'work.junior', 'senior.retire65'])

export const AFTER_EVENTS: EventDef[] = [
  // ------------------------------------------------------------------ work
  {
    id: 'work.first',
    category: 'work',
    stages: ['adult'],
    priority: true,
    when: (s) => notPlaying(s) && !s.after?.work && !s.after?.retired && s.age >= workAge(s) && s.age < 60 && !flag(s, 'work.started'),
    // (not for one who chose a university earlier in the same year: life.ts jp.afterPath)
    requires: (s) => s.job !== '大学生',
    maxPerLife: 3,
    cooldown: 1,
    run: (c) => {
      setFlag(c.s, 'work.started')
      jobDecision(c, 'work.first', '仕事を選ぶ', c.s.career.highestRank >= 5 ? '野球中心の毎日が終わりました。これからの仕事を選びます。' : '働き始める時が来ました。どんな仕事を選びますか。')
    },
    resolve: resolveJob,
  },
  {
    id: 'work.search',
    category: 'work',
    stages: ['adult'],
    priority: true,
    // (not while he cares for the parent he left his job for: x.life.careLeave; the search comes back once that parent is gone)
    when: (s) => notPlaying(s) && flag(s, 'work.started') && !s.after?.work && !s.after?.retired && s.age < 65 && !(s.flags?.['care.leave'] !== undefined && (s.family.father !== null || s.family.mother !== null)),
    maxPerLife: 6,
    cooldown: 1,
    run: (c) => {
      A(c.s).jobless++
      jobDecision(c, 'work.search', '仕事を探す', `仕事のない日が続いています。${c.s.career.highestRank >= 3 ? '昔の野球仲間にも声をかけてみました。' : ''}どこで働きますか。`)
    },
    resolve: resolveJob,
  },
  {
    id: 'work.promotion',
    category: 'career',
    stages: ['adult'],
    when: (s) => working(s) && s.after!.work!.regular && s.after!.work!.employer !== 'self' && s.after!.work!.level < 4 && s.after!.work!.years >= 3 + s.after!.work!.level * 4,
    weight: (s) => clamp(0.8 + (s.status.relations - 50) / 50 + (s.status.knowledge - 50) / 80 + (s.career.achievements.includes('主将') ? 0.3 : 0), 0.2, 3),
    cooldown: 3,
    maxPerLife: 4,
    run: (c) => {
      const w = c.s.after!.work!
      const next = ['主任', '係長', '課長', '部長'][w.level] ?? '部長'
      c.ask({
        id: 'work.promotion',
        weight: 'major',
        title: `${next}への昇進`,
        body: `${next}にならないかと打診されました。給料は上がりますが、責任も重くなります。`,
        choices: [{ label: '引き受ける', hint: '収入が上がる。忙しくなる' }, { label: '今の立場で現場に残る', hint: '気持ちに余裕がある' }],
        autoIndex: 0,
      })
    },
    resolve: (c, choice) => {
      // the job may have ended earlier in the same year
      const w = c.s.after?.work
      if (!w) return
      if (choice === 0) {
        w.level++
        bump(c, { happy: 4, health: -3, sat: 4 })
        const t = ['主任', '係長', '課長', '部長'][w.level - 1] ?? '部長'
        c.add('good', rotate(c.s, 'work.promotion', [`${t}になりました。`, `${t}に昇進しました。`, `${t}を任されることになりました。`, `${t}として、部下を持つ立場になりました。`]), { key: w.level >= 3 })
      } else {
        bump(c, { happy: 2, sat: -2 })
        c.add('decision', '昇進の話は断り、現場に残ることにしました。')
      }
    },
  },
  {
    id: 'work.transfer',
    category: 'career',
    stages: ['adult'],
    when: (s) => working(s) && (s.after!.work!.employer === 'large' || s.after!.work!.employer === 'public') && s.after!.work!.years >= 2 && s.age < 58,
    weight: 1,
    cooldown: 5,
    maxPerLife: 2,
    // (the answers shown are kept with the question: a marriage that ends before the answer does not turn 「断る」 into 単身赴任; public
    // service moves a man to another office, not to a branch)
    run: (c) => {
      const keys = ['move', ...(c.s.family.spouse ? ['single'] : []), 'decline']
      const pub = c.s.after?.work?.employer === 'public'
      c.ask(
        {
          id: 'work.transfer',
          weight: 'major',
          title: pub ? '異動の内示' : '転勤の内示',
          body: pub ? '遠くの職場への異動を打診されました。' : '遠くの支店への転勤を打診されました。',
          choices: keys.map((k) => (k === 'move' ? { label: c.s.family.spouse ? '家族で引っ越す' : '引っ越して新しい土地へ', hint: '評価が上がる' } : k === 'single' ? { label: '単身赴任する', hint: '家族と離れて暮らす' } : { label: '断る', hint: '昇進は遠のくかもしれない' })),
          autoIndex: 0,
        },
        { keys: keys.join(',') },
      )
    },
    resolve: (c, choice, d) => {
      const w = c.s.after?.work
      if (!w) return
      // (a question asked before the answers were kept: read as it was shown then)
      const keys = d.keys !== undefined ? String(d.keys).split(',') : ['move', ...(c.s.family.spouse ? ['single'] : []), 'decline']
      const key = keys[choice] ?? 'decline'
      const single = key === 'single'
      const decline = key === 'decline'
      if (decline) {
        w.years = Math.max(0, w.years - 2)
        bump(c, { sat: -6, happy: 1 })
        c.add('decision', '転勤の話を断りました。')
      } else if (single) {
        bump(c, { rel: -4, money: -40, sat: 4, happy: -4 })
        c.add('decision', '単身赴任を始めました。週末に新幹線で帰る日々です。')
      } else {
        bump(c, { rel: -2, sat: 5, happy: -1 })
        // (a branch or an office in another region: where he lives from now, place.ts)
        const to = moveAway(c.s, 'far', 0x7a1)
        c.add('decision', `${to}の新しい土地に引っ越しました。近所の人の顔を覚えるところからです。`)
      }
    },
  },
  {
    id: 'work.boss',
    category: 'workplace',
    stages: ['adult'],
    when: employed,
    weight: 1,
    cooldown: 4,
    maxPerLife: 3,
    run: (c) =>
      c.ask({
        id: 'work.boss',
        weight: 'minor',
        title: '上司とのすれ違い',
        body: '新しい上司のやり方に、どうしても納得できません。',
        choices: [
          { label: '思ったことを率直に伝える', hint: 'うまくいけば信頼される' },
          { label: 'やり方に合わせる', hint: '波風は立たない' },
          { label: '異動を願い出る' },
        ],
        autoIndex: 1,
      }),
    resolve: (c, choice) => {
      const w = c.s.after?.work
      if (!w) return
      if (choice === 0) {
        const ok = c.rng.chance(clamp(0.4 + (c.s.status.relations - 50) / 100, 0.15, 0.8))
        bump(c, ok ? { sat: 8, rel: 4 } : { sat: -8, happy: -4 })
        c.add('decision', ok ? '話し合ってみると、上司も同じことで悩んでいました。' : '話はかみ合わず、職場の居心地が悪くなりました。')
      } else if (choice === 1) {
        bump(c, { sat: -3, health: -1 })
        c.add('decision', rotate(c.s, 'work.boss', ['言いたいことをのみこんで、上司のやり方に合わせました。', '今回は黙って、上司の方針に従うことにしました。', '不満は胸にしまい、与えられた仕事をこなしました。']))
      } else {
        bump(c, { sat: 3 })
        w.years = Math.max(0, w.years - 1)
        c.add('decision', '異動を願い出て、別の部署に移りました。')
      }
    },
  },
  {
    id: 'work.colleague',
    category: 'workplace',
    stages: ['adult'],
    when: employed,
    weight: 1,
    cooldown: 3,
    maxPerLife: 3,
    run: (c) => {
      bump(c, { rel: 4, sat: 3 })
      const lines = ['職場の後輩に仕事を教えるうちに、自分の仕事の見方も変わりました。', '同僚と一緒に大きな案件をやり遂げ、打ち上げで乾杯しました。', '職場の野球好きと、昼休みにキャッチボールをするようになりました。']
      const t = rotate(c.s, 'work.colleague', lines)
      // (the toast only from 20 at the start of the year, the legal drinking age in Japan for the whole year: before, the first line in its place)
      c.add('good', c.s.age < 20 && t === lines[1] ? lines[0] : t)
    },
  },
  {
    id: 'work.overwork',
    category: 'workplace',
    stages: ['adult'],
    when: (s) => employed(s) && s.age < 60,
    weight: (s) => 0.6 + (s.after?.work?.level ?? 0) * 0.3,
    cooldown: 4,
    maxPerLife: 3,
    run: (c) =>
      c.ask({
        id: 'work.overwork',
        weight: 'minor',
        title: '残業が続く',
        body: '忙しい時期が何か月も続き、帰りは毎晩遅くなっています。',
        choices: [{ label: 'このまま乗り切る', hint: '評価は上がる。体にはこたえる' }, { label: '思い切って休みを取る', hint: '体を立て直す' }],
        autoIndex: c.s.status.health < 50 ? 1 : 0,
      }),
    resolve: (c, choice) => {
      if (choice === 0) {
        bump(c, { health: -6, sat: 3, happy: -3 })
        c.add('decision', rotate(c.s, 'work.overwork', ['休まずに乗り切りました。体重が少し落ちました。', '終電で帰る日が続きましたが、なんとか乗り切りました。', '休日も仕事をして、山場を越えました。']))
      } else {
        bump(c, { health: 5, sat: -2, happy: 3 })
        c.add('decision', rotate(c.s, 'work.overwork', ['1週間の休みを取り、家でゆっくり過ごしました。', '思い切って有給休暇を取り、温泉で体を休めました。', '上司に相談して、仕事を少し減らしてもらいました。']))
      }
    },
  },
  {
    id: 'work.offer',
    category: 'career',
    stages: ['adult'],
    when: (s) => working(s) && s.age < 55 && (s.after!.work!.years >= 3 || !s.after!.work!.regular) && !s.after!.work!.kind,
    weight: (s) => (s.after!.work!.satisfaction < 45 ? 1.6 : 0.6) + (s.status.relations - 50) / 100,
    cooldown: 5,
    maxPerLife: 3,
    run: (c) => {
      const offers = jobOffers(c.s, (n) => c.rng.int(0, n - 1)).filter((o) => o.key !== 'parttime' && o.work.title !== c.s.after!.work!.title)
      if (offers.length === 0) return
      const o = offers[c.rng.int(0, offers.length - 1)]
      c.ask(
        {
          id: 'work.offer',
          weight: 'major',
          title: '転職の誘い',
          body: `知り合いから、「${o.work.title}」として働かないかという話が来ました。今の仕事を続けますか。`,
          // both pays, as they would be paid next year (after.ts firstYearIncome; the present job at its present post)
          choices: [
            { label: '思い切って移る', hint: payHint(c.s, o, []) },
            { label: '今の仕事を続ける', hint: `年収 約${firstYearIncome(c.s, c.s.after!.work!).toLocaleString()}万円（来年）` },
          ],
          autoIndex: c.s.after!.work!.satisfaction < 40 ? 0 : 1,
        },
        { key: o.key, work: JSON.stringify(o.work) },
      )
    },
    resolve: (c, choice, d) => {
      if (choice === 0) {
        const listed = jobOffers(c.s, () => 0).find((x) => x.key === d.key)
        // the job exactly as offered (the factory's employer was drawn when it was offered)
        const o = listed && d.work !== undefined ? { ...listed, work: JSON.parse(String(d.work)) as JobOffer['work'] } : listed
        if (o) {
          if (o.key === 'shop') bump(c, { money: -200 })
          const paid = setWork(c.s, { ...o.work })
          bump(c, { happy: 3 })
          c.add('decision', `転職して、${o.work.title}になりました。${paidText(paid)}`, { key: true })
        }
      } else {
        bump(c, { sat: 2 })
        c.add('decision', rotate(c.s, 'work.offer', ['誘いは断り、今の仕事を続けることにしました。', 'ありがたい話でしたが、今の職場に残ることにしました。', '少し迷いましたが、今の仕事を続けることにしました。']))
      }
    },
  },
  {
    id: 'work.layoff',
    category: 'career',
    stages: ['adult'],
    when: (s) => working(s) && s.after!.work!.employer !== 'public' && s.after!.work!.employer !== 'team' && s.age < 60 && !s.after!.work!.kind,
    weight: (s) => (s.after!.work!.employer === 'self' ? 0.35 : s.after!.work!.regular ? 0.2 : 0.45),
    cooldown: 6,
    maxPerLife: 2,
    run: (c) => {
      const self = c.s.after!.work!.employer === 'self'
      const paid = loseWork(c.s)
      A(c.s).jobless = 0
      bump(c, { happy: -8, money: self ? -100 : 0 })
      c.add('bad', self ? '売り上げが回復せず、店をたたむことにしました。' : `会社の業績が悪化し、職を失いました。${paidText(paid)}`, { key: true })
    },
  },
  {
    id: 'work.shop',
    // only for a player who chose to open a shop: おまかせ prefers stable work (PREF in jobDecision), so it never does
    needsChoice: true,
    category: 'career',
    stages: ['adult'],
    when: (s) => working(s) && s.after!.work!.employer === 'self' && s.after!.work!.industry === 'food' && s.after!.work!.years >= 1 && s.after!.work!.years <= 5,
    weight: 2,
    cooldown: 2,
    maxPerLife: 2,
    run: (c) => {
      const good = c.rng.chance(clamp(0.45 + (c.s.status.relations - 50) / 120, 0.2, 0.75))
      if (good) {
        bump(c, { money: 80, happy: 6, sat: 6 })
        c.add('good', c.s.career.highestRank >= 3 ? '店に昔の野球仲間が集まるようになり、常連が増えました。' : '近所の評判が広まり、昼どきは行列ができるようになりました。')
      } else {
        c.ask({
          id: 'work.shop',
          weight: 'major',
          title: '店の売り上げが落ちた',
          body: '近くに大きな店ができ、客が減っています。',
          choices: [{ label: '借金をしてでも店を続ける', hint: '持ち直すかもしれない' }, { label: '店をたたんで、働きに出る' }],
          autoIndex: 1,
        })
      }
    },
    resolve: (c, choice) => {
      if (choice === 0) {
        bump(c, { money: -120, happy: -2 })
        c.add('decision', '店を続けることにしました。メニューを一から見直しました。')
      } else {
        loseWork(c.s)
        bump(c, { happy: -5 })
        c.add('decision', '店をたたみ、次の仕事を探すことにしました。')
      }
    },
  },
  {
    id: 'work.retire60',
    category: 'career',
    stages: ['adult'],
    priority: true,
    ages: [60, 64],
    // 定年 applies to a regular job held for a while (someone hired at 60 works on to 65)
    when: (s) => working(s) && s.after!.work!.employer !== 'self' && s.after!.work!.regular && s.after!.work!.years >= 2 && !flag(s, 'work.retire60') && !s.after!.work!.kind && !['retire.keep', 'retire.full', 'retire.small'].some((f) => hasFlag(s, f)),
    maxPerLife: 1,
    run: (c) => {
      setFlag(c.s, 'work.retire60')
      c.ask({
        id: 'work.retire60',
        weight: 'major',
        title: '定年',
        // (no number: the event fires from the model's age 60, which the screen shows as 61)
        body: '定年を迎えます。これからの働き方を選びます。',
        choices: [
          { label: '再雇用で、同じ職場で働き続ける', hint: '給料は下がるが、慣れた仕事' },
          { label: '退職して、地域や趣味の時間にする', hint: '年金と貯金で暮らす' },
          { label: '別の仕事を探す' },
        ],
        autoIndex: c.s.money < 1000 ? 0 : 1,
      })
    },
    resolve: (c, choice) => {
      const a = A(c.s)
      if (!a.work) return
      if (choice === 0) {
        const paid = severance(c.s)
        a.work = { ...a.work!, regular: false, level: 0, years: 0, title: `${a.work!.title}（再雇用）` }
        c.s.job = a.work.title
        c.add('decision', `再雇用で、同じ職場で働き続けることにしました。${paidText(paid)}`)
      } else if (choice === 1) {
        a.retired = true
        const paid = loseWork(c.s)
        c.s.job = '引退'
        bump(c, { happy: 4 })
        c.add('milestone', `仕事を退職しました。長い間、お疲れさまでした。${paidText(paid)}`, { key: true })
      } else {
        const paid = loseWork(c.s)
        c.add('decision', `会社を離れ、別の仕事を探すことにしました。${paidText(paid)}`)
      }
    },
  },
  {
    id: 'work.project',
    category: 'career',
    stages: ['adult'],
    when: (s) => employed(s) && s.after!.work!.years >= 2,
    weight: 1,
    cooldown: 4,
    maxPerLife: 4,
    run: (c) => {
      // knowledge and relations help a project succeed (assumption)
      const ok = c.rng.chance(clamp(0.5 + (c.s.status.knowledge - 50) / 120 + (c.s.status.relations - 50) / 150, 0.2, 0.85))
      if (ok) {
        bump(c, { sat: 6, happy: 3 })
        c.add('good', rotate(c.s, 'work.project', ['任された仕事がうまくいき、職場で表彰されました。', '取引先から名指しで感謝の電話がありました。', '担当した仕事が、会社の新聞で紹介されました。', '新しい仕事の進め方を提案し、職場で採用されました。']))
      } else {
        bump(c, { sat: -5, happy: -3 })
        c.add('bad', rotate(c.s, 'work.project', ['任された仕事で大きな失敗をし、取引先に謝りに行きました。', '準備してきた仕事が、直前で取りやめになりました。', '仕事の締め切りに間に合わず、上司に頭を下げました。', '職場の目標に届かず、悔しい1年になりました。']))
      }
    },
  },
  {
    id: 'work.late',
    category: 'career',
    stages: ['adult'],
    ages: [50, 64],
    when: (s) => working(s) && s.after!.work!.years >= 10,
    weight: 1.2,
    cooldown: 4,
    maxPerLife: 3,
    run: (c) => {
      bump(c, { sat: 2, rel: 2 })
      const t = rotate(c.s, 'work.late', ['長く担当してきた仕事を、後輩に引き継ぎ始めました。', '職場で最年長の一人になり、若い人の相談を受けることが増えました。', '定年後の暮らしについて、会社の説明会に出ました。', '若いころに一緒に働いた先輩の送別会で、乾杯の音頭を取りました。'])
      // (a man who works for himself has no 定年 and no company's meeting)
      c.add('milestone', c.s.after?.work?.employer === 'self' && t.startsWith('定年後') ? 'この先、いつまで今の仕事を続けるか、考えるようになりました。' : t)
    },
  },
  {
    id: 'work.junior',
    category: 'workplace',
    stages: ['adult'],
    when: (s) => companyJob(s) && s.after!.work!.years >= 4 && s.age >= 28,
    weight: 0.8,
    cooldown: 5,
    maxPerLife: 3,
    run: (c) => {
      bump(c, { rel: 3, sat: 2 })
      c.add('good', rotate(c.s, 'work.junior', ['新人の指導係になりました。野球部の後輩に教えた日のことを思い出します。', '後輩の結婚式に招かれ、職場代表としてあいさつをしました。', '辞めようか迷っていた後輩の相談に乗り、もう少し続けることになりました。']))
    },
  },
  // ------------------------------------------------------------------ home and money
  {
    id: 'home.leave',
    category: 'home',
    stages: ['adult'],
    ages: [21, 45],
    priority: true,
    when: (s) => s.after?.home === 'parents' && working(s) && s.after.work!.years >= 1,
    cooldown: 3,
    maxPerLife: 4,
    run: (c) =>
      c.ask({
        id: 'home.leave',
        weight: 'minor',
        title: '一人暮らし',
        // (written when the year is planned: words that read right even if the job ends later in the same year)
        body: c.s.age < 30 ? '社会に出て、しばらくたちました。実家を出ますか。' : '実家での暮らしが長くなりました。そろそろ家を出ますか。',
        choices: [{ label: '部屋を借りて一人暮らしを始める', hint: '家賃がかかる' }, { label: 'もうしばらく実家にいる', hint: 'お金がたまる' }],
        // (assumption: most men leave home in their twenties, some stay)
        autoIndex: c.rng.chance(c.s.age >= 26 ? 0.7 : 0.4) ? 0 : 1,
      }),
    resolve: (c, choice) => {
      if (choice === 0) {
        A(c.s).home = 'rent'
        bump(c, { happy: 3, money: -30 })
        c.add('decision', '部屋を借りて、一人暮らしを始めました。')
      } else {
        bump(c, { rel: 1 })
        c.add('decision', rotate(c.s, 'home.leave', ['もうしばらく実家で暮らすことにしました。', '親の手伝いもあり、実家に残ることにしました。', '貯金のために、もう少し実家にいることにしました。', '家を出る話は、また先に延ばしました。']))
      }
    },
  },
  {
    id: 'home.buy',
    category: 'home',
    stages: ['adult'],
    ages: [28, 55],
    // a loan of 2,800万円 needs a steady income (assumption)
    when: (s) => s.after?.home === 'rent' && s.money >= 300 && working(s) && s.income >= 380,
    weight: (s) => (s.family.spouse ? 1.5 : 0.5),
    cooldown: 4,
    maxPerLife: 2,
    run: (c) =>
      c.ask({
        id: 'home.buy',
        weight: 'major',
        title: '家を買う？',
        body: '貯金がたまってきました。家を買うか、借りたままにするか。',
        choices: [{ label: 'ローンを組んで家を買う', hint: '頭金300万円。毎年の返済が続く' }, { label: '賃貸のままにする', hint: '身軽でいられる' }],
        autoIndex: c.s.family.spouse ? 0 : 1,
      }),
    resolve: (c, choice) => {
      const a = A(c.s)
      if (choice === 0 && (c.s.money < 300 || a.home !== 'rent')) {
        c.add('decision', '頭金が足りなくなり、家を買うのは見送りました。')
      } else if (choice === 0) {
        a.home = 'own'
        a.loan = 2800
        bump(c, { money: -300, happy: 6 })
        c.add('big', '家を買いました。返済はこれからです。', { key: true })
      } else {
        bump(c, { happy: 1 })
        c.add('decision', '家は買わず、賃貸のままにしました。')
      }
    },
  },
  {
    id: 'money.tight',
    category: 'money',
    stages: ['adult', 'senior'],
    priority: true,
    when: (s) => s.money < 0,
    cooldown: 2,
    maxPerLife: 6,
    run: (c) =>
      c.ask({
        id: 'money.tight',
        weight: 'major',
        title: '家計が赤字',
        body: `貯金が底をつき、${Math.abs(Math.round(c.s.money))}万円の赤字です。どうしますか。`,
        choices: [
          { label: '生活を切り詰める', hint: '気持ちに余裕がなくなる' },
          working(c.s) || c.s.after?.retired || c.s.age >= 65 ? { label: '空いた時間に副業をする', hint: '体にはこたえる' } : { label: '短い時間でも働ける仕事を探す', hint: '収入は少ないが、毎月入る' },
          ...(c.s.family.father !== null || c.s.family.mother !== null ? [{ label: '親に相談する', hint: '頼るのは心苦しい' }] : []),
        ],
        autoIndex: working(c.s) || c.s.after?.retired || c.s.age >= 65 ? 0 : 1,
      }),
    resolve: (c, choice) => {
      if (choice === 1 && !working(c.s) && !c.s.after?.retired && c.s.age < 65) {
        setWork(c.s, { ...jobOffers(c.s, () => 0).find((o) => o.key === 'parttime')!.work })
        c.add('decision', 'アルバイトを始め、毎月の収入を少しでも確保することにしました。')
      } else if (choice === 0) {
        bump(c, { money: 60, happy: -5 })
        c.add(
          'decision',
          rotate(
            c.s,
            'money.tight',
            working(c.s)
              ? ['外食をやめ、毎月の支出を一つずつ見直しました。', '携帯電話の契約を見直し、車も手放しました。', '弁当を持って出勤し、飲み会を断るようになりました。', '保険と電気の契約を見直し、旅行は先に延ばしました。']
              : ['外食をやめ、毎月の支出を一つずつ見直しました。', '携帯電話の契約を見直し、車も手放しました。', '趣味にかけるお金を減らし、家で過ごす日を増やしました。', '保険と電気の契約を見直し、旅行は先に延ばしました。'],
          ),
        )
      } else if (choice === 1) {
        bump(c, { money: 90, health: -4 })
        c.add('decision', rotate(c.s, 'money.tight', ['週末に配送のアルバイトを始めました。', '夜に倉庫での仕分けのアルバイトを始めました。', '休みの日に、知り合いの店を手伝うことにしました。', '休日に、引っ越しの手伝いのアルバイトをしています。']))
      } else {
        bump(c, { money: 120, rel: -2, happy: -2 })
        c.add('decision', '親に事情を話し、少し助けてもらいました。')
      }
    },
  },
  {
    id: 'money.car',
    category: 'money',
    stages: ['adult'],
    when: (s) => s.money >= 400 && working(s),
    weight: 0.8,
    cooldown: 8,
    maxPerLife: 2,
    run: (c) =>
      c.ask({
        id: 'money.car',
        weight: 'minor',
        title: '車を買い替える？',
        body: '乗っている車が古くなってきました。',
        choices: [{ label: '新しい車を買う', hint: '200万円' }, { label: '修理して乗り続ける', hint: '30万円' }],
        autoIndex: 1,
      }),
    resolve: (c, choice) => {
      if (choice === 0) {
        bump(c, { money: -200, happy: 4 })
        c.add('decision', '新しい車を買いました。最初の遠出は、昔よく通った球場でした。')
      } else {
        bump(c, { money: -30 })
        c.add('decision', '修理して、もうしばらく乗り続けることにしました。')
      }
    },
  },
  // ------------------------------------------------------------------ love and family
  {
    id: 'love.meet',
    category: 'love',
    stages: ['adult'],
    ages: [21, 50],
    when: (s) => !s.family.spouse && !s.family.partner,
    // tuned so that the share never married at 50 comes near the statistic (jpNeverMarried50Male)
    weight: (s) => clamp((s.age < 36 ? 2.6 : 0.7) * (0.5 + s.status.relations / 100), 0.1, 3.6),
    cooldown: 3,
    maxPerLife: 4,
    run: (c) => {
      const name = c.rng.pick(PARTNER_NAMES)
      const drawn = c.rng.pick(['友人の結婚式で', '職場で', '同窓会で', '草野球の応援に来ていた', '地域の行事で'])
      // (the same draw; without a job, the workplace is a friend's introduction)
      const where = drawn === '職場で' && !working(c.s) ? '友人の紹介で' : drawn
      // who they are (age, work): drawn on a stream of its own (family.ts), shown before he decides and kept if they date
      const info = drawPartner(c.s, name, 1)
      c.ask(
        {
          id: 'love.meet',
          weight: 'major',
          title: '出会い',
          body: `${where}、${name}さん${infoWords(c.s, info)}と出会いました。話が合い、何度か食事に行きました。`,
          choices: [{ label: '交際を申し込む' }, { label: '今は一人でいたい', hint: '自分の時間を大切にする' }],
          autoIndex: c.rng.chance(0.82) ? 0 : 1,
        },
        { name, gap: info.gap, job: info.job },
      )
    },
    resolve: (c, choice, d) => {
      if (choice === 0) {
        const ok = c.rng.chance(clamp(0.5 + (c.s.status.relations - 50) / 100, 0.2, 0.85))
        if (ok) {
          c.s.family.partner = String(d.name)
          if (d.job !== undefined) c.s.family.partnerInfo = { name: String(d.name), gap: Number(d.gap), job: String(d.job) }
          bump(c, { happy: 6 })
          c.add('good', `${d.name}さんと付き合い始めました。`)
        } else {
          bump(c, { happy: -4 })
          c.add('decision', rotate(c.s, 'love.meet', ['思い切って気持ちを伝えましたが、友人のままでいることになりました。', '交際を申し込みましたが、丁寧に断られました。', '何度か会ううちに、お互いに違う道を考えていると気づきました。', '気持ちを伝えましたが、相手には別の人がいました。']))
        }
      } else {
        bump(c, { happy: 1 })
        c.add('decision', rotate(c.s, 'love.meet', ['今は一人の時間を大切にすることにしました。', '楽しい時間でしたが、それ以上は踏み込みませんでした。', '今は仕事と自分のことを優先しようと思いました。', 'いい友人として付き合っていくことにしました。']))
      }
    },
  },
  {
    id: 'love.propose',
    category: 'love',
    stages: ['adult'],
    // after 「もう少しこのままでいる」 the question waits two years (love.wait, shared with life.proposal and us.propose), then comes
    // back by itself (bookProposal); never twice in a year (a booking runs beside the year's draw)
    when: (s) => !!s.family.partner && !s.family.spouse && s.age - seenAt(s, 'love.meet') >= 1 && s.age - (s.flags?.['love.wait'] ?? -99) >= 2 && s.evHist?.['love.propose']?.[0] !== s.age,
    weight: 3,
    cooldown: 1,
    maxPerLife: 4,
    // (おまかせ's answer is kept with the question: a wait of his own, against it, books the question two years on; おまかせ's own wait
    // does not, so the おまかせ lives and the share never married they are tuned to stay as they were)
    run: (c) => {
      const auto = c.rng.chance(0.7) ? 0 : 1
      c.ask(
        {
          id: 'love.propose',
          weight: 'major',
          title: '結婚',
          body: `${c.s.family.partner}さん${partnerWords(c.s)}と付き合って、しばらくたちました。`,
          choices: [{ label: '結婚を申し込む' }, { label: 'もう少しこのままでいる' }, { label: '別々の道を歩む' }],
          autoIndex: auto,
          factText: '50歳の時点で一度も結婚していない男性は28.25%（2020年。45〜49歳と50〜54歳の平均、国勢調査にもとづく）。結婚するかどうかは、このゲームでも自分で決められます。',
          factStatIds: ['jpNeverMarried50Male'],
        },
        { auto },
      )
    },
    resolve: (c, choice, d) => {
      const name = c.s.family.partner
      if (!name) return
      // already married: never a second marriage (nor a second "結婚しました") on top of the first
      if (c.s.family.spouse) {
        c.s.family.partner = undefined
        return
      }
      if (choice === 0) {
        c.s.family.spouse = { name, years: 0 }
        c.s.family.everMarried = true
        c.s.family.marriedAge ??= c.s.age
        c.s.family.partner = undefined
        delete c.s.family.ended
        delete c.s.family.endedAge
        bump(c, { happy: 10, money: -80 })
        c.add('big', `${name}さんと結婚しました。`, { key: true })
        if (A(c.s).home === 'parents') {
          A(c.s).home = 'rent'
          c.add('decision', '実家を出て、二人で暮らす部屋を借りました。')
        }
      } else if (choice === 1) {
        c.s.flags = { ...c.s.flags, 'love.wait': c.s.age }
        if (d.auto !== 1) bookProposal(c.s)
        bump(c, { happy: 1 })
        c.add('decision', rotate(c.s, 'love.propose', ['今の関係のまま、もう少し一緒に過ごすことにしました。', '結婚の話は、もう少し先にすることにしました。', 'まずは二人で旅行に行き、お互いをもっと知ることにしました。', '急がず、今の距離を大切にすることにしました。']))
      } else {
        c.s.family.partner = undefined
        bump(c, { happy: -6 })
        c.add('decision', `${name}さんとは、それぞれの道を歩むことになりました。`)
      }
    },
  },
  {
    id: 'family.childTalk',
    category: 'children',
    stages: ['adult'],
    ages: [24, 44],
    priority: true,
    when: (s) => !!s.family.spouse && s.family.spouse.years >= 1 && s.family.children < 3 && !flag(s, 'family.noKids') && !flag(s, 'family.wantKid'),
    cooldown: 3,
    maxPerLife: 4,
    run: (c) =>
      c.ask({
        id: 'family.childTalk',
        weight: 'major',
        title: '子どもについて',
        body: c.s.family.children === 0 ? `${c.s.family.spouse!.name}さんと、これからの家族について話し合いました。` : 'もう一人、子どもを望むかどうか話し合いました。',
        choices: [{ label: '子どもを望む' }, { label: '今は考えない' }, { label: c.s.family.children === 0 ? '子どもは持たないと決める' : 'これ以上は望まない' }],
        // (assumption on what おまかせ chooses: most couples want a first and a second child, fewer a third)
        autoIndex: c.rng.chance(c.s.family.children === 0 ? 0.82 : c.s.family.children === 1 ? 0.75 : 0.22) ? 0 : c.rng.chance(0.3) ? 1 : 2,
      }),
    resolve: (c, choice) => {
      if (choice === 0) {
        setFlag(c.s, 'family.wantKid')
        c.add('decision', c.s.family.children === 0 ? '子どもを望むことにしました。' : c.s.family.children === 1 ? 'もう一人、子どもを望むことにしました。' : '家族がもう一人増えたらと、話し合って決めました。')
      } else if (choice === 1) c.add('decision', rotate(c.s, 'family.childTalk', ['今はまだ、二人の暮らしを大切にすることにしました。', '子どものことは、もう少し先に考えることにしました。', '今の暮らしが落ち着くまで、話は先にしました。']))
      else {
        setFlag(c.s, 'family.noKids')
        c.add('decision', c.s.family.children === 0 ? '二人で生きていくと決めました。' : '今の家族で暮らしていくと決めました。')
      }
    },
  },
  {
    id: 'family.birth',
    category: 'children',
    stages: ['adult'],
    priority: true,
    when: (s) => !!s.family.spouse && flag(s, 'family.wantKid') && s.age - seenAt(s, 'family.childTalk') >= 1,
    cooldown: 1,
    maxPerLife: 12,
    run: (c) => {
      // not every wish comes true in a year (assumption)
      if (!c.rng.chance(0.7)) return
      const f = c.s.family
      f.children++
      const kid = addKid(c.s)
      c.s.taken = c.s.taken.filter((t) => t !== 'family.wantKid')
      bump(c, { happy: 10 })
      c.add('big', f.children === 1 ? `第一子の${kid}が生まれました。` : `${f.children}人目の子ども、${kid}が生まれました。`, { key: true })
    },
  },
  {
    id: 'family.kidBaseball',
    category: 'children',
    stages: ['adult', 'senior'],
    when: (s) => (s.family.kids ?? []).some((k) => k >= 7 && k <= 9) && !flag(s, 'family.kidBaseball'),
    weight: (s) => (played(s) ? 2 : 0.8),
    maxPerLife: 1,
    run: (c) =>
      c.ask({
        id: 'family.kidBaseball',
        weight: 'minor',
        title: '子どもと野球',
        body: '子どもが、近所の学童野球チームの体験会のチラシを持って帰ってきました。',
        choices: [{ label: '一緒に体験会に行く' }, { label: '本人がやりたいことに任せる' }],
        autoIndex: played(c.s) ? 0 : 1,
      }),
    resolve: (c, choice) => {
      setFlag(c.s, 'family.kidBaseball')
      if (choice === 0 && c.rng.chance(0.65)) {
        setFlag(c.s, 'family.kidPlays')
        bump(c, { happy: 6, rel: 3 })
        c.add('good', '子どもが学童野球チームに入りました。週末のキャッチボールが日課になりました。', { key: true })
      } else if (choice === 0) {
        bump(c, { happy: 2 })
        c.add('decision', '体験会に行きましたが、子どもはサッカーのほうが気に入ったようです。')
      } else {
        // (leaving it to the child is not the same as a trial that did not take: the child's own choice, backed by him, brings them closer;
        // おまかせ answers this only for a man who never played, so the other lives are as they were)
        bump(c, { happy: 1, rel: 2 })
        c.add('decision', '野球をすすめるのはやめ、子どもが自分で選んだことを応援することにしました。子どもとの会話が増えました。')
      }
    },
  },
  {
    id: 'family.kidGame',
    category: 'children',
    stages: ['adult', 'senior'],
    when: (s) => flag(s, 'family.kidPlays') && (s.family.kids ?? []).some((k) => k >= 9 && k <= 17),
    weight: 1.5,
    cooldown: 3,
    maxPerLife: 3,
    run: (c) => {
      bump(c, { happy: 5 })
      c.add('good', rotate(c.s, 'family.kidGame', ['子どもの試合を見に行きました。昔の自分と同じ打席の構えをしていて、思わず笑いました。', '子どもが初めてヒットを打ちました。家族でお祝いをしました。', '子どもの最後の大会を、スタンドから見守りました。']))
    },
  },
  {
    id: 'family.kidLeave',
    category: 'children',
    stages: ['adult', 'senior'],
    when: (s) => (s.family.kids ?? []).some((k) => k === 18 || k === 22),
    weight: 2,
    cooldown: 2,
    maxPerLife: 3,
    run: (c) => {
      bump(c, { happy: -1, rel: 1 })
      c.add('milestone', rotate(c.s, 'family.kidLeave', ['子どもが進学で家を出ました。家が少し広く感じます。', '子どもが就職して、一人暮らしを始めました。', '子どもの引っ越しを手伝い、帰りの車で少しさびしくなりました。']))
    },
  },
  {
    id: 'family.grandchild',
    category: 'children',
    stages: ['adult', 'senior'],
    when: (s) => (s.family.kids ?? []).some((k) => k >= 26) && !s.career.achievements.includes('孫'),
    weight: 1.2,
    cooldown: 1,
    maxPerLife: 10,
    run: (c) => {
      if (!c.rng.chance(0.5)) return
      c.s.career.achievements.push('孫')
      bump(c, { happy: 8 })
      c.add('big', '初孫が生まれました。', { key: true })
    },
  },
  {
    id: 'family.quarrel',
    category: 'love',
    stages: ['adult', 'senior'],
    when: (s) => !!s.family.spouse && s.family.spouse.years >= 3,
    weight: 0.7,
    cooldown: 6,
    maxPerLife: 3,
    run: (c) =>
      c.ask({
        id: 'family.quarrel',
        weight: 'minor',
        title: '夫婦のすれ違い',
        body: `${c.s.family.spouse!.name}さんと、ささいなことで言い合いになりました。`,
        choices: [{ label: '自分から謝って話し合う' }, { label: 'しばらく距離を置く' }],
        autoIndex: 0,
      }),
    resolve: (c, choice) => {
      bump(c, choice === 0 ? { rel: 4, happy: 2 } : { rel: -4, happy: -3 })
      c.add(
        'decision',
        choice === 0
          ? rotate(c.s, 'family.quarrel', ['夜遅くまで話し合い、お互いの気持ちがわかりました。', '自分から謝り、次の休みに二人で出かけました。', '話してみると、すれ違いの理由は小さなことでした。'])
          : rotate(c.s, 'family.quarrel', ['数日、口数の少ない日が続きました。', 'しばらく、必要なこと以外は話さない日が続きました。', '気まずい空気のまま、一週間が過ぎました。']),
      )
    },
  },
  {
    id: 'family.anniversary',
    category: 'love',
    stages: ['adult', 'senior'],
    when: (s) => !!s.family.spouse && [10, 25, 40, 50].includes(s.family.spouse.years),
    priority: true,
    cooldown: 5,
    maxPerLife: 4,
    run: (c) => {
      const y = c.s.family.spouse!.years
      const name = c.s.family.spouse!.name
      bump(c, { happy: 4, rel: 2 })
      c.add('milestone', y === 25 ? `${name}さんと銀婚式を迎えました。` : y === 50 ? `${name}さんと金婚式を迎えました。` : `${name}さんと結婚して${y}年になりました。小さな店で、二人でお祝いをしました。`)
    },
  },
  {
    id: 'family.kidSchool',
    category: 'children',
    stages: ['adult', 'senior'],
    when: (s) => (s.family.kids ?? []).some((k) => k === 6 || k === 12 || k === 15),
    priority: true,
    cooldown: 2,
    maxPerLife: 5,
    run: (c) => {
      const kids = c.s.family.kids ?? []
      const i = kids.findIndex((x) => x === 6 || x === 12 || x === 15)
      const k = kids[i]
      const who = kidName(c.s, i)
      bump(c, { happy: 3 })
      c.add('milestone', k === 6 ? `${who}が小学校に入学しました。ランドセルが大きく見えます。` : k === 12 ? `${who}が中学生になりました。制服の採寸に付き添いました。` : `${who}が高校に合格しました。家族で合格を祝いました。`)
    },
  },
  {
    id: 'family.kidWedding',
    category: 'children',
    stages: ['adult', 'senior'],
    // each child is settled once (taken 'family.kidWedding.<i>'): the same eldest child used to marry again every few years
    when: (s) => (s.family.kids ?? []).some((k, i) => k >= 26 && k <= 36 && !s.taken.includes(`family.kidWedding.${i}`)),
    weight: 1.2,
    cooldown: 3,
    maxPerLife: 3,
    run: (c) => {
      const kids = c.s.family.kids ?? []
      const i = kids.findIndex((k, j) => k >= 26 && k <= 36 && !c.s.taken.includes(`family.kidWedding.${j}`))
      if (i < 0) return
      c.s.taken.push(`family.kidWedding.${i}`)
      // (not every child marries; this is one of the ways the family grows, an assumption)
      if (!c.rng.chance(0.6)) return
      const who = kidName(c.s, i)
      bump(c, { happy: 6, rel: 2, money: -50 })
      c.add('big', rotate(c.s, 'family.kidWedding', [`${who}が結婚しました。式で、家族を代表してあいさつをしました。`, `${who}の結婚式に出ました。小さいころのキャッチボールの写真が、スライドに映りました。`, `${who}が結婚相手を連れてきました。少し緊張しながら、一緒に食事をしました。`]), { key: true })
    },
  },
  {
    id: 'family.trip',
    category: 'family',
    stages: ['adult', 'senior'],
    when: (s) => !!s.family.spouse || (s.family.kids ?? []).some((k) => k < 18),
    weight: 0.9,
    cooldown: 4,
    maxPerLife: 4,
    run: (c) => {
      bump(c, { happy: 4, rel: 2, money: -20 })
      c.add('good', rotate(c.s, 'family.trip', ['夏休みに、家族で海へ出かけました。', '家族で、キャンプ場に一泊しました。', '連休に、家族で遠くの親せきの家を訪ねました。', '家族で、プロ野球のナイターを見に行きました。']))
    },
  },
  {
    id: 'parents.visit',
    category: 'parents',
    stages: ['adult'],
    when: (s) => s.after?.home !== 'parents' && (s.family.father !== null || s.family.mother !== null),
    weight: 0.8,
    cooldown: 4,
    maxPerLife: 3,
    run: (c) => {
      bump(c, { rel: 2, happy: 2 })
      const p = c.s.family.father !== null && c.s.family.mother !== null ? '両親' : c.s.family.father !== null ? '父' : '母'
      c.add('good', rotate(c.s, 'parents.visit', [`お盆に実家へ帰り、${p}と庭で夕涼みをしました。`, `${p}の誕生日に、久しぶりに実家で食事をしました。`, `実家の${p}に電話をすると、昔の試合の話になりました。`]))
    },
  },
  {
    id: 'parents.care',
    category: 'parents',
    stages: ['adult', 'senior'],
    when: (s) => ((s.family.father ?? 0) >= 78 || (s.family.mother ?? 0) >= 78) && !s.after?.care,
    weight: 1.5,
    cooldown: 5,
    maxPerLife: 1,
    run: (c) =>
      c.ask({
        id: 'parents.care',
        weight: 'major',
        title: '親の介護',
        body: '年老いた親が、一人で暮らすのが難しくなってきました。',
        choices: [
          // (one who lives in his parents' house already does not move near them: feedback r11 A7)
          { label: c.s.after?.home === 'parents' ? '同じ家で暮らしながら、自分で介護する' : '近くに住んで、自分で介護する', hint: '時間とお金がかかる' },
          { label: '介護の施設を探す', hint: '毎年の費用がかかる' },
          // (a brother only for a man who has one: the model keeps none but the younger brother of his boyhood story)
          { label: hasSibling(c.s) ? '弟と分担する' : '訪問介護や地域の支えと分担する' },
        ],
        autoIndex: 1,
      }),
    resolve: (c, choice) => {
      const a = A(c.s)
      a.care = choice !== 2
      if (choice === 0) {
        bump(c, { health: -4, rel: 5, happy: -2 })
        c.add('decision', c.s.after?.home === 'parents' ? '同じ家で暮らしながら、親の毎日の世話をするようになりました。' : '親の家の近くに移り、毎日顔を出すようになりました。')
      } else if (choice === 1) {
        bump(c, { happy: -1 })
        c.add('decision', '近くの施設に入ってもらい、週末に会いに行くことにしました。')
      } else {
        bump(c, { rel: 2 })
        c.add('decision', hasSibling(c.s) ? '弟と話し合い、交代で様子を見ることにしました。' : '訪問介護と地域の見守りを頼み、自分は週末ごとに様子を見に行くことにしました。')
      }
    },
  },
  // ------------------------------------------------------------------ friends and community
  {
    id: 'friends.reunion',
    category: 'friends',
    stages: ['adult', 'senior'],
    ages: [25, 85],
    when: played,
    weight: 1,
    cooldown: 6,
    maxPerLife: 3,
    run: (c) => {
      bump(c, { rel: 4, happy: 4 })
      const k = c.s.career.achievements.includes('甲子園') ? '甲子園でともに戦った仲間' : c.s.career.highestRank >= 3 ? '高校の野球部の仲間' : '少年野球の仲間'
      c.add(
        'good',
        rotate(c.s, 'friends.reunion', [
          `${k}と久しぶりに集まりました。話はいつのまにか、あの日の試合のことになりました。`,
          `${k}の一人が店を開いたと聞き、みんなで押しかけました。`,
          `${k}と、母校のグラウンドで久しぶりにキャッチボールをしました。`,
        ]),
      )
    },
  },
  {
    id: 'friends.help',
    category: 'friends',
    stages: ['adult', 'senior'],
    weight: 0.7,
    cooldown: 8,
    maxPerLife: 2,
    run: (c) =>
      c.ask({
        id: 'friends.help',
        weight: 'minor',
        title: '友人からの相談',
        body: '古い友人から、仕事がうまくいかずお金に困っていると打ち明けられました。',
        choices: [{ label: 'お金を貸す', hint: '50万円' }, { label: '話を聞いて、仕事探しを手伝う' }, { label: '今回は断る' }],
        autoIndex: 1,
      }),
    resolve: (c, choice) => {
      if (choice === 0) {
        bump(c, { money: -50, rel: 5 })
        c.add('decision', '50万円を貸しました。返ってくるかはわかりません。')
      } else if (choice === 1) {
        bump(c, { rel: 4, happy: 2 })
        c.add('decision', '何度も会って話を聞き、知り合いの会社を紹介しました。')
      } else {
        bump(c, { rel: -4 })
        c.add('decision', '今回は断りました。少し後味の悪さが残りました。')
      }
    },
  },
  {
    id: 'friends.wedding',
    category: 'friends',
    stages: ['adult'],
    ages: [24, 40],
    weight: 0.8,
    cooldown: 3,
    maxPerLife: 3,
    run: (c) => {
      bump(c, { rel: 3, happy: 2, money: -5 })
      c.add('good', rotate(c.s, 'friends.wedding', [played(c.s) ? '野球部の仲間の結婚式で、友人代表のスピーチをしました。' : '学生時代の友人の結婚式で、友人代表のスピーチをしました。', '友人の結婚式の二次会で、幹事を務めました。', '幼なじみの結婚式に出て、懐かしい顔ぶれと再会しました。']))
    },
  },
  {
    id: 'friends.classReunion',
    category: 'friends',
    stages: ['adult'],
    ages: [40, 64],
    weight: 0.9,
    cooldown: 8,
    maxPerLife: 2,
    run: (c) => {
      bump(c, { rel: 3, happy: 3 })
      c.add('good', rotate(c.s, 'friends.classReunion', ['中学校の同窓会に出ました。担任だった先生も来ていました。', '高校の学年の同窓会で、久しぶりに校歌を歌いました。']))
    },
  },
  {
    id: 'hobby.adult',
    category: 'hobby',
    stages: ['adult'],
    ages: [25, 64],
    weight: 0.8,
    cooldown: 5,
    maxPerLife: 3,
    // (a hobby he has not taken up yet, in turn; each one is kept as a fact (hobby.fish …), so that no other event starts it again)
    run: (c) => {
      bump(c, { happy: 3 })
      const start = (s: LifeState) => (s.evHist?.['hobby.adult']?.[1] ?? 1) - 1 + ((s.config.seed >>> 0) % ADULT_HOBBIES.length)
      const s = c.s
      let pick: (typeof ADULT_HOBBIES)[number] | undefined
      for (let i = 0; i < ADULT_HOBBIES.length && !pick; i++) {
        const h = ADULT_HOBBIES[(start(s) + i) % ADULT_HOBBIES.length]
        if (!hasFlag(s, h[0])) pick = h
      }
      if (!pick) return c.add('good', '続けている趣味の時間が、いい息抜きになっています。')
      s.flags = { ...s.flags, [pick[0]]: s.age, 'hobby.started': s.flags?.['hobby.started'] ?? s.age }
      // (without a job, the same round with the neighbours)
      c.add('good', working(s) ? pick[1] : pick[1].replace('職場の仲間', '近所の仲間'))
    },
  },
  {
    id: 'health.minor',
    category: 'health',
    stages: ['adult'],
    ages: [30, 64],
    weight: (s) => (s.status.health < 60 ? 1 : 0.5),
    cooldown: 5,
    maxPerLife: 3,
    run: (c) => {
      bump(c, { health: -2, happy: -1 })
      c.add('bad', rotate(c.s, 'health.minor', ['重い荷物を持ち上げた拍子に、ぎっくり腰になりました。', '風邪をこじらせ、1週間仕事を休みました。', '草むしりのあと、腰の痛みが何日も続きました。']))
    },
  },
  {
    id: 'community.role',
    category: 'community',
    stages: ['adult', 'senior'],
    ages: [35, 80],
    when: (s) => !s.after?.community,
    weight: (s) => (s.family.children > 0 ? 1.2 : 0.6),
    cooldown: 6,
    maxPerLife: 2,
    run: (c) =>
      c.ask({
        id: 'community.role',
        weight: 'minor',
        title: '地域の役員',
        // (the school's PTA only while a child is of school age)
        body: (c.s.family.kids ?? []).some((k) => k >= 6 && k <= 17) ? '子どもの学校のPTAの役員を頼まれました。' : '町内会の役員を頼まれました。',
        choices: [{ label: '引き受ける', hint: '地域に知り合いが増える' }, { label: '忙しいので断る' }],
        autoIndex: c.s.status.relations > 55 ? 0 : 1,
      }),
    resolve: (c, choice) => {
      if (choice === 0) {
        A(c.s).community = true
        bump(c, { rel: 6, happy: 2, health: -1 })
        c.add('decision', '役員を引き受けました。夜の会議が月に一度あります。')
      } else c.add('decision', '今回は断りました。')
    },
  },
  {
    id: 'community.festival',
    category: 'community',
    stages: ['adult', 'senior'],
    when: (s) => !!s.after?.community,
    weight: 1,
    cooldown: 4,
    maxPerLife: 3,
    run: (c) => {
      bump(c, { rel: 4, happy: 4 })
      c.add('good', rotate(c.s, 'community.festival', ['地域の夏祭りで、焼きそばの屋台を任されました。', '通学路の見守り活動で、子どもたちに名前を覚えてもらいました。', '地域の運動会で、綱引きの先頭に立ちました。']))
    },
  },
  // ------------------------------------------------------------------ health
  {
    id: 'health.checkup',
    category: 'health',
    stages: ['adult', 'senior'],
    ages: [35, 90],
    weight: (s) => (s.status.health < 60 ? 1.2 : 0.6),
    cooldown: 7,
    maxPerLife: 3,
    run: (c) =>
      c.ask({
        id: 'health.checkup',
        weight: 'minor',
        title: '健康診断の結果',
        body: '健康診断で、血圧と血糖値が高めだと言われました。',
        choices: [{ label: '食事と運動を見直す', hint: '健康が上向く' }, { label: '気にせず、今のままの生活を続ける' }],
        autoIndex: c.s.status.health < 55 ? 0 : 1,
      }),
    resolve: (c, choice) => {
      bump(c, choice === 0 ? { health: 6, happy: -1 } : { health: -4 })
      c.add(
        'decision',
        choice === 0
          ? rotate(c.s, 'health.checkup', ['晩酌を減らし、朝に歩くようにしました。', '塩分を控えた食事に切り替えました。', '駅の階段を使い、ひと駅分歩くようにしました。'])
          : rotate(c.s, 'health.checkup', ['気にせず、今までどおりの生活を続けました。', '忙しさを理由に、再検査は先に延ばしました。', '結果の紙は、引き出しにしまったままです。']),
      )
    },
  },
  {
    id: 'health.oldInjury',
    category: 'health',
    stages: ['adult', 'senior'],
    ages: [30, 70],
    when: (s) => s.career.highestRank >= 3 && (s.person.position === 'P' || s.evHist?.['hs.injury'] !== undefined),
    weight: 0.8,
    maxPerLife: 1,
    run: (c) =>
      c.ask({
        id: 'health.oldInjury',
        weight: 'minor',
        title: '古傷が痛む',
        body: c.s.person.position === 'P' ? '投げ続けた肘が、雨の日になると痛むようになりました。' : '現役時代に痛めたところが、また痛むようになりました。',
        choices: [{ label: '病院で治療を受ける', hint: '費用がかかる' }, { label: 'だましだまし過ごす' }],
        autoIndex: 0,
      }),
    resolve: (c, choice) => {
      bump(c, choice === 0 ? { money: -30, health: 4 } : { health: -4, happy: -2 })
      c.add('decision', choice === 0 ? '治療を受けて、痛みはずいぶん楽になりました。' : '痛み止めを飲みながら、だましだまし過ごしています。')
    },
  },
  {
    id: 'health.illness',
    category: 'health',
    stages: ['adult', 'senior'],
    ages: [45, 110],
    weight: (s) => clamp(0.2 + (65 - s.status.health) / 50 + (s.age - 45) / 80, 0.1, 2),
    cooldown: 6,
    maxPerLife: 3,
    run: (c) =>
      c.ask({
        id: 'health.illness',
        weight: 'major',
        title: '体の不調',
        body: '検査の結果、しばらく治療が必要だとわかりました。',
        // (written when the year is planned: words that read right even if the job ends later in the same year)
        choices: working(c.s)
          ? [{ label: '治療に専念する', hint: '体は戻るが、お金に響く' }, { label: 'いつもの生活を続けながら治療する', hint: '体に負担がかかる' }]
          : [{ label: '入院して治療を受ける' }, { label: '通院で様子を見る' }],
        autoIndex: 0,
      }),
    resolve: (c, choice) => {
      if (choice === 0) {
        bump(c, { health: 4, money: working(c.s) ? -60 : -30, happy: -3 })
        c.add('bad', rotate(c.s, 'health.illness', ['入院して治療を受けました。病室の窓から、遠くの球場の照明が見えました。', '手術を受け、ひと月ほど入院しました。', '治療に専念し、季節がひとつ過ぎるころに体が戻ってきました。']))
      } else {
        bump(c, { health: -6, happy: -2 })
        c.add('bad', rotate(c.s, 'health.illness', ['通院しながら、治療を続けています。', '薬を飲みながら、いつもの生活を続けています。', '月に一度の通院が、生活の一部になりました。']))
      }
    },
  },
  {
    id: 'health.exercise',
    category: 'health',
    stages: ['adult', 'senior'],
    ages: [30, 80],
    weight: 0.7,
    cooldown: 8,
    maxPerLife: 2,
    run: (c) =>
      c.ask({
        id: 'health.exercise',
        weight: 'minor',
        title: '体を動かす習慣',
        body: '階段を上ると息が切れるようになりました。',
        choices: [{ label: '毎朝のジョギングを始める' }, { label: '今のままでいい' }],
        autoIndex: c.s.status.health < 60 ? 0 : 1,
      }),
    resolve: (c, choice) => {
      bump(c, choice === 0 ? { health: 5, happy: 2 } : { health: -1 })
      c.add('decision', choice === 0 ? '朝6時に家を出て、川沿いを走るようになりました。' : '体を動かすのは、またの機会にしました。')
    },
  },
  // ------------------------------------------------------------------ staying with baseball
  {
    id: 'bbl.kusayakyu',
    category: 'baseballLife',
    stages: ['adult'],
    ages: [22, 60],
    when: (s) => played(s) && !s.after?.baseballLife.includes('草野球'),
    weight: (s) => 0.2 + s.career.highestRank * 0.08 + (s.after?.goal === 'baseball' ? 0.8 : 0),
    cooldown: 6,
    maxPerLife: 2,
    run: (c) =>
      c.ask({
        id: 'bbl.kusayakyu',
        weight: 'minor',
        title: '草野球の誘い',
        // (written when the year is planned: a line that reads right even if he loses the job later in the same year)
        body: '昔の野球仲間から、週末の草野球チームに誘われました。',
        choices: [{ label: '入る', hint: '週末がにぎやかになる' }, { label: '見に行くだけにする' }],
        autoIndex: c.rng.chance(c.s.career.highestRank >= 3 ? 0.35 : 0.15) ? 0 : 1,
      }),
    resolve: (c, choice) => {
      if (choice === 0) {
        A(c.s).baseballLife.push('草野球')
        bump(c, { happy: 5, rel: 4, health: 2 })
        c.add('good', '草野球チームに入りました。久しぶりにスパイクのひもを結びました。', { key: c.s.career.highestRank >= 4 })
      } else {
        bump(c, { rel: 1 })
        c.add('decision', '試合を見に行くだけにしました。ベンチの声が懐かしく聞こえました。')
      }
    },
  },
  {
    id: 'bbl.kusaGame',
    category: 'baseballLife',
    stages: ['adult', 'senior'],
    when: (s) => !!s.after?.baseballLife.includes('草野球') && s.age < 70,
    weight: 1.4,
    cooldown: 2,
    maxPerLife: 4,
    run: (c) => {
      bump(c, { happy: 4, health: 1 })
      c.add('good', rotate(c.s, 'bbl.kusaGame', ['草野球の大会で、チームが優勝しました。', '草野球の試合で、久しぶりにホームランを打ちました。', '草野球の試合のあと、みんなで銭湯に行きました。', '草野球の試合で、高校時代のチームメートと対戦しました。']))
    },
  },
  {
    id: 'bbl.coach',
    category: 'baseballLife',
    stages: ['adult', 'senior'],
    ages: [26, 70],
    when: (s) => played(s) && !s.career.achievements.includes('少年野球の指導'),
    weight: (s) => 0.08 + s.career.highestRank * 0.05 + (s.career.achievements.includes('主将') ? 0.3 : 0) + (flag(s, 'family.kidPlays') ? 1.2 : 0) + (s.after?.goal === 'baseball' ? 0.6 : 0),
    cooldown: 6,
    maxPerLife: 2,
    run: (c) =>
      c.ask({
        id: 'bbl.coach',
        weight: 'major',
        title: '少年野球のコーチ',
        body: flag(c.s, 'family.kidPlays') ? '子どものチームの監督から、コーチを手伝ってほしいと頼まれました。' : '地元の少年野球チームから、コーチを手伝ってほしいと頼まれました。',
        choices: [{ label: '引き受ける', hint: '週末は子どもたちと過ごす' }, { label: '断る' }],
        autoIndex: flag(c.s, 'family.kidPlays') || c.s.career.highestRank >= 4 ? (c.rng.chance(0.45) ? 0 : 1) : 1,
      }),
    resolve: (c, choice) => {
      if (choice === 0) {
        c.s.career.achievements.push('少年野球の指導')
        A(c.s).baseballLife.push('少年野球の指導')
        bump(c, { happy: 6, rel: 5 })
        c.add('good', '少年野球チームのコーチを引き受けました。', { key: true })
      } else c.add('decision', '今は時間が取れないので、断りました。')
    },
  },
  {
    id: 'bbl.coachLife',
    category: 'baseballLife',
    stages: ['adult', 'senior'],
    when: (s) => !!s.after?.baseballLife.includes('少年野球の指導') && s.age < 78,
    weight: 1.5,
    cooldown: 3,
    maxPerLife: 3,
    run: (c) => {
      if (c.rng.chance(0.4)) {
        c.ask({
          id: 'bbl.coachLife',
          weight: 'minor',
          title: '指導方針',
          body: '保護者から、「もっと勝つための練習を」と求められました。',
          choices: [{ label: '楽しさを大切にする方針を説明する' }, { label: '練習を厳しくする' }],
          autoIndex: 0,
        })
      } else {
        bump(c, { happy: 6 })
        c.add('good', rotate(c.s, 'bbl.coachLife', ['教え子が中学でレギュラーになったと、報告に来てくれました。', '教えていた子が、甲子園のテレビ中継に映っていました。', 'チームが市の大会で初めて勝ちました。']))
      }
    },
    resolve: (c, choice) => {
      bump(c, choice === 0 ? { rel: 2, happy: 2 } : { rel: -2, happy: -1 })
      c.add(
        'decision',
        choice === 0
          ? rotate(c.s, 'bbl.coachLife', ['保護者会で話をし、楽しさを大切にする方針を続けることにしました。', '勝つことより、野球を好きになってもらうことを優先すると伝えました。', '試合に全員が出られるよう、練習の組み方を工夫しました。'])
          : rotate(c.s, 'bbl.coachLife', ['練習を厳しくしました。やめていく子もいました。', '練習の時間を増やしました。ついてこられない子も出てきました。', '勝つための練習に切り替えました。子どもたちの顔つきが変わりました。']),
      )
    },
  },
  {
    id: 'bbl.umpire',
    category: 'baseballLife',
    stages: ['adult', 'senior'],
    ages: [30, 65],
    when: (s) => played(s) && !s.after?.baseballLife.includes('審判'),
    weight: 0.4,
    maxPerLife: 1,
    run: (c) =>
      c.ask({
        id: 'bbl.umpire',
        weight: 'minor',
        title: '審判の講習',
        body: '地域の野球連盟で、審判の講習会の案内を見かけました。',
        choices: [{ label: '講習を受ける' }, { label: 'やめておく' }],
        autoIndex: 1,
      }),
    resolve: (c, choice) => {
      if (choice === 0) {
        A(c.s).baseballLife.push('審判')
        bump(c, { happy: 4, rel: 3 })
        c.add('good', '審判の講習を受け、週末の大会で球審を務めるようになりました。')
      } else c.add('decision', '講習は、また今度にしました。')
    },
  },
  {
    id: 'bbl.alma',
    category: 'baseballLife',
    stages: ['adult', 'senior'],
    ages: [25, 65],
    when: (s) => s.career.highestRank >= 4 && !s.after?.baseballLife.includes('母校の指導'),
    weight: (s) => 0.3 + (s.career.highestRank >= 6 ? 0.8 : 0) + (s.career.achievements.includes('主将') ? 0.4 : 0),
    maxPerLife: 1,
    run: (c) =>
      c.ask({
        id: 'bbl.alma',
        weight: 'major',
        title: '母校からの依頼',
        body: '高校の野球部の監督から、外部コーチとして手伝ってほしいと連絡がありました。',
        choices: [{ label: '引き受ける', hint: '平日の夜と週末が埋まる' }, { label: '断る' }],
        autoIndex: 0,
      }),
    resolve: (c, choice) => {
      if (choice === 0) {
        A(c.s).baseballLife.push('母校の指導')
        bump(c, { happy: 6, rel: 4, health: -1 })
        c.add('good', '母校の野球部で、外部コーチを務めることになりました。', { key: true })
      } else c.add('decision', '仕事が忙しく、今回は断りました。')
    },
  },
  {
    id: 'bbl.watch',
    category: 'baseballLife',
    stages: ['adult', 'senior'],
    weight: 0.6,
    cooldown: 5,
    maxPerLife: 3,
    run: (c) => {
      bump(c, { happy: 3 })
      c.add('normal', rotate(c.s, 'bbl.watch', ['休みの日に、プロ野球の試合を見に行きました。', '夏の高校野球の地方大会を、地元の球場で見ました。', 'ラジオの野球中継を聞きながら、晩ごはんを食べました。']))
    },
  },
  // ------------------------------------------------------------------ goals, regrets, second attempts
  {
    id: 'after.goal',
    category: 'future',
    stages: ['adult'],
    priority: true,
    when: (s) => notPlaying(s) && s.career.endedAge !== null && !s.after?.goal && s.age >= 18 && s.age - (s.career.endedAge ?? s.age) <= 4,
    maxPerLife: 1,
    run: (c) =>
      c.ask({
        id: 'after.goal',
        weight: 'major',
        title: 'これからの目標',
        body: c.s.career.highestRank >= 5 ? '長い野球生活に区切りがつきました。これから何を大切に生きていきますか。' : '野球とは別の毎日が始まっています。これから何を大切にしますか。',
        choices: [
          { label: '家族や身近な人との時間' },
          { label: '仕事で一人前になること' },
          { label: '形を変えて、野球にかかわり続けること' },
          { label: 'もう一度学び直すこと' },
          { label: '気ままに、自分のペースで' },
        ],
        autoIndex: c.s.career.highestRank >= 4 ? 2 : c.rng.int(0, 1),
      }),
    resolve: (c, choice) => {
      const goals = ['family', 'work', 'baseball', 'learn', 'free'] as const
      A(c.s).goal = goals[choice] ?? 'free'
      c.add('decision', ['家族や身近な人との時間を大切にしようと決めました。', '仕事で一人前になろうと決めました。', '形を変えても、野球にかかわり続けようと決めました。', 'もう一度学び直そうと決めました。', '自分のペースで生きていこうと決めました。'][choice] ?? '')
    },
  },
  {
    id: 'after.regret',
    category: 'future',
    stages: ['adult'],
    ages: [24, 50],
    when: (s) => s.career.endedAge !== null && s.career.endedAge < 18 && s.career.highestRank >= 2,
    weight: 0.6,
    maxPerLife: 1,
    // (one who already plays 草野球 is offered more of it: the first answer is never the second one in other words)
    run: (c) =>
      c.ask(
        {
          id: 'after.regret',
          weight: 'minor',
          title: 'もし続けていたら',
          body: `${shownAge(c.s.career.endedAge!)}歳で野球をやめたことを、ふと思い出しました。`,
          choices: [
            A(c.s).baseballLife.includes('草野球') ? { label: '草野球に、もっと本気で打ち込む', hint: '試合の数を増やす' } : { label: 'もう一度、ボールを握ってみる', hint: '草野球に出てみる' },
            { label: 'あれはあれでよかったと思う' },
          ],
          autoIndex: 1,
        },
        { kusa: A(c.s).baseballLife.includes('草野球') },
      ),
    resolve: (c, choice, d) => {
      if (choice === 0 && d.kusa === true) {
        bump(c, { happy: 4 })
        c.add('good', '草野球の練習にも顔を出すようになり、週末はほとんどグラウンドで過ごしています。')
      } else if (choice === 0 && !A(c.s).baseballLife.includes('草野球')) {
        A(c.s).baseballLife.push('草野球')
        bump(c, { happy: 6 })
        c.add('good', '久しぶりにグローブを買い、近所の草野球チームに入りました。', { key: true })
      } else {
        bump(c, { happy: 2 })
        c.add('decision', 'あのとき別の道を選んだことも、今の自分につながっていると思いました。')
      }
    },
  },
  {
    id: 'after.club',
    category: 'future',
    stages: ['adult'],
    ages: [19, 32],
    when: (s) => s.career.highestRank >= 4 && s.career.endedAge !== null && s.age - s.career.endedAge <= 3 && !s.after?.baseballLife.includes('クラブチーム'),
    weight: 1,
    maxPerLife: 1,
    run: (c) =>
      c.ask({
        id: 'after.club',
        weight: 'major',
        title: 'クラブチームの誘い',
        body: '本格的に野球を続けられる、地域のクラブチームから声がかかりました。',
        choices: [{ label: 'もう一度、本気でやる', hint: '平日の夜と週末に練習する' }, { label: '区切りはついた' }],
        autoIndex: 1,
      }),
    resolve: (c, choice) => {
      if (choice === 0) {
        A(c.s).baseballLife.push('クラブチーム')
        bump(c, { happy: 6, health: -1 })
        c.add('good', 'クラブチームに入り、平日の夜と週末に練習する日々が始まりました。', { key: true })
      } else c.add('decision', 'もう区切りはついたと、丁寧に断りました。')
    },
  },
  {
    id: 'after.learn',
    category: 'future',
    stages: ['adult'],
    ages: [24, 55],
    when: (s) => s.after?.edu !== 'univ' && !flag(s, 'after.learned'),
    weight: (s) => (s.after?.goal === 'learn' ? 2.5 : 0.4),
    maxPerLife: 1,
    run: (c) =>
      c.ask({
        id: 'after.learn',
        weight: 'major',
        title: '学び直し',
        body: 'これからの仕事の幅を広げるために、資格を取るか、夜間の学校に通うか考えています。',
        choices: [{ label: '資格の勉強を始める', hint: '費用と時間がかかる' }, { label: '今は目の前のことに集中する' }],
        autoIndex: c.s.after?.goal === 'learn' ? 0 : 1,
      }),
    resolve: (c, choice) => {
      if (choice === 0) {
        setFlag(c.s, 'after.learned')
        bump(c, { know: 10, money: -60, sat: 4 })
        c.add('good', '1年半かけて、仕事に役立つ資格を取りました。', { key: true })
      } else c.add('decision', '今は目の前のことに集中することにしました。')
    },
  },
  // ------------------------------------------------------------------ old age
  {
    id: 'senior.life',
    category: 'future',
    stages: ['senior', 'adult'],
    priority: true,
    when: (s) => !!s.after?.retired && !flag(s, 'senior.life'),
    maxPerLife: 1,
    run: (c) => {
      setFlag(c.s, 'senior.life')
      c.ask({
        id: 'senior.life',
        weight: 'major',
        title: '退職後の暮らし',
        body: '仕事を離れ、自分の時間が増えました。どう過ごしますか。',
        // (without a family, the friends)
        choices: [{ label: '地域の活動に参加する' }, { label: '趣味を深める' }, { label: hasFamily(c.s) ? '家族との時間を増やす' : '友人との時間を増やす' }, { label: 'のんびり過ごす' }],
        autoIndex: c.rng.int(0, 3),
      })
    },
    resolve: (c, choice) => {
      if (choice === 0) {
        A(c.s).community = true
        bump(c, { rel: 6 })
      } else if (choice === 1) bump(c, { happy: 5 })
      else if (choice === 2) bump(c, { rel: 4, happy: 3 })
      else bump(c, { health: 2, happy: 2 })
      c.add('decision', ['地域の活動に顔を出すようになりました。', '若いころからの趣味に、じっくり時間を使うことにしました。', hasFamily(c.s) ? '家族と過ごす時間を増やしました。' : '友人と過ごす時間を増やしました。', '急がず、のんびり過ごすことにしました。'][choice] ?? '')
    },
  },
  {
    id: 'senior.retire65',
    category: 'career',
    stages: ['senior'],
    priority: true,
    when: (s) => working(s) && s.age >= (s.after!.work!.employer === 'self' ? 72 : 65) && s.after!.work!.kind !== 'politician',
    maxPerLife: 1,
    run: (c) => {
      const a = A(c.s)
      a.retired = true
      const paid = loseWork(c.s)
      c.s.job = '引退'
      c.add('milestone', `仕事を退職しました。${paidText(paid)}`, { key: true })
    },
  },
  {
    id: 'senior.pension',
    // a safety net: at 65 everyone either works (senior.retire65 retires them) or has retired already (work.retire60),
    // because the job search ends with the part-time option at the latest. Not reached by any life (checked in tests).
    needsChoice: true,
    category: 'career',
    stages: ['senior'],
    priority: true,
    // without a job at 65, he lives on the pension (the pension age is a model setting)
    when: (s) => !!s.after && !s.after.retired && !working(s) && s.age >= 65,
    maxPerLife: 1,
    run: (c) => {
      A(c.s).retired = true
      c.s.job = '引退'
      c.add('milestone', '65歳を過ぎ、年金を受け取りながら暮らすことになりました。', { key: true })
    },
  },
  {
    id: 'senior.spouseCare',
    category: 'love',
    stages: ['senior'],
    ages: [72, 110],
    when: (s) => !!s.family.spouse,
    weight: 0.8,
    maxPerLife: 1,
    run: (c) =>
      c.ask({
        id: 'senior.spouseCare',
        weight: 'major',
        title: '支え合う',
        body: `${c.s.family.spouse!.name}さんの足腰が弱り、外出が難しくなってきました。`,
        choices: [{ label: '自分で付き添う', hint: '体には負担' }, { label: '介護サービスを使う', hint: '費用がかかる' }],
        autoIndex: 1,
      }),
    resolve: (c, choice) => {
      bump(c, choice === 0 ? { health: -4, rel: 4 } : { money: -40, rel: 1 })
      c.add('decision', choice === 0 ? '毎日の散歩に付き添うようになりました。' : 'デイサービスを使いながら、二人で暮らしています。')
    },
  },
  {
    id: 'senior.endPlan',
    category: 'future',
    stages: ['senior'],
    ages: [70, 110],
    weight: 0.8,
    maxPerLife: 1,
    run: (c) =>
      c.ask({
        id: 'senior.endPlan',
        weight: 'minor',
        title: '身の回りの整理',
        body: '押し入れから、古いグローブとスコアブックが出てきました。',
        // (without a family, a close friend)
        choices: [{ label: `思い出の品を整理し、${hasFamily(c.s) ? '家族' : '親しい友人'}に話しておく` }, { label: 'そのまましまっておく' }],
        autoIndex: 0,
      }),
    resolve: (c, choice) => {
      bump(c, choice === 0 ? { rel: 3, happy: 2 } : { happy: 1 })
      c.add('decision', choice === 0 ? `思い出の品を整理し、${hasFamily(c.s) ? '家族' : '親しい友人'}にこれまでのことを話しました。` : 'グローブは、またそっと押し入れにしまいました。')
    },
  },
  {
    id: 'senior.milestone',
    category: 'life',
    stages: ['senior'],
    when: (s) => [70, 77, 80, 88, 90, 99].includes(s.age),
    weight: 4,
    cooldown: 1,
    maxPerLife: 6,
    run: (c) => {
      const name: Record<number, string> = { 70: '古希', 77: '喜寿', 80: '傘寿', 88: '米寿', 90: '卒寿', 99: '白寿' }
      // (the number of children, not their ages: an older save may have children without the list of their ages)
      const who = c.s.family.children > 0 ? (c.s.career.achievements.includes('孫') ? '子どもや孫' : '子どもたち') : c.s.family.spouse ? '妻' : '近所の人たち'
      bump(c, { happy: 5 })
      // (the age is in the log line's own label; a number here would be the model's, one below the screen's)
      c.add('milestone', `${name[c.s.age]}を${who}に祝ってもらいました。`)
    },
  },
  {
    id: 'senior.grandkid',
    category: 'children',
    stages: ['senior'],
    when: (s) => s.career.achievements.includes('孫'),
    weight: 1.5,
    cooldown: 3,
    maxPerLife: 4,
    run: (c) => {
      bump(c, { happy: 5, rel: 2 })
      c.add('good', rotate(c.s, 'senior.grandkid', ['孫の運動会を見に行きました。', '孫とキャッチボールをしました。思ったより強い球が返ってきました。', '孫の入学式に出ました。', '孫から手紙が届きました。']))
    },
  },
  {
    id: 'senior.friendLoss',
    category: 'friends',
    stages: ['senior'],
    ages: [72, 110],
    weight: 0.8,
    cooldown: 5,
    maxPerLife: 3,
    run: (c) => {
      bump(c, { happy: -5 })
      c.add(
        'bad',
        rotate(
          c.s,
          'senior.friendLoss',
          played(c.s)
            ? ['昔のチームメートの訃報が届きました。一緒に泥だらけになった日のことを思い出しました。', '少年野球で一緒だった友人の訃報が届きました。最初にキャッチボールをした相手でした。', '高校時代の先輩が亡くなりました。葬儀で、懐かしい顔ぶれと再会しました。']
            : ['古い友人の訃報が届きました。', '学生時代の友人が亡くなりました。年賀状の束を、しばらく眺めていました。', '長く付き合いのあった近所の人が亡くなりました。'],
        ),
      )
    },
  },
  {
    id: 'senior.frail',
    category: 'health',
    stages: ['senior'],
    ages: [78, 110],
    when: (s) => s.status.health < 55,
    weight: 1.2,
    maxPerLife: 1,
    run: (c) =>
      c.ask({
        id: 'senior.frail',
        weight: 'major',
        title: '足腰の衰え',
        body: '一人で遠くまで出かけるのが難しくなってきました。',
        choices: [{ label: 'デイサービスに通う', hint: '人と話す機会ができる' }, { label: '家で過ごす時間を大切にする' }],
        autoIndex: 0,
      }),
    resolve: (c, choice) => {
      bump(c, choice === 0 ? { rel: 4, money: -20, happy: 2 } : { happy: 1, health: -1 })
      c.add('decision', choice === 0 ? '週に3回、デイサービスに通うようになりました。' : '家で、庭やテレビの野球中継を眺めて過ごしています。')
    },
  },
  {
    id: 'senior.memory',
    category: 'memory',
    stages: ['senior'],
    when: played,
    weight: 1,
    cooldown: 4,
    maxPerLife: 4,
    run: (c) => {
      bump(c, { happy: 3 })
      const what = c.s.career.achievements.includes('甲子園') ? '甲子園の土を踏んだ日' : c.s.career.highestRank >= 7 ? 'プロのグラウンドに立った日' : c.s.career.highestRank >= 3 ? '高校最後の夏' : '少年野球の日曜の朝'
      const who = c.s.family.spouse || c.s.family.children > 0 ? '家族' : '近所の人'
      c.add(
        'good',
        rotate(c.s, 'senior.memory', [
          `テレビの野球中継を見ながら、${what}のことを${who}に話しました。`,
          `古いアルバムを開いて、${what}の写真を眺めました。`,
          `球場の近くを通りかかり、${what}のことを思い出しました。`,
          `昔の仲間から届いた年賀状に、${what}のことが書いてありました。`,
        ]),
      )
    },
  },
  {
    id: 'senior.hobby',
    category: 'hobby',
    stages: ['senior'],
    weight: 1,
    cooldown: 3,
    maxPerLife: 5,
    run: (c) => {
      bump(c, { happy: 4 })
      const t = rotate(c.s, 'senior.hobby', ['囲碁の教室に通い始めました。', '家庭菜園で、トマトがたくさん実りました。', '昔の仲間と、日帰りの温泉旅行に出かけました。', '近所の公園で、子どもたちの野球を眺めるのが楽しみになりました。', '写真の教室に通い、季節の花を撮るようになりました。'])
      // (a harvest only from a garden he has: one who has none starts it now)
      if (t.startsWith('家庭菜園') && !hasFlag(c.s, 'hobby.garden')) {
        c.s.flags = { ...c.s.flags, 'hobby.garden': c.s.age }
        return c.add('good', '家庭菜園を始め、庭の隅にトマトの苗を植えました。')
      }
      c.add('good', t)
    },
  },
]
for (const d of AFTER_EVENTS) if (JOB_QUESTIONS.has(d.id)) d.requires = working
