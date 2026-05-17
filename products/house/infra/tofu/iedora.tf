# House (iedora.com) — Tofu root for the Workers Static Assets deploy.
#
# Owns ONE thing: a narrow Cloudflare API token that wrangler uses to push
# the worker + assets at `iedora.com`. Everything else — the worker itself,
# the DNS record at the apex, the TLS cert — is created by `wrangler deploy`
# reading products/house/wrangler.toml (workers_dev=false + custom_domain
# route). Cloudflare absorbed all of those concerns into the Worker.
#
# What this DOESN'T need to manage (vs. the previous Pages-era setup):
#   - cloudflare_pages_project          (Pages gone)
#   - cloudflare_pages_domain           (Pages gone)
#   - cloudflare_dns_record (apex)      (wrangler creates it via custom_domain)
#   - account-level Bulk Redirect       (workers_dev=false closes the leak)
#
# Migration note: if you previously ran the Pages-era version of this root,
# run `just house::destroy` on the OLD files FIRST to clear those resources
# from state, then pull these new files and `just house::deploy` for a clean
# Workers setup. State is encrypted so a stale state file won't accidentally
# leak old tokens.

# ── Workload token for wrangler ──────────────────────────────────────────────
#
# The bootstrap token in BWS (TF_VAR_cloudflare_api_token) is what Tofu uses
# to provision this resource — it's admin-ish, because Tofu can't provision
# its own credential (chicken/egg). It never leaves the parent shell.
#
# For `wrangler deploy` we mint a narrower token with just what an asset
# deploy actually needs:
#   - Account · Workers Scripts · Edit   (write the worker + upload assets)
#   - Zone · DNS · Edit                  (for the auto-created custom domain)
#
# Rotation: `tofu apply -replace=cloudflare_api_token.workers_deploy`
# regenerates the token value; wrangler picks the new one up on the next
# deploy because the justfile reads it from `tofu output` every run.
#
# Permission group IDs are hardcoded (the v5 Cloudflare provider dropped
# the `cloudflare_api_token_permission_groups` data source in favor of
# stable hardcoded IDs). If Cloudflare ever rotates one, look up the new
# value with:
#
#   curl -s -H "Authorization: Bearer $BOOTSTRAP_TOKEN" \
#     https://api.cloudflare.com/client/v4/user/tokens/permission_groups \
#     | jq '.result[] | select(.name | test("Workers Scripts Write|Workers Routes Write|DNS Write"))'

locals {
  # Account-scope: upload + manage the worker script + its assets.
  permission_group_workers_scripts_write = "e086da7e2179491d91ee5f35b3ca210a"
  # Zone-scope: bind / unbind the worker route at iedora.com. Wrangler GETs
  # /zones/{id}/workers/routes during every deploy to check what's already
  # bound; without this it 403s before the route is created.
  permission_group_workers_routes_write = "28f4b596e7d643029c524985477ae49a"
  # Zone-scope: edit DNS records (the proxied AAAA at the apex that
  # `custom_domain = true` triggers Cloudflare to create).
  permission_group_dns_write = "4755a26eedb94da69e1066d98aa820be"

  zone_resources = jsonencode({
    "com.cloudflare.api.account.${var.account_id}" = {
      "com.cloudflare.api.account.zone.*" = "*"
    }
  })
}

resource "cloudflare_api_token" "workers_deploy" {
  name = "${var.worker_name}-workers-deploy"

  # KNOWN BUG: the cloudflare/cloudflare v5 provider returns api_token
  # `policies` (and the `permission_groups` inside each policy) in a
  # non-deterministic order, so every apply trips "Provider produced
  # inconsistent result after apply" even with no real change.
  # Splitting one permission_group per policy isn't enough — the order
  # of the policies themselves drifts too. Workaround: ignore drift on
  # `policies` after first create. Auditing the token's actual perms
  # is a dashboard concern from then on.
  #
  # Reference: github.com/cloudflare/terraform-provider-cloudflare#5849
  # (or similar — track upstream for a fix that lets us drop the lifecycle).
  lifecycle {
    ignore_changes = [policies]
  }

  policies = [
    {
      effect = "allow"
      permission_groups = [
        { id = local.permission_group_workers_scripts_write }
      ]
      resources = jsonencode({
        "com.cloudflare.api.account.${var.account_id}" = "*"
      })
    },
    {
      effect = "allow"
      permission_groups = [
        { id = local.permission_group_workers_routes_write }
      ]
      # All zones in the account — wrangler only touches the zone matching
      # the route in wrangler.toml. Tighten by replacing the wildcard with
      # "com.cloudflare.api.account.zone.<zone_id>" if you'd rather scope
      # this token to a single zone (requires a data "cloudflare_zone").
      resources = local.zone_resources
    },
    {
      effect = "allow"
      permission_groups = [
        { id = local.permission_group_dns_write }
      ]
      resources = local.zone_resources
    },
  ]
}
