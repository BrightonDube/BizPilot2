# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BizPilot2 is a multi-platform business management system (invoicing, inventory, POS, laybys, CRM, time tracking) targeting South African SMBs. It is a pnpm monorepo with three main apps:

- **backend/** — FastAPI (Python) REST API
- **frontend/** — Next.js 16 web dashboard
- **mobile/** — Expo SDK 52 React Native app (offline-first)
- **shared/** — TypeScript utilities (pricing config/utils) shared across packages

## Commands

All commands run from the repo root with `pnpm`.

```bash
# Development
pnpm dev                  # Frontend + backend dev servers
pnpm frontend:dev         # Next.js (port 3000)
pnpm backend:dev          # Uvicorn with reload (port 8000)
pnpm mobile:start         # Expo dev server

# Testing
pnpm test                 # All tests
pnpm frontend:test        # Jest (frontend)
pnpm backend:test         # pytest with coverage (>45% required)
pnpm mobile:test          # Jest (mobile)

# Run a single test file (backend)
cd backend && python -m pytest path/to/test_file.py -v

# Run a single test file (frontend/mobile)
cd frontend && npx jest path/to/test.ts
cd mobile && npx jest path/to/test.ts

# Linting & type checking
pnpm lint                 # All packages
pnpm mobile:typecheck     # TypeScript check (mobile only)

# Database
pnpm backend:migrate      # Alembic upgrade head
pnpm backend:check-migrations  # Validate migration files

# Docker (local full-stack)
docker compose -f infrastructure/docker/docker-compose.yml up
```

## Architecture

### Backend (FastAPI)

- **`app/api/`** — 88+ route files organized by domain (auth, products, orders, invoices, customers, laybys, inventory, etc.)
- **`app/models/`** — SQLAlchemy 2.0 async models (~40+ entities). All use `created_at`/`updated_at` UTC timestamps and soft-delete via `deleted_at`.
- **`app/schemas/`** — Pydantic v2 request/response schemas
- **`app/services/`** — Business logic layer (called by routes, not directly by each other)
- **`app/core/`** — DB session, config (Pydantic Settings), security, Redis, RBAC
- **`app/agents/`** — AI agent orchestration (OpenAI/Groq)
- **`app/scheduler/`** — APScheduler background jobs (overdue invoices, laybys, auto clock-out, demo expiry, device cleanup)

**Database**: PostgreSQL (primary) via asyncpg. SQLite used in dev/test. Alembic manages migrations in `alembic/versions/`.

**Auth flow**: Session cookies (HttpOnly) + CSRF tokens for web; JWT tokens stored in Secure Store for mobile. RBAC with per-business feature overrides. Multi-tenant isolation via `X-Business-ID` header.

**Middleware stack** (order matters): RequestID → Timing (logs >500ms) → CSRF → CORS → Session → GZip.

### Frontend (Next.js)

- **`src/app/(dashboard)/`** — All protected routes using Next.js App Router. Route segments map to features (pos, invoices, inventory, customers, laybys, reports, settings, etc.).
- **`src/store/`** — Zustand stores (authStore, cartStore, settingsStore, etc.)
- **`src/lib/api.ts`** — Axios client with interceptors: auto-attaches CSRF tokens, handles 401 session expiry.
- **`src/hooks/`** — Feature-specific data hooks (useInvoices, useProducts, useCustomers, etc.)
- **`src/components/`** — Shared UI using Radix UI primitives + Tailwind CSS

**API base**: `NEXT_PUBLIC_API_URL` → `/api/v1` prefix on all backend calls.

### Mobile (Expo/React Native)

- **`app/(auth)/`** — Login, PIN screens
- **`app/(tabs)/`** — Main tabbed navigation (POS, orders, inventory, customers, settings)
- **`db/`** — WatermelonDB models + sync logic (offline SQLite → server push-pull sync)
- **`stores/`** — Zustand (authStore, cartStore, syncStore)
- **`services/`** — API client (axios), auth service, WatermelonDB sync
- **NativeWind** for styling (Tailwind CSS on React Native)
- **EAS Build** for CI/CD; OTA updates via EAS Update for JS-only changes

Mobile DB tables: products, orders, customers, inventory, invoices, devices, notifications, settings.

### Shared Package

- **`pricing-config.ts`** — Subscription tier definitions (mirrored in Python backend)
- **`pricing-utils.ts`** — Price formatting, tier lookup utilities

## Key Conventions

- **Currency**: ZAR (South Africa). Use `formatCurrency` from shared utils.
- **Payments**: Paystack (primary), SnapScan, Yoco — all gated behind feature flags/env vars.
- **Environment files**: Backend uses `.env` then `.env.local`. Frontend uses `NEXT_PUBLIC_` prefix. Mobile uses `EXPO_PUBLIC_` prefix (build-time embedded).
- **RBAC**: Check `app/core/rbac.py` before adding new protected endpoints.
- **Background jobs**: Add new scheduled tasks in `app/scheduler/` and register them in the scheduler setup.
- **Issue tracking**: This project uses Beads (`.beads/` directory, JSONL format). Run `pnpm beads:sync` to sync issues.
