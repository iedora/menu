'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  Button,
  Field,
  FieldLabel,
  FieldInput,
  FieldHint,
  FieldTextarea,
} from '@iedora/design-system'
import { banUserAction } from '../actions'

type Props = {
  userId: string
  userEmail: string
  triggerLabel?: string
  /** Renders trigger inside the dropdown row instead of a standalone button. */
  asChild?: boolean
  children?: React.ReactNode
}

export function BanUserDialog({
  userId,
  userEmail,
  triggerLabel,
  // The default trigger IS a <Button>, and the caller's custom
  // children are virtually always also a button/menu-item. Defaulting
  // to true means DialogTrigger uses Radix's <Slot> to merge with the
  // child instead of wrapping it — no nested <button> hydration error.
  asChild = true,
  children,
}: Props) {
  const t = useTranslations('Core.admin.users.ban')
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [days, setDays] = useState<string>('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = await banUserAction({
        userId,
        reason: reason || undefined,
        expiresInDays: days ? Number(days) : undefined,
      })
      if (!result.ok) {
        setError(t('errorGeneric'))
        return
      }
      setOpen(false)
      setReason('')
      setDays('')
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild={asChild}>
        {children ?? (
          <Button variant="ghost" data-test-id={`admin-users-ban-trigger-${userId}`}>
            {triggerLabel ?? t('trigger')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent data-test-id={`admin-users-ban-dialog-${userId}`}>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description', { email: userEmail })}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 p-6">
          <Field>
            <FieldLabel htmlFor="ban-reason">{t('reasonLabel')}</FieldLabel>
            <FieldTextarea
              id="ban-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('reasonPlaceholder')}
              rows={3}
              data-test-id={`admin-users-ban-reason-${userId}`}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="ban-days">{t('daysLabel')}</FieldLabel>
            <FieldInput
              id="ban-days"
              type="number"
              min={1}
              inputMode="numeric"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              placeholder={t('daysPlaceholder')}
              data-test-id={`admin-users-ban-days-${userId}`}
            />
            <FieldHint>{t('daysHint')}</FieldHint>
          </Field>
          {error ? (
            <p
              role="alert"
              className="text-sm text-[var(--cinnabar)]"
              data-test-id={`admin-users-ban-error-${userId}`}
            >
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">{t('cancel')}</Button>
          </DialogClose>
          <Button
            variant="primary"
            onClick={submit}
            disabled={pending}
            data-test-id={`admin-users-ban-confirm-${userId}`}
          >
            {pending ? t('submitting') : t('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
