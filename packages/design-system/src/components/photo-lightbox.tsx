'use client'

import { useState, useCallback, useEffect } from 'react'
import { Dialog as RadixDialog } from 'radix-ui'
import { cn } from '../lib/cn'

export type PhotoLightboxLabels = {
  empty?: string
  expand?: string
  previous?: string
  next?: string
  close?: string
}

export type PhotoLightboxProps = {
  /** Ordered list of image URLs (any S3/R2/CDN URL; no transforms applied). */
  urls: string[]
  /**
   * Stable id used to namespace `data-test-id` selectors on every interactive
   * sub-element (`{testId}-expand`, `{testId}-prev`, `{testId}-next`,
   * `{testId}-lightbox`, `{testId}-lightbox-prev`, `{testId}-lightbox-next`,
   * `{testId}-lightbox-close`).
   */
  testId: string
  /**
   * Visual density.
   * - `compact` — list/CRM rows; small arrows, small counter.
   * - `large` — detail-page hero; larger arrows + counter.
   */
  size?: 'compact' | 'large'
  /** Optional alt text override; defaults to `Photo {n}`. */
  alt?: (index: number) => string
  /** Localised labels for aria + the empty-state caption. */
  labels?: PhotoLightboxLabels
}

const DEFAULT_LABELS: Required<PhotoLightboxLabels> = {
  empty: 'No photo',
  expand: 'Expand photo',
  previous: 'Previous photo',
  next: 'Next photo',
  close: 'Close',
}

/**
 * Iedora Manual § VI — Photo lightbox.
 *
 * A single-thumbnail surface with prev/next hover arrows that opens a
 * fullscreen lightbox on click. Reused by every product that shows a list
 * of photos inside a tight slot (CRM rows, list-items, detail strips).
 *
 *   <PhotoLightbox urls={property.photoUrls ?? []} testId={`property-${id}`} size="compact" />
 *
 * Distinct from `<ImageCarousel>` (full hero + thumbnail strip below): this
 * primitive uses ONE visible image at a time and reserves the fullscreen
 * lightbox for expansion. Both are exported; pick the one that matches the
 * slot.
 */
export function PhotoLightbox({
  urls,
  testId,
  size = 'compact',
  alt = (i) => `Photo ${i + 1}`,
  labels,
}: PhotoLightboxProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const [idx, setIdx] = useState(0)
  const [open, setOpen] = useState(false)

  // Clamp index when the URL list shrinks externally.
  useEffect(() => {
    if (idx >= urls.length) setIdx(0)
  }, [idx, urls.length])

  const total = urls.length
  const current = urls[idx]

  const prev = useCallback(
    (e?: React.MouseEvent | React.KeyboardEvent) => {
      e?.preventDefault()
      e?.stopPropagation()
      if (total <= 1) return
      setIdx((i) => (i - 1 + total) % total)
    },
    [total],
  )
  const next = useCallback(
    (e?: React.MouseEvent | React.KeyboardEvent) => {
      e?.preventDefault()
      e?.stopPropagation()
      if (total <= 1) return
      setIdx((i) => (i + 1) % total)
    },
    [total],
  )

  // Keyboard nav inside the lightbox. Radix handles Escape via Dialog.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, prev, next])

  if (!current) {
    return (
      <div
        className={cn('ds-photo-lightbox__empty', `ds-photo-lightbox__empty--${size}`)}
        data-test-id={`${testId}-empty`}
      >
        {t.empty}
      </div>
    )
  }

  return (
    <>
      <div
        className={cn('ds-photo-lightbox', `ds-photo-lightbox--${size}`, 'group')}
        data-test-id={testId}
      >
        <button
          type="button"
          onClick={(e) => {
            // Defensive: PhotoLightbox is commonly nested inside an <a>/Link
            // (CRM row → property detail). Stop the click from bubbling so the
            // outer link doesn't navigate when the user expands a photo.
            e.preventDefault()
            e.stopPropagation()
            setOpen(true)
          }}
          className="ds-photo-lightbox__expand"
          aria-label={t.expand}
          data-test-id={`${testId}-expand`}
        >
          <img src={current} alt={alt(idx)} draggable={false} />
        </button>

        {total > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              className="ds-photo-lightbox__arrow ds-photo-lightbox__arrow--prev"
              aria-label={t.previous}
              data-test-id={`${testId}-prev`}
            >
              <Chevron direction="left" />
            </button>
            <button
              type="button"
              onClick={next}
              className="ds-photo-lightbox__arrow ds-photo-lightbox__arrow--next"
              aria-label={t.next}
              data-test-id={`${testId}-next`}
            >
              <Chevron direction="right" />
            </button>
            <span
              className="ds-photo-lightbox__counter"
              aria-live="polite"
              aria-atomic="true"
            >
              {idx + 1}/{total}
            </span>
          </>
        )}
      </div>

      <RadixDialog.Root open={open} onOpenChange={setOpen}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay className="ds-photo-lightbox__scrim" />
          <RadixDialog.Content
            className="ds-photo-lightbox__stage"
            data-test-id={`${testId}-lightbox`}
            aria-label={alt(idx)}
          >
            <RadixDialog.Title className="sr-only">{alt(idx)}</RadixDialog.Title>

            <RadixDialog.Close
              className="ds-photo-lightbox__close"
              aria-label={t.close}
              data-test-id={`${testId}-lightbox-close`}
            >
              <CloseIcon />
            </RadixDialog.Close>

            {total > 1 && (
              <button
                type="button"
                onClick={prev}
                className="ds-photo-lightbox__stage-arrow ds-photo-lightbox__stage-arrow--prev"
                aria-label={t.previous}
                data-test-id={`${testId}-lightbox-prev`}
              >
                <Chevron direction="left" size={28} />
              </button>
            )}

            <img
              src={current}
              alt={alt(idx)}
              onClick={(e) => e.stopPropagation()}
              draggable={false}
            />

            {total > 1 && (
              <button
                type="button"
                onClick={next}
                className="ds-photo-lightbox__stage-arrow ds-photo-lightbox__stage-arrow--next"
                aria-label={t.next}
                data-test-id={`${testId}-lightbox-next`}
              >
                <Chevron direction="right" size={28} />
              </button>
            )}

            {total > 1 && (
              <span
                className="ds-photo-lightbox__stage-counter"
                aria-live="polite"
                aria-atomic="true"
              >
                {idx + 1} / {total}
              </span>
            )}
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>
    </>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────

function Chevron({
  direction,
  size = 18,
}: {
  direction: 'left' | 'right'
  size?: number
}) {
  const points =
    direction === 'left' ? '15 18 9 12 15 6' : '9 18 15 12 9 6'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      aria-hidden="true"
    >
      <polyline points={points} />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      aria-hidden="true"
    >
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  )
}
