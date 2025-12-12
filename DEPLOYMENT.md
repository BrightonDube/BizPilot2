# BizPilot v2.0 Deployment Guide

This guide covers deploying BizPilot locally and to cloud services (Render and Azure).

## Table of Contents

- [Local Deployment](#local-deployment)
  - [Docker (Recommended)](#docker-recommended)
  - [Manual Setup](#manual-setup)
- [Cloud Deployment](#cloud-deployment)
  - [Render (Recommended)](#render-recommended)
  - [Azure](#azure)
- [Environment Variables](#environment-variables)
- [Database Migrations](#database-migrations)
- [Troubleshooting](#troubleshooting)

---

## Local Deployment

### Prerequisites

- Docker and Docker Compose (for Docker deployment)
- Python 3.11+ (for manual deployment)
- Node.js 18+ and pnpm (for manual deployment)
- PostgreSQL 16 (for manual deployment)
- Redis 7 (for manual deployment)

### Docker (Recommended)

The easiest way to run BizPilot locally is with Docker Compose:

```bash
# Navigate to the docker directory
cd infrastructure/docker

# Copy environment example and configure
cp .env.example .env

# Generate a secure secret key
echo "SECRET_KEY=$(openssl rand -hex 32)" >> .env

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

**Services available:**
| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | Next.js application |
| Backend API | http://localhost:8000 | FastAPI application |
| API Docs | http://localhost:8000/docs | Swagger UI |
| MailHog | http://localhost:8025 | Email testing UI |
| PostgreSQL | localhost:5432 | Database |
| Redis | localhost:6379 | Cache |

### Manual Setup

#### Backend Setup

```bash
# Navigate to backend
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Linux/Mac:
source venv/bin/activate
# On Windows:
.\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment variables
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
alembic upgrade head

# Start development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend Setup

```bash
# Navigate to frontend
cd frontend

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Start development server
pnpm dev
```

---

## Cloud Deployment

### Render (Recommended)

Render is the recommended platform for deploying BizPilot because:
- ✅ Native Docker support
- ✅ Free tier for PostgreSQL and Redis
- ✅ Auto-deploys from GitHub
- ✅ Simple configuration
- ✅ Built-in SSL certificates

#### Step 1: Create Database Services

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New" → "PostgreSQL"
   - Name: `bizpilot-db`
   - Plan: Free (or paid for production)
   - Click "Create Database"
   - Copy the "Internal Database URL"

3. Click "New" → "Redis"
   - Name: `bizpilot-redis`
   - Plan: Free
   - Click "Create Redis"
   - Copy the "Internal Redis URL"

#### Step 2: Deploy Backend (FastAPI)

**Option A: Docker (Recommended)**

1. Click "New" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - Name: `bizpilot-api`
   - Environment: `Docker`
   - Dockerfile Path: `infrastructure/docker/Dockerfile.api`
   - Docker Context Directory: `backend`
   - Plan: Free (or paid for production)

4. Add Environment Variables:
   ```
   DATABASE_URL=<Internal Database URL from Step 1>
   REDIS_URL=<Internal Redis URL from Step 1>
   SECRET_KEY=<generate with: openssl rand -hex 32>
   ENVIRONMENT=production
   DEBUG=false
   CORS_ORIGINS=["https://your-frontend-url.onrender.com"]
   ```

5. Click "Create Web Service"

**Option B: Python (without Docker)**

1. Click "New" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - Name: `bizpilot-api`
   - Environment: `Python 3`
   - Root Directory: `backend`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: (auto-detected from Procfile, or use: `gunicorn app.main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT`)
   - Plan: Free (or paid for production)

4. Add Environment Variables (same as Docker option above)

5. Click "Create Web Service"

#### Step 3: Deploy Frontend (Next.js)

**Option A: Static Site (Recommended for static export)**

1. Click "New" → "Static Site"
2. Connect your GitHub repository
3. Configure:
   - Name: `bizpilot-web`
   - Build Command: `cd frontend && pnpm install && pnpm build`
   - Publish Directory: `frontend/out`

4. Add Environment Variables:
   ```
   NEXT_PUBLIC_API_URL=https://bizpilot-api.onrender.com/api/v1
   ```

**Option B: Web Service (For server-side rendering)**

1. Click "New" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - Name: `bizpilot-web`
   - Environment: `Docker`
   - Dockerfile Path: `infrastructure/docker/Dockerfile.web`
   - Docker Context Directory: `frontend`

4. Add Environment Variables:
   ```
   NEXT_PUBLIC_API_URL=https://bizpilot-api.onrender.com/api/v1
   NEXTAUTH_URL=https://bizpilot-web.onrender.com
   NEXTAUTH_SECRET=<generate with: openssl rand -hex 32>
   ```

#### Render render.yaml (Optional - Infrastructure as Code)

Create `render.yaml` in your repository root:

```yaml
services:
  - type: web
    name: bizpilot-api
    env: docker
    dockerfilePath: infrastructure/docker/Dockerfile.api
    dockerContext: backend
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: bizpilot-db
          property: connectionString
      - key: REDIS_URL
        fromService:
          type: redis
          name: bizpilot-redis
          property: connectionString
      - key: SECRET_KEY
        generateValue: true
      - key: ENVIRONMENT
        value: production

  - type: web
    name: bizpilot-web
    env: docker
    dockerfilePath: infrastructure/docker/Dockerfile.web
    dockerContext: frontend
    envVars:
      - key: NEXT_PUBLIC_API_URL
        value: https://bizpilot-api.onrender.com/api/v1

databases:
  - name: bizpilot-db
    databaseName: bizpilot
    plan: free

redis:
  - name: bizpilot-redis
    plan: free
```

---

### Azure

Azure provides enterprise-grade deployment options but requires more configuration.

#### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Azure Resource Group                     │
│                                                             │
│  ┌──────────────────┐    ┌──────────────────┐              │
│  │  App Service     │    │  App Service     │              │
│  │  (Backend API)   │────│  (Frontend)      │              │
│  └────────┬─────────┘    └──────────────────┘              │
│           │                                                 │
│  ┌────────┴─────────┐    ┌──────────────────┐              │
│  │ Azure Database   │    │  Azure Cache     │              │
│  │ for PostgreSQL   │    │  for Redis       │              │
│  └──────────────────┘    └──────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

#### Step 1: Create Resource Group

```bash
# Login to Azure
az login

# Create resource group
az group create --name bizpilot-rg --location eastus
```

#### Step 2: Create PostgreSQL Database

```bash
# Create PostgreSQL flexible server
az postgres flexible-server create \
  --resource-group bizpilot-rg \
  --name bizpilot-db \
  --location eastus \
  --admin-user bizpilotadmin \
  --admin-password <secure-password> \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --version 16

# Create database
az postgres flexible-server db create \
  --resource-group bizpilot-rg \
  --server-name bizpilot-db \
  --database-name bizpilot

# Allow Azure services
az postgres flexible-server firewall-rule create \
  --resource-group bizpilot-rg \
  --name bizpilot-db \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

#### Step 3: Create Redis Cache

```bash
az redis create \
  --resource-group bizpilot-rg \
  --name bizpilot-redis \
  --location eastus \
  --sku Basic \
  --vm-size c0
```

#### Step 4: Create App Service for Backend

```bash
# Create App Service plan
az appservice plan create \
  --resource-group bizpilot-rg \
  --name bizpilot-plan \
  --is-linux \
  --sku B1

# Create web app for backend
az webapp create \
  --resource-group bizpilot-rg \
  --plan bizpilot-plan \
  --name bizpilot-api \
  --deployment-container-image-name python:3.11

# Configure environment variables
az webapp config appsettings set \
  --resource-group bizpilot-rg \
  --name bizpilot-api \
  --settings \
    DATABASE_URL="postgresql://bizpilotadmin:<password>@bizpilot-db.postgres.database.azure.com/bizpilot" \
    REDIS_URL="rediss://:<redis-key>@bizpilot-redis.redis.cache.windows.net:6380/0" \
    SECRET_KEY="<your-secret-key>" \
    ENVIRONMENT="production"
```

#### Step 5: Create Static Web App for Frontend

```bash
az staticwebapp create \
  --resource-group bizpilot-rg \
  --name bizpilot-web \
  --source https://github.com/YOUR_USERNAME/BizPilot2 \
  --branch main \
  --app-location "frontend" \
  --output-location "out" \
  --login-with-github
```

---

## Environment Variables

### Backend (Required)

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379/0` |
| `SECRET_KEY` | JWT signing key (32+ chars) | `openssl rand -hex 32` |
| `ENVIRONMENT` | Environment name | `production` |
| `CORS_ORIGINS` | Allowed origins (JSON array) | `["https://app.bizpilot.com"]` |

### Backend (Optional)

| Variable | Description | Default |
|----------|-------------|---------|
| `DEBUG` | Enable debug mode | `false` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT access token lifetime | `30` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | JWT refresh token lifetime | `7` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | - |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | - |
| `SMTP_HOST` | Email SMTP host | - |
| `SMTP_PORT` | Email SMTP port | - |

### Frontend (Required)

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `https://api.bizpilot.com/api/v1` |
| `NEXTAUTH_URL` | Frontend URL | `https://app.bizpilot.com` |
| `NEXTAUTH_SECRET` | NextAuth signing key | `openssl rand -hex 32` |

---

## Database Migrations

After deploying, run database migrations:

```bash
# Using Docker
docker-compose exec api alembic upgrade head

# Manual
cd backend
source venv/bin/activate
alembic upgrade head
```

For production on Render, add a pre-deploy command:
```
alembic upgrade head
```

---

## Troubleshooting

### Common Issues

**1. Database connection failed**
- Check DATABASE_URL format
- Ensure database is accessible from the application
- Check firewall rules

**2. CORS errors**
- Update CORS_ORIGINS to include frontend URL
- Ensure protocol (http/https) matches

**3. Static files not loading**
- Check NEXT_PUBLIC_API_URL is correct
- Verify build completed successfully

**4. Redis connection failed**
- Check REDIS_URL format
- For Azure Redis, use `rediss://` (with SSL)

### Logs

**Render:**
- View logs in Dashboard → Service → Logs

**Azure:**
```bash
az webapp log tail --resource-group bizpilot-rg --name bizpilot-api
```

**Docker:**
```bash
docker-compose logs -f api
docker-compose logs -f web
```

---

## Production Checklist

- [ ] Set `DEBUG=false` and `ENVIRONMENT=production`
- [ ] Generate strong `SECRET_KEY` and `NEXTAUTH_SECRET`
- [ ] Configure proper CORS origins
- [ ] Set up database backups
- [ ] Configure monitoring and alerting
- [ ] Set up SSL certificates (automatic on Render/Azure)
- [ ] Configure rate limiting
- [ ] Set up error tracking (e.g., Sentry)
