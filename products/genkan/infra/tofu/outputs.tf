output "public_hostname" {
  description = "FQDN routed to kamal-proxy."
  value       = var.public_hostname
}

output "tunnel_id" {
  description = "Cloudflare Tunnel UUID."
  value       = cloudflare_zero_trust_tunnel_cloudflared.genkan.id
}

output "tunnel_token" {
  description = "Connector token for the cloudflared accessory. Read by .kamal/secrets via `tofu output -raw tunnel_token`."
  value       = data.cloudflare_zero_trust_tunnel_cloudflared_token.genkan.token
  sensitive   = true
}
