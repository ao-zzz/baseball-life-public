import { describe, expect, it } from 'vitest'
import { APP_VERSION, CHANGELOG } from './changelog.ts'

// The update history is kept by hand at each publication (changelog.ts): these checks catch an entry out of order, a number that skips
// or goes back, a date that is not a real day or not yet come, and a version on the screen that is not the newest entry's.

const parse = (v: string) => v.split('.').map(Number) as [number, number, number]
const cmp = (a: string, b: string) => {
  const [x, y] = [parse(a), parse(b)]
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]
}
/** today in Japan time (the dates are Japan's) */
const todayJp = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

describe('the version and the update history', () => {
  it('the version on the screen is the newest entry', () => {
    expect(CHANGELOG.length).toBeGreaterThan(0)
    expect(APP_VERSION).toBe(CHANGELOG[0].version)
  })

  it('each entry: a version a.b.c, a real day not yet to come, and at least one change written out', () => {
    for (const r of CHANGELOG) {
      expect(r.version, r.version).toMatch(/^\d+\.\d+\.\d+$/)
      expect(r.date, r.version).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(new Date(`${r.date}T00:00:00Z`).toISOString().slice(0, 10), r.version).toBe(r.date)
      expect(r.date <= todayJp(), `${r.version}: ${r.date} has not come yet`).toBe(true)
      expect(r.changes.length, r.version).toBeGreaterThan(0)
      for (const c of r.changes) expect(c.trim().length, r.version).toBeGreaterThan(0)
    }
  })

  it('newest first, each one step above the one before it (patch +1, or minor +1 with patch 0, or major +1), the first being 1.0.0', () => {
    expect(CHANGELOG[CHANGELOG.length - 1].version).toBe('1.0.0')
    for (let i = 0; i + 1 < CHANGELOG.length; i++) {
      const [newer, older] = [CHANGELOG[i], CHANGELOG[i + 1]]
      expect(cmp(newer.version, older.version), `${newer.version} after ${older.version}`).toBeGreaterThan(0)
      expect(newer.date >= older.date, `${newer.version}: ${newer.date} before ${older.date}`).toBe(true)
      const [a, b, c] = parse(newer.version)
      const [x, y, z] = parse(older.version)
      const step = (a === x && b === y && c === z + 1) || (a === x && b === y + 1 && c === 0) || (a === x + 1 && b === 0 && c === 0)
      expect(step, `${older.version} → ${newer.version}`).toBe(true)
    }
  })
})
