# Terraform configuration for Cloudflare CDN setup
# Manages Cloudflare DNS, caching, and page rules for Healthcare Management Application

resource "cloudflare_zone" "healthcare_zone" {
  zone = var.domain_name
}

# DNS Records
resource "cloudflare_record" "www" {
  zone_id = cloudflare_zone.healthcare_zone.id
  name    = "www"
  value   = aws_lb.app_lb.dns_name
  type    = "CNAME"
  ttl     = 1
  proxied = true
}

resource "cloudflare_record" "apex" {
  zone_id = cloudflare_zone.healthcare_zone.id
  name    = var.domain_name
  value   = aws_lb.app_lb.dns_name
  type    = "CNAME"
  ttl     = 1
  proxied = true
}

resource "cloudflare_record" "api" {
  zone_id = cloudflare_zone.healthcare_zone.id
  name    = "api"
  value   = aws_lb.app_lb.dns_name
  type    = "CNAME"
  ttl     = 1
  proxied = true
}

resource "cloudflare_record" "cdn" {
  zone_id = cloudflare_zone.healthcare_zone.id
  name    = "cdn"
  value   = aws_lb.app_lb.dns_name
  type    = "CNAME"
  ttl     = 1
  proxied = true
}

# Cache Rules
resource "cloudflare_cache_rule" "static_assets" {
  zone_id    = cloudflare_zone.healthcare_zone.id
  name       = "static-assets"
  expression = "(http.request.uri.path matches \"^/assets/.*\\.(js|css|jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|otf)$\")"
  
  action {
    cache              = true
    edge_ttl           = 2592000  # 30 days
    browser_ttl        = 86400    # 1 day
    cache_key_fields {
      header {
        include = ["accept", "accept-encoding"]
      }
      host {
        resolved = true
      }
      query_string {
        ignore = false
      }
    }
    cache_deception_armor = true
    serve_stale {
      disable_stale_while_updating = false
    }
  }
}

resource "cloudflare_cache_rule" "api_calls" {
  zone_id    = cloudflare_zone.healthcare_zone.id
  name       = "api-paths"
  expression = "(http.request.uri.path matches \"^/api/.*$\")"
  
  action {
    cache              = false
    cache_deception_armor = true
  }
}

# Page Rules for caching and optimization
resource "cloudflare_page_rule" "cache_assets" {
  zone_id  = cloudflare_zone.healthcare_zone.id
  target   = "cdn.${var.domain_name}/assets/*"
  priority = 1

  actions {
    cache_level = "cache_everything"
    edge_cache_ttl = 2592000  # 30 days
    browser_cache_ttl = 86400 # 1 day
    cache_by_device_type = true
    cache_deception_armor = true
    mirage = true
    polish = "lossless"
    minify {
      html = true
      css  = true
      js   = true
    }
  }
}

resource "cloudflare_page_rule" "cache_images" {
  zone_id  = cloudflare_zone.healthcare_zone.id
  target   = "cdn.${var.domain_name}/assets/*.jpg*"
  priority = 2

  actions {
    cache_level = "cache_everything"
    edge_cache_ttl = 2592000  # 30 days
    browser_cache_ttl = 604800 # 7 days
    cache_by_device_type = true
    polish = "lossless"
  }
}

resource "cloudflare_page_rule" "no_cache_api" {
  zone_id  = cloudflare_zone.healthcare_zone.id
  target   = "api.${var.domain_name}/api/*"
  priority = 3

  actions {
    cache_level = "bypass"
    security_level = "high"
  }
}

# Zone settings for performance and security
resource "cloudflare_zone_settings_override" "healthcare_settings" {
  zone_id = cloudflare_zone.healthcare_zone.id
  
  settings {
    always_use_https = "on"
    automatic_https_rewrites = "on"
    browser_check = "on"
    http3 = "on"
    min_tls_version = "1.2"
    opportunistic_encryption = "on"
    security_level = "medium"
    ssl = "strict"
    tls_1_3 = "on"
    universal_ssl = "on"
    websockets = "on"
    zero_rtt = "on"
    rocket_loader = "off" # We'll handle this ourselves
    email_obfuscation = "on"
    server_side_exclude = "on"
    hotlink_protection = "on"
    brotli = "on"
    minify {
      css = "on"
      js = "on"
      html = "on"
    }
    cache_level = "aggressive"
    browser_cache_ttl = 14400 # 4 hours
  }
}

# Image Resizing Configuration
resource "cloudflare_image_resizing" "healthcare_image_resizing" {
  zone_id = cloudflare_zone.healthcare_zone.id
  enabled = true
}

# Access Rules and Security
resource "cloudflare_firewall_rule" "block_suspicious_ips" {
  zone_id     = cloudflare_zone.healthcare_zone.id
  description = "Block suspicious IP addresses"
  filter_id   = cloudflare_filter.suspicious_ips.id
  action      = "block"
}

resource "cloudflare_filter" "suspicious_ips" {
  zone_id     = cloudflare_zone.healthcare_zone.id
  description = "Filter for suspicious IP addresses"
  expression  = "(ip.geoip.asnum in {7643 4808 4134 37963})"
}

resource "cloudflare_rate_limit" "login_protection" {
  zone_id = cloudflare_zone.healthcare_zone.id
  threshold = 5
  period = 60
  match {
    request {
      url_pattern = "api.${var.domain_name}/api/auth/login"
      schemes = ["HTTP", "HTTPS"]
      methods = ["POST"]
    }
  }
  action {
    response {
      content_type = "application/json"
      body = "{\"error\": \"Rate limit exceeded. Please try again later.\"}"
    }
  }
}

# Worker for CDN optimization
resource "cloudflare_worker_script" "cdn_optimization" {
  name    = "cdn-optimization-worker"
  content = file("${path.module}/workers/cdn-optimization.js")
}

resource "cloudflare_worker_route" "cdn_route" {
  zone_id = cloudflare_zone.healthcare_zone.id
  pattern = "cdn.${var.domain_name}/*"
  script_name = cloudflare_worker_script.cdn_optimization.name
}

# Outputs
output "cloudflare_zone_id" {
  value = cloudflare_zone.healthcare_zone.id
  description = "Cloudflare Zone ID"
}

output "cdn_domain" {
  value = "cdn.${var.domain_name}"
  description = "CDN Domain"
}