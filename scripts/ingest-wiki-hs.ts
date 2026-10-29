// High school baseball results from Wikipedia (a secondary source), through its public API, one request a second:
//  - 「全国高等学校野球選手権大会 (○○県勢)」: the games each prefecture's schools played at the summer Koshien, from which the
//    wins and losses since 2004 are counted per school;
//  - 「全国高等学校野球選手権○○大会」: the champion and runner-up of each prefectural tournament, 2011–2025.
// Names are taken from the links (the schools' own pages), so they are full names. Writes
// src/data/schools/wiki-hs.json; scripts/map-koshien.ts maps the names to the school list (PROJECT_PLAN §11.16).
// Run: node scripts/ingest-wiki-hs.ts
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const hash = createHash('sha256')
const UA = 'baseball-life data check (a local game project; public API, one request a second)'
const CACHE = '/tmp/wikihs-cache'
mkdirSync(CACHE, { recursive: true })
async function wikitext(title: string): Promise<string | undefined> {
  const file = `${CACHE}/${createHash('md5').update(title).digest('hex')}.txt`
  if (existsSync(file)) {
    const cached = readFileSync(file, 'utf8')
    hash.update(cached)
    return cached || undefined
  }
  const url = 'https://ja.wikipedia.org/w/api.php?' + new URLSearchParams({ action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', format: 'json', redirects: '1', titles: title })
  for (let attempt = 0; attempt < 5; attempt++) {
    await new Promise((r) => setTimeout(r, 2500 * (attempt + 1)))
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    const body = await res.text()
    if (!body.startsWith('{')) continue
    const j = JSON.parse(body) as { query?: { pages?: Record<string, { revisions?: { slots: { main: { '*': string } } }[] }> } }
    const p = Object.values(j.query?.pages ?? {})[0]
    const text = p?.revisions?.[0]?.slots.main['*']
    writeFileSync(file, text ?? '')
    if (text) hash.update(text)
    return text
  }
  return undefined
}

const PREFS = ['北海道', '青森', '岩手', '宮城', '秋田', '山形', '福島', '茨城', '栃木', '群馬', '埼玉', '千葉', '東京', '神奈川', '新潟', '富山', '石川', '福井', '山梨', '長野', '岐阜', '静岡', '愛知', '三重', '滋賀', '京都', '大阪', '兵庫', '奈良', '和歌山', '鳥取', '島根', '岡山', '広島', '山口', '徳島', '香川', '愛媛', '高知', '福岡', '佐賀', '長崎', '熊本', '大分', '宮崎', '鹿児島', '沖縄']
const SUFFIX = (p: string) => (p === '北海道' ? '北海道' : p === '東京' ? '東京都' : p === '大阪' ? '大阪府' : p === '京都' ? '京都府' : p + '県')
/** the school a cell names: the target of its first link (without 「 (県)」), else the text before 「（」 */
function schoolOf(cell: string): string | undefined {
  const m = cell.match(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/)
  if (m) return m[1].replace(/\s*\(.*\)$/, '').trim()
  const t = cell.replace(/rowspan="\d+"\s*\|/, '').replace(/colspan="\d+"\s*\|/, '').replace(/\{\{[^}]*\}\}/g, '').replace(/'''/g, '').split('（')[0].trim()
  return t || undefined
}

type Kosh = Record<string, Record<string, { w: number; l: number; years: number[] }>>
const kosh: Kosh = {}
for (const p of PREFS) {
  const text = await wikitext(`全国高等学校野球選手権大会 (${SUFFIX(p)}勢)`)
  if (!text) {
    console.log('missing 県勢', p)
    continue
  }
  const lines = text.split('\n')
  let cur: { year: number; school?: string } | undefined
  const bucket = (kosh[p] = {})
  for (const ln of lines) {
    // a row that opens a year: 「|rowspan="2"|[[第104回…|第104回大会]]（2022年）||rowspan="2"|八戸学院光星（…）||…」, or with 「{{By|2022年}}（…）」
    if (ln.startsWith('|') && !ln.startsWith('|-') && !ln.startsWith('|}')) {
      const cells = ln.slice(1).split('||')
      const first = cells[0]
      const ym = first.match(/(\d{4})年/)
      if (ym && /回大会|\{\{By/.test(first) && !/中止/.test(ln)) {
        cur = { year: Number(ym[1]), school: cells[1] ? schoolOf(cells[1]) : undefined }
        if (cur.year < 2004 || cur.year === 2020) cur = undefined
        if (cur?.school) (bucket[cur.school] ??= { w: 0, l: 0, years: [] }).years.push(cur.year)
      }
    }
    if (cur?.school) {
      if (/○/.test(ln)) bucket[cur.school].w++
      if (/●/.test(ln)) bucket[cur.school].l++
    }
  }
  console.log('県勢', p, Object.keys(bucket).length, 'schools')
}

type Final = { region: string; year: number; champion: string; runnerUp: string }
const finals: Final[] = []
const REGIONS: [string, string][] = [...PREFS.filter((p) => p !== '北海道' && p !== '東京' && p !== '大阪').map((p) => [p, p] as [string, string]), ['北北海道', '北北海道'], ['南北海道', '南北海道'], ['東東京', '東東京'], ['西東京', '西東京'], ['大阪', '大阪']]
for (const [region, name] of REGIONS) {
  const text = await wikitext(`全国高等学校野球選手権${name}大会`)
  if (!text) {
    console.log('missing 大会', region)
    continue
  }
  let n = 0
  for (const ln of text.split('\n')) {
    if (!ln.startsWith('|') || ln.startsWith('|-')) continue
    const cells = ln.slice(1).split('||')
    const ym = cells[0].match(/(\d{4})年/)
    if (!ym || /独自|中止/.test(cells[0]) || /中止/.test(ln)) continue
    const year = Number(ym[1])
    if (year < 2011 || year > 2025) continue
    // 年||参加校数||優勝||スコア||準優勝||備考
    if (!/^\d+校?$/.test((cells[1] ?? '').trim())) continue
    const champion = schoolOf(cells[2] ?? '')
    const runnerUp = schoolOf(cells[4] ?? '')
    if (champion && runnerUp) {
      finals.push({ region, year, champion, runnerUp })
      n++
    }
  }
  console.log('大会', region, n)
}
writeFileSync(new URL('../src/data/schools/wiki-hs.json', import.meta.url).pathname, JSON.stringify({ meta: { source: 'wikiHsResults', accessed: new Date().toISOString().slice(0, 10), sha256: hash.digest('hex') }, kosh, finals }))
console.log('finals', finals.length)
