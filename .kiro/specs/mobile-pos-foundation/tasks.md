# Implementation Tasks: Mobile POS Foundation

## Task 1: Monorepo Configuration
- [x] 1.1 Update root `pnpm-workspace.yaml` to include `mobile/` directory
- [x] 1.2 Create `mobile/package.json` with workspace dependencies
- [x] 1.3 Update `shared/` package to export types for mobile consumption
- [x] 1.4 Configure root-level scripts for mobile development (`pnpm mobile:*`)
- [x] 1.5 Add mobile-specific ESLint and Prettier configurations

**Validates: Requirement 1**

## Task 2: Expo Project Initialization
- [x] 2.1 Initialize Expo project with `npx create-expo-app@latest mobile --template tabs`
- [x] 2.2 Configure `app.json` with app name, bundle identifiers, and SDK version
- [x] 2.3 Set up Expo Router file-based navigation structure
- [x] 2.4 Configure TypeScript with strict mode (`tsconfig.json`)
- [x] 2.5 Create `eas.json` for EAS Build configuration (dev, preview, production profiles)
- [x] 2.6 Set up environment variables with `expo-constants` and `.env` files

**Validates: Requirement 2**

## Task 3: NativeWind UI Setup
- [x] 3.1 Install NativeWind and configure `tailwind.config.js`
- [x] 3.2 Configure Metro bundler for NativeWind (`metro.config.js`)
- [x] 3.3 Set up global styles and dark theme matching web app
- [x] 3.4 Create base UI components: Button, Card, Input, Badge
- [x] 3.5 Create Modal and BottomSheet components
- [x] 3.6 Implement LoadingSpinner and Skeleton components
- [x] 3.7 Configure haptic feedback utilities

**Validates: Requirement 6**

## Task 4: WatermelonDB Setup
- [x] 4.1 Install WatermelonDB and native dependencies
- [x] 4.2 Create database schema (`db/schema.ts`) with all tables
- [x] 4.3 Create model classes: Product, Category, Order, OrderItem
- [x] 4.4 Create model classes: Customer, User, SyncQueue, Settings
- [x] 4.5 Set up database initialization and provider
- [x] 4.6 Create initial migration file (`db/migrations.ts`)
- [x] 4.7 Write unit tests for database operations

**Validates: Requirement 3**

## Task 5: API Client Setup
- [x] 5.1 Create Axios-based API client with base configuration
- [x] 5.2 Implement request/response interceptors for auth tokens
- [x] 5.3 Create API modules: auth, products, orders, customers
- [x] 5.4 Implement error handling and retry logic
- [x] 5.5 Add request cancellation support
- [x] 5.6 Write unit tests for API client

**Validates: Requirement 8**

## Task 6: Authentication Service
- [x] 6.1 Create SecureStorage wrapper using `expo-secure-store`
- [x] 6.2 Implement AuthService with login/logout methods
- [x] 6.3 Implement token refresh logic
- [x] 6.4 Create PIN-based quick login functionality
- [x] 6.5 Add biometric authentication support (optional)
- [x] 6.6 Implement auto-logout on inactivity
- [x] 6.7 Create auth Zustand store
- [x] 6.8 Write unit tests for auth service

**Validates: Requirement 5**

## Task 7: Sync Engine Implementation
- [x] 7.1 Create SyncQueue model and operations
- [x] 7.2 Implement network connectivity detection hook
- [x] 7.3 Create SyncService with push/pull logic
- [x] 7.4 Implement conflict resolution (last-write-wins)
- [x] 7.5 Add sync status indicators and Zustand store
- [x] 7.6 Implement background sync on connectivity restore
- [x] 7.7 Add manual sync trigger functionality
- [x] 7.8 Write property-based tests for sync idempotency

**Validates: Requirement 4**

## Task 8: Navigation Structure
- [x] 8.1 Set up root layout with providers (`app/_layout.tsx`)
- [x] 8.2 Create auth screens layout (`app/(auth)/_layout.tsx`)
- [x] 8.3 Create main tabs layout (`app/(tabs)/_layout.tsx`)
- [x] 8.4 Implement protected route middleware
- [x] 8.5 Add deep linking configuration
- [x] 8.6 Implement navigation state persistence

**Validates: Requirement 7**

## Task 9: State Management
- [x] 9.1 Create cart Zustand store with persistence
- [x] 9.2 Create settings Zustand store
- [x] 9.3 Create sync status Zustand store
- [x] 9.4 Implement state hydration on app launch
- [x] 9.5 Add optimistic update utilities
- [x] 9.6 Write unit tests for cart calculations

**Validates: Requirement 9**

## Task 10: Auth Screens
- [x] 10.1 Create Login screen with email/password form
- [x] 10.2 Create PIN entry screen for quick login
- [x] 10.3 Add biometric prompt integration
- [x] 10.4 Implement form validation
- [x] 10.5 Add loading states and error handling

**Validates: Requirement 5**

## Task 11: Main Tab Screens (Shells)
- [x] 11.1 Create POS/Sales screen shell with product grid placeholder
- [x] 11.2 Create Orders list screen shell
- [x] 11.3 Create Products catalog screen shell
- [x] 11.4 Create Customers list screen shell
- [x] 11.5 Create Settings screen shell
- [x] 11.6 Add tab bar icons and styling

**Validates: Requirement 7**

## Task 12: Database Hooks
- [x] 12.1 Create `useProducts` hook with WatermelonDB queries
- [x] 12.2 Create `useCategories` hook
- [x] 12.3 Create `useOrders` hook
- [x] 12.4 Create `useCustomers` hook
- [x] 12.5 Create `useDatabase` provider hook
- [x] 12.6 Add query caching and optimization

**Validates: Requirement 3**

## Task 13: Error Handling & Logging
- [x] 13.1 Create global ErrorBoundary component
- [x] 13.2 Set up Sentry for error logging (or similar)
- [x] 13.3 Create user-friendly error display components
- [x] 13.4 Implement error recovery utilities
- [x] 13.5 Add action logging for debugging

**Validates: Requirement 10**

## Task 14: Performance Optimization
- [x] 14.1 Configure FlashList for virtualized lists
- [x] 14.2 Set up image caching with `expo-image`
- [x] 14.3 Implement lazy loading for screens
- [x] 14.4 Add app state handling (background/foreground)
- [x] 14.5 Profile and optimize startup time

**Validates: Requirement 11**

## Task 15: Testing Setup
- [x] 15.1 Configure Jest for unit testing
- [x] 15.2 Set up React Native Testing Library
- [x] 15.3 Create test utilities and mocks
- [x] 15.4 Set up Maestro for E2E testing
- [x] 15.5 Write E2E test for login flow
- [x] 15.6 Write E2E test for basic navigation

**Validates: Requirement 12**

## Task 16: Property-Based Tests
- [x] 16.1 Write PBT for offline data persistence (Property 1)
- [x] 16.2 Write PBT for sync idempotency (Property 2)
- [x] 16.3 Write PBT for cart calculation accuracy (Property 3)
- [x] 16.4 Write PBT for network state accuracy (Property 6)

**Validates: Correctness Properties 1, 2, 3, 6**

## Task 17: Documentation
- [x] 17.1 Create `mobile/README.md` with setup instructions
- [x] 17.2 Document environment variable configuration
- [x] 17.3 Document build and deployment process
- [x] 17.4 Add inline code documentation

**Validates: Requirement 12**

## Task 18: Final Integration Checkpoint
- [x] 18.1 Verify monorepo builds successfully (`pnpm build`)
- [x] 18.2 Verify mobile app runs on iOS simulator
- [x] 18.3 Verify mobile app runs on Android emulator
- [x] 18.4 Verify shared types work between web and mobile
- [x] 18.5 Run all tests and ensure passing
- [x] 18.6 Create EAS preview build

**Validates: All Requirements**

## Task 19: Database Migration and Seeding
- [x] 19.1 Run all Alembic migrations locally
  - Execute `alembic upgrade head` in backend directory
  - Verify mobile-related tables created correctly
  - _Requirements: Database Schema_

- [x] 19.2 Seed database with test data
  - Create seed script for mobile sync data
  - Execute seeding scripts locally
  - _Requirements: Testing Data_

## Task 20: Local Testing and Build Verification
- [x] 20.1 Run backend test suite
  - Execute `pytest` in backend directory
  - Ensure all unit tests pass
  - Ensure all property-based tests pass
  - Fix any failing tests before proceeding
  - _Requirements: Code Quality_

- [x] 20.2 Run frontend test suite
  - Execute `npm test` in frontend directory
  - Ensure all component tests pass
  - Fix any failing tests before proceeding
  - _Requirements: Code Quality_

- [x] 20.3 Run mobile test suite
  - Execute `npm test` in mobile directory
  - Ensure all mobile tests pass
  - Fix any failing tests before proceeding
  - _Requirements: Code Quality_

- [x] 20.4 Build verification
  - Execute `npm run build` in frontend directory
  - Execute backend build process
  - Execute `expo build` for mobile app
  - Ensure no build errors
  - Fix any build issues before proceeding
  - _Requirements: Deployment Readiness_

## Task 21: Deployment Workflow
- [x] 21.1 Push to dev branch
  - Commit all changes with descriptive messages
  - Push to dev branch: `git push origin dev`
  - Only proceed after local testing and build verification complete
  - _Requirements: Version Control_

- [x] 21.2 Monitor deployment with MCP servers
  - Use MCP deployment monitoring tools
  - Poll deployment status every 30 seconds
  - Wait for deployment to complete successfully
  - _Requirements: Deployment Monitoring_

- [x] 21.3 Handle deployment failures
  - If deployment fails, analyze error logs
  - Fix issues locally
  - Re-run local testing and build verification
  - Push fixes and repeat monitoring
  - Continue until deployment succeeds
  - _Requirements: Deployment Reliability_

## Task 22: Final Checkpoint
- Ensure all tests pass
- Verify mobile POS foundation works end-to-end
- Confirm successful deployment
- Ask the user if questions arise
