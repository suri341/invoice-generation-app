# Jagannath Invoice Application Architecture

This document describes the end-to-end AWS EKS deployment represented by this repository, including the application runtime path, infrastructure provisioning path, and Argo CD GitOps flow.

## 1. End-to-end runtime architecture

```mermaid
flowchart TB
    user["Invoice user\nBrowser"]
    dns["GoDaddy DNS\ninvoice.vihan.store\nargocd.vihan.store"]
    cert["AWS ACM\nWildcard certificate\n*.vihan.store"]

    subgraph aws["AWS account | ap-south-1"]
        subgraph vpc["VPC 10.0.0.0/16"]
            igw["Internet Gateway"]
            nat["NAT Gateway\npublic subnet A"]

            subgraph public["Public subnets\n10.0.1.0/24 | 10.0.2.0/24"]
                albApp["Application ALB\ninvoice.vihan.store\nHTTP 80 -> HTTPS 443"]
                albArgo["Argo CD ALB\nargocd.vihan.store\nHTTP 80 -> HTTPS 443"]
            end

            subgraph eks["Amazon EKS: vihan-cluster"]
                control["EKS control plane\nKubernetes API, audit and control logs"]
                subgraph private["Private subnets\n10.0.11.0/24 | 10.0.12.0/24"]
                    nodes["Managed node group\n2 desired / 2-5 nodes\nt3.small, 50 GiB root disk"]

                    subgraph appns["Namespace: invoice-app"]
                        ing["Ingress: invoice-app\nAWS Load Balancer Controller"]
                        feSvc["ClusterIP: invoice-frontend\nport 80"]
                        beSvc["ClusterIP: invoice-backend\nport 8000"]
                        fe["Frontend Deployment\nReact + Vite build served by Nginx\n1 replica"]
                        be["Backend Deployment\nFastAPI + SQLAlchemy\n1 replica"]
                        seed["Helm hook Job\napp.seed_data\npost-install / post-upgrade"]
                        secrets["Secret: invoice-secrets\nDATABASE_URL, postgres password, SECRET_KEY"]
                        pgSvc["Headless/service: invoice-postgres\nport 5432"]
                        pg["PostgreSQL 15 StatefulSet\n1 replica"]
                        pvc["PVC: 10 GiB\nStorageClass: gp3\nEBS CSI, encrypted"]
                    end

                    subgraph argons["Namespace: argocd"]
                        argoIngress["Ingress: argocd-server\nbackend protocol HTTPS"]
                        argoServer["argocd-server\nAPI/UI"]
                        argoController["application-controller\nself-heal + prune"]
                        argoRepo["repo-server\nfetches Git + renders Helm"]
                        argoRedis["redis\nArgo CD state/cache"]
                    end

                    subgraph system["Namespace: kube-system"]
                        lbc["AWS Load Balancer Controller\nIRSA service account"]
                        addons["EKS add-ons\nVPC CNI | kube-proxy | CoreDNS"]
                    end
                end
            end
        end
    end

    images["Docker Hub\nvihan341/invoice-frontend:<tag>\nvihan341/invoice-backend:<tag>"]

    user -->|HTTPS| dns
    dns --> albApp
    dns --> albArgo
    cert -. TLS termination .-> albApp
    cert -. TLS termination .-> albArgo
    albApp -->|/api /docs /redoc /openapi.json /health| ing
    albApp -->|/| ing
    ing --> beSvc --> be
    ing --> feSvc --> fe
    be -->|SQL| pgSvc --> pg --> pvc
    be -. reads .-> secrets
    pg -. reads password .-> secrets
    seed -. reads .-> secrets
    seed -->|idempotent seed data| pg
    albArgo --> argoIngress --> argoServer
    argoServer --> argoRedis
    argoController --> argoRepo
    argoController -->|reconciles invoice-app| control
    argoRepo -->|Helm templates| control
    lbc -->|creates and updates both ALBs| albApp
    lbc -->|creates and updates both ALBs| albArgo
    control --> nodes
    nodes --> private
    private -->|outbound image pulls / updates| nat
    nat --> igw
    public --> igw
    images -->|image pulls| nodes
    addons --> nodes

    classDef edge fill:#e8f3ff,stroke:#1769aa,color:#0c3557
    classDef k8s fill:#eef8ee,stroke:#2d7a46,color:#173d25
    classDef data fill:#fff4df,stroke:#a56600,color:#573600
    classDef gitops fill:#f4edff,stroke:#7040a5,color:#3b225b
    class user,dns,cert,images edge
    class albApp,albArgo,igw,nat,control,nodes,lbc,addons edge
    class ing,feSvc,beSvc,fe,be,seed,pgSvc,argoIngress,argoServer,argoController,argoRepo,argoRedis k8s
    class secrets,pg,pvc data
```

### Request routing

| Host and path | ALB target | Kubernetes service | Workload |
| --- | --- | --- | --- |
| `https://invoice.vihan.store/` | Application ALB | `invoice-frontend:80` | Nginx serving the React build |
| `https://invoice.vihan.store/api/*` | Application ALB | `invoice-backend:8000` | FastAPI |
| `https://invoice.vihan.store/docs`, `/redoc`, `/openapi.json`, `/health` | Application ALB | `invoice-backend:8000` | FastAPI |
| `https://argocd.vihan.store/` | Argo CD ALB | `argocd-server:443` | Argo CD server over HTTPS |

The backend is the only application component that connects to PostgreSQL. The frontend calls the backend through the public application host according to its configured API URL and CORS settings.

## 2. Provisioning and deployment flow

```mermaid
sequenceDiagram
    autonumber
    participant Dev as Operator laptop
    participant TF as Terraform
    participant AWS as AWS ap-south-1
    participant DNS as GoDaddy DNS
    participant Docker as Docker Hub
    participant K8s as Kubernetes API
    participant Helm as Helm
    participant Argo as Argo CD
    participant Git as Git repository

    Dev->>TF: ./invoice.sh deploy
    TF->>AWS: Create VPC, subnets, routes, IGW, NAT, IAM
    TF->>AWS: Create EKS control plane, private node group, add-ons
    TF->>AWS: Create ACM wildcard certificate
    AWS-->>Dev: Terraform outputs: VPC ID, certificate ARN, validation CNAME
    Dev->>DNS: Add ACM DNS validation CNAME
    DNS-->>AWS: DNS validation record resolves
    Dev->>AWS: Wait until ACM certificate is ISSUED
    Dev->>K8s: Update kubeconfig and wait for Ready nodes
    Dev->>AWS: Create LBC IAM policy and IRSA service account
    Dev->>Helm: Install AWS Load Balancer Controller in kube-system
    Helm->>K8s: Deploy controller with cluster, region and VPC ID
    Dev->>Docker: Build and push amd64 frontend/backend images
    Dev->>Helm: helm upgrade --install invoice-app
    Helm->>K8s: Render namespace, secrets, services, deployments, ingress, PVC and seed hook
    K8s-->>AWS: LBC provisions application ALB from invoice-app Ingress
    Dev->>DNS: Add invoice CNAME to application ALB hostname
    Dev->>K8s: Verify pods, PVC, ingress and /health

    Dev->>Helm: ./invoice.sh argocd
    Helm->>K8s: Install Argo CD in argocd namespace
    Dev->>K8s: Apply argocd-server Ingress and Argo CD Application
    Argo->>Git: Fetch main branch, path invoice-app
    Argo->>Argo: Render values.yaml and compare desired state
    Argo->>K8s: Sync Helm resources to invoice-app namespace
    Argo-->>K8s: Automated prune and self-heal remain enabled
    K8s-->>AWS: LBC provisions Argo CD ALB
    Dev->>DNS: Add argocd CNAME to Argo CD ALB hostname
```

## 3. Repository-to-runtime map

| Concern | Source of truth | Runtime result |
| --- | --- | --- |
| Infrastructure | `eks/terraform/*.tf` | VPC, routing, EKS, node group, IAM, ACM and add-ons |
| Deployment orchestration | `invoice.sh` | Ordered bootstrap, image build, Helm deployment and verification |
| Application packaging | `invoice-app/Chart.yaml`, `values.yaml`, `templates/` | Kubernetes resources in `invoice-app` |
| Application image | `backend/Dockerfile`, `frontend/Dockerfile` | Docker Hub images pulled by private EKS nodes |
| Application GitOps registration | `argocd/application.yaml` | Argo CD watches `main` at `/invoice-app` |
| Argo CD public access | `argocd/argocd-ingress.yaml` | HTTPS Argo CD ALB at `argocd.vihan.store` |
| Frontend and API behavior | `frontend/src/`, `backend/app/` | Browser UI, invoice API, PDF generation and database access |

## 4. Network and security boundaries

- Public subnets contain the internet-facing application and Argo CD ALBs.
- EKS worker nodes run only in the two private subnets.
- Private subnet default routes use the NAT Gateway for outbound image pulls and updates.
- ACM terminates client TLS at both ALBs. The Argo CD ALB forwards HTTPS to `argocd-server:443`; the invoice ALB forwards HTTP to the application services.
- The AWS Load Balancer Controller uses an IRSA-backed service account and creates ALB resources from Kubernetes Ingress objects.
- PostgreSQL storage uses the AWS EBS CSI driver, encrypted `gp3`, `ReadWriteOnce`, and a 10 GiB PVC.
- Application credentials are currently rendered into the Helm-created `invoice-secrets` Secret from `invoice-app/values.yaml`. For production, move database credentials and the backend secret key to AWS Secrets Manager or an external-secrets workflow.

## 5. Operational notes

- `./invoice.sh deploy` performs the initial infrastructure and Helm deployment.
- `./invoice.sh argocd` installs Argo CD and registers the application. After that, Git changes under `invoice-app/` are reconciled by Argo CD with automated prune and self-heal.
- The Helm seed Job is a post-install/post-upgrade hook and runs `python3 -m app.seed_data` after PostgreSQL is reachable.
- The PostgreSQL StatefulSet has one replica. This is persistent storage, but it is not a highly available database design.
- `reclaimPolicy: Delete` means deleting the PVC can delete the underlying EBS volume.
- `invoice.sh` contains a hard-coded GitHub token comment. Revoke and rotate that token immediately, then remove it from the file and Git history if it was ever committed.
