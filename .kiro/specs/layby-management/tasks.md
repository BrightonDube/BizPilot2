# Implementation Plan: Layby Management

## Overview

This implementation plan covers the complete layby management system for BizPilot POS. The implementation follows a backend-first approach, establishing the API and data layer before building the web interface. Property-based tests are integrated throughout to ensure correctness.

**Note:** Mobile tasks have been removed as there is no mobile (React Native) codebase in this project. The implementation focuses on the FastAPI backend and Next.js frontend.

## Tasks

- [x] 1. Database Schema and Migrations
  - [x] 1.1 Create Alembic migration for layby_config table
    - Define table with all configuration columns
    - Add unique constraint on (business_id, location_id)
    - _Requirements: 12.1-12.8_
  
  - [x] 1.2 Create Alembic migration for laybys table
    - Define table with all columns and indexes
    - Add foreign key constraints
    - _Requirements: 1.1-1.8_
  
  - [x] 1.3 Create Alembic migration for layby_items table
    - Define table with foreign key to laybys
    - Add product reference
    - _Requirements: 1.2_
  
  - [x] 1.4 Create Alembic migration for layby_schedules table
    - Define table with installment tracking
    - Add unique constraint on (layby_id, installment_number)
    - _Requirements: 2.1-2.7_
  
  - [x] 1.5 Create Alembic migration for layby_payments table
    - Define table with payment details and refund support
    - _Requirements: 3.1-3.8_
  
  - [x] 1.6 Create Alembic migration for layby_audit table
    - Define table with JSONB columns for old/new values
    - _Requirements: 11.1-11.8_
  
  - [x] 1.7 Create Alembic migration for layby_notifications table
    - Define table for notification tracking
    - _Requirements: 7.1-7.7_
  
  - [x] 1.8 Create Alembic migration for stock_reservations table
    - Define table with reservation status tracking
    - _Requirements: 9.1-9.7_

- [x] 2. Backend SQLAlchemy Models
  - [x] 2.1 Create LaybyConfig model in `backend/app/models/layby_config.py`
    - Define all fields with proper types
    - Add relationship to Business
    - _Requirements: 12.1-12.8_
  
  - [x] 2.2 Create Layby model in `backend/app/models/layby.py`
    - Define all fields including status enum
    - Add relationships to Customer, User, items, payments, schedules
    - _Requirements: 1.1-1.8_
  
  - [x] 2.3 Create LaybyItem model in `backend/app/models/layby_item.py`
    - Define fields with Product relationship
    - _Requirements: 1.2_
  
  - [x] 2.4 Create LaybySchedule model in `backend/app/models/layby_schedule.py`
    - Define installment fields with status enum
    - _Requirements: 2.1-2.7_
  
  - [x] 2.5 Create LaybyPayment model in `backend/app/models/layby_payment.py`
    - Define payment fields with refund support
    - _Requirements: 3.1-3.8_
  
  - [x] 2.6 Create LaybyAudit model in `backend/app/models/layby_audit.py`
    - Define audit fields with JSONB support
    - Export from models __init__.py
    - _Requirements: 11.1-11.8_
  
  - [x] 2.7 Create StockReservation model in `backend/app/models/stock_reservation.py`
    - Define reservation fields with status tracking
    - Export from models __init__.py
    - _Requirements: 9.1-9.7_
  
  - [x] 2.8 Export LaybyPayment from models __init__.py
    - Add LaybyPayment and PaymentType, PaymentStatus to exports
    - _Requirements: 3.1-3.8_

- [x] 3. Backend Pydantic Schemas
  - [x] 3.1 Create layby schemas in `backend/app/schemas/layby.py`
    - LaybyCreate, LaybyUpdate, LaybyResponse, LaybyListResponse
    - LaybyItemCreate, LaybyItemResponse
    - _Requirements: 1.1-1.8_
  
  - [x] 3.2 Create payment schemas in `backend/app/schemas/layby_payment.py`
    - PaymentCreate, PaymentResponse, RefundCreate
    - _Requirements: 3.1-3.8_
  
  - [x] 3.3 Create schedule schemas in `backend/app/schemas/layby_schedule.py`
    - ScheduleResponse, ScheduleUpdateRequest
    - _Requirements: 2.1-2.7_
  
  - [x] 3.4 Create config schemas in `backend/app/schemas/layby_config.py`
    - LaybyConfigCreate, LaybyConfigUpdate, LaybyConfigResponse
    - _Requirements: 12.1-12.8_
  
  - [ ] 3.5 Create report schemas in `backend/app/schemas/layby_report.py`
    - ActiveLaybyReport, OverdueReport, AgingReport
    - _Requirements: 8.1-8.8_

- [ ] 4. Checkpoint - Database and Schema Validation
  - Run migrations and verify tables created correctly
  - Verify model relationships work
  - Ensure all tests pass, ask the user if questions arise

- [x] 5. Core Layby Service Implementation
  - [x] 5.1 Create LaybyService class in `backend/app/services/layby_service.py`
    - Implement create_layby with deposit validation
    - Implement reference number generation
    - _Requirements: 1.1-1.8_
  
  - [x] 5.2 Implement get_layby and list_laybys methods
    - Add filtering by status, customer, date range
    - Add pagination support
    - _Requirements: 8.1-8.8_
  
  - [x] 5.3 Implement cancel_layby method
    - Calculate cancellation and restocking fees
    - Handle refund calculation
    - _Requirements: 5.1-5.8_
  
  - [x] 5.4 Implement extend_layby method
    - Validate extension limits
    - Recalculate schedule
    - _Requirements: 6.1-6.6_
  
  - [x] 5.5 Implement collect_layby method
    - Validate ready_for_collection status
    - Record collection details
    - _Requirements: 4.1-4.7_
  
  - [ ]* 5.6 Write property test for balance invariant
    - **Property 1: Layby Balance Invariant**
    - **Validates: Requirements 3.2**
  
  - [ ]* 5.7 Write property test for reference number uniqueness
    - **Property 4: Reference Number Uniqueness**
    - **Validates: Requirements 1.5**

- [x] 6. Payment Schedule Service
  - [x] 6.1 Create LaybyScheduleService in `backend/app/services/layby_schedule_service.py`
    - Implement calculate_schedule for all frequencies
    - Handle installment amount rounding
    - _Requirements: 2.1-2.7_
  
  - [x] 6.2 Implement recalculate_schedule method
    - Update remaining installments after payment or extension
    - _Requirements: 2.6_
  
  - [ ]* 6.3 Write property test for schedule sum consistency
    - **Property 2: Payment Schedule Sum Consistency**
    - **Validates: Requirements 2.2, 2.6**
  
  - [ ]* 6.4 Write property test for frequency schedule generation
    - **Property 9: Payment Frequency Schedule Generation**
    - **Validates: Requirements 2.1, 2.4**

- [x] 7. Payment Processing Service
  - [x] 7.1 Create LaybyPaymentService in `backend/app/services/layby_payment_service.py`
    - Implement make_payment with balance update
    - Handle overpayments and partial payments
    - _Requirements: 3.1-3.8_
  
  - [x] 7.2 Implement status transition on full payment
    - Change status to ready_for_collection when balance is zero
    - _Requirements: 3.6, 4.1_
  
  - [x] 7.3 Implement refund_payment method
    - Handle refund processing
    - _Requirements: 5.8_
  
  - [ ]* 7.4 Write property test for status transition on full payment
    - **Property 6: Status Transition on Full Payment**
    - **Validates: Requirements 3.6, 4.1**
  
  - [ ]* 7.5 Write property test for failed payment isolation
    - **Property 12: Failed Payment Isolation**
    - **Validates: Requirements 1.8, 3.7**

- [ ] 8. Stock Reservation Service
  - [ ] 8.1 Create LaybyStockService in `backend/app/services/layby_stock_service.py`
    - Implement reserve_stock on layby creation
    - Implement check_availability validation
    - _Requirements: 9.1, 9.5_
  
  - [ ] 8.2 Implement release_stock for cancellation
    - Return quantities to available stock
    - _Requirements: 9.2, 5.4_
  
  - [ ] 8.3 Implement collect_stock for collection
    - Remove from total inventory
    - _Requirements: 9.3, 4.3_
  
  - [ ]* 8.4 Write property test for stock reservation consistency
    - **Property 5: Stock Reservation Consistency**
    - **Validates: Requirements 1.7, 5.4, 4.3, 9.1, 9.2, 9.3**
  
  - [ ]* 8.5 Write property test for stock availability validation
    - **Property 13: Stock Availability Validation**
    - **Validates: Requirements 9.5**

- [ ] 9. Checkpoint - Core Services Validation
  - Run all unit tests for services
  - Verify property tests pass
  - Ensure all tests pass, ask the user if questions arise

- [x] 10. Audit Trail Service
  - [x] 10.1 Create LaybyAuditService in `backend/app/services/layby_audit_service.py`
    - Implement log_action method
    - Capture old/new values as JSONB
    - _Requirements: 11.1-11.8_
  
  - [x] 10.2 Integrate audit logging into all layby operations
    - Add audit calls to create, payment, cancel, collect, extend
    - _Requirements: 11.1-11.6_
  
  - [ ]* 10.3 Write property test for audit trail completeness
    - **Property 11: Audit Trail Completeness**
    - **Validates: Requirements 11.1-11.7**

- [x] 11. Validation Service
  - [x] 11.1 Create LaybyValidationService in `backend/app/services/layby_validation_service.py`
    - Implement deposit validation
    - Implement duration validation
    - _Requirements: 1.3, 1.4, 2.3_
  
  - [ ]* 11.2 Write property test for minimum deposit validation
    - **Property 3: Minimum Deposit Validation**
    - **Validates: Requirements 1.3, 1.4**
  
  - [ ]* 11.3 Write property test for maximum duration enforcement
    - **Property 14: Maximum Duration Enforcement**
    - **Validates: Requirements 2.3**
  
  - [ ]* 11.4 Write property test for cancellation fee calculation
    - **Property 7: Cancellation Fee Calculation**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.7**
  
  - [ ]* 11.5 Write property test for extension limit enforcement
    - **Property 8: Extension Limit Enforcement**
    - **Validates: Requirements 6.3**

- [x] 12. API Endpoints - Layby CRUD
  - [x] 12.1 Create layby router in `backend/app/api/laybys.py`
    - POST /laybys - Create new layby
    - GET /laybys - List laybys with filters
    - GET /laybys/{id} - Get layby details
    - Register router in main.py
    - _Requirements: 1.1-1.8_
  
  - [x] 12.2 Implement cancellation endpoint
    - POST /laybys/{id}/cancel
    - Return cancellation result with fees
    - _Requirements: 5.1-5.8_
  
  - [x] 12.3 Implement collection endpoint
    - POST /laybys/{id}/collect
    - Return collection result
    - _Requirements: 4.1-4.7_
  
  - [x] 12.4 Implement extension endpoint
    - POST /laybys/{id}/extend
    - Return updated layby with new schedule
    - _Requirements: 6.1-6.6_

- [x] 13. API Endpoints - Payments
  - [x] 13.1 Create payment endpoints in layby router
    - POST /laybys/{id}/payments - Make payment
    - GET /laybys/{id}/payments - Get payment history
    - _Requirements: 3.1-3.8_
  
  - [ ] 13.2 Implement refund endpoint
    - POST /laybys/{id}/payments/{pid}/refund
    - _Requirements: 5.8_
  
  - [x] 13.3 Implement schedule endpoints
    - GET /laybys/{id}/schedule
    - PUT /laybys/{id}/schedule
    - _Requirements: 2.1-2.7_

- [x] 14. API Endpoints - Reports
  - [x] 14.1 Create report endpoints in layby router
    - GET /laybys/reports/active
    - GET /laybys/reports/overdue
    - GET /laybys/reports/completed
    - GET /laybys/reports/cancelled
    - _Requirements: 8.1-8.4_
  
  - [x] 14.2 Implement aging and stock reports
    - GET /laybys/reports/aging
    - GET /laybys/reports/reserved-stock
    - _Requirements: 8.5, 8.6_
  
  - [ ] 14.3 Implement report export
    - Add CSV and PDF export support
    - _Requirements: 8.8_

- [x] 15. API Endpoints - Configuration and Audit
  - [x] 15.1 Create config router in `backend/app/api/layby_config.py`
    - GET /layby-config
    - PUT /layby-config
    - Register router in main.py
    - _Requirements: 12.1-12.8_
  
  - [x] 15.2 Create audit endpoint
    - GET /laybys/{id}/audit
    - _Requirements: 11.7, 11.8_

- [ ] 16. Checkpoint - API Validation
  - Test all API endpoints with Postman/curl
  - Verify error responses are correct
  - Ensure all tests pass, ask the user if questions arise

- [ ] 17. Notification Service
  - [ ] 17.1 Create LaybyNotificationService in `backend/app/services/layby_notification_service.py`
    - Implement send_payment_reminder
    - Implement send_overdue_notice
    - Implement send_collection_ready
    - _Requirements: 7.1-7.4_
  
  - [ ] 17.2 Implement notification templates
    - Create SMS and email templates
    - Include layby reference, amount, due date
    - _Requirements: 7.5_
  
  - [ ] 17.3 Implement notification logging
    - Log all sent notifications to layby_notifications table
    - _Requirements: 7.7_
  
  - [ ]* 17.4 Write property test for notification content completeness
    - **Property 15: Notification Content Completeness**
    - **Validates: Requirements 7.5**

- [ ] 18. Background Tasks
  - [ ] 18.1 Create reminder task in `backend/app/scheduler/jobs/layby_reminders.py`
    - Query laybys with upcoming payments
    - Send reminders based on config
    - _Requirements: 7.1_
  
  - [ ] 18.2 Create overdue check task in `backend/app/scheduler/jobs/layby_overdue_check.py`
    - Query laybys with missed payments
    - Update status to overdue
    - Send overdue notifications
    - _Requirements: 7.2_
  
  - [ ] 18.3 Create collection reminder task
    - Query ready_for_collection laybys past grace period
    - Send collection reminders
    - _Requirements: 4.7_

- [ ] 19. Frontend - API Client
  - [ ] 19.1 Create layby API client in `frontend/src/lib/layby-api.ts`
    - Implement all layby API calls
    - _Requirements: 1.1-12.8_

- [ ] 20. Frontend - Components
  - [x] 20.1 Create LaybyTable component in `frontend/src/components/laybys/LaybyTable.tsx`
    - Data table with sorting, filtering, pagination
    - _Requirements: 8.1-8.8_
  
  - [x] 20.2 Create LaybyForm component in `frontend/src/components/laybys/LaybyForm.tsx`
    - Create/edit layby form
    - _Requirements: 1.1-1.8_
  
  - [x] 20.3 Create PaymentModal component in `frontend/src/components/laybys/PaymentModal.tsx`
    - Payment entry dialog
    - _Requirements: 3.1-3.8_
  
  - [x] 20.4 Create CancellationModal component in `frontend/src/components/laybys/CancellationModal.tsx`
    - Cancellation with fee preview
    - _Requirements: 5.1-5.8_
  
  - [x] 20.5 Create CollectionModal component in `frontend/src/components/laybys/CollectionModal.tsx`
    - Collection confirmation dialog
    - _Requirements: 4.1-4.7_
  
  - [x] 20.6 Create LaybyReports component in `frontend/src/components/laybys/LaybyReports.tsx`
    - Report display and export
    - _Requirements: 8.1-8.8_
  
  - [x] 20.7 Create LaybyConfigForm component in `frontend/src/components/laybys/LaybyConfigForm.tsx`
    - Configuration settings form
    - _Requirements: 12.1-12.8_

- [ ] 21. Frontend - Pages
  - [ ] 21.1 Create layby list page in `frontend/src/app/(dashboard)/laybys/page.tsx`
    - List with filters and actions
    - _Requirements: 8.1-8.8_
  
  - [ ] 21.2 Create layby detail page in `frontend/src/app/(dashboard)/laybys/[id]/page.tsx`
    - Full layby details with actions
    - _Requirements: 1.1-11.8_
  
  - [ ] 21.3 Create layby creation page in `frontend/src/app/(dashboard)/laybys/create/page.tsx`
    - Multi-step creation wizard
    - _Requirements: 1.1-1.8, 2.1-2.7_
  
  - [ ] 21.4 Create reports page in `frontend/src/app/(dashboard)/laybys/reports/page.tsx`
    - Report selection and display
    - _Requirements: 8.1-8.8_

- [ ] 22. Final Integration Testing
  - [ ] 22.1 Write E2E test for complete layby lifecycle
    - Create → Payments → Collection
    - _Requirements: All_
  
  - [ ] 22.2 Write E2E test for cancellation flow
    - Create → Partial Payment → Cancel → Refund
    - _Requirements: 5.1-5.8_
  
  - [ ] 22.3 Write E2E test for extension flow
    - Create → Extension → Updated Schedule
    - _Requirements: 6.1-6.6_

- [ ] 23. Final Checkpoint
  - Run all backend tests
  - Run all frontend tests
  - Verify all property tests pass
  - Ensure all tests pass, ask the user if questions arise

## Task 24: Local Testing and Build Verification
- [ ] 24.1 Run all backend tests (pytest)
- [ ] 24.2 Run all frontend tests (if applicable)
- [ ] 24.3 Run linting and code quality checks
- [ ] 24.4 Build backend application successfully
- [ ] 24.5 Build frontend application successfully
- [ ] 24.6 Verify all functionality works locally
- [ ] 24.7 Test layby management workflows end-to-end

## Task 25: Deployment Workflow
- [ ] 25.1 Commit all changes to feature branch
- [ ] 25.2 Create pull request to dev branch
- [ ] 25.3 Merge to dev branch after review
- [ ] 25.4 Push to dev branch to trigger deployment
- [ ] 25.5 Monitor deployment using MCP servers
- [ ] 25.6 Poll deployment status every 2 minutes until complete
- [ ] 25.7 If deployment fails, analyze logs and fix issues
- [ ] 25.8 Re-test locally, rebuild, and push fix
- [ ] 25.9 Continue monitoring until deployment succeeds
- [ ] 25.10 Verify layby management features work in production

## Task 26: Final Checkpoint
- [ ] 26.1 Confirm all layby management features are working
- [ ] 26.2 Verify database migrations applied correctly
- [ ] 26.3 Test layby creation, payments, and collection workflows
- [ ] 26.4 Confirm notifications and reporting functionality
- [ ] 26.5 Document any known issues or limitations
- [ ] 26.6 Mark feature as complete and ready for use

## Notes

- Tasks marked with `*` are optional property-based tests that can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Backend tests use pytest with hypothesis for property-based testing
- Mobile tasks have been removed as there is no React Native codebase in this project
