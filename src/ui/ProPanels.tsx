import type { LifeEntryStop, LifeState, StatLine } from '../engine/types.ts'
import { YEN_PER_DOLLAR, usdToMan } from '../engine/contract.ts'
import { isPlaying } from '../engine/life.ts'
import { shownAge } from '../engine/displayAge.ts'
import { yen } from './format.ts'
import { lang, num, t, type Key } from '../i18n/index.ts'
import { currencyOf } from '../i18n/currency.ts'
import { Panel } from './Panel.tsx'
import { gameText as g } from '../i18n/game.ts'

// The draft screen, the screen at the end of a playing career, the money bar and the year-by-year pro record (PROJECT_PLAN §11.23).
// Everything shown here is read from the life's state: the draft record, the pay by year, the household's money, the season lines.

const KIND = { shihaika: 'draft.kind.shihaika', ikusei: 'draft.kind.ikusei' } as const

/** where he was drafted from, as the screens show it (the game's words: 高校, 大学, 社会人, 独立リーグ; others as they are) */
const FROM_KEY: Record<string, Key> = { 高校: 'draft.from.hs', 大学: 'draft.from.univ', 社会人: 'draft.from.company', 独立リーグ: 'draft.from.indep' }
const fromWord = (w: string) => (FROM_KEY[w] ? t(FROM_KEY[w]) : g(w))

/** the screen stops on a draft or on the end of the playing career */
export function StopDialog({ life, stop, onGoOn }: { life: LifeState; stop: LifeEntryStop; onGoOn: () => void }) {
  if (stop.kind === 'draft') return <DraftDialog life={life} onGoOn={onGoOn} />
  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-labelledby="stop-title">
      <div className="dialog">
        <div className="hd">
          <span>{t('stop.band')}</span>
          <span className="when">{t('dec.when', { age: shownAge(life.age), year: life.year })}</span>
        </div>
        <div className="bd">
          <h2 id="stop-title">{t('stop.title')}</h2>
          <p className="body">{g(stop.entry.text)}</p>
          <p className="small muted">{t('stop.body')}</p>
          <div className="choices">
            <button type="button" onClick={onGoOn}>
              <span className="k">1</span>
              <span>
                <b>{t('stop.go')}</b>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function DraftDialog({ life, onGoOn }: { life: LifeState; onGoOn: () => void }) {
  const d = life.career.draft
  if (!d) {
    return (
      <div className="scrim" role="dialog" aria-modal="true">
        <div className="dialog">
          <div className="bd">
            <button type="button" className="btn primary" onClick={onGoOn}>
              {t('draft.continue')}
            </button>
          </div>
        </div>
      </div>
    )
  }
  const signed = d.status === 'signed'
  const rows: [string, string][] = [
    [t('draft.team'), g(d.team)],
    [t('draft.kind'), t('draft.kind.value', { kind: t(KIND[d.kind]), from: fromWord(d.from) })],
    [
      t('draft.pick'),
      d.kind === 'shihaika' ? t('draft.pick.shihaika', { round: d.round, overall: d.overall, clubOrder: d.clubOrder }) : t('draft.pick.ikusei', { round: d.round, overall: d.overall }),
    ],
    [d.kind === 'ikusei' ? t('draft.prep') : t('draft.bonus'), yen(d.bonus)],
    ...(d.incentive ? ([[t('draft.incentive'), t('draft.incentive.value', { amount: yen(d.incentive) })]] as [string, string][]) : []),
    [t('draft.salary'), yen(d.salary)],
    [t('draft.number'), signed && d.number !== undefined ? String(d.number) : t('draft.number.later')],
    [t('draft.ability'), t('draft.ability.value', { ability: d.ability })],
    ...(d.record ? ([[t('draft.record'), g(d.record)]] as [string, string][]) : []),
    [t('draft.reason'), g(d.reason)],
  ]
  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-labelledby="draft-title">
      <div className="dialog draftdlg">
        <div className="hd">
          <span>{t('draft.band')}</span>
          <span className="when">{t('draft.when', { year: d.year, age: shownAge(d.age) })}</span>
        </div>
        <div className="bd">
          <h2 id="draft-title">{t('draft.title', { team: g(d.team), pick: d.kind === 'shihaika' ? t('share.pick', { n: d.round }) : t('share.pick.ikusei', { n: d.round }) })}</h2>
          <dl className="draftrows">
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <p className="small muted">
            {signed ? t('draft.signed') : d.status === 'declined' ? t('draft.declined') : t('draft.pending')}
            {t('draft.note')}
          </p>
          <div className="choices">
            <button type="button" onClick={onGoOn}>
              <span className="k">1</span>
              <span>
                <b>{signed ? t('draft.go.signed') : t('draft.go')}</b>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** the money he has and earns, always in view: pay while a pro, the household's income and savings at other times */
export function MoneyBar({ life, onShop, shopOff }: { life: LifeState; onShop?: () => void; shopOff?: boolean }) {
  const c = life.career
  const pro = isPlaying(life) && ['pro', 'proMinor', 'abroad'].includes(c.phase)
  const lastPay = c.salaryHist?.at(-1)
  const minor = life.age < 18
  return (
    <div className="moneybar" aria-label={t('money')}>
      {pro ? (
        <>
          <span>
            {!c.salary && c.nextSalary ? t('money.next') : t('money.salary')}
            <b className="num">{yen(!c.salary && c.nextSalary ? c.nextSalary : c.salary)}</b>
            {/* (the contract's dollars beside the pay: not when the screen already shows dollars) */}
            {lastPay?.usd && currencyOf(lang()).code !== 'USD' ? <small>{t('money.usd', { usd: lang() === 'en' ? num(Math.round(lastPay.usd)) : (lastPay.usd / 10000).toFixed(0), rate: YEN_PER_DOLLAR })}</small> : null}
          </span>
          <span>
            {t('money.income')}
            <b className="num">{life.income ? yen(life.income) : '—'}</b>
          </span>
        </>
      ) : (
        <span>
          {minor ? t('money.household') : t('money.annual')}
          <b className="num">{minor ? t('money.wealth', { w: life.person.wealth }) : life.income ? yen(life.income) : '—'}</b>
        </span>
      )}
      <span>
        {t('money.savings')}
        <b className="num">{minor ? '—' : yen(life.money)}</b>
      </span>
      {onShop && !minor && (
        <button type="button" className="btn primary shopbtn" disabled={shopOff} onClick={onShop}>
          <span className="shopico" aria-hidden="true">
            {currencyOf(lang()).symbol}
          </span>
          {t('money.shop')}
        </button>
      )}
      {c.usDraft?.status === 'signed' && pro && (
        <span className="muted">
          {currencyOf(lang()).code === 'USD'
            ? t('money.bonus', { amount: yen(usdToMan(c.usDraft.bonusUsd)) })
            : t('money.usBonus', { amount: yen(usdToMan(c.usDraft.bonusUsd)), usd: lang() === 'en' ? num(Math.round(c.usDraft.bonusUsd)) : Math.round(c.usDraft.bonusUsd / 10000).toLocaleString() })}
        </span>
      )}
      {c.draft?.status === 'signed' && pro && (
        <span className="muted">{c.draft.kind === 'ikusei' ? t('money.prep', { amount: yen(c.draft.bonus) }) : t('money.bonus', { amount: yen(c.draft.bonus) })}</span>
      )}
    </div>
  )
}

const avg = (l: StatLine) => (l.ab ? (l.h / l.ab).toFixed(3).replace(/^0/, '') : '—')
const era = (l: StatLine) => (l.outs ? ((l.er * 27) / l.outs).toFixed(2) : '—')
const ip = (l: StatLine) => `${Math.floor(l.outs / 3)}${l.outs % 3 ? `.${l.outs % 3}` : ''}`
const LEVEL = { pro: '1軍', farm: '2軍' } as const
const LEVEL_US = { pro: 'MLB', farm: 'マイナー' } as const

/** a level's word as the screens show it (the game's words: 1軍, a league's own; others as they are) */
const LEVEL_KEY: Record<string, Key> = { '1軍': 'lv.first', '2軍': 'lv.second', マイナー: 'lv.minor', 'セリエ・ナシオナル': 'lv.serie', 州の控え: 'lv.provReserve' }
const levelWord = (w: string) => (LEVEL_KEY[w] ? t(LEVEL_KEY[w]) : g(w))

/** the level of a season row: the name it was recorded with (「1軍のシーズン」, 「MLBのシーズン」, a league's own), else the table's */
const rowLevel = (t: { name: string; level?: string }, LV: Record<'pro' | 'farm', string>) =>
  t.level === 'mlb' ? 'MLB' : t.name.endsWith('のシーズン') ? t.name.slice(0, -'のシーズン'.length) : LV[t.level as 'pro' | 'farm']

/** every pro season he played, by year and level, with the team and the pay; a Japanese player's MLB years too (level 'mlb') */
export function ProYears({ life, fold }: { life: LifeState; fold?: boolean }) {
  const rec = life.bb?.rec
  const seasons = (rec?.tournaments ?? []).filter((t) => t.level === 'pro' || t.level === 'farm' || t.level === 'mlb')
  const pay = life.career.salaryHist ?? []
  if (!seasons.length && !pay.length) return null
  const pitcher = life.person.position === 'P'
  const ages = [...new Set([...seasons.map((t) => t.age), ...pay.map((p) => p.age)])].sort((a, b) => a - b)
  const birth = life.person.birthYear
  const total = (level: 'pro' | 'farm' | 'mlb') => rec?.official[level]
  // a US life's levels are the majors and the minors; a Japanese life's MLB games are their own level ('mlb', careerSeason.ts mlbSeason)
  const us = life.person.country === 'US'
  const LV = us ? LEVEL_US : LEVEL
  return (
    <Panel fold={fold} className="proyears" title={<>{t('panel.proyears')} <span className="lbl">{t('panel.gameRecord')}</span></>}>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>{t('col.age')}</th>
              <th>{t('col.team')}</th>
              <th>{t('col.level')}</th>
              <th>{t('col.g')}</th>
              {pitcher ? (
                <>
                  <th>{t('col.wl')}</th>
                  <th>{t('col.ip')}</th>
                  <th>{t('col.era')}</th>
                  <th>{t('col.so')}</th>
                </>
              ) : (
                <>
                  <th>{t('col.avg')}</th>
                  <th>{t('col.h')}</th>
                  <th>{t('col.hr')}</th>
                  <th>{t('col.rbi')}</th>
                  <th>{t('col.sb')}</th>
                </>
              )}
              <th>{t('col.salary')}</th>
            </tr>
          </thead>
          <tbody>
            {ages.flatMap((age) => {
              const lines = seasons.filter((t) => t.age === age)
              const p = pay.find((x) => x.age === age)
              const year = birth + age
              // the age of that season, counted as everywhere on screen (displayAge.ts); the year stays as the cell's tooltip
              const seasonAge = t('life.ageAt', { n: shownAge(age) })
              if (!lines.length)
                return [
                  <tr key={`${age}-none`}>
                    <td title={t('pro.year', { year })}>{seasonAge}</td>
                    <td>{g(p?.team ?? '—')}</td>
                    <td>{p?.kind === 'mlb' ? (p.usd || life.person.country === 'US' || life.person.country === 'JP' ? 'MLB' : life.person.country === 'KR' ? t('lv.kboFirst') : t('lv.domestic')) : p?.kind === 'minor' ? (life.person.country === 'KR' && !p.usd ? t('lv.krSecond') : t('lv.minor')) : '—'}</td>
                    <td colSpan={pitcher ? 5 : 6} className="muted">
                      {t('pro.noGames')}
                    </td>
                    <td>{p ? yen(p.salary) : '—'}</td>
                  </tr>,
                ]
              return lines.map((r, i) => (
                <tr key={`${age}-${r.level}`}>
                  <td title={t('pro.year', { year })}>{i === 0 ? seasonAge : ''}</td>
                  <td>{g(r.team ?? p?.team ?? '—')}</td>
                  <td>{levelWord(rowLevel(r, LV))}</td>
                  <td>{r.line.games}</td>
                  {pitcher ? (
                    <>
                      <td>
                        {r.line.w}-{r.line.l}
                      </td>
                      <td>{ip(r.line)}</td>
                      <td>{era(r.line)}</td>
                      <td>{r.line.k}</td>
                    </>
                  ) : (
                    <>
                      <td>{avg(r.line)}</td>
                      <td>{r.line.h}</td>
                      <td>{r.line.hr}</td>
                      <td>{r.line.rbi}</td>
                      <td>{r.line.sb}</td>
                    </>
                  )}
                  <td>
                    {i === 0 && p ? yen(p.salary) : ''}
                    {i === 0 && p?.firstTeam ? <small className="kv-sub">{t('pro.firstTeam', { amount: yen(p.firstTeam) })}</small> : null}
                  </td>
                </tr>
              ))
            })}
            {(['pro', 'farm', 'mlb'] as const).map((lv) => {
              const l = total(lv)
              if (!l) return null
              return (
                <tr key={`total-${lv}`} className="total">
                  <td colSpan={2}>{t('pro.total')}</td>
                  <td>{lv === 'mlb' ? 'MLB' : levelWord(LV[lv])}</td>
                  <td>{l.games}</td>
                  {pitcher ? (
                    <>
                      <td>
                        {l.w}-{l.l}
                      </td>
                      <td>{ip(l)}</td>
                      <td>{era(l)}</td>
                      <td>{l.k}</td>
                    </>
                  ) : (
                    <>
                      <td>{avg(l)}</td>
                      <td>{l.h}</td>
                      <td>{l.hr}</td>
                      <td>{l.rbi}</td>
                      <td>{l.sb}</td>
                    </>
                  )}
                  <td />
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="small muted">
        {t('pro.note')}
        {seasons.some((x) => x.level === 'mlb') && t('pro.note.mlb')}
        {/* (NPB's rule: a Japanese life's table only) */}
        {(life.person.country ?? 'JP') === 'JP' && t('pro.note.npb')}
      </p>
    </Panel>
  )
}
