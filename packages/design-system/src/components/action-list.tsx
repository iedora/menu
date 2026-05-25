import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

export type ActionItem = {
  key: string
  label: string
  icon?: ReactNode
  danger?: boolean
  onClick: () => void
}

export type ActionListProps = {
  items: ActionItem[]
  className?: string
}

/**
 * Iedora Manual § VI — Action list.
 *
 * Vertical row of large-touch-target actions. Extracted from
 * menu-builder so every product shares the same action-sheet surface
 * (dialogs, settings sheets, overflow menus).
 */
export function ActionList({ items, className }: ActionListProps) {
  return (
    <div className={cn('ds-action-list', className)}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={item.onClick}
          className={cn(
            'ds-action-list__item',
            item.danger && 'ds-action-list__item--danger',
          )}
        >
          {item.icon && <span className="shrink-0">{item.icon}</span>}
          {item.label}
        </button>
      ))}
    </div>
  )
}
