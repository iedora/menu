# House (iedora.com) — its own root module with its own state.
#
# Owns:
#   - The Cloudflare Pages project that serves the iedora.com root page
#   - A proxied CNAME at the apex pointing the zone at that project
#   - A narrow `pages_deploy` API token that wrangler uses for uploads
#
# Static content lives in a sibling `site/` subdirectory (../../site/) and
# is uploaded by:
#     just deploy        (from products/house/infra/)
# which wraps `wrangler pages deploy ../site`. The subdir exists so wrangler
# only uploads HTML/CSS, NOT the infra/ tree (which contains the Tofu
# provider binary — 178 MiB, well over Pages's 25 MiB per-file limit; Pages
# has no .gitignore/.assetsignore support for the `pages deploy` command).
# Tofu only manages the project shell + DNS + the deploy token.
#
# This root needs `Account · Cloudflare Pages · Edit` on
# var.cloudflare_api_token beyond what the menu product requires.
#
# KNOWN LIMITATION: Cloudflare Pages doesn't let you disable public access
# to the `iedora-com.pages.dev` URL. CF's official position:
# "It is not possible to completely disable the project.pages.dev subdomain"
# (https://developers.cloudflare.com/pages/platform/known-issues/).
#
# Workaround in this codebase: `redirect.tf` declares an account-level Bulk
# Redirect that 301's iedora-com.pages.dev/* → iedora.com/* (and the preview
# hash URLs too, via `include_subdomains`). Defense-in-depth — anyone who
# discovers the pages.dev URL gets bounced to the canonical domain.

data "cloudflare_zone" "this" {
  filter = {
    name = var.zone_name
  }
}

# ── Cloudflare Pages project for the root brand site ─────────────────────────

resource "cloudflare_pages_project" "iedora_root" {
  account_id        = var.account_id
  name              = var.root_pages_project_name
  production_branch = "main"
}

# Bind the apex hostname to the Pages project. This only creates the
# Pages-side binding; the DNS record below is what actually routes traffic.
resource "cloudflare_pages_domain" "iedora_root_apex" {
  account_id   = var.account_id
  project_name = cloudflare_pages_project.iedora_root.name
  name         = var.zone_name
}

# Apex CNAME → <project>.pages.dev. Cloudflare flattens CNAME-at-apex when
# proxied=true, so this serves the bare iedora.com directly.
resource "cloudflare_dns_record" "iedora_root_apex" {
  zone_id = data.cloudflare_zone.this.id
  name    = var.zone_name
  type    = "CNAME"
  content = cloudflare_pages_project.iedora_root.subdomain
  ttl     = 1 # auto (required when proxied)
  proxied = true
}

# ── Workload token for wrangler ───────────────────────────────────────────────
#
# The bootstrap token in BWS (CLOUDFLARE_API_TOKEN) is what Tofu authenticates
# with to provision everything in this root — it has to be admin-ish, because
# Tofu can't provision its own credential (chicken/egg). That token never
# leaves the parent shell of `just tofu-apply`.
#
# For `wrangler pages deploy` we mint a narrower, Tofu-managed token: Pages
# Write only (no Tunnel, R2, DNS, or token-edit reach). If it leaks, the worst
# someone can do is push a different `index.html` to the Pages project. Same
# pattern as `cloudflare_api_token.assets_r2` / `.backups_r2` in the menu
# product (../../menu/infra/tofu/menu.tf).
#
# Rotation: `tofu -chdir=tofu apply -replace=cloudflare_api_token.pages_deploy`
# (from products/house/infra/) regenerates the token value — wrangler picks
# the new one up on next deploy because the justfile reads it from
# `tofu output` every run.
locals {
  # "Pages Write" account-level permission group. Stable, looked up once:
  #   curl -H "Authorization: Bearer $TOKEN" \
  #     https://api.cloudflare.com/client/v4/user/tokens/permission_groups
  permission_group_pages_write = "8d28297797f24fb8a0c332fe0866ec89"
}

resource "cloudflare_api_token" "pages_deploy" {
  name = "${var.root_pages_project_name}-pages-deploy"

  policies = [{
    effect = "allow"
    permission_groups = [
      { id = local.permission_group_pages_write }
    ]
    # Cloudflare's Pages permission is account-scoped — there isn't a stable
    # public URN to scope further down to a single project. Narrowing by
    # *category* (Pages only, no R2/Tunnel/DNS) is still a meaningful blast
    # radius reduction vs. handing wrangler the bootstrap token.
    resources = jsonencode({
      "com.cloudflare.api.account.${var.account_id}" = "*"
    })
  }]
}
