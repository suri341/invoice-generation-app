# ============================================================
# EKS Managed Node Group
# ============================================================

resource "aws_eks_node_group" "main" {
  cluster_name = aws_eks_cluster.main.name

  node_group_name = "tf-nodegroup-${var.project_name}-${var.environment}"

  node_role_arn = aws_iam_role.eks_node.arn

  # IMPORTANT:
  # Workers are ONLY placed in private subnets.
  subnet_ids = [
    aws_subnet.private_a.id,
    aws_subnet.private_b.id
  ]

  instance_types = [
    var.node_instance_type
  ]

  capacity_type = "ON_DEMAND"

  scaling_config {
    min_size     = var.node_min_size
    desired_size = var.node_desired_size
    max_size     = var.node_max_size
  }

  disk_size = var.node_disk_size

  update_config {
    max_unavailable = 1
  }

  labels = {
    workload    = "applications"
    environment = var.environment
  }

  tags = {
    Name = "tf-nodegroup-${var.project_name}-${var.environment}"
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_node_worker_policy,
    aws_iam_role_policy_attachment.eks_node_cni_policy,
    aws_iam_role_policy_attachment.eks_node_ecr_readonly,
    aws_iam_role_policy_attachment.eks_node_ssm,

    # Make sure networking add-ons are ready before workers.
    aws_eks_addon.vpc_cni,
    aws_eks_addon.kube_proxy
  ]
}