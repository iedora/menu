'use client'

import { useActionState, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Button,
  Card,
  CardDesc,
  CardFoot,
  CardTitle,
  Field,
  FieldInput,
  FieldLabel,
} from '@iedora/design-system'
import { APP_HOSTNAME } from '@/shared/brand'
import { completeOnboarding, type OnboardingFormState } from './actions'

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export function OnboardingForm() {
  const t = useTranslations('Onboarding')
  const [state, action, pending] = useActionState<OnboardingFormState, FormData>(
    completeOnboarding,
    undefined,
  )
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)

  return (
    <Card>
      <span className="font-serif text-[13px] italic text-muted-foreground">
        {t('eyebrow')}
      </span>
      <CardTitle as="h2">{t('title')}</CardTitle>
      <CardDesc>{t('subtitle')}</CardDesc>
      <form action={action}>
        <div className="space-y-4">
          <Field error={Boolean(state?.fieldErrors?.restaurantName)}>
            <FieldLabel htmlFor="restaurantName">{t('restaurantName')}</FieldLabel>
            <FieldInput
              id="restaurantName"
              name="restaurantName"
              type="text"
              required
              minLength={2}
              maxLength={80}
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (!slugTouched) setSlug(slugify(e.target.value))
              }}
              placeholder={t('restaurantNamePlaceholder')}
            />
            {state?.fieldErrors?.restaurantName && (
              <p className="text-sm text-destructive">{state.fieldErrors.restaurantName}</p>
            )}
          </Field>
          <Field error={Boolean(state?.fieldErrors?.slug)}>
            <FieldLabel htmlFor="slug">{t('slug')}</FieldLabel>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground">{APP_HOSTNAME}/r/</span>
              <FieldInput
                id="slug"
                name="slug"
                type="text"
                required
                minLength={2}
                maxLength={40}
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true)
                  setSlug(e.target.value.toLowerCase())
                }}
              />
            </div>
            {state?.fieldErrors?.slug && (
              <p className="text-sm text-destructive">{state.fieldErrors.slug}</p>
            )}
          </Field>
          {state?.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
        </div>
        <CardFoot>
          <Button type="submit" variant="solid" className="w-full" disabled={pending}>
            {pending ? t('creating') : t('create')}
          </Button>
        </CardFoot>
      </form>
    </Card>
  )
}
