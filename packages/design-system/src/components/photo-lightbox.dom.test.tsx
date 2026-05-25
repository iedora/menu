// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { PhotoLightbox } from './photo-lightbox'

afterEach(() => {
  cleanup()
  // Radix portal can leak pointer-events:none across tests (see dialog.dom.test).
  document.body.style.pointerEvents = ''
})

const u = () => userEvent.setup({ pointerEventsCheck: 0 })

const URLS = [
  'https://x.com/a.jpg',
  'https://x.com/b.jpg',
  'https://x.com/c.jpg',
]

describe('PhotoLightbox (interactive)', () => {
  it('advances index when clicking next', async () => {
    render(<PhotoLightbox urls={URLS} testId="p" />)
    expect(document.querySelector('img')!.getAttribute('src')).toBe(URLS[0])
    await u().click(screen.getByRole('button', { name: 'Next photo' }))
    expect(document.querySelector('img')!.getAttribute('src')).toBe(URLS[1])
    expect(screen.getByText('2/3')).toBeTruthy()
  })

  it('wraps around with prev from index 0', async () => {
    render(<PhotoLightbox urls={URLS} testId="p" />)
    await u().click(screen.getByRole('button', { name: 'Previous photo' }))
    expect(screen.getByText('3/3')).toBeTruthy()
  })

  it('opens the fullscreen lightbox when the thumbnail is clicked', async () => {
    render(<PhotoLightbox urls={URLS} testId="p" />)
    await u().click(screen.getByRole('button', { name: 'Expand photo' }))
    await waitFor(() => {
      expect(document.querySelector('[data-test-id="p-lightbox"]')).toBeTruthy()
    })
    expect(document.querySelector('[data-test-id="p-lightbox-close"]')).toBeTruthy()
    expect(document.querySelector('[data-test-id="p-lightbox-prev"]')).toBeTruthy()
    expect(document.querySelector('[data-test-id="p-lightbox-next"]')).toBeTruthy()
  })

  it('closes the lightbox via the close button', async () => {
    render(<PhotoLightbox urls={URLS} testId="p" />)
    await u().click(screen.getByRole('button', { name: 'Expand photo' }))
    await waitFor(() =>
      expect(document.querySelector('[data-test-id="p-lightbox"]')).toBeTruthy(),
    )
    await u().click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() =>
      expect(document.querySelector('[data-test-id="p-lightbox"]')).toBeNull(),
    )
  })

  it('navigates inside the lightbox via the on-stage arrows', async () => {
    render(<PhotoLightbox urls={URLS} testId="p" />)
    await u().click(screen.getByRole('button', { name: 'Expand photo' }))

    const stageNext = await waitFor(() => {
      const el = document.querySelector<HTMLButtonElement>('[data-test-id="p-lightbox-next"]')
      if (!el) throw new Error('stage arrow not mounted yet')
      return el
    })
    await u().click(stageNext)
    expect(screen.getByText('2 / 3')).toBeTruthy()
  })

  it('exposes a sr-only DialogTitle for AT context', async () => {
    render(<PhotoLightbox urls={URLS} testId="p" alt={(i) => `Casa Galizes ${i + 1}`} />)
    await u().click(screen.getByRole('button', { name: 'Expand photo' }))
    await waitFor(() => {
      // Radix Dialog.Title renders as h2 by default. Look up the title by its text.
      expect(screen.getByText('Casa Galizes 1')).toBeTruthy()
    })
  })
})
