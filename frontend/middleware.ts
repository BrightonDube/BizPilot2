// @AI-DIRECTIVE: DO NOT UNDER ANY CIRCUMSTANCES modify, refactor, or remove the RSC header-stripping logic in this middleware. It is a critical infrastructure fix for a known Next.js CDN caching bug on Digital Ocean. Leave this logic completely intact during future code edits.

/**
 * Next.js Middleware for authentication routing.
 * 
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  🔒 PROTECTED FILE — DO NOT MODIFY WITHOUT HUMAN APPROVAL 🔒  ║
 * ║                                                                ║
 * ║  This file is part of the core authentication system.          ║
 * ║  AI coding agents: DO NOT refactor, reorganize, or alter       ║
 * ║  the routing logic, redirect behavior, or auth check in        ║
 * ║  this file. The timeout, error handling, and redirect logic    ║
 * ║  are carefully designed to prevent RSC flight data leaks.      ║
 * ║                                                                ║
 * ║  See: .windsurf/workflows/auth-protection.md                   ║
 * ╚══════════════════════════════════════════════════════════════════╝
 * 
 * CRITICAL DESIGN DECISIONS (DO NOT CHANGE):
 * 1. Auth check has a 5-second timeout — if backend is slow/down,
 *    we fail OPEN (treat as guest) on marketing/auth pages and
 *    fail CLOSED (redirect to login) on protected pages.
 * 2. Redirects use 302 status — never 307/308 which can cache.
 * 3. INTERNAL_API_URL should always be set in production to avoid
 *    the middleware fetch going through the public load balancer.
 */

import { NextRequest, NextResponse } from 'next/server';

/** Timeout for the auth check fetch (milliseconds). */
const AUTH_CHECK_TIMEOUT_MS = 5000;

function resolveApiBaseUrl(request: NextRequest): string {
  // In production on DigitalOcean App Platform, use internal service URL
  // to avoid routing through the public ingress (which would hit Next.js again)
  const internalApiUrl = process.env.INTERNAL_API_URL;
  if (internalApiUrl && internalApiUrl.trim().length > 0) {
    return internalApiUrl;
  }

  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured && configured.trim().length > 0) {
    // If NEXT_PUBLIC_API_URL is relative (e.g. "/api/v1"), make it absolute.
    if (configured.startsWith('/')) {
      // Use the request's host header to construct the absolute URL
      // This ensures we use the public-facing URL, not the internal Next.js server
      const host = request.headers.get('host') || request.nextUrl.host;
      const protocol = request.headers.get('x-forwarded-proto') || 'https';
      return `${protocol}://${host}${configured}`;
    }
    return configured;
  }

  // Fallback for local dev
  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:8000/api/v1';
  }

  // Production fallback - assume same-origin reverse proxy (best-effort)
  // Use the request's host header to construct the absolute URL
  const host = request.headers.get('host') || request.nextUrl.host;
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  return `${protocol}://${host}/api/v1`;
}

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const accessCookie = request.cookies.get('access_token')?.value;
  const refreshCookie = request.cookies.get('refresh_token')?.value;

  // Fast path: no cookies => definitely not authenticated
  if (!accessCookie && !refreshCookie) {
    return false;
  }

  const apiBaseUrl = resolveApiBaseUrl(request);

  try {
    // CRITICAL: Use AbortController to enforce a timeout.
    // Without this, a slow/hung backend can cause the middleware to hang
    // indefinitely, leading to RSC flight data being shown to users.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AUTH_CHECK_TIMEOUT_MS);

    const res = await fetch(`${apiBaseUrl}/auth/me`, {
      method: 'GET',
      headers: {
        // Forward cookies to backend for validation
        cookie: request.headers.get('cookie') ?? '',
        // Explicitly request JSON to avoid RSC payload issues
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        // Prevent caching of auth checks
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
      signal: controller.signal,
      // Never cache auth checks at the edge
      cache: 'no-store',
    });

    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    // Auth check failed (network error, timeout, etc.)
    // Caller decides what to do — see middleware() logic below.
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isMarketingRoute = pathname === '/' || 
                        pathname === '/pricing' ||
                        pathname === '/features' ||
                        pathname === '/industries' ||
                        pathname === '/faq';
  const isAuthRoute = pathname === '/auth' || pathname.startsWith('/auth/');

  // Never interfere with Next internals or static files
  const isNextInternal = pathname.startsWith('/_next');
  if (isNextInternal) {
    return NextResponse.next();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // RSC PAYLOAD BLEED FIX — Critical infrastructure fix for Digital Ocean CDN
  // ──────────────────────────────────────────────────────────────────────────
  //
  // PROBLEM:
  // Next.js uses the `Rsc: 1` request header to signal that the client expects
  // a React Server Component (RSC) JSON payload (the "flight data") instead of
  // full HTML. Under normal operation, the client also appends a `?_rsc=<id>`
  // query parameter to the URL so that CDN/edge caches can distinguish between
  // an HTML request and an RSC payload request for the same path.
  //
  // During certain client-side redirects (e.g., after OAuth login, after
  // `router.push()`, or when the browser replays a navigation), the browser
  // drops the `?_rsc=...` query parameter from the URL but RETAINS the
  // `Rsc: 1`, `Next-Router-State-Tree`, and `Next-Router-Prefetch` headers.
  // The Next.js server sees the `Rsc: 1` header, generates the raw RSC JSON
  // payload, and returns it. The CDN (Digital Ocean App Platform / Cloudflare /
  // any upstream reverse proxy) then caches this JSON response against the
  // *clean* URL (without `?_rsc=...`). From that point forward, every
  // subsequent visitor requesting that URL receives the cached RSC JSON
  // payload—raw text like `0:{"buildId":...}`—instead of the rendered HTML
  // page. This is the "RSC Payload Bleed" bug.
  //
  // FIX:
  // We detect the mismatch condition: the request carries the `Rsc: 1` header
  // but does NOT have the `_rsc` search parameter. In this case, we strip
  // all RSC-related headers (`rsc`, `next-router-state-tree`,
  // `next-router-prefetch`, `x-middleware-prefetch`) from the request before
  // forwarding it downstream. This forces the Next.js server to treat the
  // request as a normal HTML page request, which produces the correct HTML
  // response. Because the response is now HTML, the CDN caches the correct
  // content for the clean URL.
  //
  // DO NOT REMOVE THIS BLOCK. It prevents permanent page breakage in production.
  // ──────────────────────────────────────────────────────────────────────────
  const hasRscHeader = request.headers.get('rsc') === '1';
  const hasRscParam = request.nextUrl.searchParams.has('_rsc');

  if (hasRscHeader && !hasRscParam) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.delete('rsc');
    requestHeaders.delete('next-router-state-tree');
    requestHeaders.delete('next-router-prefetch');
    requestHeaders.delete('x-middleware-prefetch');

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  // Check if this is an RSC request (React Server Components)
  const isRSCRequest = request.headers.get('RSC') === '1' || 
                       request.headers.get('Next-Router-Prefetch') === '1' ||
                       request.nextUrl.searchParams.has('_rsc');

  // Debug logging for troubleshooting multi-tab issues
  if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
    console.log(`[Middleware] ${request.method} ${pathname}`, {
      isRSCRequest,
      hasAccessToken: !!request.cookies.get('access_token')?.value,
      hasRefreshToken: !!request.cookies.get('refresh_token')?.value,
      userAgent: request.headers.get('user-agent')?.substring(0, 50),
    });
  }

  const authed = await hasValidSession(request);

  // Authenticated users should not see public/auth pages.
  if (authed && (isMarketingRoute || isAuthRoute)) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    // Use 302 redirect for RSC requests to prevent caching issues
    return NextResponse.redirect(url, { status: 302 });
  }

  // All remaining routes are protected.
  if (!authed && !isMarketingRoute && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    // Prevent leaking Next.js internal params (e.g. ?_rsc=...) into the login URL.
    url.search = '';
    url.searchParams.set('next', pathname);
    // Use 302 redirect for RSC requests to prevent caching issues
    return NextResponse.redirect(url, { status: 302 });
  }

  // Let Next.js handle RSC requests naturally - don't override Content-Type
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
