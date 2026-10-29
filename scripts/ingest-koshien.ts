// Imports the schools that played in the 全国高等学校野球選手権大会 (summer) and the 選抜高等学校野球大会 (spring)
// from the 出場校一覧 pages of 日本高等学校野球連盟 (https://www.jhbf.or.jp/sensyuken/outing/ and /senbatsu/outing/,
// groups of five tournaments each), 2004–2026 (summer) and 2004–2025 (spring). One request a second.
// Writes src/data/schools/koshien.json: rows of [kind, year, region, shortName] (PROJECT_PLAN §11.15).
// Run: node scripts/ingest-koshien.ts
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'

const hash = createHash('sha256')
const UA = 'baseball-life data check (public pages, one request a second)'
const clean = (s: string) =>
  s
    .replace(/<br\s*\/?>/gi, '|')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t\r\n\u3000]+/g, ' ')
    .trim()

type Row = [kind: 'summer' | 'spring', year: number, region: string, school: string]
const rows: Row[] = []
const results: { kind: string; year: number; label: string; text: string }[] = []

async function page(kind: 'summer' | 'spring', range: string) {
  const path = kind === 'summer' ? 'sensyuken' : 'senbatsu'
  const html = await (await fetch(`https://www.jhbf.or.jp/${path}/outing/${range}.html`, { headers: { 'User-Agent': UA } })).text()
  hash.update(html)
  const tab = html.match(/<table[\s\S]*?<\/table>/)?.[0] ?? ''
  // (the cell of a cancelled year spans all rows and writes its message one character a line: it is marked by its rowspan)
  const trs = [...tab.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => [...m[1].matchAll(/<t[hd]([^>]*)>([\s\S]*?)<\/t[hd]>/g)].map((c) => (Number(c[1].match(/rowspan="(\d+)"/)?.[1] ?? 0) >= 30 ? '中止' : clean(c[2]))))
  const years = trs[0].slice(1).map((c) => Number(c.match(/（(\d{4})）/)?.[1] ?? c.match(/\((\d{4})\)/)?.[1]))
  let gap = -1
  let n = 0
  for (const cells of trs.slice(2)) {
    const label = cells[0]
    let vals = cells.slice(1)
    if (gap < 0) gap = vals.findIndex((c) => c.includes('中止'))
    if (vals.length < years.length && gap >= 0) vals = [...vals.slice(0, gap), '', ...vals.slice(gap)]
    if (/決勝成績|準優勝校|優勝校|本塁打数|参加校数|全参加校数|代表校数/.test(label)) {
      if (/準優勝校|優勝校/.test(label)) vals.forEach((v, i) => v && years[i] && results.push({ kind, year: years[i], label, text: v }))
      continue
    }
    vals.forEach((v, i) => {
      if (!v || v.includes('中止') || !years[i]) return
      for (const s of v.split(/[|\s]+/).filter(Boolean)) {
        rows.push([kind, years[i], label, s])
        n++
      }
    })
  }
  console.log(kind, range, years.join(','), n)
}

for (const r of ['86-90', '91-95', '96-100', '101-105', '106-110']) {
  await page('summer', r)
  await new Promise((x) => setTimeout(x, 1000))
}
for (const r of ['76-80', '81-85', '86-90', '91-95', '96-100']) {
  await page('spring', r)
  await new Promise((x) => setTimeout(x, 1000))
}
// the newest tournaments are on the 代表校 pages only ("2年ぶり5回目": the school's total number of appearances)
const REGIONS = '北北海道|南北海道|東東京|西東京|北海道|青森|岩手|宮城|秋田|山形|福島|茨城|栃木|群馬|埼玉|千葉|東京|神奈川|新潟|富山|石川|福井|山梨|長野|岐阜|静岡|愛知|三重|滋賀|京都|大阪|兵庫|奈良|和歌山|鳥取|島根|岡山|広島|山口|徳島|香川|愛媛|高知|福岡|佐賀|長崎|熊本|大分|宮崎|鹿児島|沖縄'
const DIGITS = '０１２３４５６７８９'
const toInt = (s: string) => Number([...s].map((c) => (DIGITS.includes(c) ? DIGITS.indexOf(c) : c)).join('').replace(/\D/g, ''))
const latest: { kind: string; year: number; region: string; school: string; nth: number }[] = []
async function teamPage(kind: 'summer' | 'spring', year: number) {
  const path = kind === 'summer' ? 'sensyuken' : 'senbatsu'
  const html = await (await fetch(`https://www.jhbf.or.jp/${path}/${year}/team/`, { headers: { 'User-Agent': UA } })).text()
  hash.update(html)
  // (the spring page spaces the characters of short names out with full-width spaces: "北 照")
  let t = clean(html.replace(/\u3000/g, ''))
  const from = t.indexOf('出場回数')
  t = t.slice(from < 0 ? 0 : from, t.includes('補欠校') ? t.indexOf('補欠校') : t.indexOf('⇒') > 0 ? t.indexOf('⇒') : undefined)
  const regions = new Set(REGIONS.split('|'))
  const tok = t.split(' ')
  let n = 0
  for (let i = 0; i + 2 < tok.length; i++) {
    if (!regions.has(tok[i]) || !/回目|初出場/.test(tok[i + 2])) continue
    const ord = tok[i + 2]
    const nth = ord === '初出場' ? 1 : toInt(ord.match(/([0-9０-９]+)回目/)?.[1] ?? '0')
    latest.push({ kind, year, region: tok[i], school: tok[i + 1], nth })
    rows.push([kind, year, tok[i], tok[i + 1]])
    n++
  }
  console.log(kind, 'team page', year, n)
}
for (const [k, y] of [['summer', 2025], ['summer', 2026], ['spring', 2026]] as const) {
  await teamPage(k, y)
  await new Promise((x) => setTimeout(x, 1000))
}
writeFileSync(
  new URL('../src/data/schools/koshien.json', import.meta.url).pathname,
  JSON.stringify({ meta: { sources: ['jhbfSummerOuting', 'jhbfSpringOuting'], accessed: new Date().toISOString().slice(0, 10), sha256: hash.digest('hex'), note: '出場校一覧（地方大会・都道府県ごとの代表校の通称）と、2025・2026年の代表校のページ。選抜2020年は中止のため除く' }, rows, results, latest }),
)
console.log('rows', rows.length)
