import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ImageGallery } from './image-gallery'

const images = Array.from({ length: 5 }, (_, i) => ({
  src: `https://x.com/${i}.jpg`,
  alt: `Photo ${i}`,
}))

describe('ImageGallery', () => {
  it('renders nothing when images is empty', () => {
    const html = renderToStaticMarkup(<ImageGallery images={[]} />)
    expect(html).toBe('')
  })

  it('renders one <img> per image (up to maxPreview)', () => {
    const html = renderToStaticMarkup(<ImageGallery images={images} />)
    expect((html.match(/<img/g) ?? []).length).toBe(5)
  })

  it('caps preview at maxPreview and shows +N indicator', () => {
    const html = renderToStaticMarkup(<ImageGallery images={images} maxPreview={2} />)
    expect((html.match(/<img/g) ?? []).length).toBe(2)
    expect(html).toMatch(/\+\s*3/)
  })

  it('renders the optional label', () => {
    const html = renderToStaticMarkup(<ImageGallery images={images} label="Fotos" />)
    expect(html).toContain('Fotos')
  })

  it('forwards data-test-id + className to the section', () => {
    const html = renderToStaticMarkup(
      <ImageGallery images={images} testId="gallery-1" className="my-gallery" />,
    )
    expect(html).toContain('data-test-id="gallery-1"')
    expect(html).toContain('my-gallery')
  })

  it('honours custom aspectRatio on the thumbnails', () => {
    const html = renderToStaticMarkup(
      <ImageGallery images={images.slice(0, 1)} aspectRatio="16 / 9" />,
    )
    expect(html).toMatch(/aspect-ratio:\s*16\s*\/\s*9/)
  })
})
