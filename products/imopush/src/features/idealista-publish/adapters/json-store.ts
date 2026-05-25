import 'server-only'
import fs from 'node:fs'
import path from 'node:path'
import type { Property, IntegratorStatus } from '@/shared/data/properties'
import type { PropertyIntegratorStore } from '../ports'

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

export function createJsonPropertyIntegratorStore(): PropertyIntegratorStore {
  return {
    async getProperty(reference: string): Promise<Property | null> {
      const file = fileForReference(reference)
      if (!file) return null
      return JSON.parse(fs.readFileSync(file, 'utf8')) as Property
    },

    async setIntegratorStatus(reference, status): Promise<void> {
      const file = fileForReference(reference)
      if (!file) throw new Error(`Property not found: ${reference}`)
      const data = JSON.parse(fs.readFileSync(file, 'utf8')) as Property
      const others = (data.integrators ?? []).filter((i) => i.key !== status.key)
      data.integrators = [...others, status]
      fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
    },
  }
}
