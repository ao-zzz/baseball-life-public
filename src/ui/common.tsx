import { STATS } from '../data/stats.ts'
import { SOURCES } from '../data/sources.ts'
import type { Stat } from '../data/types.ts'
import { statusOf } from './statStatus.ts'
import { listSep, t, type Key } from '../i18n/index.ts'
import { sourceText, statText } from '../i18n/statsEn.ts'

const KIND_LABEL: Record<Stat['kind'], Key> = { measured: 'kind.measured', estimate: 'kind.estimate', assumption: 'kind.assumption' }

/** the publisher of a source in the language now (none when the source is not known) */
const publisherOf = (id: string): string | undefined => (SOURCES[id] ? sourceText(SOURCES[id]).publisher : undefined)

export function KindBadge({ stat }: { stat: Stat }) {
  const st = statusOf(stat)
  const note = statText(stat).verifyNote
  return (
    <>
      <span className={`badge ${stat.kind}`}>{t(KIND_LABEL[stat.kind])}</span>
      {st === 'unverified' && (
        <span className="badge recheck" title={note ?? t('kind.unverified.title')}>
          {t('kind.unverified')}
        </span>
      )}
      {st === 'reference' && (
        <span className="badge reference" title={note ?? t('kind.reference.title')}>
          {t('kind.reference')}
        </span>
      )}
    </>
  )
}

export function ModelBadge() {
  return <span className="badge model">{t('kind.model')}</span>
}

/** "資料" row under a log line: which statistic stands behind it. */
export function SourceLine({ ids }: { ids: string[] }) {
  const stats = ids.map((id) => STATS[id]).filter(Boolean)
  if (stats.length === 0) return null
  const s = stats[0]
  const x = statText(s)
  const src = s.sourceIds.map(publisherOf).filter(Boolean)
  return (
    <span className="src">
      <b>{t('source.label')}</b>
      {t('source.line', { population: x.population, definition: x.definition, asOf: x.asOf })}
      {src.length ? ` — ${src.join(listSep())}` : t('source.none')} <KindBadge stat={s} />
    </span>
  )
}

export function FactBox({ text, ids }: { text: string; ids?: string[] }) {
  const stats = (ids ?? []).map((id) => STATS[id]).filter(Boolean)
  const kinds = [...new Set(stats.map((s) => s.kind))]
  const recheck = stats.some((s) => statusOf(s) === 'unverified')
  const reference = stats.find((s) => statusOf(s) === 'reference')
  const pubs = [...new Set(stats.flatMap((s) => s.sourceIds.map(publisherOf)).filter(Boolean))]
  return (
    <div className="fact">
      {text}
      {stats.length > 0 && (
        <div className="small muted" style={{ marginTop: 4 }}>
          {pubs.length ? t('fact.sources', { list: pubs.join(listSep()) }) : t('fact.noSource')}{' '}
          {kinds.map((k) => (
            <span key={k} className={`badge ${k}`}>
              {t(KIND_LABEL[k])}
            </span>
          ))}{' '}
          {recheck && (
            <span className="badge recheck" title={stats.map(statText).find((x, i) => statusOf(stats[i]) === 'unverified' && x.verifyNote)?.verifyNote ?? t('kind.unverified.title')}>
              {t('kind.unverified')}
            </span>
          )}
          {reference && (
            <span className="badge reference" title={statText(reference).verifyNote ?? t('kind.reference.title')}>
              {t('kind.reference')}
            </span>
          )}
          {reference && <span className="small muted">{t('fact.reference')}</span>}
        </div>
      )}
    </div>
  )
}

/** A simple player silhouette (own drawing). */
export function Portrait({ cap }: { cap?: boolean }) {
  return (
    <svg viewBox="0 0 64 80" width="64" height="80" aria-hidden="true">
      <rect width="64" height="80" fill="var(--surface-2)" />
      <circle cx="32" cy="30" r="12" fill="var(--text-3)" />
      {cap && <path d="M19 27 Q32 12 45 27 L52 28 L45 30 Z" fill="var(--accent)" />}
      <path d="M10 80 Q12 52 32 50 Q52 52 54 80 Z" fill="var(--text-3)" />
    </svg>
  )
}
