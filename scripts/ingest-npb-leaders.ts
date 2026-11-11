// Imports the league leaders' figures of NPB's 1軍, 2015–2025 without 2020 (the 120-game season; every other year has 143 games),
// from 日本野球機構's 「リーダーズ」 pages (https://npb.jp/bis/YYYY/stats/llb_c.html: batting, llp_c.html: pitching; _p for the
// Pacific League): the first-place value of 打率・本塁打・打点・盗塁・安打 and 勝利・防御率・奪三振. Only the values are kept (no
// player names). The personal titles of the game (engine/titles.ts) compare a season with these. One request a second.
// Writes src/data/npb-leaders.json. Run: node scripts/ingest-npb-leaders.ts
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'

const hash = createHash('sha256')
const UA = 'baseball-life data check (public pages, one request a second)'
const YEARS = [2015, 2016, 2017, 2018, 2019, 2021, 2022, 2023, 2024, 2025]
// each category is found by the link of its heading (lb_avg_c.html …), which both page layouts share
const PAGES = [
  { page: 'llb', keys: { lb_avg: 'avg', lb_hr: 'hr', lb_rbi: 'rbi', lb_sb: 'sb', lb_h: 'h' } },
  { page: 'llp', keys: { lp_w: 'w', lp_era: 'era', lp_so: 'k' } },
] as const

/**
 * the first-place value of each category: the first value after the heading's link, in the layout of 2016 on
 * (<tr class="ststats"><td>順位</td><td>選手</td><td>値</td>) or the older one (<td … class="ststats">値</td>)
 */
function leaders(html: string): Map<string, number> {
  const out = new Map<string, number>()
  const heads = [...html.matchAll(/href="(l[bp]_[a-z0-9]+)_[cp]\.html"/g)]
  for (let i = 0; i < heads.length; i++) {
    const key = heads[i][1]
    if (out.has(key)) continue
    const part = html.slice(heads[i].index, heads[i + 1]?.index ?? html.length)
    const v = part.match(/<td[^>]*class="ststats">\s*([^<\s][^<]*)<\/td>/) ??part.match(/<tr class="ststats">\s*<td>[^<]*<\/td>\s*<td>[^<]*<\/td>\s*<td>([^<]+)<\/td>/)
    if (v) out.set(key, Number(v[1].trim()))
  }
  return out
}

const rows: Record<string, number | string>[] = []
for (const year of YEARS) {
  for (const league of ['c', 'p']) {
    const row: Record<string, number | string> = { year, league: league.toUpperCase() }
    for (const p of PAGES) {
      const url = `https://npb.jp/bis/${year}/stats/${p.page}_${league}.html`
      const res = await fetch(url, { headers: { 'User-Agent': UA } })
      const html = await res.text()
      hash.update(html)
      const got = leaders(html)
      for (const [link, key] of Object.entries(p.keys)) {
        const v = got.get(link)
        if (v === undefined || Number.isNaN(v)) throw new Error(`${url}: no ${link}`)
        row[key] = v
      }
      console.log(year, league, p.page, res.status)
      await new Promise((r) => setTimeout(r, 1000))
    }
    rows.push(row)
  }
}
writeFileSync(
  new URL('../src/data/npb-leaders.json', import.meta.url).pathname,
  JSON.stringify({ meta: { source: 'npbLeaders', accessed: new Date().toISOString().slice(0, 10), sha256: hash.digest('hex'), years: YEARS }, rows }, null, 1) + '\n',
)
console.log('rows', rows.length)
