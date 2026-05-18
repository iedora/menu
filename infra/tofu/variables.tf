variable "cloudflare_api_token" {
  description = "Cloudflare bootstrap token. TF_VAR_cloudflare_api_token (set by bin/with-secrets from INFRA_CLOUDFLARE_API_TOKEN)."
  type        = string
  sensitive   = true
}

variable "state_passphrase" {
  description = "OpenTofu state/plan encryption passphrase. ≥ 16 chars. TF_VAR_state_passphrase."
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.state_passphrase) >= 16
    error_message = "state_passphrase must be at least 16 characters."
  }
}

variable "account_id" {
  description = "Cloudflare account ID. TF_VAR_account_id (32-char hex)."
  type        = string

  validation {
    condition     = can(regex("^[0-9a-f]{32}$", var.account_id))
    error_message = "account_id must be a 32-character hex string."
  }
}

variable "backups_bucket_name" {
  description = "Cloudflare R2 bucket name for Postgres dumps. Covers every iedora product's database. Globally unique within your account."
  type        = string
  default     = "iedora-backups"
}

variable "backups_bucket_location" {
  description = "R2 location hint (auto = closest, EUR/EEUR = Europe)."
  type        = string
  default     = "EEUR"
}
