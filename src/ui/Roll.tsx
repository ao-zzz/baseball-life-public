import { useEffect, useState } from 'react'
import type { CountryCode } from '../data/types.ts'
import { COUNTRY_INFO } from '../engine/countries/index.ts'
import { t } from '../i18n/index.ts'
import { placeName, regionWord } from '../i18n/places.ts'

// Place-of-birth roll: names flick by, slowing down, then land on the drawn place (a prefecture, or a state for the US).
export function Roll({ target, onDone, country = 'JP' }: { target: number; onDone: () => void; country?: CountryCode }) {
  const info = COUNTRY_INFO[country]
  const names = info.regions
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      const t = setTimeout(onDone, 600)
      return () => clearTimeout(t)
    }
    const timers: ReturnType<typeof setTimeout>[] = []
    let at = 0
    const steps = 26
    for (let i = 0; i < steps; i++) {
      at += 40 + Math.pow(i / steps, 3) * 420
      const show = i === steps - 1 ? target : (target + 7 * (i + 1) + i * i) % names.length
      timers.push(setTimeout(() => setIdx(show), at))
    }
    timers.push(setTimeout(onDone, at + 900))
    return () => timers.forEach(clearTimeout)
  }, [target, onDone, names.length])
  return (
    <main className="roll" aria-live="polite">
      <div>
        <p className="label">{t('roll.label', { region: regionWord(country) })}</p>
        <p className="name">{placeName(names[idx])}</p>
        <p className="p">{country === 'JP' ? t('roll.note.JP') : t('roll.note')}</p>
      </div>
    </main>
  )
}
