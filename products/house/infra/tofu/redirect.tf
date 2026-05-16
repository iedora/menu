# Cloudflare Bulk Redirect: 301 iedora-com.pages.dev/* → iedora.com/*.
#
# Cloudflare Pages doesn't let you disable the *.pages.dev subdomain (see
# iedora.tf), so we redirect it instead. Anyone who finds the pages.dev
# URL (search engine, leak, guess) gets bounced to the canonical domain,
# and crawlers see a permanent 301.
#
# Three resources, ALL account-level (not zone-level):
#   1. cloudflare_list (kind="redirect")  — list of redirect entries
#   2. cloudflare_list_item               — the single entry for this product
#   3. cloudflare_ruleset                  — account-level dispatch ruleset
#
# `include_subdomains=true` also redirects the preview hash URLs like
# <hash>.iedora-com.pages.dev. `subpath_matching=true` + `preserve_*` keeps
# the path and query string intact across the redirect.
#
# CAVEAT — singleton ruleset per account/phase:
#   Cloudflare allows ONE account-level ruleset per phase. The
#   "http_request_redirect" phase here is owned by this house Tofu root.
#   If menu (or a future product) ever needs Bulk Redirects, we either:
#     a) add another rule to this ruleset (cross-root coupling — bad), or
#     b) refactor the ruleset into a shared Tofu root.
#   House is the only product needing it today.

resource "cloudflare_list" "pages_to_apex" {
  account_id  = var.account_id
  name        = "iedora_pages_redirects"
  kind        = "redirect"
  description = "Bulk Redirects from iedora-com.pages.dev to iedora.com"
}

resource "cloudflare_list_item" "pages_to_apex" {
  account_id = var.account_id
  list_id    = cloudflare_list.pages_to_apex.id

  redirect = {
    source_url            = "${cloudflare_pages_project.iedora_root.subdomain}/"
    target_url            = "https://${var.zone_name}/"
    status_code           = 301
    include_subdomains    = true # also catches *.iedora-com.pages.dev preview URLs
    subpath_matching      = true # /foo also redirects (matches as prefix)
    preserve_path_suffix  = true # /foo → /foo (not /foo → /)
    preserve_query_string = true
  }
}

resource "cloudflare_ruleset" "redirect" {
  account_id = var.account_id
  name       = "house-pages-bulk-redirects"
  kind       = "root"
  phase      = "http_request_redirect"

  rules = [{
    action      = "redirect"
    description = "Redirect iedora-com.pages.dev → iedora.com via Bulk Redirect list"
    enabled     = true
    # `$<list-name>` is Cloudflare's filter-language reference to a list.
    # The format() avoids HCL's `$${...}` escape dance.
    expression = format("http.request.full_uri in $%s", cloudflare_list.pages_to_apex.name)
    action_parameters = {
      from_list = {
        name = cloudflare_list.pages_to_apex.name
        key  = "http.request.full_uri"
      }
    }
  }]
}
