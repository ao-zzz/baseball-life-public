// The game's own Japanese texts, for their translation (the multilingual work): every string and template literal with Japanese in
// the game's code (src/engine, not the tests) and in the data files that hold words shown on screen. A template's `${…}` parts become
// {0}, {1}… (the code of each part is kept, to help the translator). Each text has an id: the first 10 hex of the sha1 of its Japanese,
// the same in every language's file (src/i18n/game/<lang>.json maps id → text). The data files and the engine are only read.
// Run: node scripts/i18n-extract.ts            writes src/i18n/game/source.json and prints the counts
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { PLACE_EN } from '../src/i18n/places.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const JAPANESE = /[ぁ-んァ-ヶ一-龠々〆〇ー]/
// data files already translated elsewhere (src/i18n/statsEn.ts, places.ts, the screens' catalogs) or not shown as words
const SKIP_DATA = new Set(['stats.ts', 'sources.ts', 'changelog.ts', 'site.ts', 'potentialStars.ts', 'types.ts'])

export interface SourceText {
  /** the id: sha1 of `ja`, 10 hex */
  id: string
  /** the Japanese text; a template's parts as {0}, {1}… */
  ja: string
  /** the code of each part of a template */
  parts?: string[]
  /** where it is (the first place met) and how many places */
  at: string
  n: number
}

const files: string[] = []
const walk = (dir: string, keep: (f: string) => boolean) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, keep)
    else if (keep(p)) files.push(p)
  }
}
walk(join(ROOT, 'src/engine'), (f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
walk(join(ROOT, 'src/data'), (f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && !SKIP_DATA.has(f.split(/[\\/]/).pop()!))

const found = new Map<string, SourceText>()
const add = (ja: string, file: string, line: number, parts?: string[]) => {
  if (!JAPANESE.test(ja) || PLACE_EN[ja] !== undefined) return
  const id = createHash('sha1').update(ja).digest('hex').slice(0, 10)
  const at = `${relative(ROOT, file).replace(/\\/g, '/')}:${line}`
  const x = found.get(id)
  if (x) x.n++
  else found.set(id, { id, ja, ...(parts?.length ? { parts } : {}), at, n: 1 })
}

for (const file of files) {
  const text = readFileSync(file, 'utf8')
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS)
  const line = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
  const visit = (n: ts.Node) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) add(n.text, file, line(n))
    else if (ts.isTemplateExpression(n)) {
      let ja = n.head.text
      const parts: string[] = []
      n.templateSpans.forEach((s, i) => {
        ja += `{${i}}${s.literal.text}`
        parts.push(s.expression.getText(sf))
      })
      add(ja, file, line(n), parts)
    }
    // (an import's path or a type's string is not a text: skipped)
    if (ts.isImportDeclaration(n) || ts.isLiteralTypeNode(n)) return
    ts.forEachChild(n, visit)
  }
  visit(sf)
}

// names kept in JSON data and shown on screen: the company teams (teams-jaba.json rows) and the university leagues (jubf-leagues.json);
// the schools' names are not here (src/i18n/game.ts shows them by a rule: their kind and place)
const json = (p: string) => JSON.parse(readFileSync(join(ROOT, p), 'utf8')) as Record<string, unknown>
// (a row: [name, region, kind, prefecture group, flag]; the name and the region words are shown)
for (const r of json('src/data/teams-jaba.json').rows as unknown[][]) for (const v of r.slice(0, 4)) if (typeof v === 'string') add(v, join(ROOT, 'src/data/teams-jaba.json'), 1)
for (const l of json('src/data/schools/jubf-leagues.json').leagues as Record<string, unknown>[]) if (typeof l.name === 'string') add(l.name, join(ROOT, 'src/data/schools/jubf-leagues.json'), 1)

const list = [...found.values()].sort((a, b) => a.at.localeCompare(b.at, 'en') || a.id.localeCompare(b.id))
mkdirSync(join(ROOT, 'src/i18n/game'), { recursive: true })
writeFileSync(join(ROOT, 'src/i18n/game/source.json'), JSON.stringify(list, null, 0).replace(/\},\{/g, '},\n{') + '\n')
const templates = list.filter((x) => x.parts).length
const chars = list.reduce((a, x) => a + x.ja.length, 0)
console.log(`${files.length} files; ${list.length} texts (${templates} templates), ${chars.toLocaleString()} characters`)
const byDir = new Map<string, number>()
for (const x of list) byDir.set(x.at.split('/').slice(0, 3).join('/'), (byDir.get(x.at.split('/').slice(0, 3).join('/')) ?? 0) + 1)
console.log([...byDir].sort((a, b) => b[1] - a[1]).map(([d, n]) => `${d} ${n}`).join('\n'))
