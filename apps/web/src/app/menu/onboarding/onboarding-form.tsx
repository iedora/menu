'use client'

import { useActionState, useRef, useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { completeOnboarding, type OnboardingFormState } from './actions'

/**
 * Step 1 form. Two fields land on the form:
 *   - restaurantName (required) — bound to `restaurant.name`
 *   - tagline (optional) — bound to `restaurant.description`; renders
 *     as the small italic line under the name on the public menu
 *
 * The styling lives in `./onboarding.css` (paper-card aesthetic): no
 * DS primitives here on purpose, this surface owns its visual idiom.
 * Server action is unchanged — `completeOnboarding` parses the same
 * shape it always did, plus the new optional `tagline` field.
 */
export function OnboardingForm() {
  const t = useTranslations('Onboarding')
  const [state, action, pending] = useActionState<OnboardingFormState, FormData>(
    completeOnboarding,
    undefined,
  )
  const [name, setName] = useState('')
  const [tagline, setTagline] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  const nameError = state?.fieldErrors?.restaurantName
  const taglineError = state?.fieldErrors?.tagline

  return (
    <form
      action={action}
      className="onb-view"
      data-test-id="onboarding-form"
    >
      <div className="onb-lede">
        <h1>{t('title')}</h1>
        <p>
          {t('subtitle')} <em>{t('subtitleAside')}</em>
        </p>
      </div>

      <div className="onb-field">
        <label className="onb-field__label" htmlFor="restaurantName">
          {t('restaurantName')}
        </label>
        <input
          ref={nameRef}
          id="restaurantName"
          name="restaurantName"
          type="text"
          required
          minLength={2}
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('restaurantNamePlaceholder')}
          className="onb-field__input"
          aria-invalid={Boolean(nameError) || undefined}
          data-test-id="onboarding-restaurant-name"
        />
        {nameError && (
          <p
            className="onb-field__error"
            role="alert"
            data-test-id="onboarding-field-error-name"
          >
            {nameError}
          </p>
        )}
      </div>

      <div className="onb-field">
        <label className="onb-field__label" htmlFor="tagline">
          {t('tagline')}{' '}
          <span className="onb-field__label-aside">{t('optional')}</span>
        </label>
        <input
          id="tagline"
          name="tagline"
          type="text"
          maxLength={120}
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          placeholder={t('taglinePlaceholder')}
          className="onb-field__input"
          aria-invalid={Boolean(taglineError) || undefined}
          data-test-id="onboarding-tagline"
        />
        <p className="onb-field__hint">{t('taglineHint')}</p>
        {taglineError && (
          <p
            className="onb-field__error"
            role="alert"
            data-test-id="onboarding-field-error-tagline"
          >
            {taglineError}
          </p>
        )}
      </div>

      {state?.error && (
        <p
          className="onb-field__error"
          role="alert"
          data-test-id="onboarding-error"
          style={{ textAlign: 'center', marginTop: 18 }}
        >
          {state.error}
        </p>
      )}

      <div className="onb-row">
        <button
          type="submit"
          className="onb-btn onb-btn--primary"
          disabled={!name.trim() || pending}
          data-test-id="onboarding-submit"
        >
          {pending ? t('creating') : t('cta')}
        </button>
      </div>
    </form>
  )
}
