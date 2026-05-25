import type { ReactNode } from 'react'
import { cn } from '../lib/cn'
import { ImageThumbnail } from './image-thumbnail'

export type GalleryImage = {
  src: string
  alt?: string
}

export type ImageGalleryProps = {
  images: GalleryImage[]
  /** Max images to render before a "+N more" indicator. Default 12. */
  maxPreview?: number
  /** CSS aspect ratio string. Default "4 / 3". */
  aspectRatio?: string
  /** Optional label shown above the gallery in mono caps. */
  label?: ReactNode
  /** Data attribute for testing. */
  testId?: string
  className?: string
}

/**
 * Iedora Manual § VI — Image gallery.
 *
 * A mobile-first responsive photo grid. On narrow viewports every image
 * stacks full-width so the user can scroll naturally through a listing.
 * On larger screens the grid tightens into 2–3 columns.
 *
 * Every image is wrapped in a hairline-bordered, object-cover thumbnail
 * so the gallery reads consistently across products (real-estate listings,
 * restaurant menus, editorial surfaces).
 */
export function ImageGallery({
  images,
  maxPreview = 12,
  aspectRatio = '4 / 3',
  label,
  testId,
  className,
}: ImageGalleryProps) {
  if (!images || images.length === 0) return null

  const preview = images.slice(0, maxPreview)
  const remaining = images.length - maxPreview

  return (
    <section className={cn('space-y-3', className)} data-test-id={testId}>
      {label && (
        <h2 className="font-[family-name:var(--mono)] text-[11px] uppercase tracking-[0.14em] text-[var(--ink-55)]">
          {label}
        </h2>
      )}

      <div
        className={cn(
          'grid gap-2',
          /* Mobile first: single column so each photo gets the full viewport width. */
          'grid-cols-1',
          /* Small tablets: 2 columns for faster browsing. */
          'sm:grid-cols-2',
          /* Desktop: 3 columns, denser without losing readability. */
          'lg:grid-cols-3',
          /* Wide desktop: 4 columns for listings with many photos. */
          'xl:grid-cols-4',
        )}
      >
        {preview.map((img, i) => (
          <ImageThumbnail
            key={i}
            src={img.src}
            alt={img.alt ?? `Foto ${i + 1}`}
            aspectRatio={aspectRatio}
            loading={i < 2 ? 'eager' : 'lazy'}
            wrapperClassName="bg-[var(--paper-2)]"
          />
        ))}
      </div>

      {remaining > 0 && (
        <p className="font-[family-name:var(--mono)] text-[11px] text-[var(--ink-40)]">
          + {remaining} {remaining === 1 ? 'foto' : 'fotos'} adicionais
        </p>
      )}
    </section>
  )
}
