import { STATS } from '../data/stats.ts'
import { SOURCES } from '../data/sources.ts'
import { CALIBRATION } from '../data/calibration.ts'
import { CHECKS } from '../engine/params.ts'
import { KindBadge } from './common.tsx'
import { pctText } from './format.ts'
import type { Stat } from '../data/types.ts'
import { AMATEUR_META, AMATEUR_OFFICIAL_2025, AMATEUR_TEAMS, type JabaRegion } from '../data/teams.ts'
import { JUBF_META, UNIV_LEAGUES } from '../data/schools/leagues.ts'
import { INDEP_LEAGUE_LEVELS } from '../engine/route/rating.ts'
import { DRAFT_META, DRAFT_PICKS_TOTAL } from '../data/draftRecords.ts'
import { KOSHIEN_META, KOSHIEN_SCHOOL_COUNT, LEAGUE_SCHOOL_IDS, UNMAPPED_LEAGUE_MEMBERS } from '../data/schools/index.ts'
import { NPB_STANDINGS } from '../data/npbRecords.ts'
import { US_COLLEGES } from '../data/usColleges.ts'
import { ORGS } from '../data/orgs.ts'
import { SCHOOL_LIST_META, UNIVERSITIES, coverage, schoolById } from '../data/schools/index.ts'
import { DEVIATIONS, DEVIATION_HS_META, DEVIATION_UNIV_J_META, DEVIATION_UNIV_META } from '../data/schools/deviation.ts'
import { listSep, t, type Key } from '../i18n/index.ts'
import { examText, nameText, sourceText, statText } from '../i18n/statsEn.ts'

// (the texts of this page are in src/i18n; the statistics and the sources are data, shown through src/i18n/statsEn.ts)

const MAJOR_UNIVERSITIES = ['東京大学', '京都大学', '大阪大学', '東北大学', '名古屋大学', '九州大学', '北海道大学', '一橋大学', '東京科学大学', '早稲田大学', '慶應義塾大学', '上智大学', '明治大学', '青山学院大学', '立教大学', '中央大学', '法政大学', '関西大学', '関西学院大学', '同志社大学', '立命館大学']

const CHECK_LABEL: Record<string, Key> = {
  'jp.jhs': 'stats.check.jp.jhs',
  'jp.hs': 'stats.check.jp.hs',
  'jp.hsStay': 'stats.check.jp.hsStay',
  'jp.koshien': 'stats.check.jp.koshien',
  'jp.hsFile': 'stats.check.jp.hsFile',
  'jp.hsDraft': 'stats.check.jp.hsDraft',
  'jp.shihaikaHs': 'stats.check.jp.shihaikaHs',
  'jp.shihaikaUniv': 'stats.check.jp.shihaikaUniv',
  'jp.shihaikaCompany': 'stats.check.jp.shihaikaCompany',
  'jp.shihaikaIndep': 'stats.check.jp.shihaikaIndep',
  'jp.hsUniv': 'stats.check.jp.hsUniv',
  'jp.hsCompany': 'stats.check.jp.hsCompany',
  'jp.hsIndep': 'stats.check.jp.hsIndep',
  'jp.univStay': 'stats.check.jp.univStay',
  'jp.univFile': 'stats.check.jp.univFile',
  'jp.univDraft': 'stats.check.jp.univDraft',
  'jp.univCompany': 'stats.check.jp.univCompany',
  'jp.univIndep': 'stats.check.jp.univIndep',
  'jp.companyDraft': 'stats.check.jp.companyDraft',
  'jp.indepDraft': 'stats.check.jp.indepDraft',
  'jp.amateurExit': 'stats.check.jp.amateurExit',
  'jp.ikuseiPromote': 'stats.check.jp.ikuseiPromote',
  'jp.ikuseiExit': 'stats.check.jp.ikuseiExit',
  'jp.ichigun': 'stats.check.jp.ichigun',
  'jp.npbExit': 'stats.check.jp.npbExit',
  'jp.mlb': 'stats.check.jp.mlb',
}

const SEX_LABEL: Record<Stat['sex'], Key> = {
  male: 'stats.sex.male',
  all: 'stats.sex.all',
  unstated: 'stats.sex.unstated',
  unknown: 'stats.sex.unknown',
}

const DOMAIN_LABEL: Record<Stat['domain'], Key> = { population: 'stats.domain.population', model: 'stats.domain.model', baseball: 'stats.domain.baseball' }

function checkedOn(ids: string[]): string {
  if (ids.length === 0) return t('stats.checked.none')
  const dates = ids.map((id) => SOURCES[id]?.accessed)
  if (dates.some((d) => !d)) return t('stats.checked.some')
  return [...new Set(dates)].join(listSep())
}

const share = (n: number, total: number) => (total ? `${Math.round((n / total) * 1000) / 10}%` : '—')

/** how much of the school data exists, from which source and year, and what is only a game assumption */
function SchoolCoverage() {
  const hs = coverage('hs')
  const uni = coverage('univ')
  const bySource = (id: string) => DEVIATIONS.filter((d) => d.sourceId === id).length
  const keiN = bySource(DEVIATION_UNIV_META.source)
  const jukeUnivN = bySource(DEVIATION_UNIV_J_META.source)
  const univDev = keiN + jukeUnivN
  const hsDev = bySource(DEVIATION_HS_META.source)
  const floorRows = DEVIATIONS.filter((d) => d.floor && schoolById(d.schoolId)?.kind === 'univ').length
  const mext = SOURCES[SCHOOL_LIST_META.source]
  const kei = SOURCES[DEVIATION_UNIV_META.source]
  const juke = SOURCES[DEVIATION_HS_META.source]
  const jukeU = SOURCES[DEVIATION_UNIV_J_META.source]
  const pub = (id: string) => sourceText(SOURCES[id]).publisher
  const major = MAJOR_UNIVERSITIES.map((n) => {
    const u = UNIVERSITIES.find((x) => x.name === n)
    const d = u && DEVIATIONS.find((r) => r.schoolId === u.id)
    return { n, d }
  })
  const row = (key: string, label: string, value: string, note: string, kind: 'fact' | 'assumed' | 'none') => (
    <tr key={key}>
      <td>{label}</td>
      <td className="num">{value}</td>
      <td>
        <span className={`badge ${kind === 'fact' ? '' : 'recheck'}`}>{kind === 'fact' ? t('stats.badge.fact') : kind === 'assumed' ? t('stats.badge.assumed') : t('stats.badge.none')}</span>
      </td>
      <td className="small muted">{note}</td>
    </tr>
  )
  const univClub = coverage('univ').clubHard
  return (
    <>
      <h2 style={{ marginTop: 28 }}>{t('stats.school.title')}</h2>
      <p className="small muted">{t('stats.school.lede')}</p>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>{t('stats.school.th.data')}</th>
              <th>{t('stats.school.th.count')}</th>
              <th>{t('stats.school.th.kind')}</th>
              <th>{t('stats.school.th.note')}</th>
            </tr>
          </thead>
          <tbody>
            {row('hs', t('stats.row.hs'), t('stats.row.hs.value', { total: hs.total.toLocaleString(), main: hs.main.toLocaleString() }), t('stats.row.hs.note', { publisher: sourceText(mext).publisher, listDate: SCHOOL_LIST_META.listDate, accessed: mext.accessed ?? '' }), 'fact')}
            {row('univ', t('stats.row.univ'), t('stats.row.univ.value', { total: uni.total.toLocaleString(), jc: coverage('jc').total, kosen: coverage('kosen').total }), t('stats.row.univ.note'), 'fact')}
            {row('girls', t('stats.row.girls'), t('stats.row.girls.value', { hs: hs.girlsByName, univ: uni.girlsByName }), t('stats.row.girls.note', { n: hs.unconfirmedGender.toLocaleString() }), 'assumed')}
            {row('hsClub', t('stats.row.hsClub'), t('stats.row.hsClub.value'), t('stats.row.hsClub.note'), 'assumed')}
            {row(
              'finals',
              t('stats.row.finals'),
              t('stats.row.finals.value', { matched: KOSHIEN_META.wiki.finalsMatched.toLocaleString(), names: KOSHIEN_META.wiki.finalsNames.toLocaleString() }),
              t('stats.row.finals.note', {
                publisher: pub('wikiHsResults'),
                accessed: SOURCES.wikiHsResults.accessed ?? '',
                checked: KOSHIEN_META.wiki.finalsChampionsChecked,
                agree: KOSHIEN_META.wiki.finalsChampionsAgree,
                koshMatched: KOSHIEN_META.wiki.koshMatched,
                koshNames: KOSHIEN_META.wiki.koshNames,
              }),
              'fact',
            )}
            {row(
              'indepLevel',
              t('stats.row.indepLevel'),
              INDEP_LEAGUE_LEVELS.map((l) => t('stats.row.indepLevel.item', { league: nameText(l.league), teams: l.teams, picks: l.picks, per: l.perTeamYear.toFixed(2) })).join(listSep()),
              t('stats.row.indepLevel.note', { publisher: pub('npbDraft'), from: DRAFT_META.years[0], to: DRAFT_META.years.at(-1) ?? '', total: DRAFT_PICKS_TOTAL }),
              'assumed',
            )}
            {row(
              'koshien',
              t('stats.row.koshien'),
              t('stats.row.koshien.value', { n: KOSHIEN_SCHOOL_COUNT, rows: KOSHIEN_META.rowsTotal.toLocaleString(), share: share(KOSHIEN_META.rowsMatched, KOSHIEN_META.rowsTotal) }),
              t('stats.row.koshien.note', { publisher: pub('jhbfSummerOuting'), accessed: SOURCES.jhbfSummerOuting.accessed ?? '', distinct: KOSHIEN_META.unmatchedDistinct, unmatched: KOSHIEN_META.unmatchedRows }),
              'fact',
            )}
            {row(
              'univDev',
              t('stats.row.univDev'),
              t('stats.row.of', { n: univDev, total: uni.total, share: share(univDev, uni.total) }),
              t('stats.row.univDev.note', {
                publisher: sourceText(kei).publisher,
                title: sourceText(kei).title,
                exam: examText(DEVIATION_UNIV_META.source, DEVIATION_UNIV_META.exam),
                n: keiN,
                year: DEVIATION_UNIV_META.year,
                accessed: kei.accessed ?? '',
                floor: floorRows,
                bf: DEVIATION_UNIV_META.borderFree,
              }),
              'fact',
            )}
            {row('univDevJ', t('stats.row.univDevJ'), t('stats.row.schools', { n: jukeUnivN }), t('stats.row.univDevJ.note', { publisher: sourceText(jukeU).publisher, title: sourceText(jukeU).title, accessed: jukeU.accessed ?? '' }), 'fact')}
            {row(
              'hsDev',
              t('stats.row.hsDev'),
              t('stats.row.of', { n: hsDev.toLocaleString(), total: hs.main.toLocaleString(), share: share(hsDev, hs.main) }),
              t('stats.row.hsDev.note', {
                publisher: sourceText(juke).publisher,
                title: sourceText(juke).title,
                accessed: juke.accessed ?? '',
                sourceSchools: DEVIATION_HS_META.sourceSchools.toLocaleString(),
                n: hsDev.toLocaleString(),
                unmatched: DEVIATION_HS_META.unmatchedCount,
              }),
              'fact',
            )}
            {row(
              'amateur',
              t('stats.row.amateur'),
              t('stats.row.amateur.value', { n: AMATEUR_TEAMS.length, share: share(AMATEUR_TEAMS.length, 339) }),
              t('stats.row.amateur.note', {
                publisher: pub('jabaRenmeiho2026'),
                accessed: SOURCES.jabaRenmeiho2026.accessed ?? '',
                regions: Object.entries(AMATEUR_META.byRegion)
                  .map(([r, n]) => `${nameText(r)} ${n}/${AMATEUR_OFFICIAL_2025[r as JabaRegion].company + AMATEUR_OFFICIAL_2025[r as JabaRegion].club}`)
                  .join(listSep()),
                inactive: AMATEUR_META.inactiveExcluded.length,
              }),
              'fact',
            )}
            {row('indepTeams', t('stats.row.indepTeams'), t('stats.row.indepTeams.value', { n: ORGS.filter((o) => o.type === 'independent' && o.realName).length }), t('stats.row.indepTeams.note'), 'fact')}
            {row('entry', t('stats.row.entry'), t('stats.row.schools', { n: coverage('univ').withEntry }), t('stats.row.entry.note'), 'none')}
            {row(
              'leagues',
              t('stats.row.leagues'),
              t('stats.row.leagues.value', {
                leagues: UNIV_LEAGUES.length,
                members: UNIV_LEAGUES.reduce((a, l) => a + l.members.length, 0),
                mapped: LEAGUE_SCHOOL_IDS.length,
                unmapped: UNMAPPED_LEAGUE_MEMBERS.length,
              }),
              t('stats.row.leagues.note', { publisher: pub('jubfLeagues'), accessed: JUBF_META.accessed }),
              'fact',
            )}
            {row('univClub', t('stats.row.univClub'), t('stats.row.of', { n: univClub, total: uni.main, share: share(univClub, uni.main) }), t('stats.row.univClub.note'), 'fact')}
            {row('npb', t('stats.row.npb'), t('stats.row.npb.value', { n: Object.keys(NPB_STANDINGS).length }), t('stats.row.npb.note', { publisher: pub('npbStandings'), accessed: SOURCES.npbStandings.accessed ?? '' }), 'fact')}
            {row('us', t('stats.row.us'), t('stats.row.us.value', { n: US_COLLEGES.length }), t('stats.row.us.note', { publisher: pub('wikiNcaaD1Baseball'), accessed: SOURCES.wikiNcaaD1Baseball.accessed ?? '' }), 'fact')}
            {row(
              'rating',
              t('stats.row.rating'),
              t('stats.row.rating.value', { univ: LEAGUE_SCHOOL_IDS.length, hs: KOSHIEN_SCHOOL_COUNT, company: AMATEUR_TEAMS.filter((x) => x.nationals).length, us: US_COLLEGES.length }),
              t('stats.row.rating.note'),
              'assumed',
            )}
            {row('admit', t('stats.row.admit'), '—', t('stats.row.admit.note'), 'assumed')}
          </tbody>
        </table>
      </div>
      <h3 style={{ marginTop: 16 }}>{t('stats.major.title')}</h3>
      <p className="small muted">{t('stats.major.lede')}</p>
      <ul className="feed">
        {major.map(({ n, d }) => (
          <li key={n}>
            <span className="x small">
              {t('stats.major.item', {
                name: nameText(n),
                value: d
                  ? t('stats.major.dev', { value: d.floor ? t('stats.major.floor') : d.value, src: d.sourceId === DEVIATION_UNIV_META.source ? t('stats.major.kei') : t('stats.major.juke') })
                  : t('stats.major.none'),
              })}
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}

export function StatsPage({ onBack }: { onBack: () => void }) {
  const stats = Object.values(STATS)
  return (
    <main className="statspage">
      <button type="button" className="btn sm" onClick={onBack}>
        {t('stats.back')}
      </button>
      <h1 style={{ fontSize: 36, margin: '16px 0 8px' }}>{t('stats.title')}</h1>
      <p className="muted">{t('stats.lede')}</p>
      <div className="denominator" style={{ marginTop: 16 }}>
        {t('stats.denominator')}
      </div>

      <SchoolCoverage />

      <h2 style={{ marginTop: 28 }}>{t('stats.params')}</h2>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>{t('stats.th.what')}</th>
              <th>{t('stats.th.value')}</th>
              <th>{t('stats.th.kind')}</th>
              <th>{t('stats.th.who')}</th>
              <th>{t('stats.th.source')}</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => {
              const x = statText(s)
              return (
                <tr key={s.id}>
                  <td>
                    {x.definition}
                    {x.note && <div className="small muted">{x.note}</div>}
                  </td>
                  <td className="num">{s.unit === '割合' || s.unit === '年あたり' ? pctText(s.value) : `${Math.round(s.value * 100) / 100} ${x.unit}`}</td>
                  <td>
                    <KindBadge stat={s} />
                    <div className="small muted">{t('stats.domainSex', { domain: t(DOMAIN_LABEL[s.domain]), sex: t(SEX_LABEL[s.sex]) })}</div>
                    {x.verifyNote && <div className="small muted">{x.verifyNote}</div>}
                  </td>
                  <td>
                    {x.population}
                    <div className="small muted">{x.asOf}</div>
                  </td>
                  <td>
                    {s.sourceIds.length
                      ? s.sourceIds.map((id) => (
                          <div key={id}>
                            <a href={SOURCES[id]?.url} target="_blank" rel="noreferrer">
                              {SOURCES[id] && sourceText(SOURCES[id]).publisher}
                            </a>
                          </div>
                        ))
                      : t('stats.noSource')}
                    <div className="small muted">{t('stats.checked', { date: checkedOn(s.sourceIds) })}</div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <h2 style={{ marginTop: 28 }}>{t('stats.cal.title')}</h2>
      <p className="small muted">
        {t('stats.cal.lede', {
          lives: CALIBRATION.lives.toLocaleString(),
          iterations: CALIBRATION.iterations,
          generated: CALIBRATION.generated,
          validation: CALIBRATION.validationLives.toLocaleString(),
          min: CALIBRATION.minSuccesses,
        })}
      </p>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>{t('stats.cal.th.stage')}</th>
              <th>{t('stats.cal.th.target')}</th>
              <th>{t('stats.cal.th.achieved')}</th>
              <th>{t('stats.cal.th.n')}</th>
              <th>{t('stats.cal.th.verdict')}</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(CALIBRATION.report).map(([k, r]) => (
              <tr key={k}>
                <td>
                  {CHECK_LABEL[k] ? t(CHECK_LABEL[k]) : k}
                  <div className="small muted mono">{k}</div>
                </td>
                <td className="num">
                  {pctText(r.target)}
                  <div>
                    {(CHECKS[k]?.statIds ?? []).slice(0, 1).map((id) => (
                      <KindBadge key={id} stat={STATS[id]} />
                    ))}
                  </div>
                </td>
                <td className="num">
                  {pctText(r.achieved)} ±{pctText(1.96 * r.se)}
                </td>
                <td className="num">
                  {r.k.toLocaleString()} / {r.n.toLocaleString()}
                </td>
                <td>{r.insufficient ? <span className="badge recheck">{t('stats.cal.insufficient')}</span> : t('stats.cal.diff', { z: `${r.z >= 0 ? '+' : ''}${r.z}` })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ marginTop: 28 }}>{t('stats.sources')}</h2>
      <ul>
        {Object.values(SOURCES).map((s) => {
          const x = sourceText(s)
          return (
            <li key={s.id} className="small" style={{ marginBottom: 8 }}>
              <a href={s.url} target="_blank" rel="noreferrer">
                {t('stats.source.item', { publisher: x.publisher, title: x.title })}
              </a>{' '}
              <span className="muted">{t('stats.checked', { date: s.accessed ?? t('stats.source.notOpened') })}</span>
              {x.checkNote && <div className="muted">{x.checkNote}</div>}
            </li>
          )
        })}
      </ul>
    </main>
  )
}
