# Cloudflare zone + tunnel + DNS para iedora.
# Tunnel token escrito para .tunnel-token (lido por .kamal/secrets).

terraform {
  required_version = ">= 1.6.0"
  required_providers {
    cloudflare = { source = "cloudflare/cloudflare", version = "~> 5.19" }
    random     = { source = "hashicorp/random",      version = "~> 3.9"  }
    local      = { source = "hashicorp/local",       version = "~> 2.9"  }
  }
}

provider "cloudflare" {}

# ─── Variables ──────────────────────────────────────────────────────
variable "account_id" {
  description = "Cloudflare account ID"
  type        = string
}

variable "zone_name" {
  description = "Cloudflare zone"
  type        = string
  default     = "iedora.com"
}

variable "hostnames" {
  description = "Hostnames públicos servidos pelo iedora-web via kamal-proxy"
  type        = list(string)
  default = [
    "iedora.com",
    "menu.iedora.com",
    "core.iedora.com",
    "imopush.iedora.com",
  ]
}

# ─── Tunnel ─────────────────────────────────────────────────────────
resource "random_id" "tunnel_secret" {
  byte_length = 32
}

resource "cloudflare_zero_trust_tunnel_cloudflared" "iedora" {
  account_id    = var.account_id
  name          = "iedora"
  tunnel_secret = random_id.tunnel_secret.b64_std
  config_src    = "cloudflare"
}

# Cloudflared corre como Kamal accessory na mesma docker network do
# kamal-proxy → ingress aponta para o container por nome.
resource "cloudflare_zero_trust_tunnel_cloudflared_config" "iedora" {
  account_id = var.account_id
  tunnel_id  = cloudflare_zero_trust_tunnel_cloudflared.iedora.id

  config = {
    ingress = concat(
      [for h in var.hostnames : { hostname = h, service = "http://iedora-web-proxy:80" }],
      [{ service = "http_status:404" }]
    )
  }
}

data "cloudflare_zero_trust_tunnel_cloudflared_token" "iedora" {
  account_id = var.account_id
  tunnel_id  = cloudflare_zero_trust_tunnel_cloudflared.iedora.id
}

# ─── DNS ────────────────────────────────────────────────────────────
data "cloudflare_zone" "this" {
  filter = { name = var.zone_name }
}

resource "cloudflare_dns_record" "public" {
  for_each = toset(var.hostnames)

  zone_id = data.cloudflare_zone.this.zone_id
  name    = each.key
  type    = "CNAME"
  content = "${cloudflare_zero_trust_tunnel_cloudflared.iedora.id}.cfargotunnel.com"
  proxied = true
  ttl     = 1
}

# ─── Outputs ────────────────────────────────────────────────────────
resource "local_sensitive_file" "tunnel_token" {
  filename        = "${path.module}/.tunnel-token"
  file_permission = "0600"
  content         = data.cloudflare_zero_trust_tunnel_cloudflared_token.iedora.token
}

output "tunnel_id" {
  value = cloudflare_zero_trust_tunnel_cloudflared.iedora.id
}

output "dns_records" {
  value = [for r in cloudflare_dns_record.public : r.name]
}
