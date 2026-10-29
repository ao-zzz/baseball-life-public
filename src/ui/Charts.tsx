import type { LifeState } from '../engine/types.ts'
import { PLAYING } from '../engine/life.ts'
import { shownAge } from '../engine/displayAge.ts'
import { t as tr } from '../i18n/index.ts'

/** 10×10 map, one cell per year. Darker = further up the baseball ladder that year. */
export function LifeMap({ life, upto }: { life: LifeState; upto?: number }) {
  const cells = []
  const last = upto ?? life.age
  for (let a = 0; a < 100; a++) {
    const t = life.timeline.find((x) => x.age === a)
    let bg: string | undefined
    let title = tr('life.ageAt', { n: shownAge(a) })
    if (t) {
      const playing = PLAYING.includes(t.phase)
      const share = playing ? 18 + t.rank * 8 : 8
      bg = `color-mix(in srgb, var(--map-hi) ${share}%, var(--map-lo))`
      title += playing ? tr('map.playing') : ''
    }
    cells.push(<span key={a} className={a === last ? 'now' : undefined} style={bg ? { background: bg } : undefined} title={title} />)
  }
  return (
    <>
      <div className="lifemap" role="img" aria-label={tr('map.aria')}>
        {cells}
      </div>
      <div className="legend">
        <span>{tr('life.ageAt', { n: shownAge(0) })}</span>
        <span>{tr('map.legend')}</span>
        <span>{tr('life.ageAt', { n: shownAge(99) })}</span>
      </div>
    </>
  )
}

/** Share of same-start runs still on a team, by age, on a log scale (model output). */
export function SurvivalCurve({ playingByAge, age, height = 150 }: { playingByAge: number[]; age: number; height?: number }) {
  const W = 320
  const H = height
  const minAge = 8
  const maxAge = 45
  const pad = { l: 34, r: 8, t: 8, b: 20 }
  const x = (a: number) => pad.l + ((a - minAge) / (maxAge - minAge)) * (W - pad.l - pad.r)
  const floor = 1e-4
  const y = (p: number) => {
    const v = Math.log10(Math.max(floor, p))
    return pad.t + ((0 - v) / 4) * (H - pad.t - pad.b)
  }
  let d = ''
  for (let a = minAge; a <= maxAge; a++) {
    const p = playingByAge[a] ?? 0
    d += `${a === minAge ? 'M' : 'L'}${x(a).toFixed(1)},${y(p).toFixed(1)}`
  }
  const cur = Math.min(maxAge, Math.max(minAge, age))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={tr('curve.aria')}>
      {[1, 0.1, 0.01, 0.001, 0.0001].map((p) => (
        <g key={p}>
          <line className="axis" x1={pad.l} x2={W - pad.r} y1={y(p)} y2={y(p)} strokeDasharray="2 3" />
          <text x={2} y={y(p) + 3}>
            {p >= 0.01 ? `${p * 100}%` : `${p * 100}%`}
          </text>
        </g>
      ))}
      {[8, 15, 18, 22, 30, 40].map((a) => (
        <text key={a} x={x(a) - 6} y={H - 4}>
          {shownAge(a)}
        </text>
      ))}
      <path className="line" d={d} />
      {age >= minAge && <circle className="me" cx={x(cur)} cy={y(playingByAge[cur] ?? floor)} r={4} />}
    </svg>
  )
}
