data "aws_caller_identity" "current" {}

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_region" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id

  admin_principal_arn = var.admin_principal_arn != "" ? var.admin_principal_arn : data.aws_caller_identity.current.arn

  az_a = data.aws_availability_zones.available.names[0]
  az_b = data.aws_availability_zones.available.names[1]
}