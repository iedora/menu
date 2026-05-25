import 'server-only'
import { getStorage } from '@iedora/storage'
import type { Storage } from '@iedora/storage'

let storage: Storage | null = null

export async function getPropertyPhotoStorage(): Promise<Storage> {
  if (storage) return storage
  storage = getStorage()
  return storage
}
