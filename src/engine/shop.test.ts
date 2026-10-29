import { describe, expect, it } from 'vitest'
import { createLife, endYear, planYear, resolveDecision, type Sim } from './life.ts'
import { defaultParams } from './params.ts'
import { ensureAfter } from './after.ts'
import { DIETS, INSURANCES, VEHICLES, autoShopYear, buyShop, careYear, portfolioYear, recordHist, setDiet, setInsurance, setVehicle, shopCards, shopSettings, spareMoney, toggleAuto } from './shop.ts'
import { setResidence } from './countries/index.ts'
import type { LifeState } from './types.ts'

// The money screen (PROJECT_PLAN §11.43): its cards are the spending events, a purchase is the event's own choice, taken once.

const headless: Sim = { params: defaultParams(), headless: true }

function man(country: 'JP' | 'US', money: number, over: (s: LifeState) => void = () => {}): LifeState {
  const s = createLife({ seed: 77, country, pace: 'p15' })
  s.age = 40
  s.career.phase = 'retired'
  s.career.endedAge = 36
  s.career.highestRank = 8
  s.money = money
  s.income = 400
  const a = ensureAfter(s)
  a.retired = false
  a.home = 'rent'
  over(s)
  return s
}
const ids = (s: LifeState) => shopCards(s).map((c) => c.id)

describe('the cards', () => {
  it('follow the country he lives in, and are one per event he could buy now', () => {
    const jp = man('JP', 3000)
    const us = man('US', 3000)
    expect(ids(jp).length).toBeGreaterThan(5)
    for (const id of ids(jp)) expect(id.endsWith('.jp') || id.startsWith('pub.') || id.startsWith('her.'), id).toBe(true)
    expect(ids(jp).some((id) => id.endsWith('.us'))).toBe(false)
    expect(ids(us).some((id) => id.endsWith('.jp'))).toBe(false)
    // a US-born man who lives in Japan is shown Japan's
    const moved = man('US', 3000)
    setResidence(moved, 'JP')
    expect(ids(moved).some((id) => id.endsWith('.jp'))).toBe(true)
    expect(new Set(ids(jp)).size).toBe(ids(jp).length)
    expect(shopCards(jp).filter((c) => c.group === 'now').length).toBeLessThanOrEqual(5)
  })

  it('open and close with what he has: age, savings, home, family, a playing career', () => {
    const young = man('JP', 3000, (s) => (s.age = 16))
    expect(shopCards(young)).toEqual([])
    const poor = man('JP', 5)
    for (const c of shopCards(poor)) for (const o of c.options) expect(o.open, `${c.id} ${o.label}`).toBe(false)
    const rich = man('JP', 5000)
    expect(ids(rich)).toContain('sp.car.jp')
    expect(ids(rich)).not.toContain('sp.trip.jp') // no family
    rich.family.spouse = { name: 'X', years: 3 }
    expect(ids(rich)).toContain('sp.trip.jp')
    // a retired man has no baseball spending; a playing one has
    expect(ids(rich).some((id) => id.startsWith('sp.camp'))).toBe(false)
    const playing = man('JP', 5000, (s) => {
      s.career.phase = 'pro'
      s.age = 30
    })
    expect(ids(playing).some((id) => id.startsWith('sp.camp') || id.startsWith('sp.gear'))).toBe(true)
    // a man with a home of his own is not offered to buy one, and a renter is not offered the fittings
    const owner = man('JP', 5000, (s) => {
      s.career.phase = 'pro'
      s.age = 30
    })
    owner.after!.home = 'own'
    expect(ids(owner)).not.toContain('sp.home.jp')
    expect(ids(owner)).toContain('sp.fixup.jp')
    expect(ids(playing)).toContain('sp.home.jp')
    expect(ids(playing)).not.toContain('sp.fixup.jp')
  })

  it('an event that waits as a decision is not shown on the screen at the same time', () => {
    const s = man('JP', 5000)
    expect(ids(s)).toContain('sp.car.jp')
    ;(s as unknown as { pending: unknown }).pending = { id: 'sp.car.jp', data: {} }
    expect(ids(s)).not.toContain('sp.car.jp')
  })
})

describe('buying', () => {
  it('takes the price once, writes the log line, and the event counts as having happened (no second purchase, no second asking)', () => {
    const s = man('JP', 5000)
    const before = s.money
    const r = buyShop(s, 'sp.car.jp', 0)
    expect(r.ok).toBe(true)
    expect(before - s.money).toBe(180)
    expect(r.lines.length).toBeGreaterThan(0)
    expect(r.lines[0].eventId).toBe('sp.car.jp')
    expect(s.flags?.['own.car']).toBeDefined()
    expect(s.evHist?.['sp.car.jp']?.[1]).toBe(1)
    const again = buyShop(s, 'sp.car.jp', 0)
    expect(again.ok).toBe(false)
    expect(s.money).toBe(before - 180)
    expect(ids(s)).not.toContain('sp.car.jp')
  })

  it('refuses what he cannot pay, and what is not offered, without changing anything', () => {
    const s = man('JP', 100)
    const snap = JSON.stringify([s.money, s.flags, s.evHist, s.status])
    expect(buyShop(s, 'sp.car.jp', 0).ok).toBe(false) // a new car
    expect(buyShop(s, 'sp.car.jp', 5).ok).toBe(false) // no such choice
    expect(buyShop(s, 'sp.car.jp', 2).ok).toBe(false) // the free answer is not a purchase
    expect(buyShop(s, 'sp.camp.jp', 0).ok).toBe(false) // not playing
    expect(buyShop(s, 'no.such', 0).ok).toBe(false)
    expect(JSON.stringify([s.money, s.flags, s.evHist, s.status])).toBe(snap)
    expect(buyShop(man('JP', 100, (x) => (x.age = 15)), 'sp.car.jp', 1).ok).toBe(false)
  })

  it('a home: the down payment and the loan, once, and he lives in it', () => {
    const s = man('JP', 2000, (x) => {
      x.career.phase = 'pro'
      x.age = 30
    })
    const m = s.money
    const r = buyShop(s, 'sp.home.jp', 0)
    expect(r.ok).toBe(true)
    expect(m - s.money).toBe(400)
    expect(s.after!.home).toBe('own')
    expect(s.after!.loan).toBe(2800)
    expect(buyShop(s, 'sp.home.jp', 0).ok).toBe(false)
    expect(s.after!.loan).toBe(2800)
  })

  it('an investment: paid now, flagged, and its result booked for later (the same system as the event)', () => {
    const s = man('US', 2000)
    const m = s.money
    expect(buyShop(s, 'sp.invest.us', 1).ok).toBe(true) // stocks
    expect(m - s.money).toBe(200)
    expect(s.flags?.['inv.stocks']).toBeDefined()
    expect(s.flags?.['invest.started']).toBeDefined()
    expect(s.due?.some((d) => d.id === 'sp.investBack.us')).toBe(true)
    // the old event's flag is shared: it is not asked besides this
    expect(ids(s)).not.toContain('sp.invest.us')
  })

  it('a baseball choice moves the states of the game; the free answer is not on the screen at all', () => {
    const s = man('JP', 3000, (x) => {
      x.career.phase = 'pro'
      x.age = 30
    })
    for (const c of shopCards(s)) expect(c.options.every((o) => o.cost >= 0)).toBe(true)
    const card = shopCards(s).find((c) => c.id === 'sp.coach.jp')!
    expect(card.options.length).toBe(2)
    expect(card.options[0].effects.join()).toContain('自信')
  })

  it('a purchase is deterministic: the same life, the same age, the same result', () => {
    const run = () => {
      const s = man('US', 2000, (x) => {
        x.career.phase = 'pro'
        x.age = 30
      })
      buyShop(s, 'sp.coach.us', 0)
      return JSON.stringify([s.money, s.status, s.flags])
    }
    const mk2 = () =>
      man('US', 2000, (x) => {
        x.career.phase = 'pro'
        x.age = 30
      })
    const a = mk2()
    const b = mk2()
    expect(buyShop(a, 'sp.coach.us', 0).lines.map((l) => l.text)).toEqual(buyShop(b, 'sp.coach.us', 0).lines.map((l) => l.text))
    expect(run()).toBe(run())
  })
})

describe('the standing settings', () => {
  it('nothing is set until the player sets it, and the yearly parts then do nothing and draw nothing', () => {
    const s = man('JP', 3000)
    expect(s.shop).toBeUndefined()
    expect(shopSettings(s)).toEqual({ vehicle: 'deposit', auto: [], insurance: undefined, diet: 'free' })
    expect(portfolioYear(s)).toBe(0)
    expect(autoShopYear(s)).toEqual([])
    setVehicle(s, 'deposit')
    expect(portfolioYear(s)).toBe(0)
  })

  it('the spare money earns or loses by its vehicle, from a stream of its own: the same year gives the same result', () => {
    const a = man('JP', 3000)
    const b = man('JP', 3000)
    setVehicle(a, 'index')
    setVehicle(b, 'index')
    expect(spareMoney(a)).toBe(2600)
    const ga = portfolioYear(a)
    expect(portfolioYear(b)).toBe(ga)
    expect(a.money).toBe(3000 + ga)
    expect(Math.abs(ga)).toBeLessThan(2600 * 0.7)
    // a safer vehicle swings less (over many years)
    const swing = (v: 'bond' | 'index') => {
      let max = 0
      for (let age = 30; age < 70; age++) {
        const s = man('JP', 3000, (x) => (x.age = age))
        setVehicle(s, v)
        max = Math.max(max, Math.abs(portfolioYear(s)) / 2600)
      }
      return max
    }
    expect(swing('bond')).toBeLessThan(swing('index'))
    expect(VEHICLES.index.sd).toBeGreaterThan(VEHICLES.bond.sd)
    // no spare money, no result
    const poor = man('JP', 300)
    setVehicle(poor, 'index')
    expect(portfolioYear(poor)).toBe(0)
  })

  it('the repeating spending: only the kinds turned on, only when he has three times the cost and a year\'s income would remain, once a year', () => {
    const s = man('US', 5000, (x) => (x.family.spouse = { name: 'Emily', years: 3 }))
    expect(toggleAuto(s, 'sp.trip')).toBe(true)
    const m = s.money
    const lines = autoShopYear(s)
    expect(lines.length).toBeGreaterThan(0)
    expect(m - s.money).toBe(60)
    // the same year again: the event's own interval holds
    expect(autoShopYear(s)).toEqual([])
    expect(s.money).toBe(m - 60)
    // switched off again, and too little money
    expect(toggleAuto(s, 'sp.trip')).toBe(false)
    const poor = man('US', 100, (x) => (x.family.spouse = { name: 'Emily', years: 3 }))
    toggleAuto(poor, 'sp.trip')
    expect(autoShopYear(poor)).toEqual([])
    expect(poor.money).toBe(100)
  })
})

describe('the おまかせ and headless lives are not touched by the screen', () => {
  it('a life with settings has the same career as one without: the settings draw from streams of their own', () => {
    const play = (set: boolean) => {
      const s = createLife({ seed: 4242, country: 'US', pace: 'p15' })
      if (set) s.shop = { vehicle: 'index', auto: ['sp.trip'] }
      for (let g = 0; g < 130 && s.alive; g++) {
        let d = planYear(s, headless).decision?.decision
        while (d && s.alive) d = resolveDecision(s, d.autoIndex, headless).followUp?.decision
        endYear(s)
      }
      return s
    }
    const a = play(false)
    const b = play(true)
    expect(b.career.highestRank).toBe(a.career.highestRank)
    expect(b.career.endedAge).toBe(a.career.endedAge)
    expect(b.timeline.map((t) => t.phase).join()).toBe(a.timeline.map((t) => t.phase).join())
    expect(b.z).toBe(a.z)
  })

  it('a life that never opened the screen has no settings in its state', () => {
    const s = createLife({ seed: 9, country: 'JP', pace: 'p15' })
    for (let g = 0; g < 50 && s.alive; g++) {
      let d = planYear(s, headless).decision?.decision
      while (d && s.alive) d = resolveDecision(s, d.autoIndex, headless).followUp?.decision
      endYear(s)
    }
    expect(s.shop).toBeUndefined()
  })
})

describe('insurance, diet and the trend', () => {
  it('do nothing until chosen', () => {
    const s = man('JP', 3000)
    expect(careYear(s)).toEqual([])
    expect(s.money).toBe(3000)
    recordHist(s)
    expect(s.shop).toBeUndefined()
  })
  it('take the premium and the food cost once a year and move the health', () => {
    const s = man('JP', 3000)
    s.status.health = 50
    setInsurance(s, 'basic')
    setDiet(s, 'strict')
    careYear(s)
    expect(s.money).toBeLessThanOrEqual(3000 - DIETS.strict.cost - INSURANCES.basic.premium)
    expect(s.status.health).toBeGreaterThanOrEqual(50 + DIETS.strict.health - 2)
  })
  it('pay a bill for a man without insurance in full, and mostly for a covered one', () => {
    let none = 0
    let full = 0
    for (let age = 20; age < 80; age++) {
      const a = man('JP', 100000, (x) => (x.age = age))
      setInsurance(a, 'none')
      careYear(a)
      none += 100000 - a.money
      const b = man('JP', 100000, (x) => (x.age = age))
      setInsurance(b, 'full')
      careYear(b)
      full += 100000 - b.money - INSURANCES.full.premium
    }
    expect(none).toBeGreaterThan(0)
    expect(full).toBeLessThan(none * 0.2)
  })
  it('keep the savings by year, one point per age', () => {
    const s = man('JP', 3000)
    setVehicle(s, 'deposit')
    recordHist(s)
    s.money = 3100
    recordHist(s)
    s.age = 41
    recordHist(s)
    expect(s.shop?.hist).toEqual([[40, 3100], [41, 3100]])
  })
})