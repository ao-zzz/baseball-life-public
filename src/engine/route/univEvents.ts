import type { EventDef } from '../events.ts'
import type { LifeState } from '../types.ts'
import { clamp } from '../math.ts'
import { ensureAfter } from '../after.ts'
import { hasFlag } from '../events/spec.ts'

// University life outside the baseball team (PROJECT_PLAN §11.11): returning to the team, the circle, the
// student years. Returning to the team puts the player back in the university phase (done by life.ts, which
// owns the phases); that part of a life is outside the calibrated stage checks.

/**
 * set by life.ts: put a student back in the university baseball team; and the 入部テスト again for one who failed it (his own stream),
 * which puts him in the team when he passes
 */
export const hooks: { returnToClub: (s: LifeState) => void; walkOnAgain: (s: LifeState) => boolean } = { returnToClub: () => {}, walkOnAgain: () => false }

/** he failed the club's 入部テスト (life.ts tryWalkOn): going back means passing it this time */
const failedTest = (s: LifeState) => s.flags?.['univ.walkFail'] !== undefined
/** the 準硬式 club (life.ts resolveUnivClub) */
const semi = (s: LifeState) => s.flags?.['univ.semi'] !== undefined

const student = (s: LifeState) => !!s.schools?.univ && s.job === '大学生' && s.career.phase === 'retired'

function bumpStatus(s: LifeState, o: { happy?: number; rel?: number; know?: number; money?: number }) {
  const st = s.status
  if (o.happy) st.happiness = clamp(st.happiness + o.happy, 5, 100)
  if (o.rel) st.relations = clamp(st.relations + o.rel, 5, 100)
  if (o.know) st.knowledge = clamp(st.knowledge + o.know, 1, 99)
  if (o.money) s.money += o.money
}

export const UNIV_EVENTS: EventDef[] = [
  {
    id: 'univ.return',
    category: 'baseballLife',
    stages: ['adult'],
    ages: [19, 20],
    // a student who played before and is not in the team: the thought of going back
    when: (s) => student(s) && s.career.highestRank >= 3 && s.schools!.univ!.club !== 'returned',
    // likelier for a circle player, and after he has asked about the team (x.univ.circleCup)
    weight: (s) => (s.schools!.univ!.club === 'circle' ? 4 : 2) + (hasFlag(s, 'univ.askedTeam') ? 5 : 0),
    maxPerLife: 1,
    run: (c) =>
      c.ask({
        id: 'univ.return',
        weight: 'major',
        title: 'もう一度、野球部に入る？',
        body: `${c.s.schools!.univ!.name}の野球部が練習している音が、授業のあいだに聞こえてきます。野球から離れて、しばらくたちました。`,
        choices: [
          failedTest(c.s)
            ? { label: 'もう一度、野球部の入部テストを受ける', hint: '受かれば練習が中心の生活に戻る。受かるかは実力しだい（ゲーム上の仮定）' }
            : { label: '野球部に入り直す', hint: '練習が中心の生活に戻る。勉強とアルバイトは減る' },
          semi(c.s)
            ? { label: '準硬式野球部を続ける', hint: '今の仲間と、今の部で野球を続ける' }
            : { label: c.s.schools!.univ!.club === 'circle' ? 'サークルの草野球を続ける' : 'サークルで草野球をする', hint: '勝ち負けより楽しさ。時間にも余裕がある' },
          { label: '今のまま、学業と仕事に集中する' },
        ],
        // going back to the team is the player's own choice (おまかせ stays where he is)
        autoIndex: 2,
      }),
    resolve: (c, choice) => {
      const s = c.s
      const u = s.schools!.univ!
      if (choice === 0 && failedTest(s)) {
        if (hooks.walkOnAgain(s)) c.add('good', 'もう一度受けた入部テストに合格し、硬式野球部に入りました。ブランクを取り戻すところから始めます。', { key: true })
        else c.add('bad', 'もう一度入部テストを受けましたが、合格には届きませんでした。', { key: true })
      } else if (choice === 0) {
        hooks.returnToClub(s)
        c.add('decision', '野球部に入り直しました。ブランクを取り戻すところから、もう一度始めます。', { key: true })
      } else if (choice === 1 && semi(s)) {
        bumpStatus(s, { rel: 3, happy: 3 })
        c.add('decision', '準硬式野球部で、今の仲間と野球を続けることにしました。')
      } else if (choice === 1) {
        const already = u.club === 'circle'
        u.club = 'circle'
        const bl = ensureAfter(s).baseballLife
        if (!bl.includes('サークル野球')) bl.push('サークル野球')
        bumpStatus(s, { rel: 3, happy: 3 })
        c.add('decision', already ? 'これまでどおり、サークルの草野球を続けることにしました。' : 'サークルの草野球に顔を出すようになりました。')
      } else {
        bumpStatus(s, { know: 3 })
        c.add('decision', '野球はやらずに、学業とアルバイトに集中することにしました。')
      }
    },
  },
]
