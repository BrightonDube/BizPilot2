# Extended Reports Feature - Implementation Tasks

## Backend Tasks

### Task 1: User Activity Report API
- [ ] 1.1 Create UserActivityReport and UserActivityItem schemas in `backend/app/schemas/report.py`
- [ ] 1.2 Implement `get_user_activity_report()` endpoint in `backend/app/api/reports.py`
- [ ] 1.3 Add business isolation and date range filtering
- [ ] 1.4 Calculate total hours, break duration, and active sessions
- [ ] 1.5 Write unit tests for user activity endpoint

### Task 2: Login History Report API
- [ ] 2.1 Create LoginHistoryReport and LoginHistoryItem schemas in `backend/app/schemas/report.py`
- [ ] 2.2 Implement `get_login_history_report()` endpoint in `backend/app/api/reports.py`
- [ ] 2.3 Add suspicious activity detection logic
- [ ] 2.4 Calculate session durations
- [ ] 2.5 Write unit tests for login history endpoint

### Task 3: Excel Export Functionality
- [ ] 3.1 Add openpyxl dependency to `requirements.txt`
- [ ] 3.2 Create Excel export utility in `backend/app/core/excel.py`
- [ ] 3.3 Implement `export_excel()` endpoint in `backend/app/api/reports.py`
- [ ] 3.4 Add support for all report types
- [ ] 3.5 Write unit tests for Excel export

### Task 4: Database Optimization
- [ ] 4.1 Verify indexes on sessions table
- [ ] 4.2 Verify indexes on time_entries table
- [ ] 4.3 Add missing indexes if needed
- [ ] 4.4 Test query performance with large datasets

### Task 5: RBAC for Admin-Only Reports
- [ ] 5.1 Add permission checks for user activity endpoint
- [ ] 5.2 Add permission checks for login history endpoint
- [ ] 5.3 Write tests for permission enforcement

## Frontend Tasks

### Task 6: Reports Page Refactor
- [ ] 6.1 Create tabbed interface component
- [ ] 6.2 Implement tab navigation state management
- [ ] 6.3 Add responsive design for mobile/tablet
- [ ] 6.4 Implement lazy loading for tab content

### Task 7: Inventory Report Tab
- [ ] 7.1 Create InventoryTab component
- [ ] 7.2 Fetch and display inventory data
- [ ] 7.3 Add filtering and sorting
- [ ] 7.4 Implement export button

### Task 8: COGS Report Tab
- [ ] 8.1 Create COGSTab component
- [ ] 8.2 Fetch and display COGS data
- [ ] 8.3 Add date range filtering
- [ ] 8.4 Implement export button

### Task 9: Profit Margin Report Tab
- [ ] 9.1 Create ProfitMarginTab component
- [ ] 9.2 Fetch and display profit margin data
- [ ] 9.3 Add sorting by margin/profit
- [ ] 9.4 Implement export button

### Task 10: User Activity Report Tab
- [ ] 10.1 Create UserActivityTab component
- [ ] 10.2 Fetch and display user activity data
- [ ] 10.3 Add user and date range filtering
- [ ] 10.4 Show active sessions indicator
- [ ] 10.5 Implement export button
- [ ] 10.6 Add admin-only access control

### Task 11: Login History Report Tab
- [ ] 11.1 Create LoginHistoryTab component
- [ ] 11.2 Fetch and display login history data
- [ ] 11.3 Add user and date range filtering
- [ ] 11.4 Highlight suspicious activity
- [ ] 11.5 Implement export button
- [ ] 11.6 Add admin-only access control

### Task 12: Shared Components
- [ ] 12.1 Create DateRangePicker component
- [ ] 12.2 Create UserFilter component
- [ ] 12.3 Create ExportButton component with PDF/Excel options
- [ ] 12.4 Create ReportTable component with sorting
- [ ] 12.5 Create ReportCard component for summary stats

### Task 13: Export Functionality
- [ ] 13.1 Implement PDF export for all reports
- [ ] 13.2 Implement Excel export for all reports
- [ ] 13.3 Add loading states during export
- [ ] 13.4 Handle export errors gracefully

## Testing Tasks

### Task 14: Backend Tests
- [ ] 14.1 Write unit tests for user activity endpoint
- [ ] 14.2 Write unit tests for login history endpoint
- [ ] 14.3 Write unit tests for Excel export
- [ ] 14.4 Write integration tests for RBAC
- [ ] 14.5 Test business isolation

### Task 15: Frontend Tests
- [ ] 15.1 Write component tests for all tabs
- [ ] 15.2 Write tests for shared components
- [ ] 15.3 Write E2E tests for tab navigation
- [ ] 15.4 Write E2E tests for export functionality

## Documentation Tasks

### Task 16: API Documentation
- [ ] 16.1 Document user activity endpoint
- [ ] 16.2 Document login history endpoint
- [ ] 16.3 Document Excel export endpoint
- [ ] 16.4 Update API reference

### Task 17: User Documentation
- [ ] 17.1 Create user guide for reports feature
- [ ] 17.2 Add screenshots and examples
- [ ] 17.3 Document export functionality
- [ ] 17.4 Document admin-only features

## Deployment Tasks

### Task 18: Staging Deployment
- [ ] 18.1 Deploy backend changes to staging
- [ ] 18.2 Deploy frontend changes to staging
- [ ] 18.3 Run smoke tests
- [ ] 18.4 Perform QA testing

### Task 19: Production Deployment
- [ ] 19.1 Create deployment plan
- [ ] 19.2 Deploy to production
- [ ] 19.3 Monitor metrics
- [ ] 19.4 Verify functionality

## Priority Order

**P0 (Critical):**
- Task 1: User Activity Report API
- Task 2: Login History Report API
- Task 6: Reports Page Refactor

**P1 (High):**
- Task 3: Excel Export Functionality
- Task 10: User Activity Report Tab
- Task 11: Login History Report Tab
- Task 12: Shared Components

**P2 (Medium):**
- Task 7: Inventory Report Tab
- Task 8: COGS Report Tab
- Task 9: Profit Margin Report Tab
- Task 13: Export Functionality
- Task 14: Backend Tests

**P3 (Low):**
- Task 4: Database Optimization
- Task 5: RBAC for Admin-Only Reports
- Task 15: Frontend Tests
- Task 16: API Documentation
- Task 17: User Documentation
