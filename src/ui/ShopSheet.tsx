import { useState } from 'react'
import type { LifeState } from '../engine/types.ts'
import { DIETS, INSURANCES, VEHICLES, buyShop, setDiet, setInsurance, setVehicle, shopCards, shopSettings, spareMoney, toggleAuto, type Diet, type Insurance, type ShopCard, type Vehicle } from '../engine/shop.ts'
import { saveLife } from '../game/persist.ts'
import { yen } from './format.ts'
import { t, type Key } from '../i18n/index.ts'
import { gameText as g } from '../i18n/game.ts'

// The money screen: "お金を使う · 投資" (PROJECT_PLAN §11.43). Time stands still while it is open (the caller holds the clock). A card is
// something he could spend on or invest in now; its options are buttons with their price; one he cannot pay for is shown, shaded,
// with the reason. Under them: where the spare money is kept, and the kinds of spending that may repeat by themselves.
// (the texts of the screen are in src/i18n (batch 7); the cards, their options and effects, the settings' words and the lines of a
// purchase are the game's, through src/i18n/game.ts)

interface Props {
  life: LifeState
  /** told after every change of the life, so that the screen behind redraws */
  onChange: () => void
  onClose: () => void
}

const AUTO_LABEL: Record<string, Key> = {
  'sp.parents': 'shop.topic.parents',
  'sp.outing': 'shop.topic.outing',
  'sp.trip': 'shop.topic.trip',
  'sp.culture': 'shop.topic.culture',
  'sp.course': 'shop.topic.course',
  'sp.lessons': 'shop.topic.lessons',
  'sp.hobby': 'shop.topic.hobby',
  'sp.community': 'shop.topic.community',
  'sp.camp': 'shop.topic.camp',
  'sp.table': 'shop.topic.table',
  'sp.study': 'shop.topic.study',
  'sp.gear': 'shop.topic.gear',
}

function trend(h: [number, number][]): string {
  const ys = h.map((p) => p[1])
  const lo = Math.min(...ys)
  const span = Math.max(1, Math.max(...ys) - lo)
  const a0 = h[0][0]
  const aw = Math.max(1, h[h.length - 1][0] - a0)
  return h.map((p) => `${(((p[0] - a0) / aw) * 196 + 2).toFixed(1)},${(56 - ((p[1] - lo) / span) * 52).toFixed(1)}`).join(' ')
}

function Card({ card, life, onBuy }: { card: ShopCard; life: LifeState; onBuy: (id: string, i: number) => void }) {
  const none = card.options.every((o) => !o.open)
  const poor = none && card.options.every((o) => life.money < o.cost)
  return (
    <div className={`shopcard ${none ? 'off' : ''}`}>
      <div className="top">
        <b>{g(card.title)}</b>
        <small>
          {card.summary.length ? card.summary.map(g).join(' · ') : ' '}
          {none ? `${card.summary.length ? ' · ' : ''}${poor ? t('shop.poor') : t('shop.notNow')}` : ''}
          {!none && card.options.some((o) => o.later) ? `${card.summary.length ? ' · ' : ''}${t('shop.later')}` : ''}
        </small>
      </div>
      <div className="pills">
        {card.options.map((o) => (
          <button
            key={o.index}
            type="button"
            className="pill"
            disabled={!o.open}
            title={[o.hint && g(o.hint), o.effects.map(g).join(' · ')].filter(Boolean).join('\n') || undefined}
            onClick={() => onBuy(card.id, o.index)}
          >
            <span className="lab">{g(o.label)}</span>
            <span className="cost num">{o.cost > 0 ? yen(o.cost) : t('shop.free')}</span>
            {!o.open && life.money < o.cost + 20 ? <span className="fx">{t('shop.poor')}</span> : o.effects.length > 0 && <span className="fx">{o.effects.map(g).join(' · ')}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

export function ShopSheet({ life, onChange, onClose }: Props) {
  const [last, setLast] = useState<string[] | null>(null)
  const [refused, setRefused] = useState<string | null>(null)
  const cards = shopCards(life)
  const now = cards.filter((c) => c.group === 'now')
  const more = cards.filter((c) => c.group === 'more')
  const st = shopSettings(life)
  const spare = spareMoney(life)
  // the savings now count as the last point, so the chart ends where the header says
  const hist: [number, number][] = [...(life.shop?.hist ?? []).filter((h) => h[0] !== life.age), ...(life.shop?.hist ? [[life.age, Math.round(life.money)] as [number, number]] : [])]
  const repeatable = [...new Set(cards.filter((c) => c.repeatable).map((c) => c.topic))]
  // the kinds that are on stay listed even when no card is open for them just now
  const topics = [...new Set([...repeatable, ...st.auto])].filter((x) => AUTO_LABEL[x])

  const buy = (id: string, i: number) => {
    const r = buyShop(life, id, i)
    if (!r.ok) {
      setRefused(r.reason ?? t('shop.refused'))
      return
    }
    setRefused(null)
    for (const e of r.lines) life.log.push(e)
    setLast(r.lines.map((l) => l.text))
    saveLife(life)
    onChange()
  }
  const change = () => {
    saveLife(life)
    onChange()
  }

  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-labelledby="shop-title">
      <div className="dialog shop">
        <div className="hd">
          <span>{t('shop.band')}</span>
          <button type="button" className="btn sm" onClick={onClose}>
            {t('shop.close')}
          </button>
        </div>
        <div className="bd">
          <h2 id="shop-title">{t('shop.title', { amount: yen(life.money) })}</h2>
          <p className="body">
            {t('shop.body.unit')}
            {life.income ? t('shop.body.income', { amount: yen(life.income) }) : ''}
            {t('shop.body.how')}
          </p>
          {last && (
            <div className="shopdone" role="status">
              {last.map((x, i) => (
                <p key={i}>{g(x)}</p>
              ))}
            </div>
          )}
          {refused && (
            <div className="shopdone bad" role="alert">
              {g(refused)}
            </div>
          )}

          {cards.length === 0 && <p className="muted small">{t('shop.none')}</p>}
          {now.length > 0 && <h3 className="shophd">{t('shop.now')}</h3>}
          {now.map((c) => (
            <Card key={c.id} card={c} life={life} onBuy={buy} />
          ))}
          {more.length > 0 && (
            <details className="shopmore">
              <summary>{t('shop.more', { n: more.length })}</summary>
              {more.map((c) => (
                <Card key={c.id} card={c} life={life} onBuy={buy} />
              ))}
            </details>
          )}

          <details className="shopmore" open={st.vehicle !== 'deposit'}>
            <summary>
              {t('shop.living')} <span className="cur">{t('shop.vehicle.cur', { label: g(VEHICLES[st.vehicle].label) })}</span>
            </summary>
            <h3 className="shophd">{t('shop.vehicle')}</h3>
            <p className="small muted">{t('shop.vehicle.note', { amount: yen(spare) })}</p>
            <div className="pills vehicles" role="radiogroup" aria-label={t('shop.vehicle')}>
              {(Object.keys(VEHICLES) as Vehicle[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  className="pill"
                  role="radio"
                  aria-checked={st.vehicle === v}
                  aria-pressed={st.vehicle === v}
                  onClick={() => {
                    setVehicle(life, v)
                    change()
                  }}
                >
                  <span className="lab">{g(VEHICLES[v].label)}</span>
                  <span className="fx">{g(VEHICLES[v].note)}</span>
                </button>
              ))}
            </div>
          </details>

          <details className="shopmore" open={st.insurance !== undefined || st.diet !== 'free'}>
            <summary>
              {t('shop.insDiet')} <span className="cur">{st.insurance ? t('shop.ins.cur', { label: g(INSURANCES[st.insurance].label) }) : t('shop.ins.unset')} / {g(DIETS[st.diet].label)}</span>
            </summary>
            <h3 className="shophd">{t('shop.ins')}</h3>
            <p className="small muted">{t('shop.ins.note')}</p>
            <div className="pills insurances" role="radiogroup" aria-label={t('shop.ins')}>
              {(Object.keys(INSURANCES) as Insurance[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  className="pill"
                  role="radio"
                  aria-checked={st.insurance === v}
                  aria-pressed={st.insurance === v}
                  onClick={() => {
                    setInsurance(life, v)
                    change()
                  }}
                >
                  <span className="lab">{g(INSURANCES[v].label)}</span>
                  <span className="fx">{g(INSURANCES[v].note)}</span>
                </button>
              ))}
            </div>
            <h3 className="shophd">{t('shop.diet')}</h3>
            <div className="pills diets" role="radiogroup" aria-label={t('shop.diet')}>
              {(Object.keys(DIETS) as Diet[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  className="pill"
                  role="radio"
                  aria-checked={st.diet === v}
                  aria-pressed={st.diet === v}
                  onClick={() => {
                    setDiet(life, v)
                    change()
                  }}
                >
                  <span className="lab">{g(DIETS[v].label)}</span>
                  <span className="fx">{g(DIETS[v].note)}</span>
                </button>
              ))}
            </div>
          </details>

          {hist.length >= 2 && (
            <details className="shopmore">
              <summary>
                {t('shop.hist')} <span className="cur">{t('shop.hist.cur', { a: hist[0][0], x: yen(hist[0][1]), b: hist[hist.length - 1][0], y: yen(hist[hist.length - 1][1]) })}</span>
              </summary>
              <svg className="shoptrend" viewBox="0 0 200 60" role="img" aria-label={t('shop.hist')} preserveAspectRatio="none">
                <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={trend(hist)} />
              </svg>
              <p className="small muted">{t('shop.hist.note')}</p>
            </details>
          )}

          {topics.length > 0 && (
            <details className="shopmore" open={st.auto.length > 0}>
              <summary>
                {t('shop.auto')} <span className="cur">{st.auto.length ? t('shop.auto.on', { n: st.auto.length }) : t('shop.auto.off')}</span>
              </summary>
              <div className="pills autos">
                {topics.map((x) => (
                  <button
                    key={x}
                    type="button"
                    className="pill"
                    aria-pressed={st.auto.includes(x)}
                    onClick={() => {
                      toggleAuto(life, x)
                      change()
                    }}
                  >
                    <span className="lab">{t(AUTO_LABEL[x])}</span>
                    <span className="fx">{st.auto.includes(x) ? t('shop.on') : t('shop.off')}</span>
                  </button>
                ))}
              </div>
              <p className="small muted">{t('shop.auto.note')}</p>
            </details>
          )}

          <div className="foot">
            <button type="button" className="btn" onClick={onClose}>
              {t('shop.close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
