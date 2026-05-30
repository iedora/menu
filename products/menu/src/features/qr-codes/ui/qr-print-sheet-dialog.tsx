'use client'

import * as React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'qrcode'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  Field,
  FieldInput,
  FieldLabel,
  FieldHint,
} from '@iedora/design-system'

const A4_W_MM = 210
const A4_H_MM = 297

// Lower bound for the gutter. ~5 mm is the threshold where a household
// scissor cut still leaves the QR intact on both sides of the line.
const MIN_GUTTER_MM = 5
const MAX_GUTTER_MM = 25

// Lower bound for the QR module size. Below ~20 mm a phone camera at
// table distance starts to miss; above ~80 mm we waste paper.
const MIN_QR_MM = 20
const MAX_QR_MM = 80

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min
  return Math.max(min, Math.min(max, value))
}

// Pack as many QR cells as possible inside an A4 page where every gap
// (outer margins AND inter-cell gutters) equals `gutterMm`:
//   pageWidth = (cols + 1) * gutter + cols * qrSize  ≤ A4_W_MM
//   ⇒ cols = floor((A4_W_MM − gutter) / (qrSize + gutter))
function computeGrid(qrSizeMm: number, gutterMm: number) {
  const denom = qrSizeMm + gutterMm
  const cols = Math.max(0, Math.floor((A4_W_MM - gutterMm) / denom))
  const rows = Math.max(0, Math.floor((A4_H_MM - gutterMm) / denom))
  return { cols, rows, total: cols * rows }
}

export function QrPrintSheetDialog({
  open,
  onOpenChange,
  code,
  stickerUrl,
  label,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
  code: string
  stickerUrl: string
  label: string | null
}) {
  const [gutterInput, setGutterInput] = useState(8)
  const [qrSizeInput, setQrSizeInput] = useState(35)
  const [svgMarkup, setSvgMarkup] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    QRCode.toString(stickerUrl, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then((markup) => {
        if (!cancelled) setSvgMarkup(markup)
      })
      .catch(() => {
        /* swallow — print stays disabled while svg is null */
      })
    return () => {
      cancelled = true
    }
  }, [stickerUrl, open])

  const gutterMm = clamp(gutterInput, MIN_GUTTER_MM, MAX_GUTTER_MM)
  const qrSizeMm = clamp(qrSizeInput, MIN_QR_MM, MAX_QR_MM)
  const grid = useMemo(() => computeGrid(qrSizeMm, gutterMm), [qrSizeMm, gutterMm])

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="break-all">Print A4 sheet · {code}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="grid gap-3 sm:grid-cols-2" data-test-id="qr-print-sheet-controls">
              <Field>
                <FieldLabel htmlFor="qr-print-gutter">Gutter (mm)</FieldLabel>
                <FieldInput
                  id="qr-print-gutter"
                  data-test-id="qr-print-sheet-gutter"
                  type="number"
                  compact
                  min={MIN_GUTTER_MM}
                  max={MAX_GUTTER_MM}
                  step={1}
                  value={gutterInput}
                  onChange={(e) => setGutterInput(Number(e.target.value))}
                />
                <FieldHint>
                  Min {MIN_GUTTER_MM} mm — leaves room for a scissor cut after laminating.
                </FieldHint>
              </Field>
              <Field>
                <FieldLabel htmlFor="qr-print-size">QR size (mm)</FieldLabel>
                <FieldInput
                  id="qr-print-size"
                  data-test-id="qr-print-sheet-size"
                  type="number"
                  compact
                  min={MIN_QR_MM}
                  max={MAX_QR_MM}
                  step={1}
                  value={qrSizeInput}
                  onChange={(e) => setQrSizeInput(Number(e.target.value))}
                />
                <FieldHint>Recommended ≥ 25 mm for table-distance scans.</FieldHint>
              </Field>
            </div>

            <div
              className="mt-4 border border-[var(--ink-14)] bg-[var(--paper)] p-3"
              data-test-id="qr-print-sheet-summary"
            >
              <p className="font-[family-name:var(--mono)] text-[10.5px] uppercase tracking-[0.18em] text-[var(--ink-55)]">
                A4 · 210 × 297 mm
              </p>
              <p className="mt-1 text-sm text-[var(--ink)]">
                {grid.cols} × {grid.rows} ={' '}
                <strong data-test-id="qr-print-sheet-total">{grid.total}</strong> QR code
                {grid.total === 1 ? '' : 's'} per sheet
              </p>
              {grid.total === 0 && (
                <p className="mt-1 text-xs text-[var(--cinnabar)]">
                  Reduce QR size or gutter — nothing fits at these values.
                </p>
              )}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              variant="solid"
              type="button"
              arrow
              disabled={!svgMarkup || grid.total === 0}
              onClick={() => window.print()}
              data-test-id="qr-print-sheet-print"
            >
              Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {mounted &&
        open &&
        createPortal(
          <PrintSheet
            svgMarkup={svgMarkup}
            qrSizeMm={qrSizeMm}
            gutterMm={gutterMm}
            grid={grid}
            code={code}
            label={label}
          />,
          document.body,
        )}
    </>
  )
}

// Hidden on screen, materializes only in the print preview. Sized in
// mm so the printer driver matches the physical A4 sheet.
function PrintSheet({
  svgMarkup,
  qrSizeMm,
  gutterMm,
  grid,
  code,
  label,
}: {
  svgMarkup: string | null
  qrSizeMm: number
  gutterMm: number
  grid: { cols: number; rows: number; total: number }
  code: string
  label: string | null
}) {
  const cells = svgMarkup && grid.total > 0 ? grid.total : 0
  return (
    <div id="qr-print-sheet-root" aria-hidden="true">
      <style>{`
        #qr-print-sheet-root { position: fixed; inset: 0; visibility: hidden; pointer-events: none; z-index: -1; }
        #qr-print-sheet-root svg { width: 100%; height: 100%; display: block; }
        @media print {
          @page { size: A4; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body > *:not(#qr-print-sheet-root) { display: none !important; }
          #qr-print-sheet-root { position: static; visibility: visible; pointer-events: auto; z-index: auto; }
        }
      `}</style>
      <div
        id="qr-print-sheet"
        data-test-id="qr-print-sheet"
        data-qr-code={code}
        data-qr-label={label ?? ''}
        style={{
          width: `${A4_W_MM}mm`,
          height: `${A4_H_MM}mm`,
          padding: `${gutterMm}mm`,
          boxSizing: 'border-box',
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.max(grid.cols, 1)}, ${qrSizeMm}mm)`,
          gridAutoRows: `${qrSizeMm}mm`,
          gap: `${gutterMm}mm`,
          justifyContent: 'start',
          alignContent: 'start',
          background: '#fff',
        }}
      >
        {Array.from({ length: cells }).map((_, i) => (
          <div
            key={i}
            style={{ width: `${qrSizeMm}mm`, height: `${qrSizeMm}mm` }}
            dangerouslySetInnerHTML={{ __html: svgMarkup as string }}
          />
        ))}
      </div>
    </div>
  )
}
