// Imports the 27 member leagues of 全日本大学野球連盟 and their member universities from the federation's own
// pages (https://www.jubf.net/system/prog/league_info.php?leagueid=01…27): league name, website, number of
// member universities and their names. One request per league, a second apart; the site's robots.txt does not
// exist and the pages are public. Writes src/data/schools/jubf-leagues.json (PROJECT_PLAN §11.15).
// Run: node scripts/ingest-jubf.ts
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'

const BASE = 'https://www.jubf.net/system/prog/league_info.php?leagueid='
const out: { leagueId: string; name: string; site: string; count: number; members: string[] }[] = []
const hash = createHash('sha256')
const text = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

for (let i = 1; i <= 27; i++) {
  const id = String(i).padStart(2, '0')
  const res = await fetch(BASE + id, { headers: { 'User-Agent': 'baseball-life data check (public pages, one request a second)' } })
  const html = await res.text()
  hash.update(html)
  const t = text(html)
  const name = (html.match(/<title>([^<]*)<\/title>/)?.[1] ?? t.split(' ')[0]).trim()
  const site = t.match(/ウェブサイト\s+(\S+)/)?.[1] ?? ''
  const m = t.match(/加盟大学\((\d+)校\)\s+([\s\S]*?)\s+お問い合わせ/)
  const count = m ? Number(m[1]) : 0
  const members = m ? m[2].split(' ').filter(Boolean) : []
  out.push({ leagueId: id, name, site, count, members })
  console.log(id, name, site, count, members.length)
  await new Promise((r) => setTimeout(r, 1000))
}
writeFileSync(
  new URL('../src/data/schools/jubf-leagues.json', import.meta.url).pathname,
  JSON.stringify({ meta: { source: 'jubfLeagues', url: 'https://www.jubf.net/list/index.html', accessed: new Date().toISOString().slice(0, 10), sha256: hash.digest('hex'), note: '各連盟のページ（league_info.php）の「加盟大学」欄。部（1部・2部）の区別は載っていない' }, leagues: out }, null, 1),
)
