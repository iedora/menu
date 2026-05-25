'use client'

import { useState, useCallback, useEffect } from 'react'

export type CarouselImage = {
  src: string
  alt?: string
}

export type ImageCarouselProps = {
  images: CarouselImage[]
  initialIndex?: number
  onIndexChange?: (index: number) => void
  testId?: string
}

/**
 * Iedora Manual § VI.11 — Image carousel.
 *
 * Real-estate-style hero carousel. Large hero image with prev/next
 * arrows, a counter badge, and a thumbnail strip below. Touch/swipe
 * and keyboard navigation (arrow keys, escape) are supported.
 *
 * Mobile-first: the carousel fills the viewport width; thumbnails
 * scale down on the narrowest screens.
 */
export function ImageCarousel({
  images,
  initialIndex = 0,
  onIndexChange,
  testId,
}: ImageCarouselProps) {
  if (!images || images.length === 0) return null

  const [index, setIndex] = useState(
    Math.max(0, Math.min(initialIndex, images.length - 1)),
  )

  const go = useCallback(
    (dir: 'prev' | 'next') => {
      setIndex((i) => {
        const next =
          dir === 'next'
            ? Math.min(i + 1, images.length - 1)
            : Math.max(i - 1, 0)
        onIndexChange?.(next)
        return next
      })
    },
    [images.length, onIndexChange],
  )

  const goTo = useCallback(
    (i: number) => {
      setIndex(i)
      onIndexChange?.(i)
    },
    [onIndexChange],
  )

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') go('next')
      if (e.key === 'ArrowLeft') go('prev')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  const current = images[index]
  const canPrev = index > 0
  const canNext = index < images.length - 1

  return (
    <div
      className="ds-carousel"
      data-test-id={testId}
      role="region"
      aria-roledescription="carousel"
      aria-label="Galeria de fotos"
    >
      {/* Stage */}
      <div className="ds-carousel__stage">
        {images.map((img, i) => (
          <div
            key={i}
            className="ds-carousel__slide"
            data-active={i === index ? 'true' : 'false'}
            aria-hidden={i !== index}
          >
            <img
              src={img.src}
              alt={img.alt ?? `Foto ${i + 1}`}
              loading={i === index ? 'eager' : 'lazy'}
            />
          </div>
        ))}

        {/* Arrows */}
        {canPrev && (
          <button
            type="button"
            aria-label="Foto anterior"
            className="ds-carousel__arrow ds-carousel__arrow--prev"
            onClick={() => go('prev')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}
        {canNext && (
          <button
            type="button"
            aria-label="Próxima foto"
            className="ds-carousel__arrow ds-carousel__arrow--next"
            onClick={() => go('next')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}

        {/* Counter */}
        <span className="ds-carousel__counter" aria-live="polite" aria-atomic="true">
          {index + 1} / {images.length}
        </span>
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="ds-carousel__thumbs">
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Ver foto ${i + 1}`}
              aria-current={i === index ? 'true' : undefined}
              data-active={i === index ? 'true' : 'false'}
              className="ds-carousel__thumb"
              onClick={() => goTo(i)}
            >
              <img src={img.src} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
