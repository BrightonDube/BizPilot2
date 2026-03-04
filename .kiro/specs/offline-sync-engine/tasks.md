# Implementation Tasks: Offline-First Sync Engine

## Task 1: Network Monitor
- [x] 1.1 Install `@react-native-community/netinfo`
- [x] 1.2 Create NetworkMonitor class with state tracking
- [x] 1.3 Implement connectivity change listeners
- [x] 1.4 Add server reachability check
- [x] 1.5 Create `useNetworkStatus` hook
- [x] 1.6 Write unit tests for network state changes

**Validates: Requirement 1**

## Task 2: Sync Queue Database
- [x] 2.1 Add sync_queue table to WatermelonDB schema
- [x] 2.2 Create SyncQueueItem model
- [x] 2.3 Create database migration for sync_queue
- [x] 2.4 Write unit tests for queue model

**Validates: Requirement 3**

## Task 3: Sync Queue Service
- [x] 3.1 Create SyncQueue class with enqueue/dequeue
- [x] 3.2 Implement markProcessed and markFailed methods
- [x] 3.3 Implement getPendingCount and getFailedItems
- [x] 3.4 Add dead letter queue handling
- [x] 3.5 Write unit tests for queue operations
- [x] 3.6 Write PBT for queue ordering (Property 4)

**Validates: Requirement 3**

## Task 4: Change Tracking
- [x] 4.1 Add is_dirty column to all syncable models
- [x] 4.2 Create model decorators/hooks for dirty tracking
- [x] 4.3 Implement automatic queue enqueue on model changes
- [x] 4.4 Add synced_at timestamp tracking
- [x] 4.5 Write unit tests for change tracking
- [x] 4.6 Write PBT for change preservation (Property 2)

**Validates: Requirement 2**

## Task 5: Conflict Resolver
- [x] 5.1 Create ConflictResolver class
- [x] 5.2 Implement server-wins strategy
- [x] 5.3 Implement client-wins strategy
- [x] 5.4 Implement last-write-wins strategy
- [x] 5.5 Add conflict logging
- [x] 5.6 Write unit tests for each strategy
- [x] 5.7 Write PBT for conflict consistency (Property 3)

**Validates: Requirement 6**

## Task 6: Push Handler
- [x] 6.1 Create PushHandler class
- [x] 6.2 Implement batch processing logic
- [x] 6.3 Implement create/update/delete push operations
- [x] 6.4 Handle remote_id updates for new records
- [x] 6.5 Implement retry with exponential backoff
- [x] 6.6 Write unit tests for push operations

**Validates: Requirement 4**

## Task 7: Pull Handler
- [x] 7.1 Create PullHandler class
- [x] 7.2 Implement delta sync (since timestamp)
- [x] 7.3 Implement pagination for large datasets
- [x] 7.4 Apply remote changes to local database
- [x] 7.5 Integrate conflict resolver
- [x] 7.6 Write unit tests for pull operations

**Validates: Requirement 5**

## Task 8: Sync Service
- [x] 8.1 Create SyncService class
- [x] 8.2 Implement sync lock mechanism
- [x] 8.3 Implement full sync flow (push then pull)
- [x] 8.4 Add sync state management
- [x] 8.5 Implement entity-specific sync
- [x] 8.6 Write integration tests for full sync
- [x] 8.7 Write PBT for sync idempotency (Property 1)

**Validates: Requirements 4, 5, 6**

## Task 9: Sync Scheduler
- [x] 9.1 Create SyncScheduler class
- [x] 9.2 Implement periodic sync interval
- [x] 9.3 Implement sync on connectivity restore
- [x] 9.4 Implement sync on app foreground
- [x] 9.5 Add debouncing for rapid connectivity changes
- [x] 9.6 Write unit tests for scheduler

**Validates: Requirement 7**

## Task 10: Manual Sync
- [x] 10.1 Create manual sync trigger function
- [x] 10.2 Implement sync cancellation
- [x] 10.3 Add progress tracking
- [x] 10.4 Write unit tests for manual sync

**Validates: Requirement 8**

## Task 11: Sync Status Store
- [x] 11.1 Create sync Zustand store
- [x] 11.2 Track sync status (idle, syncing, error)
- [x] 11.3 Track pending changes count
- [x] 11.4 Track last sync timestamp
- [x] 11.5 Track per-entity sync status

**Validates: Requirement 9**

## Task 12: Sync Status UI Components
- [x] 12.1 Create SyncStatusIndicator component
- [x] 12.2 Create OnlineOfflineIndicator component
- [x] 12.3 Create PendingChangesCount component
- [x] 12.4 Create SyncErrorAlert component
- [x] 12.5 Create ManualSyncButton component

**Validates: Requirement 9**

## Task 13: Data Integrity
- [x] 13.1 Implement database transactions for sync
- [x] 13.2 Implement rollback on partial failures
- [x] 13.3 Add data validation before applying changes
- [x] 13.4 Handle schema version mismatches
- [x] 13.5 Write PBT for transaction atomicity (Property 5)

**Validates: Requirement 10**

## Task 14: Sync Metadata
- [x] 14.1 Add sync_metadata table to schema
- [x] 14.2 Track last sync timestamp per entity
- [x] 14.3 Track sync statistics
- [x] 14.4 Write unit tests for metadata

**Validates: Requirements 5, 9**

## Task 15: Backend Sync Endpoints
- [ ] 15.1 Create `/sync/{entity}` POST endpoint for push
- [ ] 15.2 Create `/sync/{entity}` GET endpoint for pull (with since param)
- [ ] 15.3 Add batch support to endpoints
- [ ] 15.4 Add conflict detection on server
- [ ] 15.5 Write API tests for sync endpoints

**Validates: Requirements 4, 5**

## Task 16: Integration Testing
- [ ] 16.1 Write E2E test for offline to online sync
- [ ] 16.2 Write E2E test for conflict resolution
- [ ] 16.3 Write E2E test for multi-device sync
- [ ] 16.4 Test sync recovery after crash

**Validates: All Requirements**

## Task 17: Database Migration and Seeding
- [ ] 17.1 Run all Alembic migrations locally
  - Execute `alembic upgrade head` in backend directory
  - Verify sync engine tables created correctly
  - _Requirements: Database Schema_

- [ ] 17.2 Seed database with test data
  - Create seed script for sync queue data
  - Execute seeding scripts locally
  - _Requirements: Testing Data_

## Task 18: Local Testing and Build Verification
- [ ] 18.1 Run backend test suite
  - Execute `pytest` in backend directory
  - Ensure all unit tests pass
  - Ensure all property-based tests pass
  - Fix any failing tests before proceeding
  - _Requirements: Code Quality_

- [ ] 18.2 Run mobile test suite
  - Execute `npm test` in mobile directory
  - Ensure all mobile tests pass
  - Fix any failing tests before proceeding
  - _Requirements: Code Quality_

- [ ] 18.3 Build verification
  - Execute backend build process
  - Execute `expo build` for mobile app
  - Ensure no build errors
  - Fix any build issues before proceeding
  - _Requirements: Deployment Readiness_

## Task 19: Deployment Workflow
- [ ] 19.1 Push to dev branch
  - Commit all changes with descriptive messages
  - Push to dev branch: `git push origin dev`
  - Only proceed after local testing and build verification complete
  - _Requirements: Version Control_

- [ ] 19.2 Monitor deployment with MCP servers
  - Use MCP deployment monitoring tools
  - Poll deployment status every 30 seconds
  - Wait for deployment to complete successfully
  - _Requirements: Deployment Monitoring_

- [ ] 19.3 Handle deployment failures
  - If deployment fails, analyze error logs
  - Fix issues locally
  - Re-run local testing and build verification
  - Push fixes and repeat monitoring
  - Continue until deployment succeeds
  - _Requirements: Deployment Reliability_

## Task 20: Final Checkpoint
- Ensure all tests pass
- Verify offline-first sync engine works end-to-end
- Confirm successful deployment
- Ask the user if questions arise
