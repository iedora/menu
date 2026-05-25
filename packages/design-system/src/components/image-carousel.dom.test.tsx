// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { ImageCarousel } from './image-carousel'

afterEach(() => cleanup())

const u = () => userEvent.setup({ pointerEventsCheck: 0 })

const IMAGES = [
  { src: 'https://x.com/a.jpg', alt: 'A' },
  { src: 'https://x.com/b.jpg', alt: 'B' },
  { src: 'https://x.com/c.jpg', alt: 'C' },
]

describe('ImageCarousel', () => {
  it('returns null for an empty image list', () => {
    const { container } = render(<ImageCarousel images={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders all slides with only the active one visible to AT', () => {
    render(<ImageCarousel images={IMAGES} />)
    const slides = document.querySelectorAll('.ds-carousel__slide')
    expect(slides).toHaveLength(3)
    expect(slides[0]!.getAttribute('aria-hidden')).toBe('false')
    expect(slides[1]!.getAttribute('aria-hidden')).toBe('true')
  })

  it('exposes a region with carousel role description', () => {
    render(<ImageCarousel images={IMAGES} testId="hero" />)
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-test-id')).toBe('hero')
    expect(region.getAttribute('aria-roledescription')).toBe('carousel')
  })

  it('advances index on next-arrow click and fires onIndexChange', async () => {
    const onChange = vi.fn()
    render(<ImageCarousel images={IMAGES} onIndexChange={onChange} />)
    await u().click(screen.getByRole('button', { name: 'Próxima foto' }))
    expect(onChange).toHaveBeenCalledWith(1)
    expect(screen.getByText('2 / 3')).toBeTruthy()
  })

  it('hides the prev arrow on first slide and next arrow on last slide', async () => {
    render(<ImageCarousel images={IMAGES} />)
    expect(screen.queryByRole('button', { name: 'Foto anterior' })).toBeNull()
    await u().click(screen.getByRole('button', { name: 'Próxima foto' }))
    await u().click(screen.getByRole('button', { name: 'Próxima foto' }))
    expect(screen.queryByRole('button', { name: 'Próxima foto' })).toBeNull()
  })

  it('jumps to a thumbnail when clicked', async () => {
    render(<ImageCarousel images={IMAGES} />)
    const thumbs = screen.getAllByRole('button', { name: /^Ver foto/ })
    await u().click(thumbs[2]!)
    expect(screen.getByText('3 / 3')).toBeTruthy()
  })

  it('counter is announced via aria-live=polite', () => {
    render(<ImageCarousel images={IMAGES} />)
    const counter = document.querySelector('.ds-carousel__counter')
    expect(counter?.getAttribute('aria-live')).toBe('polite')
  })
})
