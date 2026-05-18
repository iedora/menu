# Shared infra — R2 backup bucket + its scoped S3-compatible token.
#
# Scope: ONE bucket + ONE narrow token. The Postgres accessory itself
# lives in Kamal (no Cloudflare resource needed). The token's permission
# scope is the single backup bucket — a leak can't reach the assets
# bucket or any other R2 on the account.

# Permission group UUID for "Workers R2 Storage Bucket Item Write". Global
# (not per-account), stable. Found via:
#   curl -H "Authorization: Bearer $TOKEN" \
#     https://api.cloudflare.com/client/v4/user/tokens/permission_groups |
#     jq '.result[] | select(.name=="Workers R2 Storage Bucket Item Write")'
locals {
  permission_group_r2_bucket_item_write = "2efd5506f9c8494dacb1fa10a3e7d5b6"
}

resource "cloudflare_r2_bucket" "backups" {
  account_id = var.account_id
  name       = var.backups_bucket_name
  location   = var.backups_bucket_location
}

resource "cloudflare_api_token" "backups_r2" {
  name = "iedora-backups-r2"

  policies = [{
    effect = "allow"
    permission_groups = [
      { id = local.permission_group_r2_bucket_item_write }
    ]
    # Scoped to this single bucket — URN pattern matches what the
    # Cloudflare dashboard emits when you scope a token via the UI:
    #   com.cloudflare.edge.r2.bucket.<account>_default_<bucket-name>
    resources = jsonencode({
      "com.cloudflare.edge.r2.bucket.${var.account_id}_default_${cloudflare_r2_bucket.backups.name}" = "*"
    })
  }]
}
