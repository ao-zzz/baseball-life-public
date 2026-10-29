import type { LifeState } from './types.ts'

// Body growth (PROJECT_PLAN §11.2, stage 2). Average height and weight of Japanese boys by age, from
// 文部科学省「令和6年度学校保健統計」(stats: jpBoyHeight, jpBoyWeight; source mextHealth2024).
// Each player follows the average curve scaled to his own adult height (person.heightCm) and build.

/** age (April 1) → [height cm, weight kg], boys, 2024 school year */
export const MEXT_BOYS_2024: Record<number, [number, number]> = {
  5: [110.6, 19.0],
  6: [116.7, 21.4],
  7: [122.6, 24.2],
  8: [128.5, 27.6],
  9: [134.0, 31.2],
  10: [139.7, 35.2],
  11: [146.0, 39.6],
  12: [154.0, 45.3],
  13: [161.1, 50.5],
  14: [166.1, 55.0],
  15: [168.6, 59.0],
  16: [169.9, 60.5],
  17: [170.8, 62.2],
}

const ADULT_AVG_HEIGHT = MEXT_BOYS_2024[17][0]
const ADULT_AVG_WEIGHT = MEXT_BOYS_2024[17][1]

/** height (cm) at an age for this player */
export function heightAt(s: LifeState, age = s.age): number {
  const r = s.person.heightCm / ADULT_AVG_HEIGHT
  if (age >= 17) return s.person.heightCm
  if (age >= 5) return Math.round(MEXT_BOYS_2024[age][0] * r * 10) / 10
  // before 5: linear from about 50cm at birth (assumption) to the 5-year value
  const h5 = MEXT_BOYS_2024[5][0] * r
  return Math.round((50 + ((h5 - 50) * age) / 5) * 10) / 10
}

/** weight (kg): the average curve scaled by height² and the player's build; training adds muscle */
export function weightAt(s: LifeState, age = s.age): number {
  const r = s.person.heightCm / ADULT_AVG_HEIGHT
  const build = s.bb?.build ?? 1
  const extra = s.bb?.muscleKg ?? 0
  let base: number
  if (age >= 17) base = ADULT_AVG_WEIGHT
  else if (age >= 5) base = MEXT_BOYS_2024[age][1]
  else base = 3 + ((MEXT_BOYS_2024[5][1] - 3) * age) / 5
  // adults put on a little weight with age (assumption: +0.15kg a year from 25 to 55)
  const ageing = age > 25 ? Math.min(age, 55) - 25 : 0
  return Math.round((base * r * r * build + (age >= 15 ? extra : 0) + ageing * 0.15) * 10) / 10
}
