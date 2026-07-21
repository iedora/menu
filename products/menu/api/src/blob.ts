import { AwsClient } from "aws4fetch";

// Minimal S3-compatible object-storage client. Covers exactly what uploads need:
// presigned browser PUTs + server-side stat/delete. Built on aws4fetch (a tiny
// SigV4 signer that runs on Node and Bun, against R2 / MinIO / AWS S3). A null
// client means "uploads disabled" (no S3_ENDPOINT configured).

export interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  publicUrl: string; // CDN base; defaults to endpoint/bucket
  forcePathStyle: boolean;
}

export interface BlobStat {
  exists: boolean;
  contentType: string;
  size: number;
}

export class BlobClient {
  private readonly aws: AwsClient;
  private readonly cfg: S3Config;
  private readonly publicBase: string;

  constructor(cfg: S3Config) {
    this.cfg = cfg;
    this.aws = new AwsClient({
      accessKeyId: cfg.accessKey,
      secretAccessKey: cfg.secretKey,
      region: cfg.region,
      service: "s3",
    });
    this.publicBase = (cfg.publicUrl || `${cfg.endpoint.replace(/\/$/, "")}/${cfg.bucket}`).replace(/\/$/, "");
  }

  /** The wire URL of an object — path-style (`endpoint/bucket/key`) or
   *  virtual-hosted (`bucket.host/key`) per `forcePathStyle`. */
  private objectURL(key: string): string {
    const ep = this.cfg.endpoint.replace(/\/$/, "");
    if (this.cfg.forcePathStyle) return `${ep}/${this.cfg.bucket}/${encodeURI(key)}`;
    const u = new URL(ep);
    return `${u.protocol}//${this.cfg.bucket}.${u.host}/${encodeURI(key)}`;
  }

  /** The CDN/browser address of a key. */
  publicURL(key: string): string {
    return `${this.publicBase}/${key}`;
  }

  /** Inverts publicURL; "" when the URL isn't ours (defends against deleting foreign objects). */
  keyFromPublicURL(url: string): string {
    const prefix = `${this.publicBase}/`;
    return url.startsWith(prefix) ? url.slice(prefix.length) : "";
  }

  /** A URL a browser can PUT the object to within `expiresInSeconds`. The
   *  content-type is signed, so the browser's PUT must send the same one. */
  async presignPut(key: string, expiresInSeconds: number, contentType: string): Promise<string> {
    const url = new URL(this.objectURL(key));
    url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));
    const signed = await this.aws.sign(url.toString(), {
      method: "PUT",
      headers: { "content-type": contentType },
      aws: { signQuery: true },
    });
    return signed.url;
  }

  async stat(key: string): Promise<BlobStat> {
    const res = await this.aws.fetch(this.objectURL(key), { method: "HEAD" });
    if (res.status === 404) return { exists: false, contentType: "", size: 0 };
    if (!res.ok) throw new Error(`blob stat ${key}: ${res.status}`);
    return {
      exists: true,
      contentType: res.headers.get("content-type") ?? "",
      size: Number(res.headers.get("content-length") ?? 0),
    };
  }

  async delete(key: string): Promise<void> {
    const res = await this.aws.fetch(this.objectURL(key), { method: "DELETE" });
    // S3/R2 DELETE is idempotent — 204 on success, 404 is already-gone.
    if (!res.ok && res.status !== 404) throw new Error(`blob delete ${key}: ${res.status}`);
  }
}

// makeBlobClient returns null (uploads disabled) when no endpoint is configured;
// otherwise validates the required credentials. Ports blob.New.
export function makeBlobClient(cfg: S3Config): BlobClient | null {
  if (!cfg.endpoint) return null;
  if (!cfg.bucket || !cfg.accessKey || !cfg.secretKey) {
    throw new Error("blob: S3_BUCKET, S3_ACCESS_KEY and S3_SECRET_KEY are required with S3_ENDPOINT");
  }
  return new BlobClient(cfg);
}
