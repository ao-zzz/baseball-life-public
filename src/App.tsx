import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LifeConfig, LifeState } from './engine/types.ts'
import type { CountryCode } from './data/types.ts'
import { createLife, fullName, playToEnd, prefName, type Sim } from './engine/life.ts'
import { defaultParams } from './engine/params.ts'
import { randomSeed } from './engine/rng.ts'
import type { CohortResult } from './engine/cohort.ts'
import { highestLabel, lifeTitle } from './engine/summary.ts'
import { newLifeId, registerLife } from './game/liveCounter.ts'
import { addPast, clearLife, clearPlan, loadLife, loadPast, loadSettings, saveLife, saveSettings, type Settings } from './game/persist.ts'
import { Intro } from './ui/Intro.tsx'
import { StarPick } from './ui/StarPick.tsx'
import { InfoPageView } from './ui/InfoPages.tsx'
import type { InfoPage } from './data/site.ts'
import { readShared, type SharedBirth } from './game/shareLink.ts'
import { Roll } from './ui/Roll.tsx'
import { Cert } from './ui/Cert.tsx'
import { LifeScreen } from './ui/LifeScreen.tsx'
import { Ending } from './ui/Ending.tsx'
import { Result } from './ui/Result.tsx'
import { StatsPage } from './ui/StatsPage.tsx'

type Screen = 'intro' | 'stars' | 'roll' | 'cert' | 'life' | 'ending' | 'result' | 'stats' | 'info'

const INFO = ['privacy', 'guide', 'legal', 'feedback'] as const
const infoOf = (h: string): InfoPage | null => ((INFO as readonly string[]).includes(h.slice(1)) ? (h.slice(1) as InfoPage) : null)

function applyTheme(theme: Settings['theme']) {
  const root = document.documentElement
  if (theme === 'auto') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
}

export default function App() {
  const [settings, setSettingsState] = useState<Settings>(loadSettings)
  const [screen, setScreen] = useState<Screen>(() => (location.hash === '#stats' ? 'stats' : infoOf(location.hash) ? 'info' : 'intro'))
  const [info, setInfo] = useState<InfoPage>(() => infoOf(location.hash) ?? 'privacy')
  // a shared link opens the title page as any visit does, with the visitor's own settings (PROJECT_PLAN §11.62: the offer to be born as
  // the sharer was, with the sharer's mode, is no longer made); the old links' query is dropped from the address
  const [shared, setShared] = useState<SharedBirth | null>(null)
  useEffect(() => {
    if (location.search && readShared(location.search)) history.replaceState(null, '', location.pathname + location.hash)
  }, [])
  const [life, setLife] = useState<LifeState | null>(null)
  const [resume, setResume] = useState<LifeState | null>(loadLife)
  const [past, setPast] = useState(loadPast)
  const [cohort, setCohort] = useState<CohortResult | null>(null)
  const [progress, setProgress] = useState(0)
  const sim = useMemo<Sim>(() => ({ params: defaultParams() }), [])
  const workerRef = useRef<Worker | null>(null)
  const prevScreen = useRef<Screen>('intro')

  useEffect(() => applyTheme(settings.theme), [settings.theme])

  useEffect(() => {
    const onHash = () => {
      const page = infoOf(location.hash)
      if (location.hash === '#stats' || page) {
        if (page) setInfo(page)
        setScreen((s) => {
          if (s !== 'stats' && s !== 'info') prevScreen.current = s
          return page ? 'info' : 'stats'
        })
      } else {
        setScreen((s) => (s === 'stats' || s === 'info' ? prevScreen.current : s))
      }
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => () => workerRef.current?.terminate(), [])

  const setSettings = (s: Settings) => {
    setSettingsState(s)
    saveSettings(s)
  }

  const cycleTheme = () => {
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
    const current = settings.theme === 'auto' ? (prefersDark ? 'dark' : 'light') : settings.theme
    setSettings({ ...settings, theme: current === 'dark' ? 'light' : 'dark' })
  }

  const startCohort = useCallback((config: LifeConfig, prefecture: number) => {
    workerRef.current?.terminate()
    setCohort(null)
    setProgress(0)
    const w = new Worker(new URL('./worker/cohort.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = w
    w.onmessage = (e: MessageEvent<{ type: 'progress'; f: number } | { type: 'done'; result: CohortResult }>) => {
      if (e.data.type === 'progress') setProgress(e.data.f)
      else setCohort(e.data.result)
    }
    w.postMessage({ config: { ...config, prefecture } })
  }, [])

  const prepare = useCallback(
    (l: LifeState) => {
      setLife(l)
      startCohort(l.config, l.person.prefecture)
    },
    [startCohort],
  )

  const start = (prefecture?: number, birth?: SharedBirth, country?: CountryCode) => {
    const config: LifeConfig = birth
      ? { seed: birth.seed, country: birth.country ?? 'JP', prefecture: birth.prefecture, pace: settings.pace, ...(birth.mode ? { mode: birth.mode, stars: birth.stars } : {}) }
      : {
          seed: randomSeed(),
          country: country ?? settings.country ?? 'JP',
          prefecture: prefecture ?? (settings.prefecture >= 0 ? settings.prefecture : undefined),
          pace: settings.pace,
          ...(settings.mode === 'potential' ? { mode: 'potential' as const, stars: settings.stars } : {}),
        }
    if (birth) {
      setShared(null)
      history.replaceState(null, '', location.pathname)
    }
    const l = createLife(config)
    prepare(l)
    setScreen(config.prefecture === undefined ? 'roll' : 'cert')
    window.scrollTo(0, 0)
  }

  const begin = () => {
    if (!life) return
    // the life begins here: one count, with an id made now (not at the birth certificate, which can be cancelled, and not on resume)
    void registerLife(newLifeId())
    if (life.config.pace === 'instant') {
      playToEnd(life, sim)
      finish(life)
      return
    }
    // a plan left by an earlier play of the same birth is not this life's (persist.ts savePlan)
    clearPlan()
    saveLife(life)
    setScreen('life')
    window.scrollTo(0, 0)
  }

  const finish = useCallback((l: LifeState) => {
    clearLife()
    setResume(null)
    setPast(
      addPast({
        name: fullName(l),
        prefecture: prefName(l),
        birthYear: l.person.birthYear,
        age: l.age,
        title: lifeTitle(l),
        highest: highestLabel(l),
        rank: l.career.highestRank,
        seed: l.config.seed,
      }),
    )
    setScreen('ending')
  }, [])

  const onDeath = useCallback(() => {
    if (life) finish(life)
  }, [life, finish])

  const quit = () => {
    if (life) {
      saveLife(life)
      setResume(life)
    }
    setScreen('intro')
  }

  const doResume = () => {
    if (!resume) return
    prepare(resume)
    setScreen('life')
  }

  const roll = useCallback(() => setScreen('cert'), [])

  switch (screen) {
    case 'stats':
      return <StatsPage onBack={() => (location.hash = '')} />
    case 'info':
      return <InfoPageView page={info} onBack={() => (location.hash = '')} />
    case 'stars':
      return <StarPick stars={settings.stars ?? 1} onStars={(n) => setSettings({ ...settings, stars: n })} onBegin={() => start()} onBack={() => setScreen('intro')} />
    case 'roll':
      return life ? <Roll target={life.person.prefecture} onDone={roll} country={life.person.country} /> : null
    case 'cert':
      return life ? <Cert life={life} onBegin={begin} onCancel={() => setScreen('intro')} /> : null
    case 'life':
      return life ? (
        <LifeScreen key={life.config.seed} life={life} sim={sim} cohort={cohort} cohortProgress={progress} onDeath={onDeath} onQuit={quit} onTheme={cycleTheme} />
      ) : null
    case 'ending':
      return life ? <Ending life={life} onDone={() => setScreen('result')} /> : null
    case 'result':
      return life ? (
        <Result
          life={life}
          cohort={cohort}
          cohortProgress={progress}
          onAgain={(same) => start(same ? life.person.prefecture : undefined, undefined, same ? life.person.country : undefined)}
          onTop={() => setScreen('intro')}
        />
      ) : null
    default:
      return (
        <Intro
          settings={settings}
          onSettings={setSettings}
          onStart={() => {
            // the potential mode asks for the ★ before the birth (PROJECT_PLAN §11.21)
            if (settings.mode === 'potential') {
              setScreen('stars')
              window.scrollTo(0, 0)
            } else start()
          }}
          resume={resume}
          onResume={doResume}
          onDiscard={() => {
            clearLife()
            setResume(null)
          }}
          past={past}
          onTheme={cycleTheme}
          shared={shared}
          onShared={() => shared && start(undefined, shared)}
          onDropShared={() => {
            setShared(null)
            history.replaceState(null, '', location.pathname)
          }}
        />
      )
  }
}
