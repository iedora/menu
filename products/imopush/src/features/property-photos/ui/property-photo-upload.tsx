'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ImageUpload } from '@iedora/design-system'
import { requestPhotoUploadUrl, commitPhoto, clearPhoto } from '../actions'
import { TARGET_CONSTRAINTS } from '../targets'

export function PropertyPhotoUpload({
  propertyReference,
  currentUrl,
}: {
  propertyReference: string
  currentUrl: string | null
}) {
  const router = useRouter()
  const t = useTranslations('PropertyPhotos')

  async function handleUpload(file: File) {
    const presign = await requestPhotoUploadUrl({
      target: { kind: 'property-photo', propertyReference },
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

    const commit = await commitPhoto({
      target: { kind: 'property-photo', propertyReference },
      key: presign.data.key,
      publicUrl: presign.data.publicUrl,
    })
    if (!commit.ok) {
      return { ok: false as const, error: commit.error }
    }

    router.refresh()
    return { ok: true as const, url: commit.data.url }
  }

  async function handleRemove() {
    if (!currentUrl) return { ok: true as const }

    const result = await clearPhoto({
      target: { kind: 'property-photo', propertyReference },
      publicUrl: currentUrl,
    })
    if (!result.ok) {
      return { ok: false as const, error: result.error }
    }

    router.refresh()
    return { ok: true as const }
  }

  return (
    <ImageUpload
      label={t('mainPhoto')}
      currentUrl={currentUrl}
      constraints={TARGET_CONSTRAINTS['property-photo']}
      onUpload={handleUpload}
      onRemove={handleRemove}
      testId="property-photo"
    />
  )
}
