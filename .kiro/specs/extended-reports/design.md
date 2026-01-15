# Extended Reports Feature - Design Document

## Architecture Overview

The extended reports feature builds upon the existing reports infrastructure by adding two new report types (user activity and login history) and enhancing the frontend UI with a tabbed interface for easy navigation between all report types.

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │          Reports Page (Tabbed Interface)               │ │
│  │  ┌──────┬──────┬──────┬──────┬──────┬──────┬──────┐  │ │
│  │  │Stats │Inven │COGS  │Profit│User  │Login │Export│  │ │
│  │  │      │tory  │      │Margin│Activ │Hist  │      │  │ │
│  │  └──────┴──────┴──────┴──────┴──────┴──────┴──────┘  │ │
│  │                                                        │ │
│  │  Shared Components:                                   │ │
│  │  - DateRangePicker                                    │ │
│  │  - UserFilter                                         │ │
│  │  - ExportButton                                       │ │
│  │  - ReportTable                                        │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ API Calls
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (FastAPI)                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Reports API Router                        │ │
│  │  Existing:                    New:                     │ │
│  │  - GET /reports/stats         - GET /reports/user-     │ │
│  │  - GET /reports/inventory       activity               │ │
│  │  - GET /reports/cogs          - GET /reports/login-    │ │
│  │  - GET /reports/profit-margins  history                │ │
│  │  - GET /reports/export/pdf    - GET /reports/export/   │ │
│  │                                 excel                   │ │
│  └────────────────────────────────────────────────────────┘ │
│                            │                                 │
│                            ▼                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                  Database (PostgreSQL)                 │ │
│  │  Tables: sessions, time_entries, inventory_items,     │ │
│  │          products, orders, order_items                 │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## API Design

### New Endpoints

#### 1. User Activity Report
```
GET /reports/user-activity
```

**Query Parameters:**
- `range`: string (7d|30d|90d|1y) - Date range filter
- `user_id`: UUID (optional) - Filter by specific user
- `status`: string (optional) - Filter by entry status

**Response Schema:**
```typescript
interface UserActivityReport {
  items: UserActivityItem[];
  total_users: number;
  total_hours: number;
  average_hours_per_user: number;
}

interface UserActivityItem {
  user_id: string;
  user_name: string;
  total_hours: number;
  total_entries: number;
  clock_ins: number;
  clock_outs: number;
  break_duration: number;
  last_activity: string;  // ISO datetime
  status: 'active' | 'completed';
}
```

**Business Logic:**
1. Query time_entries table filtered by business_id and date range
2. Group by user_id and aggregate hours
3. Calculate break durations
4. Identify active sessions (clock_in without clock_out)
5. Sort by total hours descending

#### 2. Login History Report
```
GET /reports/login-history
```

**Query Parameters:**
- `range`: string (7d|30d|90d|1y) - Date range filter
- `user_id`: UUID (optional) - Filter by specific user
- `include_active`: boolean (default: true) - Include active sessions

**Response Schema:**
```typescript
interface LoginHistoryReport {
  items: LoginHistoryItem[];
  total_sessions: number;
  active_sessions: number;
  unique_users: number;
  suspicious_count: number;
}

interface LoginHistoryItem {
  session_id: string;
  user_id: string;
  user_name: string;
  device_name: string;
  device_type: string;
  ip_address: string;
  location: string | null;
  login_time: string;  // ISO datetime
  logout_time: string | null;  // ISO datetime
  duration_minutes: number | null;
  is_active: boolean;
  is_suspicious: boolean;
}
```

**Business Logic:**
1. Query sessions table filtered by business (via user.business_id)
2. Join with users table to get user names
3. Calculate session duration
4. Flag suspicious activity:
   - Multiple concurrent sessions from different IPs
   - Login from unusual location
   - Session duration > 24 hours
5. Sort by login_time descending

#### 3. Excel Export
```
GET /reports/export/excel
```

**Query Parameters:**
- `report_type`: string (inventory|cogs|profit-margins|user-activity|login-history)
- `range`: string (7d|30d|90d|1y)
- Additional filters based on report type

**Response:**
- Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
- Content-Disposition: attachment; filename="report_{type}_{date}.xlsx"

**Implementation:**
- Use openpyxl library for Excel generation
- Include formatted headers, data, and summary rows
- Apply cell formatting (currency, dates, percentages)
- Add auto-filter to header row

## Database Schema

No new tables required. Leveraging existing:

### sessions table (existing)
```sql
- id: UUID (PK)
- user_id: UUID (FK -> users.id)
- device_name: VARCHAR(255)
- device_type: VARCHAR(50)
- ip_address: VARCHAR(45)
- location: VARCHAR(255)
- is_active: BOOLEAN
- created_at: TIMESTAMP
- last_active_at: TIMESTAMP
- expires_at: TIMESTAMP
- revoked_at: TIMESTAMP
```

### time_entries table (existing)
```sql
- id: UUID (PK)
- business_id: UUID (FK -> businesses.id)
- user_id: UUID (FK -> users.id)
- entry_type: ENUM
- clock_in: TIMESTAMP
- clock_out: TIMESTAMP
- break_start: TIMESTAMP
- break_end: TIMESTAMP
- hours_worked: NUMERIC(6,2)
- break_duration: NUMERIC(6,2)
- status: ENUM
- device_id: VARCHAR(255)
- ip_address: VARCHAR(45)
- location: VARCHAR(255)
```

### Required Indexes (verify existence)
```sql
CREATE INDEX IF NOT EXISTS idx_sessions_user_created 
  ON sessions(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_time_entries_business_clock_in 
  ON time_entries(business_id, clock_in);

CREATE INDEX IF NOT EXISTS idx_time_entries_user_clock_in 
  ON time_entries(user_id, clock_in);
```

## Frontend Design

### Component Structure

```
src/app/(dashboard)/reports/page.tsx
├── ReportsTabs (new)
│   ├── OverviewTab (existing, enhanced)
│   ├── InventoryTab (new)
│   ├── COGSTab (new)
│   ├── ProfitMarginTab (new)
│   ├── UserActivityTab (new)
│   └── LoginHistoryTab (new)
├── Shared Components
│   ├── DateRangePicker
│   ├── UserFilter
│   ├── ExportButton
│   ├── ReportTable
│   └── ReportCard
```

### Tab Navigation Design

```typescript
const reportTabs = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'cogs', label: 'COGS', icon: DollarSign },
  { id: 'profit-margins', label: 'Profit Margins', icon: TrendingUp },
  { id: 'user-activity', label: 'User Activity', icon: Clock, adminOnly: true },
  { id: 'login-history', label: 'Login History', icon: Shield, adminOnly: true },
];
```

### State Management

```typescript
interface ReportsState {
  activeTab: string;
  dateRange: '7d' | '30d' | '90d' | '1y';
  selectedUser: string | null;
  isLoading: boolean;
  error: string | null;
  data: {
    overview: ReportStats | null;
    inventory: InventoryReport | null;
    cogs: COGSReport | null;
    profitMargins: ProfitMarginReport | null;
    userActivity: UserActivityReport | null;
    loginHistory: LoginHistoryReport | null;
  };
}
```

### Responsive Design

- Desktop (>1024px): Full tabbed interface with side-by-side charts
- Tablet (768-1024px): Stacked layout with collapsible sections
- Mobile (<768px): Accordion-style tabs, single column layout

## Security Considerations

### Authentication & Authorization
- All report endpoints require valid JWT token
- User activity and login history require admin role
- Business isolation enforced at query level

### Data Privacy
- Mask sensitive IP addresses (show only first 2 octets)
- Redact location data for non-admin users
- Implement audit logging for report access

### Rate Limiting
- Export endpoints: 10 requests per minute per user
- Report endpoints: 60 requests per minute per user
- Implement exponential backoff on frontend

## Performance Optimization

### Backend
1. **Database Query Optimization**
   - Use appropriate indexes
   - Implement query result caching (Redis)
   - Paginate large result sets

2. **Caching Strategy**
   - Cache report data for 5 minutes
   - Invalidate cache on relevant data changes
   - Use cache keys: `report:{type}:{business_id}:{range}:{filters}`

3. **Async Processing**
   - Generate large exports asynchronously
   - Return job ID and polling endpoint
   - Store exports in S3/blob storage

### Frontend
1. **Code Splitting**
   - Lazy load tab components
   - Dynamic imports for chart libraries

2. **Data Fetching**
   - Implement SWR/React Query for caching
   - Prefetch adjacent tabs
   - Debounce filter changes

3. **Rendering Optimization**
   - Virtualize long lists (react-window)
   - Memoize expensive calculations
   - Use React.memo for static components

## Testing Strategy

### Unit Tests
- Test each report endpoint independently
- Mock database queries
- Verify response schemas
- Test edge cases (empty data, invalid filters)

### Integration Tests
- Test full report generation flow
- Verify business isolation
- Test export functionality
- Verify RBAC enforcement

### E2E Tests
- Navigate between tabs
- Apply filters and verify results
- Export reports and verify downloads
- Test responsive behavior

## Error Handling

### Backend Errors
```python
class ReportError(Exception):
    """Base exception for report errors."""
    pass

class InsufficientDataError(ReportError):
    """Raised when not enough data to generate report."""
    pass

class ExportError(ReportError):
    """Raised when export generation fails."""
    pass
```

### Frontend Error States
- Network errors: Show retry button
- No data: Show empty state with helpful message
- Permission denied: Show upgrade prompt or contact admin
- Export failed: Show error toast with details

## Monitoring & Logging

### Metrics to Track
- Report generation time by type
- Export success/failure rate
- Cache hit/miss ratio
- API endpoint latency (p50, p95, p99)

### Logging
- Log all report access (user, type, filters)
- Log export requests
- Log suspicious activity detection
- Log performance issues (>2s response time)

## Deployment Plan

### Phase 1: Backend Implementation
1. Implement new API endpoints
2. Add database indexes
3. Write unit tests
4. Deploy to staging

### Phase 2: Frontend Implementation
1. Create tabbed interface
2. Implement new report tabs
3. Add export functionality
4. Write E2E tests

### Phase 3: Testing & QA
1. Load testing
2. Security audit
3. User acceptance testing
4. Performance optimization

### Phase 4: Production Deployment
1. Feature flag rollout
2. Monitor metrics
3. Gather user feedback
4. Iterate based on feedback

## Future Enhancements
- Scheduled report emails
- Custom report builder
- Advanced filtering (multiple conditions)
- Report templates
- Data visualization improvements (more chart types)
- Real-time updates via WebSockets
