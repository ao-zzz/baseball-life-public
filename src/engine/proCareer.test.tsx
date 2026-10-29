import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createLife, endYear, planYear, resolveDecision, runHeadless, type Sim } from './life.ts'
import { defaultParams } from './params.ts'
import { hashSeed, makeRng } from './rng.ts'
import { IKUSEI_MIN_SALARY, NPB_MAX_SALARY, NPB_MIN_SALARY, mlbSlotUsd, multiYearTerm, nextSalary, rookieTerms, seasonValue, usdToMan } from './contract.ts'
import { abilityScore } from './ability.ts'
import { initBaseball } from './ability.ts'
import { wishChoices } from './positionWish.ts'
import { postText, readShared, shareText, shareUrl, X_LIMIT, xLength } from '../game/shareLink.ts'
import { fullName } from './life.ts'
import { cleanFeedback, feedbackLink, FEEDBACK, FEEDBACK_CATEGORIES, FEEDBACK_MAX_LENGTH } from '../data/site.ts'
import { loadSettings, saveSettings } from '../game/persist.ts'
import { ProYears, StopDialog } from '../ui/ProPanels.tsx'
import { InfoPageView } from '../ui/InfoPages.tsx'
import type { LifeState, StatLine } from './types.ts'

// PROJECT_PLAN §11.23: the draft and the contract, the pay, the year-by-year pro record, the shown ability, the wished position,
// the shared link and the feedback form.

const sim: Sim = { params: defaultParams(), headless: true }
const line = (o: Partial<StatLine>): StatLine => ({ games: 0, pa: 0, ab: 0, h: 0, hr: 0, rbi: 0, sb: 0, outs: 0, k: 0, er: 0, w: 0, l: 0, ...o })

describe('the first contract', () => {
  it('stays inside the game table by round, with a high-school pick paid less than a company pick of the same round', () => {
    for (let i = 0; i < 300; i++) {
      const r = makeRng(i + 1)
      const round = 1 + (i % 9)
      const t = rookieTerms(r, round, 'shihaika', i % 2 ? '高校' : '社会人')
      expect(t.bonus).toBeLessThanOrEqual(10000)
      expect(t.incentive).toBeLessThanOrEqual(5000)
      expect(t.salary).toBeLessThanOrEqual(1600)
      expect(t.salary).toBeGreaterThanOrEqual(NPB_MIN_SALARY)
      if (round === 1) expect(t.bonus).toBe(10000)
      if (round === 2) expect(t.bonus).toBeGreaterThanOrEqual(6000)
      const k = rookieTerms(makeRng(i + 1), 1, 'ikusei', '独立リーグ')
      expect(k.bonus).toBeGreaterThanOrEqual(200)
      expect(k.bonus).toBeLessThanOrEqual(300)
      expect(k.salary).toBeGreaterThanOrEqual(IKUSEI_MIN_SALARY)
      expect(k.salary).toBeLessThanOrEqual(400)
    }
    const mean = (from: string) => {
      let sum = 0
      for (let i = 0; i < 200; i++) sum += rookieTerms(makeRng(i + 7), 3, 'shihaika', from).salary
      return sum / 200
    }
    expect(mean('高校')).toBeLessThan(mean('社会人'))
  })
})

describe('the pay after the first year', () => {
  it('a season without the first team lowers the pay, a regular season raises it, a star season raises it more, within the limits', () => {
    const none = nextSalary(1200, 0, false, false, 26, 0)
    expect(none).toBeLessThan(1200)
    expect(none).toBeGreaterThanOrEqual(1200 * 0.75)
    const regular = nextSalary(1200, seasonValue(line({ games: 130, pa: 500, ab: 450, h: 120, hr: 12 }), false, false), true, false, 26, 0)
    expect(regular).toBeGreaterThan(1200)
    const star = nextSalary(1200, seasonValue(line({ games: 140, pa: 600, ab: 530, h: 170, hr: 35 }), false, false), true, false, 26, 0)
    expect(star).toBeGreaterThan(regular)
    // (a low pay may now rise by more than 2.7 times for a star season: see 'the pay of a young regular' below)
    expect(star).toBeLessThanOrEqual(1200 * 5.7)
    const poor = nextSalary(1200, seasonValue(line({ games: 40, pa: 90, ab: 85, h: 12, hr: 0 }), false, false), true, false, 26, 0)
    expect(poor).toBeLessThan(regular)
    // the top pay raises less in proportion, and has a ceiling
    expect(nextSalary(40000, 2, true, false, 29, 0) / 40000).toBeLessThan(nextSalary(2000, 2, true, false, 29, 0) / 2000)
    expect(nextSalary(64000, 3, true, false, 29, 2)).toBeLessThanOrEqual(NPB_MAX_SALARY)
    // an injury costs pay; the floor holds
    expect(nextSalary(1200, 0, false, true, 26, 0)).toBeLessThan(none)
    expect(nextSalary(450, 0, false, true, 33, -2)).toBeGreaterThanOrEqual(NPB_MIN_SALARY)
  })

  it('MLB pay and draft values are in dollars and shown in yen at the fixed rate', () => {
    expect(mlbSlotUsd(1)).toBe(11_075_900)
    for (let k = 2; k < 400; k++) expect(mlbSlotUsd(k)).toBeLessThanOrEqual(mlbSlotUsd(k - 1))
    expect(mlbSlotUsd(400)).toBeLessThanOrEqual(150_000)
    expect(usdToMan(1_000_000)).toBe(15000)
  })
})

// The pay of a young regular (examples, all 推定 and few: a high-school batter went 800万円 → 4,500万円 → 1億円 after a 143-game, 36-homer
// season and then 28 homers; a starter 650万円 → 2,600万円 → 4,000万円 → 9,000万円 after 9, 9 and 12 wins; a regular 1,200万円 → 8,000万円
// after .309 and 33 homers; a 6億円, 3-year contract that did not follow the seasons). The rates are assumptions fitted to the order of those.
describe('the pay of a young regular', () => {
  const val = (o: Partial<StatLine>, pitcher = false, reliever = false) => seasonValue(line(o), pitcher, reliever)
  const strongBat = val({ games: 143, pa: 600, ab: 540, h: 125, hr: 36 })
  const goodBat = val({ games: 130, pa: 500, ab: 450, h: 120, hr: 12 })
  const bench = val({ games: 30, pa: 60, ab: 55, h: 12, hr: 1 })
  const starter = val({ games: 25, outs: 450, er: 46, w: 9 }, true) // about 150 innings at 2.76
  const closer = val({ games: 60, outs: 180, er: 15 }, true, true)

  it('a strong first season as a regular lifts a rookie pay to 1,000万〜5,000万円, and a second one to 5,000万〜10,000万円', () => {
    const second = nextSalary(800, strongBat, true, false, 20, 0)
    expect(second).toBeGreaterThanOrEqual(3000)
    expect(second).toBeLessThanOrEqual(5000)
    expect(nextSalary(800, goodBat, true, false, 20, 0)).toBeGreaterThanOrEqual(1000)
    expect(nextSalary(800, goodBat, true, false, 20, 0)).toBeLessThan(second)
    const third = nextSalary(2500, strongBat, true, false, 21, 0)
    expect(third).toBeGreaterThanOrEqual(5000)
    expect(third).toBeLessThanOrEqual(8000)
    // the same play lifts a higher pay by less in proportion
    expect(nextSalary(4500, strongBat, true, false, 22, 0) / 4500).toBeLessThan(second / 800)
    expect(nextSalary(4500, strongBat, true, false, 22, 0)).toBeLessThanOrEqual(11000)
  })

  it('a starter and a reliever with a good season rise, and a good season pays more than a thin one', () => {
    expect(nextSalary(650, starter, true, false, 20, 0)).toBeGreaterThan(1200)
    expect(nextSalary(1000, closer, true, false, 24, 0)).toBeGreaterThan(1500)
    expect(nextSalary(1000, closer, true, false, 24, 0)).toBeGreaterThan(nextSalary(1000, val({ games: 8, outs: 24, er: 6 }, true, true), true, false, 24, 0))
  })

  it('a bench player, a poor season, no first-team games or an injury raise a little or cut the pay, within the floors', () => {
    expect(nextSalary(800, bench, true, false, 21, 0)).toBeLessThan(nextSalary(800, goodBat, true, false, 21, 0) / 2)
    expect(nextSalary(800, 0, false, false, 21, 0)).toBeLessThan(800)
    expect(nextSalary(800, 0, false, true, 21, 0)).toBeLessThan(nextSalary(800, 0, false, false, 21, 0))
    // a star's pay falls after a poor year (no free fall: the floor is 60% above 1億円)
    const poor = nextSalary(30000, val({ games: 50, pa: 150, ab: 140, h: 28, hr: 2 }), true, false, 31, 0)
    expect(poor).toBeLessThan(30000)
    expect(poor).toBeGreaterThanOrEqual(30000 * 0.6)
    expect(nextSalary(500, 0, false, true, 30, -2)).toBeGreaterThanOrEqual(NPB_MIN_SALARY)
  })

  it('the top of the scale and the ceiling are kept', () => {
    expect(nextSalary(60000, 3, true, false, 28, 2)).toBeLessThanOrEqual(NPB_MAX_SALARY)
    expect(nextSalary(10000, 2.5, true, false, 27, 0)).toBeLessThanOrEqual(10000 * 2.7)
  })

  it('a multi-year contract is only for a star season at a high pay, aged 24 to 31, healthy', () => {
    expect(multiYearTerm(60000, 2, 28, false)).toBe(3)
    expect(multiYearTerm(25000, 1.5, 27, false)).toBe(2)
    expect(multiYearTerm(60000, 2, 28, true)).toBe(0)
    expect(multiYearTerm(60000, 0.8, 28, false)).toBe(0)
    expect(multiYearTerm(60000, 2, 33, false)).toBe(0)
    expect(multiYearTerm(60000, 2, 22, false)).toBe(0)
    expect(multiYearTerm(15000, 2, 28, false)).toBe(0)
  })

  it('in lives, the pay stays fixed while a contract runs (the seasons do not move it), and no pay goes below the minimum or above the ceiling', () => {
    let contracts = 0
    for (let i = 0; i < 6000 && contracts < 6; i++) {
      const s = createLife({ seed: hashSeed(i + 4_400_000), country: 'JP', pace: 'p15', mode: 'potential', stars: 10 })
      let sig: { salary: number; untilAge: number } | undefined
      for (let g = 0; g < 70 && s.alive; g++) {
        const plan = planYear(s, sim)
        let d = plan.decision?.decision
        while (d && s.alive) d = resolveDecision(s, d.autoIndex, sim).followUp?.decision
        const h = s.career.salaryHist?.at(-1)
        if (h && h.age === s.age) {
          if (h.kind === 'shihaika') {
            expect(h.salary).toBeGreaterThanOrEqual(NPB_MIN_SALARY)
            expect(h.salary).toBeLessThanOrEqual(NPB_MAX_SALARY)
          }
          if (sig && h.kind === 'shihaika' && s.age <= sig.untilAge && s.career.contract) expect(h.salary, `seed ${s.config.seed}`).toBe(sig.salary)
        }
        if (s.career.contract && !sig) {
          sig = s.career.contract
          contracts++
        }
        if (sig && s.age >= sig.untilAge) sig = undefined
        endYear(s)
      }
    }
    expect(contracts).toBeGreaterThan(0)
  }, 120_000)
})

describe('the length and the end of a multi-year contract', () => {
  const screen = { ...sim }
  const step = (s: LifeState) => {
    const plan = planYear(s, screen)
    let d = plan.decision?.decision
    while (d && s.alive) d = resolveDecision(s, d.autoIndex, screen).followUp?.decision
  }

  it('a 2-year or 3-year contract holds the pay for exactly its years, and the year after is priced again', () => {
    const terms = new Set<number>()
    for (let i = 0; i < 8000 && terms.size < 2; i++) {
      const s = createLife({ seed: hashSeed(i + 4_400_000), country: 'JP', pace: 'p15', mode: 'potential', stars: 10 })
      let sig: { salary: number; untilAge: number; from: number } | undefined
      for (let g = 0; g < 70 && s.alive; g++) {
        step(s)
        const h = s.career.salaryHist?.at(-1)
        const here = !!h && h.age === s.age && h.kind === 'shihaika'
        if (sig && here && s.age > sig.untilAge) {
          // the first year after the contract: no contract of the old term, priced by the season
          expect(s.career.contract?.untilAge === sig.untilAge, `seed ${s.config.seed}`).toBe(false)
          terms.add(sig.untilAge - sig.from + 1)
          sig = undefined
        } else if (sig && here) {
          expect(h!.salary, `seed ${s.config.seed} age ${s.age}`).toBe(sig.salary)
        }
        if (!sig && s.career.contract && here) {
          // signed this year: the pay of this year is the first year of the term
          expect(h!.salary).toBe(s.career.contract.salary)
          sig = { ...s.career.contract, from: s.age }
          expect([2, 3]).toContain(sig.untilAge - sig.from + 1)
        }
        endYear(s)
        if (sig && !s.career.contract) sig = undefined
      }
    }
    expect(terms.size).toBeGreaterThan(0)
    for (const t of terms) expect([2, 3]).toContain(t)
  }, 120_000)

  it('going abroad ends the contract at once (the jp.mlb decision is resolved on a life that holds one); staying keeps it', () => {
    // a life in the pro phase, given a contract by hand and asked the real decision: the resolver itself is what runs
    let from: LifeState | undefined
    for (let i = 0; i < 8000 && !from; i++) {
      const s = createLife({ seed: hashSeed(i + 4_400_000), country: 'JP', pace: 'p15', mode: 'potential', stars: 10 })
      for (let g = 0; g < 70 && s.alive && !from; g++) {
        step(s)
        if (s.career.phase === 'pro' && !(s as { pending?: unknown }).pending) from = structuredClone(s)
        endYear(s)
      }
    }
    expect(from).toBeDefined()
    const contract = { salary: 30000, untilAge: from!.age + 2, team: from!.career.team }
    const ask = (choice: number) => {
      const x = structuredClone(from!) as LifeState & { pending?: { id: string; data: Record<string, never> } }
      x.career.contract = { ...contract }
      x.pending = { id: 'jp.mlb', data: {} }
      resolveDecision(x, choice, screen)
      return x
    }
    const abroad = ask(0)
    expect(abroad.career.phase).toBe('abroad')
    expect(abroad.career.contract).toBeUndefined()
    const stay = ask(1)
    expect(stay.career.phase).toBe('pro')
    expect(stay.career.contract).toEqual(contract)
  })

  it('a change of team, a return from MLB and a break in the years each end the contract', () => {
    let tried = 0
    for (let i = 0; i < 8000 && tried < 3; i++) {
      const s = createLife({ seed: hashSeed(i + 4_400_000), country: 'JP', pace: 'p15', mode: 'potential', stars: 10 })
      for (let g = 0; g < 70 && s.alive; g++) {
        step(s)
        if (s.career.contract && s.career.contract.untilAge > s.age && s.career.phase === 'pro') {
          endYear(s)
          const c = s.career.contract!
          const variants: ((x: LifeState) => void)[] = [
            (x) => { x.career.team += '（移籍）' }, // another team
            (x) => { x.career.nextSalary = 5000 }, // a new contract (return from MLB, promotion)
            (x) => { x.career.salaryHist![x.career.salaryHist!.length - 1].kind = 'mlb' }, // the years were not NPB years
            (x) => { x.career.salaryHist![x.career.salaryHist!.length - 1].age -= 1 }, // a break
          ]
          for (const [k, mutate] of variants.entries()) {
            const x = structuredClone(s)
            mutate(x)
            step(x)
            // (the old contract is gone: none at all, or a new one signed this year with the team he is with now)
            const now = x.career.contract
            if (k === 0) expect(now === undefined || now.team === x.career.team, `seed ${s.config.seed} variant ${k}`).toBe(true)
            else expect(now, `seed ${s.config.seed} variant ${k}`).toBeUndefined()
            if (k === 1) expect(x.career.salaryHist!.at(-1)!.salary).toBe(5000)
          }
          // and unchanged, the same pay holds
          const same = structuredClone(s)
          step(same)
          expect(same.career.salaryHist!.at(-1)!.salary).toBe(c.salary)
          tried++
          break
        }
        endYear(s)
      }
    }
    expect(tried).toBeGreaterThan(0)
  }, 120_000)
})

describe('in lives', () => {
  const lives: LifeState[] = []
  for (let i = 0; i < 4000 && lives.length < 40; i++) {
    const s = runHeadless({ seed: hashSeed(i + 3_100_000), country: 'JP', pace: 'p15', mode: 'potential', stars: 9 }, sim, true)
    if (s.career.draft) lives.push(s)
  }

  it('a drafted player has a pick and terms; a signed one has the number he wears and his first salary is the contract’s', () => {
    expect(lives.length).toBeGreaterThan(20)
    for (const s of lives) {
      const d = s.career.draft!
      expect(['drafted', 'signed', 'declined']).toContain(d.status)
      expect(d.round).toBeGreaterThanOrEqual(1)
      expect(d.overall).toBeGreaterThanOrEqual(1)
      if (d.status === 'signed' && s.career.salaryHist?.length) {
        const first = s.career.salaryHist.find((h) => h.age > d.age)
        if (first && first.kind === d.kind) expect(first.salary).toBe(d.salary)
      }
    }
  })

  it('the year-by-year record adds up to the career totals, and the table shows every recorded year', () => {
    for (const s of lives.filter((x) => x.bb?.rec?.official.pro)) {
      const rows = s.bb!.rec!.tournaments.filter((t) => t.level === 'pro')
      const tot = s.bb!.rec!.official.pro!
      expect(rows.reduce((a, t) => a + t.line.games, 0)).toBe(tot.games)
      expect(rows.reduce((a, t) => a + t.line.h, 0)).toBe(tot.h)
      expect(rows.reduce((a, t) => a + t.line.outs, 0)).toBe(tot.outs)
      expect(new Set(rows.map((t) => t.age)).size).toBe(rows.length)
      const html = renderToStaticMarkup(<ProYears life={s} />)
      expect(html).toContain('通算')
      // each recorded season shows his age in it (the year as the cell's tooltip; PROJECT_PLAN §11.62)
      for (const t of rows) expect(html).toContain(`<td title="${s.person.birthYear + t.age}年">${t.age + 1}歳</td>`)
    }
  })

  it('the draft line stops the screen and the draft screen reads the record; the end of a career has its own screen', () => {
    // a drafted life played with its log (as on screen)
    const seed = lives.find((x) => x.career.draft?.status === 'signed')!.config.seed
    const s = createLife({ seed, country: 'JP', pace: 'p15', mode: 'potential', stars: 9 })
    const screen: Sim = { params: defaultParams() }
    for (let g = 0; g < 40 && s.alive && !s.career.draft; g++) {
      const plan = planYear(s, screen)
      for (const e of plan.events) s.log.push(e.entry)
      let d = plan.decision?.decision
      while (d && s.alive) {
        const r = resolveDecision(s, d.autoIndex, screen)
        for (const e of r.events) s.log.push(e.entry)
        d = r.followUp?.decision
      }
      endYear(s)
    }
    const entry = s.log.find((e) => e.stop === 'draft')
    expect(entry, 'the draft stops the screen').toBeDefined()
    const html = renderToStaticMarkup(<StopDialog life={s} stop={{ kind: 'draft', entry: entry! }} onGoOn={() => {}} />)
    expect(html).toContain(s.career.draft!.team)
    expect(html).toContain('契約・入団へ')
    expect(html).toContain('契約金')
    const quit = renderToStaticMarkup(<StopDialog life={s} stop={{ kind: 'quit', entry: { age: 17, year: 2043, kind: 'bad', text: 'やめました' } }} onGoOn={() => {}} />)
    expect(quit).toContain('野球をやめて、その後の人生を歩む')
  })
})

describe('the shown ability', () => {
  it('about 50 for a very strong high-school player and for the average pro; a child lower; 99 only far beyond', () => {
    const at = (age: number, z: number) => {
      const s = createLife({ seed: 3, country: 'JP', pace: 'p15' })
      s.age = age
      s.z = z
      s.bb = initBaseball(s, makeRng(1))
      for (const k of Object.keys(s.bb.skills) as (keyof typeof s.bb.skills)[]) s.bb.skills[k] = 0
      return abilityScore(s, 'control')
    }
    expect(Math.abs(at(17, 2.05) - 50)).toBeLessThanOrEqual(3)
    expect(Math.abs(at(26, 2.14) - 50)).toBeLessThanOrEqual(3)
    expect(at(17, 0)).toBeLessThan(30)
    expect(at(10, 1)).toBeLessThan(at(17, 1))
    expect(at(17, 4)).toBeLessThan(99)
  })
})

describe('the wished position', () => {
  it('offers the places of the stage and two-way, and leaves the last choice to the coach', () => {
    const s = createLife({ seed: 4, country: 'JP', pace: 'p15' })
    s.age = 16
    const c = wishChoices(s)
    expect(c.at(-1)!.wish).toBeUndefined()
    expect(c.some((x) => x.wish?.twoWay)).toBe(true)
    expect(c.map((x) => x.label)).toContain('遊撃手')
    s.age = 10
    expect(wishChoices(s).length).toBe(6)
  })
})

describe('the shared link and the feedback form', () => {
  it('a link carries only the birth, and anything out of range is refused', () => {
    const c = { seed: 123456, country: 'JP' as const, pace: 'p15' as const, mode: 'potential' as const, stars: 7, prefecture: 12 }
    const url = shareUrl('https://example.org/', c)
    // a life whose prefecture was drawn shares no prefecture: the same seed draws it again
    expect(readShared(new URL(shareUrl('https://example.org/', { seed: 9, country: 'JP', pace: 'p15' })).search)).toEqual({ seed: 9 })
    const a = createLife({ seed: 9, country: 'JP', pace: 'p15' })
    const b = createLife({ seed: 9, country: 'JP', pace: 'p15', ...readShared('?s=9') })
    expect(b.person).toEqual(a.person)
    expect(readShared(new URL(url).search)).toEqual({ seed: 123456, prefecture: 12, mode: 'potential', stars: 7 })
    expect(readShared('?s=1&pf=99')).toBeNull()
    expect(readShared('?s=<script>&pf=1')).toBeNull()
    expect(readShared('?s=1&pf=1&m=p&k=11')).toBeNull()
    expect(readShared('')).toBeNull()
    const s = runHeadless({ seed: 5, country: 'JP', pace: 'p15' }, sim)
    const text = shareText(s, 'ある人生', null, url)
    expect(text).toContain(url)
    expect(text).toContain('12万分の1')
  })

  it('the post on X fits its limit (Japanese counts 2, a link 23) and always ends with the link, even with a long title', () => {
    expect(xLength('あa')).toBe(3)
    expect(xLength('x https://1in120k.com/?s=4294967295&pf=46&m=p&k=10')).toBe(25)
    const url = 'https://1in120k.com/?s=4294967295&pf=46&m=p&k=10'
    for (let i = 0; i < 30; i++) {
      const s = runHeadless({ seed: hashSeed(i + 7_700_000), country: i % 3 === 0 ? 'US' : 'JP', pace: 'p15' }, sim)
      for (const [title, rarity] of [['ある人生', null], ['長い'.repeat(80), '約12万分の1'], ['短', '1,000回に1回未満']] as const) {
        const t = postText(s, title, rarity, url)
        expect(xLength(t)).toBeLessThanOrEqual(X_LIMIT)
        expect(t.endsWith('\n' + url)).toBe(true)
        expect(t).toContain(fullName(s))
      }
      // an ordinary life keeps every line
      const t = postText(s, 'ある人生', '約12万分の1', url)
      expect(t).toContain('「ある人生」')
      expect(t).toContain('約12万分の1')
    }
  })

  it('the connected form: the link carries the kind and the text as plain query values, to the Google form only', () => {
    const link = feedbackLink('バグ / Bug', '<script>alert(1)</script>&entry.1=x')!
    const u = new URL(link)
    expect(u.origin + u.pathname).toBe(FEEDBACK.formUrl)
    expect(u.hostname).toBe('docs.google.com')
    expect(u.searchParams.get('usp')).toBe('pp_url')
    expect(u.searchParams.get('entry.390606396')).toBe('バグ / Bug')
    expect(u.searchParams.get('entry.1460004378')).toBe('<script>alert(1)</script>&entry.1=x')
    expect([...u.searchParams.keys()].sort()).toEqual(['entry.1460004378', 'entry.390606396', 'usp'])
    expect([...FEEDBACK_CATEGORIES]).toEqual(['バグ / Bug', 'アイデア / Idea', 'その他 / Other'])
    const html = renderToStaticMarkup(<InfoPageView page="feedback" onBack={() => {}} />)
    expect(html).not.toContain('まだ接続されていません')
    expect(html).toContain('Google フォームで送信する')
  })

  it('an unconnected form (no url, an entry missing, or a url that is not Google Forms) pretends nothing and cannot send', () => {
    const saved = { ...FEEDBACK }
    try {
      for (const bad of [{ formUrl: '' }, { textEntry: '' }, { categoryEntry: '' }, { formUrl: 'https://example.com/forms/x' }]) {
        Object.assign(FEEDBACK, saved, bad)
        expect(feedbackLink('バグ / Bug', 'テストの文章です')).toBeNull()
        const html = renderToStaticMarkup(<InfoPageView page="feedback" onBack={() => {}} />)
        expect(html).toContain('まだ接続されていません')
        expect(html).toContain('未接続のため送信できません')
        expect(html).toContain('disabled')
      }
    } finally {
      Object.assign(FEEDBACK, saved)
    }
  })

  it('the first visit is light and 30 minutes; a saved light, dark or auto choice is kept', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) })
    try {
      expect(loadSettings().theme).toBe('light')
      expect(loadSettings().pace).toBe('p30')
      for (const theme of ['light', 'dark', 'auto'] as const) {
        saveSettings({ ...loadSettings(), theme })
        expect(loadSettings().theme).toBe(theme)
      }
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('text is cleaned to plain characters and the limit', () => {
    expect(cleanFeedback('  a\u0000b<script>  ')).toBe('ab<script>')
    expect(cleanFeedback('x'.repeat(5000)).length).toBe(FEEDBACK_MAX_LENGTH)
    for (const p of ['privacy', 'guide', 'legal'] as const) expect(renderToStaticMarkup(<InfoPageView page={p} onBack={() => {}} />).length).toBeGreaterThan(300)
    expect(renderToStaticMarkup(<InfoPageView page="legal" onBack={() => {}} />)).toContain('（未設定）')
  })
})
