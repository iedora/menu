import Link from 'next/link'
import { cn } from '@iedora/ui/lib/utils'
import { buttonVariants } from '@iedora/ui/components/ui/button-variants'
import type { EditorialAction } from './types'

/**
 * A small pill action on an editorial row's sub-line. Styled with the shadcn
 * `buttonVariants` (outline · xs) on a `next/link` so it stays RSC-safe and
 * reads as plain navigation without JS, keeping the rounded-full chip shape.
 */
export function ActionChip({ action }: { action: EditorialAction }) {
  return (
    <Link
      href={action.href}
      aria-label={action.ariaLabel ?? action.label}
      className={cn(
        buttonVariants({ variant: 'outline', size: 'xs' }),
        'rounded-full px-3 font-medium no-underline',
      )}
    >
      {action.label}
    </Link>
  )
}
