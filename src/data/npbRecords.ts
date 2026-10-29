// Final standings of the 12 NPB clubs, 2023–2025 (日本野球機構 勝敗表, read 2026-10-18; source npbStandings):
// win-loss-draw per club and year. Draws do not count in the winning percentage as NPB writes it (勝 ÷ (勝+敗)).
// The strength of a club in the game is made from the average of the three seasons (route/rating.ts, a game assumption).

export interface NpbSeason {
  year: number
  w: number
  l: number
  d: number
}

export const NPB_STANDINGS: Record<string, NpbSeason[]> = {
  'npb-hanshin': [{ year: 2023, w: 85, l: 53, d: 5 }, { year: 2024, w: 74, l: 63, d: 6 }, { year: 2025, w: 85, l: 54, d: 4 }],
  'npb-dena': [{ year: 2023, w: 74, l: 66, d: 3 }, { year: 2024, w: 71, l: 69, d: 3 }, { year: 2025, w: 71, l: 66, d: 6 }],
  'npb-giants': [{ year: 2023, w: 71, l: 70, d: 2 }, { year: 2024, w: 77, l: 59, d: 7 }, { year: 2025, w: 70, l: 69, d: 4 }],
  'npb-dragons': [{ year: 2023, w: 56, l: 82, d: 5 }, { year: 2024, w: 60, l: 75, d: 8 }, { year: 2025, w: 63, l: 78, d: 2 }],
  'npb-carp': [{ year: 2023, w: 74, l: 65, d: 4 }, { year: 2024, w: 68, l: 70, d: 5 }, { year: 2025, w: 59, l: 79, d: 5 }],
  'npb-swallows': [{ year: 2023, w: 57, l: 83, d: 3 }, { year: 2024, w: 62, l: 77, d: 4 }, { year: 2025, w: 57, l: 79, d: 7 }],
  'npb-hawks': [{ year: 2023, w: 71, l: 69, d: 3 }, { year: 2024, w: 91, l: 49, d: 3 }, { year: 2025, w: 87, l: 52, d: 4 }],
  'npb-fighters': [{ year: 2023, w: 60, l: 82, d: 1 }, { year: 2024, w: 75, l: 60, d: 8 }, { year: 2025, w: 83, l: 57, d: 3 }],
  'npb-buffaloes': [{ year: 2023, w: 86, l: 53, d: 4 }, { year: 2024, w: 63, l: 77, d: 3 }, { year: 2025, w: 74, l: 66, d: 3 }],
  'npb-eagles': [{ year: 2023, w: 70, l: 71, d: 2 }, { year: 2024, w: 67, l: 72, d: 4 }, { year: 2025, w: 67, l: 74, d: 2 }],
  'npb-lions': [{ year: 2023, w: 65, l: 77, d: 1 }, { year: 2024, w: 49, l: 91, d: 3 }, { year: 2025, w: 63, l: 77, d: 3 }],
  'npb-marines': [{ year: 2023, w: 70, l: 68, d: 5 }, { year: 2024, w: 71, l: 66, d: 6 }, { year: 2025, w: 56, l: 84, d: 3 }],
}

/** wins ÷ (wins + losses), summed over the seasons */
export function npbWinPct(id: string): number | undefined {
  const s = NPB_STANDINGS[id]
  if (!s) return undefined
  const w = s.reduce((a, x) => a + x.w, 0)
  const l = s.reduce((a, x) => a + x.l, 0)
  return w / (w + l)
}
