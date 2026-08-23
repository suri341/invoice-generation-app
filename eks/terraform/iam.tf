# ============================================================
# EKS Cluster IAM Role
# ============================================================

data "aws_iam_policy_document" "eks_cluster_assume_role" {
  statement {
    effect = "Allow"

    principals {
      type = "Service"

      identifiers = [
        "eks.amazonaws.com"
      ]
    }

    actions = [
      "sts:AssumeRole"
    ]
  }
}

resource "aws_iam_role" "eks_cluster" {
  name = "tf-role-ekscluster-${var.project_name}-${var.environment}"

  assume_role_policy = data.aws_iam_policy_document.eks_cluster_assume_role.json

  tags = {
    Name = "tf-role-ekscluster-${var.project_name}-${var.environment}"
  }
}

resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  role = aws_iam_role.eks_cluster.name

  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
}

# ============================================================
# EKS Worker Node IAM Role
# ============================================================

data "aws_iam_policy_document" "eks_node_assume_role" {
  statement {
    effect = "Allow"

    principals {
      type = "Service"

      identifiers = [
        "ec2.amazonaws.com"
      ]
    }

    actions = [
      "sts:AssumeRole"
    ]
  }
}

resource "aws_iam_role" "eks_node" {
  name = "tf-role-eksworker-${var.project_name}-${var.environment}"

  assume_role_policy = data.aws_iam_policy_document.eks_node_assume_role.json

  tags = {
    Name = "tf-role-eksworker-${var.project_name}-${var.environment}"
  }
}

resource "aws_iam_role_policy_attachment" "eks_node_worker_policy" {
  role = aws_iam_role.eks_node.name

  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
}

resource "aws_iam_role_policy_attachment" "eks_node_cni_policy" {
  role = aws_iam_role.eks_node.name

  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
}

resource "aws_iam_role_policy_attachment" "eks_node_ecr_readonly" {
  role = aws_iam_role.eks_node.name

  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_iam_role_policy_attachment" "eks_node_ssm" {
  role = aws_iam_role.eks_node.name

  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# ============================================================
# EKS Cluster Security Group
# ============================================================

resource "aws_security_group" "eks_cluster" {
  name        = "tf-sg-eks-cluster-${var.project_name}-${var.environment}"
  description = "EKS control plane security group"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "Allow VPC traffic to EKS control plane"

    from_port = 0
    to_port   = 0
    protocol  = "-1"

    cidr_blocks = [
      var.vpc_cidr
    ]
  }

  egress {
    description = "Allow outbound traffic"

    from_port = 0
    to_port   = 0
    protocol  = "-1"

    cidr_blocks = [
      "0.0.0.0/0"
    ]
  }

  tags = {
    Name = "tf-sg-eks-cluster-${var.project_name}-${var.environment}"

    "kubernetes.io/cluster/${var.cluster_name}" = "owned"
  }
}

# ============================================================
# EKS Worker Node Security Group
# ============================================================

resource "aws_security_group" "eks_nodes" {
  name        = "tf-sg-eks-workers-${var.project_name}-${var.environment}"
  description = "EKS worker node security group"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "Allow all traffic within VPC"

    from_port = 0
    to_port   = 0
    protocol  = "-1"

    cidr_blocks = [
      var.vpc_cidr
    ]
  }

  egress {
    description = "Allow outbound traffic"

    from_port = 0
    to_port   = 0
    protocol  = "-1"

    cidr_blocks = [
      "0.0.0.0/0"
    ]
  }

  tags = {
    Name = "tf-sg-eks-workers-${var.project_name}-${var.environment}"

    "kubernetes.io/cluster/${var.cluster_name}" = "owned"
  }
}