# 🤖 AI Agent Guidelines for BizPilot2

**Role:** You are a Senior Full-Stack AI Engineer specializing in **Spec-Driven Development**.
**Mission:** Transform BizPilot2 into a full-featured POS/ERP system.
**Core Principle:** "Production is never broken. If it doesn't build, it doesn't exist."

---

## 🏗 Tech Stack & Strict Constraints

| Domain | Technology | Strict Rules (DO NOT VIOLATE) |
| :--- | :--- | :--- |
| **Repo Type** | Monorepo | All commands must be run from root or specific workspace packages. |
| **Package Manager** | **pnpm** | **NEVER** use `npm` or `yarn`. Use `pnpm run <script>`. |
| **Frontend** | Next.js 16+ (App Router) | Use Server Components by default. Client Components (`'use client'`) only for interactivity. |
| **Styling** | Tailwind CSS | Mobile-first. No arbitrary values (e.g., `w-[17px]`) unless unavoidable. |
| **Backend** | FastAPI (Python 3.10+) | **Async/Await** everywhere. Strict Type hints. Pydantic V2. |
| **Database** | PostgreSQL | Use SQLAlchemy (Async) or Prisma. No raw SQL strings without validation. |
| **Tracking** | **Beads** + **Specs** | Work is defined by Specs, but tracked/synced via Beads. |

---

## 📋 The Unified Workflow: Specs + Beads

We use a hybrid approach: **Kiro Specs define "How" we build, Beads defines "What" and "When".**

### Phase 1: Session Start & Context
1.  **Sync Beads:** Always start by ensuring your issue DB is up to date.
    ```bash
    pnpm beads:sync
    ```
2.  **Check Roadmap & Specs:**
    *   Check `bd list --sort priority` for blockers (P0).
    *   Read the relevant spec in `.kiro/specs/{feature}/` to understand the architecture.
3.  **Plan:** Outline your implementation steps. If using Windsurf, state your plan in chat first.

### Phase 2: Implementation Standards
*   **Security First:** Sanitize inputs. Never hardcode secrets (`.env` only). Use Dependency Injection in FastAPI.
*   **DRY & SOLID:** Create shared utilities in `@/lib` (Frontend) or `app/core` (Backend).
*   **Modern Patterns:**
    *   *Next.js:* Use **Server Actions** for mutations. Use `zod` for validation.
    *   *FastAPI:* Use `APIRouter`. Implement proper `HTTPException` handling.

### Phase 3: The Quality Gates (MANDATORY)
**You may not commit code that does not pass these gates.**

1.  **Linting:** `pnpm lint` (Frontend) / `flake8` or `ruff` (Backend)
2.  **Type Checking:** `pnpm tsc --noEmit` (Frontend) / `mypy` (Backend)
3.  **Building:** `pnpm build` (Frontend) - *Catches 90% of Next.js RSC errors.*
4.  **Testing:** Run unit tests for the modified module.

---

## 🛑 Session-Ending Protocol (CRITICAL)

**Before ending your turn, you must perform these steps in order to maintain database hygiene:**

### 1. Verify "Production Ready" State
*   Run the build command one last time.
*   **Rule:** If the build fails, **revert or fix**. Do not leave broken code.

### 2. File/Update Beads Issues
*   **Proactive Creation:** Create issues for bugs found (`Bug: ...`) or remaining work (`TODO: ...`).
*   **Update Status:** Mark completed items as done.
    ```bash
    bd update <id> --status done
    bd create "Bug: Validation failing on login" --priority 0
    ```

### 3. Sync The Distributed Database
*   **Why?** Beads uses a local SQLite cache. You must sync to share state with other agents.
    ```bash
    git checkout dev
    pnpm beads:sync
    
    # If conflicts occur:
    # 1. Pull changes -> 2. Resolve -> 3. Re-import
    # bd import -i .beads/issues.jsonl
    # pnpm beads:sync
    ```

### 4. Git Commit & Push
*   Format: `type(scope): description` (e.g., `feat(auth): implement jwt middleware`)
*   Ensure `.beads/issues.jsonl` is included in the commit.

---

## 🗺 BizPilot Feature Roadmap

**Current Focus:** Phase 0 & Phase 1 (Foundation)

### Phase 0: Marketing Pages Redesign (IMMEDIATE)
*   **Spec:** `marketing-pages-redesign`
*   **Tasks:** Fix guest access routes, centralize pricing, add AI messaging, fix RSC errors.

### Phase 1: Core POS Foundation (Q1 2026)
*   **1.1 Mobile POS:** React Native/Expo, WatermelonDB (Offline-first).
*   **1.2 POS Core:** Transaction processing, Cart, Receipts.
*   **1.3 Sync Engine:** Background sync, conflict resolution.

### Phase 2: Payment & Transaction Management
*   **2.1 Integrated Payments:** Yoco, SnapScan, Apple Pay.
*   **2.2 Shift Management:** PIN auth, Cash drawer, Reconciliation.

### Phase 3: Inventory Management
*   **3.1 Stock Control:** Real-time tracking, Barcode scanning.
*   **3.2 Multi-Location:** Central warehouse, Transfers.
*   **3.3 Automated Reordering:** Purchase orders, Suppliers.

### Phase 4: Hospitality Features
*   **4.1 Menu Engineering:** Modifiers, Recipe costing.
*   **4.2 Recipe Management:** Ingredient tracking, Yields.

### Phase 5: Customer Management
*   **5.1 CRM Core:** Profiles, Purchase history.
*   **5.2 Loyalty:** Points, Rewards, Tiers.

### Phase 6: Staff Management
*   **6.1 Profiles:** Role-based permissions, Activity logs.
*   **6.2 Time & Attendance:** Clock in/out, Timesheets.

### Phase 7: Reporting & Analytics
*   **7.1 Sales/Inventory/Staff Reports:** Detailed breakdowns.
*   **7.2 Custom Dashboards:** Widget-based KPI tracking.

### Phase 8: Accounting Integrations
*   **8.1 Xero & Sage:** Invoice/Payment sync, GL mapping.

### Phase 9: E-Commerce & Online Ordering
*   **9.1 WooCommerce:** Product/Inventory sync.
*   **9.2 Online Ordering (ToGo):** Customer app, Delivery tracking.

### Phase 10 - 12: Enterprise, Retail & Advanced
*   Multi-location HQ, Digital Signage, Laybys, Petty Cash.

---

## ⚡️ Quick Reference Commands

```bash
# Frontend Check
cd frontend
pnpm install && pnpm lint && pnpm build

# Backend Check
cd backend
source venv/bin/activate
pip install -r requirements.txt && pytest && mypy .

# Beads Management
bd list --sort priority   # Check work
bd ready                  # Find unblocked work
bd sync           # Sync DB (Start/End of session)