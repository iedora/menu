'use client'

import { useRef, useState, useEffect } from 'react'

export type Chip = {
  id: string
  label: string
}

export type ChipNavProps = {
  chips: ReadonlyArray<Chip>
  activeId?: string | null
  onSelect: (id: string) => void
  addLabel?: string
  onAdd?: () => void
  ariaLabel?: string
  testId?: string
}

/**
 * Iedora Manual § VI.10 — Chip nav.
 *
 * Horizontal scrollable pill row for filter tabs, section navigation,
 * or integrator tags. Extracted from menu-builder so every product
 * (menu, imopush, future) uses the same sticky nav surface.
 *
 *   <ChipNav
 *     chips={[{ id: 'idealista', label: 'Idealista' }, { id: 'olx', label: 'OLX' }]}
 *     activeId="idealista"
 *     onSelect={(id) => setActive(id)}
 *   />
 */
export function ChipNav({
  chips,
  activeId,
  onSelect,
  addLabel,
  onAdd,
  ariaLabel,
  testId,
}: ChipNavProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const chipRefs = useRef(new Map<string, HTMLButtonElement>())
  const [active, setActive] = useState<string | null>(activeId ?? chips[0]?.id ?? null)

  // Sync external activeId changes.
  useEffect(() => {
    if (activeId !== undefined) setActive(activeId)
  }, [activeId])

  // Keep the active chip horizontally visible.
  useEffect(() => {
    if (!active) return
    const chip = chipRefs.current.get(active)
    const scroller = scrollerRef.current
    if (!chip || !scroller) return
    const chipBox = chip.getBoundingClientRect()
    const scrollerBox = scroller.getBoundingClientRect()
    if (chipBox.left < scrollerBox.left || chipBox.right > scrollerBox.right) {
      chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [active])

  function select(id: string) {
    setActive(id)
    onSelect(id)
  }

  return (
    <nav aria-label={ariaLabel} data-test-id={testId} className="ds-chip-nav">
      <div ref={scrollerRef} className="ds-chip-nav__scroll">
        {chips.map((c) => {
          const isActive = c.id === active
          return (
            <button
              key={c.id}
              type="button"
              ref={(node) => {
                if (node) chipRefs.current.set(c.id, node)
                else chipRefs.current.delete(c.id)
              }}
              onClick={() => select(c.id)}
              aria-current={isActive ? 'true' : undefined}
              data-active={isActive ? 'true' : 'false'}
              className="ds-chip-nav__chip"
            >
              {c.label}
            </button>
          )
        })}
        {addLabel && onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="ds-chip-nav__chip ds-chip-nav__chip--add"
          >
            {addLabel}
          </button>
        )}
      </div>
    </nav>
  )
}
