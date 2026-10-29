import { useState } from 'react'
import type { Decision, LifeState } from '../engine/types.ts'
import { shownAge } from '../engine/displayAge.ts'
import { FactBox, ModelBadge } from './common.tsx'
import { pctText } from './format.ts'
import { termsIn } from '../data/glossary.ts'
import { t, type Key } from '../i18n/index.ts'
import { gameText as g } from '../i18n/game.ts'

// (the frame's texts are in src/i18n; the question itself, its answers and the glossary are the game's words, through src/i18n/game.ts)
const KIND: Record<Decision['weight'], Key> = { major: 'dec.major', minor: 'dec.minor', breath: 'dec.breath' }

interface Props {
  life: LifeState
  decision: Decision
  onChoose: (i: number, memo?: string) => void
  onMinimize: () => void
  onAutoAll: () => void
  /** model: share of same-start runs still playing at this age (breath screens) */
  stillPlaying?: number
}

export function DecisionDialog({ life, decision, onChoose, onMinimize, onAutoAll, stillPlaying }: Props) {
  const [memo, setMemo] = useState('')
  const breath = decision.weight === 'breath'
  // the words of the question that a first-time player may not know (data/glossary.ts: found in the Japanese, shown in the language now)
  const terms = termsIn(decision.title, decision.body, ...decision.choices.flatMap((c) => [c.label, c.hint]))
  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-labelledby="dec-title">
      <div className="dialog">
        <div className="hd">
          <span>{t(KIND[decision.weight])}</span>
          <span className="when">
            {t('dec.when', { age: shownAge(life.age), year: life.year })}{' '}
            <button type="button" className="btn sm" onClick={onMinimize}>
              {t('dec.later')}
            </button>
          </span>
        </div>
        <div className="bd">
          <h2 id="dec-title">{g(decision.title)}</h2>
          <p className="body">{g(decision.body)}</p>
          {decision.factText && <FactBox text={g(decision.factText)} ids={decision.factStatIds} />}
          {terms.length > 0 && (
            <dl className="terms">
              {terms.map((t) => (
                <div key={t.word}>
                  <dt>{g(t.word)}</dt>
                  <dd>{g(t.meaning)}</dd>
                </div>
              ))}
            </dl>
          )}
          {breath && stillPlaying !== undefined && (
            <div className="fact">
              {t('dec.still', { age: shownAge(life.age), p: pctText(stillPlaying) })} <ModelBadge />
            </div>
          )}
          {breath && decision.question && (
            <div style={{ marginTop: 14 }}>
              <label htmlFor="memo">
                <b>{g(decision.question)}</b>
              </label>
              <textarea id="memo" value={memo} maxLength={200} onChange={(e) => setMemo(e.target.value)} placeholder={t('dec.memo')} />
            </div>
          )}
          <div className="choices">
            {decision.choices.map((c, i) => (
              <button key={c.label} type="button" onClick={() => onChoose(i, breath && i === 0 ? memo : undefined)}>
                <span className="k">{i + 1}</span>
                <span>
                  <b>{g(c.label)}</b>
                  {c.hint && <small>{g(c.hint)}</small>}
                </span>
              </button>
            ))}
          </div>
          {!breath && (
            <div className="foot">
              <button type="button" className="btn sm" onClick={onAutoAll}>
                {t('dec.autoAll')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function DecisionPeek({ decision, onOpen }: { decision: Decision; onOpen: () => void }) {
  return (
    <div className="peek" role="status">
      <span>{t('dec.waiting', { title: g(decision.title) })}</span>
      <button type="button" className="btn sm primary" onClick={onOpen}>
        {t('dec.open')}
      </button>
    </div>
  )
}
