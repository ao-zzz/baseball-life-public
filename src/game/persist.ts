import type { LifeState, Mode, Pace } from '../engine/types.ts'
import type { CountryCode } from '../data/types.ts'

// localStorage helpers. Every access is wrapped: storage may be unavailable (private mode, blocked).

const SAVE = 'bl12.save.v1'
const PAST = 'bl12.past.v1'
const SETTINGS = 'bl12.settings.v1'

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full or unavailable: the game keeps working without saving */
  }
}

export function saveLife(s: LifeState): void {
  write(SAVE, s)
}

export function loadLife(): LifeState | null {
  const s = read<LifeState>(SAVE)
  return s && s.v === 1 && s.alive ? s : null
}

export function clearLife(): void {
  try {
    localStorage.removeItem(SAVE)
    localStorage.removeItem(PLAN)
  } catch {
    /* ignore */
  }
}

/**
 * The year in progress (PROJECT_PLAN §11.61). `planYear` applies the whole year to the state at once and the screen reveals it line by
 * line, so a life saved in the middle of a year is already past that year's events: resuming it must go on with the same plan (the
 * lines not yet shown, the decision waiting), never plan the year again (that ran the year twice) nor start from the year's
 * beginning (that lost what was played). The plan belongs to one life and one year: `seed` and `age` must match the saved life.
 */
const PLAN = 'bl12.plan.v1'
export interface SavedPlan<P> {
  seed: number
  age: number
  plan: P
}

export function savePlan<P>(s: LifeState, plan: P): void {
  write(PLAN, { seed: s.config.seed, age: s.age, plan } satisfies SavedPlan<P>)
}

/** the plan of this life's current year, or null (none saved, or saved for another life or another year) */
export function loadPlan<P>(s: LifeState): P | null {
  const p = read<SavedPlan<P>>(PLAN)
  return p && p.seed === s.config.seed && p.age === s.age && p.plan ? p.plan : null
}

export function clearPlan(): void {
  try {
    localStorage.removeItem(PLAN)
  } catch {
    /* ignore */
  }
}

export interface PastLife {
  name: string
  prefecture: string
  birthYear: number
  age: number
  title: string
  highest: string
  rank: number
  seed: number
}

export function loadPast(): PastLife[] {
  return read<PastLife[]>(PAST) ?? []
}

export function addPast(p: PastLife): PastLife[] {
  const list = [p, ...loadPast().filter((x) => x.seed !== p.seed)].slice(0, 30)
  write(PAST, list)
  return list
}

export interface Settings {
  pace: Pace
  /** the country of birth (absent in settings saved before the other countries: Japan; PROJECT_PLAN §11.31) */
  country?: CountryCode
  /** the place of birth in that country's table (a prefecture, a state), or -1 for a draw */
  prefecture: number | -1
  theme: 'auto' | 'light' | 'dark'
  /** the normal mode, or the potential mode (PROJECT_PLAN §11.20) */
  mode: Mode
  /** the ★ chosen for the potential mode, 1..10 (PROJECT_PLAN §11.21) */
  stars: number
}

export function loadSettings(): Settings {
  // light and 30 minutes are the first-visit defaults; a saved choice (pace, light, dark or auto) is kept as it is
  return { pace: 'p30', prefecture: -1, theme: 'light', mode: 'normal', stars: 1, ...(read<Partial<Settings>>(SETTINGS) ?? {}) }
}

export function saveSettings(s: Settings): void {
  write(SETTINGS, s)
}

export function saveMemoKey(): string {
  return 'bl12.memos.v1'
}
