import { useCallback, useEffect, useReducer, useRef, useState, type RefObject } from 'react'
import type { Decision, LifeEntryStop, LifeState, TimedEntry } from '../engine/types.ts'
import { endYear, planYear, resolveDecision, setAutoDecide, type Sim } from '../engine/life.ts'
import { loadPlan, saveLife, savePlan } from './persist.ts'

// The clock (PROJECT_PLAN §5.4 B3): one year lasts paceMinutes·60/80 seconds at 1×.
// Speeds 1/2/4/8/12/16×, pause, "next decision" fast-forward, and おまかせ.

export const SPEEDS = [1, 2, 4, 8, 12, 16] as const
export type Speed = (typeof SPEEDS)[number]

export function secondsPerYear(pace: LifeState['config']['pace']): number {
  const minutes = pace === 'p5' ? 5 : pace === 'p30' ? 30 : pace === 'p60' ? 60 : 15
  return (minutes * 60) / 80
}

interface Plan {
  events: TimedEntry[]
  next: number
  t: number
  decision?: { at: number; decision: Decision }
  decisionDone: boolean
  /** when the lines of the answers given this year end (the next answer's lines come after) */
  chainEnd?: number
}
/** the plan as saved: with the line the screen stopped on, if it waits for the player */
type SavedYear = Plan & { stopped: LifeEntryStop | null }

export interface Runner {
  speed: Speed
  setSpeed: (s: Speed) => void
  paused: boolean
  togglePause: () => void
  ff: boolean
  toggleFf: () => void
  decision: Decision | null
  minimized: boolean
  setMinimized: (m: boolean) => void
  choose: (index: number, memo?: string) => void
  setAuto: (on: boolean) => void
  freshCount: number
  version: number
  /** a line the screen stopped on (a draft, the end of the playing career), until `goOn` */
  stopped: LifeEntryStop | null
  goOn: () => void
  /** a screen that holds the clock while it is open (the money screen): the year does not move until it is released */
  setHold: (h: boolean) => void
  /** saves the life with its year in progress (call it wherever the life is saved in the middle of a year) */
  save: () => void
}

/** `progressRef`: element whose --t custom property shows progress through the year. */
export function useLifeRunner(life: LifeState, sim: Sim, onDeath: () => void, progressRef: RefObject<HTMLDivElement | null>): Runner {
  const [version, bump] = useReducer((x: number) => x + 1, 0)
  const [speed, setSpeed] = useState<Speed>(1)
  const [paused, setPaused] = useState(false)
  const [ff, setFf] = useState(false)
  const [decision, setDecision] = useState<Decision | null>(null)
  const [minimized, setMinimized] = useState(false)
  const [freshCount, setFresh] = useState(0)
  // a year left in the middle (persist.ts loadPlan): read once, when the screen opens
  const [resumed] = useState(() => loadPlan<SavedYear>(life))
  const [stopped, setStopped] = useState<LifeEntryStop | null>(resumed?.stopped ?? null)
  const [hold, setHold] = useState(false)
  const planRef = useRef<Plan | null>(null)
  const stateRef = useRef({ speed, paused, ff, decisionOpen: false, hold: false })
  useEffect(() => {
    stateRef.current = { speed, paused, ff, decisionOpen: decision !== null || stopped !== null, hold }
  }, [speed, paused, ff, decision, stopped, hold])
  const deadRef = useRef(false)

  const newPlan = useCallback(() => {
    const p = planYear(life, sim)
    planRef.current = { events: p.events, next: 0, t: 0, decision: p.decision, decisionDone: false }
  }, [life, sim])

  // the life and the year's plan are saved together, always (persist.ts savePlan): a life saved in the middle of a year is already
  // past the year's events, and only its plan says which lines are still to come and which decision waits
  const stoppedRef = useRef<LifeEntryStop | null>(null)
  const lastSave = useRef(0)
  const save = useCallback(() => {
    if (!life.alive || !planRef.current) return
    saveLife(life)
    savePlan<SavedYear>(life, { ...planRef.current, stopped: stoppedRef.current })
    lastSave.current = performance.now()
  }, [life])
  useEffect(() => {
    stoppedRef.current = stopped
  }, [stopped])
  // leaving the page (closing the tab, switching apps on a phone) keeps what was played up to that moment
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') save()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', save)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', save)
    }
  }, [save])

  const choose = useCallback(
    (index: number, memo?: string) => {
      const plan = planRef.current
      if (!plan) return
      const r = resolveDecision(life, index, sim, memo)
      // the lines of an answer come after the lines of the answers before it, in their order (a chain of questions in one year used to
      // interleave: a later answer's first line could show before an earlier answer's last; PROJECT_PLAN §11.61)
      const from = Math.max(plan.t, plan.chainEnd ?? 0)
      const step = Math.min(0.06, (0.99 - from) / (r.events.length + 1))
      r.events.forEach((e, i) => (e.at = from + step * (i + 1)))
      if (r.events.length) plan.chainEnd = r.events[r.events.length - 1].at
      plan.events = [...plan.events.slice(0, plan.next), ...[...plan.events.slice(plan.next), ...r.events].sort((a, b) => a.at - b.at)]
      if (r.followUp) {
        // the next question waits until the lines of this answer have been shown
        plan.decision = { at: Math.max(plan.t, 0.6, (plan.chainEnd ?? 0) + 0.001), decision: r.followUp.decision }
        plan.decisionDone = false
      } else {
        plan.decisionDone = true
      }
      setDecision(null)
      setMinimized(false)
      bump()
      save()
    },
    [life, sim, save],
  )

  const setAuto = useCallback(
    (on: boolean) => {
      setAutoDecide(life, on)
      bump()
    },
    [life],
  )

  useEffect(() => {
    if (!planRef.current) {
      // resuming in the middle of a year: go on with that year's plan (persist.ts loadPlan); otherwise plan the year
      if (resumed) {
        const { stopped: stop, ...plan } = resumed
        planRef.current = plan
        if (stop) {
          stoppedRef.current = stop
          stateRef.current = { ...stateRef.current, decisionOpen: true }
        }
      } else {
        newPlan()
        save()
      }
    }
    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const st = stateRef.current
      const plan = planRef.current
      if (plan && !deadRef.current && !st.paused && !st.decisionOpen && !st.hold) {
        const spy = secondsPerYear(life.config.pace)
        const rate = (st.ff ? 40 : st.speed) / spy
        const stopAt = plan.decision && !plan.decisionDone ? plan.decision.at : 1
        plan.t = Math.min(stopAt, plan.t + dt * rate)
        let revealed = 0
        let stopOn: LifeEntryStop | null = null
        while (plan.next < plan.events.length && plan.events[plan.next].at <= plan.t) {
          const entry = plan.events[plan.next].entry
          life.log.push(entry)
          plan.next++
          revealed++
          // a draft or the end of the playing career stops the screen, whatever the speed or おまかせ (PROJECT_PLAN §11.23)
          if (entry.stop) {
            stopOn = { kind: entry.stop, entry }
            break
          }
        }
        if (stopOn) {
          stateRef.current = { ...stateRef.current, decisionOpen: true, ff: false }
          stoppedRef.current = stopOn
          setFf(false)
          setStopped(stopOn)
          save()
        }
        if (revealed) {
          setFresh(revealed)
          bump()
          // the lines shown are kept every few seconds (and at every decision, stop and year)
          if (now - lastSave.current > 3000) save()
        }
        if (stopOn) {
          // wait for the player
        } else if (plan.decision && !plan.decisionDone && plan.t >= plan.decision.at) {
          const d = plan.decision.decision
          // a decision with the end of baseball among its choices is never answered by おまかせ (PROJECT_PLAN §11.23)
          if ((life.autoDecide && !d.stop) || (d.weight === 'breath' && st.ff)) {
            choose(d.autoIndex)
          } else {
            stateRef.current = { ...stateRef.current, decisionOpen: true, ff: false }
            setFf(false)
            setDecision(d)
            save()
          }
        } else if (plan.t >= 1 && plan.next >= plan.events.length) {
          endYear(life)
          if (!life.alive) {
            deadRef.current = true
            onDeath()
            return
          }
          newPlan()
          save()
          bump()
        }
      }
      if (progressRef.current) progressRef.current.style.setProperty('--t', String(planRef.current?.t ?? 0))
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [life, newPlan, choose, onDeath, progressRef, save, resumed])

  // keyboard: Space = pause, 1-9 = choose
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.tagName === 'SELECT')) return
      if (e.code === 'Space' && !decision) {
        e.preventDefault()
        setPaused((p) => !p)
      } else if (decision && !minimized && /^[1-9]$/.test(e.key) && decision.weight !== 'breath') {
        const i = Number(e.key) - 1
        if (i < decision.choices.length) choose(i)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [decision, minimized, choose])

  return {
    speed,
    setSpeed,
    paused,
    togglePause: () => setPaused((p) => !p),
    ff,
    toggleFf: () => setFf((f) => !f),
    decision,
    minimized,
    setMinimized,
    choose,
    setAuto,
    freshCount,
    version,
    stopped,
    setHold,
    save,
    goOn: () => {
      setStopped(null)
      stoppedRef.current = null
      stateRef.current = { ...stateRef.current, decisionOpen: decision !== null }
      save()
    },
  }
}
