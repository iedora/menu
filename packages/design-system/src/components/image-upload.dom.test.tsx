// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { ImageUpload } from './image-upload'

afterEach(() => cleanup())

const u = () => userEvent.setup({ pointerEventsCheck: 0 })

const CONSTRAINTS = {
  maxBytes: 1024 * 1024, // 1 MB
  acceptedMimeTypes: ['image/jpeg', 'image/png'] as const,
}

function makeFile(name: string, type: string, sizeBytes: number): File {
  const buf = new Uint8Array(sizeBytes)
  return new File([buf], name, { type })
}

describe('ImageUpload', () => {
  it('renders a placeholder + Upload button when currentUrl is null', () => {
    render(
      <ImageUpload
        label="Foto"
        currentUrl={null}
        constraints={CONSTRAINTS}
        onUpload={vi.fn()}
        onRemove={vi.fn()}
        testId="up"
      />,
    )
    expect(screen.getByRole('button', { name: 'Upload' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull()
    // Placeholder text
    expect(screen.getByText(/none/i)).toBeTruthy()
  })

  it('renders Replace + Remove when currentUrl is present', () => {
    render(
      <ImageUpload
        label="Foto"
        currentUrl="https://x.com/a.jpg"
        constraints={CONSTRAINTS}
        onUpload={vi.fn()}
        onRemove={vi.fn()}
        testId="up"
      />,
    )
    expect(screen.getByRole('button', { name: 'Replace' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeTruthy()
  })

  it('rejects unsupported file types with an aria-live alert', async () => {
    const onUpload = vi.fn()
    render(
      <ImageUpload
        label="Foto"
        currentUrl={null}
        constraints={CONSTRAINTS}
        onUpload={onUpload}
        onRemove={vi.fn()}
        testId="up"
      />,
    )

    const input = document.querySelector<HTMLInputElement>('input[type=file]')!
    // userEvent.upload respects the `accept` filter even with applyAccept:false
    // in some versions. Fire change directly so the component's validate()
    // path is what rejects the file.
    fireEvent.change(input, {
      target: { files: [makeFile('a.pdf', 'application/pdf', 1024)] },
    })

    expect(onUpload).not.toHaveBeenCalled()
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/unsupported/i)
    expect(alert.getAttribute('aria-live')).toBe('assertive')
  })

  it('rejects files above maxBytes', async () => {
    const onUpload = vi.fn()
    render(
      <ImageUpload
        label="Foto"
        currentUrl={null}
        constraints={CONSTRAINTS}
        onUpload={onUpload}
        onRemove={vi.fn()}
        testId="up"
      />,
    )
    const input = document.querySelector<HTMLInputElement>('input[type=file]')!
    await u().upload(input, makeFile('a.jpg', 'image/jpeg', 2 * 1024 * 1024))

    expect(onUpload).not.toHaveBeenCalled()
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/too large/i)
  })

  it('calls onUpload with a valid file', async () => {
    const onUpload = vi.fn(async () => ({ ok: true as const, url: 'https://x.com/up.jpg' }))
    render(
      <ImageUpload
        label="Foto"
        currentUrl={null}
        constraints={CONSTRAINTS}
        onUpload={onUpload}
        onRemove={vi.fn()}
        testId="up"
      />,
    )
    const input = document.querySelector<HTMLInputElement>('input[type=file]')!
    await u().upload(input, makeFile('a.jpg', 'image/jpeg', 1024))

    await waitFor(() => expect(onUpload).toHaveBeenCalledOnce())
    const calls = onUpload.mock.calls as unknown as Array<[File]>
    expect(calls[0]?.[0]).toBeInstanceOf(File)
  })

  it('surfaces upload error from onUpload via alert', async () => {
    const onUpload = vi.fn(async () => ({ ok: false as const, error: 'boom' }))
    render(
      <ImageUpload
        label="Foto"
        currentUrl={null}
        constraints={CONSTRAINTS}
        onUpload={onUpload}
        onRemove={vi.fn()}
        testId="up"
      />,
    )
    const input = document.querySelector<HTMLInputElement>('input[type=file]')!
    await u().upload(input, makeFile('a.jpg', 'image/jpeg', 1024))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('boom')
  })

  it('clicking Remove invokes onRemove', async () => {
    const onRemove = vi.fn(async () => ({ ok: true as const }))
    render(
      <ImageUpload
        label="Foto"
        currentUrl="https://x.com/a.jpg"
        constraints={CONSTRAINTS}
        onUpload={vi.fn()}
        onRemove={onRemove}
        testId="up"
      />,
    )
    await u().click(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(onRemove).toHaveBeenCalledOnce())
  })

  it('exposes the testId-suffixed selectors on sub-elements', () => {
    render(
      <ImageUpload
        label="Foto"
        currentUrl="https://x.com/a.jpg"
        constraints={CONSTRAINTS}
        onUpload={vi.fn()}
        onRemove={vi.fn()}
        testId="up"
      />,
    )
    expect(document.querySelector('[data-test-id="up-pick"]')).toBeTruthy()
    expect(document.querySelector('[data-test-id="up-remove"]')).toBeTruthy()
    expect(document.querySelector('[data-test-id="up-preview"]')).toBeTruthy()
    expect(document.querySelector('[data-test-id="up-input"]')).toBeTruthy()
  })
})
