import type { EventStage } from '../events.ts'
import type { ChoiceSpec, Effect, EventSpec } from '../events/spec.ts'
import { NEAR_REPEAT, PLAYING_STAGES, similarity, validateSpecs } from '../events/spec.ts'
import { COUNTRY_INFO } from '../countries/index.ts'
import { EFFECT_IMPACT, IMPACTS, atLeast, type Pack } from './kit.ts'

// The checks of the event packs (packs/kit.ts), run by the packs' tests each time a pack is added. They answer, before any life is
// played: is every id, flag and category the pack's own; does every continuation start from a flag the pack sets; does every
// effect stay within what the pack declares (`impact`), and the おまかせ path within flags while he plays; are the texts short,
// and not near-repeats of each other or of the existing catalog; and the catalog's own checks (events/spec.ts validateSpecs).

/** lengths on screen (characters): a line has to make sense alone, on a screenshot */
export const PACK_TEXT_LIMITS = { text: 120, body: 160, title: 20, label: 32, hint: 48 }

const STAGES: EventStage[] = ['child', 'youth', 'jhs', 'hs', 'univ', 'amateur', 'pro', 'student', 'adult', 'senior']
/** fields of a spec that belong to the catalog's own passes, never to a pack's event */
const NOT_FOR_PACKS = ['country', 'lives', 'theme', 'extra', 'followOnly', 'priority', 'potentialOnly', 'needsChoice', 'career'] as const
/** what a question of high school must move on choosing: the state compared by hs.test.ts (each of its questions leads to different states) */
const HS_STATE_KEYS: (keyof Effect)[] = ['happy', 'rel', 'know', 'health', 'conf', 'eval', 'fatigue', 'skill', 'gain', 'injury', 'position', 'captain']

const list = (x: string | string[] | undefined): string[] => (x === undefined ? [] : Array.isArray(x) ? x : [x])
const outcomesOf = (sp: EventSpec) => [...(sp.outcomes ?? []), ...(sp.choices ?? []).flatMap((c) => c.outcomes)]
const effectsOf = (sp: EventSpec) => [...(sp.choices ?? []).map((c) => c.effects), ...outcomesOf(sp).map((o) => o.effects)]
const set = (v: unknown) => v !== undefined && v !== 0

/** the fixed texts of a set of specs (the existing catalog's, for the check of near-repeats) */
export function catalogTexts(specs: readonly EventSpec[]): string[] {
  return specs.flatMap((sp) => outcomesOf(sp).flatMap((o) => (typeof o.text === 'string' ? [o.text] : [])))
}

/**
 * Problems in the packs (empty = fine). `known`: the ids of the existing events (not the packs'); `existing`: the existing
 * catalog's texts (catalogTexts).
 */
export function validatePacks(packs: readonly Pack[], known: ReadonlySet<string>, existing: readonly string[] = []): string[] {
  const out: string[] = []
  const packIds = new Set<string>()
  const ids = new Set<string>()
  const texts: [string, string][] = []
  const L = PACK_TEXT_LIMITS
  for (const p of packs) {
    const P = `pk.${p.id}`
    if (!/^[a-z][A-Za-z0-9]*$/.test(p.id)) out.push(`${p.id}: a pack's id is a lower-case letter, then letters and digits`)
    if (packIds.has(p.id)) out.push(`${p.id}: duplicate pack`)
    packIds.add(p.id)
    if (p.countries.length === 0) out.push(`${p.id}: no country`)
    for (const cc of p.countries) if (!(cc in COUNTRY_INFO)) out.push(`${p.id}: unknown country ${cc}`)
    if (new Set(p.countries).size !== p.countries.length) out.push(`${p.id}: a country named twice`)
    if (p.where !== 'born' && p.where !== 'lives') out.push(`${p.id}: where is 'born' or 'lives'`)
    if (!IMPACTS.includes(p.impact)) out.push(`${p.id}: unknown impact ${p.impact}`)
    const approved = !!p.approved?.trim()
    if (atLeast(p.impact, 'career') && !approved) out.push(`${p.id}: impact '${p.impact}' moves the calibrated lives or the death rate: it needs an approval (approved)`)
    if (p.events.length === 0) out.push(`${p.id}: no event`)
    // the flags the pack sets (where its continuations may start)
    const setFlags = new Set(p.events.flatMap((e) => [...(e.spec.choices ?? []).flatMap((c) => list(c.flag)), ...effectsOf(e.spec).flatMap((x) => list(x?.flag))]))
    for (const e of p.events) {
      const sp = e.spec
      const where = sp.id
      if (!sp.id.startsWith(`${P}.`) || !/^[\w.-]+$/.test(sp.id)) out.push(`${where}: an id of the pack is ${P}.<name>`)
      if (ids.has(sp.id) || known.has(sp.id)) out.push(`${where}: duplicate id`)
      ids.add(sp.id)
      if (sp.category !== P && !sp.category.startsWith(`${P}.`)) out.push(`${where}: the category ${sp.category} is not the pack's`)
      for (const key of NOT_FOR_PACKS) if (sp[key] !== undefined) out.push(`${where}: '${key}' is not for a pack's event`)
      if (sp.stages.length === 0) out.push(`${where}: no stage`)
      for (const st of sp.stages) if (!STAGES.includes(st)) out.push(`${where}: unknown stage ${st}`)
      if (sp.ages && sp.ages[0] > sp.ages[1]) out.push(`${where}: ages reversed`)
      // the catalog's booked follow-ups are not for the packs: they chain by flags (later)
      if (outcomesOf(sp).some((o) => o.follow?.length) || (sp.choices ?? []).some((c) => c.follow?.length)) out.push(`${where}: a pack continues its events by flags (later), not by follow-ups`)
      // flags: only the pack's own
      const named = [...(sp.choices ?? []).flatMap((c) => list(c.flag)), ...effectsOf(sp).flatMap((x) => [...list(x?.flag), ...list(x?.unflag)])]
      for (const f of named) if (!f.startsWith(`${P}.`)) out.push(`${where}: the flag ${f} is not the pack's`)
      if (e.after) {
        if (!e.after.flag.startsWith(`${P}.`)) out.push(`${where}: continues ${e.after.flag}, a flag of another pack`)
        else if (!setFlags.has(e.after.flag)) out.push(`${where}: continues ${e.after.flag}, which no event of the pack sets`)
        const [lo, hi] = e.after.years
        // (a continuation comes in a later year: the pass picks the year's events before running them)
        if (!(lo >= 1 && hi >= lo)) out.push(`${where}: the window of years starts 1 year after the flag or later, and is not reversed`)
      }
      if (e.chance !== undefined && !(e.chance > 0 && e.chance <= 1)) out.push(`${where}: a chance a year is above 0 and at most 1`)
      // effects: every key has a level, and none is beyond the pack's impact
      for (const x of effectsOf(sp)) {
        for (const [key, v] of Object.entries(x ?? {}) as [keyof Effect, unknown][]) {
          if (!set(v)) continue
          const lv = EFFECT_IMPACT[key]
          if (!lv) out.push(`${where}: the effect '${key}' has no level (packs/kit.ts EFFECT_IMPACT)`)
          else if (!atLeast(p.impact, lv)) out.push(`${where}: '${key}' (${lv}) is beyond the pack's impact '${p.impact}'`)
        }
      }
      // while he plays, the おまかせ path changes flags only (unless declared and approved)
      if (sp.stages.some((st) => PLAYING_STAGES.includes(st))) {
        const auto = sp.choices ? (typeof sp.auto === 'number' ? sp.choices[sp.auto] : undefined) : undefined
        const path = sp.choices ? (auto ? [auto.effects, ...auto.outcomes.map((o) => o.effects)] : []) : (sp.outcomes ?? []).map((o) => o.effects)
        const moved = [...new Set(path.flatMap((x) => Object.entries(x ?? {}).filter(([k, v]) => set(v) && EFFECT_IMPACT[k as keyof Effect] !== 'log').map(([k]) => k)))]
        if (moved.length && !(e.autoEffects && approved)) out.push(`${where}: the おまかせ path changes ${moved.join(', ')} while he plays (needs autoEffects and the pack's approval)`)
      }
      // questions
      if (sp.choices) {
        if (typeof sp.auto !== 'number' || !sp.choices[sp.auto]) out.push(`${where}: おまかせ points at no choice`)
        if (sp.stages.includes('hs')) {
          const sig = (c: ChoiceSpec) => JSON.stringify(HS_STATE_KEYS.map((k) => c.effects?.[k] ?? null))
          if (new Set(sp.choices.map(sig)).size < 2) out.push(`${where}: a question of high school needs two choices that change the state differently on choosing (happiness, relations, knowledge or baseball; hs.test.ts)`)
        }
        if ((sp.title ?? '').length > L.title) out.push(`${where}: the title is longer than ${L.title}`)
        if (typeof sp.body === 'string' && sp.body.length > L.body) out.push(`${where}: the body is longer than ${L.body}`)
        for (const c of sp.choices) {
          if (c.label.length > L.label) out.push(`${where}: the label 「${c.label}」 is longer than ${L.label}`)
          if ((c.hint ?? '').length > L.hint) out.push(`${where}: the hint of 「${c.label}」 is longer than ${L.hint}`)
        }
      }
      for (const o of outcomesOf(sp)) if (typeof o.text === 'string' && o.text.length > L.text) out.push(`${where}: a line is longer than ${L.text}: ${o.text}`)
      for (const t of e.texts) {
        if (!t.trim()) out.push(`${where}: an empty text`)
        else texts.push([where, t])
      }
    }
  }
  // near-repeats among the packs, and against the existing catalog
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const sim = similarity(texts[i][1], texts[j][1])
      if (sim >= NEAR_REPEAT) out.push(`${texts[i][0]} / ${texts[j][0]}: near-repeated text (${sim.toFixed(2)}): ${texts[i][1]} | ${texts[j][1]}`)
    }
    for (const t of existing) {
      const sim = similarity(texts[i][1], t)
      if (sim >= NEAR_REPEAT) out.push(`${texts[i][0]}: near-repeat of an existing text (${sim.toFixed(2)}): ${texts[i][1]} | ${t}`)
    }
  }
  // the catalog's own checks (two choices that differ only in wording, a question without a title, …); `career` marks the specs of a
  // pack allowed to move the calibrated career, as the catalog's rule asks
  const specs = packs.flatMap((p) => p.events.map((e) => ({ ...e.spec, ...(atLeast(p.impact, 'career') ? { career: true } : {}) })))
  out.push(...validateSpecs(specs, new Set([...known, ...ids])))
  return out
}
