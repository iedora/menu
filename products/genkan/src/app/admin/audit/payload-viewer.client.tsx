'use client'

import { useState } from 'react'

/**
 * Collapsed JSON viewer for an audit row's payload. Default state is a
 * single-line preview (`{ … }` for an object, `null` otherwise); click to
 * expand into a pretty-printed block.
 */
export function PayloadViewer({ payload }: { payload: unknown }) {
  const [open, setOpen] = useState(false)

  if (payload === null || payload === undefined) {
    return <span style={mutedStyle}>—</span>
  }

  const pretty = (() => {
    try {
      return JSON.stringify(payload, null, 2)
    } catch {
      return String(payload)
    }
  })()

  const preview = (() => {
    if (typeof payload !== 'object') return String(payload)
    if (Array.isArray(payload)) return `[ ${payload.length} ]`
    const keys = Object.keys(payload as Record<string, unknown>)
    if (keys.length === 0) return '{ }'
    return `{ ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '…' : ''} }`
  })()

  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      style={{
        background: 'none',
        border: 0,
        padding: 0,
        cursor: 'pointer',
        fontFamily: 'var(--mono)',
        fontSize: 11,
        color: 'var(--ink-70)',
        textAlign: 'left',
      }}
      aria-expanded={open}
    >
      {open ? (
        <pre
          style={{
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxWidth: 480,
          }}
        >
          {pretty}
        </pre>
      ) : (
        <span>{preview}</span>
      )}
    </button>
  )
}

const mutedStyle: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 11,
  color: 'var(--ink-55)',
}
