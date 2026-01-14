# BizPilot v2.0 Infrastructure

This directory contains infrastructure configuration files for deploying BizPilot.

## Contents

- `docker/` - Docker configuration files (local development, Docker Compose)
- `aws/` - AWS deployment templates (App Runner, ECS)
- `k8s/` - Kubernetes manifests (future)
- `terraform/` - Terraform configurations (future)

## Deployment Options

BizPilot is fully portable and can be deployed to:

| Platform | Configuration | Notes |
|----------|---------------|-------|
| **DigitalOcean App Platform** | `/.do/app.yaml` | Recommended for small-medium businesses |
| **Render** | `/render.yaml` | Free tier available |
| **AWS** | `/infrastructure/aws/` | App Runner or ECS Fargate |
| **Google Cloud** | Run + Cloud SQL | Use Docker images |
| **Azure** | See DEPLOYMENT.md | App Service + PostgreSQL |

## Quick Start

### Local Development
```bash
cd docker
cp .env.example .env
docker-compose up -d
```

### Cloud Deployment
See the respective platform documentation:
- DigitalOcean: `/.do/app.yaml`
- Render: `/render.yaml`
- AWS: `/infrastructure/aws/README.md`
- Azure: `/DEPLOYMENT.md#azure`

## Environment Variables

All platforms use the same environment variables. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SECRET_KEY` | Yes | JWT signing key |
| `ENVIRONMENT` | Yes | `production` or `development` |
| `PAYSTACK_SECRET_KEY` | For payments | Paystack API key |
| `EMAILS_ENABLED` | For emails | Set to `true` to enable |

See `backend/.env.example` for the complete list.
