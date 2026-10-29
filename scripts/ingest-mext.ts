// Imports the school list of 文部科学省「学校コード」 (all prefectures) into src/data/schools/mext.json.
// Usage: node scripts/ingest-mext.ts <dir with the downloaded CSV files>
//   files (https://www.mext.go.jp/b_menu/toukei/mext_01087.html, 令和8年5月1日時点・暫定版):
//   20260825-mxt_chousa01-000011635_2-1.csv (幼稚園〜各種学校、東日本。高校 D1 を含む)
//   20260825-mxt_chousa01-000011635_2-2.csv, _4.csv (西日本), _6.csv (大学・短大・高専)
// Only names, kind, owner, branch and municipality are kept. Gender, department, baseball club and
// 偏差値 are not in this source: they are separate tables (PROJECT_PLAN §11.11).
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2]
if (!dir) throw new Error('usage: node scripts/ingest-mext.ts <dir>')
const FILES = ['20260825-mxt_chousa01-000011635_2-1.csv', '20260825-mxt_chousa01-000011635_2-2.csv', '20260825-mxt_chousa01-000011635_4.csv', '20260825-mxt_chousa01-000011635_6.csv']
const KINDS: Record<string, 'hs' | 'univ' | 'jc' | 'kosen'> = { D1: 'hs', F1: 'univ', F2: 'jc', G1: 'kosen' }

function splitCsv(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let q = false
  for (const ch of line) {
    if (ch === '"') q = !q
    else if (ch === ',' && !q) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}

// the 2026 files are UTF-8 with a BOM (older releases were Shift_JIS): fall back to it when UTF-8 fails
const utf8 = new TextDecoder('utf-8', { fatal: true })
const sjis = new TextDecoder('shift_jis')
const dec = { decode: (b: Uint8Array) => { try { return utf8.decode(b) } catch { return sjis.decode(b) } } }
const hash = createHash('sha256')
const rows: Record<string, { c: string; n: string; p: string; m: string; o: number; b: number }[]> = { hs: [], univ: [], jc: [], kosen: [] }
let updated = ''
const seen = new Set<string>()
for (const f of FILES) {
  const path = join(dir, f)
  if (!existsSync(path)) continue
  const buf = readFileSync(path)
  hash.update(buf)
  for (const line of dec.decode(buf).split(/\r?\n/)) {
    const u = /更新日：,?(\d{4}\/\d+\/\d+)/.exec(line)
    if (u) updated = u[1]
    const k = KINDS[line.slice(0, 2)]
    if (!k || !/^[A-Z]\d{12}/.test(line)) continue
    const f2 = splitCsv(line)
    const code = f2[0]
    if (seen.has(code)) continue
    seen.add(code)
    // 文部科学省 writes 「東京」「青森」; the game's prefecture names are 「東京都」「青森県」
    const short = /\((.+)\)/.exec(f2[2])?.[1] ?? ''
    const pref = short === '北海道' ? short : short === '東京' ? '東京都' : short === '大阪' || short === '京都' ? `${short}府` : `${short}県`
    const addr = f2[6].replace(/\s/g, '')
    const rest = addr.startsWith(pref) ? addr.slice(pref.length) : addr
    const muni = /^(.+?[市区町村])/.exec(rest)?.[1] ?? ''
    rows[k].push({ c: code, n: f2[5].replace(/\s/g, ''), p: pref, m: muni, o: Number(f2[3][0]), b: f2[4].startsWith('1') ? 1 : 2 })
  }
}
const out = {
  meta: {
    source: 'mextSchoolCode',
    files: FILES,
    listDate: updated,
    accessed: '2026-10-18',
    sha256: hash.digest('hex'),
    note: '学校コード一覧（令和8年5月1日時点・暫定版）。o: 1国立 2公立 3私立、b: 1本校 2分校',
  },
  hs: rows.hs,
  univ: rows.univ,
  jc: rows.jc,
  kosen: rows.kosen,
}
const target = new URL('../src/data/schools/mext.json', import.meta.url).pathname
writeFileSync(target, JSON.stringify(out))
console.log(`wrote ${target}: ${Object.entries(rows).map(([k, v]) => `${k} ${v.length}`).join(', ')}; list date ${updated}`)
