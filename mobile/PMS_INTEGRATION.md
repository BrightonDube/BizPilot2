# PMS Integration — React Native Mobile Setup

> **Property Management System integration for the BizPilot POS mobile app.**
> Enables hotel/resort staff to post restaurant charges to guest room folios
> directly from the tablet POS, with full offline support.

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│  React Native POS App                                        │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Hooks       │  │  Zustand     │  │  WatermelonDB    │  │
│  │ useGuestSearch│  │  pmsStore    │  │  pms_charges     │  │
│  │ useRoomCharge │  │  (state)     │  │  pms_guests      │  │
│  │ useFolio      │  │              │  │  pms_audit_logs  │  │
│  │ usePMSConnect │  │              │  │                  │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                  │                    │            │
│  ┌──────▼──────────────────▼────────────────────▼─────────┐ │
│  │  Services                                               │ │
│  │  PMSService · ChargePostingService · ChargeQueueService │ │
│  │  QueueProcessorService · GuestCacheService              │ │
│  │  PMSErrorHandler                                        │ │
│  └────────────────────────┬───────────────────────────────┘ │
│                           │                                  │
└───────────────────────────┼──────────────────────────────────┘
                            │ HTTPS / REST
                    ┌───────▼───────┐
                    │  Backend API  │
                    │  /api/v1/pms  │
                    └───────┬───────┘
                            │
                    ┌───────▼───────┐
                    │  PMS Provider │
                    │  (Opera, etc) │
                    └───────────────┘
```

## Directory Map

```
mobile/
├── services/pms/
│   ├── PMSService.ts           # Core business logic — guest lookup, validation
│   ├── ChargePostingService.ts # Charge posting lifecycle + reversals
│   ├── ChargeQueueService.ts   # Offline charge queue (enqueue/dequeue)
│   ├── QueueProcessorService.ts# Background sync when connectivity resumes
│   ├── GuestCacheService.ts    # TTL-based guest profile caching
│   ├── PMSErrorHandler.ts      # Error categorisation + exponential backoff
│   └── index.ts                # Barrel exports
├── stores/
│   └── pmsStore.ts             # Zustand — connection, guest, folio, queue state
├── hooks/
│   ├── usePMSConnection.ts     # 30 s health-check polling
│   ├── useGuestSearch.ts       # Room/name search with debounce
│   ├── useRoomCharge.ts        # Charge workflow + offline queueing
│   ├── useFolio.ts             # Folio fetch + cache
│   └── useOfflineQueueProcessor.ts  # Reconnection queue flush
├── db/
│   ├── schema.ts               # WatermelonDB v6 — pms_charges, pms_guests, pms_audit_logs
│   ├── models/
│   │   ├── PMSCharge.ts        # Charge persistence model
│   │   ├── PMSGuest.ts         # Guest cache model
│   │   └── PMSAuditLog.ts      # Immutable audit trail
│   └── migrations.ts           # v5 → v6 migration adding PMS tables
├── .maestro/
│   ├── pms-room-charge-checkout.yaml   # E2E: charge posting flow
│   ├── pms-guest-search.yaml           # E2E: guest lookup
│   ├── pms-room-charge-signature.yaml  # E2E: signature capture
│   ├── pms-folio-lookup.yaml           # E2E: folio display
│   ├── pms-offline-mode.yaml           # E2E: offline indicator
│   └── pms-offline-charge-sync.yaml    # E2E: queue sync on reconnect
└── __tests__/
    ├── pmsService.test.ts         # 15+ service unit tests
    ├── pmsStore.test.ts           # Store state tests
    ├── pmsHooks.test.ts           # Hook integration tests
    ├── pmsModels.test.ts          # WatermelonDB model tests
    ├── pmsErrorHandler.test.ts    # 32 error handler + PBT tests
    ├── guestCacheService.test.ts  # Guest cache tests
    ├── offlineQueueProcessor.test.ts  # Queue processor tests
    ├── pmsQueuePBT.test.ts        # Property-based tests
    └── pmsUI.test.tsx             # Component render tests
```

## Prerequisites

1. **Backend PMS endpoints** must be deployed at `/api/v1/pms/`:
   - `GET  /pms/guests/search?q={query}` — guest search
   - `GET  /pms/guests/{guest_id}/folio` — folio details
   - `POST /pms/charges` — post a room charge
   - `GET  /pms/health` — connection status check

2. **Business configuration**: the business must have PMS integration enabled
   (`business.settings.pms_enabled = true`) and a valid PMS provider configured.

3. **Staff permissions**: the logged-in user needs the `pms:charge` permission
   to post room charges.

## Getting Started

### 1. Install Dependencies

All PMS dependencies are included in the standard mobile install:

```bash
cd mobile
npm install
```

No additional native modules are required — the integration uses REST APIs
and WatermelonDB (already included in the base app).

### 2. WatermelonDB Migration

The PMS tables are added in schema v6. If you are running from a clean
install, migrations apply automatically. If upgrading:

```bash
# The app auto-runs migrations on startup via db/migrations.ts
# No manual steps needed — v5→v6 adds pms_charges, pms_guests, pms_audit_logs
```

### 3. Environment Configuration

The PMS service uses the same API base URL as the rest of the app.
No additional environment variables are needed.

## Key Concepts

### Offline-First Charge Posting

When the device is offline or the PMS is unreachable:

1. **Charge is validated locally** — guest must be in the guest cache,
   charge amount must be within allowed limits.
2. **Charge is queued** in WatermelonDB (`pms_charges` table) with
   status `queued`.
3. **On reconnection**, `QueueProcessorService` picks up queued charges
   in FIFO order and posts them to the backend.
4. **Failed charges** are flagged for manual review (status `failed`)
   after exhausting retries.

### Error Handling

`PMSErrorHandler` categorises errors and applies appropriate recovery:

| Category      | HTTP Status   | Action                          |
|---------------|---------------|---------------------------------|
| `transient`   | null / 0      | Retry with exponential backoff  |
| `auth`        | 401, 403      | Trigger re-authentication       |
| `rate_limit`  | 429           | Retry after delay               |
| `validation`  | 4xx           | No retry — surface to user      |
| `server`      | 5xx           | Retry with backoff              |

Backoff formula: `min(baseDelay × 2^attempt + jitter, maxDelay)`

### Guest Cache

`GuestCacheService` stores recently accessed guest profiles in
WatermelonDB for offline search. Profiles have a configurable TTL
(default 24 hours) and are refreshed on access when online.

### Audit Trail

Every PMS operation (charge, reversal, lookup) is recorded in
`pms_audit_logs` for POPIA/GDPR compliance. Audit entries are
immutable — they can be read but never updated or deleted.

## Testing

### Unit Tests

```bash
cd mobile

# Run all PMS tests
npx jest --testPathPattern="pms" --no-cache

# Run specific test suites
npx jest __tests__/pmsService.test.ts --no-cache
npx jest __tests__/pmsErrorHandler.test.ts --no-cache
npx jest __tests__/pmsQueuePBT.test.ts --no-cache
```

### E2E Tests (Maestro)

```bash
# Requires Maestro CLI + running app on simulator/device
maestro test .maestro/pms-room-charge-checkout.yaml
maestro test .maestro/pms-guest-search.yaml
maestro test .maestro/pms-offline-mode.yaml

# Run all PMS E2E tests
maestro test .maestro/pms-*.yaml
```

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Guest search returns empty | PMS connection down or guest cache expired | Check `usePMSConnection` status; verify backend `/pms/health` |
| Charges stuck in `queued` | Device offline or queue processor not running | Check network; ensure `useOfflineQueueProcessor` is mounted |
| "Auth required" on charge | JWT token expired during offline period | App will auto-retry with refreshed token via `PMSErrorHandler` |
| Charges marked `failed` | PMS rejected after max retries | Review in charge management UI; may need manual repost |
| WatermelonDB migration error | Schema version mismatch | Clear app data and reinstall; check `db/migrations.ts` |
