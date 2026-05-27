# Cloudflare Zero Trust Tunnel — the only public ingress into the
# Hetzner box.
#
# How it works:
#
#   browser → CF edge (TLS termination, universal cert covers
#                       *.iedora.com automatically) → cloudflared
#               sidecar on the Hetzner box (outbound persistent
#               connection to CF) → Docker DNS resolves the target
#               container by name on the iedora network.
#
# What this gets us:
#
#   - No port 80/443 inbound on the firewall. The box is only
#     reachable on port 22 (SSH).
#   - Zero ACME state on the box — CF owns TLS termination.
#   - All routing config lives in Tofu (this file) — visible in `tofu
#     plan` diffs, version-controlled, easy to add a 5th hostname.
#
# The cloudflared container itself lives in compose.tf::services
# .cloudflared. It reads the tunnel token from BWS via the
# `IAC_TUNNEL_TOKEN` key the autogen sync writes (Tofu mints the
# tunnel, exports the token, bws-sync persists it; cloudflared
# consumes it on every restart).

resource "cloudflare_zero_trust_tunnel_cloudflared" "iedora" {
  account_id    = var.account_id
  name          = "iedora"
  config_src    = "cloudflare" # config managed via the resource below, not local cloudflared.yml
  tunnel_secret = base64encode(random_password.tunnel_secret.result)
}

# 32-byte random for the tunnel-secret. Stable across applies (lifecycle
# prevent_destroy off — rotating it just forces a tunnel + DNS recreate
# which is fine for an iedora-scale estate).
resource "random_password" "tunnel_secret" {
  length  = 32
  special = false
}

# Ingress rules — derived from var.surfaces (which comes from the
# Go surface registry via `iedora emit-topology`). Adding a surface =
# append in topology.go + regen the .auto.tfvars.json. Catch-all at
# the end is required by CF Tunnel.
resource "cloudflare_zero_trust_tunnel_cloudflared_config" "iedora" {
  account_id = var.account_id
  tunnel_id  = cloudflare_zero_trust_tunnel_cloudflared.iedora.id
  config = {
    ingress = concat(
      flatten([
        for s in var.surfaces : [
          for sub in s.subdomains : {
            hostname = sub == "" ? var.zone_name : "${sub}.${var.zone_name}"
            service  = s.service
          }
        ]
      ]),
      [{ service = "http_status:404" }],
    )
  }
}

# Connector token for the cloudflared container. Sensitive — flows
# through compose.tf as the TUNNEL_TOKEN env var. Exposed via BWS
# (the bws_sync resource in secrets.tf) so the operator can recover
# without a fresh tofu apply.
data "cloudflare_zero_trust_tunnel_cloudflared_token" "iedora" {
  account_id = var.account_id
  tunnel_id  = cloudflare_zero_trust_tunnel_cloudflared.iedora.id
}
