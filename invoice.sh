#!/usr/bin/env bash
#
# Jagannath Invoice App - EKS deployment automation
#
# Usage:
#   ./invoice.sh deploy     Create infrastructure and deploy the app
#   ./invoice.sh argocd     Install ArgoCD and register the app
#   ./invoice.sh status     Show current deployment state
#   ./invoice.sh destroy    Remove everything in dependency-safe order
#
# No values need to be copied by hand. Every ARN, VPC ID and ALB hostname
# is read from Terraform outputs or the live cluster.

set -euo pipefail

# ----------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------

REPO_ROOT="${REPO_ROOT:-$HOME/Documents/jagannath-invoice-generation-app-main}"
TF_DIR="$REPO_ROOT/eks/terraform"
CHART_DIR="$REPO_ROOT/invoice-app"
ARGOCD_DIR="$REPO_ROOT/argocd"

REGION="ap-south-1"
CLUSTER_NAME="vihan-cluster"
APP_NAMESPACE="invoice-app"
DOMAIN="invoice.vihan.store"

DOCKER_USER="vihan341"
IMAGE_TAG="${IMAGE_TAG:-341}"

LBC_CHART_VERSION="1.14.0"
LBC_POLICY_NAME="AWSLoadBalancerControllerIAMPolicy"
LBC_POLICY_URL="https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.14.0/docs/install/iam_policy.json"

ARGOCD_CHART_VERSION="7.7.11"

# ----------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------

log()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m    OK: %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m    !! %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

require_tools() {
  log "Checking required tools"
  for tool in aws terraform kubectl helm eksctl docker; do
    command -v "$tool" >/dev/null 2>&1 || die "$tool is not installed"
  done
  ok "All tools present"
}

require_aws() {
  log "Checking AWS credentials"
  ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text 2>/dev/null)" \
    || die "AWS credentials not found. Run 'aws configure' or 'aws sso login' first."
  export ACCOUNT_ID
  ok "AWS account $ACCOUNT_ID"
}

tf_output() {
  terraform -chdir="$TF_DIR" output -raw "$1" 2>/dev/null || echo ""
}

# ----------------------------------------------------------------
# Step 1 - Infrastructure
# ----------------------------------------------------------------

create_infrastructure() {
  log "Creating EKS infrastructure with Terraform"

  terraform -chdir="$TF_DIR" init -input=false
  terraform -chdir="$TF_DIR" validate
  terraform -chdir="$TF_DIR" plan -input=false -out=tfplan
  terraform -chdir="$TF_DIR" apply -input=false tfplan

  ok "Infrastructure created"
}

configure_kubectl() {
  log "Updating kubeconfig"
  aws eks update-kubeconfig --region "$REGION" --name "$CLUSTER_NAME"

  log "Waiting for nodes to become Ready"
  kubectl wait --for=condition=Ready nodes --all --timeout=600s
  kubectl get nodes
  ok "Cluster reachable"
}

# ----------------------------------------------------------------
# Step 2 - ACM certificate (created by Terraform, validated here)
# ----------------------------------------------------------------

setup_certificate() {
  log "Resolving ACM certificate from Terraform"

  CERT_ARN="$(tf_output acm_certificate_arn)"
  [ -n "$CERT_ARN" ] || die "acm_certificate_arn output is empty. Check create_acm_certificate in terraform.tfvars."
  export CERT_ARN
  ok "Certificate: $CERT_ARN"

  local status
  status="$(aws acm describe-certificate \
    --certificate-arn "$CERT_ARN" \
    --region "$REGION" \
    --query 'Certificate.Status' --output text)"

  if [ "$status" = "ISSUED" ]; then
    ok "Certificate already ISSUED"
    return 0
  fi

  local record_name record_value
  record_name="$(tf_output acm_validation_record_name)"
  record_value="$(tf_output acm_validation_record_value)"

  cat <<EOF

------------------------------------------------------------
ACTION REQUIRED - Add this CNAME record in GoDaddy DNS
------------------------------------------------------------
  Type  : CNAME
  Name  : ${record_name%.$DOMAIN.}
  Value : $record_value
  TTL   : 600

Full record name: $record_name
------------------------------------------------------------

EOF

  read -r -p "Press Enter after the DNS record has been saved..."

  log "Waiting for ACM validation (this can take 5-30 minutes)"
  aws acm wait certificate-validated \
    --certificate-arn "$CERT_ARN" \
    --region "$REGION" \
    || die "Certificate was not validated in time. Verify the CNAME record, then re-run."

  ok "Certificate ISSUED"
}

# ----------------------------------------------------------------
# Step 3 - AWS Load Balancer Controller
# ----------------------------------------------------------------

install_load_balancer_controller() {
  log "Installing AWS Load Balancer Controller"

  local policy_arn="arn:aws:iam::${ACCOUNT_ID}:policy/${LBC_POLICY_NAME}"

  if aws iam get-policy --policy-arn "$policy_arn" >/dev/null 2>&1; then
    ok "IAM policy already exists"
  else
    log "Creating IAM policy"
    curl -sSLo /tmp/lbc_iam_policy.json "$LBC_POLICY_URL"
    aws iam create-policy \
      --policy-name "$LBC_POLICY_NAME" \
      --policy-document file:///tmp/lbc_iam_policy.json \
      --region "$REGION" >/dev/null
    ok "IAM policy created"
  fi

  # A stale CloudFormation stack blocks recreation, so clear it first.
  if ! kubectl -n kube-system get serviceaccount aws-load-balancer-controller >/dev/null 2>&1; then
    local stack
    stack="$(aws cloudformation list-stacks \
      --region "$REGION" \
      --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE UPDATE_ROLLBACK_COMPLETE \
      --query "StackSummaries[?contains(StackName, 'iamserviceaccount-kube-system-aws-load-balancer-controller')].StackName | [0]" \
      --output text 2>/dev/null)"

    if [ -n "$stack" ] && [ "$stack" != "None" ]; then
      warn "Removing orphaned stack $stack"
      aws cloudformation delete-stack --stack-name "$stack" --region "$REGION"
      aws cloudformation wait stack-delete-complete --stack-name "$stack" --region "$REGION"
    fi
  fi

  log "Creating IRSA service account"
  eksctl create iamserviceaccount \
    --cluster "$CLUSTER_NAME" \
    --region "$REGION" \
    --namespace kube-system \
    --name aws-load-balancer-controller \
    --attach-policy-arn "$policy_arn" \
    --override-existing-serviceaccounts \
    --approve

  kubectl -n kube-system get serviceaccount aws-load-balancer-controller \
    -o jsonpath='{.metadata.annotations.eks\.amazonaws\.com/role-arn}' \
    | grep -q "arn:aws:iam" \
    || die "Service account is missing its IAM role annotation"
  ok "Service account ready"

  local vpc_id
  vpc_id="$(tf_output vpc_id)"
  [ -n "$vpc_id" ] || die "vpc_id output is empty"

  helm repo add eks https://aws.github.io/eks-charts >/dev/null 2>&1 || true
  helm repo update eks >/dev/null

  # vpcId is mandatory: without it the controller queries EC2 metadata and crashes.
  helm upgrade --install aws-load-balancer-controller \
    eks/aws-load-balancer-controller \
    --namespace kube-system \
    --set clusterName="$CLUSTER_NAME" \
    --set region="$REGION" \
    --set vpcId="$vpc_id" \
    --set serviceAccount.create=false \
    --set serviceAccount.name=aws-load-balancer-controller \
    --version "$LBC_CHART_VERSION" \
    --wait --timeout 10m

  kubectl -n kube-system rollout status deployment/aws-load-balancer-controller --timeout=300s
  ok "Controller running"
}

# ----------------------------------------------------------------
# Step 4 - Images
# ----------------------------------------------------------------

build_images() {
  log "Building amd64 images"

  docker buildx build --platform linux/amd64 \
    -t "$DOCKER_USER/invoice-backend:$IMAGE_TAG" "$REPO_ROOT/backend" --push

  docker buildx build --platform linux/amd64 \
    -t "$DOCKER_USER/invoice-frontend:$IMAGE_TAG" "$REPO_ROOT/frontend" --push

  ok "Images pushed"
}

# ----------------------------------------------------------------
# Step 5 - Application
# ----------------------------------------------------------------

deploy_application() {
  log "Deploying application with Helm"

  helm lint "$CHART_DIR"

  helm upgrade --install invoice-app "$CHART_DIR" \
    --namespace "$APP_NAMESPACE" \
    --create-namespace \
    -f "$CHART_DIR/values.yaml" \
    --set ingress.certificateArn="$CERT_ARN" \
    --set image.backendTag="$IMAGE_TAG" \
    --set image.frontendTag="$IMAGE_TAG" \
    --wait --timeout 15m

  ok "Application deployed"
}

wait_for_alb() {
  log "Waiting for the ALB hostname"

  local hostname=""
  for _ in $(seq 1 60); do
    hostname="$(kubectl -n "$APP_NAMESPACE" get ingress invoice-app \
      -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || true)"
    [ -n "$hostname" ] && break
    sleep 10
  done

  [ -n "$hostname" ] || die "ALB was not created. Run: kubectl -n $APP_NAMESPACE describe ingress invoice-app"

  ALB_HOSTNAME="$hostname"
  export ALB_HOSTNAME

  cat <<EOF

------------------------------------------------------------
ACTION REQUIRED - Point your domain at the ALB in GoDaddy
------------------------------------------------------------
  Type  : CNAME
  Name  : ${DOMAIN%%.*}
  Value : $ALB_HOSTNAME
  TTL   : 600
------------------------------------------------------------

EOF
}

verify_deployment() {
  log "Verifying application"

  kubectl -n "$APP_NAMESPACE" get pods
  kubectl -n "$APP_NAMESPACE" get pvc
  kubectl -n "$APP_NAMESPACE" get ingress

  log "Checking public endpoints (retries until DNS propagates)"
  for _ in $(seq 1 30); do
    if curl -fsS --max-time 10 "https://$DOMAIN/health" >/dev/null 2>&1; then
      ok "https://$DOMAIN is live"
      return 0
    fi
    sleep 20
  done

  warn "Domain not reachable yet. DNS may still be propagating."
  warn "Test the ALB directly: curl -I http://$ALB_HOSTNAME/"
}

# ----------------------------------------------------------------
# ArgoCD
# ----------------------------------------------------------------

install_argocd() {
  require_tools
  require_aws
  aws eks update-kubeconfig --region "$REGION" --name "$CLUSTER_NAME" >/dev/null

  log "Installing ArgoCD via Helm"
  helm repo add argo https://argoproj.github.io/argo-helm >/dev/null 2>&1 || true
  helm repo update argo >/dev/null

  # dex, notifications and applicationset are unused here and cost 3 pods.
  helm upgrade --install argocd argo/argo-cd \
    --namespace argocd \
    --create-namespace \
    --version "$ARGOCD_CHART_VERSION" \
    --set dex.enabled=false \
    --set notifications.enabled=false \
    --set applicationSet.enabled=false \
    --set server.resources.requests.cpu=50m \
    --set server.resources.requests.memory=128Mi \
    --set server.resources.limits.memory=256Mi \
    --set repoServer.resources.requests.cpu=50m \
    --set repoServer.resources.requests.memory=128Mi \
    --set repoServer.resources.limits.memory=256Mi \
    --set controller.resources.requests.cpu=100m \
    --set controller.resources.requests.memory=256Mi \
    --set controller.resources.limits.memory=512Mi \
    --set redis.resources.requests.cpu=50m \
    --set redis.resources.requests.memory=64Mi \
    --set redis.resources.limits.memory=128Mi \
    --wait --timeout 10m

  ok "ArgoCD installed"

  local password
  password="$(kubectl -n argocd get secret argocd-initial-admin-secret \
    -o jsonpath='{.data.password}' | base64 -d)"

  local repo_url
  repo_url="$(git -C "$REPO_ROOT" remote get-url origin 2>/dev/null || echo "")"

  CERT_ARN="$(tf_output acm_certificate_arn)"

  if [ -n "$repo_url" ]; then
    sed -e "s|REPO_URL_PLACEHOLDER|$repo_url|" \
        -e "s|ACM_CERT_ARN_PLACEHOLDER|$CERT_ARN|" \
        "$ARGOCD_DIR/application.yaml" | kubectl apply -f -
    ok "ArgoCD Application registered"
  else
    warn "No git remote found. Push this repo, then apply argocd/application.yaml manually."
  fi

  log "Setting up ArgoCD Ingress for argocd.vihan.store"
  sed -e "s|ACM_CERT_ARN_PLACEHOLDER|$CERT_ARN|" \
      "$ARGOCD_DIR/argocd-ingress.yaml" | \
      sed "s|# alb.ingress.kubernetes.io/certificate-arn:|alb.ingress.kubernetes.io/certificate-arn:|" | \
      kubectl apply -f -

  log "Waiting for ArgoCD ALB hostname"
  local argocd_hostname=""
  for _ in $(seq 1 60); do
    argocd_hostname="$(kubectl -n argocd get ingress argocd-server \
      -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || true)"
    [ -n "$argocd_hostname" ] && break
    sleep 10
  done

  cat <<EOF

------------------------------------------------------------
ArgoCD is ready
------------------------------------------------------------
  Username : admin
  Password : $password

  Access ArgoCD:
    Public URL : https://argocd.vihan.store
    Local Port : kubectl -n argocd port-forward svc/argocd-server 8080:443
                 Then visit https://localhost:8080

  DNS Configuration Required:
    Add this CNAME record in GoDaddy:
    Type  : CNAME
    Name  : argocd
    Value : $argocd_hostname
    TTL   : 600
------------------------------------------------------------

EOF
}

# ----------------------------------------------------------------
# Status
# ----------------------------------------------------------------

show_status() {
  require_aws
  aws eks update-kubeconfig --region "$REGION" --name "$CLUSTER_NAME" >/dev/null 2>&1 || true

  log "Nodes";       kubectl get nodes 2>/dev/null || warn "Cluster unreachable"
  log "Application"; kubectl -n "$APP_NAMESPACE" get pods,pvc,ingress 2>/dev/null || warn "Not deployed"
  log "Controller";  kubectl -n kube-system get pods -l app.kubernetes.io/name=aws-load-balancer-controller 2>/dev/null || true
  log "ArgoCD";      kubectl -n argocd get pods 2>/dev/null || warn "ArgoCD not installed"
  log "Helm";        helm list -A 2>/dev/null || true
}

# ----------------------------------------------------------------
# Destroy - order matters, see comments
# ----------------------------------------------------------------

destroy_all() {
  require_aws
  aws eks update-kubeconfig --region "$REGION" --name "$CLUSTER_NAME" >/dev/null 2>&1 || true

  warn "This deletes the cluster, the application and all its data."
  read -r -p "Type 'destroy' to continue: " confirm
  [ "$confirm" = "destroy" ] || die "Aborted"

  local vpc_id
  vpc_id="$(tf_output vpc_id)"

  # 1. ArgoCD first, otherwise self-heal recreates what we delete.
  log "Removing ArgoCD application"
  kubectl -n argocd delete application invoice-app --ignore-not-found --timeout=120s 2>/dev/null || true
  kubectl -n argocd delete ingress argocd-server --ignore-not-found --timeout=300s 2>/dev/null || true

  # 2. Ingress next so the controller deletes the ALB while it is still running.
  log "Removing application and its ALB"
  kubectl -n "$APP_NAMESPACE" delete ingress invoice-app --ignore-not-found --timeout=300s 2>/dev/null || true
  helm uninstall invoice-app -n "$APP_NAMESPACE" 2>/dev/null || true
  kubectl delete namespace "$APP_NAMESPACE" --ignore-not-found --timeout=300s 2>/dev/null || true

  # 3. Wait for AWS to release the ALB's network interfaces.
  if [ -n "$vpc_id" ]; then
    log "Waiting for load balancers to disappear"
    for _ in $(seq 1 30); do
      local count
      count="$(aws elbv2 describe-load-balancers --region "$REGION" \
        --query "length(LoadBalancers[?VpcId=='$vpc_id'])" --output text 2>/dev/null || echo 0)"
      [ "$count" = "0" ] && break
      sleep 10
    done
    ok "Load balancers released"
  fi

  # 4. Only now remove the controller.
  log "Removing AWS Load Balancer Controller"
  helm uninstall aws-load-balancer-controller -n kube-system 2>/dev/null || true
  kubectl delete crd \
    ingressclassparams.elbv2.k8s.aws \
    targetgroupbindings.elbv2.k8s.aws \
    --ignore-not-found 2>/dev/null || true

  log "Removing IRSA service account"
  eksctl delete iamserviceaccount \
    --cluster "$CLUSTER_NAME" \
    --region "$REGION" \
    --namespace kube-system \
    --name aws-load-balancer-controller 2>/dev/null || true

  log "Removing ArgoCD"
  helm uninstall argocd -n argocd 2>/dev/null || true
  kubectl delete namespace argocd --ignore-not-found --timeout=300s 2>/dev/null || true

  # 5. Clear leftovers Terraform does not own, which block subnet/VPC deletion.
  if [ -n "$vpc_id" ]; then
    log "Clearing leftover ENIs"
    for eni in $(aws ec2 describe-network-interfaces --region "$REGION" \
      --filters "Name=vpc-id,Values=$vpc_id" "Name=status,Values=available" \
      --query 'NetworkInterfaces[].NetworkInterfaceId' --output text 2>/dev/null); do
      aws ec2 delete-network-interface --region "$REGION" --network-interface-id "$eni" 2>/dev/null || true
    done

    log "Clearing VPC endpoints"
    for ep in $(aws ec2 describe-vpc-endpoints --region "$REGION" \
      --filters "Name=vpc-id,Values=$vpc_id" \
      --query 'VpcEndpoints[].VpcEndpointId' --output text 2>/dev/null); do
      aws ec2 delete-vpc-endpoints --region "$REGION" --vpc-endpoint-ids "$ep" 2>/dev/null || true
    done
  fi

  # 6. Finally Terraform.
  log "Destroying infrastructure"
  terraform -chdir="$TF_DIR" plan -destroy -input=false -out=destroy.tfplan
  terraform -chdir="$TF_DIR" apply -input=false destroy.tfplan || {
    warn "First destroy attempt failed, usually AWS eventual consistency."
    warn "Retrying in 60 seconds..."
    sleep 60
    terraform -chdir="$TF_DIR" plan -destroy -input=false -out=destroy.tfplan
    terraform -chdir="$TF_DIR" apply -input=false destroy.tfplan
  }

  ok "Everything destroyed"
}

# ----------------------------------------------------------------
# Entry point
# ----------------------------------------------------------------

deploy_all() {
  require_tools
  require_aws
  create_infrastructure
  configure_kubectl
  setup_certificate
  install_load_balancer_controller
  build_images
  deploy_application
  wait_for_alb
  verify_deployment

  cat <<EOF

------------------------------------------------------------
Deployment complete
------------------------------------------------------------
  Application : https://$DOMAIN
  API docs    : https://$DOMAIN/docs
  ALB         : $ALB_HOSTNAME

  Optional GitOps:
    ./invoice.sh argocd
------------------------------------------------------------

EOF
}

case "${1:-deploy}" in
  deploy)  deploy_all ;;
  argocd)  install_argocd ;;
  status)  show_status ;;
  destroy) destroy_all ;;
  *)       die "Usage: $0 {deploy|argocd|status|destroy}" ;;
esac
