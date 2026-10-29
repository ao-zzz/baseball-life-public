import type { LifeState } from '../engine/types.ts'
import { PREFECTURES } from '../data/jp.ts'
import { STATS } from '../data/stats.ts'
import { COUNTRY_INFO } from '../engine/countries/index.ts'
import { fullName, prefName } from '../engine/life.ts'
import { FactBox, KindBadge } from './common.tsx'
import { secondsPerYear } from '../game/useLifeRunner.ts'
import { ModeBadge } from './PotentialPanels.tsx'
import { starOf } from '../engine/potential.ts'
import { t, type Key } from '../i18n/index.ts'
import { countryName, placeName, starInfo } from '../i18n/places.ts'
import { gameText as g } from '../i18n/game.ts'

// (the texts are in src/i18n; the place of birth is the game's name, shown through src/i18n/places.ts)
const PARENT: Record<LifeState['person']['parentBaseball'], Key> = {
  none: 'parent.none',
  hs: 'parent.hs',
  univ: 'parent.univ',
  company: 'parent.company',
}

export function Cert({ life, onBegin, onCancel }: { life: LifeState; onBegin: () => void; onCancel: () => void }) {
  const p = life.person
  const jp = p.country === 'JP'
  const info = COUNTRY_INFO[p.country]
  const pref = PREFECTURES[p.prefecture]
  const lifeStat = STATS[info.lifeBirthStatId]
  const spy = secondsPerYear(life.config.pace)
  const minutes = Math.round((lifeStat.value * spy) / 60)
  const teamsMeasured = jp && pref.teamsKind === 'measured'
  const place = placeName(prefName(life))
  return (
    <main className="cert-wrap">
      <article className="doc">
        <div className="band">
          <b>{t('cert.title')}</b>
          <span className="no">No. {p.country}-{p.birthYear}-{String(life.config.seed % 1000000).padStart(6, '0')}</span>
        </div>
        <div className="body">
          <p className="small muted">{t('cert.name')}</p>
          <p className="name">{g(fullName(life))}</p>
          <ModeBadge life={life} />
          {life.pot && <p className="small potnote">{t('cert.pot', { n: starOf(life.pot.stars), title: starInfo(starOf(life.pot.stars)).title })}</p>}
          <p className="story">{t('cert.story', { year: p.birthYear, month: p.birthMonth, place, w: p.wealth })}</p>
          <p className="small muted" style={{ marginBottom: 12 }}>
            {life.config.pace === 'instant' ? t('cert.instant') : t('cert.time', { min: minutes, sec: Math.round(spy * 10) / 10 })}
          </p>
          <dl className="fields">
            <div>
              <dt>{t('cert.born')}</dt>
              <dd>{t('cert.born.value', { year: p.birthYear, month: p.birthMonth })}</dd>
            </div>
            <div>
              <dt>{t('cert.place')}</dt>
              <dd>{place}</dd>
            </div>
            <div>
              <dt>{t('cert.wealth')}</dt>
              <dd>
                {'●'.repeat(p.wealth)}
                {'○'.repeat(5 - p.wealth)}
                {t('cert.wealth.value', { w: p.wealth })}
                <small>{t('cert.model')}</small>
              </dd>
            </div>
            <div>
              <dt>{t('cert.hand')}</dt>
              <dd>{p.throws === 'L' ? t('cert.hand.L') : t('cert.hand.R')}</dd>
            </div>
            <div>
              <dt>{t('cert.parent')}</dt>
              <dd>{t(PARENT[p.parentBaseball])}</dd>
            </div>
            <div>
              <dt>{t('cert.height')}</dt>
              <dd>
                {t('cert.height.value', { cm: p.heightCm })}
                <small>{t('cert.model')}</small>
              </dd>
            </div>
            {jp && (
              <div>
                <dt>{t('cert.teams')}</dt>
                <dd>
                  {teamsMeasured ? t('cert.teams.measured', { n: pref.teams }) : t('cert.teams.about', { n: Math.round(pref.teams) })}{' '}
                  <small>
                    {teamsMeasured ? t('cert.teams.src.measured') : t('cert.teams.src.other')}{' '}
                    <KindBadge stat={teamsMeasured ? (pref.name === '愛知県' ? STATS.jpTeamsAichi : STATS.jpTeamsTottori) : STATS.jpPrefTeamsOther} />
                  </small>
                </dd>
              </div>
            )}
            <div>
              <dt>{t('cert.life', { country: countryName(p.country) })}</dt>
              <dd>
                {t('cert.life.value', { n: lifeStat.value })}{' '}
                <small>
                  {jp ? t('cert.life.src.JP') : p.country === 'US' ? t('cert.life.src.US') : t('cert.life.src.other')} <KindBadge stat={lifeStat} />
                </small>
              </dd>
            </div>
            <div>
              <dt>{t('cert.cohort')}</dt>
              <dd>
                {t('cert.cohort.value', { country: countryName(p.country) })}
                <small>{t('cert.cohort.note')}</small>
              </dd>
            </div>
          </dl>
          {jp ? (
            <FactBox text={t('cert.fact.JP')} ids={['jpTeamsTotal', 'jpTeamsAichi', 'jpTeamsTottori']} />
          ) : p.country === 'KR' || p.country === 'CU' ? (
            <FactBox text={t('cert.fact.league', { country: countryName(p.country) })} ids={[p.country === 'KR' ? 'krModel' : 'cuModel']} />
          ) : (
            <FactBox text={t('cert.fact.US')} ids={['usDraftRounds', 'usModel']} />
          )}
          <p className="small muted" style={{ marginTop: 10 }}>
            {t('cert.fiction')}
          </p>
          <div className="doc-actions fixed">
            <button type="button" className="btn" onClick={onCancel}>
              {t('cert.cancel')}
            </button>
            <button type="button" className="btn primary lg" onClick={onBegin}>
              {t('cert.begin')}
            </button>
          </div>
        </div>
      </article>
    </main>
  )
}
