// Imports the affiliation of every player picked in the NPB draft (支配下・育成), 2021–2025, from the per-club pages of
// 日本野球機構 (https://draft.npb.jp/draft/YYYY/draftlist_X.html): round, name, position, and the school or team he
// came from. Only the affiliation is kept (no player names). One request a second.
// Writes src/data/draft-affiliations.json (PROJECT_PLAN §11.16). Run: node scripts/ingest-draft.ts
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'

const hash = createHash('sha256')
const UA = 'baseball-life data check (public pages, one request a second)'
const CLUBS = ['b', 'c', 'd', 'db', 'e', 'f', 'g', 'h', 'l', 'm', 's', 't']
const YEARS = [2021, 2022, 2023, 2024, 2025]
const rows: { year: number; club: string; round: string; affiliation: string }[] = []
for (const y of YEARS) {
  for (const c of CLUBS) {
    const res = await fetch(`https://draft.npb.jp/draft/${y}/draftlist_${c}.html`, { headers: { 'User-Agent': UA } })
    const html = await res.text()
    hash.update(html)
    let n = 0
    for (const m of html.matchAll(/<tr>\s*<th[^>]*>([^<]*)<\/th>\s*<td[^>]*class="name"[^>]*>[^<]*<\/td>\s*<td[^>]*>[^<]*<\/td>\s*<td[^>]*>([^<]*)<\/td>/g)) {
      rows.push({ year: y, club: c, round: m[1].trim(), affiliation: m[2].trim() })
      n++
    }
    console.log(y, c, res.status, n)
    await new Promise((r) => setTimeout(r, 1000))
  }
}
writeFileSync(new URL('../src/data/draft-affiliations.json', import.meta.url).pathname, JSON.stringify({ meta: { source: 'npbDraft', accessed: new Date().toISOString().slice(0, 10), sha256: hash.digest('hex'), years: YEARS }, rows }))
console.log('rows', rows.length)
