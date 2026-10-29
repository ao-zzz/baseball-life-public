import { describe, expect, it } from 'vitest'
import { EVENTS, createLife, endYear, planYear, resolveDecision, type Sim } from './life.ts'
import { defaultParams } from './params.ts'
import { hashSeed, makeRng } from './rng.ts'
import { shownAge } from './displayAge.ts'
import { rotate, type EventCtx } from './events.ts'
import type { LifeState } from './types.ts'

// Drinking in Japan (the legal age is 20). A line that shows him drinking reads so only from 20 at the start of the year (the model's
// age), so that he is 20 for the whole year and the screen, which shows the age at the end of the year, never shows it at 19 or less.
// Before 20 the same event comes, drawn as before, with a line without drinking: the old teammates (adult.2), the year-end farewell
// party (nw.sendoff.jp) and the work done together (work.colleague).

/** his own drinking (a party declined, or someone else's beer in the park, is not) */
const DRINKING = /飲みに行|乾杯|居酒屋|晩酌|二日酔い|酒を飲/

/** the lines as they were, met from 20 */
const ORIGINAL: Record<string, string> = {
  'adult.2': '久しぶりに昔のチームメートと飲みに行きました。',
  'nw.sendoff.jp': '年度末の送別会で、異動する人が拍手に送られました。居酒屋の座敷は、涙と笑いでいっぱいでした。',
}
/** the lines met before 20 */
const YOUNG: Record<string, string> = {
  'adult.2': '久しぶりに昔のチームメートと集まり、ファミレスで遅くまで話し込みました。',
  'nw.sendoff.jp': '年度末の送別会で、異動する人が花束と拍手に送られました。会場は、涙と笑いでいっぱいでした。',
}
/** work.colleague's three lines, used in turn; the second one (the toast) gives its place to the first before 20 */
const COLLEAGUE = ['職場の後輩に仕事を教えるうちに、自分の仕事の見方も変わりました。', '同僚と一緒に大きな案件をやり遂げ、打ち上げで乾杯しました。', '職場の野球好きと、昼休みにキャッチボールをするようになりました。']

function texts(id: string, s: LifeState): string[] {
  const out: string[] = []
  const c: EventCtx = { s, rng: makeRng(1), headless: false, add: (_kind, text) => out.push(text), ask: () => {}, canAsk: () => true }
  EVENTS.get(id)!.run(c)
  return out
}

function lifeAt(age: number, seed = 1, colleague = 0): LifeState {
  const s = createLife({ seed, country: 'JP', pace: 'p15' })
  s.age = age
  if (colleague) s.evHist = { 'work.colleague': [age, colleague] }
  return s
}

/** the same, with a job after baseball (the farewell party at work is a line for one who goes to a workplace) */
function workingAt(age: number): LifeState {
  const s = lifeAt(age)
  s.after = { edu: 'hs', work: { title: '会社員', industry: 'office', employer: 'small', level: 0, years: 1, satisfaction: 50, regular: true, baseball: false }, jobless: 0, home: 'rent', loan: 0, baseballLife: [], community: false, care: false, retired: false }
  return s
}

describe('drinking only from 20 in Japan', () => {
  it('the events are drawn as before: same ages and conditions', () => {
    expect(EVENTS.get('adult.2')!.ages).toBeUndefined()
    expect(EVENTS.get('nw.sendoff.jp')!.ages).toEqual([18, 90])
    expect(EVENTS.get('work.colleague')!.ages).toBeUndefined()
  })

  it('the old teammates and the farewell party: without drinking before 20, the original line from 20', () => {
    for (const id of ['adult.2', 'nw.sendoff.jp']) {
      for (const age of [18, 19]) {
        expect(texts(id, workingAt(age)), `${id} at ${age}`).toEqual([YOUNG[id]])
        expect(YOUNG[id]).not.toMatch(DRINKING)
      }
      for (const age of [20, 21, 40]) expect(texts(id, workingAt(age)), `${id} at ${age}`).toEqual([ORIGINAL[id]])
    }
    // (without a workplace, the farewell of the neighbourhood: no drinking at any age)
    for (const age of [18, 19, 20, 40, 70]) expect(texts('nw.sendoff.jp', lifeAt(age)).join('')).not.toMatch(DRINKING)
  })

  it('work done together: the toast gives its place before 20, every line is the original one from 20', () => {
    let toastBefore20 = 0
    for (let seed = 1; seed <= 6; seed++) {
      for (let n = 1; n <= 3; n++) {
        for (const age of [18, 19]) {
          const s = lifeAt(age, seed, n)
          const was = rotate(s, 'work.colleague', COLLEAGUE)
          if (was === COLLEAGUE[1]) toastBefore20++
          const t = texts('work.colleague', s)
          expect(t, `seed ${seed}, ${n}, at ${age}`).toEqual([was === COLLEAGUE[1] ? COLLEAGUE[0] : was])
          expect(t.join('')).not.toMatch(DRINKING)
        }
        for (const age of [20, 21]) {
          const s = lifeAt(age, seed, n)
          expect(texts('work.colleague', s), `seed ${seed}, ${n}, at ${age}`).toEqual([rotate(s, 'work.colleague', COLLEAGUE)])
        }
      }
    }
    // (the case that matters did come)
    expect(toastBefore20).toBeGreaterThan(0)
  })

  it('in Japanese lives played as on screen, no line or question shows him drinking before 20 (the screen: 19 or less never)', () => {
    const sim: Sim = { params: defaultParams() }
    let from20 = 0
    let young = 0
    const youngLines = new Set(Object.values(YOUNG))
    for (let i = 0; i < 150; i++) {
      const s = createLife({ seed: hashSeed(i + 6_300_000), country: 'JP', pace: 'p15' })
      for (let g = 0; g < 130 && s.alive; g++) {
        const age = s.age
        const plan = planYear(s, sim)
        const shown: string[] = plan.events.map((e) => e.entry.text)
        let d = plan.decision?.decision
        while (d && s.alive) {
          shown.push(d.title, d.body, ...d.choices.map((c) => `${c.label} ${c.hint ?? ''}`))
          const r = resolveDecision(s, d.autoIndex, sim)
          shown.push(...r.events.map((e) => e.entry.text))
          d = r.followUp?.decision
        }
        for (const t of shown) {
          if (youngLines.has(t)) {
            expect(age, `seed ${s.config.seed}: ${t}`).toBeLessThan(20)
            young++
          }
          if (!DRINKING.test(t)) continue
          expect(age, `seed ${s.config.seed}, shown at ${shownAge(age)}: ${t}`).toBeGreaterThanOrEqual(20)
          from20++
        }
        endYear(s)
      }
    }
    // (the test means something only if such lines do come: the drinking ones from 20, the others before)
    expect(from20).toBeGreaterThan(20)
    expect(young).toBeGreaterThan(5)
  }, 60_000)
})
