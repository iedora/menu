/**
 * PropertyStore port — the slice's boundary with persistence.
 *
 * Today backed by JSON fixtures (adapters/json-store.ts).
 * Tomorrow a Drizzle adapter against a `property` table.
 */

export interface PropertyStore {
  getPhotoUrls(reference: string): Promise<string[]>
  addPhotoUrl(reference: string, url: string): Promise<void>
  removePhotoUrl(reference: string, url: string): Promise<void>
}
