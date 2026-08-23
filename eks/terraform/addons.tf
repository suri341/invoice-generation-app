data "aws_eks_addon_version" "vpc_cni" {
  addon_name         = "vpc-cni"
  kubernetes_version = aws_eks_cluster.main.version
  most_recent        = true
}

data "aws_eks_addon_version" "coredns" {
  addon_name         = "coredns"
  kubernetes_version = aws_eks_cluster.main.version
  most_recent        = true
}

data "aws_eks_addon_version" "kube_proxy" {
  addon_name         = "kube-proxy"
  kubernetes_version = aws_eks_cluster.main.version
  most_recent        = true
}

resource "aws_eks_addon" "vpc_cni" {
  cluster_name = aws_eks_cluster.main.name

  addon_name = "vpc-cni"

  addon_version = data.aws_eks_addon_version.vpc_cni.version

  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "OVERWRITE"

  tags = {
    Name = "tf-addon-vpc-cni"
  }
}

resource "aws_eks_addon" "coredns" {
  cluster_name = aws_eks_cluster.main.name

  addon_name = "coredns"

  addon_version = data.aws_eks_addon_version.coredns.version

  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "OVERWRITE"

  tags = {
    Name = "tf-addon-coredns"
  }

  depends_on = [
    aws_eks_addon.vpc_cni,
    aws_eks_addon.kube_proxy,
    aws_eks_node_group.main
  ]
}

resource "aws_eks_addon" "kube_proxy" {
  cluster_name = aws_eks_cluster.main.name

  addon_name = "kube-proxy"

  addon_version = data.aws_eks_addon_version.kube_proxy.version

  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "OVERWRITE"

  tags = {
    Name = "tf-addon-kube-proxy"
  }

  depends_on = [
    aws_eks_addon.vpc_cni
  ]
}