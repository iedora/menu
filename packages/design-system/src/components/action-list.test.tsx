import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ActionList } from './action-list'

describe('ActionList', () => {
  const items = [
    { key: 'edit', label: 'Edit', onClick: vi.fn() },
    { key: 'delete', label: 'Delete', danger: true, onClick: vi.fn() },
  ]

  it('renders one button per item', () => {
    const html = renderToStaticMarkup(<ActionList items={items} />)
    expect(html).toContain('Edit')
    expect(html).toContain('Delete')
    expect((html.match(/<button/g) ?? []).length).toBe(2)
  })

  it('flags danger items with the danger modifier class', () => {
    const html = renderToStaticMarkup(<ActionList items={items} />)
    expect(html).toContain('ds-action-list__item--danger')
  })

  it('applies a custom className to the root', () => {
    const html = renderToStaticMarkup(
      <ActionList items={items} className="my-list" />,
    )
    expect(html).toContain('ds-action-list')
    expect(html).toContain('my-list')
  })

  it('renders the optional icon node before the label', () => {
    const html = renderToStaticMarkup(
      <ActionList
        items={[{ key: 'k', label: 'Lab', icon: <svg data-test-id="i" />, onClick: vi.fn() }]}
      />,
    )
    expect(html).toContain('<svg')
    expect(html.indexOf('<svg')).toBeLessThan(html.indexOf('Lab'))
  })

  it('renders nothing when items is empty', () => {
    const html = renderToStaticMarkup(<ActionList items={[]} />)
    expect(html).not.toContain('<button')
  })
})
