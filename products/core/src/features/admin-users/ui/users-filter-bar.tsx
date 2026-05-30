'use client'

import { useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Field,
  FieldLabel,
  FieldInput,
  Combobox,
  Button,
} from '@iedora/design-system'
import {
  IEDORA_ADMIN_ROLE,
  TENANT_USER_FILTER,
  type StaffRoleKey,
  type TenantUserFilter,
} from '@iedora/auth/role-presets'

/**
 * Filter bar for the users list. Everything is URL state — refresh,
 * deep-link, and back-button work without local React state. Submits
 * via `router.replace` so the back button isn't polluted with every
 * keystroke; the form-submit branch handles the q box on Enter.
 *
 * Mobile-first: stacks vertically; jumps to a single row at sm+.
 */
type Props = {
  /** Initial values from `searchParams` (server-side). */
  defaults: {
    q?: string
    role?: StaffRoleKey | TenantUserFilter | null
    banned?: 'true' | 'false' | null
  }
}

export function UsersFilterBar({ defaults }: Props) {
  const t = useTranslations('Core.admin.users.filters')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  function update(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '') params.delete(key)
      else params.set(key, value)
    }
    // Page resets to 1 on any filter change.
    params.delete('page')
    const next = params.toString() ? `${pathname}?${params.toString()}` : pathname
    startTransition(() => {
      router.replace(next, { scroll: false })
    })
  }

  return (
    <form
      role="search"
      data-test-id="admin-users-filter-bar"
      onSubmit={(e) => {
        e.preventDefault()
        const form = new FormData(e.currentTarget)
        update({ q: (form.get('q') as string) ?? '' })
      }}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <Field className="flex-1 min-w-0">
        <FieldLabel htmlFor="q">{t('queryLabel')}</FieldLabel>
        <FieldInput
          id="q"
          name="q"
          type="search"
          defaultValue={defaults.q ?? ''}
          placeholder={t('queryPlaceholder')}
          data-test-id="admin-users-filter-q"
          inputMode="search"
          autoComplete="off"
        />
      </Field>

      <Field className="sm:w-44">
        <FieldLabel>{t('roleLabel')}</FieldLabel>
        <Combobox
          value={defaults.role ?? null}
          onChange={(v) => update({ role: v ?? null })}
          options={[
            { value: IEDORA_ADMIN_ROLE, label: t('roleIedoraAdmin') },
            { value: TENANT_USER_FILTER, label: t('roleMember') },
          ]}
          placeholder={t('roleAny')}
          data-test-id="admin-users-filter-role"
        />
      </Field>

      <Field className="sm:w-44">
        <FieldLabel>{t('bannedLabel')}</FieldLabel>
        <Combobox
          value={defaults.banned ?? null}
          onChange={(v) => update({ banned: v ?? null })}
          options={[
            { value: 'true', label: t('bannedYes') },
            { value: 'false', label: t('bannedNo') },
          ]}
          placeholder={t('bannedAny')}
          data-test-id="admin-users-filter-banned"
        />
      </Field>

      <Button
        type="submit"
        variant="primary"
        disabled={pending}
        data-test-id="admin-users-filter-submit"
      >
        {pending ? t('applying') : t('apply')}
      </Button>
    </form>
  )
}
