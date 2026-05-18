import Link from 'next/link'
import { MetaStrip, Wordmark } from '@iedora/design-system'
import { requireAdmin } from '@/features/admin'

/**
 * Chrome for /admin/*. Quiet MetaStrip + wordmark + nav.
 *
 * The guard at the top redirects/notFound()s before any child renders. Next
 * 16 layouts don't re-render on navigation, so this single check at the top
 * is *not* enough on its own — every page also calls `requireAdmin()` so a
 * stale layout never gates a leaked URL.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireAdmin()

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
          paddingTop: 'var(--s-6)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <MetaStrip
          left={
            <>
              <span>MMXXVI</span>
              <span>Genkan · Admin</span>
            </>
          }
          right={
            <span className="admin-meta-email" title={session.user.email}>
              {session.user.email}
            </span>
          }
        />
      </div>

      <header className="ds-shell admin-header">
        <Link
          href="/admin"
          style={{ textDecoration: 'none', display: 'inline-flex' }}
          aria-label="Admin home"
        >
          <Wordmark word="genkan" variant="inline" />
        </Link>
        <nav className="admin-nav" aria-label="Admin sections">
          <Link href="/admin/users">Users</Link>
          <Link href="/admin/organizations">Organizations</Link>
          <Link href="/admin/applications">Applications</Link>
          <Link href="/admin/webhooks">Webhooks</Link>
          <Link href="/admin/grants">Grants</Link>
          <Link href="/admin/sessions">Sessions</Link>
          <Link href="/admin/audit">Audit</Link>
        </nav>
      </header>

      <main className="ds-shell admin-main">{children}</main>
    </div>
  )
}
