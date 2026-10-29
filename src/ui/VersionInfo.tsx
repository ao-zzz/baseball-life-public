import { useEffect, useId, useRef, useState } from 'react'
import { APP_VERSION, CHANGELOG } from '../data/changelog.ts'
import { dayText, t } from '../i18n/index.ts'
import { changeText } from '../i18n/changelog.ts'

// (the changes are written in Japanese in data/changelog.ts; their other languages are in src/i18n/changelog.ts)

/**
 * The version in a corner of the title page: pressed, it opens the update history just below it (newest first), pressed again (or Esc)
 * it closes it. Opened or closed is kept on the page only: nothing is saved, and the game and its saves do not see it.
 */
export function VersionInfo() {
  const [open, setOpen] = useState(false)
  const id = useId()
  const box = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  // Esc closes the history wherever the focus is; the focus goes back to the button when it was in the history (or nowhere)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      const at = document.activeElement
      if (!at || at === document.body || box.current?.contains(at)) button.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  return (
    <div className="verinfo" ref={box}>
      <button ref={button} type="button" className="verbtn" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        Ver. {APP_VERSION}
        <span className="sr-only">{t('version.sr')}</span>
        <span aria-hidden="true">{open ? ' ▴' : ' ▾'}</span>
      </button>
      <section id={id} className="changelog" aria-label={t('version.history')} hidden={!open}>
        <h3>{t('version.history')}</h3>
        <ol>
          {CHANGELOG.map((r) => (
            <li key={r.version}>
              <p className="relhead">
                <b>Ver. {r.version}</b> <time dateTime={r.date}>{dayText(r.date)}</time>
              </p>
              <ul>
                {r.changes.map((c) => (
                  <li key={c}>{changeText(c)}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
