# GitHub Copilot Instructions for BizPilot2

This document provides context and guidelines for GitHub Copilot when working with the BizPilot2 codebase.

## Project Overview

BizPilot2 is a modern multi-business management platform built with:
- **Backend**: FastAPI (Python) with PostgreSQL
- **Frontend**: Next.js 14 (App Router) with TypeScript and Tailwind CSS v4
- **Architecture**: Full-stack monorepo with separate backend/frontend directories

## Technology Stack

### Backend
- **Framework**: FastAPI 0.124+
- **ORM**: SQLAlchemy 2.0+ with async support
- **Database**: PostgreSQL with Alembic migrations
- **Authentication**: JWT tokens with OAuth2 (Google integration)
- **Authorization**: Role-based access control (RBAC) with granular permissions
- **Testing**: pytest with fixtures
- **Deployment**: Docker (multi-stage builds), Gunicorn + Uvicorn workers

### Frontend
- **Framework**: Next.js 14.2+ (App Router, React Server Components)
- **Language**: TypeScript 5+
- **Styling**: Tailwind CSS v4 (uses `@import "tailwindcss"` not `@tailwind` directives)
- **UI Components**: Radix UI primitives with custom styling
- **State Management**: Zustand for global state
- **HTTP Client**: Axios with interceptors for auth
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Package Manager**: pnpm with workspace configuration

## Project Structure

```
BizPilot2/
├── .beads/                    # Issue tracking database (Beads)
├── .github/                   # GitHub configuration
│   ├── WORKFLOW_SCRIPT.md    # Standard development workflow
│   └── copilot-instructions.md
├── backend/
│   ├── app/
│   │   ├── api/              # API route handlers
│   │   ├── core/             # Core utilities (auth, RBAC, database)
│   │   ├── models/           # SQLAlchemy models
│   │   ├── schemas/          # Pydantic schemas (request/response)
│   │   ├── services/         # Business logic layer
│   │   └── tests/            # pytest test suite
│   ├── alembic/              # Database migrations
│   └── requirements.txt      # Python dependencies
├── frontend/
│   └── src/
│       ├── app/              # Next.js App Router pages
│       ├── components/       # React components
│       │   ├── ui/           # Reusable UI components
│       │   ├── common/       # Common components (Logo, etc.)
│       │   └── layout/       # Layout components
│       └── lib/              # Utilities and API client
└── infrastructure/
    └── docker/               # Docker configurations
```

## Code Conventions

### Backend (FastAPI)

#### Models (SQLAlchemy)
- All models inherit from `BaseModel` (includes `id`, `created_at`, `updated_at`)
- Use UUID primary keys: `Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)`
- Foreign keys use UUID type: `Column(UUID(as_uuid=True), ForeignKey("table.id"))`
- Add indexes on frequently queried columns: `index=True`
- Use Enums for status fields (inherit from `str, enum.Enum`)
- Use `Numeric(12, 2)` for currency fields
- Add docstrings to models and fields

Example:
```python
from app.models.base import BaseModel
from sqlalchemy import Column, String, Numeric, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

class Product(BaseModel):
    """Product model for inventory management."""
    
    __tablename__ = "products"
    
    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    selling_price = Column(Numeric(12, 2), nullable=False)
```

#### Schemas (Pydantic)
- Create separate schemas: `*Create`, `*Update`, `*Response`, `*ListResponse`
- Use `ConfigDict(from_attributes=True)` for response schemas
- Response schemas include all fields from the model
- Use `Optional[Type] = None` for optional fields in Update schemas
- ListResponse includes: `items`, `total`, `page`, `per_page`, `pages`

Example:
```python
from pydantic import BaseModel, ConfigDict
from decimal import Decimal
from uuid import UUID
from datetime import datetime

class ProductCreate(BaseModel):
    name: str
    selling_price: Decimal

class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    name: str
    selling_price: Decimal
    created_at: datetime
```

#### API Endpoints
- Use APIRouter with prefix and tags: `APIRouter(prefix="/products", tags=["Products"])`
- Inject dependencies: `get_db`, `get_current_active_user`, `get_current_business_id`
- Use service layer pattern (don't put business logic in endpoints)
- Add pagination with `Query` parameters: `page`, `per_page`
- Add search and filtering with `Optional` query params
- Use `response_model` for type safety
- Add docstrings describing the endpoint

Example:
```python
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_business_id

router = APIRouter(prefix="/products", tags=["Products"])

@router.get("", response_model=ProductListResponse)
async def list_products(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """List products with filtering and pagination."""
    service = ProductService(db)
    products, total = service.get_products(...)
    return ProductListResponse(items=products, total=total, ...)
```

#### Services
- Service classes take `db: Session` in constructor
- Implement business logic and database queries
- Return tuples for list operations: `(items, total_count)`
- Handle exceptions and raise appropriate HTTPException
- Use `db.query()` for SQLAlchemy queries

#### Testing
- Use pytest with fixtures (see `conftest.py`)
- Test models, schemas, API endpoints, and services
- Group tests by class: `TestProductModel`, `TestProductAPI`
- Write meaningful tests (not just "model exists")
- Test CRUD operations, edge cases, and error handling
- Use descriptive test names: `test_create_product_success`, `test_create_product_validation_error`

### Frontend (Next.js + TypeScript)

#### Pages (App Router)
- Use `'use client'` directive for client components
- Define interfaces for data types at the top of the file
- Use hooks: `useState`, `useEffect` for data fetching
- Show loading states with spinners (`<Loader2 className="animate-spin" />`)
- Handle errors gracefully with error messages
- Use `apiClient` from `@/lib/api` for API calls
- Format currency with South African locale (ZAR)

Example:
```typescript
'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';

interface Product {
  id: string;
  name: string;
  selling_price: number;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const { data } = await apiClient.get<ProductListResponse>('/products');
        setProducts(data.items || []);
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchProducts();
  }, []);

  if (isLoading) return <Loader2 className="animate-spin" />;
  
  return <div>{/* render products */}</div>;
}
```

#### Components
- Place reusable UI components in `components/ui/`
- Use TypeScript interfaces for props
- Export components as default or named exports
- Use Tailwind CSS for styling (no CSS modules)
- Use Radix UI primitives for complex components
- Import UI components from `@/components/ui`
- Use Lucide React for icons

#### Styling
- Tailwind CSS v4 configuration in `postcss.config.mjs`
- Use `@import "tailwindcss"` in `globals.css` (not `@tailwind` directives)
- Utility-first approach with Tailwind classes
- Use `clsx` or `cn` helper for conditional classes
- Dark theme support with gradient backgrounds

#### API Client
- `apiClient` automatically adds JWT token from localStorage
- Handles token refresh on 401 responses
- Base URL: `process.env.NEXT_PUBLIC_API_URL` or `http://localhost:8000/api/v1`
- Use TypeScript generics for type-safe responses: `apiClient.get<Type>(...)`

### Database

#### Migrations
- Use Alembic for database migrations
- Migrations run automatically on backend container startup: `alembic upgrade head`
- In production, migrations should be guarded to avoid concurrent runs (e.g. Postgres advisory lock) and may also run via a pre-deploy job
- Create migrations: `alembic revision --autogenerate -m "description"`
- Test migrations in both directions (upgrade/downgrade)

### Docker

#### Development
- Use `docker-compose.yml` for local development
- Override Dockerfile CMD with `uvicorn --reload` for hot reloading
- Separate containers for: backend, frontend, postgres, mailhog

#### Production
- Multi-stage Docker builds for smaller images
- Separate builder and runner stages
- Use gunicorn with uvicorn workers for FastAPI
- Frontend uses standalone Next.js build

## Development Workflow

### Before Starting Work

1. **Read the workflow script**: `.github/WORKFLOW_SCRIPT.md`
2. **Sync issues (on dev)**: `pnpm beads:sync`
3. **Pick an issue**: `bd list` and `bd show <issue-id>`
4. **Mark as in progress**: `bd update <issue-id> --status in_progress`

### Development Process

1. **Implement the feature** following existing patterns
2. **Write comprehensive tests** (pytest for backend, type checking for frontend)
3. **Run tests**: 
   - Backend: `pnpm backend:test`
   - Frontend: `pnpm frontend:test`
4. **Fix failing tests** and create issues for any bugs found
5. **Build and verify**: Test the application manually
6. **Code review**: Perform multiple reviews (correctness, security, performance, quality)
7. **Close the issue**: `bd close <issue-id>`

### Quality Gates

- **Linting**: ESLint for frontend, Python type hints for backend
- **Testing**: pytest with meaningful test coverage (target >80%)
- **Building**: Both backend and frontend must build successfully
- **Security**: RBAC checks, input validation, secure authentication

### Issue Tracking with Beads

- Issues stored in `.beads/issues.jsonl` and synced via git
- Commands: `bd list`, `bd create`, `bd show`, `bd update`, `bd close`, `pnpm beads:sync`
- Priorities: P0 (critical), P1 (high), P2 (medium), P3 (low)
- Always sync before ending a session (on dev): `pnpm beads:sync`

## Key Patterns

### Authentication & Authorization

- JWT tokens stored in localStorage
- `apiClient` automatically includes Authorization header
- Backend uses dependency injection: `get_current_active_user`, `get_current_business_id`
- RBAC system with roles and permissions
- Check permissions with `has_permission(user, resource, action)`

### Data Fetching

- Frontend: Use `useEffect` with `apiClient.get()`
- Show loading spinners while fetching
- Gracefully handle errors and empty states
- Default to empty arrays/objects to prevent crashes

### Currency & Localization

- Currency: South African Rand (ZAR)
- Format: `new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' })`
- Date/time: ISO 8601 format from backend

### Error Handling

- Backend: Raise `HTTPException` with appropriate status codes
- Frontend: Try-catch blocks with user-friendly error messages
- Log errors to console for debugging

## Important Files

- `.github/WORKFLOW_SCRIPT.md` - Standard development workflow
- `AGENTS.md` - AI agent guidelines and session-ending protocol
- `README.md` - Project overview and quick start
- `DEPLOYMENT.md` - Comprehensive deployment instructions
- `backend/requirements.txt` - Python dependencies
- `frontend/package.json` - Node.js dependencies

## Best Practices

1. **Follow existing patterns** - Look at similar files for consistency
2. **Write tests first** - Test-driven development when possible
3. **Keep it simple** - Don't over-engineer solutions
4. **Security first** - Always validate input and check permissions
5. **Document as you go** - Add docstrings and comments where needed
6. **Use the service layer** - Keep endpoints thin, business logic in services
7. **Type everything** - Use Pydantic schemas and TypeScript interfaces
8. **Handle edge cases** - Empty lists, null values, validation errors
9. **Mobile responsive** - All UI components should work on mobile
10. **Track your work** - Update issue status as you progress

## Common Commands

```bash
# Backend
pnpm backend:test
pnpm backend:migrate
pnpm backend:dev

# Frontend
cd frontend
pnpm install
pnpm dev
pnpm build
pnpm lint

# Docker
cd infrastructure/docker
docker-compose up -d
docker-compose logs -f

# Beads
bd list
bd show <issue-id>
bd update <issue-id> --status in_progress
bd close <issue-id>
pnpm beads:sync
```

## Deployment

- **Platform**: Render.com (recommended for free tier)
- **Configuration**: `render.yaml` Blueprint file
- **Production**: Gunicorn + Uvicorn workers for backend, standalone Next.js for frontend
- **Database**: PostgreSQL with automatic migrations on startup
- **Environment**: Configure secrets via Render dashboard or environment variables

## Additional Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [Beads Issue Tracker](https://github.com/steveyegge/beads)

---

**Remember**: Always follow the workflow script in `.github/WORKFLOW_SCRIPT.md` for every feature. Read the issue, implement with tests, run quality gates, perform code reviews, and sync before ending your session.
