'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { createTenantAndRestaurantAction } from './actions'

/**
 * Inline form for admin-driven restaurant creation. Mobile-first:
 * stacked fields, tap targets ≥44px, single submit. Collapsed by
 * default behind a toggle so the table reads first.
 *
 * On success → push to /menu/dashboard/r/[slug] (admin is the tenant
 * founder so the slug guard lets them in), where they build the menu.
 */
export function CreateRestaurantForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [restaurantName, setRestaurantName] = useState('')
  const [tenantName, setTenantName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (restaurantName.trim().length === 0) {
      setError('Nome do restaurante é obrigatório.')
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await createTenantAndRestaurantAction({
        restaurantName,
        tenantName: tenantName.trim() || undefined,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      // Land on step 2 of the menu onboarding wizard — same flow a
      // tenant user follows: photo / AI / sample / blank. Admin gets
      // the unlimited AI bypass (`staff:menu:ai:unlimited`).
      router.push(`/menu/onboarding/menu/${res.slug}`)
      router.refresh()
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded border border-dashed border-[var(--ink-40)] px-4 py-4 text-sm text-[var(--ink-55)] hover:border-[var(--ink)] hover:text-[var(--ink)] sm:w-auto"
        data-test-id="admin-restaurants-create-open"
      >
        + Criar restaurante
      </button>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded border border-[var(--ink)] bg-[var(--paper)] p-4"
      data-test-id="admin-restaurants-create-form"
    >
      <h2 className="font-[family-name:var(--serif)] text-lg">Criar restaurante</h2>
      <p className="text-sm text-[var(--ink-55)]">
        Cria um tenant novo (tu como owner) + o restaurante. Tu constróis
        o menu. Depois transferes a propriedade ao cliente.
      </p>

      <div>
        <label
          htmlFor="cr-name"
          className="block text-xs uppercase tracking-[0.18em] text-[var(--ink-55)] mb-2"
        >
          Nome do restaurante
        </label>
        <input
          id="cr-name"
          type="text"
          autoComplete="organization"
          value={restaurantName}
          onChange={(e) => setRestaurantName(e.target.value)}
          className="w-full rounded border border-[var(--ink-14)] bg-transparent px-3 py-3 text-sm"
          placeholder="Taberna do José"
          data-test-id="admin-restaurants-create-name"
        />
      </div>

      <div>
        <label
          htmlFor="cr-tenant"
          className="block text-xs uppercase tracking-[0.18em] text-[var(--ink-55)] mb-2"
        >
          Nome do tenant{' '}
          <span className="text-[var(--ink-40)] normal-case tracking-normal">
            (opcional — usa o nome do restaurante se em branco)
          </span>
        </label>
        <input
          id="cr-tenant"
          type="text"
          autoComplete="off"
          value={tenantName}
          onChange={(e) => setTenantName(e.target.value)}
          className="w-full rounded border border-[var(--ink-14)] bg-transparent px-3 py-3 text-sm"
          placeholder=""
          data-test-id="admin-restaurants-create-tenant"
        />
      </div>

      {error && (
        <p
          className="rounded border border-[var(--cinnabar)] bg-[var(--cinnabar-15)] px-3 py-2 text-sm text-[var(--cinnabar)]"
          role="alert"
          data-test-id="admin-restaurants-create-error"
        >
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setError(null)
          }}
          className="flex-1 rounded border border-[var(--ink-14)] px-3 py-3 text-sm"
          data-test-id="admin-restaurants-create-cancel"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded bg-[var(--ink)] px-3 py-3 text-sm font-semibold text-[var(--paper)] disabled:opacity-50"
          data-test-id="admin-restaurants-create-submit"
        >
          {pending ? 'A criar…' : 'Criar'}
        </button>
      </div>
    </form>
  )
}
