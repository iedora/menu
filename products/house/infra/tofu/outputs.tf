output "root_hostname" {
  description = "FQDN of the iedora.com root brand site (the Cloudflare zone apex)."
  value       = var.zone_name
}

output "root_pages_project_name" {
  description = "Cloudflare Pages project name. Consumed by `just deploy-iedora` via `tofu output -raw root_pages_project_name`."
  value       = cloudflare_pages_project.iedora_root.name
}

output "root_pages_subdomain" {
  description = "Default *.pages.dev URL for the Pages project. Useful for verifying a deploy before DNS propagates."
  value       = cloudflare_pages_project.iedora_root.subdomain
}

output "pages_deploy_token" {
  description = "Narrow Cloudflare API token for `wrangler pages deploy` — Pages Write only. Consumed by `just deploy-iedora`; never written to disk."
  value       = cloudflare_api_token.pages_deploy.value
  sensitive   = true
}
