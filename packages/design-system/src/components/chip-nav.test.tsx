import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ChipNav } from './chip-nav'

const chips = [
  { id: 'idealista', label: 'Idealista' },
  { id: 'olx', label: 'OLX' },
]

describe('ChipNav (static)', () => {
  it('renders a nav with aria-label', () => {
    const html = renderToStaticMarkup(
      <ChipNav chips={chips} onSelect={vi.fn()} ariaLabel="Plataformas" />,
    )
    expect(html).toMatch(/<nav[^>]*aria-label="Plataformas"/)
  })

  it('renders one chip per item', () => {
    const html = renderToStaticMarkup(<ChipNav chips={chips} onSelect={vi.fn()} />)
    expect(html).toContain('Idealista')
    expect(html).toContain('OLX')
  })

  it('marks the active chip via aria-current', () => {
    const html = renderToStaticMarkup(
      <ChipNav chips={chips} activeId="olx" onSelect={vi.fn()} />,
    )
    expect(html).toMatch(/aria-current="true"/)
  })

  it('renders the optional "add" trigger when onAdd is provided', () => {
    const html = renderToStaticMarkup(
      <ChipNav
        chips={chips}
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        addLabel="Adicionar plataforma"
      />,
    )
    expect(html).toContain('Adicionar plataforma')
  })

  it('forwards data-test-id to the root nav', () => {
    const html = renderToStaticMarkup(
      <ChipNav chips={chips} onSelect={vi.fn()} testId="chip-nav-integrators" />,
    )
    expect(html).toContain('data-test-id="chip-nav-integrators"')
  })

  it('renders nothing when chips is empty', () => {
    const html = renderToStaticMarkup(<ChipNav chips={[]} onSelect={vi.fn()} />)
    // Empty nav still renders, just with no chip buttons
    expect((html.match(/<button/g) ?? []).length).toBe(0)
  })
})
