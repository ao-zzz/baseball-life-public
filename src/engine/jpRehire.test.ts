import { describe, expect, it } from 'vitest'
import { createLife, endYear, planYear, resolveDecision, type Sim } from './life.ts'
import { defaultParams } from './params.ts'
import { hashSeed } from './rng.ts'
import { isPlaying } from './life.ts'
import type { Decision, LifeState } from './types.ts'

// Offers after a release in Japan (PROJECT_PLAN §11.51): another NPB club or a company team asks him. The offer is one more choice at the
// END of 'jp.release' (the old three and the おまかせ answer stay), drawn on a stream of its own.

type Asked = { s: LifeState; d: Decision; age: number }

/** plays potential-mode lives (pros are common there) and calls `on` for every 'jp.release' decision; `pick` chooses the answer */
function run(n: number, pick: (a: Asked) => number | undefined, stop: () => boolean, tallies?: string[], seedBase = 9_100_000): Asked[] {
  const seen: Asked[] = []
  const sim: Sim = { params: defaultParams(), tally: (k) => tallies?.push(k) }
  for (let i = 0; i < n && !stop(); i++) {
    const s = createLife({ seed: hashSeed(i + seedBase), country: 'JP', pace: 'p15', mode: 'potential', stars: 9 })
    for (let g = 0; g < 100 && s.alive; g++) {
      let d = planYear(s, sim).decision?.decision
      while (d && s.alive) {
        let c = d.autoIndex
        if (d.id === 'jp.release') {
          const a: Asked = { s, d, age: s.age }
          seen.push({ ...a, s: structuredClone(s) })
          c = pick(a) ?? d.autoIndex
        }
        d = resolveDecision(s, c, sim).followUp?.decision
      }
      endYear(s)
      if (s.career.endedAge !== null && !isPlaying(s) && s.career.phase === 'retired') break
    }
  }
  return seen
}

describe('the offers after a release', () => {
  it('are one more choice at the end: the old three and the おまかせ answer are as they were; an offer is NPB or a company team', () => {
    let npb = 0
    let company = 0
    let indep = 0
    const all = run(4000, () => undefined, () => npb >= 3 && company >= 3 && indep >= 3)
    for (const a of all) {
      const n = a.d.choices.length
      // (after the old three: an offer, a second NPB club after an NPB offer (§11.62), and last his own club's 育成 contract (§11.63))
      expect([3, 4, 5, 6]).toContain(n)
      const own = a.d.choices.findIndex((c) => /育成契約を結び直す/.test(c.label))
      if (own >= 0) expect(own).toBe(n - 1)
      const offers = a.d.choices.slice(3).filter((c) => !/育成契約を結び直す/.test(c.label))
      expect(offers.length).toBeLessThanOrEqual(2)
      if (offers.length === 2) {
        expect(offers[0].label).toMatch(/と契約する/)
        expect(offers[1].label).toMatch(/と契約する/)
        expect(offers[1].label).not.toBe(offers[0].label)
      }
      expect(a.d.choices[0].label).toBe('合同トライアウトを受ける')
      expect(a.d.choices[1].label).toBe('独立リーグで続ける')
      expect(a.d.choices[2].label).toBe('現役を引退する')
      expect([1, 2]).toContain(a.d.autoIndex)
      if (offers.length >= 1) {
        const l = offers[0].label
        if (/社会人野球/.test(l)) company++
        else if (/（独立リーグ）/.test(l)) indep++
        else npb++
        // the conditions: no injury, not old (NPB: up to 38, a company team: up to 33), the count of offers within the limit
        expect(a.s.career.injured).toBe(0)
        expect(a.s.age).toBeLessThanOrEqual(/社会人野球/.test(l) ? 33 : /（独立リーグ）/.test(l) ? 36 : 38)
        expect(a.s.flags?.['rehire.n'] ?? 0).toBeLessThan(3)
      }
    }
    expect(all.length, 'releases').toBeGreaterThan(10)
    expect(npb, 'NPB offers').toBeGreaterThan(0)
    expect(company, 'company offers').toBeGreaterThan(0)
    expect(indep, 'independent-league offers').toBeGreaterThan(0)
  }, 300_000)

  it('accepting an NPB offer: another club, back on a pro contract; refusing goes to the old retirement', () => {
    let accepted = 0
    let refused = 0
    // (every second offer is accepted, the others refused with the old 「現役を引退する」; the state is read after each answer)
    const sim: Sim = { params: defaultParams() }
    for (let i = 0; i < 4000 && (accepted < 3 || refused < 3); i++) {
      const s = createLife({ seed: hashSeed(i + 9_100_000), country: 'JP', pace: 'p15', mode: 'potential', stars: 9 })
      for (let g = 0; g < 100 && s.alive; g++) {
        let d = planYear(s, sim).decision?.decision
        while (d && s.alive) {
          let c = d.autoIndex
          if (d.id === 'jp.release' && d.choices.length >= 4 && /と契約する/.test(d.choices[3].label)) {
            const oldOrg = s.career.orgId
            const take = (accepted + refused) % 2 === 0
            c = take ? 3 : 2
            d = resolveDecision(s, c, sim).followUp?.decision
            if (take) {
              accepted++
              expect(['pro', 'proMinor']).toContain(s.career.phase)
              expect(s.career.orgId).not.toBe(oldOrg)
              expect(s.flags?.['rehire.n']).toBeGreaterThan(0)
            } else {
              refused++
              expect(s.career.phase).toBe('retired')
            }
            continue
          }
          d = resolveDecision(s, c, sim).followUp?.decision
        }
        endYear(s)
        if (s.career.phase === 'retired') break
      }
    }
    expect(accepted).toBeGreaterThan(0)
    expect(refused).toBeGreaterThan(0)
  }, 300_000)

  it('accepting a company offer: a company team, and from there the draft is checked every year again (the way back to NPB)', () => {
    const tallies: string[] = []
    let accepted = 0
    const sim: Sim = { params: defaultParams(), tally: (k) => tallies.push(k) }
    for (let i = 0; i < 4000 && accepted < 3; i++) {
      const s = createLife({ seed: hashSeed(i + 9_100_000), country: 'JP', pace: 'p15', mode: 'potential', stars: 9 })
      for (let g = 0; g < 100 && s.alive; g++) {
        let d = planYear(s, sim).decision?.decision
        while (d && s.alive) {
          let c = d.autoIndex
          if (d.id === 'jp.release' && d.choices.length === 4 && /社会人野球/.test(d.choices[3].label)) {
            c = 3
            d = resolveDecision(s, c, sim).followUp?.decision
            accepted++
            expect(s.career.phase).toBe('company')
            expect(s.career.amateurTeam).toBeTruthy()
            expect(s.career.orgId).toBeUndefined()
            continue
          }
          d = resolveDecision(s, c, sim).followUp?.decision
        }
        endYear(s)
        if (s.career.phase === 'retired') break
      }
    }
    expect(accepted).toBeGreaterThan(0)
    expect(tallies.filter((k) => k === 'jp.companyDraft').length).toBeGreaterThan(0)
  }, 300_000)

  it('an independent-league offer: accepted, he plays for that team and the yearly draft check goes on; refused, the old retirement', () => {
    const tallies: string[] = []
    let accepted = 0
    let refused = 0
    const sim: Sim = { params: defaultParams(), tally: (k) => tallies.push(k) }
    for (let i = 0; i < 4000 && (accepted < 3 || refused < 3); i++) {
      const s = createLife({ seed: hashSeed(i + 9_100_000), country: 'JP', pace: 'p15', mode: 'potential', stars: 9 })
      for (let g = 0; g < 100 && s.alive; g++) {
        let d = planYear(s, sim).decision?.decision
        while (d && s.alive) {
          let c = d.autoIndex
          if (d.id === 'jp.release' && d.choices.length === 4 && /（独立リーグ）/.test(d.choices[3].label)) {
            const take = (accepted + refused) % 2 === 0
            c = take ? 3 : 2
            d = resolveDecision(s, c, sim).followUp?.decision
            if (take) {
              accepted++
              expect(s.career.phase).toBe('indep')
              expect(s.career.orgId).toBeTruthy()
              expect(s.career.team.length).toBeGreaterThan(1)
            } else {
              refused++
              expect(s.career.phase).toBe('retired')
            }
            continue
          }
          d = resolveDecision(s, c, sim).followUp?.decision
        }
        endYear(s)
        if (s.career.phase === 'retired') break
      }
    }
    expect(accepted).toBeGreaterThan(0)
    expect(refused).toBeGreaterThan(0)
    expect(tallies.filter((k) => k === 'jp.indepDraft').length).toBeGreaterThan(0)
  }, 300_000)

  it('the old 「独立リーグで続ける」 (choice 2) is still there with and without an offer, and still leads to an independent team', () => {
    const sim: Sim = { params: defaultParams() }
    let n = 0
    for (let i = 0; i < 4000 && n < 4; i++) {
      const s = createLife({ seed: hashSeed(i + 9_100_000), country: 'JP', pace: 'p15', mode: 'potential', stars: 9 })
      for (let g = 0; g < 100 && s.alive; g++) {
        let d = planYear(s, sim).decision?.decision
        while (d && s.alive) {
          let c = d.autoIndex
          if (d.id === 'jp.release') {
            c = 1
            d = resolveDecision(s, c, sim).followUp?.decision
            n++
            expect(s.career.phase).toBe('indep')
            continue
          }
          d = resolveDecision(s, c, sim).followUp?.decision
        }
        endYear(s)
        if (s.career.phase === 'retired') break
      }
    }
    expect(n).toBeGreaterThan(0)
  }, 300_000)
  it('a life that never meets an offer asks exactly the old three choices', () => {
    const all = run(600, () => undefined, () => false, undefined, 9_300_000)
    expect(all.some((a) => a.d.choices.length === 3)).toBe(true)
    for (const a of all) if (a.d.choices.length === 3) expect(a.d.body).toBe('球団から、来季は契約しないと告げられました。これからどうしますか。')
  }, 300_000)
})
