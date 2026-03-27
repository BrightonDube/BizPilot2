# Implementation Plan: Granular Permissions & Subscription System

## Overview

This implementation plan breaks down the Granular Permissions & Subscription System into discrete, incremental coding tasks. The approach prioritizes core functionality first, then adds caching, then frontend integration, then mobile support, and finally migration and background jobs. Each task builds on previous work, with checkpoints to ensure stability.

## Tasks

- [ ] 1. Database schema and models setup
  - [x] 1.1 Create database migration for new tables
    - Create Alembic migration file for TierFeatures, BusinessSubscription, FeatureOverrides, DeviceRegistry, AuditLog tables
    - Include all indexes and constraints from design
    - Add seed data for tier_features (basic, professional, enterprise tiers)
    - _Requirements: 1.5, 2.5, 3.4, 16.1, 16.2, 16.3, 16.4, 16.6_
  
  - [x] 1.2 Create SQLAlchemy models
    - Implement TierFeature, BusinessSubscription, FeatureOverride, DeviceRegistry, AuditLog models
    - Add relationships and indexes as specified in design
    - _Requirements: 16.1, 16.2, 16.3, 16.4_
  
  - [x] 1.3 Create Pydantic schemas
    - Implement request/response schemas for all models
    - Add PermissionsResponse schema for /api/permissions/me endpoint
    - _Requirements: 7.1, 7.2_
  
  - [ ]* 1.4 Write unit tests for models
    - Test model creation and relationships
    - Test unique constraints
    - _Requirements: 16.1, 16.2, 16.3, 16.4_

- [x] 2. Core backend services implementation
  - [x] 2.1 Implement PermissionService (without caching)
    - Create PermissionService class with check_feature method
    - Implement _load_permissions_from_db with tier, override, and demo logic
    - Implement get_business_permissions method
    - Add SuperAdmin bypass logic
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 4.1, 4.2, 6.7_
  
  - [ ]* 2.2 Write property test for tier-based feature access
    - **Property 1: Tier-Based Feature Access**
    - **Validates: Requirements 1.1**
  
  - [ ]* 2.3 Write property test for override precedence
    - **Property 4: Override Precedence Over Tier**
    - **Validates: Requirements 2.2, 2.3, 2.4**
  
  - [ ]* 2.4 Write property test for demo mode
    - **Property 8: Demo Mode Grants All Features**
    - **Validates: Requirements 4.1**
  
  - [ ]* 2.5 Write property test for SuperAdmin bypass
    - **Property 13: SuperAdmin Bypass**
    - **Validates: Requirements 6.7**
  
  - [x] 2.6 Implement SubscriptionService
    - Create SubscriptionService class
    - Implement create_subscription, update_subscription methods
    - Implement add_feature_override, remove_feature_override methods
    - Implement reactivate_subscription method
    - Add audit logging to all methods
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 12.5_
  
  - [ ]* 2.7 Write property test for audit logging
    - **Property 12: Audit Logging for Admin Actions**
    - **Validates: Requirements 6.5**
  
  - [x] 2.8 Implement DeviceService
    - Create DeviceService class
    - Implement register_device with limit checking
    - Implement check_device_limit and get_active_device_count methods
    - Implement mark_inactive_devices for background job
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [ ]* 2.9 Write property test for device limit enforcement
    - **Property 5: Device Limit Enforcement**
    - **Validates: Requirements 3.1, 3.2**
  
  - [ ]* 2.10 Write property test for concurrent device registration
    - **Property 20: Concurrent Device Registration**
    - **Validates: Requirements 18.3**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Redis caching integration
  - [x] 4.1 Add Redis connection setup
    - Create Redis connection pool in app/core/redis.py
    - Add Redis dependency injection helper
    - Add fallback logic for Redis unavailability
    - _Requirements: 17.1, 17.4_
  
  - [x] 4.2 Integrate caching into PermissionService
    - Add Redis to PermissionService constructor
    - Implement cache check in check_feature method
    - Implement cache storage with 5-minute TTL
    - Implement invalidate_cache method
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 17.1, 17.2, 17.3_
  
  - [x] 4.3 Add cache invalidation to SubscriptionService
    - Call permission_service.invalidate_cache after all subscription updates
    - Call invalidate_cache after override changes
    - _Requirements: 5.5, 17.3_
  
  - [ ]* 4.4 Write property test for cache invalidation consistency
    - **Property 11: Cache Invalidation Consistency**
    - **Validates: Requirements 5.5**

- [x] 5. FastAPI dependencies and middleware
  - [x] 5.1 Create permission check dependencies
    - Implement get_permission_service dependency
    - Implement check_feature dependency factory
    - Implement check_device_limit dependency
    - Implement require_superadmin dependency
    - Add proper error handling with HTTPException(403)
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5_
  
  - [ ]* 5.2 Write unit tests for dependencies
    - Test check_feature with granted/denied features
    - Test SuperAdmin bypass in check_feature
    - Test require_superadmin with admin/non-admin users
    - Test check_device_limit at/under/over limit
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5_

- [x] 6. User-facing API endpoints
  - [x] 6.1 Implement GET /api/permissions/me endpoint
    - Create permissions router
    - Implement endpoint using PermissionService.get_business_permissions
    - Return PermissionsResponse schema
    - _Requirements: 7.1, 7.2_
  
  - [ ]* 6.2 Write integration test for permissions endpoint
    - Test with various subscription states
    - Test with overrides
    - Test with demo mode
    - _Requirements: 7.1, 7.2_

- [x] 7. SuperAdmin API endpoints
  - [x] 7.1 Implement subscription management endpoints
    - Create admin/subscriptions router with require_superadmin dependency
    - Implement POST /api/admin/subscriptions (create)
    - Implement PUT /api/admin/subscriptions/{id} (update)
    - Implement POST /api/admin/subscriptions/{id}/reactivate
    - _Requirements: 6.1, 6.2, 12.5_
  
  - [x] 7.2 Implement feature override endpoints
    - Implement POST /api/admin/subscriptions/{id}/overrides
    - Implement DELETE /api/admin/subscriptions/{id}/overrides/{feature}
    - _Requirements: 6.3, 6.4_
  
  - [x] 7.3 Implement audit log endpoint
    - Create admin/audit_logs router
    - Implement GET /api/admin/audit-logs with filtering
    - Support business_id, admin_user_id, date range filters
    - Add pagination with limit/offset
    - _Requirements: 15.5_
  
  - [ ]* 7.4 Write integration tests for admin endpoints
    - Test subscription CRUD operations
    - Test override management
    - Test audit log retrieval with filters
    - Test non-admin access rejection
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 15.5_

- [x] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Protect existing endpoints with feature checks
  - [x] 9.1 Add feature checks to payroll endpoints
    - Add Depends(check_feature("payroll")) to payroll routes
    - _Requirements: 8.1_
  
  - [x] 9.2 Add feature checks to AI endpoints
    - Add Depends(check_feature("ai_assistant")) to AI routes
    - _Requirements: 8.2_
  
  - [x] 9.3 Add feature checks to API integration endpoints
    - Add Depends(check_feature("api_integrations")) to integration routes
    - _Requirements: 8.3_
  
  - [x] 9.4 Add feature checks to advanced reporting endpoints
    - Add Depends(check_feature("advanced_reporting")) to reporting routes
    - _Requirements: 8.4_
  
  - [ ]* 9.5 Write integration tests for protected endpoints
    - Test access with feature granted
    - Test access denied without feature
    - Test SuperAdmin bypass
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 10. Extend mobile sync endpoint
  - [x] 10.1 Update sync endpoint with device registration and permissions
    - Add check_device_limit dependency to sync endpoint
    - Call DeviceService.register_device in sync handler
    - Call PermissionService.get_business_permissions
    - Include permissions in sync response payload
    - _Requirements: 7.3, 7.4, 7.5_
  
  - [x]* 10.2 Write integration test for sync endpoint
    - Test device registration on sync
    - Test permissions included in response
    - Test device limit rejection
    - _Requirements: 7.3, 7.4, 7.5_

- [x] 11. Frontend: usePermissions hook and FeatureGate component
  - [x] 11.1 Implement usePermissions hook
    - Create hook using React Query
    - Fetch from /api/permissions/me
    - Implement hasFeature helper
    - Implement isDemo helper
    - Set 5-minute staleTime to match backend cache
    - _Requirements: 9.4_
  
  - [x] 11.2 Implement FeatureGate component
    - Create component accepting feature prop
    - Use usePermissions hook
    - Render children if feature granted
    - Render LockedFeatureOverlay if feature denied
    - Support fallback prop
    - _Requirements: 9.1, 9.2, 9.3_
  
  - [x] 11.3 Implement LockedFeatureOverlay component
    - Create overlay with lock icon
    - Display feature name and upgrade message
    - Add button linking to /settings/subscription
    - Style with Tailwind (mobile-first)
    - _Requirements: 9.3_
  
  - [x]* 11.4 Write component tests for FeatureGate
    - Test rendering children when feature granted
    - Test rendering overlay when feature denied
    - Test loading state
    - _Requirements: 9.2, 9.3_

- [x] 12. Frontend: Integrate FeatureGate into existing features
  - [x] 12.1 Wrap payroll UI with FeatureGate
    - Add <FeatureGate feature="payroll"> around payroll pages/components
    - _Requirements: 9.1_
  
  - [x] 12.2 Wrap AI assistant UI with FeatureGate
    - Add <FeatureGate feature="ai_assistant"> around AI components
    - _Requirements: 9.1_
  
  - [x] 12.3 Wrap API integrations UI with FeatureGate
    - Add <FeatureGate feature="api_integrations"> around integration pages
    - _Requirements: 9.1_
  
  - [x] 12.4 Wrap advanced reporting UI with FeatureGate
    - Add <FeatureGate feature="advanced_reporting"> around reporting pages
    - _Requirements: 9.1_

- [x] 13. Frontend: SuperAdmin dashboard
  - [x] 13.1 Create SuperAdmin subscriptions page
    - Create /admin/subscriptions page (Next.js App Router)
    - Fetch businesses with subscriptions from /api/admin/businesses
    - Display table with business name, tier, status, device limit
    - Add Edit button for each business
    - Style with Tailwind
    - _Requirements: 10.1, 10.5_
  
  - [x] 13.2 Create EditSubscriptionModal component
    - Create modal component with Dialog from shadcn/ui
    - Add form fields for tier, status, device_limit, demo_expires_at
    - Add feature override checkboxes
    - Implement save handler calling PUT /api/admin/subscriptions/{id}
    - Implement override handlers calling override endpoints
    - Invalidate React Query cache on success
    - _Requirements: 10.2, 10.3, 10.4_
  
  - [ ]* 13.3 Write E2E test for SuperAdmin dashboard
    - Test loading businesses
    - Test opening edit modal
    - Test updating subscription
    - Test adding/removing overrides
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [ ] 14. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Mobile: WatermelonDB integration
  - [x] 15.1 Create Permissions model in WatermelonDB
    - Define Permissions model with schema
    - Add fields: business_id, granted_features (JSON), tier, status, demo_expires_at, device_limit, synced_at
    - _Requirements: 13.1_
  
  - [x] 15.2 Implement mobile sync handler for permissions
    - Create syncPermissions function
    - Update or create Permissions record in WatermelonDB
    - Store granted_features as JSON string
    - _Requirements: 13.3, 13.5_
  
  - [x] 15.3 Implement mobile usePermissions hook
    - Create hook that reads from WatermelonDB
    - Implement hasFeature helper
    - Support offline access
    - _Requirements: 13.2_
  
  - [x] 15.4 Implement mobile FeatureGate component
    - Create React Native component
    - Use mobile usePermissions hook
    - Render children or locked UI based on feature access
    - Style with React Native StyleSheet
    - _Requirements: 13.2_
  
  - [x]* 15.5 Write integration test for mobile offline permissions
    - Test syncing permissions to WatermelonDB
    - Test offline feature checks
    - Test permission updates on next sync
    - _Requirements: 13.1, 13.2, 13.3, 13.5_

- [x] 16. Background jobs
  - [x] 16.1 Create device cleanup background job
    - Create job script that calls DeviceService.mark_inactive_devices
    - Mark devices with last_sync_at > 30 days as inactive
    - Log execution results
    - _Requirements: 3.3, 14.1, 14.3_
  
  - [x] 16.2 Create demo expiry background job
    - Create job script that queries expired demos
    - Update status to "expired" for expired demos
    - Invalidate caches for affected businesses
    - Log execution results
    - _Requirements: 4.2, 4.4, 4.5, 14.2, 14.4_
  
  - [x] 16.3 Set up job scheduling
    - Configure daily schedule for device cleanup job
    - Configure hourly schedule for demo expiry job
    - Use APScheduler or similar for Python
    - _Requirements: 14.1, 14.2_
  
  - [ ]* 16.4 Write unit tests for background jobs
    - Test device cleanup marks correct devices
    - Test demo expiry updates correct subscriptions
    - Test cache invalidation after expiry
    - _Requirements: 3.3, 4.4, 14.3_

- [ ] 17. Data migration from old schema
  - [x] 17.1 Create migration script for existing subscriptions
    - Create script to read existing businesses.feature_flags JSONB
    - Create BusinessSubscription entries for businesses without subscriptions
    - Create FeatureOverride entries from feature_flags data
    - Make script idempotent (check for existing data)
    - _Requirements: 11.1, 11.2, 11.5_
  
  - [ ]* 17.2 Write property test for migration data transformation
    - **Property 14: Migration Data Transformation**
    - **Validates: Requirements 11.2**
  
  - [ ]* 17.3 Write property test for migration idempotence
    - **Property 16: Migration Idempotence**
    - **Validates: Requirements 11.5**
  
  - [x] 17.4 Update permission check logic for backward compatibility
    - If new schema data exists, use it (already implemented)
    - If only old feature_flags exists, fall back to it temporarily
    - Log warning when falling back to old schema
    - _Requirements: 11.3, 11.4_
  
  - [ ]* 17.5 Write property test for new schema precedence
    - **Property 15: New Schema Precedence**
    - **Validates: Requirements 11.4**

- [ ] 18. Property-based tests for remaining properties
  - [ ]* 18.1 Write property test for tier changes
    - **Property 2: Tier Changes Immediately Affect Access**
    - **Validates: Requirements 1.3, 1.4**
  
  - [ ]* 18.2 Write property test for override application
    - **Property 3: Override Application**
    - **Validates: Requirements 2.1**
  
  - [ ]* 18.3 Write property test for inactive device cleanup
    - **Property 6: Inactive Device Cleanup**
    - **Validates: Requirements 3.3**
  
  - [ ]* 18.4 Write property test for device limit updates
    - **Property 7: Device Limit Updates**
    - **Validates: Requirements 3.5**
  
  - [ ]* 18.5 Write property test for demo expiry
    - **Property 9: Demo Expiry Reverts to Tier Permissions**
    - **Validates: Requirements 4.2**
  
  - [ ]* 18.6 Write property test for demo expiry status update
    - **Property 10: Demo Expiry Updates Status**
    - **Validates: Requirements 4.4**
  
  - [ ]* 18.7 Write property test for non-active status
    - **Property 17: Non-Active Status Revokes Access**
    - **Validates: Requirements 12.2, 12.3, 12.4**
  
  - [ ]* 18.8 Write property test for inactive device frees slot
    - **Property 18: Inactive Device Frees Slot**
    - **Validates: Requirements 14.3**
  
  - [ ]* 18.9 Write property test for device operation audit logging
    - **Property 19: Device Operation Audit Logging**
    - **Validates: Requirements 15.3**

- [ ] 19. End-to-end integration tests
  - [ ]* 19.1 Write E2E test for user subscription flow
    - Test user signup → subscription assignment → feature access
    - _Requirements: 1.1, 1.2, 7.1_
  
  - [ ]* 19.2 Write E2E test for SuperAdmin override flow
    - Test SuperAdmin creates override → user gains/loses access
    - _Requirements: 2.1, 2.4, 6.3, 6.4_
  
  - [x]* 19.3 Write E2E test for mobile device flow
    - Test device registration → sync → offline access → sync again
    - _Requirements: 3.1, 7.3, 13.1, 13.2, 13.3_
  
  - [x]* 19.4 Write E2E test for device limit flow
    - Test limit reached → rejection → inactive cleanup → new device succeeds
    - _Requirements: 3.1, 3.2, 3.3, 14.3_
  
  - [ ]* 19.5 Write E2E test for demo expiry flow
    - Test demo active → features available → demo expires → features locked → upgrade → features unlocked
    - _Requirements: 4.1, 4.2, 4.4, 12.5_

- [ ] 20. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties with minimum 100 iterations
- Unit tests validate specific examples and edge cases
- Integration tests validate API contracts and service interactions
- E2E tests validate complete user flows
- Backend uses FastAPI with async/await, SQLAlchemy, PostgreSQL, Redis
- Frontend uses Next.js 16+ App Router, React Query, Tailwind CSS
- Mobile uses React Native, WatermelonDB for offline support
- All code must pass linting, type checking, and build before commit
