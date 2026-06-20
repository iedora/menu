'use client'

import Link from 'next/link'
import { useDeferredValue, useMemo, useState } from 'react'
import { QrCode } from 'lucide-react'

export type AdminRestaurantRow = {
  id: string
  name: string
  slug: string
  tenantId: string
  menuCount: number
  dishCount: number
  views30d: number
  updatedAt: string // ISO
}

type SortKey = 'updatedAt' | 'views30d' | 'name'

const PT_COLLATOR = new Intl.Collator('pt-PT')

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'updatedAt', label: 'Recent' },
  { key: 'views30d', label: 'Most viewed' },
  { key: 'name', label: 'A–Z' },
]

/** Warm-light cross-tenant restaurants list (Pencil "Admin · Restaurants"). */
export function RestaurantsTable({ rows }: { rows: AdminRestaurantRow[] }) {
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt')
  const deferredQuery = useDeferredValue(query)

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    const list = rows.filter((r) =>
      !q
        ? true
        : r.name.toLowerCase().includes(q) ||
          r.slug.toLowerCase().includes(q) ||
          r.tenantId.toLowerCase().includes(q),
    )
    return [...list].sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return PT_COLLATOR.compare(a.name, b.name)
        case 'views30d':
          return b.views30d - a.views30d
        default:
          return a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0
      }
    })
  }, [rows, deferredQuery, sortKey])

  const hasFilters = query.length > 0

  return (
    <div className="space-y-4" data-test-id="admin-restaurants-table">
      {/* Search */}
      <div className="flex items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search restaurants…"
          aria-label="Search restaurants"
          spellCheck={false}
          className="w-full rounded-[12px] border border-border bg-card px-4 py-2.5 text-[15px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-[color-mix(in_srgb,var(--cinnabar)_22%,transparent)]"
          data-test-id="admin-restaurants-search"
        />
        {hasFilters ? (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="shrink-0 rounded-[10px] border border-border px-3 py-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            data-test-id="admin-restaurants-clear-filters"
          >
            Clear
          </button>
        ) : null}
      </div>

      {/* Sort + count */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSortKey(s.key)}
              aria-pressed={sortKey === s.key}
              className={`rounded-full border px-3 py-1 text-[13px] font-medium transition-colors ${
                sortKey === s.key
                  ? 'border-primary bg-[var(--cinnabar-soft)] text-primary'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground'
              }`}
              data-test-id={`admin-restaurants-sort-${s.key}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="text-[13px] text-muted-foreground" data-test-id="admin-restaurants-count">
          {filtered.length} of {rows.length}
        </p>
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <p className="rounded-[18px] border border-border bg-card px-4 py-10 text-center text-[14px] text-muted-foreground" data-test-id="admin-restaurants-empty">
          {hasFilters ? 'No restaurant matches your search.' : 'No restaurants on the platform yet.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((r) => {
            const live = r.dishCount > 0
            return (
              <li
                key={r.id}
                className="rounded-[18px] border border-border bg-card p-4"
                data-test-id={`admin-restaurants-row-${r.slug}`}
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--cinnabar-soft)] text-[18px] font-bold text-primary">
                    {r.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-[family-name:var(--display)] text-[16px] font-bold text-foreground">{r.name}</h3>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          live ? 'bg-[var(--green-soft)] text-[var(--green)]' : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {live ? 'Live' : 'Draft'}
                      </span>
                    </div>
                    <p className="truncate text-[13px] text-muted-foreground">iedora.com/m/{r.slug}</p>
                    <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                      {r.menuCount} menu{r.menuCount === 1 ? '' : 's'} · {r.dishCount} dish{r.dishCount === 1 ? '' : 'es'} ·{' '}
                      {r.views30d.toLocaleString()} views
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Link
                    href={`/dashboard/r/${r.slug}/qr`}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-border bg-card px-3 py-2 text-[13.5px] font-semibold text-foreground no-underline transition-colors hover:border-[color-mix(in_srgb,var(--cinnabar)_40%,transparent)]"
                  >
                    <QrCode size={15} strokeWidth={2.2} /> QR code
                  </Link>
                  <Link
                    href={`/dashboard/r/${r.slug}`}
                    className="inline-flex flex-1 items-center justify-center rounded-[10px] bg-primary px-3 py-2 text-[13.5px] font-semibold text-white no-underline transition-colors hover:bg-[var(--cinnabar-deep)]"
                  >
                    Manage
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
