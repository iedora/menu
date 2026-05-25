'use client'

import { useRef, useState, useTransition } from 'react'
import { Button } from './button'
import { ImageThumbnail } from './image-thumbnail'

export type UploadConstraints = {
  maxBytes: number
  acceptedMimeTypes: readonly string[]
  recommended?: { width: number; height: number; aspectLabel: string }
}

export type ImageUploadProps = {
  /** Human-readable label for the upload target (e.g. "Logo", "Banner"). */
  label: string
  /** Currently uploaded image URL, or null if none. */
  currentUrl: string | null
  /** Constraints for validation before the upload callback fires. */
  constraints: UploadConstraints
  /**
   * Called when the user picks a valid file. Must upload the file and return
   * the public URL, or an error string on failure.
   */
  onUpload: (file: File) => Promise<{ ok: true; url: string } | { ok: false; error: string }>
  /**
   * Called when the user clicks Remove. Must clear the asset and return success
   * or an error string.
   */
  onRemove: () => Promise<{ ok: true } | { ok: false; error: string }>
  /** Optional test id prefix for QA selectors (`{prefix}-pick`, `{prefix}-preview`, …). */
  testId?: string
}

/**
 * Iedora Manual § VI — Image upload.
 *
 * A product-agnostic image upload primitive. Callers supply their own
 * `onUpload` / `onRemove` callbacks (typically thin wrappers around server
 * actions) so the component stays in `@iedora/design-system` and each
 * product's vertical slice owns the auth gating + asset-target schema.
 *
 * Usage in a product slice:
 *   <ImageUpload
 *     label="Foto principal"
 *     currentUrl={property.photoUrls?.[0] ?? null}
 *     constraints={{ maxBytes: 5 * 1024 * 1024, acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] }}
 *     onUpload={async (file) => {
 *       const presign = await requestUploadUrl({ file })
 *       if (!presign.ok) return presign
 *       const put = await fetch(presign.data.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
 *       if (!put.ok) return { ok: false, error: 'Upload failed' }
 *       const commit = await commitAsset({ key: presign.data.key, publicUrl: presign.data.publicUrl })
 *       return commit
 *     }}
 *     onRemove={async () => clearAsset()}
 *   />
 */
export function ImageUpload({
  label,
  currentUrl,
  constraints,
  onUpload,
  onRemove,
  testId,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const acceptAttr = constraints.acceptedMimeTypes.join(',')
  const maxMb = (constraints.maxBytes / (1024 * 1024)).toFixed(0)

  function validate(file: File): string | null {
    if (!constraints.acceptedMimeTypes.includes(file.type as never)) {
      return `Unsupported file type. Use ${constraints.acceptedMimeTypes.join(', ')}.`
    }
    if (file.size > constraints.maxBytes) {
      return `File too large. Max ${maxMb} MB.`
    }
    return null
  }

  function onPick(file: File) {
    setError(null)
    const v = validate(file)
    if (v) {
      setError(v)
      return
    }

    startTransition(async () => {
      const result = await onUpload(file)
      if (!result.ok) {
        setError(result.error)
      }
    })
  }

  function handleRemove() {
    setError(null)
    startTransition(async () => {
      const result = await onRemove()
      if (!result.ok) {
        setError(result.error)
      }
    })
  }

  const idPrefix = testId ?? 'image-upload'

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        {currentUrl ? (
          <ImageThumbnail
            src={currentUrl}
            alt={`${label} preview`}
            width={64}
            height={64}
            aspectRatio="1 / 1"
            data-test-id={`${idPrefix}-preview`}
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center border border-dashed border-[var(--ink-22)] bg-[var(--paper-2)]">
            <span className="font-[family-name:var(--mono)] text-[10px] uppercase tracking-[0.14em] text-[var(--ink-40)]">
              none
            </span>
          </div>
        )}

        <div className="flex flex-1 flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={acceptAttr}
            data-test-id={`${idPrefix}-input`}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onPick(f)
              // Reset so the same file can be picked again after a remove.
              e.target.value = ''
            }}
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={pending}
              data-test-id={`${idPrefix}-pick`}
            >
              {pending ? 'Uploading…' : currentUrl ? 'Replace' : 'Upload'}
            </Button>
            {currentUrl && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleRemove}
                disabled={pending}
                data-test-id={`${idPrefix}-remove`}
              >
                Remove
              </Button>
            )}
          </div>
          <p className="font-[family-name:var(--mono)] text-[10px] uppercase tracking-[0.10em] text-[var(--ink-40)]">
            {constraints.recommended
              ? `Recommended ${constraints.recommended.width}×${constraints.recommended.height} (${constraints.recommended.aspectLabel}). `
              : ''}
            Max {maxMb} MB. {constraints.acceptedMimeTypes.map(m => m.replace('image/', '')).join(', ').toUpperCase()}.
          </p>
          {error && (
            <p
              className="text-[12px] text-[var(--cinnabar)]"
              data-test-id={`${idPrefix}-error`}
              role="alert"
              aria-live="assertive"
            >
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
