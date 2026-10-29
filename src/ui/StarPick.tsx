import { STAR_TRIALS, STAR_TRIALS_N, starMarks } from '../data/potentialStars.ts'
import { num, t } from '../i18n/index.ts'
import { starInfo } from '../i18n/places.ts'

// The choice of ★ before a potential-mode life (PROJECT_PLAN §11.21). Words only: a higher ★ makes a rarer talent, never a promise.
// (the texts are in src/i18n; the words of each ★ in data/potentialStars.ts, and in English in src/i18n/places.ts)

const pct = (p: number) => (p < 0.001 ? t('pct.under') : p < 0.1 ? t('pct.about', { p: (Math.round(p * 1000) / 10).toFixed(1) }) : t('pct.about', { p: Math.round(p * 100) }))

interface Props {
  stars: number
  onStars: (n: number) => void
  onBegin: () => void
  onBack: () => void
}

export function StarPick({ stars, onStars, onBegin, onBack }: Props) {
  const info = starInfo(stars)
  const trial = STAR_TRIALS[stars]
  return (
    <main className="starpick">
      <div className="intro-top">
        <button type="button" className="btn sm" onClick={onBack}>
          {t('star.back')}
        </button>
      </div>
      <p className="kicker">{t('mode.potential')}</p>
      <h1 className="starhead">{t('star.head')}</h1>
      <p className="lede">{t('star.lede')}</p>
      <div className="starnote">
        <b>{t('star.changes')}</b>
        <p>{t('star.changes.what')}</p>
        <p>{t('star.changes.promise')}</p>
      </div>

      <div className="starlist" role="radiogroup" aria-label={t('star.aria')}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button key={n} type="button" role="radio" aria-checked={stars === n} aria-pressed={stars === n} className={`starrow ${stars === n ? 'on' : ''}`} onClick={() => onStars(n)}>
            <span className="marks" aria-hidden="true">
              {starMarks(n)}
            </span>
            <span className="num">★{n}</span>
            <b>{starInfo(n).title}</b>
            <small>{starInfo(n).text}</small>
          </button>
        ))}
      </div>

      <section className="panel starsel" aria-live="polite">
        <h3>
          ★{stars} {info.title}
        </h3>
        <p>{info.text}</p>
        {trial && <p className="small muted">{t('star.trials', { n: num(STAR_TRIALS_N), r5: pct(trial.r5), r6: pct(trial.r6), r8: pct(trial.r8), r10: pct(trial.r10) })}</p>}
        <p className="small muted">{t('star.foreign')}</p>
      </section>

      <div className="cta-row">
        <button type="button" className="btn primary cta" onClick={onBegin}>
          {t('star.begin', { n: stars })}
        </button>
      </div>
    </main>
  )
}
