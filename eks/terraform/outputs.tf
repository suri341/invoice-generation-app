output "aws_account_id" {
  description = "AWS account ID"
  value       = data.aws_caller_identity.current.account_id
}

output "aws_region" {
  description = "AWS region"
  value       = data.aws_region.current.region
}

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value = [
    aws_subnet.public_a.id,
    aws_subnet.public_b.id
  ]
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value = [
    aws_subnet.private_a.id,
    aws_subnet.private_b.id
  ]
}

output "nat_gateway_id" {
  description = "NAT Gateway ID"
  value       = aws_nat_gateway.main.id
}

output "eks_cluster_name" {
  description = "EKS cluster name"
  value       = aws_eks_cluster.main.name
}

output "eks_cluster_endpoint" {
  description = "EKS API endpoint"
  value       = aws_eks_cluster.main.endpoint
}

output "eks_cluster_arn" {
  description = "EKS cluster ARN"
  value       = aws_eks_cluster.main.arn
}

output "eks_cluster_oidc_issuer" {
  description = "EKS OIDC issuer"
  value       = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

output "eks_node_group_name" {
  description = "EKS node group name"
  value       = aws_eks_node_group.main.node_group_name
}

output "eks_node_role_arn" {
  description = "EKS node IAM role ARN"
  value       = aws_iam_role.eks_node.arn
}

output "cluster_autoscaler_role_arn" {
  description = "Cluster Autoscaler IAM role ARN"
  value       = var.enable_cluster_autoscaler_iam ? aws_iam_role.cluster_autoscaler[0].arn : null
}

output "admin_principal_arn" {
  description = "IAM principal granted EKS admin access"
  value       = local.admin_principal_arn
}

output "acm_certificate_arn" {
  description = "ACM certificate ARN for the application Ingress"
  value       = var.create_acm_certificate ? aws_acm_certificate.app[0].arn : ""
}

output "acm_domain_name" {
  description = "Domain name the ACM certificate was issued for"
  value       = var.acm_domain_name
}

output "acm_validation_record_name" {
  description = "CNAME record name to create in GoDaddy for ACM DNS validation"
  value       = var.create_acm_certificate ? tolist(aws_acm_certificate.app[0].domain_validation_options)[0].resource_record_name : ""
}

output "acm_validation_record_value" {
  description = "CNAME record value to create in GoDaddy for ACM DNS validation"
  value       = var.create_acm_certificate ? tolist(aws_acm_certificate.app[0].domain_validation_options)[0].resource_record_value : ""
}

output "acm_certificate_domains" {
  description = "Domains covered by the ACM certificate (wildcard + base)"
  value       = var.create_acm_certificate ? "*.${local.base_domain} and ${local.base_domain}" : ""
}

output "base_domain" {
  description = "Base domain extracted from acm_domain_name"
  value       = var.create_acm_certificate ? local.base_domain : ""
}