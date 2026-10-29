import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLife, endYear, planYear, resolveDecision, type Sim } from '../engine/life.ts'
import { defaultParams } from '../engine/params.ts'
import { clearLife, clearPlan, loadLife, loadPlan, saveLife, savePlan } from './persist.ts'

// 「続きから」 (PROJECT_PLAN §11.61): a life saved in the middle of a year is resumed with that year's plan, never planned again.

const sim: Sim = { params: defaultParams() }
function stubStorage() {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) })
  return store
}
afterEach(() => vi.unstubAllGlobals())

describe('the year in progress', () => {
  it('is saved with the life and comes back with it; another year or another life gets none', () => {
    stubStorage()
    const s = createLife({ seed: 77, country: 'JP', pace: 'p15' })
    for (let i = 0; i < 6; i++) {
      planYear(s, sim)
      endYear(s)
    }
    const p = planYear(s, sim)
    const plan = { events: p.events, next: 2, t: 0.4, decision: p.decision, decisionDone: false, stopped: null }
    saveLife(s)
    savePlan(s, plan)
    const back = loadLife()!
    expect(back.age).toBe(s.age)
    expect(loadPlan(back)).toEqual(JSON.parse(JSON.stringify(plan)))
    // the year after: the plan is of a year already over
    expect(loadPlan({ ...back, age: back.age + 1 })).toBeNull()
    expect(loadPlan({ ...back, config: { ...back.config, seed: 78 } })).toBeNull()
    clearPlan()
    expect(loadPlan(back)).toBeNull()
    savePlan(s, plan)
    clearLife()
    expect(loadPlan(s)).toBeNull()
  })

  it('a resumed year goes on as the uninterrupted one: the same lines, the same decision, the same state at its end', () => {
    stubStorage()
    // played without a break
    const a = createLife({ seed: 4242, country: 'JP', pace: 'p15' })
    // played with a break in the middle of each year: saved after planning, read back, and the year finished from the saved plan
    const b = createLife({ seed: 4242, country: 'JP', pace: 'p15' })
    let b2 = b
    for (let year = 0; year < 30 && a.alive; year++) {
      const pa = planYear(a, sim)
      let da = pa.decision?.decision
      while (da && a.alive) da = resolveDecision(a, da.autoIndex, sim).followUp?.decision
      endYear(a)

      const pb = planYear(b2, sim)
      saveLife(b2)
      savePlan(b2, { events: pb.events, decision: pb.decision })
      // resumed: the saved life and its plan, not a new plan of the same year
      b2 = loadLife()!
      const plan = loadPlan<{ decision?: { decision: { autoIndex: number } } }>(b2)!
      let db = plan.decision?.decision
      while (db && b2.alive) db = resolveDecision(b2, db.autoIndex, sim).followUp?.decision
      endYear(b2)
    }
    expect(b2.age).toBe(a.age)
    expect(b2.money).toBe(a.money)
    expect(b2.career).toEqual(a.career)
    expect(b2.timeline).toEqual(a.timeline)
    expect(b2.taken).toEqual(a.taken)
  })
})
