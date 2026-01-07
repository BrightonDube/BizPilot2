import { NextRequest, NextResponse } from 'next/server';

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
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isMarketingRoute = pathname === '/' || pathname === '/pricing';
  const isAuthRoute = pathname === '/auth' || pathname.startsWith('/auth/');

  // Never interfere with Next internals or static files
  const isNextInternal = pathname.startsWith('/_next');
  if (isNextInternal) {
    return NextResponse.next();
  }

  const authed = await hasValidSession(request);

  // Authenticated users should not see public/auth pages.
  if (authed && (isMarketingRoute || isAuthRoute)) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // All remaining routes are protected.
  if (!authed && !isMarketingRoute && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    // Prevent leaking Next.js internal params (e.g. ?_rsc=...) into the login URL.
    url.search = '';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
