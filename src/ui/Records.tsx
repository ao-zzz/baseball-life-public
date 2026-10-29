import type { Level, LifeState, StatLine } from '../engine/types.ts'
import { shownAge } from '../engine/displayAge.ts'
import { avg, era, hsCareerHr } from '../engine/games.ts'
import { t, type Key } from '../i18n/index.ts'
import { Rich } from '../i18n/Rich.tsx'
import { gameText as g } from '../i18n/game.ts'

// The player's own in-game record (PROJECT_PLAN §11.2, stages 3–4): official games and practice games
// kept apart, the pro 1軍 and 2軍 kept apart, with the definition of 高校通算本塁打 next to the number.

const LEVEL_LABEL: Record<Level, Key> = { jhs: 'rec.level.jhs', hs: 'rec.level.hs', univ: 'rec.level.univ', amateur: 'rec.level.amateur', farm: 'rec.level.farm', pro: 'rec.level.pro', mlb: 'rec.level.mlb' }
const LEVELS: Level[] = ['hs', 'univ', 'amateur', 'farm', 'pro', 'mlb']

const innings = (l: StatLine) => `${Math.floor(l.outs / 3)}${l.outs % 3 ? `.${l.outs % 3}` : ''}`

export function RecordsPanel({ life, tournaments = 3 }: { life: LifeState; tournaments?: number }) {
  const rec = life.bb?.rec
  if (!rec) return null
  const rows = LEVELS.flatMap((l) => (['official', 'practice'] as const).filter((k) => rec[k][l]?.games).map((k) => ({ l, k, line: rec[k][l]! })))
  if (rows.length === 0) return null
  // batting and pitching columns as the record has them (a pitcher bats in high school; a player may change position)
  const batting = rows.some((r) => r.line.pa > 0)
  const pitching = rows.some((r) => r.line.outs > 0)
  const cols: { label: string; v: (l: StatLine) => string | number }[] = [{ label: t('col.g'), v: (l) => l.games }]
  if (batting) cols.push({ label: t('col.avg'), v: avg }, { label: t('col.hr'), v: (l) => l.hr })
  if (batting && !pitching) cols.push({ label: t('col.rbi'), v: (l) => l.rbi })
  if (pitching) cols.push({ label: t('col.ip'), v: innings }, { label: t('col.era'), v: era })
  if (pitching && !batting) cols.push({ label: t('col.so'), v: (l) => l.k })
  const hr = hsCareerHr(life)
  const recent = rec.tournaments.slice(-tournaments).reverse()
  return (
    <section className="panel recpanel" aria-label={t('panel.records')}>
      <h3>
        {t('panel.records')} <span className="lbl">{t('panel.gameRecord')}</span>
      </h3>
      <div className="rec-scroll">
        <table className="rec">
          <thead>
            <tr>
              <th scope="col" />
              {cols.map((c) => (
                <th key={c.label} scope="col">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ l, k, line }) => (
              <tr key={`${l}.${k}`}>
                <th scope="row">
                  {t(LEVEL_LABEL[l])}
                  <small>{k === 'official' ? t('rec.official') : t('rec.practice')}</small>
                </th>
                {cols.map((c) => (
                  <td key={c.label}>{c.v(line)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hr > 0 && (
        <p className="rec-hr">
          <Rich k="rec.hsHr" params={{ n: hr }} tags={{ b: <b className="num" /> }} />
        </p>
      )}
      {recent.length > 0 && (
        <ul className="feed rec-tournaments">
          {recent.map((x, i) => (
            <li key={i}>
              <span className="a">{t('life.ageAt', { n: shownAge(x.age) })}</span>
              <span className="x small">
                {t('rec.tournament', { name: g(x.name), result: g(x.result) })}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="stathelp">{t('rec.help')}</p>
    </section>
  )
}
