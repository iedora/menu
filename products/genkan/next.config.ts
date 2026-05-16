import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@iedora/design-system'],
  outputFileTracingIncludes: {
    '/*': [
      './node_modules/drizzle-orm/**/*',
      './node_modules/postgres/**/*',
      './drizzle/**/*',
      './scripts/migrate.mjs',
    ],
  },
}

export default nextConfig
