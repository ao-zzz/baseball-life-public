import { STATS } from '../data/stats.ts'
import { LifeCounter } from './LifeCounter.tsx'
import { VersionInfo } from './VersionInfo.tsx'
import { COUNTRY_INFO, COUNTRY_ORDER, countryTitle, isCountryCode } from '../engine/countries/index.ts'
import type { LifeState, Mode, Pace } from '../engine/types.ts'
import type { PastLife, Settings } from '../game/persist.ts'
import { KindBadge } from './common.tsx'
import { pctText } from './format.ts'
import { fullName, prefName } from '../engine/life.ts'
import { shownAge } from '../engine/displayAge.ts'
import { INFO_PAGES } from '../data/site.ts'
import type { SharedBirth } from '../game/shareLink.ts'
import { LANG_NAME, PUBLIC_LANGS, dataDate, lang, num, pathIn, t, type Key } from '../i18n/index.ts'
import { Rich } from '../i18n/Rich.tsx'
import { countryChoice, countryName, placeName, regionWord } from '../i18n/places.ts'
import { gameText as g } from '../i18n/game.ts'

interface Props {
  settings: Settings
  onSettings: (s: Settings) => void
  onStart: () => void
  resume: LifeState | null
  onResume: () => void
  onDiscard: () => void
  past: PastLife[]
  onTheme: () => void
  /** a birth from a shared link */
  shared?: SharedBirth | null
  onShared?: () => void
  onDropShared?: () => void
}

// (the texts of this page are in src/i18n, by key)
const PACES: { id: Pace; label: Key }[] = [
  { id: 'p5', label: 'pace.p5' },
  { id: 'p15', label: 'pace.p15' },
  { id: 'p30', label: 'pace.p30' },
  { id: 'p60', label: 'pace.p60' },
  { id: 'instant', label: 'pace.instant' },
]

const MODES: { id: Mode; label: Key }[] = [
  { id: 'normal', label: 'mode.normal' },
  { id: 'potential', label: 'mode.potential' },
]

const FUNNEL: { id: string; label: Key }[] = [
  { id: 'jpJhsContinue', label: 'funnel.jpJhsContinue' },
  { id: 'jpHsJoin', label: 'funnel.jpHsJoin' },
  { id: 'jpHsComplete', label: 'funnel.jpHsComplete' },
  { id: 'jpHsFile', label: 'funnel.jpHsFile' },
  { id: 'jpHsDraftGivenFile', label: 'funnel.jpHsDraftGivenFile' },
  { id: 'jpShihaikaHs', label: 'funnel.jpShihaikaHs' },
]

const statsLink = <a href="#stats" />

function logWidth(p: number): number {
  return Math.max(2, Math.min(100, ((Math.log10(p) + 4) / 4) * 100))
}

export function Intro({ settings, onSettings, onStart, resume, onResume, onDiscard, past, onTheme, shared, onShared, onDropShared }: Props) {
  const hs = STATS.jpHsPlayers
  const country = settings.country ?? 'JP'
  const info = COUNTRY_INFO[country]
  return (
    <main className="intro">
      <div className="intro-top">
        {PUBLIC_LANGS.length > 1 &&
          PUBLIC_LANGS.filter((l) => l !== lang()).map((l) => (
            <a key={l} className="btn sm" href={pathIn(l)} lang={l} hrefLang={l}>
              {LANG_NAME[l]}
            </a>
          ))}
        <a className="btn sm" href="#stats">
          {t('intro.stats')}
        </a>
        <button type="button" className="btn sm" onClick={onTheme} aria-label={t('intro.theme')}>
          ◐
        </button>
      </div>
      <div className="intro-grid">
        <section>
          <p className="kicker">{t('intro.kicker')}</p>
          <h1 className="hero">
            <Rich k="intro.hero" tags={{ br: <br />, em: <em /> }} />
          </h1>
          <p className="lede">{t('intro.lede')}</p>
          <LifeCounter />
          <div className="denominator">
            <Rich k="intro.denominator" params={{ n: num(hs.value), asOf: dataDate(hs.asOf) }} tags={{ n: <b className="num" />, b: <b /> }} /> <KindBadge stat={hs} />
            <div className="small muted" style={{ marginTop: 4 }}>
              {t('intro.era')}
            </div>
          </div>

          {shared && (
            <div className="panel sharedbirth" style={{ marginBottom: 16 }}>
              <b>共有された生まれ</b>
              <p className="small">
                {shared.country ? `${countryTitle(shared.country)}・` : ''}
                {shared.prefecture !== undefined ? `${COUNTRY_INFO[shared.country ?? 'JP'].regions[shared.prefecture]}生まれ・` : '出生地も同じ・'}{shared.mode === 'potential' ? `ポテンシャルモード ★${shared.stars}` : '通常モード'}。同じ生まれから始めます。途中の選択しだいで、共有した人とは違う人生になります。
              </p>
              <div className="cta-row" style={{ margin: '8px 0 0' }}>
                <button type="button" className="btn primary" onClick={onShared}>
                  この生まれで始める
                </button>
                <button type="button" className="btn" onClick={onDropShared}>
                  自分の設定で遊ぶ
                </button>
              </div>
            </div>
          )}

          {resume && (
            <div className="panel" style={{ marginBottom: 16 }}>
              <b>{t('intro.resume')}</b>
              <p className="small muted">{t('intro.resume.who', { pref: placeName(prefName(resume)), age: shownAge(resume.age), name: g(fullName(resume)) })}</p>
              <div className="cta-row" style={{ margin: '8px 0 0' }}>
                <button type="button" className="btn primary" onClick={onResume}>
                  {t('intro.resume.go')}
                </button>
                <button type="button" className="btn" onClick={onDiscard}>
                  {t('intro.resume.drop')}
                </button>
              </div>
            </div>
          )}

          <div className="optgroup">
            <label className="lbl" htmlFor="country">
              {t('intro.country')}
            </label>
            <select
              id="country"
              value={country}
              onChange={(e) => {
                const c = e.target.value
                // (a place of birth of the old country means nothing in the new one)
                if (isCountryCode(c) && COUNTRY_INFO[c].implemented) onSettings({ ...settings, country: c, prefecture: -1 })
              }}
            >
              {COUNTRY_ORDER.map((c) => (
                <option key={c} value={c} disabled={!COUNTRY_INFO[c].implemented}>
                  {COUNTRY_INFO[c].implemented ? countryChoice(c) : t('intro.country.soon', { label: countryName(c) })}
                </option>
              ))}
            </select>
            <p className="hint">
              {t('intro.country.hint')}
              {country !== 'JP' && t('intro.country.hintOther')}
            </p>
          </div>

          <div className="optgroup">
            <span className="lbl">{t('intro.mode')}</span>
            <div className="seg modeseg" role="group" aria-label={t('intro.mode')}>
              {MODES.map((m) => (
                <button key={m.id} type="button" aria-pressed={(settings.mode ?? 'normal') === m.id} onClick={() => onSettings({ ...settings, mode: m.id })}>
                  {t(m.label)}
                </button>
              ))}
            </div>
            <div className={`modecard ${(settings.mode ?? 'normal') === 'potential' ? 'potential' : ''}`}>
              {(settings.mode ?? 'normal') === 'potential' ? (
                <>
                  <b>{t('mode.potential')}</b>
                  <p>{t('intro.mode.potential.body')}</p>
                  <p className="small muted">{t('intro.mode.potential.note')}</p>
                </>
              ) : (
                <>
                  <b>{t('mode.normal')}</b>
                  <p>{t('intro.mode.normal.body')}</p>
                </>
              )}
            </div>
          </div>
          <div className="optgroup">
            <span className="lbl">{t('intro.pace')}</span>
            <div className="seg" role="group" aria-label={t('intro.pace.aria')}>
              {PACES.map((p) => (
                <button key={p.id} type="button" aria-pressed={settings.pace === p.id} onClick={() => onSettings({ ...settings, pace: p.id })}>
                  {t(p.label)}
                </button>
              ))}
            </div>
            <p className="hint">{t('intro.pace.hint')}</p>
          </div>

          <div className="optgroup">
            <label className="lbl" htmlFor="pref">
              {t('intro.region', { region: regionWord(country) })}
            </label>
            <select id="pref" value={settings.prefecture} onChange={(e) => onSettings({ ...settings, prefecture: Number(e.target.value) })}>
              <option value={-1}>{country === 'JP' ? t('intro.region.anyJP') : t('intro.region.any')}</option>
              {info.regions.map((name, i) => (
                <option key={name} value={i}>
                  {placeName(name)}
                </option>
              ))}
            </select>
          </div>

          <div className="cta-row">
            <button type="button" className="btn primary cta" onClick={onStart}>
              {t('intro.start')}
            </button>
            <span className="small muted">{t('intro.start.note')}</span>
          </div>
        </section>

        {(country === 'KR' || country === 'CU') && (
          <aside className="panel funnel">
            <h2>{country === 'KR' ? t('intro.flow.KR') : t('intro.flow.CU')}</h2>
            <p className="small muted">{country === 'KR' ? t('intro.flow.KR.steps') : t('intro.flow.CU.steps')}</p>
            <p className="small muted" style={{ marginTop: 8 }}>
              <Rich k="intro.flow.league.note" tags={{ a: statsLink }} />
            </p>
          </aside>
        )}
        {country === 'US' && (
          <aside className="panel funnel">
            <h2>{t('intro.flow.US')}</h2>
            <p className="small muted">{t('intro.flow.US.steps')}</p>
            <p className="small muted" style={{ marginTop: 8 }}>
              <Rich k="intro.flow.US.note" tags={{ a: statsLink }} />
            </p>
          </aside>
        )}
        {country === 'JP' && (
        <aside className="panel funnel">
          <h2>{t('intro.funnel')}</h2>
          <p className="small muted">{t('intro.funnel.desc')}</p>
          <div className="rows">
            {FUNNEL.map((f) => {
              const s = STATS[f.id]
              return (
                <div className="row" key={f.id}>
                  <span>
                    {t(f.label)} <KindBadge stat={s} />
                  </span>
                  <span className="v num">{pctText(s.value)}</span>
                  <div className="bar">
                    <i style={{ width: `${logWidth(s.value)}%`, background: s.kind === 'assumption' ? 'var(--text-3)' : 'var(--teal)' }} />
                  </div>
                </div>
              )
            })}
          </div>
          <p className="small muted" style={{ marginTop: 12 }}>
            <Rich k="intro.funnel.note" tags={{ a: statsLink }} />
          </p>
        </aside>
        )}
      </div>

      {past.length > 0 && (
        <section className="past panel">
          <h3>{t('intro.past')}</h3>
          <ul>
            {past.slice(0, 10).map((p) => (
              <li key={p.seed}>
                <span>{t('intro.past.item', { name: g(p.name), pref: placeName(p.prefecture), age: shownAge(p.age) })}</span>
                <span className="muted">{g(p.highest)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="notes">
        <div>
          <h3>{t('intro.about')}</h3>
          <p>{t('intro.about.body')}</p>
        </div>
        <div>
          <h3>{t('intro.numbers')}</h3>
          <p>{t('intro.numbers.body')}</p>
        </div>
        <div>
          <h3>{t('intro.credits')}</h3>
          <p>
            <Rich k="intro.credits.body" tags={{ a: <a href="https://1in8b.life/" target="_blank" rel="noreferrer" /> }} />
          </p>
        </div>
      </section>

      <footer className="sitefoot">
        <nav aria-label={t('intro.site')}>
          {INFO_PAGES.map((p) => (
            <a key={p.id} href={`#${p.id}`}>
              {t(`info.${p.id}`)}
            </a>
          ))}
        </nav>
        <p className="small muted">{t('intro.foot')}</p>
        {/* the version and the update history (data/changelog.ts) */}
        <VersionInfo />
      </footer>

      <div className="sticky-cta">
        <button type="button" className="btn primary" onClick={onStart}>
          {t('intro.start')}
        </button>
      </div>
    </main>
  )
}
