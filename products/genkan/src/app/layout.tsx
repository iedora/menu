import type { Metadata } from 'next'
import { Fraunces, JetBrains_Mono } from 'next/font/google'
import '@iedora/design-system/styles.css'
import './globals.css'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  axes: ['opsz'],
  display: 'swap',
})

const jbMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jbmono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: { default: 'Genkan — Iedora identity', template: '%s · Genkan' },
  description: 'The entryway to every iedora work.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${jbMono.variable}`}
      style={{
        // Re-point the design-system font vars at next/font's loaded
        // families so Fraunces and JetBrains Mono render without dragging
        // Google Fonts CSS into the runtime.
        ['--serif' as string]:
          "var(--font-fraunces), 'Times New Roman', serif",
        ['--mono' as string]:
          'var(--font-jbmono), ui-monospace, SFMono-Regular, Menlo, monospace',
      }}
    >
      <body>{children}</body>
    </html>
  )
}
