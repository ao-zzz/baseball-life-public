import type { ReactNode } from 'react'

/** a panel that can be folded: shut at first, a click on its title opens it (the result screen, PROJECT_PLAN §11.49); without `fold` it is the plain panel */
export function Panel({ fold, className = '', title, children }: { fold?: boolean; className?: string; title: ReactNode; children: ReactNode }) {
  if (!fold)
    return (
      <section className={`panel ${className}`}>
        <h3>{title}</h3>
        {children}
      </section>
    )
  return (
    <details className={`panel fold ${className}`}>
      <summary>
        <h3>{title}</h3>
      </summary>
      <div className="foldbody">{children}</div>
    </details>
  )
}
