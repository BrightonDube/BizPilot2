# BizPilot API Dockerfile (Production)
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Run database migrations on startup
COPY alembic.ini .
COPY alembic ./alembic

# Expose port
EXPOSE 8000

# Production startup with migrations
CMD alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
