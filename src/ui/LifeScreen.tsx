import { useEffect, useMemo, useRef, useState } from 'react'
import type { Focus, LifeState, Phase, Roster } from '../engine/types.ts'
import { shownAge } from '../engine/displayAge.ts'
import { fullName, isPlaying, prefName, setFocus as setLifeFocus, skillPercentile, type Sim } from '../engine/life.ts'
import { STATS } from '../data/stats.ts'
import { SPEEDS, secondsPerYear, useLifeRunner } from '../game/useLifeRunner.ts'
import type { CohortResult } from '../engine/cohort.ts'
import { ladderOf } from '../engine/ladder.ts'
import { DecisionDialog, DecisionPeek } from './DecisionDialog.tsx'
import { ShopSheet } from './ShopSheet.tsx'
import { LifeMap, SurvivalCurve } from './Charts.tsx'
import { KindBadge, ModelBadge, Portrait, SourceLine } from './common.tsx'
import { usedStatIds } from './usedStats.ts'
import { SceneArt } from './SceneArt.tsx'
import { heightAt, weightAt } from '../engine/body.ts'
import { SKILL_LABEL, abilityScore, conditionLabel, skillsFor, subRoleLabel, velocityKmh } from '../engine/ability.ts'
import { scoutLabel } from '../engine/careerSeason.ts'
import { METHOD_LABEL, studentDev } from '../engine/route/schools.ts'
import { HOME_LABEL, companyText, eduText } from '../engine/after.ts'
import { livingPlace, placeIndex } from '../engine/place.ts'
import { phaseLabel, yen } from './format.ts'
import { ISO3 } from '../engine/countries/index.ts'
import { languageRows } from '../engine/language.ts'
import { RecordsPanel } from './Records.tsx'
import { PotentialPanel } from './PotentialPanels.tsx'
import { MoneyBar, ProYears, StopDialog } from './ProPanels.tsx'
import { placeLabel, wishLabel } from '../engine/positionWish.ts'
import { starOf } from '../engine/potential.ts'
import { termsIn } from '../data/glossary.ts'
import { num, t, type Key } from '../i18n/index.ts'
import { countryName, placeName } from '../i18n/places.ts'
import { statAsOfShort, statText } from '../i18n/statsEn.ts'
import { gameText as g } from '../i18n/game.ts'
import { brandName } from '../game/shareLink.ts'

/** the meanings of the words of a line of the record, as its tooltip (data/glossary.ts, found in the Japanese line); none when it uses none */
const termTip = (text: string): string | undefined => {
  const t = termsIn(text)
  return t.length ? t.map((x) => `${g(x.word)}: ${g(x.meaning)}`).join('\n') : undefined
}

// (while he plays, only practice makes him better: a year of another focus is a year his teammates gain on him (the ability is his
// standing among those of his age), and the squad is picked by ability; life.ts statusYear)
// (the texts of this screen are in src/i18n; the game's own words (team, job, school, the record's lines) through src/i18n/game.ts)
const FOCUS_PLAY: Record<Focus, [Key, Key]> = {
  practice: ['focus.play.practice', 'focus.play.practice.hint'],
  study: ['focus.play.study', 'focus.play.study.hint'],
  rest: ['focus.play.rest', 'focus.play.rest.hint'],
  people: ['focus.play.people', 'focus.play.people.hint'],
}
const FOCUS_LIFE: Record<Focus, [Key, Key]> = {
  practice: ['focus.life.practice', 'focus.life.practice.hint'],
  study: ['focus.life.study', 'focus.life.study.hint'],
  rest: ['focus.life.rest', 'focus.life.rest.hint'],
  people: ['focus.life.people', 'focus.life.people.hint'],
}

interface Props {
  life: LifeState
  sim: Sim
  cohort: CohortResult | null
  cohortProgress: number
  onDeath: () => void
  onQuit: () => void
  onTheme: () => void
}

export function LifeScreen({ life, sim, cohort, cohortProgress, onDeath, onQuit, onTheme }: Props) {
  const progressRef = useRef<HTMLDivElement | null>(null)
  const r = useLifeRunner(life, sim, onDeath, progressRef)
  const [expanded, setExpanded] = useState(false)
  const [menu, setMenu] = useState(false)
  const playing = isPlaying(life)
  // (a reading of the state for the panel: languages he speaks, none he has not learned)
  const languages = languageRows(life)
  const focusLabels = playing ? FOCUS_PLAY : FOCUS_LIFE
  const spy = secondsPerYear(life.config.pace) / r.speed
  const skill = skillPercentile(life)
  const started = life.career.highestRank > 0
  // the years before the entrance exams (Japan's schools and their 偏差値: route/schools.ts)
  const examYears = (life.person.country ?? 'JP') === 'JP' && life.age >= 9 && life.age <= 18
  // after baseball, out of work: this year's income is what came before he lost the job (after.ts incomeNow)
  const jobless = !playing && !!life.after && !life.after.work && !life.after.retired && life.age >= 18 && life.job !== '大学生'
  const feed = life.log.slice().reverse()
  // (ids this version does not know are skipped: usedStats.ts)
  const usedStats = useMemo(() => {
    return usedStatIds(life.log)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [life, r.version])
  const [, setFocusVersion] = useState(0)
  // the money screen holds the clock while it is open (the year does not move while he chooses)
  const [shopOpen, setShopOpen] = useState(false)
  const { setHold } = r
  // leaving for the title page keeps the year in progress with the life (useLifeRunner save)
  const quit = () => {
    r.save()
    onQuit()
  }
  useEffect(() => {
    setHold(shopOpen)
    return () => setHold(false)
  }, [shopOpen, setHold])
  const setFocus = (f: Focus) => {
    setLifeFocus(life, f)
    setFocusVersion((v) => v + 1)
    setMenu(false)
  }
  const stillPlaying = cohort ? cohort.playingByAge[life.age] : undefined
  const ladder = ladderOf(life.person.country)

  return (
    <div className="life">
      <header className="life-header">
        <div className="agebox">
          <span className="brand">{brandName(life.person.country)}</span>
          <span className="age num">
            {shownAge(life.age)}
            <small>{t('life.ageUnit')}</small>
          </span>
          <div className="meta">
            <span className="sub">{t('life.meta', { year: life.year, name: g(fullName(life)), sec: spy >= 10 ? Math.round(spy) : Math.round(spy * 10) / 10 })}</span>
            <div className="yearbar" ref={progressRef}>
              <i />
            </div>
          </div>
        </div>
        <div className="controls">
          <button type="button" aria-pressed={r.paused} onClick={r.togglePause} aria-label={r.paused ? t('life.resume') : t('life.pause')}>
            {r.paused ? '▸' : '❚❚'}
            <span className="wide-only"> {r.paused ? t('life.resume') : t('life.pause')}</span>
          </button>
          <span className="speeds" role="group" aria-label={t('life.speed')}>
            {SPEEDS.map((s) => (
              <button key={s} type="button" aria-pressed={r.speed === s && !r.ff} onClick={() => r.setSpeed(s)}>
                {s}×
              </button>
            ))}
          </span>
          <button type="button" className="jp" aria-pressed={r.ff} onClick={r.toggleFf}>
            <span className="wide-only">{t('life.ff.wide')}</span>
            <span className="narrow-only">{t('life.ff.narrow')}</span>»
          </button>
          <button type="button" className="jp wide-only" aria-pressed={life.autoDecide} onClick={() => r.setAuto(!life.autoDecide)}>
            {t('life.auto')}
          </button>
          <button type="button" className="wide-only icon" onClick={onTheme} aria-label={t('life.theme')}>
            ◐
          </button>
          <button type="button" className="jp wide-only" onClick={quit}>
            {t('life.quit')}
          </button>
          <span style={{ position: 'relative' }}>
            <button type="button" className="mobile-only" aria-expanded={menu} onClick={() => setMenu((m) => !m)} aria-label={t('life.more')}>
              ⋯
            </button>
            {menu && (
              <div className="menu panel">
                <button type="button" className="btn sm" aria-pressed={life.autoDecide} onClick={() => r.setAuto(!life.autoDecide)}>
                  {t('life.menu.auto', { state: life.autoDecide ? t('life.on') : t('life.off') })}
                </button>
                <button type="button" className="btn sm" onClick={onTheme}>
                  {t('life.menu.theme')}
                </button>
                <button type="button" className="btn sm" onClick={quit}>
                  {t('life.menu.quit')}
                </button>
              </div>
            )}
          </span>
          <span className="chip-row">
            <span className="stage-chip">
              {playing ? '⚾' : '・'} {playing ? g(life.career.team) || phaseLabel(life.career.phase, life.person.country, life.flags?.['cu.mlb'] !== undefined) : g(life.job) || phaseLabel(life.career.phase, life.person.country, life.flags?.['cu.mlb'] !== undefined)}
            </span>
          </span>
        </div>
        <MoneyBar life={life} onShop={() => setShopOpen(true)} shopOff={!!r.decision || !!r.stopped} />
      </header>

      <div className="life-grid">
        <div className="col left">
          <section className="panel idcard" aria-label={t('life.idcard')}>
            <div className="band">
              <span>{t('life.idcard.band', { country: life.person.country, pot: life.pot ? t('life.idcard.pot', { n: starOf(life.pot.stars) }) : '' })}</span>
              <span>{life.person.birthYear}</span>
            </div>
            <div className="inner">
              <div className="portrait">
                <Portrait cap={playing} />
              </div>
              <div>
                <div className="nm">{g(fullName(life))}</div>
                <dl>
                  <dt>{t('life.team')}</dt>
                  <dd>
                    {playing ? g(life.career.team) : started ? t('life.team.left') : '—'}
                    {playing && life.career.orgId && <small className="orgnote">{t('life.team.note')}</small>}
                  </dd>
                  <dt>{t('life.position')}</dt>
                  <dd>
                    {life.age >= 9 && started ? g(placeLabel(life)) : '—'}
                    {life.career.wish && <small className="orgnote">{t('life.wish', { wish: g(wishLabel(life.career.wish)) })}</small>}
                  </dd>
                  <dt>{t('life.tb')}</dt>
                  <dd>{t('life.tb.value', { t: life.person.throws === 'L' ? t('life.hand.L') : t('life.hand.R'), b: life.person.bats === 'L' ? t('life.hand.L') : t('life.hand.R') })}</dd>
                  <dt>{t('life.height')}</dt>
                  <dd>{Math.round(heightAt(life))}cm</dd>
                  <dt>{t('life.weight')}</dt>
                  <dd>{Math.round(weightAt(life))}kg</dd>
                  <dt>{t('life.from')}</dt>
                  <dd>{placeName(prefName(life))}</dd>
                  <dt>{t('life.highest')}</dt>
                  <dd>{g(ladder[life.career.highestRank]?.short ?? '')}</dd>
                </dl>
              </div>
            </div>
            <div className="mrz" aria-hidden="true">
              {`BL<${ISO3[life.person.country]}${life.person.birthYear}${String(life.person.birthMonth).padStart(2, '0')}<${life.person.position}${life.person.throws}${life.person.bats}`.padEnd(32, '<')}
              {'\n'}
              {`R${life.career.highestRank}<${life.age}<<${(life.config.seed >>> 0).toString(16).toUpperCase().padStart(8, '0')}`.padEnd(32, '<')}
            </div>
          </section>

          {playing && life.bb && <AbilityPanel life={life} />}
          {life.pot && <PotentialPanel life={life} />}
          <RecordsPanel life={life} />
          {(life.career.salaryHist?.length ?? 0) > 0 && <ProYears life={life} />}

          <section className="panel statpanel">
            <h3>
              {t('life.status')} <span className="lbl">0–100</span>
            </h3>
            <StatRow label={t('life.health')} v={life.status.health} color="var(--good)" />
            <StatRow label={t('life.happiness')} v={life.status.happiness} color="var(--gold)" />
            <StatRow label={t('life.skill')} v={started ? skill : 0} color="var(--teal)" muted={!playing} />
            <StatRow label={t('life.relations')} v={life.status.relations} color="var(--accent)" />
            <StatRow label={t('life.knowledge')} v={life.status.knowledge} color="var(--text-2)" />
            <p className="stathelp">
              {t('life.help.skill')}
              {playing && skill > 99 ? t('life.help.top', { p: Math.max(0.1, Math.round((100 - skill) * 10) / 10) }) : ''}
              {' '}{t('life.help.knowledge')}
              {examYears ? t('life.help.dev', { d: Math.round(studentDev(life)) }) : ''}
            </p>
          </section>
        </div>

        <div className="col center">
          <section className="panel scene">
            <div className="art" aria-hidden="true">
              <SceneArt life={life} />
            </div>
            <p className="cap">
              {/* where he lives now (place.ts): not the place of birth after a move; nothing when the model does not know it */}
              {livingPlace(life) ? `${placeName(livingPlace(life)!)} · ` : ''}
              {playing ? g(life.career.team) : g(life.job) || (life.age < 6 ? t('life.cap.family') : t('life.cap.school'))} ·{' '}
              {livingText(life)}
              {life.family.children ? t('life.cap.kids', { n: life.family.children }) : ''}
            </p>
          </section>

          <section className="panel ministrip" aria-label={t('life.status')}>
            <MiniStat label={t('life.health')} v={life.status.health} color="var(--good)" />
            <MiniStat label={t('life.happiness')} v={life.status.happiness} color="var(--gold)" />
            <MiniStat label={t('life.skill')} v={started ? skill : 0} color="var(--teal)" muted={!playing} />
            <MiniStat label={t('life.relations.short')} v={life.status.relations} color="var(--accent)" />
            <select aria-label={t('life.focus')} value={life.focus} onChange={(e) => setFocus(e.target.value as Focus)}>
              {(Object.keys(focusLabels) as Focus[]).map((f) => (
                <option key={f} value={f}>
                  {t(focusLabels[f][0])}
                </option>
              ))}
            </select>
          </section>

          <section className="panel focuspanel">
            <h3>
              {t('life.focus')} <span className="lbl">{t('life.focus.lbl')}</span>
            </h3>
            <div className="chips">
              {(Object.keys(focusLabels) as Focus[]).map((f) => (
                <button key={f} type="button" aria-pressed={life.focus === f} onClick={() => setFocus(f)}>
                  {t(focusLabels[f][0])}
                  <small>{t(focusLabels[f][1])}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="panel logpanel">
            <h3>
              {t('life.log')} <span className="lbl">{t('life.log.lbl')}</span>
            </h3>
            <div className="money-line">
              <span>
                {t('life.savings')} <b>{yen(life.money)}</b>
              </span>
              <span>
                {t('life.income')} <b>{life.income ? yen(life.income) : '—'}</b>
                {jobless ? <small>{t('life.noJob')}</small> : null}
              </span>
            </div>
            <ul className={`feed ${expanded ? '' : 'collapsed'}`} aria-live="polite">
              {feed.map((e, i) => (
                <li key={feed.length - i} className={`${e.kind} ${i < r.freshCount ? 'fresh' : ''}`} title={termTip(e.text)}>
                  <span className="a">{t('life.ageAt', { n: shownAge(e.age) })}</span>
                  <span className="x">
                    {g(e.text)}
                    {e.statIds && <SourceLine ids={e.statIds} />}
                  </span>
                </li>
              ))}
            </ul>
            {!expanded && feed.length > 6 && (
              <button type="button" className="btn sm more" onClick={() => setExpanded(true)}>
                {t('life.log.more')}
              </button>
            )}
          </section>
        </div>

        <div className="col right">
          <section className="panel famcard">
            <h3>{t('life.fam')}</h3>
            <dl className="kv">
              <dt>{t('life.father')}</dt>
              <dd>{life.family.father !== null ? t('life.ageAt', { n: life.family.father }) : t('life.dead')}</dd>
              <dt>{t('life.mother')}</dt>
              <dd>{life.family.mother !== null ? t('life.ageAt', { n: life.family.mother }) : t('life.dead')}</dd>
              <dt>{t('life.spouse')}</dt>
              <dd>
                {life.family.spouse
                  ? t('life.spouse.value', { name: g(life.family.spouse.name), y: life.family.spouse.years })
                  : life.family.everMarried
                    ? life.family.ended === 'divorce'
                      ? t('life.divorced')
                      : t('life.widowed')
                    : life.family.partner
                      ? t('life.dating', { name: g(life.family.partner) })
                      : '—'}
              </dd>
              <dt>{t('life.kids')}</dt>
              <dd>
                {life.family.children
                  ? t('life.kids.value', { n: life.family.children, ages: life.family.kids?.length ? t('life.kids.ages', { list: life.family.kids.map((k) => t('life.ageAt', { n: k })).join(t('life.sep')) }) : '' })
                  : '—'}
              </dd>
              <dt>{t('life.work')}</dt>
              <dd>
                {playing ? phaseLabel(life.career.phase, life.person.country, life.flags?.['cu.mlb'] !== undefined) : workText(life)}
                {!playing && life.after?.work?.company && !life.after.retired && <small className="kv-sub">{g(companyText(life.after.work.company))}</small>}
                {!playing && life.after?.work?.team && !life.after.work.company && !life.after.retired && <small className="kv-sub">{t('life.teamCompany', { name: g(life.after.work.team) })}</small>}
              </dd>
              {life.after && life.age >= 18 && (
                <>
                  <dt>{t('life.home')}</dt>
                  <dd>
                    {g(HOME_LABEL[life.after.home])}
                    {life.after.loan > 0 && <small className="kv-sub">{t('life.loan', { amount: yen(life.after.loan) })}</small>}
                  </dd>
                  <dt>{t('life.edu')}</dt>
                  <dd>{g(eduText(life))}</dd>
                  {life.schools?.hs && (
                    <>
                      <dt>{t('life.hs')}</dt>
                      <dd>
                        {g(life.schools.hs.name)}
                        <small className="kv-sub">
                          {t('life.hs.method', { method: g(METHOD_LABEL[life.schools.hs.method]) })}
                          {life.schools.hs.note ? `${t('life.sep')}${g(life.schools.hs.note)}` : ''}
                        </small>
                      </dd>
                    </>
                  )}
                  {life.schools?.univ && (
                    <>
                      <dt>{t('life.univ')}</dt>
                      <dd>
                        {g(life.schools.univ.name)}
                        <small className="kv-sub">
                          {life.schools.univ.course ? `${g(life.schools.univ.course)}${t('life.sep')}` : ''}
                          {g(METHOD_LABEL[life.schools.univ.method])}
                          {life.schools.univ.club ? `${t('life.sep')}${t(UNIV_CLUB_LABEL[life.schools.univ.club])}` : ''}
                          {life.schools.univ.league ? `${t('life.sep')}${g(life.schools.univ.league)}` : ''}
                        </small>
                      </dd>
                    </>
                  )}
                </>
              )}
              {languages.length > 1 || life.age >= 15 ? (
                <>
                  <dt>{t('life.lang')}</dt>
                  <dd>
                    {t('life.lang.main', { label: g(languages[0].label), band: g(languages[0].band) })}
                    {languages.length > 1 && (
                      <small className="kv-sub">{languages.slice(1).map((l) => t('life.lang.other', { label: g(l.label), level: l.level, band: g(l.band) })).join(t('life.sep'))}</small>
                    )}
                  </dd>
                  {life.person.heritage && (
                    <>
                      <dt>{t('life.heritage')}</dt>
                      <dd>{countryName(life.person.heritage)}</dd>
                    </>
                  )}
                </>
              ) : null}
              {life.after && life.after.baseballLife.length > 0 && (
                <>
                  <dt>{t('life.baseball')}</dt>
                  <dd>{life.after.baseballLife.map(g).join(t('life.sep'))}</dd>
                </>
              )}
            </dl>
          </section>

          <section className="panel">
            <h3>
              {t('life.map')} <span className="lbl">{t('life.map.lbl')}</span>
            </h3>
            <LifeMap life={life} />
          </section>

          <section className="panel curve">
            <h3>
              {t('life.curve')} <ModelBadge />
            </h3>
            <p className="small muted">{t('life.curve.desc')}</p>
            {cohort ? (
              <>
                <SurvivalCurve playingByAge={cohort.playingByAge} age={life.age} />
                {stillPlaying !== undefined && life.age >= 8 && (
                  <p className="small">{t('life.curve.now', { age: shownAge(life.age), p: Math.round(stillPlaying * 1000) / 10, n: num(cohort.nFull) })}</p>
                )}
              </>
            ) : (
              <p className="small muted">{t('life.curve.wait', { p: Math.round(cohortProgress * 100) })}</p>
            )}
          </section>

          {usedStats.length > 0 && (
            <section className="panel">
              <h3>{t('life.stats')}</h3>
              <ul className="feed">
                {usedStats.map((id) => {
                  const s = STATS[id]
                  const x = statText(s)
                  return (
                    <li key={id}>
                      <span className="a">{statAsOfShort(s)}</span>
                      <span className="x small">
                        {t('life.stats.item', { population: x.population, definition: x.definition })} <KindBadge stat={s} />
                      </span>
                    </li>
                  )
                })}
              </ul>
              <a className="small" href="#stats">
                {t('life.stats.all')}
              </a>
            </section>
          )}
        </div>
      </div>

      {shopOpen && <ShopSheet life={life} onChange={() => { r.save(); setFocusVersion((v) => v + 1) }} onClose={() => setShopOpen(false)} />}
      {r.stopped && <StopDialog life={life} stop={r.stopped} onGoOn={r.goOn} />}
      {r.decision && !r.minimized && !r.stopped && (
        <DecisionDialog
          life={life}
          decision={r.decision}
          onChoose={r.choose}
          onMinimize={() => r.setMinimized(true)}
          onAutoAll={() => {
            r.setAuto(true)
            r.choose(r.decision!.autoIndex)
          }}
          stillPlaying={stillPlaying}
        />
      )}
      {r.decision && r.minimized && <DecisionPeek decision={r.decision} onOpen={() => r.setMinimized(false)} />}
    </div>
  )
}

const UNIV_CLUB_LABEL = { club: 'univClub.club', circle: 'univClub.circle', none: 'univClub.none', returned: 'univClub.returned' } as const satisfies Record<string, Key>
const ROLE_LABEL = { none: '—', outside: 'role.outside', bench: 'role.bench', starter: 'role.starter' } as const
/** in pro the season model sets the role: 1軍 regular, 1軍 part-time, mostly 2軍 */
const PRO_ROLE_LABEL = { none: 'role.pro.farm', outside: 'role.pro.farm', bench: 'role.pro.first', starter: 'role.pro.starter' } as const satisfies Record<string, Key>
/** phases with a 志望届 or draft ahead, where the scouts' attention is shown */
const SCOUTED_PHASES: Phase[] = ['hs', 'univ', 'company', 'indep']

function roleText(life: LifeState): string {
  const b = life.bb!
  const ph = life.career.phase
  if (ph === 'abroad') return 'MLB'
  if (ph === 'proMinor') return t('role.ikusei')
  if (ph === 'pro') return t(PRO_ROLE_LABEL[b.role])
  const k = ROLE_LABEL[b.role]
  return k === '—' ? k : t(k)
}
const POST_LABEL: (Key | '')[] = ['', 'post.1', 'post.2', 'post.3', 'post.4']

/** the job line in 家族と暮らし: title, post, and whether it is regular work (the title is the game's) */
function workText(life: LifeState): string {
  const a = life.after
  if (!a) return g(life.job) || '—'
  if (a.retired) return t('work.retired')
  if (life.job === '大学生') return t('work.student')
  const w = a.work
  if (!w) return a.jobless > 0 ? t('work.seeking') : '—'
  // (a post is an employer's: his own shop or freelance work has none, though its level still sets the income: after.ts LEVEL)
  const post = w.employer !== 'self' && w.regular ? POST_LABEL[w.level] : undefined
  return `${g(w.title)}${post ? `${t('life.sep')}${t(post)}` : ''}${w.regular ? '' : t('work.irregular')}`
}

/** who he lives with */
function livingText(life: LifeState): string {
  if (life.family.spouse) return t('live.wife')
  if (life.age < 18) return life.family.father !== null && life.family.mother !== null ? t('live.parents') : t('live.family')
  // (the parents' home is where he was born: one who has moved away from it, to a club or a university far away, lives apart from them;
  // the household's money still counts him as at home: after.ts)
  if (life.after?.home === 'parents') return placeIndex(life) === life.person.prefecture ? t('live.home') : t('live.away')
  return t('live.alone')
}

/**
 * the squad of the latest announcement revealed this year: the year is computed at once, so the state already holds the autumn's
 * squad while the summer's line is on screen (feedback r11 A1: 「背番号1をもらいました」 beside another number)
 */
function shownRoster(life: LifeState): Roster | undefined {
  for (let i = life.log.length - 1; i >= 0; i--) {
    const e = life.log[i]
    if (e.age !== life.age) return undefined
    if (e.roster) return e.roster
  }
  return undefined
}

/** model values: skills relative to peers of the same age, body, form and the coach's view */
function AbilityPanel({ life: state }: { life: LifeState }) {
  const rs = shownRoster(state)
  const life: LifeState = rs ? { ...state, bb: { ...state.bb!, role: rs.role, number: rs.number } } : state
  const b = life.bb!
  const pos = life.person.position
  const keys = skillsFor(pos).filter((k) => k !== 'velocity')
  const pro = ['pro', 'proMinor', 'abroad'].includes(life.career.phase)
  const scout = b.scout !== undefined && SCOUTED_PHASES.includes(life.career.phase) ? b.scout : undefined
  return (
    <section className="panel abilitypanel" aria-label={t('life.ability')}>
      <h3>
        {t('life.ability')} <span className="lbl">{t('life.ability.lbl')}</span>
      </h3>
      <div className="ability-top">
        {pos === 'P' && (
          <div>
            <small>{t('life.velocity')}</small>
            <b className="num">{velocityKmh(life)}</b>
            <small>km/h</small>
          </div>
        )}
        <div>
          <small>{t('life.role')}</small>
          <b>{roleText(life)}</b>
          {b.number !== undefined && <small>{t('life.number', { n: b.number })}</small>}
          {b.role === 'bench' && !pro && b.subRole && <small>{g(subRoleLabel(life))}</small>}
        </div>
        <div>
          <small>{t('life.condition')}</small>
          <b>{g(conditionLabel(b))}</b>
        </div>
      </div>
      {keys.map((k) => (
        <StatRow key={k} label={g(SKILL_LABEL[k])} v={abilityScore(life, k)} color="var(--teal)" />
      ))}
      <StatRow label={t('life.fatigue')} v={b.fatigue} color="var(--warn)" />
      <StatRow label={t('life.confidence')} v={b.confidence} color="var(--gold)" />
      <StatRow label={t('life.coachEval')} v={b.coachEval} color="var(--accent)" />
      {scout !== undefined && <StatRow label={t('life.scout')} v={scout} color="var(--good)" />}
      <p className="stathelp">
        {t('life.ability.help')}
        {b.captain && t('life.captain', { role: b.captain === 'captain' ? t('life.captain.captain') : t('life.captain.vice') })}
        {scout !== undefined && t('life.scout.help', { label: g(scoutLabel(scout)) })}
      </p>
    </section>
  )
}

function StatRow({ label, v, color, muted }: { label: string; v: number; color: string; muted?: boolean }) {
  return (
    <div className="stat" style={muted ? { opacity: 0.5 } : undefined}>
      <span>{label}</span>
      <span className="bar">
        <i style={{ width: `${Math.max(0, Math.min(100, v))}%`, background: color }} />
      </span>
      <span className="v">{Math.round(v)}</span>
    </div>
  )
}

function MiniStat({ label, v, color, muted }: { label: string; v: number; color: string; muted?: boolean }) {
  return (
    <div style={muted ? { opacity: 0.5 } : undefined}>
      {label} <b className="num">{Math.round(v)}</b>
      <div className="bar">
        <i style={{ width: `${Math.max(0, Math.min(100, v))}%`, background: color }} />
      </div>
    </div>
  )
}
