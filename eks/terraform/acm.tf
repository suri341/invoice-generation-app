locals {
  # Extract base domain from acm_domain_name (e.g., "invoice.vihan.store" -> "vihan.store")
  domain_parts = split(".", var.acm_domain_name)
  base_domain  = join(".", slice(local.domain_parts, length(local.domain_parts) - 2, length(local.domain_parts)))
}

resource "aws_acm_certificate" "app" {
  count = var.create_acm_certificate ? 1 : 0

  # Use wildcard to cover all subdomains (invoice.vihan.store, argocd.vihan.store, etc.)
  domain_name = "*.${local.base_domain}"

  # Also include the base domain itself
  subject_alternative_names = [
    local.base_domain
  ]

  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "tf-acm-${var.project_name}-${var.environment}"
  }
}
