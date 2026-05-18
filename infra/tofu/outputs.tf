output "backups_bucket_name" {
  description = "Name of the R2 bucket holding Postgres dumps."
  value       = cloudflare_r2_bucket.backups.name
}

output "backups_r2_access_key_id" {
  description = "R2 S3-compatible Access Key ID for the backups accessory."
  value       = cloudflare_api_token.backups_r2.id
}

output "backups_r2_secret_access_key" {
  description = "R2 S3-compatible Secret Access Key (SHA-256 of the token value)."
  value       = sha256(cloudflare_api_token.backups_r2.value)
  sensitive   = true
}
