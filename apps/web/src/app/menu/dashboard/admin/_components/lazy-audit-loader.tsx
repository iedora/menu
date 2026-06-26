'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { AuditRecord } from '@iedora/product-menu/shared/api'
import { Button } from '@iedora/ui/components/ui/button'
import { AuditLog } from './audit-log'

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; events: AuditRecord[] }

/**
 * Lazy audit timeline for a record tab. Base UI's Tabs.Panel unmounts inactive
 * panels, so this (and its fetch) mounts only when the tab is opened — the audit
 * DB is never touched on a plain record view. The single source for both the
 * "Activity" (everything) and "Logins" (sign-ins only) tabs; they differ only by
 * the `loader`.
 */
export function LazyAuditLoader({
  arg,
  loader,
  testId,
}: {
  arg: string
  loader: (arg: string) => Promise<AuditRecord[]>
  testId?: string
}) {
  const t = useTranslations('Admin')
  const [state, setState] = useState<State>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    loader(arg)
      .then((events) => {
        if (!cancelled) setState({ status: 'ready', events })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [arg, attempt, loader])

  if (state.status === 'loading') {
    return (
      <p className="py-3 text-[14px] text-muted-foreground" data-test-id={testId ? `${testId}-loading` : undefined}>
        {t('audit.loading')}
      </p>
    )
  }
  if (state.status === 'error') {
    return (
      <div className="flex flex-col items-start gap-2 py-3" data-test-id={testId ? `${testId}-error` : undefined}>
        <p className="text-[14px] text-destructive">{t('audit.error')}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)}>
          {t('audit.retry')}
        </Button>
      </div>
    )
  }
  return <AuditLog events={state.events} />
}
