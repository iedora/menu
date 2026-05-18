import type { CSSProperties, ReactNode } from 'react'

/**
 * Shared editorial bits for the /admin pages. Page heads share the same
 * eyebrow / serif title / italic note pattern. Layout lives in globals.css
 * under .admin-pagehead* so the responsive behaviour is testable in CSS.
 */

const eyebrowStyle: CSSProperties = {
  display: 'block',
  fontFamily: 'var(--mono)',
  fontSize: 10.5,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--ink-55)',
  marginBottom: 12,
}

export function PageHead({
  eyebrow,
  title,
  note,
  actions,
}: {
  eyebrow: ReactNode
  title: ReactNode
  note?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="admin-pagehead">
      <div>
        <span style={eyebrowStyle}>{eyebrow}</span>
        <h1 className="admin-pagehead__title">{title}</h1>
        {note ? <p className="admin-pagehead__note">{note}</p> : null}
      </div>
      {actions ? (
        <div className="admin-pagehead__actions">{actions}</div>
      ) : null}
    </div>
  )
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <span style={eyebrowStyle}>{children}</span>
}

const monoStyle: CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 11,
  color: 'var(--ink-70)',
}

export function Mono({
  children,
  style,
}: {
  children: ReactNode
  style?: CSSProperties
}) {
  return <span style={{ ...monoStyle, ...style }}>{children}</span>
}

/** Hairline separator between sections within a page. */
export function SectionRule({ children }: { children?: ReactNode }) {
  return (
    <div
      style={{
        borderTop: '1px solid var(--ink-14)',
        marginTop: 36,
        marginBottom: 24,
        paddingTop: 24,
      }}
    >
      {children}
    </div>
  )
}
