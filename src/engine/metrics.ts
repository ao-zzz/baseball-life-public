import type { LifeState, LogEntry } from './types.ts'

// Event metrics for one life (PROJECT_PLAN §11.2): used by scripts/eventstats.ts and by the tests that
// detect lives with too few events or unnatural repeats.

/** lines that are events (not everyday flavour or notes) */
export const SUBSTANTIVE = new Set(['good', 'bad', 'big', 'decision', 'milestone'])

export const BANDS: [string, number, number][] = [
  ['0-7', 0, 7],
  ['8-11', 8, 11],
  ['12-14', 12, 14],
  ['15-17', 15, 17],
  ['18-22', 18, 22],
  ['23-34', 23, 34],
  ['35-49', 35, 49],
  ['50-64', 50, 64],
  ['65-79', 65, 79],
  ['80+', 80, 200],
]

export interface LifeMetrics {
  age: number
  endedAge: number | null
  years: Record<string, number>
  entries: Record<string, number>
  substantive: Record<string, number>
  decisions: Record<string, number>
  decisionIds: string[]
  choices: number[]
  /** longest run of years after 18 (or after baseball, whichever is later) without a substantive line */
  maxGapAdult: number
  /** the most times one text appears in this life */
  maxRepeat: number
  maxRepeatText: string
  /** distinct catalog events and categories seen */
  eventIds: number
  categories: Record<string, number>
}

function bandOf(age: number): string {
  return BANDS.find(([, a, b]) => age >= a && age <= b)![0]
}

export function lifeMetrics(s: LifeState, decisions: { age: number; id: string; choices: number }[]): LifeMetrics {
  const years: Record<string, number> = {}
  const entries: Record<string, number> = {}
  const substantive: Record<string, number> = {}
  const dec: Record<string, number> = {}
  for (const [k] of BANDS) {
    years[k] = 0
    entries[k] = 0
    substantive[k] = 0
    dec[k] = 0
  }
  for (let a = 0; a <= s.age; a++) years[bandOf(a)]++
  const texts = new Map<string, number>()
  const ids = new Set<string>()
  const cats: Record<string, number> = {}
  for (const e of s.log as LogEntry[]) {
    const b = bandOf(e.age)
    entries[b]++
    if (SUBSTANTIVE.has(e.kind)) substantive[b]++
    texts.set(e.text, (texts.get(e.text) ?? 0) + 1)
    if (e.eventId) ids.add(e.eventId)
    if (e.category) cats[e.category] = (cats[e.category] ?? 0) + 1
  }
  for (const d of decisions) dec[bandOf(d.age)]++
  let maxRepeat = 0
  let maxRepeatText = ''
  for (const [t, n] of texts) if (n > maxRepeat) [maxRepeat, maxRepeatText] = [n, t]
  // gaps after 18
  const from = Math.max(18, (s.career.endedAge ?? 17) + 1)
  const eventful = new Set(s.log.filter((e) => SUBSTANTIVE.has(e.kind) && e.kind !== 'death' && e.age >= from).map((e) => e.age))
  for (const d of decisions) if (d.age >= from && d.id !== 'breath') eventful.add(d.age)
  let run = 0
  let maxGap = 0
  for (let a = from; a < s.age; a++) {
    if (eventful.has(a)) run = 0
    else maxGap = Math.max(maxGap, ++run)
  }
  return {
    age: s.age,
    endedAge: s.career.endedAge,
    years,
    entries,
    substantive,
    decisions: dec,
    decisionIds: decisions.map((d) => d.id),
    choices: decisions.map((d) => d.choices),
    maxGapAdult: maxGap,
    maxRepeat,
    maxRepeatText,
    eventIds: ids.size,
    categories: cats,
  }
}

export function quantile(xs: number[], p: number): number {
  if (xs.length === 0) return NaN
  const v = [...xs].sort((a, b) => a - b)
  return v[Math.floor(p * (v.length - 1))]
}

export function summarize(lives: LifeMetrics[]): string {
  const out: string[] = []
  const totalDec = lives.reduce((a, l) => a + l.decisionIds.length, 0)
  const real = lives.reduce((a, l) => a + l.decisionIds.filter((d) => d !== 'breath').length, 0)
  out.push(`lives ${lives.length}; decisions per life ${(totalDec / lives.length).toFixed(1)} (excluding 節目 ${(real / lives.length).toFixed(1)}); choices per decision median ${quantile(lives.flatMap((l) => l.choices), 0.5)}`)
  out.push('band   | person-years | lines/yr | events/yr | decisions/yr')
  for (const [k] of BANDS) {
    const y = lives.reduce((a, l) => a + l.years[k], 0)
    const e = lives.reduce((a, l) => a + l.entries[k], 0)
    const s = lives.reduce((a, l) => a + l.substantive[k], 0)
    const d = lives.reduce((a, l) => a + l.decisions[k], 0)
    out.push(`${k.padEnd(6)} | ${y} | ${(e / y).toFixed(2)} | ${(s / y).toFixed(2)} | ${(d / y).toFixed(3)}`)
  }
  const gaps = lives.map((l) => l.maxGapAdult)
  out.push(`longest gap after 18 without an event or decision: median ${quantile(gaps, 0.5)}, p90 ${quantile(gaps, 0.9)}, p99 ${quantile(gaps, 0.99)}, max ${Math.max(...gaps)}`)
  const rep = lives.map((l) => l.maxRepeat)
  out.push(`most repeats of one line in a life: median ${quantile(rep, 0.5)}, p99 ${quantile(rep, 0.99)}, max ${Math.max(...rep)}`)
  const worst = lives.reduce((a, l) => (l.maxRepeat > a.maxRepeat ? l : a), lives[0])
  out.push(`  worst: ${worst.maxRepeat}×「${worst.maxRepeatText}」`)
  out.push(`distinct catalog events per life: median ${quantile(lives.map((l) => l.eventIds), 0.5)}`)
  const cats: Record<string, number> = {}
  for (const l of lives) for (const [c, n] of Object.entries(l.categories)) cats[c] = (cats[c] ?? 0) + n
  out.push('categories per life: ' + Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${(n / lives.length).toFixed(2)}`).join(', '))
  const ids: Record<string, number> = {}
  for (const l of lives) for (const d of l.decisionIds) ids[d] = (ids[d] ?? 0) + 1
  out.push('decisions: ' + Object.entries(ids).sort((a, b) => b[1] - a[1]).map(([d, n]) => `${d} ${(n / lives.length).toFixed(2)}`).join(', '))
  return out.join('\n')
}
