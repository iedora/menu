import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PhotoLightbox } from './photo-lightbox'

const URLS = ['https://x.com/a.jpg', 'https://x.com/b.jpg', 'https://x.com/c.jpg']

describe('PhotoLightbox (static markup)', () => {
  it('renders the empty placeholder when urls is empty', () => {
    const html = renderToStaticMarkup(
      <PhotoLightbox urls={[]} testId="prop-1" labels={{ empty: 'Sem foto' }} />,
    )
    expect(html).toContain('Sem foto')
    expect(html).toContain('data-test-id="prop-1-empty"')
  })

  it('falls back to default empty label', () => {
    const html = renderToStaticMarkup(<PhotoLightbox urls={[]} testId="prop-1" />)
    expect(html).toContain('No photo')
  })

  it('renders the current image as the expand button', () => {
    const html = renderToStaticMarkup(
      <PhotoLightbox urls={URLS} testId="prop-1" />,
    )
    expect(html).toContain('src="https://x.com/a.jpg"')
    expect(html).toContain('data-test-id="prop-1-expand"')
  })

  it('renders prev / next arrows + counter when multiple urls', () => {
    const html = renderToStaticMarkup(
      <PhotoLightbox urls={URLS} testId="prop-1" />,
    )
    expect(html).toContain('data-test-id="prop-1-prev"')
    expect(html).toContain('data-test-id="prop-1-next"')
    expect(html).toContain('1/3')
  })

  it('hides prev / next + counter for a single image', () => {
    const html = renderToStaticMarkup(
      <PhotoLightbox urls={[URLS[0]!]} testId="prop-1" />,
    )
    expect(html).not.toContain('data-test-id="prop-1-prev"')
    expect(html).not.toContain('data-test-id="prop-1-next"')
    expect(html).not.toMatch(/\d+\/\d+/)
  })

  it('applies the compact size modifier by default', () => {
    const html = renderToStaticMarkup(
      <PhotoLightbox urls={URLS} testId="prop-1" />,
    )
    expect(html).toContain('ds-photo-lightbox--compact')
  })

  it('applies the large size modifier when requested', () => {
    const html = renderToStaticMarkup(
      <PhotoLightbox urls={URLS} testId="prop-1" size="large" />,
    )
    expect(html).toContain('ds-photo-lightbox--large')
  })

  it('forwards localised aria labels', () => {
    const html = renderToStaticMarkup(
      <PhotoLightbox
        urls={URLS}
        testId="prop-1"
        labels={{
          expand: 'Ampliar foto',
          previous: 'Foto anterior',
          next: 'Próxima foto',
        }}
      />,
    )
    expect(html).toContain('aria-label="Ampliar foto"')
    expect(html).toContain('aria-label="Foto anterior"')
    expect(html).toContain('aria-label="Próxima foto"')
  })

  it('marks the counter aria-live for screen-reader announcements', () => {
    const html = renderToStaticMarkup(
      <PhotoLightbox urls={URLS} testId="prop-1" />,
    )
    expect(html).toContain('aria-live="polite"')
  })
})
