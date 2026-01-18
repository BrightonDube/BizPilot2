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
