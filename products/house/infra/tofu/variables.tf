variable "cloudflare_api_token" {
  description = <<-EOT
    Bootstrap Cloudflare API token. Permissions for this root:
      - Account · Workers Scripts · Edit       (to mint the workload token)
      - Account · Account Settings · Read
      - Zone · DNS · Edit                       (to mint the workload token)
      - User · API Tokens · Edit                (to create/replace the workload token itself)
    Provide via TF_VAR_cloudflare_api_token (set by bin/with-secrets from BWS).
    The same BWS token can serve every product's Tofu root if granted every
    permission any of them require (one bootstrap, many workload tokens).
  EOT
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

variable "worker_name" {
  description = <<-EOT
    Cloudflare Worker name for the house site. Lowercase, kebab-case. Must
    match `name = "..."` in products/house/wrangler.toml — the workload
    token's name uses this as its prefix, and a mismatch only affects
    cosmetics in the dashboard, not the deploy.
  EOT
  type        = string
  default     = "iedora-com"
}
