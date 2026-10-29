import type { LifeState } from '../engine/types.ts'
import { shownAge } from '../engine/displayAge.ts'
import { PATTERN_LABEL, PATTERN_TEXT, potentialView, rangeText, retrospective } from '../engine/potential.ts'
import { ModelBadge } from './common.tsx'
import { Panel } from './Panel.tsx'
import { starMarks } from '../data/potentialStars.ts'
import { starOf } from '../engine/potential.ts'
import { highestLabel } from '../engine/summary.ts'
import { t, type Key } from '../i18n/index.ts'
import { starInfo } from '../i18n/places.ts'
import { gameText as g } from '../i18n/game.ts'

// The potential mode's panels (PROJECT_PLAN §11.20): the talent as far as it is known during the life, and the look back
// at the end. What is not yet known is shown as a range of stars that narrows with experience, never as a number.

const TREND_WORD = { 順調: 'pot.trend.good', ふつう: 'pot.trend.normal', 停滞: 'pot.trend.stall', '—': 'pot.unknown' } as const

/** whether the talent was used, as the screens show it (the game's words, engine/potential.ts retrospective; others as they are) */
const USED_KEY: Record<string, Key> = { 生かせた: 'retro.used.full', 一部だけ生かせた: 'retro.used.part', 生かせなかった: 'retro.used.none' }

export function ModeBadge({ life }: { life: LifeState }) {
  return life.pot ? <span className="modebadge potential">{t('mode.badge', { n: starOf(life.pot.stars) })}</span> : null
}

/** the talent as it is known so far (during the life) */
export function PotentialPanel({ life }: { life: LifeState }) {
  const v = potentialView(life)
  if (!v) return null
  const rows: [string, string][] = [
    [t('pot.chosen'), `★${v.chosen}`],
    [t('pot.ath'), g(rangeText(v.ath))],
    [t('pot.mind'), g(rangeText(v.mind))],
    [t('pot.soc'), g(rangeText(v.soc))],
  ]
  return (
    <section className="panel potpanel" aria-label={t('panel.potential')}>
      <h3>
        {t('panel.potential')} <span className="lbl">{t('mode.potential')}</span>
      </h3>
      <dl className="potrows">
        {rows.map(([k, x]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd className="num">{x}</dd>
          </div>
        ))}
        <div>
          <dt>{t('pot.pattern')}</dt>
          <dd>{v.pattern ? g(PATTERN_LABEL[v.pattern]) : t('pot.unknown')}</dd>
        </div>
        <div>
          <dt>{t('pot.trend')}</dt>
          <dd>{t(TREND_WORD[v.trend])}</dd>
        </div>
        {v.known >= 0.5 && (
          <div>
            <dt>{t('pot.dev')}</dt>
            <dd>
              <span className="bar" aria-label={t('pot.dev.aria', { p: Math.round(v.dev * 10) * 10 })}>
                <i style={{ width: `${Math.round(v.dev * 10) * 10}%`, background: 'var(--teal)' }} />
              </span>
            </dd>
          </div>
        )}
      </dl>
      <p className="stathelp">
        {t('pot.help')}
        {v.pattern && t('pot.seems', { label: g(PATTERN_LABEL[v.pattern]), text: g(PATTERN_TEXT[v.pattern]) })}
      </p>
    </section>
  )
}

/** the look back at the end of a life */
export function PotentialRetro({ life, fold }: { life: LifeState; fold?: boolean }) {
  const r = retrospective(life)
  if (!r) return null
  const ys = r.years
  const w = 320
  const h = 90
  const ages = ys.map((y) => y.age)
  const lo = Math.min(...ys.map((y) => y.z), 0) - 0.2
  const hi = Math.max(...ys.map((y) => y.z), 0.5) + 0.2
  const x = (a: number) => (ages.length > 1 ? ((a - ages[0]) / (ages[ages.length - 1] - ages[0])) * (w - 20) + 10 : w / 2)
  const y = (z: number) => h - 8 - ((z - lo) / (hi - lo)) * (h - 16)
  const line = ys.map((p) => `${x(p.age).toFixed(1)},${y(p.z).toFixed(1)}`).join(' ')
  return (
    <Panel fold={fold} className="potretro" title={<>{t('retro.title')} <ModelBadge /></>}>
      <div className="potgrid">
        <div>
          <small>{t('pot.chosen')}</small>
          <b className="num">★{r.chosen}</b>
          <small>{starInfo(r.chosen)?.title}</small>
        </div>
        <div>
          <small>{t('retro.born')}</small>
          <b className="num">☆{r.stars}</b>
          <small>{g(PATTERN_LABEL[r.pattern])}</small>
        </div>
        <div>
          <small>{t('retro.dev')}</small>
          <b className="num">{Math.round(r.dev * 100)}%</b>
          <small>{t('retro.dev.sub')}</small>
        </div>
        <div>
          <small>{t('retro.used')}</small>
          <b>{USED_KEY[r.used] ? t(USED_KEY[r.used]) : g(r.used)}</b>
          <small>{t('retro.used.sub')}</small>
        </div>
        <div>
          <small>{t('retro.start')}</small>
          <b className="num">{r.startStanding}</b>
          <small>{t('retro.start.sub')}</small>
        </div>
        <div>
          <small>{t('retro.peak')}</small>
          <b className="num">{r.peakStanding}</b>
          <small>{t('retro.final', { n: r.finalStanding })}</small>
        </div>
        <div className="potpath">
          <small>{t('retro.path')}</small>
          <b>{g(highestLabel(life))}</b>
          <small aria-hidden="true">{starMarks(r.chosen)}</small>
        </div>
      </div>
      {ys.length > 1 && (
        <svg className="potline" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={t('retro.aria')}>
          <line x1="10" x2={w - 10} y1={y(0)} y2={y(0)} stroke="var(--text-3)" strokeDasharray="3 3" strokeWidth="1" />
          <polyline points={line} fill="none" stroke="var(--teal)" strokeWidth="2" />
          <text x="10" y="12" fontSize="10" fill="var(--text-3)">
            {t('retro.age', { n: shownAge(ages[0]) })}
          </text>
          <text x={w - 10} y="12" fontSize="10" fill="var(--text-3)" textAnchor="end">
            {t('retro.age', { n: shownAge(ages[ages.length - 1]) })}
          </text>
        </svg>
      )}
      <ul className="potnotes">
        {r.notes.map((n) => (
          <li key={n}>{g(n)}</li>
        ))}
      </ul>
      <p className="small muted">{t('retro.note')}</p>
    </Panel>
  )
}
