import type { CSSProperties, ReactNode } from 'react'
import { cn } from '../lib/cn'

export type StatusChipVariant = 'success' | 'danger' | 'neutral'

export type StatusChipProps = {
  label: string
  icon?: ReactNode
  variant?: StatusChipVariant
  className?: string
}

const DANGER_STYLE: CSSProperties = {
  background: '#fef2f2',
  borderColor: '#ef4444',
  color: '#dc2626',
  minHeight: 0,
  padding: '2px 7px',
}

const NEUTRAL_STYLE: CSSProperties = {
  minHeight: 0,
  padding: '2px 7px',
}

/**
 * Pill chip with three visual variants built on top of `ds-chip-nav__chip`.
 *
 * - **success** — filled black/ink background (via `data-active="true"`)
 * - **danger** — red stroke + light red fill
 * - **neutral** — default outline (muted border, paper background)
 */
export function StatusChip({ label, icon, variant = 'neutral', className }: StatusChipProps) {
  return (
    <span
      className={cn(
        'ds-chip-nav__chip inline-flex items-center gap-1 no-underline leading-none',
        className,
      )}
      data-active={variant === 'success' ? 'true' : 'false'}
      role="status"
      style={variant === 'danger' ? DANGER_STYLE : NEUTRAL_STYLE}
    >
      {icon}
      {label}
    </span>
  )
}
