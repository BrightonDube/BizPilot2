# BizPilot Feature Roadmap

## Overview

This roadmap outlines the comprehensive feature development plan for BizPilot, a full-featured POS/ERP system. The features are organized into phases based on dependencies and business value. This document reflects the current state of the application as of January 2026.

**Architecture:**
- **Backend:** FastAPI (Python 3.10+) - Shared REST API for all clients
- **Web Application:** Next.js 16+ (App Router) - Comprehensive management dashboard
- **Mobile/POS Application:** React Native/Expo (Planned) - POS transactions, simple inventory

**Deployment:**
- **Platform:** DigitalOcean App Platform
- **Database:** PostgreSQL (managed)
- **Branch Strategy:** `main` for production, `dev` for staging

**Status Legend:**
- ✅ **COMPLETED** - Feature is fully implemented, tested, and deployed
- 🚧 **IN PROGRESS** - Feature is partially implemented
- 📋 **PLANNED** - Feature is planned but not started
- 🔄 **NEEDS SPEC** - Feature exists but needs formal documentation

**Last Updated:** January 20, 2026

---

## Phase -1: Already Built Features (Pre-Roadmap)

These features were built before the formal roadmap was established and need to be documented with specs.

### ✅ Core Foundation (COMPLETED)
- **Authentication & Authorization** - 🔄 NEEDS SPEC
  - JWT-based authentication
  - Role-based access control (RBAC)
  - Permission system with granular controls
  - Session management
  - OAuth integration (Google)
  
- **Multi-Business Management** - 🔄 NEEDS SPEC
  - Organization and business entities
  - Multi-tenant architecture
  - Business settings and configuration
  - Business user management with roles
  
- **Department Management** - ✅ HAS SPEC: `department-based-team-roles`
  - Department CRUD operations
  - Team member assignment to departments
  - Department filtering and search
  - Default department creation

### ✅ Product & Inventory (COMPLETED)
- **Product Management** - 🔄 NEEDS SPEC
  - Product CRUD with categories
  - Product status management
  - Product images and descriptions
  - Product suppliers relationship
  - Product ingredients/recipes
  - Favorite products
  - Excel import/export
  
- **Inventory Management** - 🔄 NEEDS SPEC
  - Real-time inventory tracking
  - Inventory transactions (in/out/adjustment)
  - Stock levels by product
  - Excel import/export
  
- **Supplier Management** - 🔄 NEEDS SPEC
  - Supplier CRUD operations
  - Supplier contact information
  - Product-supplier relationships
  - Supplier payment tracking

### ✅ Sales & Orders (COMPLETED)
- **Order Management** - 🔄 NEEDS SPEC
  - Order creation and tracking
  - Order items with quantities
  - Order direction (inbound/outbound)
  - Order status management
  - Payment status tracking
  
- **Invoice Management** - 🔄 NEEDS SPEC
  - Invoice generation
  - Invoice items
  - Invoice types (sales, purchase, proforma)
  - Invoice status tracking
  - Payment tracking
  - Invoice payment service
  - Overdue invoice scheduler
  
- **Layby Management** - ✅ HAS SPEC: `layby-management`
  - Layby creation and tracking (backend complete)
  - Payment schedules
  - Layby payments
  - Stock reservations
  - Layby audit trail
  - Layby notifications
  - Layby configuration

### ✅ Customer & Staff (COMPLETED)
- **Customer Management** - 🔄 NEEDS SPEC
  - Customer profiles
  - Customer types
  - Contact information
  - Purchase history
  
- **Staff Management** - 🔄 NEEDS SPEC
  - User profiles
  - Business user roles
  - Department assignments
  - Activity logging
  
- **Time & Attendance** - 🔄 NEEDS SPEC
  - Time entry tracking
  - Clock in/out
  - Time entry types (work, break, overtime)
  - Time entry status management
  - Time tracking service

### ✅ Reporting & Analytics (COMPLETED)
- **Reports System** - 🔄 NEEDS SPEC
  - Sales reports
  - Inventory reports
  - Staff reports
  - Dashboard analytics
  - Report generation service

### ✅ Production & Manufacturing (COMPLETED)
- **Production Orders** - 🔄 NEEDS SPEC
  - Production order creation
  - Production order items
  - Production status tracking
  - Production service

### ✅ Integrations & Services (COMPLETED)
- **Payment Integration** - 🔄 NEEDS SPEC
  - Paystack integration
  - Payment processing
  
- **POS Connections** - 🔄 NEEDS SPEC
  - POS provider integration
  - POS connection status
  - POS sync logs
  
- **AI Assistant** - ✅ HAS SPEC: `pricing-consistency-and-guest-ai-widget`
  - AI conversations
  - AI messages
  - User settings with AI data sharing
  - App help knowledge base
  - Marketing AI context
  - Guest AI for marketing pages
  
- **Notification System** - 🔄 NEEDS SPEC
  - Notification creation and delivery
  - Notification types and priorities
  - Notification service
  
- **Email Service** - 🔄 NEEDS SPEC
  - Email sending
  - Email templates
  - Contact form handling
  
- **Scheduler System** - 🔄 NEEDS SPEC
  - Job scheduling framework
  - Job execution logging
  - Overdue invoice job

### ✅ Subscription & Pricing (COMPLETED)
- **Subscription Management** - ✅ HAS SPEC: `granular-permissions-subscription`
  - Subscription tiers
  - Subscription transactions
  - Feature overrides
  - Custom pricing
  - Pricing consistency across platform

---

## Phase 0: Marketing Pages Redesign (IMMEDIATE - HIGHEST PRIORITY)
*Priority: CRITICAL P0 - Customer acquisition blocker*
*Status: ✅ COMPLETED*

### 0.1 Marketing Pages Redesign
- **Spec:** `marketing-pages-redesign` ✅
- **Spec:** `pricing-consistency-marketing` ✅
- **Spec:** `pricing-consistency-and-guest-ai-widget` ✅

**COMPLETED:**
- ✅ Fixed routing issues preventing guest access to /features, /industries, /faq
- ✅ Resolved RSC errors and authentication middleware problems
- ✅ Centralized pricing data for consistency across all displays
- ✅ Updated content to highlight AI-powered capabilities and user control
- ✅ Preserved existing visual design while fixing functionality
- ✅ Implemented proper guest-only route handling
- ✅ Added AI-powered messaging (core differentiator)
- ✅ Guest AI widget for marketing pages

## Phase 1: Core POS Foundation (Q1 2026)
*Priority: Critical - Foundation for all other features*
*Status: 📋 PLANNED - Mobile app to be built*

**Note:** The web application backend and frontend are already built. This phase focuses on building the mobile POS application that will use the existing backend API.

### 1.1 Mobile POS Application (React Native/Expo)
- **Spec:** `mobile-pos-foundation` 📋
- Expo managed workflow with Expo Router
- WatermelonDB for offline-first data
- NativeWind/Tamagui for styling
- Monorepo integration with existing backend
- **Backend API:** ✅ Already available (products, orders, inventory, customers)

### 1.2 Point of Sale Core (Mobile)
- **Spec:** `pos-core` 📋
- Fast transaction processing
- Product catalog with categories (uses existing backend)
- Cart management
- Basic payment processing
- Receipt generation
- **Backend API:** ✅ Already available

### 1.3 Offline-First Sync Engine (Mobile)
- **Spec:** `offline-sync-engine` 📋
- WatermelonDB sync protocol
- Conflict resolution
- Background sync
- Connectivity detection
- **Backend API:** 🚧 Needs sync endpoints

## Phase 2: Payment & Transaction Management (Q1-Q2 2026)
*Priority: High - Revenue critical*
*Status: 🚧 IN PROGRESS - Paystack integrated, needs mobile implementation*

### 2.1 Integrated Payments
- **Spec:** `integrated-payments` 📋
- **Web:** ✅ Paystack integration complete
- **Mobile:** 📋 Card payments (Yoco, SnapScan, Netcash)
- **Mobile:** 📋 Mobile payments (Apple Pay, Google Pay)
- **Mobile:** 📋 EFT integration
- **Mobile:** 📋 Cash management
- **Mobile:** 📋 Split payments

### 2.2 Shift Management
- **Spec:** `shift-management` 📋
- User PIN authentication
- Shift open/close
- Cash drawer management
- End-of-day reconciliation
- Float management
- **Backend:** 🚧 Needs shift models and API

### 2.3 Order Management (Enhanced)
- **Spec:** `order-management` 📋
- **Web:** ✅ Basic order management complete
- **Mobile:** 📋 Order types (dine-in, takeaway, delivery)
- **Mobile:** 📋 Table management
- **Mobile:** 📋 Order status tracking
- **Mobile:** 📋 Kitchen display integration
- **Mobile:** 📋 SlipApp integration

## Phase 3: Inventory Management (Q2 2026)
*Priority: High - Operational efficiency*
*Status: 🚧 IN PROGRESS - Basic inventory complete, needs advanced features*

### 3.1 Stock Control (Enhanced)
- **Spec:** `stock-control` 📋
- **Web:** ✅ Real-time inventory tracking complete
- **Web:** ✅ Basic stock adjustments complete
- **Mobile:** 📋 Barcode scanning
- **Mobile:** 📋 Stock take workflow
- **Web/Mobile:** 📋 Waste reporting
- **Web/Mobile:** 📋 SKU management

### 3.2 Multi-Location Inventory
- **Spec:** `multi-location-inventory` 📋
- Location-based stock levels
- Inter-location transfers
- Central warehouse management
- Stock allocation

### 3.3 Automated Reordering
- **Spec:** `automated-reordering` 📋
- **Web:** ✅ Supplier management complete
- **Web:** 📋 Reorder points
- **Web:** 📋 Purchase order generation
- **Web:** 📋 Receiving workflow

### 3.4 Month-End Stock Procedures
- **Spec:** `month-end-stock` 📋
- Stock take workflow
- Variance reporting
- Period closing
- Audit trails

## Phase 4: Hospitality Features (Q2-Q3 2026)
*Priority: Medium-High - Industry specific*
*Status: 🚧 IN PROGRESS - Basic recipe management complete*

### 4.1 Menu Engineering
- **Spec:** `menu-engineering` 📋
- Menu items with modifiers
- Portion management
- Recipe costing
- Menu categories

### 4.2 Recipe Management
- **Spec:** `recipe-management` 📋
- **Web:** ✅ Product ingredients complete
- **Web:** 📋 Recipe costing
- **Web:** 📋 Yield management
- **Web:** 📋 Nutritional info

### 4.3 Add-Ons & Modifiers
- **Spec:** `addons-modifiers` 📋
- Modifier groups
- Forced/optional modifiers
- Pricing rules
- Combo deals

### 4.4 Table Management
- **Spec:** `table-management` 📋
- Floor plan editor
- Table status
- Reservations
- Tab management

## Phase 5: Customer Management (Q3 2026)
*Priority: Medium-High - Customer retention*
*Status: 🚧 IN PROGRESS - Basic CRM complete, needs loyalty and accounts*

### 5.1 CRM Core
- **Spec:** `crm-core` 📋
- **Web:** ✅ Customer profiles complete
- **Web:** ✅ Customer types complete
- **Web:** ✅ Contact management complete
- **Web:** ✅ Purchase history (via orders) complete
- **Web:** 📋 Customer segmentation
- **Web:** 📋 Customer notes and tags

### 5.2 Loyalty Programs
- **Spec:** `loyalty-programs` 📋
- Points system
- Rewards catalog
- Tier management
- Loyalty currency

### 5.3 Customer Accounts
- **Spec:** `customer-accounts` 📋
- Account balances
- Credit limits
- Statement generation
- Payment tracking

### 5.4 Customer Display (myTab)
- **Spec:** `customer-display` 📋
- Order display
- Loyalty info
- Payment QR codes
- Promotional content

## Phase 6: Staff Management (Q3 2026)
*Priority: Medium - Operational*
*Status: ✅ COMPLETED - Core staff management complete*

### 6.1 Staff Profiles & Roles
- **Spec:** `staff-profiles` 🔄 NEEDS SPEC
- **Web:** ✅ User management complete
- **Web:** ✅ Role-based permissions complete
- **Web:** ✅ Department assignments complete
- **Web:** ✅ Activity logging complete
- **Mobile:** 📋 PIN management for POS

### 6.2 Time & Attendance
- **Spec:** `time-attendance` 🔄 NEEDS SPEC
- **Web:** ✅ Time entry tracking complete
- **Web:** ✅ Clock in/out complete
- **Web:** ✅ Break management complete
- **Web:** ✅ Overtime tracking complete
- **Web:** ✅ Timesheet reports complete

### 6.3 Staff Targets & Performance
- **Spec:** `staff-targets` 📋
- Sales targets
- Performance metrics
- Commission tracking
- Leaderboards

## Phase 7: Reporting & Analytics (Q3-Q4 2026)
*Priority: Medium-High - Business intelligence*
*Status: ✅ COMPLETED - Core reporting complete*

### 7.1 Sales Reports
- **Spec:** `sales-reports` 🔄 NEEDS SPEC
- **Web:** ✅ Daily/weekly/monthly sales complete
- **Web:** ✅ Product performance complete
- **Web:** ✅ Payment method breakdown complete
- **Web:** 📋 Discount analysis

### 7.2 Inventory Reports
- **Spec:** `inventory-reports` 🔄 NEEDS SPEC
- **Web:** ✅ Stock levels complete
- **Web:** ✅ Movement reports complete
- **Web:** ✅ Valuation reports complete
- **Web:** 📋 Wastage reports

### 7.3 Staff Reports
- **Spec:** `staff-reports` 🔄 NEEDS SPEC
- **Web:** ✅ Performance reports complete
- **Web:** ✅ Attendance reports complete
- **Web:** 📋 Commission reports
- **Web:** ✅ Activity logs complete

### 7.4 Custom Dashboards
- **Spec:** `custom-dashboards` 📋
- **Web:** ✅ Basic dashboard complete
- **Web:** 📋 Widget-based dashboards
- **Web:** 📋 KPI tracking
- **Web:** 📋 Real-time metrics
- **Web:** 📋 Export capabilities

## Phase 8: Accounting Integrations (Q4 2026)
*Priority: Medium - Financial management*
*Status: 📋 PLANNED*

### 8.1 Xero Integration
- **Spec:** `xero-integration` 📋
- Invoice sync
- Payment sync
- Chart of accounts mapping
- Bank reconciliation

### 8.2 Sage Integration
- **Spec:** `sage-integration` 📋
- Tax invoice sync
- Payment posting
- Purchase order sync
- Cost of sales journaling

### 8.3 General Ledger
- **Spec:** `general-ledger` 📋
- Account mapping
- Journal entries
- Period closing
- Financial reports

## Phase 9: E-Commerce & Online Ordering (Q4 2026)
*Priority: Medium - Revenue expansion*
*Status: 📋 PLANNED*

### 9.1 WooCommerce Integration
- **Spec:** `woocommerce-integration` 📋
- Product sync
- Order import
- Inventory sync
- Price management

### 9.2 Online Ordering (ToGo)
- **Spec:** `online-ordering` 📋
- Customer ordering app
- Menu display
- Order tracking
- Payment processing

### 9.3 Delivery Management
- **Spec:** `delivery-management` 📋
- Delivery zones
- Driver assignment
- Order tracking
- Delivery fees

## Phase 10: Multi-Location & Enterprise (Q1 2027)
*Priority: Medium - Scale*
*Status: 📋 PLANNED*

### 10.1 Multi-Location Management
- **Spec:** `multi-location-management` 📋
- Central dashboard
- Location hierarchy
- Cross-location reporting
- Consolidated views

### 10.2 Digital Signage (PageMan)
- **Spec:** `digital-signage` 📋
- Content management
- Display scheduling
- Menu boards
- Promotional displays

### 10.3 Property Management Integration
- **Spec:** `pms-integration` 📋
- Hotel PMS sync
- Room charges
- Guest profiles
- Folio management

## Phase 11: Retail Features (Q1 2027)
*Priority: Medium - Industry specific*
*Status: 🚧 IN PROGRESS - Layby backend complete*

### 11.1 Layby Management
- **Spec:** `layby-management` ✅
- **Backend:** ✅ Layby creation complete
- **Backend:** ✅ Payment schedules complete
- **Backend:** ✅ Layby payments complete
- **Backend:** ✅ Stock reservations complete
- **Backend:** ✅ Layby audit trail complete
- **Backend:** ✅ Layby notifications complete
- **Backend:** ✅ Layby configuration complete
- **Frontend:** 📋 Layby UI to be built

### 11.2 Pro Forma Invoices
- **Spec:** `proforma-invoices` 📋
- **Backend:** ✅ Invoice types include proforma
- **Frontend:** 📋 Quote generation
- **Frontend:** 📋 Conversion to sale
- **Frontend:** 📋 Validity tracking
- **Frontend:** 📋 Customer approval

### 11.3 Bulk Operations
- **Spec:** `bulk-operations` 📋
- Bulk price updates
- Bulk stock adjustments
- Import/export
- Batch processing

## Phase 12: Advanced Features (Q2 2027)
*Priority: Low-Medium - Enhancement*
*Status: 📋 PLANNED*

### 12.1 Petty Cash Management
- **Spec:** `petty-cash` 📋
- Cash tracking
- Expense categories
- Approval workflow
- Reconciliation

### 12.2 Tags & Categorization
- **Spec:** `tags-categorization` 📋
- Product tags
- Smart collections
- Filter/search
- Reporting by tags

### 12.3 Partner Admin
- **Spec:** `partner-admin` 📋
- Multi-tenant management
- Partner onboarding
- White-labeling
- Revenue sharing

---

## Feature Status Summary

### ✅ Completed Features (22)
1. Authentication & Authorization (RBAC)
2. Multi-Business/Organization Management
3. Product Management
4. Inventory Management (Basic)
5. Supplier Management
6. Order Management (Basic)
7. Invoice Management
8. Customer Management (Basic)
9. Staff Management
10. Time & Attendance
11. Department Management
12. Reports & Analytics (Basic)
13. Production Orders
14. POS Connections
15. AI Assistant (with Guest AI)
16. Notification System
17. Email Service
18. Scheduler System
19. Subscription Management
20. Payment Integration (Paystack)
21. OAuth (Google)
22. Marketing Pages (with pricing consistency)

### 🚧 In Progress (5)
1. Layby Management (backend complete, frontend pending)
2. Inventory Management (advanced features pending)
3. Order Management (enhanced features pending)
4. Customer Management (loyalty and accounts pending)
5. Recipe Management (basic complete, advanced pending)

### 📋 Planned (25)
1. Mobile POS Application
2. POS Core (Mobile)
3. Offline Sync Engine
4. Integrated Payments (Mobile)
5. Shift Management
6. Stock Control (Advanced)
7. Multi-Location Inventory
8. Automated Reordering
9. Month-End Stock
10. Menu Engineering
11. Add-Ons & Modifiers
12. Table Management
13. Loyalty Programs
14. Customer Accounts
15. Customer Display
16. Staff Targets
17. Custom Dashboards
18. Xero Integration
19. Sage Integration
20. General Ledger
21. WooCommerce Integration
22. Online Ordering
23. Delivery Management
24. Multi-Location Management
25. Digital Signage
26. PMS Integration
27. Pro Forma Invoices (Frontend)
28. Bulk Operations
29. Petty Cash
30. Tags & Categorization
31. Partner Admin

### 🔄 Needs Spec Documentation (15)
Features that exist but need formal spec documentation:
1. Authentication & Authorization
2. Multi-Business Management
3. Product Management
4. Inventory Management
5. Supplier Management
6. Order Management
7. Invoice Management
8. Customer Management
9. Staff Management
10. Time & Attendance
11. Reports System
12. Production Orders
13. POS Connections
14. Notification System
15. Email Service
16. Scheduler System
17. Payment Integration

---

## Spec Naming Convention

All specs follow the pattern: `.kiro/specs/{feature-name}/`

Each spec contains:
- `requirements.md` - Detailed requirements
- `design.md` - Technical design
- `tasks.md` - Implementation tasks

## Priority for Next Development Cycle

### Immediate (Next 2 Weeks)
1. **Create specs for completed features** - Document what's already built
2. **Complete Layby Management frontend** - Backend is ready
3. **Fix any critical bugs** - Ensure production stability

### Short Term (Next Month)
1. **Mobile POS Foundation** - Start React Native app
2. **Enhanced Order Management** - Add order types, table management
3. **Shift Management** - Critical for POS operations

### Medium Term (Next Quarter)
1. **Offline Sync Engine** - Enable mobile offline operation
2. **Advanced Inventory** - Multi-location, automated reordering
3. **Loyalty Programs** - Customer retention

---

## Estimated Timeline

**Note:** Timeline updated to reflect current state (January 2026)

| Phase | Duration | Status | Start | End |
|-------|----------|--------|-------|-----|
| Phase -1 | N/A | ✅ COMPLETED | Pre-2026 | Jan 2026 |
| Phase 0 | 1 week | ✅ COMPLETED | Dec 2025 | Jan 2026 |
| Phase 1 | 8 weeks | 📋 PLANNED | Feb 2026 | Apr 2026 |
| Phase 2 | 6 weeks | 🚧 IN PROGRESS | Apr 2026 | May 2026 |
| Phase 3 | 8 weeks | 🚧 IN PROGRESS | May 2026 | Jul 2026 |
| Phase 4 | 8 weeks | 🚧 IN PROGRESS | Jul 2026 | Sep 2026 |
| Phase 5 | 6 weeks | 🚧 IN PROGRESS | Sep 2026 | Oct 2026 |
| Phase 6 | 4 weeks | ✅ COMPLETED | Pre-2026 | Jan 2026 |
| Phase 7 | 6 weeks | ✅ COMPLETED | Pre-2026 | Jan 2026 |
| Phase 8 | 6 weeks | 📋 PLANNED | Oct 2026 | Dec 2026 |
| Phase 9 | 6 weeks | 📋 PLANNED | Dec 2026 | Jan 2027 |
| Phase 10 | 6 weeks | 📋 PLANNED | Jan 2027 | Mar 2027 |
| Phase 11 | 4 weeks | 🚧 IN PROGRESS | Mar 2027 | Apr 2027 |
| Phase 12 | 6 weeks | 📋 PLANNED | Apr 2027 | May 2027 |

**Revised Total: ~16 months** (from current state to full completion)

## Next Steps

### 1. Documentation Sprint (Week 1-2)
- Create specs for all completed features (Phase -1)
- Document existing architecture and design decisions
- Update API documentation

### 2. Mobile POS Development (Weeks 3-10)
- Set up React Native/Expo project in monorepo
- Implement offline-first architecture with WatermelonDB
- Build core POS transaction flow
- Integrate with existing backend API

### 3. Enhanced Features (Weeks 11-16)
- Complete Layby Management frontend
- Implement Shift Management
- Add advanced inventory features
- Build loyalty programs

### 4. Continuous Improvement
- Monitor production for bugs and issues
- Gather user feedback
- Iterate on UX/UI improvements
- Optimize performance

---

## Architecture Notes

### Backend (FastAPI)
- **Status:** ✅ Production-ready
- **Coverage:** Comprehensive API for all core features
- **Database:** PostgreSQL with SQLAlchemy (async)
- **Authentication:** JWT with RBAC
- **Integrations:** Paystack, Google OAuth
- **Scheduler:** APScheduler for background jobs

### Web Application (Next.js)
- **Status:** ✅ Production-ready
- **Framework:** Next.js 16+ with App Router
- **Styling:** Tailwind CSS
- **State:** React hooks and context
- **Features:** Full dashboard, reports, management interfaces

### Mobile Application (React Native)
- **Status:** 📋 To be built
- **Framework:** Expo with Expo Router
- **Offline:** WatermelonDB for local-first data
- **Styling:** NativeWind/Tamagui
- **Focus:** POS transactions, simple inventory, stock take

---

## Success Metrics

### Technical Metrics
- ✅ Backend API coverage: 90%+
- ✅ Web application features: 70%+
- 📋 Mobile application: 0% (to be built)
- ✅ Test coverage: 60%+
- ✅ Production uptime: 99%+

### Business Metrics
- ✅ Multi-business support: Active
- ✅ User authentication: Secure
- ✅ Payment processing: Integrated
- ✅ Reporting: Comprehensive
- 📋 Mobile POS: Pending

---

**Last Updated:** January 20, 2026
**Maintained By:** BizPilot Development Team
