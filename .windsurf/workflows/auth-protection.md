---
description: Protected authentication files - DO NOT modify without human approval
---

# Authentication System Protection

## Overview

The BizPilot authentication system has been carefully engineered to prevent a critical
Next.js App Router bug where **raw RSC (React Server Components) flight data** is shown
to users instead of the actual page content. This happens when `router.push()` is used
for authentication redirects instead of `window.location.href`.

**This bug has recurred multiple times over 6 months.** The files listed below are
protected and MUST NOT be modified by AI coding agents during refactors, code reviews,
or feature work — unless a human explicitly requests changes to the auth system.

## Protected Files

These files form the core authentication system. **DO NOT MODIFY** any of them:

1. **`frontend/middleware.ts`** — Authentication routing middleware
2. **`frontend/src/hooks/useAuth.ts`** — Auth hooks (useAuth, useRequireAuth, useGuestOnly)
3. **`frontend/src/components/auth/AuthInitializer.tsx`** — Auth state initialization
4. **`frontend/src/app/auth/login/page.tsx`** — Login page
5. **`frontend/src/app/auth/register/page.tsx`** — Registration page
6. **`frontend/src/components/auth/OAuthButtons.tsx`** — OAuth buttons component
7. **`frontend/src/store/authStore.ts`** — Authentication Zustand store
8. **`frontend/src/lib/api.ts`** — API client with auth interceptors
9. **`frontend/src/lib/session-manager.ts`** — Session expiration manager

## Critical Rules — NEVER Violate These

### Rule 1: NEVER use `router.push()` for auth redirects

All authentication-boundary navigation MUST use `window.location.href` (hard navigation).
`router.push()` triggers Next.js RSC soft navigation which causes raw flight data to be
displayed to users when middleware redirects during auth state transitions.

```typescript
// ❌ WRONG — causes RSC flight data to show
router.push('/dashboard');

// ✅ CORRECT — forces full page load, clean HTML response
window.location.href = '/dashboard';
```

### Rule 2: NEVER check `document.cookie` for HttpOnly cookies

Our auth cookies (`access_token`, `refresh_token`) are HttpOnly — they are INVISIBLE
to JavaScript via `document.cookie`. The only way to check auth state is to call
the `/auth/me` endpoint on the server.

```typescript
// ❌ WRONG — HttpOnly cookies are invisible to JS
const hasAuth = document.cookie.includes('access_token');

// ✅ CORRECT — always call the server
await fetchUser(); // calls /auth/me, handles 401 silently
```

### Rule 3: NEVER remove the middleware auth check timeout

The middleware's `hasValidSession()` fetch MUST have an `AbortController` timeout.
Without it, a slow/hung backend causes the middleware to hang indefinitely, which
leads to RSC flight data being shown to users.

### Rule 4: NEVER change redirect status codes to 307/308

Auth redirects MUST use 302 (temporary). Using 307/308 can cause browsers to cache
the redirect, creating permanent redirect loops.

### Rule 5: ALWAYS set `INTERNAL_API_URL` in production

The middleware must use the internal service URL to call the backend, NOT the public
URL. Going through the public load balancer adds latency and can cause timeouts.

## Why This Matters

When `router.push()` is used after login:
1. Next.js sends an RSC fetch request (with `RSC: 1` header) — NOT a full HTML request
2. The middleware intercepts and checks auth by calling the backend
3. If the backend check fails/times out → middleware redirects to `/auth/login`
4. This redirect happens in RSC context → browser receives RSC flight data
5. React's client runtime can't process the flight data (state mismatch)
6. **User sees raw `:HL["/_next/static/..."]` gibberish instead of their dashboard**

Using `window.location.href` forces a full page load (HTML request), which:
- Bypasses the RSC layer entirely
- Ensures the middleware handles a normal HTML request
- Guarantees the browser receives proper HTML, never raw flight data
- Properly synchronizes cookie state between browser and server

## Testing Auth Changes

If a human requests changes to the auth system, test thoroughly:

1. Login with email/password → should redirect to dashboard (no RSC data)
2. Login with Google OAuth → should redirect to dashboard (no RSC data)
3. Register new account → should redirect to business setup (no RSC data)
4. Session expiration → should redirect to login with message (no RSC data)
5. Direct navigation to `/dashboard` without auth → should redirect to login
6. Direct navigation to `/auth/login` while authenticated → should redirect to dashboard
7. Test in production environment (not just localhost)
