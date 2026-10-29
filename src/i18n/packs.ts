import { addCatalog, type Lang } from './index.ts'
import { addPlaceWords } from './places.ts'
import { addStatsWords } from './statsEn.ts'
import { addChanges } from './changelog.ts'

// The words of a language fetched only by its own page (the multilingual work, 1.5.0): the screens' texts, the data's names, the
// statistics and the update history of Korean and Traditional Chinese are chunks of their own, so the Japanese and English pages never
// download them. main.tsx waits for them (and for the game's own texts, game.ts loadGameTexts) before the first drawing. Japanese and
// English are part of the app itself.

const PACKS: Partial<Record<Lang, () => Promise<void>>> = {
  ko: async () => {
    const [ui, places, stats, changes] = await Promise.all([import('./ko.ts'), import('./placesKo.ts'), import('./statsKo.ts'), import('./changelogKo.ts')])
    addCatalog('ko', ui.KO)
    addPlaceWords('ko', places.PLACES_KO)
    addStatsWords('ko', stats.STATS_KO)
    addChanges('ko', changes.CHANGES_KO)
  },
  'zh-TW': async () => {
    const [ui, places, stats, changes] = await Promise.all([import('./zhTW.ts'), import('./placesZhTW.ts'), import('./statsZhTW.ts'), import('./changelogZhTW.ts')])
    addCatalog('zh-TW', ui.ZH_TW)
    addPlaceWords('zh-TW', places.PLACES_ZH_TW)
    addStatsWords('zh-TW', stats.STATS_ZH_TW)
    addChanges('zh-TW', changes.CHANGES_ZH_TW)
  },
}

const loaded = new Map<Lang, Promise<void>>()

/** fetches a language's words (nothing for Japanese and English, which are in the app); once per language */
export function loadLanguage(l: Lang): Promise<void> {
  const pack = PACKS[l]
  if (!pack) return Promise.resolve()
  if (!loaded.has(l)) loaded.set(l, pack())
  return loaded.get(l)!
}
