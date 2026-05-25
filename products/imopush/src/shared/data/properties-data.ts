import fs from 'node:fs'
import path from 'node:path'
import { cacheLife, cacheTag } from 'next/cache'
import type { Property } from './properties'

const FIXTURES_DIR = path.join(process.cwd(), '..', '..', 'products', 'imopush', 'fixtures')

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

export async function listProperties(): Promise<Property[]> {
  'use cache'
  cacheLife('seconds')
  cacheTag('properties:all')

  const dir = resolveFixturesDir()
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as Property)
}

export async function getProperty(reference: string): Promise<Property | null> {
  'use cache'
  cacheLife('seconds')
  cacheTag(`property:${reference}`)

  const all = await listProperties()
  return all.find((p) => p.reference === reference) ?? null
}
