# Implementation Tasks: Point of Sale Core

## Task 1: Cart Store Implementation
- [x] 1.1 Create cart Zustand store with state and actions
- [x] 1.2 Implement cart persistence with MMKV
- [x] 1.3 Create cart selectors for computed values (subtotal, tax, total)
- [x] 1.4 Write unit tests for cart calculations
- [x] 1.5 Write PBT for cart total accuracy (Property 1)

**Validates: Requirements 3, 4**

## Task 2: Price Calculator
- [x] 2.1 Create `calculateLineTotal` function
- [x] 2.2 Create `calculateCartTotals` function
- [x] 2.3 Implement tax-inclusive and tax-exclusive modes
- [x] 2.4 Implement rounding to 2 decimal places
- [x] 2.5 Write comprehensive unit tests
- [x] 2.6 Write PBT for calculation accuracy

**Validates: Requirement 4**

## Task 3: Product Grid Component
- [x] 3.1 Create ProductCard component with image, name, price
- [x] 3.2 Create ProductGrid using FlashList
- [x] 3.3 Implement out-of-stock visual indicator
- [x] 3.4 Add tap handler to add to cart
- [x] 3.5 Implement loading skeleton

**Validates: Requirement 1**

## Task 4: Category Navigation
- [x] 4.1 Create CategoryTabs component
- [x] 4.2 Implement category filtering logic
- [x] 4.3 Support nested categories display
- [x] 4.4 Add "All Products" option
- [x] 4.5 Persist last selected category

**Validates: Requirement 2**

## Task 5: Product Search
- [x] 5.1 Create SearchBar component with debounce
- [x] 5.2 Implement search by name, SKU, barcode
- [x] 5.3 Create search results dropdown
- [x] 5.4 Add recent searches feature
- [x] 5.5 Integrate barcode scanner

**Validates: Requirements 1.4, 1.6**

## Task 6: Cart Panel Component
- [x] 6.1 Create CartPanel container component
- [x] 6.2 Create CartItem component with quantity controls
- [x] 6.3 Create CartTotals component
- [x] 6.4 Implement swipe-to-delete for items
- [x] 6.5 Add item notes input
- [x] 6.6 Add item discount input

**Validates: Requirement 3**

## Task 7: Customer Selector
- [x] 7.1 Create CustomerSelector component
- [x] 7.2 Implement customer search
- [x] 7.3 Create quick-add customer modal
- [x] 7.4 Display customer loyalty points
- [x] 7.5 Add remove customer action

**Validates: Requirement 5**

## Task 8: Payment Modal
- [x] 8.1 Create PaymentModal component
- [x] 8.2 Create PaymentMethodSelector (cash, card, etc.)
- [x] 8.3 Create AmountInput with numpad
- [x] 8.4 Create QuickAmountButtons (exact, round up)
- [x] 8.5 Implement change calculation for cash
- [x] 8.6 Implement split payment flow
- [x] 8.7 Write PBT for payment validation (Property 2)

**Validates: Requirement 6**

## Task 9: Order Service
- [x] 9.1 Create OrderService class
- [x] 9.2 Implement `createOrder` method
- [x] 9.3 Implement order number generation
- [x] 9.4 Implement inventory update on sale
- [x] 9.5 Implement sync queue integration
- [x] 9.6 Write unit tests for order creation
- [x] 9.7 Write PBT for order number uniqueness (Property 4)

**Validates: Requirement 7**

## Task 10: Receipt Generation
- [x] 10.1 Create ReceiptService class
- [x] 10.2 Create digital receipt component
- [x] 10.3 Implement receipt data formatting
- [x] 10.4 Add Bluetooth printer integration
- [x] 10.5 Add email receipt functionality

**Validates: Requirement 8**

## Task 11: Order Void
- [x] 11.1 Create VoidOrderModal component
- [x] 11.2 Implement void reason selection
- [x] 11.3 Implement manager PIN verification
- [x] 11.4 Implement inventory restoration
- [x] 11.5 Write PBT for inventory consistency (Property 3)

**Validates: Requirement 9**

## Task 12: Quick Actions
- [x] 12.1 Create FavoriteProducts component
- [x] 12.2 Implement hold/recall cart functionality
- [x] 12.3 Create RecentOrders quick access
- [x] 12.4 Add keyboard shortcuts support

**Validates: Requirement 10**

## Task 13: POS Screen Integration
- [x] 13.1 Create main POS screen layout
- [x] 13.2 Integrate all components
- [x] 13.3 Implement responsive layout (phone/tablet)
- [x] 13.4 Add loading and error states
- [ ] 13.5 Write E2E test for complete sale flow

**Validates: All Requirements**

## Task 14: Offline Support
- [ ] 14.1 Verify all operations work offline
- [ ] 14.2 Test order sync after reconnection
- [x] 14.3 Write PBT for offline persistence (Property 5)

**Validates: Requirements 6.7, 7.6**

## Task 15: Database Migration and Seeding
- [ ] 15.1 Run all Alembic migrations locally
  - Execute `alembic upgrade head` in backend directory
  - Verify POS core tables created correctly
  - _Requirements: Database Schema_

- [ ] 15.2 Seed database with test data
  - Create seed script for products and categories
  - Create seed script for sample orders
  - Execute seeding scripts locally
  - _Requirements: Testing Data_

## Task 16: Local Testing and Build Verification
- [ ] 16.1 Run backend test suite
  - Execute `pytest` in backend directory
  - Ensure all unit tests pass
  - Ensure all property-based tests pass
  - Fix any failing tests before proceeding
  - _Requirements: Code Quality_

- [ ] 16.2 Run mobile test suite
  - Execute `npm test` in mobile directory
  - Ensure all mobile tests pass
  - Fix any failing tests before proceeding
  - _Requirements: Code Quality_

- [ ] 16.3 Build verification
  - Execute backend build process
  - Execute `expo build` for mobile app
  - Ensure no build errors
  - Fix any build issues before proceeding
  - _Requirements: Deployment Readiness_

## Task 17: Deployment Workflow
- [ ] 17.1 Push to dev branch
  - Commit all changes with descriptive messages
  - Push to dev branch: `git push origin dev`
  - Only proceed after local testing and build verification complete
  - _Requirements: Version Control_

- [ ] 17.2 Monitor deployment with MCP servers
  - Use MCP deployment monitoring tools
  - Poll deployment status every 30 seconds
  - Wait for deployment to complete successfully
  - _Requirements: Deployment Monitoring_

- [ ] 17.3 Handle deployment failures
  - If deployment fails, analyze error logs
  - Fix issues locally
  - Re-run local testing and build verification
  - Push fixes and repeat monitoring
  - Continue until deployment succeeds
  - _Requirements: Deployment Reliability_

## Task 18: Final Checkpoint
- Ensure all tests pass
- Verify POS core features work end-to-end
- Confirm successful deployment
- Ask the user if questions arise

---

## AI Integration Tasks (Optional - Ship Core First)

### Task 19: Smart Cart Assistant - Local Cache
- [x] 19.1 Create AssociationRule model in WatermelonDB
- [x] 19.2 Create SmartCartAssistant service class
- [x] 19.3 Implement loadCachedRules method
- [x] 19.4 Implement getSuggestions method (< 100ms)
- [x] 19.5 Write unit tests for suggestion logic
- [x] 19.6 Write PBT for suggestion latency (Property 6)

**Validates: Requirement 11 (AI)**

### Task 20: Suggestion UI Component
- [x] 20.1 Create SuggestionBanner component
- [x] 20.2 Implement non-intrusive display (bottom of cart)
- [x] 20.3 Add dismiss action
- [x] 20.4 Add "Add to Cart" quick action
- [x] 20.5 Track suggestion metrics (shown/accepted)

**Validates: Requirement 11.4, 11.8, 11.9 (AI)**

### Task 21: Backend - Association Rule Generator
- [x] 21.1 Create Supabase Edge Function
- [x] 21.2 Implement fetchRecentOrders query
- [x] 21.3 Implement buildTransactionMatrix
- [x] 21.4 Integrate GPT-4o-mini API
- [x] 21.5 Implement storeAssociationRules
- [x] 21.6 Add error handling and logging

**Validates: Requirement 11.5 (AI)**

### Task 22: Background Rule Update Job
- [x] 22.1 Create scheduled job (once per day)
- [x] 22.2 Trigger rule generation for each business
- [ ] 22.3 Sync updated rules to mobile clients
- [x] 22.4 Implement updateRules in SmartCartAssistant
- [x] 22.5 Write PBT for offline availability (Property 7)

**Validates: Requirement 11.6, 11.7 (AI)**

### Task 23: AI Guardrails and Safety
- [x] 23.1 Verify read-only constraint (no auto-add)
- [x] 23.2 Implement PII redaction in data pipeline
- [x] 23.3 Add subscription tier check
- [x] 23.4 Implement graceful fallback when cache empty
- [x] 23.5 Write PBT for no automatic modifications (Property 8)

**Validates: Requirement 11.10, AI Constraints (AI)**

### Task 24: AI Metrics and Monitoring
- [x] 24.1 Create SuggestionMetrics model
- [x] 24.2 Track suggestion shown events
- [x] 24.3 Track suggestion accepted events
- [x] 24.4 Create acceptance rate report
- [x] 24.5 Add cost monitoring dashboard

**Validates: Requirement 11.9 (AI)**
