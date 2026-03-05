# Implementation Tasks: Order Management

## Task 1: Order Schema Extension
- [x] 1.1 Add order_type to orders table
- [x] 1.2 Add table_id to orders table
- [x] 1.3 Add delivery fields to orders
- [x] 1.4 Create tables table
- [x] 1.5 Create order_status_history table
- [x] 1.6 Write database migration

**Validates: Requirements 1, 2, 3**

## Task 2: Order Management Service
- [x] 2.1 Create OrderManagementService
- [x] 2.2 Implement order type handling
- [x] 2.3 Implement status tracking
- [x] 2.4 Write PBT for status progression (Property 2)

**Validates: Requirements 1, 3**

## Task 3: Table Service
- [x] 3.1 Create TableService class
- [x] 3.2 Implement table CRUD
- [x] 3.3 Implement status management
- [x] 3.4 Write PBT for table-order consistency (Property 1)

**Validates: Requirement 2**

## Task 4: Table UI
- [x] 4.1 Create floor plan component
- [x] 4.2 Display table status visually
- [x] 4.3 Implement table selection
- [x] 4.4 Show table order summary

**Validates: Requirement 2**

## Task 5: Table Operations
- [x] 5.1 Implement table transfer
- [x] 5.2 Implement table merge
- [x] 5.3 Implement table split
- [x] 5.4 Write PBT for split integrity (Property 3)

**Validates: Requirement 2**

## Task 6: Order Status Tracking
- [x] 6.1 Create status tracking UI
- [x] 6.2 Display order age/wait time
- [x] 6.3 Alert on long wait times
- [x] 6.4 Show status on POS

**Validates: Requirement 3**

## Task 7: KDS Integration
- [x] 7.1 Create KDSService class
- [x] 7.2 Implement send to KDS
- [x] 7.3 Implement bump/recall
- [x] 7.4 Create KDS display screen
- [x] 7.5 Support multiple stations

**Validates: Requirement 4**

## Task 8: SlipApp Integration
- [ ] 8.1 Integrate SlipApp SDK
- [ ] 8.2 Configure printer routing
- [ ] 8.3 Format kitchen tickets
- [ ] 8.4 Support reprint

**Validates: Requirement 5**

## Task 9: Order Modifications
- [x] 9.1 Implement add items to order
- [x] 9.2 Implement remove items
- [x] 9.3 Require manager approval
- [x] 9.4 Track modifications
- [x] 9.5 Reprint modified items

**Validates: Requirement 6**

## Task 10: Course Management
- [x] 10.1 Add course support to orders
- [x] 10.2 Implement fire by course
- [x] 10.3 Display course on tickets
- [x] 10.4 Support default course per item

**Validates: Requirement 7**

## Task 11: Tab Management
- [x] 11.1 Implement open tab
- [x] 11.2 Support adding to tab
- [ ] 11.3 Alert on old tabs
- [x] 11.4 Require tab close before payment

**Validates: Requirement 8**

## Task 12: Delivery Orders
- [x] 12.1 Capture delivery address
- [x] 12.2 Assign driver
- [x] 12.3 Track delivery status
- [ ] 12.4 Calculate delivery fee

**Validates: Requirement 9**

## Task 13: Order History
- [x] 13.1 Create order history screen
- [x] 13.2 Implement search and filter
- [x] 13.3 Show order details
- [x] 13.4 Support reprint and refund

**Validates: Requirement 10**

## Task 14: Database Migration and Seeding
- [ ] 14.1 Run all Alembic migrations locally
  - Execute `alembic upgrade head` in backend directory
  - Verify order management tables created correctly
  - _Requirements: Database Schema_

- [ ] 14.2 Seed database with test data
  - Create seed script for tables and order types
  - Create seed script for sample orders
  - Execute seeding scripts locally
  - _Requirements: Testing Data_

## Task 15: Local Testing and Build Verification
- [ ] 15.1 Run backend test suite
  - Execute `pytest` in backend directory
  - Ensure all unit tests pass
  - Ensure all property-based tests pass
  - Fix any failing tests before proceeding
  - _Requirements: Code Quality_

- [ ] 15.2 Run frontend test suite
  - Execute `npm test` in frontend directory
  - Ensure all component tests pass
  - Fix any failing tests before proceeding
  - _Requirements: Code Quality_

- [ ] 15.3 Build verification
  - Execute `npm run build` in frontend directory
  - Execute backend build process
  - Ensure no build errors
  - Fix any build issues before proceeding
  - _Requirements: Deployment Readiness_

## Task 16: Deployment Workflow
- [ ] 16.1 Push to dev branch
  - Commit all changes with descriptive messages
  - Push to dev branch: `git push origin dev`
  - Only proceed after local testing and build verification complete
  - _Requirements: Version Control_

- [ ] 16.2 Monitor deployment with MCP servers
  - Use MCP deployment monitoring tools
  - Poll deployment status every 30 seconds
  - Wait for deployment to complete successfully
  - _Requirements: Deployment Monitoring_

- [ ] 16.3 Handle deployment failures
  - If deployment fails, analyze error logs
  - Fix issues locally
  - Re-run local testing and build verification
  - Push fixes and repeat monitoring
  - Continue until deployment succeeds
  - _Requirements: Deployment Reliability_

## Task 17: Final Checkpoint
- Ensure all tests pass
- Verify order management features work end-to-end
- Confirm successful deployment
- Ask the user if questions arise
