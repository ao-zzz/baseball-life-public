import { describe, expect, it } from 'vitest'
import { createLife, endYear, fullName, planYear, prefName, resolveDecision, runHeadless, type Sim } from '../../life.ts'
import { defaultParams } from '../../params.ts'
import { hashSeed } from '../../rng.ts'
import { COUNTRY_INFO, COUNTRY_ORDER, countryTitle, livesIn } from '../index.ts'
import { CU_PROFILE, KR_PROFILE, LEAGUE_PROFILES, leagueProfile } from './profile.ts'
import { krPick, firstPay } from './year.ts'
import type { LifeState } from '../../types.ts'
import { validateSpecs } from '../../events/spec.ts'
import { LEAGUE_SPECS } from './events.ts'
import { shopCards } from '../../shop.ts'
import { ensureAfter } from '../../after.ts'

// Korea and Cuba (PROJECT_PLAN §11.46): the league flow, the profiles, the beta mark, and that Japan's lives are not touched by them.

const sim: Sim = { params: defaultParams(), headless: true }
const N = 1500
const lives = (cc: 'KR' | 'CU') => Array.from({ length: N }, (_, i) => runHeadless({ seed: hashSeed(i + (cc === 'KR' ? 51_000_000 : 52_000_000)), country: cc, pace: 'p15' }, sim))
const KR = lives('KR')
const CU = lives('CU')
/** a life played with every line kept in the log (as the screen keeps them) */
function played(cc: 'KR' | 'CU', seed: number): LifeState {
  const s = createLife({ seed, country: cc, pace: 'p15' })
  for (let g = 0; g < 130 && s.alive; g++) {
    const plan = planYear(s, sim)
    for (const e of plan.events) s.log.push(e.entry)
    let d = plan.decision?.decision
    while (d && s.alive) {
      const r = resolveDecision(s, d.autoIndex, sim)
      for (const e of r.events) s.log.push(e.entry)
      d = r.followUp?.decision
    }
    endYear(s)
  }
  return s
}
const share = (xs: LifeState[], f: (s: LifeState) => boolean) => xs.filter(f).length / xs.length

describe('the choice of the country', () => {
  it('marks every playable country but Japan as a beta, and shows an unfinished one as in preparation', () => {
    expect(countryTitle('JP')).toBe('日本')
    expect(countryTitle('US')).toBe('アメリカ（ベータ版）')
    expect(countryTitle('KR')).toBe('韓国（ベータ版）')
    expect(countryTitle('CU')).toBe('キューバ（ベータ版）')
    for (const c of COUNTRY_ORDER) {
      const i = COUNTRY_INFO[c]
      if (c === 'JP') expect(i.beta).toBe(false)
      else expect(i.beta, c).toBe(true)
      // a country that can be played has places of birth and a life table of its own
      if (i.implemented) expect(i.regions.length, c).toBeGreaterThan(5)
    }
    expect(COUNTRY_INFO.KR.implemented && COUNTRY_INFO.CU.implemented).toBe(true)
    expect(COUNTRY_INFO.TW.implemented).toBe(false)
    expect(COUNTRY_INFO.KR.lifeStatId).toBe('krLifeMaleAt10')
    expect(COUNTRY_INFO.CU.lifeStatId).toBe('cuLifeMaleAt10')
  })
})

describe('a new life in Korea and Cuba', () => {
  it('is born in the country, with its names and places, and lives there', () => {
    for (const [cc, xs] of [['KR', KR], ['CU', CU]] as const) {
      const names = new Set(LEAGUE_PROFILES[cc].family)
      for (const s of xs.slice(0, 60)) {
        expect(s.person.country).toBe(cc)
        expect(names.has(s.person.family), `${cc} ${s.person.family}`).toBe(true)
        expect(prefName(s)).toBe(COUNTRY_INFO[cc].regions[s.person.prefecture])
        // (a Cuban who has gone abroad lives in the US)
        expect(livesIn(s, cc) || (cc === 'CU' && s.flags?.['cu.mlb'] !== undefined)).toBe(true)
        expect(fullName(s)).toContain(s.person.given)
      }
    }
    // Cuban names are written given name first, Korean ones family name first
    const k = createLife({ seed: 1, country: 'KR', pace: 'p15' })
    const c = createLife({ seed: 1, country: 'CU', pace: 'p15' })
    expect(fullName(k).startsWith(k.person.family)).toBe(true)
    expect(fullName(c).startsWith(c.person.given)).toBe(true)
    expect(leagueProfile('JP')).toBeUndefined()
  })

  it('plays through the flow: some reach the pros, most stop earlier, and nobody gets Japan\'s ranks, teams or events', () => {
    const krPro = share(KR, (s) => s.career.highestRank >= 6)
    const krFirst = share(KR, (s) => s.career.highestRank >= 8)
    expect(krPro).toBeGreaterThan(0.002)
    expect(krPro).toBeLessThan(0.15)
    expect(krFirst).toBeLessThanOrEqual(krPro)
    expect(share(KR, (s) => s.career.highestRank >= 3)).toBeGreaterThan(0.1)
    expect(share(CU, (s) => s.career.highestRank >= 5)).toBeLessThan(0.15)
    expect(share(CU, (s) => s.career.highestRank >= 3)).toBeGreaterThan(0.1)
    for (const s of [...KR, ...CU]) {
      for (const t of s.log) expect(/NPB|甲子園|高野連/.test(t.text), `${s.person.country} ${t.text}`).toBe(false)
      expect(s.alive).toBe(false)
    }
  })

  it('has the pros of the country: a 2軍 and 1軍 in Korea (with the draft), the national league in Cuba', () => {
    expect(KR.some((s) => s.career.draftedFrom?.startsWith('KR-'))).toBe(true)
    // (a life that was drafted, played again with its lines kept: the same life)
    const drafted = KR.filter((s) => s.career.draftedFrom?.startsWith('KR-')).slice(0, 5)
    expect(drafted.length).toBeGreaterThan(0)
    for (const d of drafted) expect(played('KR', d.config.seed).log.some((e) => /KBOの新人ドラフト/.test(e.text))).toBe(true)
    expect(CU.some((s) => s.career.achievements.includes('国内リーグ'))).toBe(true)
  })

  it('dies on average near the country\'s (assumed) life table', () => {
    const mean = (xs: LifeState[]) => xs.reduce((a, s) => a + s.age, 0) / xs.length
    // (loose: the table is an estimate and the health model moves the death rate a little)
    expect(mean(KR)).toBeGreaterThan(76)
    expect(mean(KR)).toBeLessThan(85)
    expect(mean(CU)).toBeGreaterThan(71)
    expect(mean(CU)).toBeLessThan(82)
  })

  it('keeps the household of the country: a wage of its own scale, a pension of its own age', () => {
    const rich = KR.filter((s) => s.after?.retired).length
    expect(rich).toBeGreaterThan(10)
    // Cuba's household is small beside Korea's: the same table, a scale of 0.2
    const meanIncome = (xs: LifeState[]) => xs.reduce((a, s) => a + s.lifetimeIncome, 0) / xs.length
    expect(meanIncome(CU)).toBeLessThan(meanIncome(KR))
  })
})

describe('the pay and the pick of Korea', () => {
  it('a pick falls with a lower standing, and the first team pays more with years and ability, within its cap', () => {
    expect(krPick(0.95, 0.5, 0.5).overall).toBeLessThan(krPick(0.1, 0.5, 0.5).overall)
    // (the bonus: about ₩700 million for the first pick, the minimum salary ₩30 million at the least: profile.ts, year.ts krPick)
    expect(krPick(1, 0, 0).bonus).toBe(7700)
    expect(krPick(0, 1, 1).bonus).toBeGreaterThanOrEqual(KR_PROFILE.pay.min)
    expect(KR_PROFILE.pay.min).toBe(330)
    expect(firstPay(KR_PROFILE, 8, 1, 0)).toBeGreaterThan(firstPay(KR_PROFILE, 0, 0, 0))
    expect(firstPay(KR_PROFILE, 30, 6, 3)).toBeLessThanOrEqual(KR_PROFILE.pay.cap)
    expect(firstPay(KR_PROFILE, 0, -3, 0)).toBeGreaterThanOrEqual(KR_PROFILE.pay.min)
    // (a Cuban star at home is paid less than an established KBO regular: Cuba's pay is the model's small scale, profile.ts)
    expect(CU_PROFILE.pay.cap).toBeLessThan(firstPay(KR_PROFILE, 5, 0, 0))
  })
})

describe('a decision on screen goes through the same flow (the おまかせ answer is the headless one)', () => {
  it('asks the middle school choice at 10, and the country\'s resolver answers it', () => {
    for (const cc of ['KR', 'CU'] as const) {
      const s = createLife({ seed: 7, country: cc, pace: 'p15' })
      const screen: Sim = { params: defaultParams() }
      let asked = ''
      for (let g = 0; g < 14 && s.alive && !asked; g++) {
        const plan = planYear(s, screen)
        let d = plan.decision?.decision
        while (d && s.alive) {
          if (/\.mid$/.test(d.id)) asked = d.id
          d = resolveDecision(s, d.autoIndex, screen).followUp?.decision
        }
        endYear(s)
      }
      expect(asked).toBe(`${cc.toLowerCase()}.mid`)
    }
  })
})

describe('the events of the countries', () => {
  it('are well formed, and each is tied to the country he lives in', () => {
    expect(validateSpecs(LEAGUE_SPECS, new Set())).toEqual([])
    for (const sp of LEAGUE_SPECS) {
      expect(sp.lives, sp.id).toBeDefined()
      expect(sp.id.startsWith(sp.id.startsWith('cu.abroad') ? 'cu.abroad' : sp.lives!.toLowerCase() + '.'), sp.id).toBe(true)
      // never a calibrated effect (the ability, the injuries, the death rate) without declaring it
      expect(sp.career, sp.id).toBeUndefined()
    }
  })

  it('happen in the lives of the country, and only its own are met there', () => {
    const seenKr = new Set<string>()
    const seenCu = new Set<string>()
    for (let i = 0; i < 150; i++) {
      for (const [cc, seen] of [['KR', seenKr], ['CU', seenCu]] as const) {
        const s = played(cc, hashSeed(i + 55_000_000))
        for (const e of s.log) if (e.eventId) seen.add(e.eventId)
      }
    }
    const own = (set: Set<string>, tag: string) => [...set].filter((id) => id.startsWith(tag))
    expect(own(seenKr, 'kr.').length).toBeGreaterThan(8)
    expect(own(seenCu, 'cu.').length).toBeGreaterThan(8)
    // (Korea's lives never meet Cuba's, nor either those of the other tables)
    expect([...seenKr].some((id) => id.startsWith('cu.') || id.endsWith('.jp') || id.endsWith('.us'))).toBe(false)
    // (a Cuban who went abroad lives in the US and meets its events, as a Japanese in the MLB does)
    expect([...seenCu].some((id) => id.startsWith('kr.') || id.endsWith('.jp'))).toBe(false)
  })

  it('give the money screen their own cards, in the money of the country', () => {
    const man = (cc: 'KR' | 'CU', money: number) => {
      const s = createLife({ seed: 9, country: cc, pace: 'p15' })
      s.age = 40
      s.career.phase = 'retired'
      s.career.endedAge = 36
      s.money = money
      s.income = 400
      ensureAfter(s).home = 'rent'
      return s
    }
    const kr = shopCards(man('KR', 3000))
    const cu = shopCards(man('CU', 800))
    expect(kr.length).toBeGreaterThan(4)
    expect(cu.length).toBeGreaterThan(4)
    expect(kr.every((c) => c.id.endsWith('.kr') || c.id.startsWith('pub.') || c.id.startsWith('her.'))).toBe(true)
    expect(cu.every((c) => c.id.endsWith('.cu') || c.id.startsWith('pub.') || c.id.startsWith('her.'))).toBe(true)
    // the same topic costs less in Cuba's money (a quarter of Japan's scale)
    const cost = (cards: typeof kr, id: string) => cards.find((c) => c.id === id)?.options.find((o) => o.cost > 0)?.cost
    const k = cost(kr, 'sp.parents.kr')
    const c = cost(cu, 'sp.parents.cu')
    if (k !== undefined && c !== undefined) expect(c).toBeLessThan(k)
  })
})
describe('the military service of Korea and the road abroad of Cuba', () => {
  it('a Korean pro owes the service: asked once, two years without a season, and told in the log', () => {
    const served = KR.filter((s) => s.flags?.['kr.mil'] !== undefined).slice(0, 4)
    expect(served.length).toBeGreaterThan(0)
    for (const d of served) {
      const s = played('KR', d.config.seed)
      expect(s.log.filter((e) => /兵役を始めました|入隊し、兵役を始めました/.test(e.text)).length).toBe(1)
      expect(s.log.some((e) => /兵役を終えました/.test(e.text))).toBe(true)
      // the years of the service are paid at the service's rate, not the team's
      const from = d.flags!['kr.mil']
      const pays = (s.career.salaryHist ?? []).filter((h) => h.age >= from && h.age < from + 2)
      for (const h of pays) expect([60, 120]).toContain(h.salary)
    }
  })

  it('a Cuban who is offered a contract abroad and takes it plays on in the US flow, lives in the US, and is told so', () => {
    const left = CU.filter((s) => s.flags?.['cu.mlb'] !== undefined).slice(0, 4)
    expect(left.length).toBeGreaterThan(0)
    for (const d of left) {
      const s = played('CU', d.config.seed)
      expect(s.log.some((e) => /海を渡り、MLB球団と契約しました/.test(e.text))).toBe(true)
      expect(s.residence).toBe('US')
      expect(s.career.draftedFrom).toBe('CU-abroad')
      expect(s.career.highestRank).toBeGreaterThanOrEqual(6)
    }
  })
})