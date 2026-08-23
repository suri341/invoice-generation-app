variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-south-1"
}

variable "aws_account_id" {
  description = "AWS account ID. Used only for validation/reference."
  type        = string
  sensitive   = true
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "myapp"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "uat"
}

variable "cost_center" {
  description = "Cost center tag value"
  type        = string
  default     = "myapp"
}

variable "cluster_name" {
  description = "EKS cluster name"
  type        = string
  default     = "tf-eks-myapp-uat-001"
}

variable "kubernetes_version" {
  description = "Kubernetes version for EKS"
  type        = string
  default     = "1.34"
}

variable "vpc_cidr" {
  description = "VPC CIDR"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_a_cidr" {
  description = "Public subnet A CIDR"
  type        = string
  default     = "10.0.1.0/24"
}

variable "public_subnet_b_cidr" {
  description = "Public subnet B CIDR"
  type        = string
  default     = "10.0.2.0/24"
}

variable "private_subnet_a_cidr" {
  description = "Private subnet A CIDR"
  type        = string
  default     = "10.0.11.0/24"
}

variable "private_subnet_b_cidr" {
  description = "Private subnet B CIDR"
  type        = string
  default     = "10.0.12.0/24"
}

variable "eks_endpoint_public_access" {
  description = "Allow public access to EKS API endpoint"
  type        = bool
  default     = true
}

variable "eks_endpoint_private_access" {
  description = "Allow private access to EKS API endpoint"
  type        = bool
  default     = true
}


variable "node_instance_type" {
  description = "EKS worker node instance type. t3.medium allows 17 pods per node; t3.small only allows 11."
  type        = string
  default     = "t3.small"
}

variable "node_min_size" {
  description = "Minimum worker nodes"
  type        = number
  default     = 2
}

variable "node_desired_size" {
  description = "Desired worker nodes"
  type        = number
  default     = 2
}

variable "node_max_size" {
  description = "Maximum worker nodes"
  type        = number
  default     = 5
}

variable "node_disk_size" {
  description = "Worker node root disk size in GiB"
  type        = number
  default     = 50
}

variable "admin_principal_arn" {
  description = "IAM principal ARN that should have EKS cluster admin access. Leave empty to use the current AWS identity."
  type        = string
  default     = ""
}

variable "enable_cluster_autoscaler_iam" {
  description = "Create IAM role/policy for Cluster Autoscaler"
  type        = bool
  default     = true
}

variable "acm_domain_name" {
  description = "Domain name for the ACM certificate used by the internet-facing ALB"
  type        = string
  default     = "invoice.vihan.store"
}

variable "create_acm_certificate" {
  description = "Create and manage the ACM certificate in Terraform instead of pasting an ARN into values.yaml"
  type        = bool
  default     = true
}