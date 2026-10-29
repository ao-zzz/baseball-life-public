import { useEffect, useMemo, useState } from 'react'
import type { LifeState } from '../engine/types.ts'
import { fullName, prefName } from '../engine/life.ts'
import { shownAge } from '../engine/displayAge.ts'
import { highestLabel } from '../engine/summary.ts'
import { livingPlace } from '../engine/place.ts'
import { num, t } from '../i18n/index.ts'
import { placeName } from '../i18n/places.ts'
import { gameText as g } from '../i18n/game.ts'

// The last scene: the final year, the cause, a run through the life's key moments,
// then a closing card. Tap to advance; "skip" jumps to the closing card, again to leave.
// (the texts are in src/i18n; the cause, the highest stage and the life's lines are the game's words, through src/i18n/game.ts; places
// through src/i18n/places.ts)

interface Frame {
  age?: number
  big?: string
  line?: string
  sub?: string
  closing?: boolean
}

export function Ending({ life, onDone }: { life: LifeState; onDone: () => void }) {
  const frames = useMemo<Frame[]>(() => {
    // (where he lived at the end, not where he was born: place.ts; a place the model does not know is not named)
    const where = livingPlace(life)
    const f: Frame[] = [{ big: t('end.lastYear', { age: shownAge(life.age) }) }, { line: t('end.died', { place: where ? placeName(where) : t('end.hometown') }), sub: t('end.cause', { cause: g(life.causeOfDeath ?? '—') }) }]
    f.push({ line: t('end.smell') })
    const moments = life.log.filter((e) => e.key && e.kind !== 'death').slice(0, 14)
    for (const m of moments) f.push({ age: m.age, line: g(m.text) })
    f.push({ closing: true })
    return f
  }, [life])
  const [i, setI] = useState(0)
  const [armed, setArmed] = useState(false)
  const last = frames.length - 1
  useEffect(() => {
    if (i >= last) return
    const t = setTimeout(() => setI((x) => Math.min(last, x + 1)), i < 3 ? 2600 : 1900)
    return () => clearTimeout(t)
  }, [i, last])
  const days = Math.round(life.age * 365.25 + (12 - life.person.birthMonth) * 30)
  const lastPlace = livingPlace(life)
  const f = frames[i]
  const skip = () => {
    if (i < last) setI(last)
    else if (!armed) setArmed(true)
    else onDone()
  }
  return (
    <div
      className="ending"
      onClick={() => {
        if (i < last) setI(i + 1)
      }}
      role="dialog"
      aria-label={t('end.aria')}
    >
      <button
        type="button"
        className="skip"
        onClick={(e) => {
          e.stopPropagation()
          skip()
        }}
      >
        {i < last ? t('end.skip') : armed ? t('end.armed') : t('end.close')}
      </button>
      <div className="frame" key={i}>
        {f.age !== undefined && <p className="age">{t('end.age', { n: shownAge(f.age) })}</p>}
        {f.big && <p className="big">{f.big}</p>}
        {f.line && <p className="line">{f.line}</p>}
        {f.sub && <p className="age" style={{ marginTop: 8 }}>{f.sub}</p>}
        {f.closing && (
          <div>
            <p className="big">{g(fullName(life))}</p>
            <p className="age">
              {life.person.birthYear} – {life.year}
            </p>
            <p className="line">
              {t('end.lived', {
                place: placeName(prefName(life)),
                until: lastPlace && lastPlace !== prefName(life) ? t('end.until', { place: placeName(lastPlace) }) : '',
                years: life.age,
                days: num(days),
              })}
            </p>
            <p className="line">{t('end.farthest', { label: g(highestLabel(life)) })}</p>
            {life.family.children > 0 && <p className="line">{t(life.family.children === 1 ? 'end.kids.one' : 'end.kids', { n: life.family.children })}</p>}
            <p className="line" style={{ marginTop: 16 }}>
              {t('end.once')}
            </p>
            <button
              type="button"
              className="btn primary"
              style={{ marginTop: 20 }}
              onClick={(e) => {
                e.stopPropagation()
                onDone()
              }}
            >
              {t('end.record')}
            </button>
          </div>
        )}
        {!f.closing && (
          <div className="progress" aria-hidden="true">
            {frames.slice(0, -1).map((_, k) => (
              <i key={k} className={k <= i ? 'on' : undefined} />
            ))}
          </div>
        )}
      </div>
      {i < last && <p className="hint">{t('end.hint')}</p>}
    </div>
  )
}
