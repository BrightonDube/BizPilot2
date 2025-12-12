# BizPilot2
BizPilot v2.0 - Modern Multi-Business Management Platform

A full-stack business management application built with FastAPI (Python) and Next.js 14.

## 🚀 Quick Start

### Local Development with Docker (Recommended)

```bash
cd infrastructure/docker
cp .env.example .env
echo "SECRET_KEY=$(openssl rand -hex 32)" >> .env
docker-compose up -d
```

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **MailHog**: http://localhost:8025

### Manual Setup

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
pnpm install && pnpm dev
```

## 📦 Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for comprehensive deployment instructions including:
- Local Docker deployment
- Render deployment (recommended for free tier)
- Azure deployment

### One-Click Deploy to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/BrightonDube/BizPilot2)

## 📋 Issue Tracking

This project uses [Beads](https://github.com/steveyegge/beads) for AI-native issue tracking. Issues are stored in `.beads/issues.jsonl` and synced via git.

### Quick Start

```bash
# Install Beads
curl -sSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash

# Or with Go installed:
go install github.com/steveyegge/beads@latest

# Import existing issues
bd import -i .beads/issues.jsonl

# List issues
bd list

# Create a new issue
bd create "Issue title"

# Sync with remote
bd sync
```

For AI agents: See [AGENTS.md](./AGENTS.md) for guidelines and session-ending protocol.
