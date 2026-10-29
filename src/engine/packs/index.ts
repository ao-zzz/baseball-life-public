import type { CountryCode } from '../../data/types.ts'
import type { EventCtx } from '../events.ts'
import { compilePack, type Pack, type PackEntry } from './kit.ts'
import { runPacks } from './pass.ts'
import { US_TOWN } from './us/town.ts'
import { KR_TOWN } from './kr/town.ts'
import { CU_TOWN } from './cu/town.ts'

// The list of the event packs (packs/kit.ts) and the countries that meet them.
//
// To add a pack (after its approval):
//   1. write it in a file of its own under src/engine/packs/<country or subject>/, with definePack and the kit's builders;
//   2. import it here and add it to PACKS (one line), and switch its countries on in PACK_COUNTRIES;
//   3. run the packs' tests (npx vitest run src/engine/packs): the checks of packs/validate.ts, the separation from the existing
//      draws, and how often each event is met; a pack of `career` or `health` needs the calibration checks and the fingerprint too.
// Each pack is approved before it comes in (2026-10-21: the first three, five events each, lines and flags only).

export const PACKS: Pack[] = [US_TOWN, KR_TOWN, CU_TOWN]

/** the countries whose lives meet the packs: each is switched on when its first pack is approved (Japan's stays off) */
export const PACK_COUNTRIES: Readonly<Record<CountryCode, boolean>> = { JP: false, US: true, KR: true, TW: false, DO: false, CU: true, VE: false, MX: false }

export const PACK_ENTRIES: PackEntry[] = PACKS.flatMap(compilePack)
/** the packs' events for the catalog (life.ts EVENTS): registered so that their questions can be answered and their ids are known */
export const PACK_EVENTS = PACK_ENTRIES.map((e) => e.def)

/** the salt of the packs' random stream (events.ts eventRng): used by no other draw */
export const PACK_SALT = 0x9ac4

let active: { entries: readonly PackEntry[]; countries: Readonly<Record<CountryCode, boolean>> } = { entries: PACK_ENTRIES, countries: PACK_COUNTRIES }

/** tests only: the pass runs with these entries and switches (their events registered by the test); no argument puts the list back */
export function setPacksForTests(x?: { entries: readonly PackEntry[]; countries: Readonly<Record<CountryCode, boolean>> }): void {
  active = x ?? { entries: PACK_ENTRIES, countries: PACK_COUNTRIES }
}

/** the packs' pass of a year (packs/pass.ts) */
export function runPackPass(c: EventCtx): string[] {
  return runPacks(active.entries, active.countries, c)
}
