data "aws_iam_policy_document" "ebs_csi_assume_role" {
  statement {
    effect = "Allow"

    principals {
      type = "Federated"

      identifiers = [
        aws_iam_openid_connect_provider.eks.arn
      ]
    }

    actions = [
      "sts:AssumeRoleWithWebIdentity"
    ]

    condition {
      test = "StringEquals"

      variable = "${replace(
        aws_iam_openid_connect_provider.eks.url,
        "https://",
        ""
      )}:aud"

      values = [
        "sts.amazonaws.com"
      ]
    }

    condition {
      test = "StringEquals"

      variable = "${replace(
        aws_iam_openid_connect_provider.eks.url,
        "https://",
        ""
      )}:sub"

      values = [
        "system:serviceaccount:kube-system:ebs-csi-controller-sa"
      ]
    }
  }
}

resource "aws_iam_role" "ebs_csi" {
  name = "tf-role-ebs-csi-${var.project_name}-${var.environment}"

  assume_role_policy = data.aws_iam_policy_document.ebs_csi_assume_role.json

  tags = {
    Name = "tf-role-ebs-csi-${var.project_name}-${var.environment}"
  }
}

resource "aws_iam_role_policy_attachment" "ebs_csi" {
  role = aws_iam_role.ebs_csi.name

  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy"
}

resource "aws_eks_addon" "ebs_csi" {
  cluster_name = aws_eks_cluster.main.name

  addon_name = "aws-ebs-csi-driver"

  service_account_role_arn = aws_iam_role.ebs_csi.arn

  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "OVERWRITE"

  tags = {
    Name = "tf-addon-ebs-csi"
  }

  depends_on = [
    aws_iam_role_policy_attachment.ebs_csi,
    aws_eks_addon.vpc_cni,
    aws_eks_addon.kube_proxy,
    aws_eks_node_group.main
  ]
}