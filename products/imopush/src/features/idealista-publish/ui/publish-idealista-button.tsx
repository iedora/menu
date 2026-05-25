'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@iedora/design-system'
import { publishToIdealista } from '../actions'

type Props = {
  reference: string
  /** Show smaller label after a previous failure. */
  retry?: boolean
}

export function PublishIdealistaButton({ reference, retry }: Props) {
  const t = useTranslations('IdealistaPublish')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onClick() {
    setError(null)
    startTransition(async () => {
      const result = await publishToIdealista(reference)
      if (!result.ok) setError(result.error)
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="accent"
        onClick={onClick}
        disabled={isPending}
        data-test-id={`idealista-publish-${reference}`}
      >
        {isPending ? t('publishing') : retry ? t('retry') : t('publish')}
      </Button>
      {error && (
        <span className="text-[11px] text-[var(--cinnabar)]" data-test-id="idealista-publish-error">
          {error}
        </span>
      )}
    </div>
  )
}
