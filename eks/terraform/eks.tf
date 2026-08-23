resource "aws_eks_cluster" "main" {
  name     = var.cluster_name
  role_arn = aws_iam_role.eks_cluster.arn

  version = var.kubernetes_version

  access_config {
    authentication_mode = "API"

    bootstrap_cluster_creator_admin_permissions = false
  }

  vpc_config {
    subnet_ids = [
      aws_subnet.private_a.id,
      aws_subnet.private_b.id,
      aws_subnet.public_a.id,
      aws_subnet.public_b.id
    ]

    security_group_ids = [
      aws_security_group.eks_cluster.id
    ]

    endpoint_private_access = var.eks_endpoint_private_access
    endpoint_public_access  = var.eks_endpoint_public_access

  }

  enabled_cluster_log_types = [
    "api",
    "audit",
    "authenticator",
    "controllerManager",
    "scheduler"
  ]

  tags = {
    Name = var.cluster_name
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_cluster_policy
  ]
}


### We need one more Terraform resource for your EKS access

resource "aws_eks_access_entry" "admin" {
  cluster_name = aws_eks_cluster.main.name

  principal_arn = local.admin_principal_arn

  type = "STANDARD"

  depends_on = [
    aws_eks_cluster.main
  ]
}

resource "aws_eks_access_policy_association" "admin" {
  cluster_name = aws_eks_cluster.main.name

  principal_arn = local.admin_principal_arn

  policy_arn = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"

  access_scope {
    type = "cluster"
  }

  depends_on = [
    aws_eks_access_entry.admin
  ]
}