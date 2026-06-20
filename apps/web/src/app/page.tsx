// Dev surface index. In production every known host rewrites to its own surface
// (middleware in proxy.ts), so this page is only reached by a host that matches
// NO surface — e.g. a stray `*.iedora.com` subdomain via the wildcard tunnel, or
// bare localhost in dev. Serving the surface map to such a request leaks our
// routing topology, so outside dev we 404 instead of rendering the index.
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { surfaces } from '../generated/surfaces'

export default function DevSurfaceIndex() {
  if (process.env.NODE_ENV === 'production') notFound()

  const entries = surfaces.map((s) => ({
    name: s.name,
    href: s.rewritePath || '/',
  }))

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--background)] p-8 text-[var(--foreground)]">
      <h1 className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
        iedora · dev surface index
      </h1>
      <ul className="flex flex-col items-center gap-3">
        {entries.map((s) => (
          <li key={s.name}>
            <Link
              href={s.href}
              className="text-[17px] no-underline underline-offset-4 hover:underline"
              data-test-id={`dev-index-link-${s.name}`}
            >
              /{s.name}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
