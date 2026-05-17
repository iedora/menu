import Link from 'next/link'
import { MetaStrip, Wordmark } from '@iedora/design-system'

/**
 * Editorial shell for every auth page. The lintel above, the form below.
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
        style={{
          width: 'min(1100px, 100%)',
          margin: '0 auto',
          padding: '36px 56px 0',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <MetaStrip
          left={
            <>
              <span>MMXXVI</span>
              <span>Genkan · Identity</span>
            </>
          }
          right={<Link href="/">Home</Link>}
        />
      </div>

      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '64px 24px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div style={{ width: '100%', maxWidth: 560 }}>
          <div
            style={{
              textAlign: 'center',
              marginBottom: 48,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Wordmark variant="display" />
            <span
              style={{
                fontFamily: 'var(--serif)',
                fontStyle: 'italic',
                fontSize: 17,
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
