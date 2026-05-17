output "workers_deploy_token" {
  description = <<-EOT
    Narrow Cloudflare API token for `wrangler deploy` — Workers Scripts +
    DNS only. Consumed by `just house::deploy`; never written to disk
    (the deploy recipe pipes it straight into wrangler's env).
  EOT
  value     = cloudflare_api_token.workers_deploy.value
  sensitive = true
}

output "worker_name" {
  description = "Worker name. Mirrors var.worker_name; exposed for the dashboard / debug commands."
  value       = var.worker_name
}
