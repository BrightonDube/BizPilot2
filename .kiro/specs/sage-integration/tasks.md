# Implementation Tasks: Sage Integration

## Task 1: Database Schema
- [ ] 1.1 Create Alembic migration for sage_connections table
- [ ] 1.2 Create Alembic migration for sage_account_mappings table
- [ ] 1.3 Create Alembic migration for sage_sync_logs table
- [ ] 1.4 Create Alembic migration for sage_sync_queue table
- [ ] 1.5 Add indexes for performance

**Validates: All Requirements**

## Task 2: SQLAlchemy Models
- [ ] 2.1 Create SageConnection model
- [ ] 2.2 Create SageAccountMapping model
- [ ] 2.3 Create SageSyncLog model
- [ ] 2.4 Create SageSyncQueue model

**Validates: All Requirements**

## Task 3: Pydantic Schemas
- [ ] 3.1 Create connection schemas
- [ ] 3.2 Create account mapping schemas
- [ ] 3.3 Create sync schemas
- [ ] 3.4 Create journal entry schemas
- [ ] 3.5 Create report schemas

**Validates: All Requirements**

## Task 4: Sage API Client
- [ ] 4.1 Implement OAuth flow
- [ ] 4.2 Implement token refresh
- [ ] 4.3 Implement API request wrapper
- [ ] 4.4 Implement rate limiting
- [ ] 4.5 Implement error handling
- [ ] 4.6 Write unit tests for API client

**Validates: Requirement 1**

## Task 5: Connection Service
- [ ] 5.1 Implement connection setup
- [ ] 5.2 Implement connection validation
- [ ] 5.3 Implement credential storage
- [ ] 5.4 Implement disconnection
- [ ] 5.5 Write unit tests for connection

**Validates: Requirement 1**

## Task 6: Account Mapping Service
- [ ] 6.1 Implement chart of accounts fetch
- [ ] 6.2 Implement mapping CRUD
- [ ] 6.3 Implement default mappings
- [ ] 6.4 Implement tax code mapping
- [ ] 6.5 Implement mapping validation
- [ ] 6.6 Write unit tests for mapping

**Validates: Requirement 2**

## Task 7: Invoice Sync Service
- [ ] 7.1 Implement sales invoice sync
- [ ] 7.2 Implement purchase invoice sync
- [ ] 7.3 Implement line item mapping
- [ ] 7.4 Implement tax calculation
- [ ] 7.5 Implement update handling
- [ ] 7.6 Write unit tests for invoice sync

**Validates: Requirement 3**

## Task 8: Payment Sync Service
- [ ] 8.1 Implement customer payment sync
- [ ] 8.2 Implement supplier payment sync
- [ ] 8.3 Implement payment matching
- [ ] 8.4 Implement partial payment handling
- [ ] 8.5 Write unit tests for payment sync

**Validates: Requirement 4**

## Task 9: Journal Entry Service
- [ ] 9.1 Implement daily sales journal creation
- [ ] 9.2 Implement payment method breakdown
- [ ] 9.3 Implement tax breakdown
- [ ] 9.4 Implement COGS journal creation
- [ ] 9.5 Implement journal posting
- [ ] 9.6 Write unit tests for journals

**Validates: Requirements 5, 6**

## Task 10: Sync Management Service
- [ ] 10.1 Implement sync queue management
- [ ] 10.2 Implement manual sync trigger
- [ ] 10.3 Implement scheduled sync job
- [ ] 10.4 Implement retry logic
- [ ] 10.5 Implement selective sync
- [ ] 10.6 Write unit tests for sync management

**Validates: Requirement 7**

## Task 11: API Endpoints - Connection
- [ ] 11.1 Create OAuth callback endpoint
- [ ] 11.2 Create connection status endpoint
- [ ] 11.3 Create disconnect endpoint
- [ ] 11.4 Create validation endpoint

**Validates: Requirement 1**

## Task 12: API Endpoints - Mapping & Sync
- [ ] 12.1 Create chart of accounts endpoint
- [ ] 12.2 Create mapping CRUD endpoints
- [ ] 12.3 Create sync trigger endpoint
- [ ] 12.4 Create sync status endpoint
- [ ] 12.5 Create sync history endpoint

**Validates: Requirements 2, 7**

## Task 13: API Endpoints - Reports
- [ ] 13.1 Create sync activity report endpoint
- [ ] 13.2 Create error report endpoint
- [ ] 13.3 Create reconciliation endpoint
- [ ] 13.4 Create export endpoint

**Validates: Requirement 8**

## Task 14: Scheduled Jobs
- [ ] 14.1 Create scheduled sync job
- [ ] 14.2 Create daily journal job
- [ ] 14.3 Create retry failed syncs job
- [ ] 14.4 Create token refresh job

**Validates: Requirements 5, 7**

## Task 15: Frontend - Connection Setup
- [ ] 15.1 Create Sage connection page
- [x] 15.2 Create OAuth flow UI
- [ ] 15.3 Create connection status display
- [ ] 15.4 Create disconnect confirmation

**Validates: Requirement 1**

## Task 16: Frontend - Account Mapping
- [ ] 16.1 Create account mapping page
- [ ] 16.2 Create mapping editor
- [ ] 16.3 Create tax code mapping UI
- [ ] 16.4 Create validation display

**Validates: Requirement 2**

## Task 17: Frontend - Sync Management
- [ ] 17.1 Create sync dashboard
- [ ] 17.2 Create sync history view
- [ ] 17.3 Create error display
- [x] 17.4 Create manual sync UI
- [ ] 17.5 Create sync settings page

**Validates: Requirements 7, 8**

## Task 18: Property-Based Tests
- [ ] 18.1 Write PBT for invoice total accuracy
- [ ] 18.2 Write PBT for payment matching
- [ ] 18.3 Write PBT for journal balance

**Validates: Correctness Properties**

## Task 19: Integration Testing
- [ ] 19.1 Test OAuth flow with Sage sandbox
- [ ] 19.2 Test invoice sync end-to-end
- [ ] 19.3 Test payment sync end-to-end
- [ ] 19.4 Test journal posting

**Validates: All Requirements**

## Task 20: Database Migration and Seeding
- [ ] 20.1 Run all Alembic migrations locally
  - Execute `alembic upgrade head` in backend directory
  - Verify Sage integration tables created correctly
  - _Requirements: Database Schema_

- [ ] 20.2 Seed database with test data
  - Create seed script for Sage connections
  - Create seed script for account mappings
  - Execute seeding scripts locally
  - _Requirements: Testing Data_

## Task 21: Local Testing and Build Verification
- [ ] 21.1 Run backend test suite
  - Execute `pytest` in backend directory
  - Ensure all unit tests pass
  - Ensure all property-based tests pass
  - Fix any failing tests before proceeding
  - _Requirements: Code Quality_

- [ ] 21.2 Run frontend test suite
  - Execute `npm test` in frontend directory
  - Ensure all component tests pass
  - Fix any failing tests before proceeding
  - _Requirements: Code Quality_

- [ ] 21.3 Build verification
  - Execute `npm run build` in frontend directory
  - Execute backend build process
  - Ensure no build errors
  - Fix any build issues before proceeding
  - _Requirements: Deployment Readiness_

## Task 22: Deployment Workflow
- [ ] 22.1 Push to dev branch
  - Commit all changes with descriptive messages
  - Push to dev branch: `git push origin dev`
  - Only proceed after local testing and build verification complete
  - _Requirements: Version Control_

- [ ] 22.2 Monitor deployment with MCP servers
  - Use MCP deployment monitoring tools
  - Poll deployment status every 30 seconds
  - Wait for deployment to complete successfully
  - _Requirements: Deployment Monitoring_

- [ ] 22.3 Handle deployment failures
  - If deployment fails, analyze error logs
  - Fix issues locally
  - Re-run local testing and build verification
  - Push fixes and repeat monitoring
  - Continue until deployment succeeds
  - _Requirements: Deployment Reliability_

## Task 23: Final Checkpoint
- Ensure all tests pass
- Verify Sage integration features work end-to-end
- Confirm successful deployment
- Ask the user if questions arise
