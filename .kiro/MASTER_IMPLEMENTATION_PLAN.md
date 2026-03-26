# BizPilot Master Implementation Plan
# Generated: 2026-03-26
# Author: Claude Code — Senior AI Engineer Analysis

---

## 1. SYSTEM ARCHITECTURE OVERVIEW

### 1.1 What BizPilot Is

BizPilot is a multi-platform business management SaaS application targeting South African SMBs. It provides invoicing, inventory management, point-of-sale (POS), layby/lay-away, CRM, time tracking, staff management, and reporting — all from a single platform. The product serves restaurants, retail shops, service businesses, and hospitality venues. Revenue comes from tiered subscriptions (Free → Starter → Professional → Enterprise) priced in ZAR with Paystack as the primary payment gateway.

### 1.2 Technology Stack

| Component | Technology | Version | Role |
|-----------|-----------|---------|------|
| Backend API | FastAPI (Python) | 0.100+ | REST API server |
| Database | PostgreSQL | 15+ | Primary data store |
| Dev/Test DB | SQLite | 3.x | Local development & testing |
| ORM | SQLAlchemy | 2.0 (async) | Database abstraction |
| Migrations | Alembic | 1.12+ | Schema versioning |
| Cache | Redis | 7+ | Permission cache, session store |
| Frontend | Next.js | 16+ | Web dashboard (App Router) |
| UI Components | Radix UI + Tailwind CSS | Latest | Component library + styling |
| State | Zustand | 4.x | Client state management |
| Mobile | Expo SDK | 52 | React Native cross-platform |
| Mobile DB | WatermelonDB | Latest | Offline-first local storage |
| Mobile Styling | NativeWind | 4.x | Tailwind for React Native |
| Monorepo | pnpm workspaces | 8+ | Package management |
| AI | OpenAI / Groq | Latest | Agent orchestration |
| Scheduler | APScheduler | 3.x | Background job processing |
| Payments | Paystack, Yoco, SnapScan | — | Payment processing |
| Email | SMTP / Templates | — | Transactional email |
| Deployment | DigitalOcean App Platform | — | Production hosting |
| CI/CD | GitHub Actions | — | Automated testing & deployment |
| Shared | TypeScript | 5.x | Pricing config/utils across packages |

### 1.3 Monorepo Structure

```
BizPilot2/
├── backend/                    # FastAPI Python API
│   ├── app/
│   │   ├── api/                # 88+ route files by domain
│   │   ├── models/             # 85+ SQLAlchemy models
│   │   ├── schemas/            # Pydantic v2 request/response
│   │   ├── services/           # 105+ business logic services
│   │   ├── agents/             # AI agent orchestration
│   │   ├── scheduler/          # APScheduler background jobs
│   │   └── core/               # DB, config, security, Redis, RBAC
│   ├── alembic/                # Database migrations
│   └── tests/                  # pytest test suite
├── frontend/                   # Next.js 16 web dashboard
│   └── src/
│       ├── app/(dashboard)/    # 100+ protected route pages
│       ├── app/(marketing)/    # Public pages (pricing, features, etc.)
│       ├── app/auth/           # Login, register, password reset
│       ├── components/         # Shared UI components
│       ├── hooks/              # Feature-specific data hooks
│       ├── lib/                # API client, utilities
│       └── store/              # Zustand stores
├── mobile/                     # Expo SDK 52 React Native app
│   ├── app/(auth)/             # Login, PIN screens
│   ├── app/(tabs)/             # POS, orders, inventory, etc.
│   ├── db/                     # WatermelonDB schema + sync
│   ├── services/               # API client, auth, sync
│   └── stores/                 # Zustand stores
├── shared/                     # TypeScript utilities
│   ├── pricing-config.ts       # Subscription tier definitions
│   └── pricing-utils.ts        # Price formatting, tier lookup
└── infrastructure/             # Docker, deployment config
```

### 1.4 Data Flow

```
User → Frontend (Next.js) → Axios + CSRF → Backend (FastAPI) → PostgreSQL
                                                      ↓
User → Mobile (Expo) → WatermelonDB (offline) → Sync Engine → Backend → PostgreSQL
                                                      ↓
                                              APScheduler jobs → Email, Notifications
                                              AI Agents → OpenAI/Groq → Response
```

- **Web**: All API calls go through `src/lib/api.ts` Axios client with auto CSRF and 401 handling.
- **Mobile**: WatermelonDB stores data locally. Sync engine pushes dirty records in batches of 50 and pulls changes since last sync timestamp.
- **Multi-tenant**: Every request carries `X-Business-ID` header. All queries filter by `business_id`.

### 1.5 Authentication Model

- **Web**: Session cookies (HttpOnly) + CSRF tokens. Sessions tracked in DB with cleanup.
- **Mobile**: JWT tokens stored in Expo Secure Store. 15-min access token, 7-day refresh.
- **RBAC**: Predefined roles (Owner, Manager, Cashier, Waiter, etc.) + custom roles. Permissions checked via `app/core/rbac.py`. Per-business feature overrides via SuperAdmin.
- **OAuth**: Google OAuth supported for web login.
- **PIN**: 4-digit PIN for quick POS staff switching.
- **Device limits**: Enforced per subscription tier. Inactive devices auto-marked after 30 days.

### 1.6 Deployment Architecture

- **Platform**: DigitalOcean App Platform
- **Domain**: bizpilotpro.app
- **Backend**: Uvicorn process with auto-scaling
- **Frontend**: Next.js standalone build
- **Database**: DigitalOcean Managed PostgreSQL
- **Cache**: DigitalOcean Managed Redis
- **CI/CD**: GitHub Actions → DigitalOcean deploy on merge to main
- **Monitoring**: Poll `doctl` until Phase=ACTIVE Progress=100 after each deploy
- **Environment**: `.env` / `.env.local` for backend; `NEXT_PUBLIC_` prefix for frontend; `EXPO_PUBLIC_` for mobile (build-time)

---

## 2. COMPLETE FEATURE INVENTORY

### 2.1 Addons & Modifiers
- **Spec location:** .kiro/specs/addons-modifiers/
- **Business purpose:** Enable product customizations with modifier groups, combo deals, and flexible pricing for hospitality businesses.
- **Requirements summary:**
  - Modifier groups with forced/optional and single/multi-select modes
  - Modifier pricing (free, fixed, percentage, "first N free", tiered)
  - Nested modifiers up to 2 levels deep
  - Combo deals with bundle components
  - Availability windows and time-based controls
- **Design approach:** PostgreSQL tables for modifier_groups, modifiers, combos + services for pricing, validation, availability. WatermelonDB sync for offline.
- **Implementation status:**
  - Tasks complete: 84/84 (100%)
  - Backend: COMPLETE — Models, services (addon_service, combo_service, modifier_*_services), API routes
  - Frontend: COMPLETE — Addon and modifier pages
  - Mobile: COMPLETE — WatermelonDB models
  - Tests: COMPLETE
- **Blockers:** None
- **Dependencies:** Menu-Engineering, Product-Management, Order-Management, POS-Core

### 2.2 Authentication & Authorization
- **Spec location:** .kiro/specs/authentication-authorization/
- **Business purpose:** Secure user authentication with RBAC, multi-business support, and OAuth for the entire platform.
- **Requirements summary:**
  - JWT with 15-min access / 7-day refresh tokens
  - Role-based access control with predefined and custom roles
  - Multi-business user management with per-business roles
  - Session management with admin termination
  - Google OAuth integration
- **Design approach:** Stateless JWT auth, bcrypt hashing, session tracking, RBAC middleware.
- **Implementation status:**
  - Tasks complete: 115/115 (100%)
  - Backend: COMPLETE — auth.py, oauth.py, sessions.py, roles.py, two_factor.py
  - Frontend: COMPLETE — Login, register, forgot/reset password, business setup
  - Mobile: COMPLETE — Auth screens, PIN, biometric
  - Tests: COMPLETE
- **Blockers:** None
- **Dependencies:** Multi-Business-Management

### 2.3 Automated Reordering
- **Spec location:** .kiro/specs/automated-reordering/
- **Business purpose:** Monitor stock levels and auto-generate purchase orders when inventory falls below reorder points.
- **Requirements summary:**
  - Per-product reorder points, safety stock, lead time configuration
  - Stock monitoring with alert generation
  - Draft PO generation grouped by supplier
  - Receiving workflow with partial receiving and barcode scanning
  - Automated reorder rules with approval thresholds
- **Design approach:** ReorderService monitors levels, generates POs, manages receiving workflow.
- **Implementation status:**
  - Tasks complete: 103/103 (100%)
  - Backend: COMPLETE — reorder.py routes, reorder_service, stock_monitor_service
  - Frontend: COMPLETE — Reorder page, purchases pages (CRUD, receive)
  - Tests: COMPLETE
- **Blockers:** None
- **Dependencies:** Inventory-Management, Supplier-Management, Stock-Control

### 2.4 Automated Report Emails
- **Spec location:** .kiro/specs/automated-report-emails/
- **Business purpose:** Enable users to subscribe to automated weekly/monthly business reports delivered via email.
- **Requirements summary:**
  - Subscription UI with enable/disable per report type
  - Weekly (Monday 8AM) and monthly (1st of month 8AM) scheduling
  - Sales summary, inventory, financial, customer activity reports
  - HTML email templates with unsubscribe links
  - Retry logic (up to 3 times) with batch processing
- **Design approach:** APScheduler cron jobs + ReportSubscriptionService + EmailService.
- **Implementation status:**
  - Tasks complete: 107/107 (100%)
  - Backend: COMPLETE — report_subscription_service, report_generator_service, email_template_service
  - Frontend: COMPLETE — Settings integration
  - Tests: COMPLETE
- **Blockers:** None
- **Dependencies:** Sales-Reports, Inventory-Reports, Email-Service

### 2.5 Bulk Operations
- **Spec location:** .kiro/specs/bulk-operations/
- **Business purpose:** Enable batch processing of large datasets — price updates, stock adjustments, product imports/exports.
- **Requirements summary:**
  - Percentage and fixed amount price adjustments with preview
  - Stock adjustments by quantity/value with reason codes
  - CSV/Excel product import/export with validation
  - Dry-run functionality with impact summaries
  - Progress tracking, error handling, audit logs
- **Design approach:** Queue-based background processing with BulkOperationService, tracked operations, templates.
- **Implementation status:**
  - Tasks complete: 22/151 (14%)
  - Backend: PARTIAL — bulk_operations.py (463 lines, 30+ endpoints), bulk_operations_service, tracked_bulk_service, bulk_template_service exist. Model exists (231 lines).
  - Frontend: PARTIAL — Page exists but minimal UI
  - Mobile: PARTIAL — BulkOperationsService.ts exists
  - Tests: NOT STARTED
- **Blockers:** Frontend UI needs building out
- **Dependencies:** Product-Management, Inventory-Management, Stock-Control

### 2.6 CRM Core
- **Spec location:** .kiro/specs/crm-core/
- **Business purpose:** Customer relationship management with profiles, purchase history, segmentation, and communication.
- **Requirements summary:**
  - Customer profiles with contacts, addresses, notes, custom fields, photo
  - Purchase history with order details, total spent, average order value
  - Search by name, phone, email with offline support
  - Customer types (retail, wholesale, VIP) with type-based pricing
  - Statistics: visit count, total spent, lifetime value, at-risk identification
- **Design approach:** CustomerService + SegmentationService with segment rules engine.
- **Implementation status:**
  - Tasks complete: 55/63 (87%)
  - Backend: COMPLETE — crm.py routes, crm_service
  - Frontend: COMPLETE — CRM page
  - Tests: PARTIAL — Need execution
- **Blockers:** Test execution and deployment workflow remaining
- **Dependencies:** Customer-Management, Order-Management

### 2.7 Custom Dashboards
- **Spec location:** .kiro/specs/custom-dashboards/
- **Business purpose:** Customizable widget-based dashboards with KPIs, charts, and real-time metrics per user/role.
- **Requirements summary:**
  - Multiple dashboards with naming, templates, role-based defaults
  - Widget types: KPI numbers, charts (line/bar/pie), tables, gauges
  - Widget configuration with data source, date range, filtering, appearance
  - Drag-and-drop layout with responsive design and resizable widgets
  - Real-time auto-updates with configurable refresh
- **Design approach:** DashboardService + WidgetService + DataAggregationService.
- **Implementation status:**
  - Tasks complete: 16/94 (17%)
  - Backend: PARTIAL — dashboards.py (485 lines, 18+ endpoints), dashboard_service (572 lines). Well-structured.
  - Frontend: PARTIAL — Page exists but minimal
  - Tests: NOT STARTED
- **Blockers:** Frontend widget builder and real-time updates
- **Dependencies:** Sales-Reports, Inventory-Reports, Staff-Reports

### 2.8 Customer Accounts
- **Spec location:** .kiro/specs/customer-accounts/
- **Business purpose:** Enable credit accounts for B2B customers with balance tracking, statements, and collections management.
- **Requirements summary:**
  - Account setup with credit limit, payment terms, approval workflow
  - Charge sales to accounts with credit limit validation
  - Balance display, credit available, history with alerts
  - Partial payments with automatic allocation to oldest invoices
  - Monthly statements with aging breakdown, email, PDF
- **Design approach:** CustomerAccountService (2136 lines) with AR reporting, DSO calculations, collections.
- **Implementation status:**
  - Tasks complete: 77/112 (68%)
  - Backend: COMPLETE — customer_accounts.py (761 lines, 20+ endpoints), comprehensive service
  - Frontend: PARTIAL — Page exists, needs statement/collections UI
  - Tests: PARTIAL — Need execution
- **Blockers:** PDF statement generation, email delivery, collections UI, testing
- **Dependencies:** Customer-Management, Invoice-Management, Integrated-Payments

### 2.9 Customer Display (myTab)
- **Spec location:** .kiro/specs/customer-display/
- **Business purpose:** Customer-facing display showing order details, loyalty info, payment options, and promotional content during checkout.
- **Requirements summary:**
  - Real-time order display with items, quantities, prices, totals
  - Loyalty points balance, earned points, available rewards
  - Amount due with QR code for mobile payment
  - Promotional images/videos with scheduling
  - Flexible hardware support (tablets, secondary monitors, pole displays)
- **Design approach:** WebSocket-based real-time updates, DisplayService, content management.
- **Implementation status:**
  - Tasks complete: 3/73 (4%)
  - Backend: STUB — customer_displays.py (178 lines, 7 endpoints), service exists
  - Frontend: NOT STARTED — No page found
  - Tests: NOT STARTED
- **Blockers:** WebSocket infrastructure, display app, content management
- **Dependencies:** Order-Management, Integrated-Payments, Loyalty-Programs

### 2.10 Customer Management
- **Spec location:** .kiro/specs/customer-management/
- **Business purpose:** Comprehensive customer CRUD with search, filtering, metrics tracking, and multi-tenant isolation.
- **Requirements summary:**
  - Customer profiles (individual/business) with required field validation
  - Search across multiple fields, filter by type/tags, pagination/sorting
  - Auto-tracked metrics: total orders, total spent, average order value
  - Multi-tenant isolation with business-level filtering
  - Soft deletion, bulk operations, address/notes/tags management
- **Design approach:** Three-tier CRM with FastAPI backend, PostgreSQL, Next.js frontend.
- **Implementation status:**
  - Tasks complete: 61/61 (100%)
  - Backend: COMPLETE — customers.py routes, customer_service
  - Frontend: COMPLETE — Customer list, detail, edit, new pages
  - Tests: COMPLETE
- **Blockers:** None
- **Dependencies:** CRM-Core, Multi-Business-Management

### 2.11 Delivery Management
- **Spec location:** .kiro/specs/delivery-management/
- **Business purpose:** Manage delivery zones, driver assignments, order tracking, and delivery fee calculation.
- **Requirements summary:**
  - Polygon, radius, and postcode-based zone definitions
  - Flat rate, distance-based, and order value-based fee calculation
  - Driver profiles with availability, location tracking, shifts, performance
  - Manual and auto-assignment with batch nearby orders
  - Status tracking, driver location map, dynamic ETA, proof of delivery
- **Design approach:** 6 specialized services (delivery, fee, zone, tracking, assign, report).
- **Implementation status:**
  - Tasks complete: 24/97 (24%)
  - Backend: PARTIAL — deliveries.py (636 lines, 20+ endpoints), 6 services exist
  - Frontend: PARTIAL — Page exists
  - Tests: NOT STARTED
- **Blockers:** Zone/fee calculation logic, driver management, real-time tracking
- **Dependencies:** Order-Management, Multi-Location-Management

### 2.12 Department-Based Team Roles
- **Spec location:** .kiro/specs/department-based-team-roles/
- **Business purpose:** Transform generic team roles into department-based organizational structure for better team management.
- **Requirements summary:**
  - Create/manage departments with name, description, color, icon
  - Unique department names per business with cascade deletion
  - Team member department assignment during invite/edit
  - Department display with grouping, sorting, search
  - RESTful API with business-level authorization
- **Design approach:** DepartmentService + Department model + team management integration.
- **Implementation status:**
  - Tasks complete: 42/64 (65%)
  - Backend: PARTIAL — departments.py (147 lines, 4 endpoints), department_service (280 lines), model is skeletal (26 lines)
  - Frontend: PARTIAL — No dedicated page, integrated into team management
  - Tests: NOT STARTED
- **Blockers:** Model expansion, more endpoints, team UI integration
- **Dependencies:** Authentication-Authorization, Staff-Management

### 2.13 Digital Signage
- **Spec location:** .kiro/specs/digital-signage/
- **Business purpose:** Multi-display content management with scheduling, real-time menu boards synced with POS, and promotional campaigns.
- **Requirements summary:**
  - Display registration with pairing, online/offline status tracking
  - Media library for images, videos, HTML with thumbnails and usage tracking
  - Visual layout editor with drag-and-drop, multi-zone, templates
  - Menu board templates with auto price updates within 60 seconds
  - Playlist management with shuffle, priority, offline playback
- **Design approach:** ContentManagementService + ScheduleService + DisplayManagementService.
- **Implementation status:**
  - Tasks complete: 8/128 (6%)
  - Backend: PARTIAL — signage.py (453 lines, 20+ endpoints), signage_service exists
  - Frontend: PARTIAL — Page exists
  - Tests: NOT STARTED
- **Blockers:** Entire backend infrastructure sparse, display player API, analytics
- **Dependencies:** Multi-Location-Management, Product-Management, Menu-Engineering

### 2.14 Extended Reports
- **Spec location:** .kiro/specs/extended-reports/
- **Business purpose:** Comprehensive business analytics — inventory reports, COGS analysis, profit margins, and audit trails.
- **Requirements summary:**
  - Detailed inventory reports with stock levels, values, reorder points
  - COGS reports with gross profit and margin calculation
  - Profit margins by product with highest/lowest highlighting
  - User activity tracking (clock-in/out, hours, breaktime)
  - Login/logout audit trails with device/IP info
- **Design approach:** ReportBuilderService + DataAggregationService + ExportService.
- **Implementation status:**
  - Tasks complete: 24/84 (28%)
  - Backend: STUB — extended_reports.py (204 lines, 3 endpoints only: user-activity, login-history, export)
  - Frontend: PARTIAL — Under /reports/extended/
  - Tests: NOT STARTED
- **Blockers:** Most report types not implemented
- **Dependencies:** Sales-Reports, Inventory-Reports, Staff-Reports, CRM-Core

### 2.15 General Ledger
- **Spec location:** .kiro/specs/general-ledger/
- **Business purpose:** Double-entry accounting with chart of accounts, journal entries, and financial reporting.
- **Requirements summary:**
  - Standard account types (Asset, Liability, Equity, Revenue, Expense)
  - Auto-mapping POS transactions to accounts
  - Manual journal entries with double-entry enforcement and recurring entries
  - Auto entries for daily sales, payments, inventory, expenses
  - Financial reports: trial balance, income statement, balance sheet
- **Design approach:** GeneralLedgerService + JournalEntryService + TrialBalanceService.
- **Implementation status:**
  - Tasks complete: 28/124 (22%)
  - Backend: PARTIAL — general_ledger.py (410 lines, 15+ endpoints), service exists
  - Frontend: PARTIAL — Page exists
  - Tests: NOT STARTED
- **Blockers:** Schema completion, auto-mapping rules, period management
- **Dependencies:** Invoice-Management, Sage-Integration, Xero-Integration

### 2.16 Granular Permissions & Subscription
- **Spec location:** .kiro/specs/granular-permissions-subscription/
- **Business purpose:** Tier-based feature gating, device limits, and subscription management with admin overrides.
- **Requirements summary:**
  - Feature access based on subscription tier
  - SuperAdmin overrides with precedence over tier permissions
  - Device limits per tier with auto-cleanup after 30 days
  - Demo mode with full access expiring to tier-based
  - High-performance permission checks <10ms with Redis caching
- **Design approach:** PermissionService (564 lines) with Redis cache, subscription tier enforcement.
- **Implementation status:**
  - Tasks complete: 53/92 (57%)
  - Backend: PARTIAL — permissions.py (61 lines, 1 endpoint), but permission_service.py (564 lines) is comprehensive
  - Frontend: PARTIAL — Uses hooks/stores for feature gating
  - Tests: PARTIAL
- **Blockers:** API exposure is minimal (only GET /permissions/me), migration from old schema needed
- **Dependencies:** Authentication-Authorization, Multi-Business-Management

### 2.17 Integrated Payments
- **Spec location:** .kiro/specs/integrated-payments/
- **Business purpose:** Multi-provider payment processing — card, mobile, EFT, cash, split payments.
- **Requirements summary:**
  - Cash with automatic change calculation
  - Yoco SDK for card tap/chip/swipe
  - SnapScan QR code with polling confirmation
  - Apple Pay and Google Pay support
  - Split payments with multiple tenders and remaining balance tracking
- **Design approach:** PaymentService abstraction layer with provider-specific implementations.
- **Implementation status:**
  - Tasks complete: 36/79 (45%)
  - Backend: PARTIAL — payments.py (290 lines, 13 endpoints), payment_service (439 lines)
  - Frontend: PARTIAL — Page exists
  - Mobile: PARTIAL — PaymentService.ts + EFTService.ts (Paystack/Yoco/SnapScan)
  - Tests: NOT STARTED
- **Blockers:** Mobile payment implementations (Apple Pay, Google Pay), PCI compliance
- **Dependencies:** Order-Management, Invoice-Management, POS-Core

### 2.18 Inventory Management
- **Spec location:** .kiro/specs/inventory-management/
- **Business purpose:** Comprehensive stock tracking with real-time visibility, automated updates from sales/purchases, and transaction history.
- **Requirements summary:**
  - Inventory items linking products to stock levels with CRUD
  - Transaction tracking (in, out, adjustment) with history and filters
  - Multi-location tracking with available/reserved quantities
  - Low stock alerts and valuation reporting (FIFO/LIFO/Average)
  - Bulk import/export with validation
- **Design approach:** InventoryService + StockService with transaction tracking.
- **Implementation status:**
  - Tasks complete: 49/49 (100%)
  - Backend: COMPLETE — inventory.py routes, inventory_service
  - Frontend: COMPLETE — Inventory list, detail, edit, new pages
  - Tests: COMPLETE
- **Blockers:** None
- **Dependencies:** Product-Management, Multi-Location-Inventory

### 2.19 Inventory Reports
- **Spec location:** .kiro/specs/inventory-reports/
- **Business purpose:** Stock level, movement, valuation, turnover, and wastage reporting for inventory management.
- **Requirements summary:**
  - Stock level reports by product, category, location
  - Movement reports categorizing sales, purchases, adjustments
  - Total inventory value with costing method support
  - Turnover, days of inventory, fast/slow-moving, dead stock identification
  - Wastage/write-off tracking by reason with value calculation
- **Design approach:** InventoryReportService with caching and trend analysis.
- **Implementation status:**
  - Tasks complete: 44/111 (39%)
  - Backend: PARTIAL — inventory_reports.py (254 lines, 9 endpoints: stock level, movement, aging, variance, ABC)
  - Frontend: PARTIAL — /reports/inventory/ page
  - Tests: NOT STARTED
- **Blockers:** Schema for report configs/cache, turnover/wastage services
- **Dependencies:** Inventory-Management, Stock-Control, Multi-Location-Inventory

### 2.20 Invoice Management
- **Spec location:** .kiro/specs/invoice-management/
- **Business purpose:** Full invoicing lifecycle — create, track, pay, and manage customer and supplier invoices.
- **Requirements summary:**
  - Unique invoice numbers (INV-YYYYMMDD-XXXXX)
  - Status tracking (draft → sent → viewed → paid/partial/overdue/cancelled)
  - Payment recording with validation and auto-allocation
  - Paystack integration (1.5% + R2, capped R50)
  - Overdue detection with notification creation
- **Design approach:** InvoiceService + InvoicePaymentService + PDFGenerationService.
- **Implementation status:**
  - Tasks complete: 54/54 (100%)
  - Backend: COMPLETE — invoices.py, invoice_service, invoice_payment_service, pdf_service
  - Frontend: COMPLETE — Invoice list, detail, edit, new, payment callback pages
  - Tests: COMPLETE
- **Blockers:** None
- **Dependencies:** Product-Management, Customer-Management, Integrated-Payments

### 2.21 Layby Management
- **Spec location:** .kiro/specs/layby-management/
- **Business purpose:** Lay-away system allowing customers to reserve products with deposits and scheduled payments.
- **Requirements summary:**
  - Layby creation with deposit and flexible payment schedule
  - Cancellation fees with grace periods and restocking fees
  - Automated payment reminders and collection-ready notifications
  - Inventory reservation from available stock
  - Offline operations with sync and conflict resolution
- **Design approach:** LaybyService + LaybyPaymentService + LaybyAuditService with WatermelonDB sync.
- **Implementation status:**
  - Tasks complete: 69/76 (90%)
  - Backend: COMPLETE — laybys.py, layby_service, layby_notification_service, layby_report_service, layby_stock_service
  - Frontend: COMPLETE — Layby list, detail, new, reports pages
  - Tests: PARTIAL — Missing stock reservation integration test
- **Blockers:** Stock reservation service link, final integration testing
- **Dependencies:** POS-Core, Order-Management, Integrated-Payments

### 2.22 Loyalty Programs
- **Spec location:** .kiro/specs/loyalty-programs/
- **Business purpose:** Points-based rewards with tier management, rewards catalog, and loyalty currency for customer engagement.
- **Requirements summary:**
  - Configurable earn rates with bonus points promotions
  - Points balance, history, expiring/pending points display
  - Points redemption at POS with partial redemption
  - Reward items with points cost, discounts, product rewards
  - Multiple tiers with auto-upgrade and tier-exclusive rewards
- **Design approach:** LoyaltyService + PointsCalculationService + RewardService.
- **Implementation status:**
  - Tasks complete: 44/69 (63%)
  - Backend: PARTIAL — loyalty.py (302 lines, 11 endpoints), loyalty_service
  - Frontend: PARTIAL — /loyalty/ page exists
  - Mobile: STRONG — LoyaltyService.ts (14k lines, extensive implementation)
  - Tests: NOT STARTED — Implementation complete, awaiting test execution
- **Blockers:** Test suite execution, deployment verification
- **Dependencies:** Customer-Management, Order-Management, POS-Core

### 2.23 Marketing Pages Redesign
- **Spec location:** .kiro/specs/marketing-pages-redesign/
- **Business purpose:** Fix routing/auth issues on marketing pages while highlighting AI-powered differentiators.
- **Requirements summary:**
  - Guest access to /features, /industries, /faq, /pricing without auth
  - Fix RSC errors on page refresh
  - Centralized pricing configuration
  - Highlight AI_Agent capabilities
  - Redirect authenticated users to dashboard
- **Implementation status:**
  - Tasks complete: 33/33 (100%)
  - Backend: COMPLETE — Middleware fixes
  - Frontend: COMPLETE — Marketing layout, pricing, features, FAQ, industries, contact pages
  - Tests: COMPLETE
- **Blockers:** None
- **Dependencies:** Pricing-Consistency-and-Guest-AI-Widget

### 2.24 Menu Engineering
- **Spec location:** .kiro/specs/menu-engineering/
- **Business purpose:** Hospitality menu management with modifiers, portions, recipe costing, and kitchen routing.
- **Requirements summary:**
  - Menu items with descriptions, images, multiple prices (dine-in/takeaway), PLU codes
  - Modifier groups with required/optional and min/max rules
  - Multiple portion sizes per item with per-portion pricing and recipe
  - Ingredient cost calculation with food cost percentage alerts
  - Menu categories with images, ordering, time-based, nested
- **Design approach:** MenuService + RecipeService + PortionService.
- **Implementation status:**
  - Tasks complete: 14/58 (24%)
  - Backend: PARTIAL — menu.py (573 lines, 21 endpoints including mix/margin analysis), menu_service exists
  - Frontend: PARTIAL — /menu-engineering/ page exists
  - Tests: NOT STARTED
- **Blockers:** Schema completion, modifier UI, portion/recipe integration
- **Dependencies:** Product-Management, Add-Ons-and-Modifiers, Recipe-Management

### 2.25 Mobile POS Foundation
- **Spec location:** .kiro/specs/mobile-pos-foundation/
- **Business purpose:** Offline-first mobile POS app with React Native, WatermelonDB, and seamless data sync.
- **Requirements summary:**
  - pnpm workspaces monorepo with Expo SDK 52
  - WatermelonDB for CRUD with 10,000+ product optimization
  - Network detection with offline change queuing
  - Email/password + PIN + biometric authentication
  - File-based navigation with Expo Router
- **Design approach:** Expo SDK 52 + WatermelonDB + Zustand + NativeWind architecture.
- **Implementation status:**
  - Tasks complete: 100/115 (86%)
  - Backend: COMPLETE — Sync endpoints, auth
  - Mobile: COMPLETE — All tab screens (POS, orders, customers, products, stock, tables, bulk-ops, settings, dashboard)
  - Tests: PARTIAL — Build verification and test execution remaining
- **Blockers:** iOS/Android build verification, test execution, deployment
- **Dependencies:** POS-Core, Offline-Sync-Engine, Authentication-Authorization

### 2.26 Month-End Stock Procedures
- **Spec location:** .kiro/specs/month-end-stock/
- **Business purpose:** Stock take and period closing with physical counts, variance analysis, and audit trails.
- **Requirements summary:**
  - Stock take planning with full/partial count sessions
  - Count entry via mobile with barcode scanning and batch import
  - Variance calculation with significance highlighting and recount
  - Adjustment processing creating inventory transactions
  - Period closing with value snapshots preventing backdated transactions
- **Design approach:** StockTakeService + PeriodClosingService + VarianceAnalysisService.
- **Implementation status:**
  - Tasks complete: 21/100 (21%)
  - Backend: PARTIAL — stock_takes.py (242 lines, 9 endpoints), stock_take_service exists
  - Frontend: PARTIAL — /stock-takes/ page
  - Tests: NOT STARTED
- **Blockers:** Schema for counters, periods, snapshots; variance and period services
- **Dependencies:** Stock-Control, Inventory-Management

### 2.27 Multi-Business Management
- **Spec location:** .kiro/specs/multi-business-management/
- **Business purpose:** Multi-tenant foundation — users manage multiple businesses with isolated data and per-business roles.
- **Requirements summary:**
  - Organizations owning multiple businesses
  - Data isolation per business
  - Different roles per business with JWT business context
  - Organization → Business → User hierarchy
  - Business-level settings customization
- **Implementation status:**
  - Tasks complete: 64/64 (100%)
  - Backend: COMPLETE — business.py, organization model, business_user model
  - Frontend: COMPLETE — Business setup, switching
  - Tests: COMPLETE
- **Blockers:** None
- **Dependencies:** Authentication-Authorization

### 2.28 Multi-Location Inventory
- **Spec location:** .kiro/specs/multi-location-inventory/
- **Business purpose:** Manage inventory across locations with stock transfers and consolidated tracking.
- **Requirements summary:**
  - Per-location inventory levels with transfer support
  - Transfer requests with approval workflow and barcode scanning
  - Consolidated reports with location filtering
  - Location-specific reorder points and thresholds
  - Transfer history with audit trail
- **Design approach:** LocationService + TransferService + LocationInventoryService.
- **Implementation status:**
  - Tasks complete: 4/57 (7%)
  - Backend: NOT STARTED — No dedicated endpoint; location.py is basic CRUD
  - Frontend: NOT STARTED
  - Tests: NOT STARTED
- **Blockers:** Schema for location_stock, transfers; entire service layer needed
- **Dependencies:** Inventory-Management, Stock-Control, Multi-Location-Management

### 2.29 Multi-Location Management
- **Spec location:** .kiro/specs/multi-location-management/
- **Business purpose:** Centralized control over multiple business locations with consolidated reporting.
- **Requirements summary:**
  - Location hierarchies (regions, districts) with location-specific settings
  - Central dashboard with cross-location sales and drill-down
  - Consolidated reports with location filtering and grouping
  - Cross-location stock transfers, staff transfers, central pricing
  - Location-based access control
- **Design approach:** LocationService + ConsolidatedReportingService.
- **Implementation status:**
  - Tasks complete: 0/87 (0%)
  - Backend: MINIMAL — locations.py (397 lines, 14 endpoints) is mostly generic CRUD
  - Frontend: PARTIAL — /locations/ page exists
  - Tests: NOT STARTED
- **Blockers:** Entire multi-location business logic absent
- **Dependencies:** Multi-Business-Management, Authentication-Authorization

### 2.30 Offline-First Sync Engine
- **Spec location:** .kiro/specs/offline-sync-engine/
- **Business purpose:** Robust bidirectional sync between WatermelonDB and backend with conflict resolution.
- **Requirements summary:**
  - Network detection within 5 seconds (WiFi vs cellular)
  - Dirty record tracking with change timestamps
  - Change queuing persisting across restarts with FIFO and retry
  - Push dirty records in batches of 50 with partial failure handling
  - Pull changes since last sync with pagination for large datasets
- **Design approach:** SyncService + ConflictResolverService + NetworkMonitorService.
- **Implementation status:**
  - Tasks complete: 82/94 (87%)
  - Backend: COMPLETE — mobile_sync.py, entity_sync.py, sync.py, conflict_resolver
  - Mobile: COMPLETE — WatermelonDB schema (25k lines), sync logic, migrations
  - Tests: PARTIAL — E2E integration tests remaining
- **Blockers:** E2E tests (offline→online, conflict resolution, multi-device, crash recovery)
- **Dependencies:** Mobile-POS-Foundation

### 2.31 Online Ordering (ToGo)
- **Spec location:** .kiro/specs/online-ordering/
- **Business purpose:** Customer-facing online ordering for browse, order, and pay online (pickup or delivery).
- **Requirements summary:**
  - Product display with images, categories, availability, mobile responsive
  - Item customization with modifiers and special instructions
  - Pickup and delivery with scheduled ordering
  - Card, mobile payments, pay-on-pickup
  - Real-time order tracking with status notifications
- **Design approach:** OnlineOrderService + MenuDisplayService + OrderTrackingService.
- **Implementation status:**
  - Tasks complete: 29/101 (28%)
  - Backend: PARTIAL — online_orders.py (335 lines, 10 endpoints)
  - Frontend: PARTIAL — /online-orders/ page
  - Tests: NOT STARTED
- **Blockers:** Delivery zone schema, payment integration, customer-facing app
- **Dependencies:** Product-Management, Order-Management, Integrated-Payments

### 2.32 Order Management
- **Spec location:** .kiro/specs/order-management/
- **Business purpose:** Comprehensive order handling with multiple types (dine-in, takeaway, delivery, collection) and kitchen display.
- **Requirements summary:**
  - Dine-in, takeaway, delivery, collection order types
  - Floor plan with table status tracking
  - Order status (new → preparing → ready → served → paid) with wait time alerts
  - Kitchen display with course grouping and modifier display
  - SlipApp integration for order printing
- **Design approach:** OrderManagementService + TableService + KDSService.
- **Implementation status:**
  - Tasks complete: 60/64 (93%)
  - Backend: COMPLETE — orders.py, order_management.py, order_management_service
  - Frontend: COMPLETE — Order list, detail, edit, new, history pages
  - Tests: COMPLETE
- **Blockers:** SlipApp SDK integration remaining (4 tasks)
- **Dependencies:** POS-Core, Table-Management, Integrated-Payments

### 2.33 Overdue Invoice Scheduler
- **Spec location:** .kiro/specs/overdue-invoice-scheduler/
- **Business purpose:** Automated background job monitoring invoice due dates and creating overdue notifications.
- **Requirements summary:**
  - Execute daily at midnight UTC (configurable)
  - Query past-due invoices not paid/cancelled
  - Prevent duplicate notifications
  - Error handling with retry on connection failure
  - Detailed logging
- **Implementation status:**
  - Tasks complete: 10/10 (100%)
  - Backend: COMPLETE — Scheduler job, notification integration
  - Tests: COMPLETE
- **Blockers:** None
- **Dependencies:** Invoice-Management

### 2.34 Partner Admin
- **Spec location:** .kiro/specs/partner-admin/
- **Business purpose:** Multi-tenant partner administration with isolated environments, white-labeling, and revenue sharing.
- **Requirements summary:**
  - Partner creation with isolated tenant environments
  - Complete data isolation at database level
  - Step-by-step onboarding wizard
  - Custom logos, colors, domains, email templates, CSS
  - Revenue sharing models (percentage, fixed, tiered) with billing
- **Design approach:** PartnerService + TenantService + PartnerAnalyticsService. Extensive (219 tasks).
- **Implementation status:**
  - Tasks complete: 0/219 (0%)
  - Backend: PARTIAL — partners.py (302 lines, 15 endpoints), partner_service exists, model (137 lines)
  - Frontend: PARTIAL — /partners/ page exists
  - Tests: NOT STARTED
- **Blockers:** RLS policies, onboarding wizard, white-labeling, billing, analytics — massive scope
- **Dependencies:** Multi-Business-Management, Authentication-Authorization, Granular-Permissions

### 2.35 Petty Cash Management
- **Spec location:** .kiro/specs/petty-cash/
- **Business purpose:** Manage petty cash funds tracking expenses, receipts, and reconciliations.
- **Requirements summary:**
  - Custodian management with expense limit configuration
  - Fund management with disbursement and receipt tracking
  - Approval workflow for expenses
  - Reconciliation with variance detection
  - Full audit trail
- **Design approach:** PettyCashService + ApprovalService + ReconciliationService.
- **Implementation status:**
  - Tasks complete: 40/197 (20%)
  - Backend: PARTIAL — petty_cash.py (446 lines, 21 endpoints), petty_cash_service
  - Frontend: PARTIAL — /petty-cash/ page exists
  - Tests: NOT STARTED
- **Blockers:** Schema for approvals, disbursements, receipts, reconciliations
- **Dependencies:** General-Ledger

### 2.36 PMS Integration
- **Spec location:** .kiro/specs/pms-integration/
- **Business purpose:** Integrate with Property Management Systems (Opera, Protel, Mews, Cloudbeds) for room charging.
- **Requirements summary:**
  - Adapter pattern for multiple PMS systems
  - Guest profile lookup and room validation
  - Charge posting with authorization
  - Folio reconciliation
  - Offline-first with sync
- **Design approach:** PMSAdapterService with provider-specific adapters + ChargePostingService.
- **Implementation status:**
  - Tasks complete: 57/233 (24%)
  - Backend: PARTIAL — pms.py (326 lines, 14 endpoints), pms_service
  - Frontend: PARTIAL — /pms/ page exists
  - Tests: NOT STARTED
- **Blockers:** Adapter implementations, authorization service, reconciliation
- **Dependencies:** Order-Management, Integrated-Payments

### 2.37 POS Core
- **Spec location:** .kiro/specs/pos-core/
- **Business purpose:** Core POS system with cart management, transaction processing, and receipt generation.
- **Requirements summary:**
  - Product grid with search and barcode scanning
  - Cart with add/remove/quantity adjust
  - Multiple payment methods
  - Receipt generation and printing
  - Offline-first operation
- **Design approach:** Core POS logic distributed across OrderService, ReceiptService, CartService.
- **Implementation status:**
  - Tasks complete: 95/113 (84%)
  - Backend: COMPLETE — pos.py (waiter cashup), logic distributed across orders/payments
  - Mobile: COMPLETE — Full POS screens and services
  - Frontend: COMPLETE — POS-related pages
  - Tests: PARTIAL — E2E and offline testing remaining
- **Blockers:** E2E testing, offline functionality testing, analytics features
- **Dependencies:** Product-Management, Integrated-Payments, Inventory-Management

### 2.38 Pricing Consistency & Guest AI Widget
- **Spec location:** .kiro/specs/pricing-consistency-and-guest-ai-widget/
- **Business purpose:** Ensure consistent pricing across channels and provide AI-powered guest interaction widget.
- **Implementation status:**
  - Tasks complete: 34/34 (100%)
  - All platforms: COMPLETE
- **Blockers:** None
- **Dependencies:** Pricing-Consistency-Marketing

### 2.39 Pricing Consistency Marketing
- **Spec location:** .kiro/specs/pricing-consistency-marketing/
- **Business purpose:** Marketing page pricing display with feature comparison and subscription tier clarity.
- **Implementation status:**
  - Tasks complete: 111/112 (99%)
  - All platforms: COMPLETE — 1 minor task remaining
- **Blockers:** None
- **Dependencies:** Granular-Permissions-Subscription

### 2.40 Product Management
- **Spec location:** .kiro/specs/product-management/
- **Business purpose:** Full product catalog management with categories, pricing, inventory linking, and bulk operations.
- **Implementation status:**
  - Tasks complete: 65/65 (100%)
  - Backend: COMPLETE — products.py, product_service, categories.py
  - Frontend: COMPLETE — Product list, detail, edit, new, categories pages
  - Tests: COMPLETE
- **Blockers:** None
- **Dependencies:** Inventory-Management, Supplier-Management

### 2.41 Proforma Invoices
- **Spec location:** .kiro/specs/proforma-invoices/
- **Business purpose:** Quote/proforma management with approval tracking and conversion to sales invoices.
- **Requirements summary:**
  - Quote creation with line items, pricing, discounts, taxes
  - Revision tracking and approval workflow
  - Customer-specific pricing and discount logic
  - Conversion to invoice workflow
  - PDF generation and email delivery
- **Design approach:** ProformaService + QuoteConversionService + RevisionService.
- **Implementation status:**
  - Tasks complete: 22/132 (16%)
  - Backend: PARTIAL — quotes.py (575 lines, 22 endpoints), proforma_service, proforma_revision_service, proforma_report_service
  - Frontend: PARTIAL — /quotes/ page exists
  - Tests: NOT STARTED
- **Blockers:** Schema for revisions/approvals, conversion workflow, testing
- **Dependencies:** Invoice-Management, Customer-Management

### 2.42 Recipe Management
- **Spec location:** .kiro/specs/recipe-management/
- **Business purpose:** Recipe management with ingredient tracking, costing, and yield tracking for food service.
- **Implementation status:**
  - Tasks complete: 26/34 (76%)
  - Backend: PARTIAL — production.py (302 lines, 9 endpoints), production_service
  - Frontend: PARTIAL — Production pages (list, detail, new, complete)
  - Tests: PARTIAL — Need execution
- **Blockers:** Test execution, deployment workflow
- **Dependencies:** Product-Management, Inventory-Management, Menu-Engineering

### 2.43 Sage Integration
- **Spec location:** .kiro/specs/sage-integration/
- **Business purpose:** Bidirectional integration with Sage accounting for invoice/payment sync and journal entries.
- **Requirements summary:**
  - OAuth flow for Sage connection
  - API client wrapper with rate limiting
  - Account mapping and journal entry services
  - Data sync and reconciliation
- **Design approach:** SageSyncService + SageClientService with adapter pattern.
- **Implementation status:**
  - Tasks complete: 2/99 (2%)
  - Backend: MINIMAL — sage.py (315 lines, 10 endpoints), sage_service exists, model (197 lines). Connection scaffolding only.
  - Frontend: PARTIAL — /sage/ page exists
  - Tests: NOT STARTED
- **Blockers:** Actual Sage API integration not implemented
- **Dependencies:** Invoice-Management, General-Ledger

### 2.44 Sales Reports
- **Spec location:** .kiro/specs/sales-reports/
- **Business purpose:** Sales reporting with metrics, trends, and performance analysis.
- **Implementation status:**
  - Tasks complete: 59/59 (100%)
  - Backend: COMPLETE — reports.py, sales_report_service
  - Frontend: COMPLETE — /reports/sales/ page
  - Tests: COMPLETE
- **Blockers:** None
- **Dependencies:** Order-Management, Product-Management

### 2.45 Shift Management
- **Spec location:** .kiro/specs/shift-management/
- **Business purpose:** PIN authentication, shift open/close, cash drawer management, and end-of-day reconciliation.
- **Implementation status:**
  - Tasks complete: 49/49 (100%)
  - Backend: COMPLETE — shifts.py, shift_service, pin_service, cashup_service
  - Frontend: COMPLETE — /shifts/ page
  - Tests: COMPLETE
- **Blockers:** None
- **Dependencies:** POS-Core, Staff-Management

### 2.46 Staff Management
- **Spec location:** .kiro/specs/staff-management/
- **Business purpose:** Employee records, roles, permissions, and organizational structure management.
- **Implementation status:**
  - Tasks complete: 69/69 (100%)
  - Backend: COMPLETE — users.py, roles.py, role_service
  - Frontend: COMPLETE — /team/ page
  - Tests: COMPLETE
- **Blockers:** None
- **Dependencies:** Authentication-Authorization, Department-Based-Team-Roles

### 2.47 Staff Profiles
- **Spec location:** .kiro/specs/staff-profiles/
- **Business purpose:** Detailed staff profiles with role assignments and permission management.
- **Implementation status:**
  - Tasks complete: 23/46 (50%)
  - Backend: COMPLETE — Implementation done, in users/roles routes
  - Frontend: COMPLETE — Profile views integrated
  - Tests: NOT STARTED — Test execution and deployment remaining
- **Blockers:** Test suite execution (7 tasks), deployment workflow (8 tasks)
- **Dependencies:** Staff-Management, Authentication-Authorization

### 2.48 Staff Reports
- **Spec location:** .kiro/specs/staff-reports/
- **Business purpose:** Staff performance, attendance, commission, and activity reporting.
- **Implementation status:**
  - Tasks complete: 82/82 (100%)
  - Backend: COMPLETE — staff_report_service, commission_service
  - Frontend: COMPLETE — /reports/staff/ page
  - Tests: COMPLETE
- **Blockers:** None
- **Dependencies:** Staff-Management, Time-Attendance, Shift-Management

### 2.49 Staff Targets & Performance
- **Spec location:** .kiro/specs/staff-targets/
- **Business purpose:** Sales target management, commission calculation, and performance leaderboards.
- **Requirements summary:**
  - Target CRUD with templates and commission rules/tiers
  - Commission calculation with incentive programs
  - Leaderboards and performance dashboards
  - Snapshot tracking for historical comparison
- **Design approach:** TargetService + CommissionService + LeaderboardService.
- **Implementation status:**
  - Tasks complete: 7/83 (8%)
  - Backend: PARTIAL — staff_targets.py (488 lines, 20 endpoints), staff_target_service, model (241 lines). More complete than 8% suggests.
  - Frontend: PARTIAL — /staff-targets/ page exists
  - Tests: NOT STARTED
- **Blockers:** Schema for commission rules/tiers, incentives, snapshots
- **Dependencies:** Staff-Management, Sales-Reports

### 2.50 Stock Control
- **Spec location:** .kiro/specs/stock-control/
- **Business purpose:** Real-time stock tracking with barcode, adjustments, receiving, waste reporting, and stock takes.
- **Requirements summary:**
  - Stock movements tracking with audit trail
  - SKU management with auto-generation and search
  - Waste tracking and categories
  - Purchase order receiving workflow
  - Bulk adjustments and supplier tracking
- **Design approach:** InventoryService + BarcodeService + StockTakeService.
- **Implementation status:**
  - Tasks complete: 15/97 (15%)
  - Backend: PARTIAL — stock_takes.py (242 lines, 9 endpoints), stock_take_service, model (238 lines)
  - Frontend: PARTIAL — /stock-takes/ page
  - Tests: NOT STARTED
- **Blockers:** Stock movement schema, SKU management, waste tracking, receiving workflow
- **Dependencies:** Inventory-Management, Product-Management, Month-End-Stock

### 2.51 Supplier Management
- **Spec location:** .kiro/specs/supplier-management/
- **Business purpose:** Supplier information, contacts, pricing, and ordering relationship management.
- **Implementation status:**
  - Tasks complete: 71/71 (100%)
  - Backend: COMPLETE — suppliers.py, supplier_service
  - Frontend: COMPLETE — Supplier list, detail, edit, new pages
  - Tests: COMPLETE
- **Blockers:** None
- **Dependencies:** Product-Management, Automated-Reordering

### 2.52 Table Management
- **Spec location:** .kiro/specs/table-management/
- **Business purpose:** Floor plan editing, table status tracking, reservations, and server section management.
- **Requirements summary:**
  - Floor plan with drag-and-drop, shapes, sections
  - Table status color-coding, timers, real-time updates
  - Reservation with conflict detection and waitlist
  - Capacity tracking
- **Design approach:** TableService + ReservationService + FloorPlanService.
- **Implementation status:**
  - Tasks complete: 9/76 (11%)
  - Backend: PARTIAL — tables.py (190 lines, 7 endpoints), table_service, floor_plan_service, reservation_service
  - Frontend: PARTIAL — /tables/ page
  - Mobile: PARTIAL — tables.tsx screen exists
  - Tests: NOT STARTED
- **Blockers:** Floor plan schema, reservation logic, real-time updates
- **Dependencies:** Order-Management, POS-Core

### 2.53 Tags & Categorization
- **Spec location:** .kiro/specs/tags-categorization/
- **Business purpose:** Flexible product organization through tags, smart collections, and AI-powered categorization.
- **Requirements summary:**
  - Tag categories with hierarchy and synonyms
  - Smart collections with rule engine
  - AI-powered tag suggestions
  - Bulk import/export
  - Analytics on tag usage
- **Design approach:** TagService + CategorizationService + AICategorizationService.
- **Implementation status:**
  - Tasks complete: 11/216 (5%)
  - Backend: MINIMAL — tags.py (261 lines, 13 endpoints), tag_service, model (202 lines). Lightweight CRUD only.
  - Frontend: PARTIAL — /tags/ page exists
  - Tests: NOT STARTED
- **Blockers:** Schema for smart collections, synonyms, analytics, import jobs
- **Dependencies:** Product-Management

### 2.54 Technical Debt Cleanup
- **Spec location:** .kiro/specs/technical-debt-cleanup/
- **Business purpose:** Systematic cleanup of 57 frontend lint warnings and 18 backend ruff errors.
- **Implementation status:**
  - Tasks complete: 38/46 (82%)
  - Backend: MOSTLY COMPLETE — Code quality improvements applied
  - Frontend: MOSTLY COMPLETE — Type safety improvements
  - Tests: N/A
- **Blockers:** 8 remaining cleanup tasks
- **Dependencies:** None

### 2.55 Time & Attendance
- **Spec location:** .kiro/specs/time-attendance/
- **Business purpose:** Staff time tracking with clock-in/out, breaks, overtime, and timesheet reporting.
- **Implementation status:**
  - Tasks complete: 60/60 (100%)
  - Backend: COMPLETE — time_entries.py, time_entry_service, time_tracking_service
  - Frontend: COMPLETE — /time-tracking/ page
  - Tests: COMPLETE
- **Blockers:** None
- **Dependencies:** Staff-Management, Shift-Management

### 2.56 WooCommerce Integration
- **Spec location:** .kiro/specs/woocommerce-integration/
- **Business purpose:** E-commerce integration syncing products, inventory, and orders with WooCommerce.
- **Requirements summary:**
  - REST API client with authentication
  - Product mapping and bidirectional sync
  - Stock level sync workflow
  - Category, variant, image sync
  - Order synchronization
- **Design approach:** WooCommerceService + ProductMapperService + SyncService.
- **Implementation status:**
  - Tasks complete: 2/71 (2%)
  - Backend: MINIMAL — woocommerce.py (100 lines, 5 endpoints), service exists, model (77 lines). Connection scaffolding only.
  - Frontend: NOT STARTED
  - Tests: NOT STARTED
- **Blockers:** Actual WooCommerce API integration not implemented
- **Dependencies:** Product-Management, Inventory-Management, Order-Management

### 2.57 Xero Integration
- **Spec location:** .kiro/specs/xero-integration/
- **Business purpose:** Bidirectional integration with Xero for invoice, payment, and customer sync with automated bookkeeping.
- **Requirements summary:**
  - OAuth 2.0 for Xero connection
  - Chart of accounts mapping
  - Invoice creation and sync
  - Tax handling and reconciliation
- **Design approach:** XeroService + XeroMappingService + XeroSyncService.
- **Implementation status:**
  - Tasks complete: 2/71 (2%)
  - Backend: MINIMAL — xero.py (100 lines, 5 endpoints), service exists, model (89 lines). Connection scaffolding only.
  - Frontend: NOT STARTED
  - Tests: NOT STARTED
- **Blockers:** Actual Xero API integration not implemented
- **Dependencies:** Invoice-Management, General-Ledger, Customer-Management

---

## 3. CURRENT STATE ASSESSMENT

### 3.1 What Is Fully Working (100% Complete)

| # | Feature | Tasks |
|---|---------|-------|
| 1 | Addons & Modifiers | 84/84 |
| 2 | Authentication & Authorization | 115/115 |
| 3 | Automated Reordering | 103/103 |
| 4 | Automated Report Emails | 107/107 |
| 5 | CRM Core | 63/63 ✅ Sprint 1 |
| 6 | Customer Management | 61/61 |
| 7 | Department-Based Team Roles | 64/64 ✅ Sprint 1 |
| 8 | Inventory Management | 49/49 |
| 9 | Invoice Management | 54/54 |
| 10 | Loyalty Programs | 69/69 ✅ Sprint 1 |
| 11 | Marketing Pages Redesign | 33/33 |
| 12 | Mobile POS Foundation | 115/115 ✅ Sprint 1 |
| 13 | Multi-Business Management | 64/64 |
| 14 | Offline-First Sync Engine | 94/94 ✅ Sprint 1 |
| 15 | Overdue Invoice Scheduler | 10/10 |
| 16 | Pricing Consistency & Guest AI Widget | 34/34 |
| 17 | Pricing Consistency Marketing | 112/112 ✅ Sprint 1 |
| 18 | Product Management | 65/65 |
| 19 | Recipe Management | 34/34 ✅ Sprint 1 |
| 20 | Sales Reports | 59/59 |
| 21 | Shift Management | 49/49 |
| 22 | Staff Management | 69/69 |
| 23 | Staff Profiles | 46/46 ✅ Sprint 1 |
| 24 | Staff Reports | 82/82 |
| 25 | Supplier Management | 71/71 |
| 26 | Technical Debt Cleanup | 46/46 ✅ Sprint 1 |
| 27 | Time & Attendance | 60/60 |

**27 features fully complete** (Sprint 1 closed 9 additional features)

### 3.2 What Is Partially Built (50-99%)

| # | Feature | Completion | What Exists | What's Missing |
|---|---------|-----------|-------------|----------------|
| 1 | Order Management | 93% (60/64) | Full order system | SlipApp SDK — deferred (SDK unavailable) |
| 2 | POS Core | 84% (95/113) | Full POS | AI scheduler jobs, PII redaction, metrics — Sprint 1 in progress |
| 3 | Customer Accounts | 68% (77/112) | Backend complete (2136-line service) | Statement PDF, email, collections — Sprint 1 in progress |
| 4 | Granular Permissions | 57% (53/92) | Service (564 lines) | Feature_flags migration — Sprint 1 in progress |

### 3.3 What Is Partially Built (1-49%)

| # | Feature | Completion | What Exists | What's Missing |
|---|---------|-----------|-------------|----------------|
| 1 | Integrated Payments | 45% (36/79) | Payment abstraction layer | Mobile payments, PCI compliance |
| 2 | Inventory Reports | 39% (44/111) | 9 endpoints, basic reports | Report config schema, turnover/wastage |
| 3 | Extended Reports | 28% (24/84) | 3 endpoints only | Most report types |
| 4 | Online Ordering | 28% (29/101) | 10 endpoints, basic order flow | Delivery zones, payments, customer app |
| 5 | Menu Engineering | 24% (14/58) | 21 endpoints, service | Schema, modifier UI, portions |
| 6 | Delivery Management | 24% (24/97) | 20+ endpoints, 6 services | Zone logic, driver mgmt, tracking |
| 7 | PMS Integration | 24% (57/233) | 14 endpoints, service | Adapter implementations, reconciliation |
| 8 | General Ledger | 22% (28/124) | 15+ endpoints, service | Auto-mapping, period management |
| 9 | Month-End Stock | 21% (21/100) | 9 endpoints, service | Period/snapshot schema, variance |
| 10 | Petty Cash | 20% (40/197) | 21 endpoints, service | Approval/receipt/reconciliation schema |
| 11 | Custom Dashboards | 17% (16/94) | 18 endpoints, 572-line service | Widget builder UI, real-time |
| 12 | Proforma Invoices | 16% (22/132) | 22 endpoints, services | Revision/approval schema, conversion |
| 13 | Stock Control | 15% (15/97) | 9 endpoints, service | Movement schema, SKU, waste |
| 14 | Bulk Operations | 14% (22/151) | 30+ endpoints, services | Frontend UI |
| 15 | Table Management | 11% (9/76) | 7 endpoints, services | Floor plan, reservations, real-time |
| 16 | Staff Targets | 8% (7/83) | 20 endpoints, model (241 lines) | Commission schema, incentives |
| 17 | Multi-Location Inventory | 7% (4/57) | Basic location model | Entire feature |
| 18 | Digital Signage | 6% (8/128) | 20+ endpoints, service | Display player, analytics |
| 19 | Tags & Categorization | 5% (11/216) | 13 endpoints, CRUD | Smart collections, AI suggestions |
| 20 | Customer Display | 4% (3/73) | 7 endpoints, service | WebSocket, display app, content |

### 3.4 What Is Spec-Only or Scaffolding-Only (0-2%)

| # | Feature | Completion | Code Status |
|---|---------|-----------|-------------|
| 1 | Multi-Location Management | 0% (0/87) | Generic location CRUD only |
| 2 | Partner Admin | 0% (0/219) | Scaffolding (15 endpoints, model) but 0% tasks marked |
| 3 | Sage Integration | 2% (2/99) | Connection scaffolding only |
| 4 | WooCommerce Integration | 2% (2/71) | Connection scaffolding only |
| 5 | Xero Integration | 2% (2/71) | Connection scaffolding only |

### 3.5 What Is Broken or Has Known Bugs

Based on recent git history and codebase analysis:
1. **AI system 404s and 500s** — Fixed in commit 2a9dc06 but may have regressions
2. **Session expiry modal** — Fixed in commit 70c03b9 (was showing raw RSC text)
3. **Merge conflict marker** — Was in laybys detail page (fixed in 901601a)
4. **SlipApp integration** — Referenced but not implemented (Order Management)
5. **Multi-location features** — Location model exists but no multi-location business logic

### 3.6 Technical Debt

1. **Backend model inconsistency:** Some models are very skeletal (department.py: 26 lines) while others are comprehensive
2. **API exposure gap:** Some services are comprehensive but API routes expose only a fraction (e.g., permissions: 564-line service → 1 endpoint)
3. **Frontend UI gap:** ~80% backend coverage but ~40% frontend coverage — many pages exist as stubs
4. **Test coverage gap:** Many features marked "complete" in tasks.md still have pending test execution
5. **Mobile-web feature parity:** Mobile has strong POS/loyalty/sync but web dashboard needs catching up on these

---

## 4. IMPLEMENTATION PRIORITY MATRIX

Score: 1-5 per dimension. Higher = more urgent/important.

| Feature | Business Value | User Impact | Tech Risk | Dependencies | Total | Order |
|---------|:---:|:---:|:---:|:---:|:---:|:---:|
| Technical Debt Cleanup | 3 | 2 | 1 | 5 | 11 | 1 |
| Pricing Consistency Marketing | 2 | 2 | 1 | 5 | 10 | 2 |
| Order Management (SlipApp) | 4 | 4 | 2 | 5 | 15 | 3 |
| Layby Management | 4 | 4 | 1 | 5 | 14 | 4 |
| CRM Core | 4 | 3 | 1 | 5 | 13 | 5 |
| Staff Profiles | 3 | 2 | 1 | 5 | 11 | 6 |
| Recipe Management | 3 | 3 | 1 | 5 | 12 | 7 |
| Loyalty Programs | 4 | 4 | 1 | 5 | 14 | 8 |
| Mobile POS Foundation | 5 | 5 | 2 | 4 | 16 | 9 |
| POS Core | 5 | 5 | 2 | 4 | 16 | 10 |
| Offline-First Sync Engine | 5 | 5 | 3 | 4 | 17 | 11 |
| Customer Accounts | 4 | 3 | 2 | 4 | 13 | 12 |
| Dept-Based Team Roles | 3 | 3 | 2 | 4 | 12 | 13 |
| Granular Permissions | 4 | 4 | 3 | 4 | 15 | 14 |
| Integrated Payments | 5 | 5 | 4 | 3 | 17 | 15 |
| Stock Control | 4 | 4 | 3 | 3 | 14 | 16 |
| Bulk Operations | 3 | 3 | 2 | 4 | 12 | 17 |
| Inventory Reports | 3 | 3 | 2 | 3 | 11 | 18 |
| Staff Targets | 3 | 3 | 2 | 3 | 11 | 19 |
| Menu Engineering | 4 | 4 | 3 | 3 | 14 | 20 |
| Table Management | 4 | 4 | 3 | 3 | 14 | 21 |
| Month-End Stock | 3 | 3 | 3 | 3 | 12 | 22 |
| Custom Dashboards | 3 | 3 | 3 | 3 | 12 | 23 |
| Proforma Invoices | 3 | 3 | 2 | 3 | 11 | 24 |
| Extended Reports | 3 | 3 | 2 | 3 | 11 | 25 |
| General Ledger | 3 | 2 | 3 | 3 | 11 | 26 |
| Petty Cash | 3 | 2 | 2 | 3 | 10 | 27 |
| Delivery Management | 3 | 3 | 4 | 2 | 12 | 28 |
| Online Ordering | 4 | 3 | 4 | 2 | 13 | 29 |
| Multi-Location Management | 3 | 2 | 4 | 2 | 11 | 30 |
| Multi-Location Inventory | 3 | 2 | 3 | 2 | 10 | 31 |
| Customer Display | 2 | 2 | 3 | 2 | 9 | 32 |
| Digital Signage | 2 | 1 | 3 | 2 | 8 | 33 |
| Tags & Categorization | 2 | 2 | 2 | 3 | 9 | 34 |
| PMS Integration | 2 | 1 | 4 | 1 | 8 | 35 |
| Partner Admin | 2 | 1 | 5 | 1 | 9 | 36 |
| Sage Integration | 2 | 1 | 4 | 1 | 8 | 37 |
| WooCommerce Integration | 2 | 1 | 4 | 1 | 8 | 38 |
| Xero Integration | 2 | 1 | 4 | 1 | 8 | 39 |

### 4.1 Critical Path

```
Authentication → Multi-Business → Staff Management → Dept Roles → Staff Profiles
                                                   → Granular Permissions

Product Management → Inventory Management → Stock Control → Month-End Stock
                                          → Multi-Location Inventory → Multi-Location Mgmt
                                          → Inventory Reports
                   → Menu Engineering → Addons & Modifiers

POS Core → Order Management → Delivery Management → Online Ordering
         → Integrated Payments → Customer Accounts
         → Layby Management

Invoice Management → General Ledger → Sage/Xero Integration
                   → Proforma Invoices
```

### 4.2 Can Be Built in Parallel

These feature groups have no dependencies on each other:

- **Group A (Hospitality):** Menu Engineering, Table Management, Recipe Management, Digital Signage
- **Group B (Reporting):** Extended Reports, Inventory Reports, Custom Dashboards, Staff Targets
- **Group C (Operations):** Bulk Operations, Petty Cash, Month-End Stock
- **Group D (Integration):** Sage, Xero, WooCommerce (all independent of each other)
- **Group E (Advanced):** Partner Admin, Customer Display, PMS Integration, Online Ordering

---

## 5. IMPLEMENTATION ROADMAP

### Sprint 1 — Stabilization & Near-Complete Features (Immediate)

**Goal:** Close out all features at 50%+ completion. Fix remaining tests and deployment gaps.

**Features:**
- **Technical Debt Cleanup** (82%→100%): Complete 8 remaining cleanup tasks
- **Pricing Consistency Marketing** (99%→100%): Complete 1 remaining task
- **Order Management** (93%→100%): Implement SlipApp SDK integration (4 tasks)
- **Layby Management** (90%→100%): Stock reservation link + integration tests (7 tasks)
- **CRM Core** (87%→100%): Test execution + deployment (8 tasks)
- **Offline-First Sync Engine** (87%→100%): E2E integration tests (12 tasks)
- **Mobile POS Foundation** (86%→100%): Build verification + tests + deployment (15 tasks)
- **POS Core** (84%→100%): E2E testing + offline tests (18 tasks)
- **Recipe Management** (76%→100%): Test execution + deployment (8 tasks)
- **Customer Accounts** (68%→100%): Statement PDF, email, collections UI, tests (35 tasks)
- **Dept-Based Team Roles** (65%→100%): Model expansion, endpoints, UI (22 tasks)
- **Loyalty Programs** (63%→100%): Test execution + deployment (25 tasks)
- **Granular Permissions** (57%→100%): API exposure, migration, tests (39 tasks)
- **Staff Profiles** (50%→100%): Test execution + deployment (23 tasks)

**Acceptance criteria for Sprint 1:**
- [ ] All 18 fully-complete features remain green (no regressions)
- [ ] 14 additional features reach 100% task completion
- [ ] All test suites pass
- [ ] Zero lint/type errors across all packages
- [ ] Deployed and verified on bizpilotpro.app

### Sprint 2 — Core Business Operations

**Goal:** Complete inventory, payments, and stock features that enable daily business operations.

**Features:**
- **Integrated Payments** (45%→100%): Payment service core, mobile payments, PCI compliance (43 tasks)
- **Stock Control** (15%→100%): Movement schema, SKU management, waste, receiving (82 tasks)
- **Bulk Operations** (14%→100%): Frontend UI, validation, import/export (129 tasks)
- **Inventory Reports** (39%→100%): Report services, caching, frontend (67 tasks)
- **Staff Targets** (8%→100%): Commission schema, leaderboards, dashboards (76 tasks)

**Acceptance criteria:**
- [ ] All payment methods functional in POS
- [ ] Stock control with full audit trail
- [ ] Bulk import/export working for products and inventory
- [ ] Inventory reports accessible from dashboard
- [ ] Staff targets and commission tracking operational

### Sprint 3 — Hospitality & Advanced POS

**Goal:** Complete restaurant/hospitality-specific features.

**Features:**
- **Menu Engineering** (24%→100%): Schema, modifiers, portions, recipes (44 tasks)
- **Table Management** (11%→100%): Floor plan, reservations, real-time (67 tasks)
- **Month-End Stock** (21%→100%): Period closing, variance analysis (79 tasks)
- **Extended Reports** (28%→100%): All report types (60 tasks)
- **Custom Dashboards** (17%→100%): Widget builder, real-time updates (78 tasks)

**Acceptance criteria:**
- [ ] Menu engineering with modifiers and portions for restaurants
- [ ] Table management with floor plan and reservations
- [ ] Month-end stock procedures fully automated
- [ ] Extended reports covering all business analytics
- [ ] Custom dashboards with drag-and-drop widgets

### Sprint 4 — Accounting & Quoting

**Goal:** Complete financial management features.

**Features:**
- **General Ledger** (22%→100%): Chart of accounts, journal entries, reports (96 tasks)
- **Proforma Invoices** (16%→100%): Quotes, revisions, approvals, conversion (110 tasks)
- **Petty Cash** (20%→100%): Full petty cash workflow (157 tasks)

**Acceptance criteria:**
- [ ] Double-entry ledger operational
- [ ] Proforma invoices with conversion to sales
- [ ] Petty cash with approval workflow

### Sprint 5 — Delivery & Online Ordering

**Goal:** Complete order fulfillment and customer-facing ordering.

**Features:**
- **Delivery Management** (24%→100%): Zones, drivers, tracking (73 tasks)
- **Online Ordering** (28%→100%): Customer app, payments, tracking (72 tasks)

**Acceptance criteria:**
- [ ] Delivery zone management and fee calculation
- [ ] Driver assignment and real-time tracking
- [ ] Online ordering portal functional

### Sprint 6 — Multi-Location & Advanced Features

**Goal:** Multi-location support and advanced categorization.

**Features:**
- **Multi-Location Management** (0%→100%): Full location management (87 tasks)
- **Multi-Location Inventory** (7%→100%): Cross-location stock (53 tasks)
- **Tags & Categorization** (5%→100%): Smart collections, AI suggestions (205 tasks)
- **Customer Display** (4%→100%): WebSocket display app (70 tasks)

**Acceptance criteria:**
- [ ] Multi-location with consolidated reporting
- [ ] Stock transfers between locations
- [ ] Product tagging with smart collections
- [ ] Customer-facing display operational

### Sprint 7 — Integrations

**Goal:** Third-party accounting and e-commerce integrations.

**Features:**
- **Sage Integration** (2%→100%): Full Sage accounting sync (97 tasks)
- **Xero Integration** (2%→100%): Full Xero accounting sync (69 tasks)
- **WooCommerce Integration** (2%→100%): Full e-commerce sync (69 tasks)
- **PMS Integration** (24%→100%): Hotel PMS adapters (35 tasks)

**Acceptance criteria:**
- [ ] Sage sync operational
- [ ] Xero sync operational
- [ ] WooCommerce product/order sync
- [ ] PMS room charging functional

### Sprint 8 — Enterprise & Polish

**Goal:** Enterprise features and final polish.

**Features:**
- **Partner Admin** (0%→100%): Full partner administration (219 tasks)
- **Digital Signage** (6%→100%): Display management system (120 tasks)

**Acceptance criteria:**
- [ ] Partner admin with white-labeling
- [ ] Digital signage with content scheduling
- [ ] All 57 specs at 100% completion
- [ ] Full test coverage
- [ ] Production stable on bizpilotpro.app

---

## 6. FEATURE-BY-FEATURE IMPLEMENTATION GUIDE

### 6.1 Technical Debt Cleanup — Implementation Guide

#### What the spec requires
Complete remaining 8 lint/type cleanup tasks across frontend and backend.

#### Current state of the code
38/46 tasks complete. Well-structured codebase with good separation of concerns.

#### Implementation steps
1. Run `pnpm lint` and fix remaining warnings
2. Run `pnpm mobile:typecheck` and fix type errors
3. Run `cd backend && ruff check .` and fix remaining issues
4. Verify no regressions with `pnpm test`

#### Tests to write
None — this is cleanup of existing code.

#### Definition of done
- [ ] `pnpm lint` returns zero warnings
- [ ] `ruff check .` returns zero errors
- [ ] All existing tests pass

---

### 6.2 Order Management (SlipApp) — Implementation Guide

#### What the spec requires
Integrate SlipApp SDK for order printing: SDK integration, printer routing, kitchen tickets, reprint support.

#### Current state of the code
60/64 tasks complete. Full order management system operational. Missing only SlipApp printing.

#### Backend implementation steps
1. Add SlipApp SDK dependency to backend requirements
2. Create `backend/app/services/slipapp_service.py` with printer connection, ticket formatting, routing logic
3. Add print endpoint to `backend/app/api/orders.py` or `order_management.py`
4. Implement kitchen ticket template with course grouping and modifier display
5. Add reprint support with audit logging

#### Frontend implementation steps
1. Add print button to order detail page at `frontend/src/app/(dashboard)/orders/[orderId]/page.tsx`
2. Add printer configuration to settings at `frontend/src/app/(dashboard)/settings/page.tsx`
3. Handle print status feedback (success/failure/offline)

#### Tests to write
- Unit test for ticket formatting service
- Integration test for print routing logic
- E2E test for complete print flow

#### Definition of done
- [ ] SlipApp SDK integrated and connecting to printers
- [ ] Kitchen tickets print with correct routing
- [ ] Reprint functionality works with audit trail
- [ ] All tests pass

---

### 6.3 Layby Management — Implementation Guide

#### What the spec requires
Complete stock reservation service link, layby report service, frontend API client, and integration testing.

#### Current state of the code
69/76 tasks. Core layby system complete. Backend services comprehensive (layby_service, layby_notification_service, layby_report_service, layby_stock_service).

#### Implementation steps
1. Verify `backend/app/services/layby_stock_service.py` correctly reserves inventory on layby creation
2. Verify stock is released on layby cancellation
3. Ensure layby report service generates accurate reports
4. Write integration tests covering: create layby → make payments → complete/cancel → verify stock
5. Run full test suite

#### Tests to write
- Integration: layby creation with stock reservation
- Integration: layby cancellation with stock release
- Integration: payment schedule adherence
- E2E: complete layby lifecycle

#### Definition of done
- [ ] Stock correctly reserved/released
- [ ] Reports generate accurate data
- [ ] All integration tests pass

---

### 6.4 CRM Core — Implementation Guide

#### What the spec requires
Execute test suites and complete deployment workflow.

#### Current state of the code
55/63 tasks. Core CRM functionality complete. Missing test execution, build verification, deployment.

#### Implementation steps
1. Run `cd backend && python -m pytest app/tests/test_crm_service.py -v`
2. Fix any test failures
3. Verify frontend CRM page renders: `pnpm frontend:dev` and navigate to /crm
4. Run `pnpm frontend:test` for any CRM-related tests
5. Verify build: `pnpm lint`

#### Definition of done
- [ ] Backend CRM tests pass
- [ ] Frontend renders without errors
- [ ] Lint clean

---

### 6.5 Offline-First Sync Engine — Implementation Guide

#### What the spec requires
Complete E2E integration tests: offline→online sync, conflict resolution, multi-device sync, crash recovery.

#### Current state of the code
82/94 tasks. Full sync infrastructure in place — WatermelonDB schema (25k lines), sync services, conflict resolver.

#### Implementation steps
1. Create test file `mobile/tests/sync-e2e.test.ts`
2. Test offline→online: create records offline, simulate connectivity, verify sync
3. Test conflict resolution: modify same record on two devices, verify resolution strategy
4. Test multi-device: sync from device A, pull on device B, verify consistency
5. Test crash recovery: interrupt sync mid-batch, verify resume and data integrity

#### Tests to write
- E2E: offline record creation → connectivity → server sync
- E2E: conflict detection and resolution (last-write-wins / merge)
- E2E: multi-device consistency
- E2E: sync resumption after crash/interruption

#### Definition of done
- [ ] All 4 E2E sync scenarios pass
- [ ] No data loss in any scenario
- [ ] Sync resumes correctly after interruption

---

### 6.6 Customer Accounts — Implementation Guide

#### What the spec requires
PDF statement generation, email delivery, scheduled generation, collections service, frontend UI, testing.

#### Current state of the code
77/112 tasks. Backend is comprehensive (2136-line service, 20+ endpoints). Missing statement delivery and collections UI.

#### Backend implementation steps
1. Verify PDF generation in `backend/app/services/customer_account_service.py` — look for statement_pdf method
2. If missing, add PDF statement generation using existing pdf_service patterns
3. Add email delivery endpoint using email_service
4. Add scheduled statement generation as APScheduler job in `backend/app/scheduler/`

#### Frontend implementation steps
1. Enhance `frontend/src/app/(dashboard)/customer-accounts/page.tsx` with:
   - Statement generation and download button
   - Email statement action
   - Collections tracking view
   - DSO (Days Sales Outstanding) display
2. Add AR aging chart component

#### Tests to write
- Unit: statement PDF generation
- Unit: payment allocation (oldest first)
- Integration: credit limit validation on charge
- Integration: collections workflow

#### Definition of done
- [ ] PDF statements generate correctly
- [ ] Email delivery works
- [ ] Collections tracking UI functional
- [ ] All tests pass

---

### 6.7 Granular Permissions & Subscription — Implementation Guide

#### What the spec requires
Expose full permission API, migrate from old schema, property-based and E2E tests.

#### Current state of the code
53/92 tasks. permission_service.py (564 lines) is comprehensive. Only 1 API endpoint exposed (GET /permissions/me).

#### Backend implementation steps
1. Expand `backend/app/api/permissions.py` to expose more of the service:
   - GET /permissions/features — list available features for current tier
   - GET /permissions/devices — device limit status
   - POST /permissions/check — batch permission check
   - Admin: PUT /permissions/overrides — manage feature overrides
2. Create data migration script for old permission schema
3. Verify Redis caching (<10ms permission checks)

#### Frontend implementation steps
1. Verify `usePermissions` hook exists and works correctly
2. Add FeatureGate component if missing — wraps features with tier check
3. Add LockedFeatureOverlay for features above current tier
4. Add subscription status display in settings

#### Tests to write
- Unit: permission check with Redis cache hit/miss
- Unit: tier-based feature gating
- Integration: device limit enforcement
- E2E: upgrade tier → immediate feature access

#### Definition of done
- [ ] Full permission API exposed
- [ ] Redis cache operational
- [ ] Feature gating works on frontend
- [ ] Migration from old schema complete

---

### 6.8 Integrated Payments — Implementation Guide

#### What the spec requires
Complete payment service core, mobile payment implementations, PCI-DSS compliance.

#### Current state of the code
36/79 tasks. Backend has payment abstraction (290 lines routes, 439 lines service). Mobile has PaymentService.ts + EFTService.ts.

#### Backend implementation steps
1. Verify `backend/app/services/payment_service.py` handles: cash, card (Yoco), QR (SnapScan), EFT
2. Add split payment support if missing
3. Add refund processing endpoint
4. Add payment reconciliation service
5. Implement PCI-compliant token storage (never store raw card data)

#### Frontend implementation steps
1. Enhance payment modal in POS flow
2. Add payment method selection UI
3. Add split payment interface
4. Add payment history/reconciliation page

#### Mobile implementation steps
1. Verify Yoco SDK integration in EFTService.ts
2. Add Apple Pay support (iOS)
3. Add Google Pay support (Android)
4. Add payment receipt generation

#### Tests to write
- Unit: payment calculation (change, split amounts)
- Integration: Yoco payment flow (sandbox)
- Integration: SnapScan QR flow (sandbox)
- Unit: PCI compliance (no raw card data in logs/DB)

#### Definition of done
- [ ] All payment methods functional
- [ ] Split payments work
- [ ] Refunds process correctly
- [ ] PCI-compliant storage
- [ ] Mobile payments operational

---

### 6.9 Stock Control — Implementation Guide

#### What the spec requires
Real-time stock tracking with barcode, adjustments, receiving, waste reporting, and stock takes.

#### Current state of the code
15/97 tasks. stock_takes.py (242 lines, 9 endpoints), stock_take_service, model (238 lines). Solid stock taking foundation.

#### Backend implementation steps
1. Create stock_movements table migration (type, product_id, quantity, reference, timestamp, user_id)
2. Add SKU fields to product model if not present; implement auto-generation service
3. Create `backend/app/services/waste_service.py` for waste tracking and categories
4. Enhance `backend/app/api/stock_takes.py` with:
   - Bulk adjustment endpoint
   - Waste recording endpoint
   - SKU search endpoint
5. Add receiving workflow connecting to purchase orders

#### Frontend implementation steps
1. Enhance /stock-takes/ page with:
   - Barcode scanner component
   - SKU search and lookup
   - Waste logging form with reason categories
   - Bulk adjustment interface
2. Add stock movement history view

#### Tests to write
- Unit: stock movement recording
- Unit: SKU auto-generation
- Integration: sale → stock deduction
- Integration: purchase receiving → stock increase
- Unit: waste tracking with value calculation

#### Definition of done
- [ ] Stock movements tracked with full audit trail
- [ ] SKU management with auto-generation
- [ ] Waste tracking operational
- [ ] Receiving workflow connected to POs
- [ ] All tests pass

---

### 6.10 Menu Engineering — Implementation Guide

#### What the spec requires
Menu items with modifiers, portions, recipes, pricing strategies, and kitchen routing.

#### Current state of the code
14/58 tasks. Backend has 573 lines/21 endpoints including mix/margin analysis. menu_service exists.

#### Backend implementation steps
1. Create/verify menu_items table with: description, images, prices (dine-in/takeaway), PLU codes
2. Create portion sizes table linked to menu items
3. Link recipes to menu items/portions for cost calculation
4. Add food cost percentage alert service
5. Add time-based menu category availability

#### Frontend implementation steps
1. Build menu builder UI at /menu-engineering/:
   - Menu item CRUD with image upload
   - Modifier group configuration (reuse from addons-modifiers)
   - Portion size management
   - Recipe cost display
   - Mix/margin analysis charts
2. Add menu category management with time-based availability

#### Tests to write
- Unit: food cost calculation
- Unit: menu item pricing across portions
- Integration: menu item with modifiers
- Integration: time-based availability

#### Definition of done
- [ ] Menu items with modifiers and portions
- [ ] Recipe costing integrated
- [ ] Mix/margin analysis functional
- [ ] Time-based availability working

---

### 6.11 Table Management — Implementation Guide

#### What the spec requires
Floor plan editing, table status tracking, reservations, and server sections.

#### Current state of the code
9/76 tasks. tables.py (190 lines, 7 endpoints), table_service, floor_plan_service, reservation_service exist.

#### Backend implementation steps
1. Create floor_plans table (business_id, name, layout_json, sections)
2. Enhance restaurant_table model with section, shape, position, capacity
3. Add reservation model with conflict detection
4. Add waitlist management
5. Add WebSocket endpoint for real-time table status updates

#### Frontend implementation steps
1. Build floor plan editor at /tables/:
   - Canvas-based drag-and-drop table placement
   - Table shape selection (round, square, rectangle)
   - Section grouping with color coding
2. Add reservation calendar with:
   - Time slot selection
   - Party size validation
   - Conflict detection display
3. Add waitlist management panel

#### Tests to write
- Unit: reservation conflict detection
- Unit: capacity calculation
- Integration: table status updates via WebSocket
- E2E: reserve → seat → order → clear

#### Definition of done
- [ ] Floor plan editor functional
- [ ] Table status tracking with real-time updates
- [ ] Reservations with conflict detection
- [ ] Waitlist management operational

---

### 6.12 General Ledger — Implementation Guide

#### What the spec requires
Double-entry accounting: chart of accounts, journal entries, auto-mapping POS transactions, financial reports.

#### Current state of the code
28/124 tasks. general_ledger.py (410 lines, 15+ endpoints), general_ledger_service exists.

#### Backend implementation steps
1. Create/verify account_mappings migration (category → account, payment_method → account)
2. Create period management (open/close fiscal periods)
3. Create account_balances table with running balances
4. Implement auto-mapping rules for daily sales, payments, inventory changes
5. Add recurring journal entry service
6. Generate trial balance, income statement, balance sheet reports

#### Frontend implementation steps
1. Enhance /general-ledger/ page:
   - Chart of accounts tree view with CRUD
   - Journal entry form with double-entry validation (debits = credits)
   - Trial balance report
   - Income statement and balance sheet views
   - Period management (open/close)
2. Add account mapping configuration page

#### Tests to write
- Unit: double-entry validation (debits = credits)
- Unit: trial balance calculation
- Integration: POS sale → auto journal entry
- Integration: period closing with balance snapshot

#### Definition of done
- [ ] Chart of accounts with hierarchy
- [ ] Journal entries with double-entry enforcement
- [ ] Auto-mapping from POS transactions
- [ ] Financial reports generating correctly
- [ ] Period management operational

---

### 6.13 Multi-Location Management — Implementation Guide

#### What the spec requires
Location hierarchies, central dashboard, consolidated reports, cross-location operations, location-based access.

#### Current state of the code
0/87 tasks. locations.py has generic CRUD (397 lines, 14 endpoints) but no multi-location business logic.

#### Backend implementation steps
1. Create location_hierarchy table (parent_location_id, region, district)
2. Create location_settings table (per-location configuration)
3. Create location_user_access table (user → location permissions)
4. Build ConsolidatedReportingService for cross-location sales aggregation
5. Add location-based data filtering middleware
6. Add cross-location staff transfer endpoints
7. Add central pricing update endpoint (push price changes to all locations)

#### Frontend implementation steps
1. Enhance /locations/ page:
   - Location hierarchy tree view
   - Location creation with region/district assignment
   - Per-location settings
2. Build consolidated dashboard:
   - Cross-location sales comparison
   - Location performance ranking
   - Drill-down from consolidated to single-location
3. Add location switcher in navigation

#### Tests to write
- Unit: location hierarchy traversal
- Unit: consolidated report aggregation
- Integration: location-based access control
- Integration: cross-location stock transfer
- E2E: multi-location user workflow

#### Definition of done
- [ ] Location hierarchy management
- [ ] Consolidated reporting across locations
- [ ] Location-based access control
- [ ] Cross-location operations functional

---

## 7. CROSS-CUTTING CONCERNS

### 7.1 Authentication and Authorization

Every new feature must:
- Require authentication via `Depends(get_current_user)` on all endpoints
- Check business membership via `X-Business-ID` header
- Use RBAC decorators from `app/core/rbac.py` for role-based access
- Check subscription tier via permission_service for gated features

### 7.2 Error Handling Standards

**Backend:**
- Use `HTTPException` with appropriate status codes (400, 401, 403, 404, 422, 500)
- Never expose internal error details to clients
- Log errors with `structlog` including request_id from middleware
- Return consistent error shape: `{"detail": "message"}`

**Frontend:**
- Use try/catch around all API calls
- Show toast notifications for user-facing errors
- Handle 401 globally in Axios interceptor (redirect to login)
- Handle 403 with "permission denied" message

### 7.3 Testing Standards

Every feature requires:
- **Backend unit tests**: Test service layer logic in isolation
- **Backend integration tests**: Test API endpoints with test database
- **Frontend component tests**: Test key interactive components
- **Coverage**: Backend must maintain >45% coverage

### 7.4 Code Quality Standards

- **File size**: No file over 500 lines without good reason; refactor into service modules
- **Naming**: snake_case for Python, camelCase for TypeScript/JavaScript
- **Imports**: Use absolute imports; no circular dependencies
- **Types**: All TypeScript must pass strict type checking
- **Lint**: Zero warnings from ESLint (frontend) and ruff (backend)

### 7.5 Deployment Checklist

Before merging any feature to main:
1. `pnpm lint` — zero errors/warnings
2. `pnpm test` — all tests pass
3. `pnpm mobile:typecheck` — zero type errors (if mobile changed)
4. `cd backend && python -m pytest` — all pass, >45% coverage
5. PR review with clear description
6. CI checks green
7. After merge: poll `doctl` until Phase=ACTIVE Progress=100
8. Verify feature on bizpilotpro.app

---

## 8. RISK REGISTER

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| SlipApp SDK unavailable or undocumented | Medium | High | Research SDK early; have fallback print solution |
| PCI compliance requirements for payment processing | High | High | Use tokenized payment providers; never store card data |
| WatermelonDB sync conflicts with complex data | Medium | High | Thorough conflict resolution testing; server-wins default |
| Multi-location data isolation failure | Medium | Critical | Row-level security; comprehensive access control tests |
| Third-party API changes (Sage, Xero, WooCommerce) | Medium | Medium | Use adapter pattern; version-pin API clients |
| Frontend performance with large datasets | Medium | Medium | Implement pagination, virtualized lists, lazy loading |
| Redis cache invalidation issues | Low | High | TTL-based expiry; cache-aside pattern; monitoring |
| Partner white-labeling CSS/theming complexity | High | Medium | Use CSS variables; test across all theme variations |
| Mobile build failures across iOS/Android | Medium | Medium | Regular CI builds; pin Expo SDK version |
| Database migration conflicts between features | Medium | High | Coordinate migrations; use sequential numbering |

---

## 9. OPEN QUESTIONS

1. **SlipApp SDK access:** Is the SlipApp SDK available? What's the authentication method? Do we have a sandbox environment?
   - **Why it matters:** Blocks Order Management completion
   - **Who can answer:** SlipApp partnership/vendor team

2. **Sage API credentials:** Do we have a Sage developer account with API keys for South African Sage products?
   - **Why it matters:** Blocks Sage Integration
   - **Who can answer:** Sage partnership team

3. **Xero OAuth app registration:** Is a Xero app registered for the OAuth flow?
   - **Why it matters:** Blocks Xero Integration
   - **Who can answer:** Xero partnership team

4. **WooCommerce test store:** Is there a test WooCommerce instance for integration development?
   - **Why it matters:** Blocks WooCommerce Integration
   - **Who can answer:** Product/DevOps team

5. **PMS vendor access:** Do we have sandbox access to Opera, Protel, Mews, or Cloudbeds APIs?
   - **Why it matters:** Blocks PMS Integration
   - **Who can answer:** Hospitality partnership team

6. **Apple Pay / Google Pay merchant accounts:** Are merchant accounts set up for mobile payments?
   - **Why it matters:** Blocks mobile payment in Integrated Payments
   - **Who can answer:** Finance/payments team

7. **Partner Admin scope:** Is Partner Admin a current business priority or a future roadmap item? (219 tasks is massive)
   - **Why it matters:** Affects sprint planning and resource allocation
   - **Who can answer:** Product Owner

8. **Digital Signage hardware:** What display hardware are target customers using?
   - **Why it matters:** Affects display player implementation approach
   - **Who can answer:** Product/Sales team

---

## 10. IMPLEMENTATION SCHEDULE

| Week | Sprint | Features | Expected Outcome |
|------|--------|----------|-----------------|
| 1-2 | Sprint 1a | Tech Debt, Pricing Marketing, Order Mgmt (SlipApp), Layby, CRM Core, Staff Profiles | 6 features at 100% |
| 3-4 | Sprint 1b | Offline Sync, Mobile POS, POS Core, Recipe Mgmt, Customer Accounts, Dept Roles, Loyalty, Granular Permissions | 8 more features at 100%. Total: 32/57 complete |
| 5-6 | Sprint 2 | Integrated Payments, Stock Control, Bulk Operations | Core business ops functional |
| 7-8 | Sprint 2b | Inventory Reports, Staff Targets | Reporting complete |
| 9-10 | Sprint 3 | Menu Engineering, Table Management, Month-End Stock | Hospitality features |
| 11-12 | Sprint 3b | Extended Reports, Custom Dashboards | Advanced analytics |
| 13-14 | Sprint 4 | General Ledger, Proforma Invoices, Petty Cash | Financial management |
| 15-16 | Sprint 5 | Delivery Management, Online Ordering | Fulfillment features |
| 17-18 | Sprint 6 | Multi-Location Mgmt, Multi-Location Inventory, Tags, Customer Display | Multi-location + UX |
| 19-20 | Sprint 7 | Sage, Xero, WooCommerce, PMS Integration | Third-party integrations |
| 21-22 | Sprint 8 | Partner Admin, Digital Signage | Enterprise features |

**Total estimated weeks to spec completion: 22 weeks**

**Summary Statistics:**
- 57 total spec features
- 18 features at 100% (complete)
- 39 features remaining
- 2,623 remaining tasks across all incomplete features
- 2,484 total tasks completed out of 5,107 total (48.6% overall)
