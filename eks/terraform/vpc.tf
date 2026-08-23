resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "tf-vpc-${var.project_name}-${var.environment}"
  }
}

# ============================================================
# Internet Gateway
# ============================================================

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "tf-igw-${var.project_name}-${var.environment}"
  }

  # NAT must release its public EIP before the IGW can detach.
  depends_on = [
    aws_vpc.main
  ]
}

# ============================================================
# Public Subnets
# ============================================================

resource "aws_subnet" "public_a" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_a_cidr
  availability_zone       = local.az_a
  map_public_ip_on_launch = true

  tags = {
    Name = "tf-public-${var.project_name}-${var.environment}-a"

    "kubernetes.io/role/elb" = "1"

    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
  }

  lifecycle {
    create_before_destroy = false
  }
}

resource "aws_subnet" "public_b" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_b_cidr
  availability_zone       = local.az_b
  map_public_ip_on_launch = true

  tags = {
    Name = "tf-public-${var.project_name}-${var.environment}-b"

    "kubernetes.io/role/elb" = "1"

    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
  }
}

# ============================================================
# Private Subnets
# ============================================================

resource "aws_subnet" "private_a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_a_cidr
  availability_zone = local.az_a

  tags = {
    Name = "tf-private-${var.project_name}-${var.environment}-a"

    "kubernetes.io/role/internal-elb" = "1"

    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
  }
}

resource "aws_subnet" "private_b" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_b_cidr
  availability_zone = local.az_b

  tags = {
    Name = "tf-private-${var.project_name}-${var.environment}-b"

    "kubernetes.io/role/internal-elb" = "1"

    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
  }
}

# ============================================================
# Public Route Table
# ============================================================

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "tf-rt-public-${var.project_name}-${var.environment}"
  }
}

resource "aws_route_table_association" "public_a" {
  subnet_id      = aws_subnet.public_a.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_b" {
  subnet_id      = aws_subnet.public_b.id
  route_table_id = aws_route_table.public.id
}

# ============================================================
# Elastic IP for NAT Gateway
# ============================================================

resource "aws_eip" "nat" {
  domain = "vpc"

  tags = {
    Name = "tf-eip-nat-${var.project_name}-${var.environment}"
  }

  depends_on = [
    aws_internet_gateway.main
  ]
}

# ============================================================
# NAT Gateway
# ============================================================

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public_a.id

  tags = {
    Name = "tf-nat-${var.project_name}-${var.environment}"
  }

  depends_on = [
    aws_internet_gateway.main
  ]
}

# ============================================================
# Private Route Table A
# ============================================================

resource "aws_route_table" "private_a" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }

  tags = {
    Name = "tf-rt-private-${var.project_name}-${var.environment}-a"
  }
}

# ============================================================
# Private Route Table B
# ============================================================

resource "aws_route_table" "private_b" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }

  tags = {
    Name = "tf-rt-private-${var.project_name}-${var.environment}-b"
  }
}

resource "aws_route_table_association" "private_a" {
  subnet_id      = aws_subnet.private_a.id
  route_table_id = aws_route_table.private_a.id
}

resource "aws_route_table_association" "private_b" {
  subnet_id      = aws_subnet.private_b.id
  route_table_id = aws_route_table.private_b.id
}