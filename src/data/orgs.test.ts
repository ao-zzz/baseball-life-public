import { describe, expect, it } from 'vitest'
import { ORGS, ORG_NAME_NOTE, orgLabel } from './orgs.ts'
import { SOURCES } from './sources.ts'
import { createLife, playToEnd, type Sim } from '../engine/life.ts'
import type { LifeState } from '../engine/types.ts'
import { defaultParams } from '../engine/params.ts'
import { hashSeed } from '../engine/rng.ts'

// Real names (PROJECT_PLAN §2.1-7, §6.5): a name is shown only when it is registered as verified with a
// source and a check date; future years carry the "October 2026 names" note.

describe('registered real organisations', () => {
  it.each(ORGS.map((o) => [o.id, o] as const))('%s', (_, o) => {
    expect(o.generic.trim()).not.toBe('')
    if (o.realName || o.league) {
      expect(o.verified).toBe(true)
      expect(o.accessed).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(o.sourceIds.length).toBeGreaterThan(0)
      for (const sid of o.sourceIds) expect(SOURCES[sid]?.accessed, sid).toBeTruthy()
    }
    // an unverified organisation never shows its real name
    if (!o.verified) expect(orgLabel(o)).toBe(o.generic)
  })

  it('tournament names come from the federation page', () => {
    for (const o of ORGS.filter((x) => x.type === 'tournament')) expect(o.sourceIds).toContain('jhbfTop')
  })

  it('has the twelve NPB teams', () => {
    expect(ORGS.filter((o) => o.type === 'pro' && o.realName)).toHaveLength(12)
  })
})

describe('real names in lives', () => {
  const sim: Sim = { params: defaultParams() }
  const realNames = ORGS.flatMap((o) => [o.realName, o.league]).filter((x): x is string => !!x)
  const npbLike = /(タイガース|ベイスターズ|ジャイアンツ|ドラゴンズ|カープ|スワローズ|ホークス|ファイターズ|バファローズ|イーグルス|ライオンズ|マリーンズ|インディゴソックス|ガイナーズ|パイレーツ|ドッグス)/
  // lives played with the log kept (「結果だけ」 path)
  const lives: LifeState[] = []
  for (let i = 0; i < 4000; i++) {
    const s = createLife({ seed: hashSeed(i + 777_000), country: 'JP', pace: 'p15' })
    playToEnd(s, sim)
    lives.push(s)
  }

  it('only registered names appear, always after the note on the October 2026 names', () => {
    let withName = 0
    for (const s of lives) {
      const text = s.log.map((e) => e.text).join('\n')
      const used = realNames.filter((n) => text.includes(n))
      if (used.length === 0) {
        expect(text).not.toMatch(npbLike)
        continue
      }
      withName++
      const note = text.indexOf(ORG_NAME_NOTE)
      expect(note, `seed ${s.config.seed}`).toBeGreaterThanOrEqual(0)
      expect(note).toBeLessThan(Math.min(...used.map((n) => text.indexOf(n))))
    }
    expect(withName).toBeGreaterThan(0)
  })

  it('team names never appear in a bad event', () => {
    const teamNames = ORGS.filter((o) => o.type !== 'tournament').flatMap((o) => [o.realName, o.league]).filter((x): x is string => !!x)
    // collected first and asserted once: one `expect` per line and name is too slow for 4,000 full lives
    const offending: string[] = []
    for (const s of lives) for (const e of s.log) if (e.kind === 'bad' && teamNames.some((n) => e.text.includes(n))) offending.push(`seed ${s.config.seed}: ${e.text}`)
    expect(offending).toEqual([])
  })
})
