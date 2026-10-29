import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/base.css'
import './styles/screens.css'
import App from './App.tsx'
import { langFromPath, setLang } from './i18n/index.ts'
import { loadGameTexts } from './i18n/game.ts'
import { loadLanguage } from './i18n/packs.ts'

// the language of the screens is the page's (`/en/`, `/ko/`, `/zh-tw/`; src/i18n), set before anything is drawn
const lang = langFromPath(location.pathname)
setLang(lang)
document.documentElement.lang = lang

const render = () =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )

// the game's own texts in another language are fetched first (src/i18n/game.ts), and Korean's and Chinese's words of the screens
// (src/i18n/packs.ts); the Japanese page draws at once and never fetches them
if (lang === 'ja') render()
else Promise.all([loadGameTexts(lang), loadLanguage(lang)]).then(render, render)
