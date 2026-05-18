import Link from 'next/link'
import { KeyMark, MetaStrip, Wordmark } from '@iedora/design-system'

/**
 * Editorial shell for every auth page. The lintel above, the form below.
 * Spacing is token-driven (4-pixel baseline from the design system); the
 * outer wrapper and inner padding both scale down on small viewports.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className="ds-root ds-root--washed"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        className="ds-shell ds-shell-meta"
        style={{
          maxWidth: 1100,
          paddingTop: 'clamp(var(--s-4), 5vw, var(--s-7))',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <MetaStrip
          left={<span>MMXXVI</span>}
          right={<Link href="/">Home</Link>}
        />
      </div>

      <main
        className="ds-shell"
        style={{
          maxWidth: 1100,
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingBlock: 'clamp(var(--s-7), 8vw, var(--s-10))',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div style={{ width: '100%', maxWidth: 560 }}>
          <div
            style={{
              textAlign: 'center',
              marginBottom: 'clamp(var(--s-6), 6vw, var(--s-8))',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--s-2)',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'end',
                gap: 'clamp(10px, 2vw, 18px)',
              }}
            >
              <KeyMark
                className="ds-auth-key"
                ariaLabel="iedora — identity"
              />
              <Wordmark
                variant="display"
                className="ds-auth-wordmark ds-wordmark--reveal"
              />
            </div>
            <span
              style={{
                fontFamily: 'var(--serif)',
                fontStyle: 'italic',
                fontSize: 'var(--t-lg)',
                color: 'var(--ink-70)',
              }}
            >
              the entryway
            </span>
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
