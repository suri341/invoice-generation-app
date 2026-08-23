data "aws_iam_policy_document" "cluster_autoscaler_assume_role" {
  count = var.enable_cluster_autoscaler_iam ? 1 : 0

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
        "system:serviceaccount:kube-system:cluster-autoscaler"
      ]
    }
  }
}

resource "aws_iam_role" "cluster_autoscaler" {
  count = var.enable_cluster_autoscaler_iam ? 1 : 0

  name = "tf-role-cluster-autoscaler-${var.project_name}-${var.environment}"

  assume_role_policy = data.aws_iam_policy_document.cluster_autoscaler_assume_role[0].json

  tags = {
    Name = "tf-role-cluster-autoscaler-${var.project_name}-${var.environment}"
  }
}

resource "aws_iam_policy" "cluster_autoscaler" {
  count = var.enable_cluster_autoscaler_iam ? 1 : 0

  name = "tf-policy-cluster-autoscaler-${var.project_name}-${var.environment}"

  policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Action = [
          "autoscaling:DescribeAutoScalingGroups",
          "autoscaling:DescribeAutoScalingInstances",
          "autoscaling:DescribeLaunchConfigurations",
          "autoscaling:DescribeScalingActivities",
          "autoscaling:DescribeTags",
          "autoscaling:SetDesiredCapacity",
          "autoscaling:TerminateInstanceInAutoScalingGroup",
          "autoscaling:UpdateAutoScalingGroup",
          "ec2:DescribeInstanceTypes",
          "ec2:DescribeLaunchTemplateVersions"
        ]

        Resource = "*"
      }
    ]
  })

  tags = {
    Name = "tf-policy-cluster-autoscaler-${var.project_name}-${var.environment}"
  }
}

resource "aws_iam_role_policy_attachment" "cluster_autoscaler" {
  count = var.enable_cluster_autoscaler_iam ? 1 : 0

  role = aws_iam_role.cluster_autoscaler[0].name

  policy_arn = aws_iam_policy.cluster_autoscaler[0].arn
}