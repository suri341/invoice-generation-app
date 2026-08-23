aws_region = "ap-south-1"

# CHANGE_ME:
# Get this from:
# aws sts get-caller-identity --query Account --output text
aws_account_id = "175864702507"

project_name = "myapp"
environment  = "uat"
cost_center  = "myapp"

cluster_name       = "vihan-cluster"
kubernetes_version = "1.34"

vpc_cidr = "10.0.0.0/16"

public_subnet_a_cidr = "10.0.1.0/24"
public_subnet_b_cidr = "10.0.2.0/24"

private_subnet_a_cidr = "10.0.11.0/24"
private_subnet_b_cidr = "10.0.12.0/24"

# Keep public + private endpoint initially.
eks_endpoint_public_access  = true
eks_endpoint_private_access = true

# CHANGE_ME:
# Find your public IP with:
# curl https://checkip.amazonaws.com
#
# Example:
# admin_public_ip = "49.205.10.20/32"
#admin_public_ip = "CHANGE_ME/32"

node_instance_type = "t3.small"

node_min_size     = 2
node_desired_size = 2
node_max_size     = 5

node_disk_size = 50

# ACM certificate is created by Terraform and consumed by invoice.sh.
# The base domain is extracted from acm_domain_name (e.g., "vihan.store" from "invoice.vihan.store")
# Certificate will be a wildcard: *.vihan.store (covers invoice.vihan.store, argocd.vihan.store, etc.)
# Never hardcode the ARN in invoice-app/values.yaml.
acm_domain_name        = "invoice.vihan.store"
create_acm_certificate = true

# Leave empty initially.
# Terraform will use the IAM identity running Terraform.
admin_principal_arn = ""

enable_cluster_autoscaler_iam = true