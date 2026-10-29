// Imports the real company and club teams of 日本野球連盟（JABA）into src/data/teams-jaba.json from two official PDFs:
//   (1) 日本野球連盟連盟報2026 (2026年6月発行): p.367 「2025年度加盟チームの変更事項」（新規・活動再開・活動休止・
//       解散脱退・名称変更。種別と加盟地方団体と地区連盟つき）、p.386–389 「2026年度 JABA各地区連盟主催大会 出場チーム一覧」
//       （地区ごとの出場チーム名）
//   (2) 第51回社会人野球日本選手権大会 出場チーム一覧（2026.10.9現在）
// A team is taken when it appears in the 2026 tournament lists or the qualifiers; a team the 連盟報 lists as 活動休止 or
// 解散・脱退 is left out, and so is anything that is not a team name (調整中, selections, 「…出場チーム」). The type
// (会社／クラブ) and the prefecture are known only for the teams in the p.367 lists; the region (地区連盟) comes from the
// tournament lists. Nothing else is filled in.
// Usage: node scripts/ingest-jaba.ts <dir with renmeihou-2026.pdf and nihon-senshuken-2026.pdf>
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { TextItem } from 'pdfjs-dist/types/src/display/api.js'

const dir = process.argv[2]
if (!dir) throw new Error('usage: node scripts/ingest-jaba.ts <dir>')
const REGIONS = ['北海道', '東北', '北信越', '関東', '東海', '近畿', '中国', '四国', '九州'] as const
const hash = createHash('sha256')

async function pageText(file: string, pages: number[]): Promise<Map<number, string>> {
  const buf = readFileSync(file)
  hash.update(buf)
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true, disableFontFace: true, verbosity: 0 }).promise
  const out = new Map<number, string>()
  for (const p of pages) {
    const tc = await (await doc.getPage(p)).getTextContent()
    out.set(p, tc.items.filter((i): i is TextItem => 'str' in i).map((i) => i.str).join(' ').replace(/\p{Cc}/gu, ' ').replace(/\s+/g, ' '))
  }
  return out
}

/** NFKC, one space between ASCII words, none next to Japanese characters */
function norm(name: string): string {
  return name
    .normalize('NFKC')
    // (the text layer has control characters, e.g. BEL, where the PDF draws a space)
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/ (?=\P{ASCII})/gu, '')
    .replace(/(?<=\P{ASCII}) /gu, '')
}
// not a team name; or a member that is not a company or a club (専門学校・学園・自衛隊: left out because the game's
// 社会人野球 is work at a company or play in a club); or a page footer
const NOT_A_TEAM = /調整中|出場チーム|代表チーム|選抜$|^その他$|専門学校|学園|自衛隊|事業計画|カレッジ/

const renmei = await pageText(join(dir, 'renmeihou-2026.pdf'), [367, 386, 387, 388, 389])
const senshuken = await pageText(join(dir, 'nihon-senshuken-2026.pdf'), [1])

// ---- p.367: changes of the member teams (type, prefecture, region)
const p367 = renmei.get(367)!
if (!p367.includes('新規加盟チーム') || !p367.includes('活動休止')) throw new Error('p.367 is not the list of changes')
const section = (a: string, b: string) => p367.slice(p367.indexOf(a), b ? p367.indexOf(b) : undefined)
const ROW = /(\d{4}\/\d{1,2}\/\d{1,2}) (.+?) (会社|クラブ) (\S+?[都道府県]) (\S+?地区)/g
const rowsOf = (text: string) => [...text.matchAll(ROW)].map((m) => ({ name: norm(m[2]), kind: m[3] === '会社' ? 'company' : 'club', pref: m[4], region: m[5].replace('地区', '') }))
const added = rowsOf(section('〔１〕', '〔２〕'))
const resumed = rowsOf(section('〔２〕', '〔３〕'))
const paused = rowsOf(section('〔３〕', '〔４〕'))
const gone = rowsOf(section('〔４〕', '〔５〕'))
const inactive = new Set([...paused, ...gone].map((r) => r.name))

// ---- p.386–389: teams of the 2026 tournaments, by region
const teams = new Map<string, { name: string; region: string; kind: string; pref: string; src: number }>()
const put = (name: string, region: string, kind: string, pref: string, src: number) => {
  const n = norm(name)
  if (!n || NOT_A_TEAM.test(n) || inactive.has(n)) return
  const t = teams.get(n)
  if (t) {
    t.src |= src
    if (!t.region && region) t.region = region
    if (!t.kind && kind) t.kind = kind
    if (!t.pref && pref) t.pref = pref
  } else teams.set(n, { name: n, region, kind, pref, src })
}
const REG = REGIONS.join('|')
for (const p of [386, 387, 388, 389]) {
  const text = renmei.get(p)!
  // 「関東 8 茨城日産、…」 until the next region or the next tournament
  for (const m of text.matchAll(new RegExp(`(${REG}) (\\d+) ((?:(?!(?:${REG}|その他) \\d+ )(?!(?:わかさ生活)?第\\d+回)(?!JABA高山)(?!日本野球連盟連盟報).)+)`, 'g'))) {
    for (const name of m[3].split('、')) put(name, m[1], '', '', 1)
  }
}
// ---- the changes list: teams that are active and have a type
for (const r of [...added, ...resumed]) put(r.name, r.region, r.kind, r.pref, 4)
// ---- the 日本選手権 qualifiers (names only; the region comes from the lists above)
const sen = senshuken.get(1)!
if (!sen.includes('出場チーム一覧')) throw new Error('not the qualifiers list')
const senNames: string[] = []
{
  // the PDF's text layer: every team name sits between its row's qualifying path and 「…大会連続」/「初出場」
  const items = (await (await (await pdfjs.getDocument({ data: new Uint8Array(readFileSync(join(dir, 'nihon-senshuken-2026.pdf'))), useSystemFonts: true, verbosity: 0 }).promise).getPage(1)).getTextContent()).items.filter((i): i is TextItem => 'str' in i)
  for (const it of items) {
    const x = it.transform[4]
    const s = it.str.trim()
    if (x >= 195 && x < 345 && s && !/大会|地区|回数|チーム名|出場|現在|回目|初出場/.test(s)) senNames.push(s)
  }
}
for (const n of senNames) put(n, '', '', '', 2)

const rows = [...teams.values()].sort((a, b) => a.name.localeCompare(b.name, 'ja'))
const withRegion = rows.filter((r) => r.region)
const out = {
  meta: {
    sources: ['jabaRenmeiho2026', 'jabaSenshuken2026'],
    files: ['日本野球連盟連盟報2026（p.367, p.386–389）', '第51回社会人野球日本選手権大会 出場チーム一覧（2026.10.9現在）'],
    accessed: '2026-10-18',
    sha256: hash.digest('hex'),
    rule: '2026年度の大会（連盟報の地区連盟主催大会の出場チーム、日本選手権の出場チーム、2025年度に新規加盟・活動再開したチーム）に名前があるチーム。連盟報で活動休止・解散脱退とされたチームは除く。種別と加盟地方団体は、連盟報の変更事項の表にあるチームだけ。地区連盟は大会の出場チーム一覧による。bit: 1=連盟報の大会、2=日本選手権、4=連盟報の新規・活動再開',
    teams: rows.length,
    withRegion: withRegion.length,
    inactiveExcluded: [...inactive],
    byRegion: Object.fromEntries(REGIONS.map((r) => [r, withRegion.filter((t) => t.region === r).length])),
  },
  // [name, region, kind, prefecture, source bits]
  rows: rows.map((r) => [r.name, r.region, r.kind, r.pref, r.src]),
}
writeFileSync(new URL('../src/data/teams-jaba.json', import.meta.url).pathname, JSON.stringify(out))
console.log(`teams ${rows.length} (with region ${withRegion.length}); by region ${JSON.stringify(out.meta.byRegion)}`)
console.log(`from 日本選手権 ${senNames.length} names; excluded inactive: ${[...inactive].join(', ')}`)
console.log('without region:', rows.filter((r) => !r.region).map((r) => r.name).join(' / '))
console.log('sample:', rows.slice(0, 12).map((r) => `${r.name}(${r.region})`).join(' '))
