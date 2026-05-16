import { expect, test } from '@playwright/test'
import {
  apiCreateAndActivateOrg,
  apiSignup,
  uniqueSlug,
  uniqueUser,
} from '../../helpers/auth'

test.describe('QR code — dashboard page', () => {
  test('renders an SVG QR for the public menu URL and exposes downloads', async ({
    page,
  }) => {
    const owner = uniqueUser('qr')
    await apiSignup(page.request, owner)
    const org = await apiCreateAndActivateOrg(
      page.request,
      'QR Bistro',
      uniqueSlug('qr'),
    )

    await page.goto(`/dashboard/r/${org.slug}/qr`)

    // Client renders an SVG QR — viewBox is the canonical signal that
    // qrcode.toString output landed in the DOM. (The URL is no longer
    // rendered as visible text on the page since the QR header was
    // condensed to a breadcrumb-only layout.)
    const svg = page.getByTestId('qr-svg').locator('svg')
    await expect(svg).toBeVisible()
    await expect(svg).toHaveAttribute('viewBox', /^0 0 \d+ \d+$/)

    // Download SVG button triggers a real file download.
    const [svgDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('qr-download-svg').click(),
    ])
    expect(svgDownload.suggestedFilename()).toMatch(/^menu-qr-qr-bistro\.svg$/)

    // Download PNG works too.
    const [pngDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('qr-download-png').click(),
    ])
    expect(pngDownload.suggestedFilename()).toMatch(/^menu-qr-qr-bistro\.png$/)
  })

  test('dashboard restaurant page links to the QR page', async ({ page }) => {
    const owner = uniqueUser('qr-link')
    await apiSignup(page.request, owner)
    const org = await apiCreateAndActivateOrg(
      page.request,
      'Link Bistro',
      uniqueSlug('qr-link'),
    )

    await page.goto(`/dashboard/r/${org.slug}`)
    // Base UI's Button keeps role="button" even when rendered as an <a>, so
    // query by button role rather than link role.
    await page.getByRole('button', { name: 'QR code' }).click()
    await expect(page).toHaveURL(`/dashboard/r/${org.slug}/qr`)
    // The page header is a breadcrumb (Restaurants / <name> / QR code) — the
    // "QR code" lives in the current segment, which is the only h1.
    await expect(page.getByRole('heading')).toContainText('QR code')
  })
})
