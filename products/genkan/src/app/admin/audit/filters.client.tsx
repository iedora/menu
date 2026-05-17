'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Badge, Button, FieldInput } from '@iedora/design-system'

const DATE_RANGES = [
  { id: '24h', label: 'Last 24h' },
  { id: '7d', label: 'Last 7d' },
  { id: '30d', label: 'Last 30d' },
  { id: 'all', label: 'All' },
] as const

type FiltersProps = {
  actions: readonly string[]
  targetTypes: readonly string[]
}

/**
 * Filter bar for /admin/audit. State is reflected in the URL so deep-linking
 * to a filtered view just works. The page is a Server Component — every
 * filter change pushes a new URL, the page re-fetches, and the table
 * re-renders.
 *
 * Filters:
 *   - actor      (substring on user email)
 *   - actions[]  (multi-select on event literal)
 *   - target_type
 *   - target_id  (substring)
 *   - range      (24h | 7d | 30d | all)
 *
 * Cursor pagination is handled by the page itself via a "Next" link, NOT
 * here — every filter change resets to the first page.
 */
export function AuditFilters({ actions, targetTypes }: FiltersProps) {
  const router = useRouter()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  const [actor, setActor] = useState(params.get('actor') ?? '')
  const [targetId, setTargetId] = useState(params.get('target_id') ?? '')
  const [targetType, setTargetType] = useState(params.get('target_type') ?? '')
  const [range, setRange] = useState(params.get('range') ?? 'all')
  const [selectedActions, setSelectedActions] = useState<Set<string>>(
    () => new Set(params.getAll('action')),
  )

  function commit(next: URLSearchParams) {
    next.delete('cursor_at')
    next.delete('cursor_id')
    startTransition(() => {
      router.push(`?${next.toString()}`, { scroll: false })
    })
  }

  function apply(e: React.FormEvent) {
    e.preventDefault()
    const sp = new URLSearchParams()
    if (actor.trim()) sp.set('actor', actor.trim())
    if (targetId.trim()) sp.set('target_id', targetId.trim())
    if (targetType) sp.set('target_type', targetType)
    if (range !== 'all') sp.set('range', range)
    for (const a of selectedActions) sp.append('action', a)
    commit(sp)
  }

  function clear() {
    setActor('')
    setTargetId('')
    setTargetType('')
    setRange('all')
    setSelectedActions(new Set())
    commit(new URLSearchParams())
  }

  function toggleAction(a: string) {
    setSelectedActions((prev) => {
      const next = new Set(prev)
      if (next.has(a)) next.delete(a)
      else next.add(a)
      return next
    })
  }

  return (
    <form
      onSubmit={apply}
      style={{
        display: 'grid',
        gap: 12,
        marginBottom: 24,
        paddingBottom: 24,
        borderBottom: '1px solid var(--ink-14)',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={hintStyle}>Actor email</span>
          <FieldInput
            type="search"
            value={actor}
            onChange={(e) => setActor(e.currentTarget.value)}
            placeholder="someone@example.com"
            disabled={pending}
          />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={hintStyle}>Target id</span>
          <FieldInput
            type="search"
            value={targetId}
            onChange={(e) => setTargetId(e.currentTarget.value)}
            placeholder="user_… / org_… / client_…"
            disabled={pending}
          />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={hintStyle}>Target type</span>
          <select
            value={targetType}
            onChange={(e) => setTargetType(e.currentTarget.value)}
            disabled={pending}
            style={selectStyle}
          >
            <option value="">Any</option>
            {targetTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={hintStyle}>Date range</span>
          <select
            value={range}
            onChange={(e) => setRange(e.currentTarget.value)}
            disabled={pending}
            style={selectStyle}
          >
            {DATE_RANGES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <div style={hintStyle}>Action</div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            marginTop: 6,
          }}
        >
          {actions.map((a) => {
            const active = selectedActions.has(a)
            return (
              <button
                key={a}
                type="button"
                onClick={() => toggleAction(a)}
                disabled={pending}
                style={{
                  background: 'none',
                  border: 0,
                  padding: 0,
                  cursor: 'pointer',
                }}
                aria-pressed={active}
              >
                <Badge variant={active ? 'ink' : 'default'}>{a}</Badge>
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <Button type="submit" variant="accent" disabled={pending}>
          {pending ? 'Applying…' : 'Apply'}
        </Button>
        <Button type="button" variant="ghost" onClick={clear} disabled={pending}>
          Clear
        </Button>
      </div>
    </form>
  )
}

const hintStyle: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 10.5,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--ink-55)',
}

const selectStyle: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 13,
  padding: '8px 10px',
  border: '1px solid var(--ink-14)',
  background: 'var(--paper)',
  color: 'var(--ink)',
}
