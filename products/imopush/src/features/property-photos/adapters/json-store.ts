import 'server-only'
import fs from 'node:fs'
import path from 'node:path'
import type { PropertyStore } from '../ports'

const FIXTURES_DIR = path.join(process.cwd(), 'fixtures')

function resolveFixturesDir(): string {
  const candidates = [
    path.join(process.cwd(), 'fixtures'),
    path.join(process.cwd(), '..', '..', 'products', 'imopush', 'fixtures'),
    FIXTURES_DIR,
  ]
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir
  }
  return candidates[0]
}

function fileForReference(reference: string): string | null {
  const dir = resolveFixturesDir()
  if (!fs.existsSync(dir)) return null
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
  for (const f of files) {
    const content = fs.readFileSync(path.join(dir, f), 'utf8')
    const data = JSON.parse(content) as { reference?: string }
    if (data.reference === reference) {
      return path.join(dir, f)
    }
  }
  return null
}

export function createJsonPropertyStore(): PropertyStore {
  return {
    async getPhotoUrls(reference: string): Promise<string[]> {
      const file = fileForReference(reference)
      if (!file) return []
      const content = fs.readFileSync(file, 'utf8')
      const data = JSON.parse(content) as { photoUrls?: string[] }
      return data.photoUrls ?? []
    },

    async addPhotoUrl(reference: string, url: string): Promise<void> {
      const file = fileForReference(reference)
      if (!file) throw new Error(`Property not found: ${reference}`)
      const content = fs.readFileSync(file, 'utf8')
      const data = JSON.parse(content) as { photoUrls?: string[] }
      const urls = new Set(data.photoUrls ?? [])
      urls.add(url)
      data.photoUrls = Array.from(urls)
      fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
    },

    async removePhotoUrl(reference: string, url: string): Promise<void> {
      const file = fileForReference(reference)
      if (!file) throw new Error(`Property not found: ${reference}`)
      const content = fs.readFileSync(file, 'utf8')
      const data = JSON.parse(content) as { photoUrls?: string[] }
      data.photoUrls = (data.photoUrls ?? []).filter((u) => u !== url)
      fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
    },
  }
}
