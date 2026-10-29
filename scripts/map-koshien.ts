// Maps the school names of the 出場校一覧 (short names such as 「県岐阜商」「日大三」) to the schools of the national
// list (文部科学省 学校コード) by prefecture and name, and writes the appearances of each school
// (src/data/schools/koshien-schools.json). A name that does not match exactly one school is not mapped: it is
// listed in `unmatched` and counted, never guessed. PROJECT_PLAN §11.15.
// Run: node scripts/ingest-koshien.ts && node scripts/map-koshien.ts
import { readFileSync, writeFileSync } from 'node:fs'

const dir = new URL('../src/data/schools/', import.meta.url).pathname
const mext = JSON.parse(readFileSync(dir + 'mext.json', 'utf8')) as { hs: { c: string; n: string; p: string; b: number }[] }
const k = JSON.parse(readFileSync(dir + 'koshien.json', 'utf8')) as {
  meta: { accessed: string; sha256: string }
  rows: [string, number, string, string][]
  results: { kind: string; year: number; label: string; text: string }[]
  latest: { kind: string; year: number; region: string; school: string; nth: number }[]
}
const hs = mext.hs.filter((s) => s.b === 1)

const prefOf = (r: string) => (/^(北北海道|南北海道|北海道)$/.test(r) ? '北海道' : /^(東東京|西東京|東京)$/.test(r) ? '東京都' : r === '大阪' ? '大阪府' : r === '京都' ? '京都府' : r + '県')

/** short forms used in the lists → the words of the official names */
const EXPAND: [RegExp, string][] = [
  [/^駒大/, '駒澤大学'], [/^専大/, '専修大学'], [/日大/, '日本大学'], [/東海大/, '東海大学'], [/拓大/, '拓殖大学'], [/東農大/, '東京農業大学'],
  [/^国学院/, '國學院'], [/愛工大/, '愛知工業大学'], [/福井工大/, '福井工業大学'], [/岡山理大/, '岡山理科大学'], [/西日本短大/, '西日本短期大学'],
  [/滋賀短大/, '滋賀短期大学'], [/九産大/, '九州産業大学'], [/大産大/, '大阪産業大学'], [/創造学園大/, '創造学園大学'], [/京都外大/, '京都外大'],
  [/^県/, ''], [/^市/, ''],
]
const trailing: [RegExp, string][] = [[/商$/, '商業'], [/工$/, '工業'], [/農$/, '農業'], [/水$/, '水産']]

function norm(n: string, pref?: string, strip = false): string {
  let s = n.normalize('NFKC').replace(/^\([北南東西]\)/, '').replace(/高等学校|高校|高等部/g, '').replace(/（[^）]*）/g, '')
  // (a public school's name begins with its prefecture and 立: 「青森県立」; a private school may begin with a place name: 「青森山田」)
  if (pref) s = s.replace(pref === '北海道' ? /^北海道(立)?/ : new RegExp('^' + pref.replace(/[県府都]$/, '') + '[県府都](立)?'), '')
  s = s.replace(/^[^\s]{1,4}市立/, '').replace(/^[^\s]{1,4}町立/, '')
  s = s.replace(/付属|附属|付|附/g, '').replace(/大学/g, '大').replace(/日本/g, '日').replace(/短期大/g, '短大').replace(/[ケヶ]/g, 'ケ')
  s = s.replace(/辯/g, '弁').replace(/應/g, '応').replace(/學/g, '学').replace(/國/g, '国').replace(/櫻/g, '桜').replace(/崎/g, '崎').replace(/髙/g, '高')
  if (strip) s = s.replace(/学園/g, '')
  return s
}

/** manual readings of names the rules cannot reach (each checked against the school list by prefecture) */
const ALIAS: Record<string, string> = {
  '大阪|大阪桐蔭': '大阪桐蔭', '京都|京都外大西': '京都外大西', '大阪|PL学園': 'ＰＬ学園', '三重|三重': '三重', '沖縄|沖縄尚学': '沖縄尚学', '長崎|長崎日大': '長崎日本大学',
  '鹿児島|鹿児島実': '鹿児島実業', '高知|高知商': '高知商業', '島根|江の川': '石見智翠館', '兵庫|(東)報徳学園': '報徳学園', '千葉|市船橋': '船橋市立船橋',
  '岐阜|県岐阜商': '岐阜県立岐阜商業', '岐阜|市岐阜商': '岐阜市立岐阜商業', '和歌山|市和歌山': '市立和歌山', '和歌山|市和歌山商': '市立和歌山商業', '兵庫|市尼崎': '尼崎市立尼崎',
  '青森|光星学院': '八戸学院光星', '青森|聖愛': '弘前学院聖愛', '静岡|常葉菊川': '常葉大学菊川', '静岡|常葉橘': '常葉大学橘', '岡山|岡山理大付': '岡山理科大学附属',
  '福岡|西日本短大付': '西日本短期大学附属', '西東京|日大三': '日本大学第三', '千葉|(東)木更津総合': '木更津総合', '埼玉|(北)本庄一': '本庄第一', '東東京|関東一': '関東第一',
  '東京|関東一': '関東第一', '東京|日大三': '日本大学第三', '茨城|下妻二': '下妻第二', '栃木|文星芸大付': '文星芸術大学附属', '岩手|専大北上': '専修大学北上',
  '岩手|一関一': '一関第一', '長野|塚原青雲': '塚原青雲', '愛知|(東)大府': '大府', '愛知|(東)愛産大三河': '愛知産業大学三河', '福井|福井工大福井': '福井工業大学附属福井',
  '滋賀|滋賀学園': '滋賀学園', '鳥取|鳥取城北': '鳥取城北', '熊本|専大玉名': '専修大学玉名', '北北海道|クラーク国際': 'クラーク記念国際', '北海道|クラーク国際': 'クラーク記念国際',
  '南北海道|東海大四': '東海大学付属札幌', '北海道|東海大四': '東海大学付属札幌', '福岡|(北)折尾愛真': '折尾愛真', '熊本|東海大星翔': '東海大学付属熊本星翔', '宮崎|宮崎日大': '宮崎日本大学',
  '栃木|國學院栃木': '國學院大學栃木', '栃木|国学院栃木': '國學院大學栃木', '京都|京都国際': '京都国際', '愛媛|帝京五': '帝京第五', '高知|高知中央': '高知中央', '北北海道|旭川大': '旭川大学',
  '群馬|東農大二': '東京農業大学第二', '群馬|健大高崎': '健大高崎', '埼玉|(北)花咲徳栄': '花咲徳栄', '千葉|東海大望洋': '東海大学付属望洋', '千葉|専大松戸': '専修大学松戸',
  '京都|京都翔英': '京都翔英', '京都|京都成章': '京都成章', '大阪|大阪偕星学園': '大阪偕星学園', '岡山|岡山学芸館': '岡山学芸館', '福岡|九産大九州': '九州産業大学付属九州産業',
  '京都|京都外大西 ': '京都外大西', '千葉|拓大紅陵': '拓殖大学紅陵', '東京|日大三 ': '日本大学第三', '愛知|愛知啓成': '愛知啓成', '長野|創造学園大付': '創造学園', '大阪|大産大付': '大阪産業大学附属',
  '大阪|北陽': '北陽', '奈良|斑鳩': '斑鳩', '和歌山|県和歌山商': '和歌山県立和歌山商業', '福島|いわき海星': 'いわき海星', '福井|春江工': '春江工業', '岩手|不来方': '不来方',
  '長野|東海大三': '東海大学付属三', '茨城|石岡一': '石岡第一', '鹿児島|鹿児島城西': '鹿児島城西', '福島|学法石川': '学法石川', '滋賀|滋賀短大付': '滋賀短期大学附属',
  '富山|未来富山': '未来富山', '福島|東日大昌平': '東日本国際大学昌平', '秋田|明桜': '明桜', '大分|別府青山': '別府青山', '静岡|東海大翔洋': '東海大学付属静岡翔洋',
  '北海道|女満別': '女満別', '北海道|駒大苫小牧': '駒澤大学附属苫小牧', '南北海道|駒大苫小牧': '駒澤大学附属苫小牧', '北北海道|駒大岩見沢': '駒澤大学附属岩見沢', '北海道|駒大岩見沢': '駒澤大学附属岩見沢',
  '岐阜|県岐阜商': '岐阜商業', '岐阜|市岐阜商': '岐阜商業', '群馬|健大高崎': '高崎健康福祉大学高崎', '西東京|早稲田実': '早稲田実業学校', '東京|早稲田実': '早稲田実業学校',
  '広島|広島商': '広島商業', '広島|広島工': '広島工業', '福井|福井': '福井', '千葉|千葉経大付': '千葉経済大学附属', '秋田|明桜': '明桜', '秋田|能代商': '能代商業',
  '北海道|旭川大': '旭川大学', '北北海道|旭川大': '旭川大学', '北海道|旭川工': '旭川工業', '北北海道|旭川工': '旭川工業', '北北海道|旭川北': '旭川北', '徳島|鳴門工': '鳴門渦潮', '徳島|鳴門第一': '鳴門第一',
  '香川|香川西': '香川西', '長崎|佐世保実': '佐世保実業', '大分|別府青山': '別府青山', '福岡|福岡工大城東': '福岡工業大学附属城東', '兵庫|滝川二': '滝川第二', '埼玉|本庄一': '本庄第一',
  '山梨|山梨学院大付': '山梨学院', '茨城|土浦日大': '土浦日本大学', '千葉|東海大望洋': '東海大学付属望洋', '愛媛|小松': '小松', '三重|津商': '津商業', '和歌山|市和歌山': '市立和歌山',
  '兵庫|市尼崎': '尼崎市立尼崎', '岐阜|中京学院大中京': '中京', '新潟|新潟産大付': '新潟産業大学附属', '北海道|鵡川': '鵡川', '京都|平安': '龍谷大学付属平安', '京都|龍谷大平安': '龍谷大学付属平安',
  '大阪|北陽': '北陽', '奈良|斑鳩': '斑鳩', '愛媛|八幡浜': '八幡浜', '佐賀|伊万里商': '伊万里商業', '佐賀|伊万里農林': '伊万里農林', '北海道|女満別': '女満別', '北海道|遠軽': '遠軽',
  '福島|いわき海星': 'いわき海星', '福井|春江工': '春江工業', '静岡|静清工': '静清工業', '山口|下関工': '下関工科', '東京|国学院久我山': '國學院大學久我山', '西東京|国学院久我山': '國學院大學久我山',
  '北北海道|滝川西': '滝川西', '北北海道|帯広農': '帯広農業', '千葉|市船橋': '船橋市立船橋', '大阪|PL学園': 'PL学園', '北北海道|旭川実': '旭川実業', '北海道|旭川実': '旭川実業', '北海道|旭川南': '旭川南',
  '青森|八戸工大一': '八戸工業大学第一', '長野|長野日大': '長野日本大学', '長野|塚原青雲': '塚原青雲', '長野|創造学園大付': '創造学園',
  '神奈川|(北)慶応': '慶應義塾', '神奈川|慶応': '慶應義塾', '大阪|(北)大阪桐蔭': '大阪桐蔭',
}

const memo = new Map<string, string | undefined>()
function match(region: string, school: string): string | undefined {
  const key = region + '|' + school
  if (memo.has(key)) return memo.get(key)
  const pref = prefOf(region)
  const pool = hs.filter((s) => s.p === pref)
  const pick = (variants: string[]): string | undefined => {
    for (const strip of [false, true]) {
      const set = new Set(variants.map((v) => norm(v, pref, strip)))
      const hits = pool.filter((s) => set.has(norm(s.n, pref, strip)))
      if (hits.length === 1) return hits[0].c
      if (hits.length > 1) {
        // 「県岐阜商」 is the prefectural school, 「市岐阜商」 the city's
        const want = /^\(?[北南東西]?\)?県/.test(school) ? /[県府都道]立/ : /^市/.test(school) ? /市立/ : undefined
        const sub = want ? hits.filter((s) => want.test(s.n)) : []
        return sub.length === 1 ? sub[0].c : undefined
      }
    }
    return undefined
  }
  const clean = school.replace(/^\([北南東西]\)/, '')
  let id: string | undefined
  const alias = ALIAS[key]
  if (alias) id = pick([alias])
  if (!id) {
    let expanded = clean
    for (const [re, to] of EXPAND) expanded = expanded.replace(re, to)
    const variants = [clean, expanded]
    for (const v of [clean, expanded]) for (const [re, to] of trailing) if (re.test(v) && v.length >= 3) variants.push(v.replace(re, to))
    id = pick(variants)
  }
  memo.set(key, id)
  return id
}

interface Rec {
  summer: number[]
  spring: number[]
  /** the school's total number of appearances at the newest lists (2026 summer, 2026 spring) */
  summerNth?: number
  springNth?: number
  /** summer Koshien games won and lost since 2004 (Wikipedia 県勢 pages, secondary) */
  kw?: number
  kl?: number
  /** prefectural tournament, 2011–2025: titles and runner-up places (Wikipedia, secondary; not every prefecture could be read) */
  pfWon?: number
  pfSecond?: number
}
const by = new Map<string, Rec>()
const rec = (id: string) => by.get(id) ?? by.set(id, { summer: [], spring: [] }).get(id)!
const unmatched = new Map<string, number>()
let total = 0
let matched = 0
for (const [kind, year, region, school] of k.rows) {
  if (kind === 'spring' && year === 2020) continue
  total++
  const id = match(region, school)
  if (!id) {
    unmatched.set(region + '|' + school, (unmatched.get(region + '|' + school) ?? 0) + 1)
    continue
  }
  matched++
  const r = rec(id)
  const list = kind === 'summer' ? r.summer : r.spring
  if (!list.includes(year)) list.push(year)
}
for (const l of k.latest) {
  const id = match(l.region, l.school)
  if (!id) continue
  const r = rec(id)
  if (l.kind === 'summer' && l.year === 2026) r.summerNth = l.nth
  if (l.kind === 'spring' && l.year === 2026) r.springNth = l.nth
}
// ---- Wikipedia (secondary): the games at the summer Koshien since 2004, and the prefectural finals 2011–2025
const wiki = JSON.parse(readFileSync(dir + 'wiki-hs.json', 'utf8')) as {
  meta: { accessed: string; sha256: string }
  kosh: Record<string, Record<string, { w: number; l: number; years: number[] }>>
  finals: { region: string; year: number; champion: string; runnerUp: string }[]
}
let wikiNames = 0
let wikiMatched = 0
const wikiUnmatched = new Map<string, number>()
for (const [pref, schools] of Object.entries(wiki.kosh)) {
  for (const [name, g] of Object.entries(schools)) {
    wikiNames++
    const id = match(pref, name)
    if (!id) {
      wikiUnmatched.set(pref + '|' + name, g.w + g.l)
      continue
    }
    wikiMatched++
    const r = rec(id)
    r.kw = (r.kw ?? 0) + g.w
    r.kl = (r.kl ?? 0) + g.l
  }
}
const official = new Map<string, string | undefined>()
for (const [kind, year, region, school] of k.rows) if (kind === 'summer') official.set(`${region}|${year}`, match(region, school))
let fTotal = 0
let fMatched = 0
let fAgree = 0
let fCheck = 0
const fUn = new Map<string, number>()
for (const f of wiki.finals) {
  for (const [name, key] of [[f.champion, 'pfWon'], [f.runnerUp, 'pfSecond']] as const) {
    fTotal++
    const id = match(f.region, name)
    if (!id) {
      fUn.set(f.region + '|' + name, (fUn.get(f.region + '|' + name) ?? 0) + 1)
      continue
    }
    fMatched++
    const r = rec(id)
    r[key] = (r[key] ?? 0) + 1
    if (key === 'pfWon') {
      const off = official.get(`${f.region}|${f.year}`)
      if (off !== undefined) {
        fCheck++
        if (off === id) fAgree++
      }
    }
  }
}
console.log('wiki 県勢 names', wikiNames, 'matched', wikiMatched, '; finals names', fTotal, 'matched', fMatched, '; champions agreeing with the official 代表校:', fAgree, '/', fCheck)

const out = {
  meta: { accessed: k.meta.accessed, sha256: k.meta.sha256, rowsTotal: total, rowsMatched: matched, schools: by.size, unmatchedDistinct: unmatched.size, unmatchedRows: total - matched, wiki: { accessed: wiki.meta.accessed, sha256: wiki.meta.sha256, koshNames: wikiNames, koshMatched: wikiMatched, finalsNames: fTotal, finalsMatched: fMatched, finalsChampionsChecked: fCheck, finalsChampionsAgree: fAgree } },
  schools: Object.fromEntries([...by].sort(([a], [b]) => a.localeCompare(b)).map(([id, r]) => [id, { ...r, summer: r.summer.sort(), spring: r.spring.sort() }])),
  unmatched: Object.fromEntries([...unmatched].sort((a, b) => b[1] - a[1])),
}
writeFileSync(dir + 'koshien-schools.json', JSON.stringify(out))
console.log(out.meta)
console.log([...unmatched].slice(0, 60).map(([n, c]) => `${n}×${c}`).join(' , '))
