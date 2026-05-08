import Link from 'next/link'
import type { EditorialAction } from './types'

/**
 * Small uppercase chip that links to a sub-page of the row's owner.
 * Square corners + hairline border to match the printed-carta vocabulary.
 * Stops event propagation so clicking a chip doesn't also trigger the
 * outer row link.
 */
export function ActionChip({ action }: { action: EditorialAction }) {
  return (
    <Link
      href={action.href}
      aria-label={action.ariaLabel ?? action.label}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center border border-border bg-background px-2.5 py-1 text-[11.5px] uppercase tracking-[0.04em] text-foreground no-underline transition-colors hover:bg-foreground hover:text-background hover:border-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {action.label}
    </Link>
  )
}
