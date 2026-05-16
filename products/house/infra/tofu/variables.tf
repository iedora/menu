variable "cloudflare_api_token" {
  description = <<-EOT
    Cloudflare API token. Permissions for this root:
      - Account · Cloudflare Pages · Edit
      - Zone · DNS · Edit (scoped to var.zone_name)
      - Account · Account Settings · Read
      - Account · Account Filter Lists · Edit       (for Bulk Redirect list)
      - Account · Account Rulesets · Edit            (for Bulk Redirect dispatch)
    Provide via TF_VAR_cloudflare_api_token (set by bin/with-secrets from BWS).
    The same BWS token can serve every product's Tofu root if granted every
    permission any of them require (one bootstrap, many workload tokens;
    see docs/secrets.md "Token tiers").
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

variable "zone_name" {
  description = "Cloudflare zone (apex hostname) the root site is served from. TF_VAR_zone_name. Default `iedora.com`."
  type        = string
  default     = "iedora.com"

  validation {
    condition     = can(regex("^[a-z0-9.-]+\\.[a-z]{2,}$", var.zone_name))
    error_message = "zone_name must be a valid apex FQDN."
  }
}

variable "root_pages_project_name" {
  description = "Cloudflare Pages project name. Lowercase, kebab-case. Shown in the Cloudflare dashboard and used by `wrangler pages deploy --project-name=...`."
  type        = string
  default     = "iedora-com"
}
