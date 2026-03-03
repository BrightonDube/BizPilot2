# BizPilot Mobile POS

A React Native point-of-sale application for iPad, Android tablets, and Windows (via React Native Web). Built with Expo SDK 52, WatermelonDB, NativeWind, and Zustand.

## Architecture

```
mobile/
├── app/                    # Expo Router file-based navigation
│   ├── (auth)/             # Authentication screens (login, PIN)
│   ├── (tabs)/             # Main app tabs (POS, orders, products, etc.)
│   ├── _layout.tsx         # Root layout with providers
│   └── index.tsx           # Entry redirect based on auth state
├── components/
│   ├── ui/                 # Reusable UI primitives (Button, Card, Input, Badge, Modal)
│   ├── common/             # App-wide components (LoadingSpinner, ErrorBoundary, SyncStatus)
│   ├── pos/                # POS-specific components (ProductGrid, Cart, etc.)
│   └── forms/              # Form components
├── db/                     # WatermelonDB offline database
│   ├── schema.ts           # Table definitions (8 tables)
│   ├── models/             # WatermelonDB model classes
│   ├── migrations.ts       # Schema migrations
│   └── index.ts            # Database singleton
├── hooks/                  # Custom React hooks
├── services/
│   ├── api/                # Axios HTTP client and API modules
│   ├── auth/               # Authentication (JWT, SecureStore, PIN)
│   └── sync/               # Offline sync engine (queue, resolver, service)
├── stores/                 # Zustand state management
│   ├── authStore.ts        # Authentication state
│   ├── cartStore.ts        # In-memory POS cart
│   ├── settingsStore.ts    # Business and device settings
│   └── syncStore.ts        # Sync status tracking
├── types/                  # TypeScript type definitions
├── utils/                  # Constants, formatters, validators
└── __tests__/              # Jest unit tests
```

## Key Design Decisions

### Offline-First with WatermelonDB
The POS must work without internet. WatermelonDB provides a local SQLite database that acts as the source of truth. Changes sync to the server when connectivity is available.

### Push-Then-Pull Sync
Local changes are pushed to the server first (to prevent data loss), then remote changes are pulled. This ensures no local work is overwritten.

### Per-Entity Conflict Resolution
- **Orders / Inventory** → Server-wins (financial data is authoritative)
- **Customers** → Client-wins (local edits from the cashier take precedence)
- **Products / Settings** → Last-write-wins (most recent change wins)

### In-Memory Cart (Zustand)
The cart is ephemeral — it exists only until the order is placed. Persisting to SQLite on every item tap would add unnecessary I/O overhead. The cart only writes to DB when the order is finalized.

### Tablet-First Split-Pane UI
On tablets (≥768dp), the POS screen shows a split-pane layout: product grid on the left, cart on the right. This eliminates view switching and saves ~2 seconds per transaction.

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Expo SDK 52 | Cross-platform managed workflow, OTA updates |
| Navigation | Expo Router | File-based routing, matches Next.js patterns |
| Styling | NativeWind v4 | Tailwind CSS for RN, style parity with web app |
| Local DB | WatermelonDB | Offline-first SQLite, reactive, handles 10k+ products |
| State | Zustand | Lightweight, selector-based, no full-tree re-renders |
| HTTP | Axios | Auth interceptors, retry logic, matches web app |
| Auth | expo-secure-store | Platform secure enclave (iOS Keychain, Android Keystore) |

## Development

### Prerequisites
- Node.js 18+
- pnpm 8+
- Expo CLI (`npx expo`)

### Getting Started
```bash
# From the monorepo root
pnpm install

# Start the Expo dev server
pnpm mobile:start

# Run on specific platform
pnpm mobile:ios
pnpm mobile:android
pnpm mobile:web
```

### Running Tests
```bash
pnpm mobile:test
```

### Linting
```bash
pnpm mobile:lint
```

## Currency & Locale

All currency formatting uses **ZAR (South African Rand)** with the `en-ZA` locale. The default VAT rate is 15%.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `EXPO_PUBLIC_API_URL` | Backend API base URL | `http://localhost:8000` |
