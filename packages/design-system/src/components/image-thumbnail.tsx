import type { ImgHTMLAttributes } from 'react'
import { cn } from '../lib/cn'

type ImageThumbnailProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'width' | 'height'
> & {
  /** Width in pixels — drives the rendered size and the intrinsic aspect ratio. */
  width?: number
  /** Height in pixels — drives the rendered size and the intrinsic aspect ratio. */
  height?: number
  /** Force a specific CSS aspect ratio (e.g. "4 / 3", "1 / 1", "16 / 9"). */
  aspectRatio?: string
  /** Border style. `default` = hairline; `none` = no border. */
  border?: 'default' | 'none'
  /** Optional wrapper className. */
  wrapperClassName?: string
}

/**
 * Iedora Manual § VI — Image thumbnail.
 *
 * A hairline-bordered, object-cover image wrapper. Used in editorial lists,
 * cards, and any surface that needs a consistent image treatment. The
 * aspect-ratio container prevents layout shift while the image loads.
 */
export function ImageThumbnail({
  width = 80,
  height = 60,
  aspectRatio,
  border = 'default',
  wrapperClassName,
  alt = '',
  loading = 'lazy',
  ...imgProps
}: ImageThumbnailProps) {
  const ratioStyle = aspectRatio
    ? { aspectRatio }
    : { aspectRatio: `${width} / ${height}` }

  return (
    <div
      className={cn(
        'overflow-hidden bg-[var(--ink-04)]',
        border === 'default' && 'border border-[var(--ink-14)]',
        wrapperClassName,
      )}
      style={ratioStyle}
    >
      <img
        {...imgProps}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        className={cn(
          'h-full w-full object-cover',
          imgProps.className,
        )}
      />
    </div>
  )
}
