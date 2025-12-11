# Docker Development Environment

This directory contains Docker configuration for local development.

## Quick Start

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| api     | 8000 | FastAPI backend |
| web     | 3000 | Next.js frontend |
| db      | 5432 | PostgreSQL 16 database |
| redis   | 6379 | Redis 7 cache |
| mailhog | 8025 | Email testing UI |

## Access

- **Frontend**: http://localhost:3000
- **API Docs**: http://localhost:8000/api/docs
- **MailHog**: http://localhost:8025

## Hot Reload

Both frontend and backend support hot-reload:
- Backend: Edit files in `backend/app/` - changes are reflected immediately
- Frontend: Edit files in `frontend/src/` - changes are reflected immediately

## Environment Variables

Create a `.env` file in this directory:

```bash
SECRET_KEY=your-secret-key-here
```

## Database

Connect to PostgreSQL:
```bash
docker exec -it bizpilot-db psql -U postgres -d bizpilot
```

## Troubleshooting

### Reset everything
```bash
docker-compose down -v
docker-compose up -d --build
```

### View service logs
```bash
docker-compose logs -f api
docker-compose logs -f web
```
