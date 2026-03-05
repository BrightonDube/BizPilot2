# Implementation Tasks: Menu Engineering

## Task 1: Menu Schema
- [ ] 1.1 Create menu_items table
- [ ] 1.2 Create modifier_groups table
- [ ] 1.3 Create modifiers table
- [ ] 1.4 Create portions table
- [ ] 1.5 Create recipes table
- [ ] 1.6 Write database migration

**Validates: Requirements 1, 2, 3**

## Task 2: Menu Service
- [ ] 2.1 Create MenuService class
- [ ] 2.2 Implement getMenuItems
- [ ] 2.3 Implement calculateItemPrice
- [ ] 2.4 Write PBT for price calculation (Property 1)

**Validates: Requirement 1**

## Task 3: Modifier Groups
- [ ] 3.1 Create modifier group management UI
- [ ] 3.2 Implement required/optional logic
- [ ] 3.3 Implement min/max selection rules
- [ ] 3.4 Write PBT for modifier validation (Property 2)

**Validates: Requirement 2**

## Task 4: Modifier Selection UI
- [ ] 4.1 Create modifier selection modal
- [ ] 4.2 Display modifier groups
- [ ] 4.3 Enforce selection rules
- [ ] 4.4 Calculate price with modifiers

**Validates: Requirement 2**

## Task 5: Portion Sizes
- [ ] 5.1 Create portion management UI
- [ ] 5.2 Set price per portion
- [ ] 5.3 Link recipe per portion
- [ ] 5.4 Display portion selector

**Validates: Requirement 3**

## Task 6: Recipe Management
- [ ] 6.1 Create RecipeService class
- [ ] 6.2 Create recipe management UI
- [ ] 6.3 Link ingredients to recipes
- [ ] 6.4 Calculate recipe cost
- [ ] 6.5 Write PBT for food cost (Property 3)

**Validates: Requirement 4**

## Task 7: Menu Categories
- [x] 7.1 Create menu category management
- [x] 7.2 Support category images/icons
- [x] 7.3 Support time-based categories
- [x] 7.4 Display on POS

**Validates: Requirement 5**

## Task 8: Availability Management
- [ ] 8.1 Implement availability toggle
- [ ] 8.2 Implement scheduled availability
- [ ] 8.3 Implement 86'd items
- [ ] 8.4 Sync across terminals

**Validates: Requirement 6**

## Task 9: Combo Meals
- [ ] 9.1 Create combo item type
- [x] 9.2 Define combo components
- [x] 9.3 Support component choices
- [ ] 9.4 Calculate combo pricing

**Validates: Requirement 7**

## Task 10: Menu Display
- [x] 10.1 Create menu grid for POS
- [x] 10.2 Show item images and prices
- [x] 10.3 Indicate unavailable items
- [x] 10.4 Support PLU search

**Validates: Requirement 8**

## Task 11: Kitchen Routing
- [ ] 11.1 Assign items to stations
- [ ] 11.2 Route to correct printer/KDS
- [ ] 11.3 Support multiple stations

**Validates: Requirement 9**

## Task 12: Menu Reports
- [ ] 12.1 Create item sales report
- [ ] 12.2 Create profitability report
- [ ] 12.3 Create modifier popularity report
- [ ] 12.4 Create menu engineering matrix

**Validates: Requirement 10**

## Task 13: Database Migration and Seeding
- [ ] 13.1 Run all Alembic migrations locally
  - Execute `alembic upgrade head` in backend directory
  - Verify menu engineering tables created correctly
  - _Requirements: Database Schema_

- [ ] 13.2 Seed database with test data
  - Create seed script for menu items and categories
  - Create seed script for modifier groups and modifiers
  - Create seed script for recipes and portions
  - Execute seeding scripts locally
  - _Requirements: Testing Data_

## Task 14: Local Testing and Build Verification
- [ ] 14.1 Run backend test suite
  - Execute `pytest` in backend directory
  - Ensure all unit tests pass
  - Ensure all property-based tests pass
  - Fix any failing tests before proceeding
  - _Requirements: Code Quality_

- [ ] 14.2 Run frontend test suite
  - Execute `npm test` in frontend directory
  - Ensure all component tests pass
  - Fix any failing tests before proceeding
  - _Requirements: Code Quality_

- [ ] 14.3 Build verification
  - Execute `npm run build` in frontend directory
  - Execute backend build process
  - Ensure no build errors
  - Fix any build issues before proceeding
  - _Requirements: Deployment Readiness_

## Task 15: Deployment Workflow
- [ ] 15.1 Push to dev branch
  - Commit all changes with descriptive messages
  - Push to dev branch: `git push origin dev`
  - Only proceed after local testing and build verification complete
  - _Requirements: Version Control_

- [ ] 15.2 Monitor deployment with MCP servers
  - Use MCP deployment monitoring tools
  - Poll deployment status every 30 seconds
  - Wait for deployment to complete successfully
  - _Requirements: Deployment Monitoring_

- [ ] 15.3 Handle deployment failures
  - If deployment fails, analyze error logs
  - Fix issues locally
  - Re-run local testing and build verification
  - Push fixes and repeat monitoring
  - Continue until deployment succeeds
  - _Requirements: Deployment Reliability_

## Task 16: Final Checkpoint
- Ensure all tests pass
- Verify menu engineering features work end-to-end
- Confirm successful deployment
- Ask the user if questions arise
