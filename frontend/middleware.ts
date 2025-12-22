import { NextRequest, NextResponse } from 'next/server';

function resolveApiBaseUrl(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured && configured.trim().length > 0) {
    // If NEXT_PUBLIC_API_URL is relative (e.g. "/api/v1"), make it absolute.
    if (configured.startsWith('/')) {
      return new URL(configured, request.nextUrl.origin).toString();
    }
    return configured;
  }

  // Fallback for local dev
  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:8000/api/v1';
  }

  // Production fallback - assume same-origin reverse proxy (best-effort)
  return new URL('/api/v1', request.nextUrl.origin).toString();
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
    const res = await fetch(`${apiBaseUrl}/auth/me`, {
      method: 'GET',
      headers: {
        // Forward cookies to backend for validation
        cookie: request.headers.get('cookie') ?? '',
      },
      // Never cache auth checks at the edge
      cache: 'no-store',
    });

    return res.ok;
  } catch {
    // If the auth service is unreachable, do NOT redirect marketing pages.
    // Fail-open here prevents users being trapped away from the public site.
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isMarketingRoute = pathname === '/' || pathname === '/pricing';
  const isAuthRoute = pathname === '/auth' || pathname.startsWith('/auth/');

  if (!isMarketingRoute && !isAuthRoute) {
    return NextResponse.next();
  }

  const authed = await hasValidSession(request);
  if (!authed) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = '/dashboard';
  url.search = '';

  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/', '/pricing', '/auth/:path*'],
};
