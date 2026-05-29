if (!process.env.CI) {
  process.env.TESTCONTAINERS_REUSE_ENABLE ??= 'true'
}

import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers'

/**
 * Boots an ephemeral MinIO container — real S3 API (PutBucketPolicy,
 * CORS, presign all work). Reuse is on locally, off in CI.
 */

export type MinioHandle = {
  endpoint: string
  accessKey: string
  secretKey: string
  stop(): Promise<void>
}

export type MinioOptions = {
  image?: string
  reuse?: boolean
  reuseKey?: string
  rootUser?: string
  rootPassword?: string
}

export async function bootMinio(opts: MinioOptions = {}): Promise<MinioHandle> {
  const image = opts.image ?? 'minio/minio:latest'
  const reuse = opts.reuse ?? !process.env.CI
  const rootUser = opts.rootUser ?? 'minioadmin'
  const rootPassword = opts.rootPassword ?? 'minioadmin'

  const builder = new GenericContainer(image)
    .withCommand(['server', '/data'])
    .withEnvironment({
      MINIO_ROOT_USER: rootUser,
      MINIO_ROOT_PASSWORD: rootPassword,
    })
    .withExposedPorts(9000)
    .withWaitStrategy(
      Wait.forHttp('/minio/health/ready', 9000).withStartupTimeout(30_000),
    )
  if (reuse) {
    builder.withReuse()
    if (opts.reuseKey) builder.withLabels({ 'iedora.reuse-key': opts.reuseKey })
  }
  const container: StartedTestContainer = await builder.start()

  return {
    endpoint: `http://${container.getHost()}:${container.getMappedPort(9000)}`,
    accessKey: rootUser,
    secretKey: rootPassword,
    stop: async () => {
      // Reused containers must stay running between runs — Ryuk cleans
      // them up eventually. Stopping here defeats reuse.
      if (reuse) return
      await container.stop()
    },
  }
}
