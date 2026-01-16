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
# Install frontend deps
pnpm --filter frontend install

# Run DB migrations (backend)
pnpm backend:migrate

# Start backend
pnpm backend:dev

# Start frontend (in another terminal)
pnpm frontend:dev
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

## ⚙️ Configuration

### Overdue Invoice Scheduler

The application includes an automated scheduler that monitors invoice due dates and creates notifications for overdue invoices. The scheduler runs as a background task within the FastAPI application.

#### Environment Variables

Configure the scheduler behavior using these environment variables in your `.env` file:

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `OVERDUE_INVOICE_SCHEDULE_TYPE` | string | `cron` | Schedule type: `"cron"` or `"interval"` |
| `OVERDUE_INVOICE_SCHEDULE_VALUE` | string | `0 0 * * *` | Schedule value (see below) |
| `OVERDUE_INVOICE_BATCH_SIZE` | integer | `100` | Number of invoices to process per batch |
| `OVERDUE_INVOICE_TIMEZONE` | string | `UTC` | Timezone for schedule execution |

#### Schedule Configuration Examples

**Cron-based scheduling** (recommended for production):

```bash
# Daily at midnight UTC
OVERDUE_INVOICE_SCHEDULE_TYPE=cron
OVERDUE_INVOICE_SCHEDULE_VALUE=0 0 * * *

# Every day at 9 AM UTC
OVERDUE_INVOICE_SCHEDULE_TYPE=cron
OVERDUE_INVOICE_SCHEDULE_VALUE=0 9 * * *

# Every Monday at 8 AM UTC
OVERDUE_INVOICE_SCHEDULE_TYPE=cron
OVERDUE_INVOICE_SCHEDULE_VALUE=0 8 * * 1

# Every 6 hours
OVERDUE_INVOICE_SCHEDULE_TYPE=cron
OVERDUE_INVOICE_SCHEDULE_VALUE=0 */6 * * *
```

**Interval-based scheduling** (simpler, good for development):

```bash
# Every 24 hours
OVERDUE_INVOICE_SCHEDULE_TYPE=interval
OVERDUE_INVOICE_SCHEDULE_VALUE=24

# Every 12 hours
OVERDUE_INVOICE_SCHEDULE_TYPE=interval
OVERDUE_INVOICE_SCHEDULE_VALUE=12

# Every hour
OVERDUE_INVOICE_SCHEDULE_TYPE=interval
OVERDUE_INVOICE_SCHEDULE_VALUE=1
```

#### Validation Rules

- **SCHEDULE_TYPE**: Must be either `"cron"` or `"interval"`. Invalid values will log an error and fall back to the default (`cron` with daily execution at midnight UTC).

- **SCHEDULE_VALUE**: 
  - For `cron` type: Must be a valid cron expression (5 fields: minute, hour, day, month, day-of-week). Invalid expressions will log an error and use the default schedule.
  - For `interval` type: Must be a positive integer representing hours. Invalid values will log an error and use the default schedule.

- **BATCH_SIZE**: Must be a positive integer. Recommended range: 50-500. Larger batches improve performance but use more memory. Default is 100.

- **TIMEZONE**: Must be a valid timezone string (e.g., `UTC`, `America/New_York`, `Europe/London`). Invalid timezones will log an error and fall back to UTC.

#### How It Works

1. **Startup**: The scheduler initializes when the FastAPI application starts
2. **Execution**: At the configured schedule, the job:
   - Queries all invoices where `due_date < current_date` and status is not `PAID` or `CANCELLED`
   - Processes invoices in batches (configurable via `BATCH_SIZE`)
   - Checks for existing overdue notifications to avoid duplicates
   - Creates new notifications for invoices without existing notifications
   - Logs execution statistics (invoices found, notifications created, errors)
3. **Error Handling**: Errors processing individual invoices are logged but don't stop the job from processing remaining invoices
4. **Shutdown**: The scheduler shuts down gracefully when the application stops

#### Monitoring

Check scheduler status and execution history via the API:

```bash
# Get scheduler status
curl http://localhost:8000/api/v1/scheduler/status

# View execution history
curl http://localhost:8000/api/v1/scheduler/executions
```

The scheduler logs all executions to the `job_execution_logs` table, including:
- Start and end times
- Number of invoices processed
- Number of notifications created
- Error count and details
