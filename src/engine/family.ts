import type { LifeState, PartnerInfo } from './types.ts'
import type { CountryCode } from '../data/types.ts'
import { GIVEN_NAMES, PARTNER_NAMES } from '../data/jp.ts'
import { US_GIVEN_NAMES, US_PARTNER_NAMES } from '../data/us.ts'
import { CU_GIVEN_NAMES, CU_PARTNER_NAMES, KR_GIVEN_NAMES, KR_PARTNER_NAMES } from '../data/league.ts'
import { causeOfDeath } from './mortality.ts'
import { hashSeed, makeRng, type Rng } from './rng.ts'

// Who the people of his family are (PROJECT_PLAN §11.61): the partner's age and work when they meet, the children's names, the cause
// of a parent's death. Every draw here is on a stream of its own (a function of the life, the age and a salt), never the year's
// calibrated one, so nothing calibrated moves. The people are fictional, as he is; what is drawn is kept in the state and shown the
// same way afterwards.

const own = (s: LifeState, salt: number): Rng => makeRng(hashSeed(s.config.seed ^ Math.imul(s.age + 11, 0x2c1b3c6d) ^ salt))

/** the work of someone his partner's age (a few common kinds; an assumption of the game) */
const JOBS = ['会社員', '看護師', '保育士', '小学校の教員', '公務員', '美容師', '販売員', '事務職', '薬剤師', 'デザイナー', '飲食店の店員', '銀行員']

/** the partner he meets now: a few years younger or older, and what they do */
export function drawPartner(s: LifeState, name: string, salt = 0): PartnerInfo {
  const r = own(s, 0x9a27 ^ salt)
  const gap = r.weighted([-4, -3, -2, -1, 0, 1, 2, 3], [1, 2, 3, 3, 3, 2, 1, 1])
  const age = s.age + gap
  const job = age <= 22 && r.chance(0.6) ? '大学生' : r.pick(JOBS)
  return { name, gap, job }
}

/**
 * After 「もう少しこのままでいる」 (love.wait), the proposal comes back two years on by itself, instead of waiting for the year's draw
 * (about one eligible year in nine, so a median of seven years): a booking (events.ts runDue) of the question of the stage he will be
 * in then, the playing years' (life.proposal) or the adult one's (love.propose); the other lapses. A booking waits up to two more years
 * for room in a year; another wait books it again. Nothing is drawn here.
 */
export function bookProposal(s: LifeState): void {
  const due = (s.due ??= [])
  for (const id of ['love.propose', 'life.proposal']) due.push({ id, age: s.age + 2, until: s.age + 4, from: 'love.wait' })
}

/** 「（28歳・看護師）」 for the partner he dates now, or '' when nothing is known of them */
export function partnerWords(s: LifeState, name = s.family.partner): string {
  const p = s.family.partnerInfo
  return p && name && p.name === name ? `（${s.age + p.gap}歳・${p.job}）` : ''
}

/** 「（28歳・看護師）」 for a partner just met (before they date) */
export const infoWords = (s: LifeState, p: PartnerInfo): string => `（${s.age + p.gap}歳・${p.job}）`

const KID_NAMES: Partial<Record<CountryCode, string[][]>> = {
  JP: [GIVEN_NAMES, PARTNER_NAMES],
  US: [US_GIVEN_NAMES, US_PARTNER_NAMES],
  KR: [KR_GIVEN_NAMES, KR_PARTNER_NAMES],
  CU: [CU_GIVEN_NAMES, CU_PARTNER_NAMES],
}

/** a child is born: the age 0 and a name (never the name of an older brother or sister) */
export function addKid(s: LifeState): string {
  const f = s.family
  const kids = (f.kids ??= [])
  // the names of children born before names were kept stay unknown (null in the list is not used: an empty string)
  const names = (f.kidNames ??= kids.map(() => ''))
  kids.push(0)
  const lists = KID_NAMES[s.person.country] ?? KID_NAMES.JP!
  const r = own(s, 0x6b1d ^ kids.length)
  const pool = lists[r.chance(0.5) ? 0 : 1].filter((n) => !names.includes(n))
  const name = pool.length ? r.pick(pool) : r.pick(lists[0])
  names.push(name)
  return name
}

/** the child's name, or '' when it is not known (older saves) */
export function kidNameOf(s: LifeState, i: number): string {
  return s.family.kidNames?.[i] ?? ''
}

/** the cause of a relative's death at that age, from the model's causes (mortality.ts; an assumption, as for his own) */
export function relativeCause(s: LifeState, age: number, salt: number): string {
  return causeOfDeath(age, own(s, 0xdea7 ^ salt))
}
