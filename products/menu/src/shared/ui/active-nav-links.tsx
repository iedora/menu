'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NavLink, NavLinks } from '@iedora/design-system'

/**
 * Next-aware bridge between the design-system `<NavLinks>` shell and
 * the app's current route. Lives in the menu app, not in the design
 * system, because the rule is "DS primitives stay framework-agnostic"
 * — the wrapper is the place Next gets to leak through.
 *
 * Active matching:
 *   - Exact `pathname === href` always wins.
 *   - For nested routes, `pathname.startsWith(href + '/')` also marks
 *     the parent active (so `/dashboard/admin/qr-codes` keeps the
 *     "Admin" link lit).
 *   - `/dashboard` is opt-in via `matchPrefix: false` so the root
 *     never matches every page underneath it.
 *
 * One client island for the whole nav (not per-link) — `usePathname`
 * is cheap but we don't need N readers when one will do.
 */

export type ActiveNavItem = {
  href: string
  label: string
  testId?: string
  /**
   * When false, only an exact `pathname === href` counts as active.
   * Defaults to true so nested routes light up the parent link.
   */
  matchPrefix?: boolean
}

export function ActiveNavLinks({
  items,
  ariaLabel = 'Primary',
}: {
  items: ReadonlyArray<ActiveNavItem>
  ariaLabel?: string
}) {
  const pathname = usePathname() ?? '/'
  return (
    <NavLinks aria-label={ariaLabel}>
      {items.map((item) => {
        const active = isActive(pathname, item)
        return (
          <NavLink
            key={item.href}
            asChild
            active={active}
            data-test-id={item.testId}
          >
            <Link href={item.href}>{item.label}</Link>
          </NavLink>
        )
      })}
    </NavLinks>
  )
}

function isActive(pathname: string, item: ActiveNavItem): boolean {
  if (pathname === item.href) return true
  if (item.matchPrefix === false) return false
  return pathname.startsWith(item.href + '/')
}
