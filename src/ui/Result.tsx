import { useMemo, useState } from 'react'
import type { LifeState } from '../engine/types.ts'
import { fullName, prefName } from '../engine/life.ts'
import { shownAge } from '../engine/displayAge.ts'
import { epitaph, highestLabel, keyMoments, lifeTitle } from '../engine/summary.ts'
import { kidBallReached } from '../engine/kidBall.ts'
import { languageRows } from '../engine/language.ts'
import { avgHappiness, fmtOneIn, rarityOf, type CohortResult } from '../engine/cohort.ts'
import { ladderOf } from '../engine/ladder.ts'
import { STATS } from '../data/stats.ts'
import { CALIBRATION } from '../data/calibration.ts'
import { KindBadge, ModelBadge, SourceLine } from './common.tsx'
import { pctText, yen } from './format.ts'
import { HOME_LABEL, companyText, eduText } from '../engine/after.ts'
import { livingPlace } from '../engine/place.ts'
import { hsCareerHr } from '../engine/games.ts'
import { RecordsPanel } from './Records.tsx'
import { PotentialRetro } from './PotentialPanels.tsx'
import { ProYears } from './ProPanels.tsx'
import { Panel } from './Panel.tsx'
import { LifeMap, SurvivalCurve } from './Charts.tsx'
import { ShareDialog } from './ShareDialog.tsx'
import { Ending } from './Ending.tsx'
import { lang, num, t, wordSep } from '../i18n/index.ts'
import { countryName, placeName } from '../i18n/places.ts'
import { statText } from '../i18n/statsEn.ts'
import { gameText as g } from '../i18n/game.ts'

// (the texts are in src/i18n; the game's own words (the title, the epitaph, the cause, the stages, the jobs, the schools, the
// achievements, the cohort's sentence and the life's lines) through src/i18n/game.ts; places and countries through src/i18n/places.ts)

interface Props {
  life: LifeState
  cohort: CohortResult | null
  cohortProgress: number
  onAgain: (samePrefecture: boolean) => void
  onTop: () => void
}

function pathStats(life: LifeState): string[] {
  const r = life.career.highestRank
  const ids: string[] = []
  // (Korea and Cuba: one statement for the whole model, all assumptions)
  if (life.person.country === 'KR') return ['krModel']
  if (life.person.country === 'CU') return ['cuModel']
  if (life.person.country === 'US') {
    // the US stages' rates are all game assumptions (stats.ts `us*`)
    const was = (p: string) => life.timeline.some((t) => t.phase === p)
    if (r >= 2) ids.push('usMid')
    if (r >= 3) ids.push('usHs')
    if (r >= 4) ids.push('usHsStay')
    if (was('univ')) ids.push('usHsCollege', 'usCollegeStay')
    if (life.career.usDraft) ids.push(life.career.usDraft.from === 'hs' ? 'usHsDraft' : 'usCollegeDraft', 'usDraftRounds')
    if (was('proMinor')) ids.push('usMinorUp')
    if (r >= 8) ids.push('usMlbDebut')
    return ids
  }
  if (r >= 2) ids.push('jpJhsContinue')
  if (r >= 3) ids.push('jpHsJoin')
  if (r >= 4) ids.push('jpHsComplete')
  const was = (p: string) => life.timeline.some((t) => t.phase === p)
  if (was('univ')) ids.push('jpToUniv', 'jpUnivComplete')
  if (was('company')) ids.push(was('univ') ? 'jpUnivToCompany' : 'jpToCompany')
  if (was('indep')) ids.push(was('univ') ? 'jpUnivToIndep' : 'jpToIndep')
  if (life.career.draftedFrom === '高校') ids.push('jpHsFile', 'jpHsDraftGivenFile', 'jpShihaikaHs')
  if (life.career.draftedFrom === '大学') ids.push('jpUnivFile', 'jpUnivDraftGivenFile', 'jpShihaikaUniv')
  if (life.career.draftedFrom === '社会人') ids.push('jpCompanyDraft', 'jpShihaikaCompany')
  if (life.career.draftedFrom === '独立リーグ') ids.push('jpIndepDraft', 'jpShihaikaIndep')
  if (life.career.achievements.includes('育成から支配下')) ids.push('jpIkuseiPromote')
  if (r >= 8) ids.push('jpIchigun')
  return ids
}

/** the jobs he held after baseball (part-time work only when there was nothing else) */
function jobList(life: LifeState): string[] {
  const jobs = life.after?.jobs ?? []
  const main = jobs.filter((j) => j !== 'アルバイト')
  return main.length ? main : jobs
}

/** a frequency as 「N回に1回」 (cohort.ts fmtOneIn), in the language now */
function oneIn(p: number): string {
  const s = fmtOneIn(p)
  const m = /^(.+)回に1回$/.exec(s)
  return lang() !== 'ja' && m ? t('res.oneIn', { n: m[1] }) : s
}

/** how rare reaching his highest stage is, in a few words (the big line and the share card) */
function rarityWords(r: { k: number; n: number }): string {
  return r.k >= 10 ? t('res.about', { x: oneIn(r.k / r.n) }) : r.k === 0 ? t('res.lt1', { n: num(r.n) }) : t('res.lt10', { n: num(r.n) })
}

/** n years (one year in English) */
const yearsText = (n: number) => t(n === 1 ? 'res.years.one' : 'res.years', { n })

function summaryText(life: LifeState): string {
  const c = life.career
  const parts: string[] = [t('res.s.born', { place: placeName(prefName(life)) })]
  if (c.highestRank > 0) {
    parts.push(t('res.s.started', { age: shownAge(c.startedAge), label: g(highestLabel(life)) }))
    if (c.endedAge !== null) parts.push(t('res.s.left', { age: shownAge(c.endedAge) }))
  }
  const jobs = jobList(life)
  if (jobs.length === 1) parts.push(t('res.s.job', { job: g(jobs[0]) }))
  else if (jobs.length === 2) parts.push(t('res.s.jobs2', { a: g(jobs[0]), b: g(jobs[1]) }))
  else if (jobs.length > 2) parts.push(t('res.s.jobsMany', { first: g(jobs[0]), n: jobs.length }))
  else if (life.job && life.job !== '引退' && life.job !== '大学生') parts.push(t('res.s.job', { job: g(life.job) }))
  const kids = life.family.children
  if (life.family.everMarried) parts.push(kids ? t(kids === 1 ? 'res.s.marriedKids.one' : 'res.s.marriedKids', { n: kids }) : t('res.s.married'))
  if (life.family.ended === 'divorce' && !life.family.spouse) parts.push(t('res.s.divorced'))
  // where he lived at the end, when it is known and is not the place of birth (place.ts)
  const lastPlace = livingPlace(life)
  if (lastPlace && lastPlace !== prefName(life)) parts.push(t('res.s.lastPlace', { place: placeName(lastPlace) }))
  parts.push(t('res.s.died', { age: shownAge(life.age), cause: life.causeOfDeath ? g(life.causeOfDeath) : t('res.s.illness') }))
  // (Japanese and Chinese run their sentences together; English and Korean put a space between them)
  return parts.join(wordSep())
}

export function Result({ life, cohort, cohortProgress, onAgain, onTop }: Props) {
  const [share, setShare] = useState(false)
  const [replay, setReplay] = useState(false)
  const [decade, setDecade] = useState<number | null>(null)
  const ladder = ladderOf(life.person.country)
  const rank = life.career.highestRank
  const rarity = cohort ? rarityOf(cohort, rank) : null
  // (the title in the language now: the share card and the post carry it as the screen shows it)
  const title = g(lifeTitle(life))
  const moments = keyMoments(life)
  const myHappy = avgHappiness(life)
  const decades = useMemo(() => [...new Set(life.log.map((e) => Math.floor(e.age / 10) * 10))], [life])
  const shown = decade === null ? life.log : life.log.filter((e) => Math.floor(e.age / 10) * 10 === decade)
  const ids = pathStats(life)

  return (
    <main className="result">
      <div className="toprow">
        <button type="button" className="btn sm" onClick={onTop}>
          {t('res.top')}
        </button>
      </div>

      <article className="doc dark record">
        <div className="band">
          <b>{t('res.band', { c: life.person.country })}</b>
          <span className="no">
            No. {life.person.country}-{life.person.birthYear}-{String(life.age).padStart(3, '0')}
          </span>
        </div>
        <div className="body">
          <div>
            <p className="small muted">
              {placeName(prefName(life))} · {t('res.male')}
            </p>
            <p className="name">{g(fullName(life))}</p>
            <p className="small muted num">
              {life.person.birthYear} – {life.year} · {t('res.diedAt', { age: shownAge(life.age) })}
            </p>
            <p className="story" style={{ marginTop: 10 }}>
              {summaryText(life)}
            </p>
            <p className="cause">
              {t('res.cause')} <b>{life.causeOfDeath && g(life.causeOfDeath)}</b>
            </p>
            <p className="small muted">{t('res.cause.note')}</p>
          </div>
          <dl className="fields" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))', borderTop: 0, paddingTop: 0, alignContent: 'start' }}>
            <div>
              <dt>{t('res.highest')}</dt>
              <dd>{g(ladder[rank]?.short ?? '')}</dd>
            </div>
            <div>
              <dt>{t('res.yearsPlaying')}</dt>
              <dd>
                {yearsText(life.career.yearsPlaying)}
                {life.career.endedAge !== null && rank > 0 && (
                  <small>
                    {t('res.ageRange', { from: shownAge(life.career.startedAge), to: shownAge(life.career.endedAge) })}
                  </small>
                )}
              </dd>
            </div>
            <div>
              <dt>{t('res.lastJob')}</dt>
              <dd>
                {g(jobList(life).at(-1) ?? (life.job && life.job !== '引退' ? life.job : '—'))}
                {life.after?.work?.company && life.after.work.title === jobList(life).at(-1) && <small>{g(companyText(life.after.work.company))}</small>}
                {life.after?.work?.team && !life.after.work.company && life.after.work.title === jobList(life).at(-1) && <small>{t('life.teamCompany', { name: g(life.after.work.team) })}</small>}
              </dd>
            </div>
            <div>
              <dt>{t('res.edu')}</dt>
              <dd>
                {g(eduText(life))}
                {life.schools?.univ && <small>{g(life.schools.univ.name)}{life.schools.univ.course ? t('res.univ.course', { course: g(life.schools.univ.course) }) : ''}{life.schools.univ.league ? t('res.univ.league', { league: g(life.schools.univ.league) }) : ''}</small>}
              </dd>
            </div>
            {life.schools?.hs && (
              <div>
                <dt>{t('res.hs')}</dt>
                <dd>
                  {g(life.schools.hs.name)}
                  <small>
                    {life.schools.hs.note ? t('res.hs.note', { note: g(life.schools.hs.note) }) : ''}
                    {t('res.hs.real')}
                  </small>
                </dd>
              </div>
            )}
            {languageRows(life).length > 1 && (
              <div>
                <dt>{t('res.langs')}</dt>
                <dd>
                  {languageRows(life).map((l) => (l.native ? g(l.label) : t('res.lang', { label: g(l.label), band: g(l.band) }))).join(t('life.sep'))}
                  <small>{t('res.langs.note')}</small>
                </dd>
              </div>
            )}
            <div>
              <dt>{t('res.home')}</dt>
              <dd>{life.after ? g(HOME_LABEL[life.after.home]) : t('res.home.parents')}</dd>
            </div>
            <div>
              <dt>{t('res.income')}</dt>
              <dd>{yen(life.lifetimeIncome)}</dd>
            </div>
            <div>
              <dt>{t('res.family')}</dt>
              <dd>
                {life.family.everMarried ? (life.family.ended === 'divorce' && !life.family.spouse ? t('res.family.divorced') : t('res.family.married')) : t('res.family.single')}
                {life.family.children ? t(life.family.children === 1 ? 'res.family.kids.one' : 'res.family.kids', { n: life.family.children }) : ''}
                {life.career.achievements.includes('孫') ? t('res.family.grandkids') : ''}
                {/* a son's baseball, as far as his father saw it (engine/kidBall.ts) */}
                {kidBallReached(life).map(([name, reached]) => (
                  <small key={name} className="kv-sub">
                    {t('res.family.kidBall', { name: g(name), reached: g(reached) })}
                  </small>
                ))}
              </dd>
            </div>
            <div>
              <dt>{t('res.happiest')}</dt>
              <dd>{t('res.age', { n: shownAge(life.happiestAge) })}</dd>
            </div>
            <div>
              <dt>{t('res.money')}</dt>
              <dd>{yen(life.money)}</dd>
            </div>
            <div>
              <dt>{t('res.achievements')}</dt>
              <dd>{life.career.achievements.filter((a) => a !== '孫' && a !== '少年野球の指導').map(g).join(t('life.sep')) || '—'}</dd>
            </div>
            <div>
              <dt>{t('res.hsHr')}</dt>
              <dd>
                {rank >= 3 ? t('res.hsHr.value', { n: hsCareerHr(life) }) : '—'}
                {rank >= 3 && <small>{t('panel.gameRecord')}</small>}
              </dd>
            </div>
            <div>
              <dt>{t('res.afterBaseball')}</dt>
              <dd>{life.after?.baseballLife.map(g).join(t('life.sep')) || '—'}</dd>
            </div>
          </dl>
        </div>
      </article>

      <div>
        <button type="button" className="btn" onClick={() => setReplay(true)}>
          {t('res.replay')}
        </button>
      </div>

      <section className="panel summary-block ro ro-summary">
        <p className="title-line">{t('share.quote', { text: title })}</p>
        <p className="epitaph">{g(epitaph(life))}</p>
        <div className="rarity">
          <h3>
            {t('res.freq')} <ModelBadge />
          </h3>
          {rarity && cohort ? (
            <>
              <p className="big">{rarityWords(rarity)}</p>
              <p>
                {t('res.reached', { label: g(highestLabel(life)) })}
                {g(rarity.text)}
              </p>
              <p className="small muted">
                {t('res.rarity.note', {
                  cond: t('res.rarity.cond', { pot: life.pot ? t('res.rarity.pot') : '', country: countryName(life.person.country), place: placeName(prefName(life)) }),
                  n: num(cohort.nRarity),
                })}
              </p>
            </>
          ) : (
            <p className="muted">{t('life.curve.wait', { p: Math.round(cohortProgress * 100) })}</p>
          )}
        </div>
        {cohort && (
          <div className="medians">
            <div>
              {t('res.lifespan')}
              <b>{t('life.ageAt', { n: shownAge(life.age) })}</b>
              <small>{t('res.med.lifespan', { age: shownAge(cohort.medians.lifespan) })}</small>
            </div>
            <div>
              {t('res.yearsPlaying')}
              <b>{yearsText(life.career.yearsPlaying)}</b>
              <small>{t('res.med.years', { n: cohort.medians.yearsPlaying })}</small>
            </div>
            <div>
              {t('res.income')}
              <b>{yen(life.lifetimeIncome)}</b>
              <small>{t('res.med', { v: yen(cohort.medians.lifetimeIncome) })}</small>
            </div>
            <div>
              {t('res.happiness')}
              <b>{myHappy}</b>
              <small>{t('res.med', { v: cohort.medians.happiness })}</small>
            </div>
          </div>
        )}
        {cohort && <p className="small muted">{t('res.med.note', { n: num(cohort.nFull) })}</p>}
        <div>
          <h3>{t('res.moments')}</h3>
          <div className="moments">
            {moments.map((m, i) => (
              <div key={i}>
                <span className="num muted">{t('life.ageAt', { n: shownAge(m.age) })}</span>
                <span>{g(m.text)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {life.pot && (
        <div className="ro ro-retro">
          <PotentialRetro life={life} fold />
        </div>
      )}

      <div className="two">
        <Panel fold className="ro ro-ladder" title={<>{t('res.ladder')} <ModelBadge /></>}>
          <p className="small muted">{t('res.ladder.desc')}</p>
          <div className="ladder" style={{ marginTop: 10 }}>
            {ladder.slice(1).map((r) => {
              const share = cohort ? cohort.atLeast[r.rank] / cohort.nRarity : 0
              const w = share > 0 ? Math.max(2, ((Math.log10(share) + 4) / 4) * 100) : 0
              return (
                <div key={r.rank} className={`r ${r.rank === rank ? 'me' : ''}`}>
                  <span>
                    {g(r.short)}
                    {r.rank === rank ? t('res.ladder.you') : ''}
                  </span>
                  <span className="num" style={{ textAlign: 'right' }}>
                    {cohort
                      ? cohort.atLeast[r.rank] < 10
                        ? t('res.ladder.few', { k: cohort.atLeast[r.rank], n: num(cohort.nRarity) })
                        : share >= 0.01
                          ? pctText(share)
                          : t('res.about', { x: oneIn(share) })
                      : '…'}
                  </span>
                  <div className="bar">
                    <i style={{ width: `${w}%`, background: 'var(--teal)' }} />
                  </div>
                </div>
              )
            })}
          </div>
          <p className="small muted" style={{ marginTop: 8 }}>
            {t('res.ladder.note')}
            {CALIBRATION.report['jp.mlb']?.insufficient && t('res.ladder.mlb', { n: num(CALIBRATION.validationLives), k: CALIBRATION.report['jp.mlb'].k })}
          </p>
        </Panel>

        <Panel fold className="ro ro-steps" title={t('res.steps')}>
          <p className="small muted">{t('res.steps.desc')}</p>
          <ul className="feed" style={{ marginTop: 6 }}>
            {ids.length === 0 && <li className="small muted">{t('res.steps.none')}</li>}
            {ids.map((id) => {
              const s = STATS[id]
              return (
                <li key={id}>
                  <span className="a num">{pctText(s.value)}</span>
                  <span className="x small">
                    {t('res.stat', { population: statText(s).population, definition: statText(s).definition })} <KindBadge stat={s} />
                  </span>
                </li>
              )
            })}
          </ul>
        </Panel>
      </div>

      <div className="two">
        <Panel fold className="ro ro-map" title={<>{t('life.map')} <span className="lbl">{t('life.map.lbl')}</span></>}>
          <LifeMap life={life} upto={-1} />
        </Panel>
        {cohort && (
          <Panel fold className="ro ro-curve" title={<>{t('life.curve')} <ModelBadge /></>}>
            <SurvivalCurve playingByAge={cohort.playingByAge} age={life.career.endedAge ?? life.age} />
          </Panel>
        )}
      </div>

      <div className="ro ro-records">
        <RecordsPanel life={life} tournaments={6} />
      </div>

      <Panel fold className="ro ro-log" title={<>{t('res.log')} <span className="lbl">{t('res.log.lbl')}</span></>}>
        <div className="decades">
          <button type="button" className="btn sm" aria-pressed={decade === null} onClick={() => setDecade(null)}>
            {t('res.log.all')}
          </button>
          {decades.map((d) => (
            <button key={d} type="button" className="btn sm" aria-pressed={decade === d} onClick={() => setDecade(d)}>
              {d === 0 ? t('res.log.early') : t('res.log.decade', { d })}
            </button>
          ))}
        </div>
        <ul className="feed">
          {shown.map((e, i) => (
            <li key={i} className={e.kind}>
              <span className="a">{t('life.ageAt', { n: shownAge(e.age) })}</span>
              <span className="x">
                {g(e.text)}
                {e.statIds && <SourceLine ids={e.statIds} />}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="ro ro-years">
        <ProYears life={life} fold />
      </div>

      <section className="panel ro ro-again">
        <h3>{t('res.again')}</h3>
        <div className="restart" style={{ marginTop: 8 }}>
          <button type="button" className="btn primary" onClick={() => onAgain(false)}>
            {t('res.again.born')}
          </button>
          <button type="button" className="btn" onClick={() => onAgain(true)}>
            {t('res.again.place', { place: placeName(prefName(life)) })}
          </button>
          <button type="button" className="btn" onClick={() => setShare(true)}>
            {t('share.this')}
          </button>
        </div>
        <p className="credits" style={{ marginTop: 14 }}>
          {t('res.credits')}
        </p>
      </section>

      <div className="footer-bar">
        <button type="button" className="btn" onClick={() => setShare(true)}>
          {t('res.share')}
        </button>
        <button type="button" className="btn primary lg" onClick={() => onAgain(false)}>
          {t('res.again.born')}
        </button>
      </div>

      {replay && <Ending life={life} onDone={() => setReplay(false)} />}
      {share && <ShareDialog life={life} title={title} rarityText={rarity ? rarityWords(rarity) : null} onClose={() => setShare(false)} />}
    </main>
  )
}
