import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const nextConfig: NextConfig = {
  // Standalone output gera um bundle minimal com server.js — ideal para Docker
  output: 'standalone',
  allowedDevOrigins: [
    'metamenu.733113.xyz'
  ]
}

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')
export default withNextIntl(nextConfig)
