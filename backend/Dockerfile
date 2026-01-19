# BizPilot API Dockerfile (Production)
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for caching
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY backend/ .

# Copy shared directory for pricing config
COPY shared/ ./shared/

# Alembic config (migrations run at startup with a DB lock and/or via DO pre-deploy job)
COPY backend/alembic.ini .
COPY backend/alembic ./alembic

# Also keep a backend/ path for compatibility with scripts/jobs that reference it
RUN mkdir -p ./backend
COPY backend/alembic.ini ./backend/alembic.ini
COPY backend/alembic ./backend/alembic

# Expose port
EXPOSE 8000

# Production startup
CMD ["python", "scripts/entrypoint.py"]
