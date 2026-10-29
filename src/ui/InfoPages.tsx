import { useState } from 'react'
import { FEEDBACK_CATEGORIES, FEEDBACK_MAX_LENGTH, INFO_PAGES, OPERATOR, cleanFeedback, feedbackLink, type InfoPage } from '../data/site.ts'
import { t } from '../i18n/index.ts'

// The pages at the foot of the title page (PROJECT_PLAN §11.23): privacy, how to use the game, the 特定商取引法 template and the
// feedback form. They describe what the app does now (it keeps a life on this device; it sends nothing unless the player opens a
// link), and they never fill in what has not been given (the operator, the form).
// (the texts are in src/i18n; the choices of the feedback form are the Google form's own, bilingual, and are never translated)

export function InfoPageView({ page, onBack }: { page: InfoPage; onBack: () => void }) {
  return (
    <main className="infopage">
      <div className="intro-top">
        <button type="button" className="btn sm" onClick={onBack}>
          {t('info.back')}
        </button>
      </div>
      {page === 'privacy' && <Privacy />}
      {page === 'guide' && <Guide />}
      {page === 'legal' && <Legal />}
      {page === 'feedback' && <Feedback />}
      <nav className="infonav">
        {INFO_PAGES.map((p) => (
          <a key={p.id} href={`#${p.id}`}>
            {t(`info.${p.id}`)}
          </a>
        ))}
      </nav>
    </main>
  )
}

function Privacy() {
  return (
    <article>
      <h1>{t('privacy.title')}</h1>
      <p className="small muted">{t('privacy.lede')}</p>
      <h2>{t('privacy.stored')}</h2>
      <ul>
        <li>{t('privacy.stored.what')}</li>
        <li>{t('privacy.stored.where')}</li>
      </ul>
      <h2>{t('privacy.external')}</h2>
      <ul>
        <li>{t('privacy.external.fonts')}</li>
        <li>{t('privacy.external.x')}</li>
        <li>{t('privacy.external.form')}</li>
        <li>{t('privacy.external.none')}</li>
      </ul>
      <h2>{t('privacy.people')}</h2>
      <p>{t('privacy.people.body')}</p>
      <p className="small muted">{t('privacy.updates')}</p>
    </article>
  )
}

function Guide() {
  return (
    <article>
      <h1>{t('guide.title')}</h1>
      <ul>
        <li>{t('guide.what')}</li>
        <li>{t('guide.modes')}</li>
        <li>{t('guide.save')}</li>
        <li>{t('guide.stops')}</li>
        <li>{t('guide.names')}</li>
        <li>{t('guide.feedback')}</li>
      </ul>
    </article>
  )
}

function Legal() {
  const unset = t('info.unset')
  const v = (x: string) => x || unset
  return (
    <article>
      <h1>{t('legal.title')}</h1>
      <p className="notice">{OPERATOR.sells ? t('legal.sells') : t('legal.template')}</p>
      <dl className="legal">
        <dt>{t('legal.seller')}</dt>
        <dd>{v(OPERATOR.name)}</dd>
        <dt>{t('legal.address')}</dt>
        <dd>{v(OPERATOR.address)}</dd>
        <dt>{t('legal.phone')}</dt>
        <dd>{v(OPERATOR.phone)}</dd>
        <dt>{t('legal.email')}</dt>
        <dd>{v(OPERATOR.email)}</dd>
        <dt>{t('legal.price')}</dt>
        <dd>{OPERATOR.sells ? unset : t('legal.price.none')}</dd>
        <dt>{t('legal.payment')}</dt>
        <dd>{OPERATOR.sells ? unset : '—'}</dd>
        <dt>{t('legal.delivery')}</dt>
        <dd>{OPERATOR.sells ? unset : '—'}</dd>
        <dt>{t('legal.returns')}</dt>
        <dd>{OPERATOR.sells ? unset : '—'}</dd>
      </dl>
    </article>
  )
}

function Feedback() {
  const [category, setCategory] = useState<string>(FEEDBACK_CATEGORIES[0])
  const [text, setText] = useState('')
  const connected = feedbackLink('バグ', 'x') !== null
  const clean = cleanFeedback(text)
  const ok = clean.length >= 5 && clean.length <= FEEDBACK_MAX_LENGTH
  const link = ok ? feedbackLink(category, clean) : null
  return (
    <article>
      <h1>{t('fb.title')}</h1>
      {!connected && <p className="notice">{t('fb.notConnected')}</p>}
      <form
        className="feedback"
        onSubmit={(e) => {
          e.preventDefault()
          if (link) window.open(link, '_blank', 'noopener,noreferrer')
        }}
      >
        <label htmlFor="fb-cat">{t('fb.category')}</label>
        <select id="fb-cat" value={category} onChange={(e) => setCategory(e.target.value)} disabled={!connected}>
          {FEEDBACK_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <label htmlFor="fb-text">{t('fb.text', { max: FEEDBACK_MAX_LENGTH })}</label>
        <textarea id="fb-text" value={text} maxLength={FEEDBACK_MAX_LENGTH} onChange={(e) => setText(e.target.value)} disabled={!connected} rows={6} />
        <p className="small muted">{t('fb.count', { n: clean.length, max: FEEDBACK_MAX_LENGTH })}</p>
        <button type="submit" className="btn primary" disabled={!connected || !ok}>
          {connected ? t('fb.send') : t('fb.cannot')}
        </button>
      </form>
    </article>
  )
}
