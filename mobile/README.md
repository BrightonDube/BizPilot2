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
<!-- Task 17.2: Environment variable configuration documentation -->

All environment variables must be prefixed with `EXPO_PUBLIC_` to be embedded at build time and accessible in the app. Variables **without** this prefix are build-time only (e.g., EAS secrets).

### Configuration Files

| File | Purpose |
|------|---------|
| `.env` | Local development defaults (not committed) |
| `.env.production` | Production overrides (not committed) |
| `eas.json` | EAS Build profile variables (committed) |

Copy `.env.example` to `.env` and fill in your values:

```bash
cp mobile/.env.example mobile/.env
```

### Variable Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `EXPO_PUBLIC_API_URL` | ✅ | Backend API base URL | `https://api.bizpilot.co.za` |
| `EXPO_PUBLIC_APP_ENV` | ✅ | Environment name (`development`, `staging`, `production`) | `production` |
| `EXPO_PUBLIC_SENTRY_DSN` | ⚠️ | Sentry error tracking DSN | `https://abc@o123.ingest.sentry.io/456` |
| `EXPO_PUBLIC_SNAPSCAN_BASE_URL` | ⚠️ | SnapScan API base URL | `https://pos.snapscan.io/merchant/api/v1` |
| `EXPO_PUBLIC_YOCO_SDK_KEY` | ⚠️ | Yoco SDK publishable key | `pk_live_abc123` |
| `EXPO_PUBLIC_SYNC_INTERVAL_MS` | ❌ | Background sync interval in ms | `30000` (30s) |
| `EXPO_PUBLIC_PIN_LOCKOUT_ATTEMPTS` | ❌ | Max PIN attempts before lockout | `3` |
| `EAS_SECRET_SNAPSCAN_API_KEY` | 🔒 | SnapScan secret API key (EAS secret, never exposed) | — |
| `EAS_SECRET_YOCO_SECRET_KEY` | 🔒 | Yoco secret key (EAS secret, never exposed) | — |

**Legend:** ✅ Required · ⚠️ Required in production · ❌ Optional · 🔒 EAS Build secret only

### Accessing Variables in Code

```typescript
// ✅ Correct — available at runtime
const apiUrl = process.env.EXPO_PUBLIC_API_URL;

// ❌ Wrong — variables without EXPO_PUBLIC_ are NOT available at runtime
const secret = process.env.EAS_SECRET_SNAPSCAN_API_KEY; // undefined in app
```

## Build & Deployment
<!-- Task 17.3: Build and deployment process documentation -->

BizPilot Mobile uses **EAS Build** (Expo Application Services) for cloud builds. This eliminates the need for local Xcode/Android Studio setup for CI/CD.

### Prerequisites

```bash
npm install -g eas-cli
eas login
```

### Build Profiles (eas.json)

| Profile | Platform | Purpose | Command |
|---------|----------|---------|---------|
| `development` | Android + iOS | Internal dev build with Expo DevTools | `eas build --profile development` |
| `preview` | Android APK + iOS Simulator | QA testing without App Store | `eas build --profile preview` |
| `production` | Android AAB + iOS IPA | Store submission | `eas build --profile production` |

### Local Development

```bash
# Start Metro bundler + Expo dev server
cd mobile && npx expo start

# Open in Expo Go (scan QR code)
# OR press 'a' for Android emulator, 'i' for iOS simulator

# Run tests
npx jest --testPathPattern=mobile

# TypeScript check (no emit)
npx tsc --noEmit
```

### CI/CD Pipeline

1. **Push to `dev` branch** → GitHub Actions runs `npx jest` + `npx tsc --noEmit`
2. **PR merged to `main`** → EAS Build triggered for `preview` profile
3. **Tag `v*` pushed** → EAS Build triggered for `production` profile + submit to stores

### OTA Updates

Use **EAS Update** for JavaScript-only changes (no native code changes):

```bash
# Publish to all users on the current production release channel
eas update --branch production --message "Fix cart calculation bug"
```

OTA updates deploy within minutes. Native code changes (new npm packages with native modules, `app.json` changes) require a full EAS Build.

### Troubleshooting

| Problem | Solution |
|---------|----------|
| Metro bundler hangs on WSL | Set `roots` in `jest.config.js` to limit NTFS scan |
| WatermelonDB migration error | Run `db.unsafeResetDatabase()` on dev device, then re-seed |
| Expo Go QR not scanning | Ensure phone and dev machine are on the same network |
| EAS build fails on iOS | Check `eas.json` `ios.bundleIdentifier` matches App Store Connect |
