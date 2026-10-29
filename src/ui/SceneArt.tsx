import type { LifeState } from '../engine/types.ts'

// The scene strip above the caption: a flat, original drawing (no pixel art from the reference works).
// It changes with the stage of life: home, a ball field, a stadium, a town.

type Kind = 'home' | 'field' | 'stadium' | 'town'

function kindOf(life: LifeState): Kind {
  const p = life.career.phase
  if (p === 'pro' || p === 'proMinor' || p === 'abroad') return 'stadium'
  if (p === 'youth' || p === 'jhs' || p === 'hs' || p === 'univ' || p === 'company' || p === 'indep') return 'field'
  if (life.age >= 18) return 'town'
  return 'home'
}

export function SceneArt({ life }: { life: LifeState }) {
  const kind = kindOf(life)
  return (
    <svg viewBox="0 0 520 120" preserveAspectRatio="xMidYMax slice" width="100%" height="100%" role="presentation">
      <rect width="520" height="120" fill="var(--teal-weak)" />
      <circle cx="74" cy="30" r="12" fill="var(--surface)" opacity="0.9" />
      <path d="M0 92 Q90 70 180 88 T360 84 T520 86 V120 H0 Z" fill="var(--map-lo)" />
      <rect y="96" width="520" height="24" fill="var(--line-2)" />
      {kind === 'home' && (
        <g>
          <rect x="300" y="62" width="64" height="36" fill="var(--surface)" stroke="var(--line)" />
          <path d="M292 64 L332 40 L372 64 Z" fill="var(--accent)" opacity="0.75" />
          <rect x="324" y="76" width="14" height="22" fill="var(--text-3)" opacity="0.6" />
          <rect x="140" y="70" width="6" height="28" fill="var(--text-3)" opacity="0.6" />
          <circle cx="143" cy="64" r="16" fill="var(--good)" opacity="0.55" />
        </g>
      )}
      {kind === 'field' && (
        <g>
          <path d="M170 98 Q260 62 350 98 Z" fill="var(--gold)" opacity="0.35" />
          <path d="M260 92 L276 84 L260 76 L244 84 Z" fill="none" stroke="var(--surface)" strokeWidth="2" />
          <circle cx="260" cy="84" r="2.5" fill="var(--surface)" />
          {[60, 80, 100, 420, 440, 460].map((x) => (
            <rect key={x} x={x} y="58" width="2" height="40" fill="var(--text-3)" opacity="0.5" />
          ))}
          <path d="M60 60 H102 M420 60 H462" stroke="var(--text-3)" strokeWidth="1.5" opacity="0.5" />
        </g>
      )}
      {kind === 'stadium' && (
        <g>
          <path d="M40 98 L80 52 H440 L480 98 Z" fill="var(--text-3)" opacity="0.35" />
          <path d="M80 52 H440" stroke="var(--line)" strokeWidth="2" />
          {[110, 410].map((x) => (
            <g key={x}>
              <rect x={x} y="18" width="3" height="34" fill="var(--text-3)" opacity="0.7" />
              <rect x={x - 9} y="12" width="21" height="8" fill="var(--surface)" stroke="var(--line)" />
            </g>
          ))}
          <path d="M200 98 Q260 78 320 98 Z" fill="var(--good)" opacity="0.4" />
        </g>
      )}
      {kind === 'town' && (
        <g opacity="0.75">
          {[
            [250, 50, 28],
            [282, 38, 22],
            [308, 58, 30],
            [342, 46, 24],
            [370, 64, 26],
          ].map(([x, y, w]) => (
            <rect key={x} x={x} y={y} width={w} height={98 - y} fill="var(--surface)" stroke="var(--line)" />
          ))}
          <rect x="120" y="74" width="5" height="24" fill="var(--text-3)" opacity="0.6" />
          <circle cx="122" cy="68" r="13" fill="var(--good)" opacity="0.55" />
        </g>
      )}
    </svg>
  )
}
