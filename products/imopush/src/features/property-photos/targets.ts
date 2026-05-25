import type { AssetTarget, UploadConstraints } from './types'

const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const

export const TARGET_CONSTRAINTS: Record<'property-photo', UploadConstraints> = {
  'property-photo': {
    maxBytes: 10 * 1024 * 1024,
    acceptedMimeTypes: IMAGE_MIME,
    recommended: { width: 1600, height: 1200, aspectLabel: 'landscape (4:3)' },
  },
}

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export function extensionForMime(mime: string): string {
  return MIME_EXT[mime] ?? 'bin'
}

function randomSlug(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
}

export function buildKey(target: AssetTarget, mime: string): string {
  const ext = extensionForMime(mime)
  const slug = randomSlug()
  return `p/${target.propertyReference}/photos/${slug}.${ext}`
}
