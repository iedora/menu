'use client'

import { ImageUpload as GenericImageUpload } from '@iedora/design-system'
import { commitAsset, clearAsset, requestUploadUrl } from '../actions'
import { TARGET_CONSTRAINTS } from '../targets'
import type { AssetTarget } from '../types'

export function ImageUpload({
  target,
  currentUrl,
  label,
  onChange,
}: {
  target: AssetTarget
  currentUrl: string | null
  label: string
  onChange: (url: string | null) => void
}) {
  const constraints = TARGET_CONSTRAINTS[target.kind]

  async function handleUpload(file: File) {
    const presign = await requestUploadUrl({
      target,
      contentType: file.type,
      contentLengthBytes: file.size,
    })
    if (!presign.ok) {
      return { ok: false as const, error: presign.error }
    }

    const put = await fetch(presign.data.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    })
    if (!put.ok) {
      return { ok: false as const, error: `Upload failed (${put.status})` }
    }

    const commit = await commitAsset({
      target,
      key: presign.data.key,
      publicUrl: presign.data.publicUrl,
    })
    if (!commit.ok) {
      return { ok: false as const, error: commit.error }
    }

    onChange(commit.data.url)
    return { ok: true as const, url: commit.data.url }
  }

  async function handleRemove() {
    const result = await clearAsset({ target })
    if (!result.ok) {
      return { ok: false as const, error: result.error }
    }
    onChange(null)
    return { ok: true as const }
  }

  return (
    <GenericImageUpload
      label={label}
      currentUrl={currentUrl}
      constraints={constraints}
      onUpload={handleUpload}
      onRemove={handleRemove}
      testId={`upload-${target.kind}`}
    />
  )
}
