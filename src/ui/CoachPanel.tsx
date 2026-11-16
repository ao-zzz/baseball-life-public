import type { CoachSeason, LifeState } from '../engine/types.ts'
import { shownAge } from '../engine/displayAge.ts'
import { t, type Key } from '../i18n/index.ts'
import { Panel } from './Panel.tsx'

// The teams he led after playing (engine/coaching.ts): one row a season, and the line of the result screen. Read from the life's
// record (LifeState.coaching); every figure is the game's.

/** how far a tournament went, by the wins: a prefecture's summer, summer Koshien, or a national tournament of about 32 teams */
const round = (kind: 'pref' | 'koshien' | 'five', wins: number) => t(`coach.round.${kind}.${wins}` as Key)

function seasonWords(x: CoachSeason): string {
  switch (x.level) {
    case 'pro': {
      const base = t('coach.row.pro', { finish: x.finish ?? 0, w: x.w ?? 0, l: x.l ?? 0, d: x.d ?? 0 })
      const more = x.result === 'champion' ? t('coach.row.champion') : x.result === 'series' ? t('coach.row.series') : ''
      return base + more
    }
    case 'hs': {
      const spring = x.spring !== undefined ? t('coach.row.spring', { round: round('five', x.spring) }) : ''
      const summer = x.result === 'koshien' ? t('coach.row.koshien', { round: round('koshien', x.wins ?? 0) }) : t('coach.row.pref', { round: round('pref', x.wins ?? 0) })
      return spring + summer
    }
    case 'univ':
      return x.finish === 1 ? t('coach.row.univWin', { round: round('five', x.wins ?? 0) }) : t('coach.row.univ', { finish: x.finish ?? 0 })
    case 'corp':
      return x.result === 'toshi' ? t('coach.row.toshi', { round: round('five', x.wins ?? 0) }) : t('coach.row.corp')
  }
}

/** one row a season of the teams he managed */
export function CoachYears({ life, fold }: { life: LifeState; fold?: boolean }) {
  const seasons = life.coaching?.seasons ?? []
  if (!seasons.length) return null
  return (
    <Panel fold={fold} className="coachyears" title={<>{t('panel.coachYears')} <span className="lbl">{t('panel.gameRecord')}</span></>}>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>{t('col.age')}</th>
              <th>{t('coach.col.team')}</th>
              <th>{t('coach.col.result')}</th>
            </tr>
          </thead>
          <tbody>
            {seasons.map((x) => (
              <tr key={`${x.age}-${x.level}`}>
                <td title={t('pro.year', { year: life.person.birthYear + x.age })}>{t('life.ageAt', { n: shownAge(x.age) })}</td>
                <td>{t(`coach.level.${x.level}` as Key)}</td>
                <td>{seasonWords(x)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">{t('coach.note')}</p>
    </Panel>
  )
}
