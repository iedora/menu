import 'server-only'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { chromium, type Browser, type Page } from 'playwright-core'
import type { Property } from '@/shared/data/properties'
import type { IdealistaPublisher, PublishResult } from '../ports'
import {
  IDEALISTA_TYPOLOGY,
  IDEALISTA_ENERGY_CLASS,
  IDEALISTA_HEATING_TYPE,
  IDEALISTA_INDIVIDUAL_HEAT,
  IDEALISTA_CENTRAL_HEAT,
  IDEALISTA_CONTACT_METHOD,
} from './field-map'

const CDP_URL = process.env.IDEALISTA_CDP_URL ?? 'http://localhost:9222'
const PASSWORD = process.env.IDEALISTA_PASSWORD ?? ''

const TYPOLOGY = IDEALISTA_TYPOLOGY
const ENERGY_CLASS = IDEALISTA_ENERGY_CLASS
const HEATING_TYPE = IDEALISTA_HEATING_TYPE
const INDIVIDUAL_HEAT = IDEALISTA_INDIVIDUAL_HEAT
const CENTRAL_HEAT = IDEALISTA_CENTRAL_HEAT
const CONTACT_METHOD = IDEALISTA_CONTACT_METHOD

const d = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function createCdpIdealistaPublisher(): IdealistaPublisher {
  return {
    async publish(prop: Property): Promise<PublishResult> {
      let browser: Browser | null = null
      try {
        browser = await chromium.connectOverCDP(CDP_URL)
      } catch (err) {
        return {
          ok: false,
          error: `Não consegui ligar ao Chrome em ${CDP_URL}. Inicia o Chrome com --remote-debugging-port=9222. (${(err as Error).message})`,
        }
      }

      const ctx = browser.contexts()[0] ?? (await browser.newContext())
      const page = await ctx.newPage()
      page.setDefaultTimeout(25_000)

      try {
        await login(page, prop)
        await fillStep1(page, prop)
        await dismissIntermediates(page)
        await fillStep2(page, prop)
        const publishedUrl = await fillStep3AndPublish(page, prop)
        return { ok: true, publishedUrl }
      } catch (err) {
        return { ok: false, error: (err as Error).message }
      } finally {
        await page.close().catch(() => {})
        await browser?.close().catch(() => {})
      }
    },
  }
}

// ─── Step helpers ───────────────────────────────────────────────────────────

async function login(page: Page, prop: Property): Promise<void> {
  await page.goto('https://www.idealista.pt/login', { waitUntil: 'domcontentloaded' })
  await d(2000)
  if (!page.url().includes('/login')) return

  const email = page.locator('input[type=email], #email').first()
  await email.click()
  await d(300)
  await email.type(prop.contact.email, { delay: 80 })
  await d(400)
  await page.locator('button:has-text("Continuar"), button[type=submit]').first().click()
  await page.waitForSelector('input[type=password]', { timeout: 15_000 })
  await d(600)
  if (!PASSWORD) {
    throw new Error('IDEALISTA_PASSWORD não definida e Chrome pede password — define-a ou inicia sessão manualmente no Chrome.')
  }
  await page.locator('input[type=password]').first().type(PASSWORD, { delay: 80 })
  await d(500)
  await page.locator('button[type=submit]').first().click()
  await d(4000)
}

async function fillStep1(page: Page, prop: Property): Promise<void> {
  const phone = prop.contact.phone
  const phonePrefix = prop.contact.phonePrefix ?? '351'
  const contactMethod =
    CONTACT_METHOD[prop.contact.preferredMethod ?? 'phone_and_chat']

  await page.goto('https://www.idealista.pt/flow/novo-anuncio', {
    waitUntil: 'domcontentloaded',
  })
  await d(2000)

  // 1a. Typology
  const typology = TYPOLOGY[prop.type] ?? 'COUNTRYHOUSE'
  await pickDropdown(page, 'qa_typology', typology)
  await d(600)

  // 1b. Operation
  const operationId = prop.operation === 'rent' ? 'ca-radio-rent' : 'ca-radio-sell'
  await page.evaluate((id) => document.querySelector<HTMLElement>(`#${id}`)?.click(), operationId)
  await d(400)

  // 1c. Locality
  const locInput = page.locator('#ca-geo-locality')
  await locInput.click()
  await d(200)
  await locInput.fill('')
  await locInput.type(prop.address.locality, { delay: 80 })
  await d(1800)

  const sug = page.locator('[class*=autocomplete] li, [role=option], [class*=suggestion]').first()
  if (await sug.isVisible({ timeout: 3000 }).catch(() => false)) {
    await sug.click()
  } else if (prop.address.municipality) {
    await locInput.fill('')
    await locInput.type(prop.address.municipality, { delay: 80 })
    await d(1800)
    const sug2 = page.locator('[class*=autocomplete] li, [role=option], [class*=suggestion]').first()
    if (await sug2.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sug2.click()
    } else {
      await page.keyboard.press('ArrowDown')
      await d(200)
      await page.keyboard.press('Enter')
    }
  } else {
    await page.keyboard.press('ArrowDown')
    await d(200)
    await page.keyboard.press('Enter')
  }
  await d(600)

  // 1d. Street
  if (prop.address.street) {
    const streetInput = page.locator('#ca-geo-address')
    if (await streetInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await streetInput.fill('')
      await streetInput.type(prop.address.street, { delay: 80 })
      await d(1800)
      const ss = page.locator('[class*=autocomplete] li, [role=option]').first()
      if (await ss.isVisible({ timeout: 3000 }).catch(() => false)) {
        await ss.click()
      } else {
        await streetInput.press('Enter')
      }
      await d(600)
    }
  }

  // 1f. Verify address
  const verifyBtn = page.locator('#ca-geo-validate')
  if (await verifyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await verifyBtn.click()
    await d(3000)
    const confirmBtn = page.locator('button:has-text("Confirmar morada"), a:has-text("Confirmar morada")')
    if (await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await confirmBtn.click()
      await d(2000)
    }
  }

  // 1g. Floor / door / hasBlock — apartment-only; skip if absent
  const floorTrigger = page.locator('[id="qa_address.floorNumber"]')
  if (await floorTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
    await floorTrigger.click()
    await d(400)
    await page.locator('[id="qa_address.floorNumber"] li[data-value="bj"]').click()
    await d(400)
  }
  const doorBtn = page.locator('.qa_doorselect button.dropdown-wrapper')
  if (await doorBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await doorBtn.click()
    await d(400)
    await page.locator('.qa_doorselect li[data-value="pu"]').click()
    await d(400)
  }
  const hasBlockRadios = await page.evaluate(
    () => document.querySelectorAll('input[name="hasBlock"]').length,
  )
  if (hasBlockRadios > 0) {
    await page.evaluate(() => {
      const noRadio = [
        ...document.querySelectorAll<HTMLInputElement>('input[name="hasBlock"]'),
      ].find((r) => r.value === 'no')
      if (noRadio) noRadio.click()
    })
    await d(300)
  }

  // 1h. Phone widget
  await page
    .waitForFunction(
      () => {
        const w = document.querySelector<HTMLElement>('.phone-code_input')
        return Boolean(w && w.offsetWidth > 0 && w.offsetHeight > 0)
      },
      { timeout: 15_000 },
    )
    .catch(() => {})
  await page.locator('.phone-code_input').first().scrollIntoViewIfNeeded().catch(() => {})
  await d(600)

  if (phone) {
    const phoneWidget = page.locator('.phone-code_input').first()
    if (await phoneWidget.isVisible({ timeout: 3000 }).catch(() => false)) {
      await phoneWidget.click()
      await d(200)
      await page.keyboard.press('Control+a')
      await page.keyboard.press('Delete')
      await d(200)
      await phoneWidget.type(phone, { delay: 80 })
      await d(500)
    }
    await page.evaluate(
      ({ phone, prefix }) => {
        const ph = document.querySelector<HTMLInputElement>('#ca-contact-phone1')
        if (ph) {
          ph.value = phone
          ph.dispatchEvent(new Event('input', { bubbles: true }))
          ph.dispatchEvent(new Event('change', { bubbles: true }))
        }
        const pfx = document.querySelector<HTMLInputElement>('#ca-international-prefix')
        if (pfx) {
          pfx.value = prefix
          pfx.dispatchEvent(new Event('input', { bubbles: true }))
          pfx.dispatchEvent(new Event('change', { bubbles: true }))
        }
      },
      { phone, prefix: phonePrefix },
    )
  } else {
    // No phone → chat-only
    await page
      .evaluate((id) => document.querySelector<HTMLElement>(`#${id}`)?.click(), 'only-chat-radio-button')
      .catch(() => {})
  }

  // 1i. Name
  const nameInput = page.locator('#ca-contact-name')
  if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await nameInput.fill(prop.contact.name)
    await d(300)
  }

  // 1j. Contact method
  await page
    .evaluate((id) => document.querySelector<HTMLElement>(`#${id}`)?.click(), contactMethod)
    .catch(() => {})
  await d(300)

  // 1k. Email
  const emailInput = page.locator('#ca-login-email')
  if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    const existing = await emailInput.inputValue()
    if (!existing) await emailInput.fill(prop.contact.email)
  }
  await page.evaluate((email) => {
    const el = document.querySelector<HTMLInputElement>('#ca-login-repeat-email')
    if (el) {
      el.value = email
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }, prop.contact.email)

  // 1l. Privacy policy
  const privacyExists = await page.evaluate(
    () => Boolean(document.querySelector('#privacyPolicyAccepted1')),
  )
  if (privacyExists) {
    const checked = await page.evaluate(
      () => document.querySelector<HTMLInputElement>('#privacyPolicyAccepted1')?.checked,
    )
    if (!checked) {
      await page.evaluate(() =>
        document.querySelector<HTMLElement>('#privacyPolicyAccepted1')?.click(),
      )
      await d(300)
    }
  }

  // 1m. Submit step 1
  await page.evaluate(() => document.querySelector('#ca-button-continue')?.scrollIntoView())
  await d(500)
  await page.evaluate(() =>
    document.querySelector<HTMLElement>('#ca-button-continue')?.click(),
  )
  await d(5000)

  const errs = await readErrors(page)
  if (errs.length) throw new Error(`Step 1 falhou: ${errs.map((e) => e.text).join(' | ')}`)
}

async function dismissIntermediates(page: Page): Promise<void> {
  // Cost notice ("Este anúncio terá um custo")
  const costNotice = await page.evaluate(() =>
    [...document.querySelectorAll('h1,h2,h3,h4')].some((h) =>
      (h as HTMLElement).innerText?.includes('terá um custo'),
    ),
  )
  if (costNotice) {
    await page.evaluate(() => {
      const btn = [
        ...document.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
          'input[type=submit], button[type=submit]',
        ),
      ].find((b) => {
        const text = (b as HTMLInputElement).value || (b as HTMLElement).innerText || ''
        return text.toLowerCase().includes('entendido')
      })
      btn?.click()
    })
    await d(3000)
  }

  // Phone conflict
  const phoneConflict = page.locator('#ca-radio-continue')
  if (await phoneConflict.isVisible({ timeout: 4000 }).catch(() => false)) {
    await page.evaluate(() =>
      document.querySelector<HTMLElement>('#ca-radio-continue')?.click(),
    )
    await d(600)
    await page.waitForFunction(
      () => {
        const btn = document.querySelector<HTMLButtonElement>('#ca-continue')
        return Boolean(btn && !btn.disabled)
      },
      { timeout: 10_000 },
    )
    await page.evaluate(() => document.querySelector<HTMLElement>('#ca-continue')?.click())
    await d(4000)
  }
}

async function fillStep2(page: Page, prop: Property): Promise<void> {
  const f = prop.features ?? {}

  const builtTypeId = f.condition === 'needs_renovation' ? 'builtTypeId-restore' : 'builtTypeId-good'
  const energyCertValue = ENERGY_CLASS[f.energyCertificate ?? ''] ?? 'unknown'
  const occupancyId = prop.occupancy === 'tenanted' ? 'currentOccupationType1' : 'currentOccupationType2'
  const heatingType = f.heatingType
    ? HEATING_TYPE[f.heatingType as keyof typeof HEATING_TYPE]
    : undefined
  const individualHeat = f.individualHeatFuel
    ? INDIVIDUAL_HEAT[f.individualHeatFuel as keyof typeof INDIVIDUAL_HEAT]
    : undefined
  const centralHeat = f.centralHeatFuel
    ? CENTRAL_HEAT[f.centralHeatFuel as keyof typeof CENTRAL_HEAT]
    : undefined

  await fillIf(page, 'constructedArea', String(f.constructedAreaSqm ?? prop.sizeSqm ?? ''))
  if (f.usableAreaSqm) await fillIf(page, 'usableArea', String(f.usableAreaSqm))
  if (f.lotSizeSqm) {
    await fillIf(page, 'lotSize', String(f.lotSizeSqm))
    await fillIf(page, 'plotArea', String(f.lotSizeSqm))
  }

  await page.evaluate((id) => document.querySelector<HTMLElement>(`#${id}`)?.click(), builtTypeId)
  await d(300)

  if (prop.rooms != null) await fillIf(page, 'roomNumber', String(prop.rooms))
  if (prop.bathrooms != null) await fillIf(page, 'bathNumber', String(prop.bathrooms))

  await pickDropdown(page, 'qa_portugalEnergeticClass', energyCertValue)

  const liftId = f.hasLift ? 'hasLift1' : 'hasLift2'
  const liftExists = await page.evaluate(
    (id) => Boolean(document.querySelector(`#${id}`)),
    liftId,
  )
  if (liftExists) {
    await page.evaluate((id) => document.querySelector<HTMLElement>(`#${id}`)?.click(), liftId)
    await d(300)
  }

  if (heatingType) {
    await pickDropdown(page, 'qa_heatingType', heatingType)
    await d(300)
    if (individualHeat) await pickDropdown(page, 'qa_individualHeatingType', individualHeat)
    if (centralHeat) await pickDropdown(page, 'qa_centralHeatingType', centralHeat)
  }

  const occExists = await page.evaluate(
    (id) => Boolean(document.querySelector(`#${id}`)),
    occupancyId,
  )
  if (occExists) {
    await page.evaluate(
      (id) => document.querySelector<HTMLElement>(`#${id}`)?.click(),
      occupancyId,
    )
  } else {
    await page.evaluate(() =>
      document.querySelector<HTMLElement>('#currentOccupationType2')?.click(),
    )
  }
  await d(300)

  await fillIf(page, 'ca-price', String(Math.round((prop.priceCents ?? 0) / 100)))

  // Orientation
  await checkIf(page, 'hasNorthOrientation1', f.facesNorth)
  await checkIf(page, 'hasSouthOrientation1', f.facesSouth)
  await checkIf(page, 'hasEastOrientation1', f.facesEast)
  await checkIf(page, 'hasWestOrientation1', f.facesWest)

  // Features
  await checkIf(page, 'hasTerrace1', f.hasTerrace)
  await checkIf(page, 'hasBalcony1', f.hasBalcony)
  await checkIf(page, 'hasGarden', f.hasGarden)
  await checkIf(page, 'hasSwimmingPool1', f.hasPool)
  await checkIf(page, 'hasWardrobe1', f.hasWardrobe)
  await checkIf(page, 'hasAirConditioning1', f.hasAirConditioning)
  await checkIf(page, 'hasBoxRoom1', f.hasStorage)

  if (f.hasParking) {
    await checkIf(page, 'checkboxspace', true)
    await d(400)
    if (f.parkingIncludedInPrice) {
      const piExists = await page.evaluate(
        () => Boolean(document.querySelector('#ca-parking-in-price')),
      )
      if (piExists) {
        await page.evaluate(() =>
          document.querySelector<HTMLElement>('#ca-parking-in-price')?.click(),
        )
        await d(300)
      }
    }
  }

  if (f.yearBuilt) await fillIf(page, 'constructionYear', String(f.yearBuilt))

  if (prop.description) {
    const descSel = page
      .locator('[name="websiteComment.propertyComment"], #description, textarea[name*="comment"]')
      .first()
    if (await descSel.isVisible({ timeout: 3000 }).catch(() => false)) {
      await descSel.fill(prop.description.slice(0, 2000))
      await d(300)
    }
  }

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await d(600)

  await page.evaluate(() => {
    const btn = [
      ...document.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
        'input[type=submit], button[type=submit]',
      ),
    ].find((b) => {
      const text = (b as HTMLInputElement).value || (b as HTMLElement).innerText || ''
      return text.toLowerCase().includes('continuar')
    })
    if (!btn) throw new Error('Step 2 submit button not found')
    btn.click()
  })
  await d(5000)

  const errs = await readErrors(page)
  if (errs.length) throw new Error(`Step 2 falhou: ${errs.map((e) => e.text).join(' | ')}`)
}

async function fillStep3AndPublish(page: Page, prop: Property): Promise<string | undefined> {
  const urls = prop.photoUrls ?? []
  const fileInput = page.locator('input[type=file]').first()
  await fileInput.waitFor({ timeout: 15_000 })

  if (urls.length === 0) {
    // "Continuar sem fotos"
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll<HTMLElement>('button, a')].find((b) =>
        b.innerText?.toLowerCase().includes('continuar sem fotos'),
      )
      btn?.click()
    })
  } else {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'idealista-photos-'))
    try {
      const localPaths: string[] = []
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i]
        const ext = inferExt(url)
        const file = path.join(tmpDir, `${String(i).padStart(3, '0')}${ext}`)
        const buf = await downloadToBuffer(url)
        await fs.writeFile(file, buf)
        localPaths.push(file)
      }
      await fileInput.setInputFiles(localPaths)
      // Wait for upload to settle — Idealista shows thumbnails in the page
      await d(3000)
      await page
        .waitForFunction(
          (count) => {
            const thumbs = document.querySelectorAll('[class*=thumbnail], [class*=image-preview], img[src*="blob"]')
            return thumbs.length >= count
          },
          urls.length,
          { timeout: 120_000 },
        )
        .catch(() => {})
      // Click "Publicar" / "Continuar" / final submit
      await page.evaluate(() => {
        const btn = [...document.querySelectorAll<HTMLElement>('button, a, input[type=submit]')].find((b) => {
          const t = ((b as HTMLInputElement).value || b.innerText || '').toLowerCase()
          return t.includes('publicar') || t === 'continuar'
        })
        btn?.click()
      })
    } finally {
      // Best-effort tmp cleanup
      fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    }
  }

  // Wait for redirect to a success page or until the URL contains /imovel/ or "publicacao"
  await page
    .waitForFunction(
      () => {
        const u = window.location.href
        return /\/imovel\/|publicacao|listing-success|anuncio-publicado/i.test(u)
      },
      { timeout: 60_000 },
    )
    .catch(() => {})
  await d(2000)

  // Try to extract the public listing URL from the page
  const url = await page.evaluate(() => {
    const a = document.querySelector<HTMLAnchorElement>('a[href*="/imovel/"]')
    if (a?.href) return a.href
    if (/\/imovel\//.test(window.location.href)) return window.location.href
    return undefined
  })

  return url
}

// ─── Page primitives ────────────────────────────────────────────────────────

async function pickDropdown(page: Page, triggerId: string, value: string): Promise<boolean> {
  const trigger = page.locator(`#${triggerId}`)
  if (!(await trigger.isVisible({ timeout: 3000 }).catch(() => false))) return false
  await trigger.click()
  await d(500)
  const option = page.locator(`#${triggerId} li[data-value="${value}"]`)
  if (!(await option.isVisible({ timeout: 3000 }).catch(() => false))) {
    await page.keyboard.press('Escape')
    return false
  }
  await option.click()
  await d(400)
  return true
}

async function fillIf(page: Page, id: string, value: string | null | undefined): Promise<void> {
  if (!value) return
  const el = page.locator(`#${id}`)
  if (!(await el.isVisible({ timeout: 2000 }).catch(() => false))) return
  await el.fill(value)
  await d(200)
}

async function checkIf(page: Page, id: string, shouldCheck: boolean | undefined): Promise<void> {
  if (!shouldCheck) return
  const exists = await page.evaluate((id) => Boolean(document.querySelector(`#${id}`)), id)
  if (!exists) return
  const isChecked = await page.evaluate(
    (id) => document.querySelector<HTMLInputElement>(`#${id}`)?.checked,
    id,
  )
  if (!isChecked) {
    await page.evaluate((id) => document.querySelector<HTMLElement>(`#${id}`)?.click(), id)
    await d(200)
  }
}

async function readErrors(page: Page): Promise<{ text: string; field: string }[]> {
  return page.evaluate(() => {
    const errs: { text: string; field: string }[] = []
    document.querySelectorAll("[class*='error'], [class*='invalid'], .has-error").forEach((e) => {
      const t = (e as HTMLElement).innerText?.trim()
      if (t && t.length > 1 && t.length < 300) {
        const container = (e.closest('.item-form, .form-group, label') ?? e.parentElement) as HTMLElement | null
        const inp = container?.querySelector<HTMLInputElement>('input, select, textarea')
        errs.push({ text: t, field: inp?.name || inp?.id || '?' })
      }
    })
    return [...new Map(errs.map((e) => [e.text, e])).values()]
  })
}

// ─── Photo download helpers ────────────────────────────────────────────────

function inferExt(url: string): string {
  const lower = url.toLowerCase()
  if (lower.includes('.jpeg')) return '.jpg'
  if (lower.includes('.jpg')) return '.jpg'
  if (lower.includes('.png')) return '.png'
  if (lower.includes('.webp')) return '.webp'
  if (lower.includes('.heic')) return '.heic'
  return '.jpg'
}

async function downloadToBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Falha a descarregar ${url}: HTTP ${res.status}`)
  const arr = await res.arrayBuffer()
  return Buffer.from(arr)
}

