import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ImageThumbnail } from './image-thumbnail'

describe('ImageThumbnail', () => {
  it('renders an <img> with the given src + alt', () => {
    const html = renderToStaticMarkup(
      <ImageThumbnail src="https://x.com/a.jpg" alt="Banner" />,
    )
    expect(html).toContain('src="https://x.com/a.jpg"')
    expect(html).toContain('alt="Banner"')
  })

  it('defaults alt to empty string (decorative)', () => {
    const html = renderToStaticMarkup(<ImageThumbnail src="x.jpg" />)
    expect(html).toContain('alt=""')
  })

  it('default border modifier puts hairline border on the wrapper', () => {
    const html = renderToStaticMarkup(<ImageThumbnail src="x.jpg" />)
    expect(html).toContain('border')
    expect(html).toContain('border-[var(--ink-14)]')
  })

  it('border="none" omits the hairline class', () => {
    const html = renderToStaticMarkup(<ImageThumbnail src="x.jpg" border="none" />)
    expect(html).not.toContain('border-[var(--ink-14)]')
  })

  it('uses width/height to derive aspect-ratio when no aspectRatio override', () => {
    const html = renderToStaticMarkup(
      <ImageThumbnail src="x.jpg" width={120} height={90} />,
    )
    expect(html).toMatch(/aspect-ratio:\s*120\s*\/\s*90/)
  })

  it('aspectRatio prop overrides width/height ratio', () => {
    const html = renderToStaticMarkup(
      <ImageThumbnail src="x.jpg" width={120} height={90} aspectRatio="1 / 1" />,
    )
    expect(html).toMatch(/aspect-ratio:\s*1\s*\/\s*1/)
  })

  it('forwards extra img props (loading, data-test-id) onto the <img>', () => {
    const html = renderToStaticMarkup(
      <ImageThumbnail src="x.jpg" loading="eager" data-test-id="thumb-1" />,
    )
    expect(html).toContain('loading="eager"')
    expect(html).toContain('data-test-id="thumb-1"')
  })
})
