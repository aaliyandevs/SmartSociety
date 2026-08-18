import { NextResponse, type NextRequest } from 'next/server';

import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth/jwt';
import { ROLE_HOME, canAccessPath, isProtectedPath } from '@/lib/rbac';

/**
 * Edge-runtime routing guard.
 *
 * This is the *first* of two layers. It gives fast redirects and keeps
 * unauthenticated users out of the dashboards, but it is not the security
 * boundary — every page and server action independently re-validates the
 * session against the database (see lib/auth/session.ts).
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const secret = process.env.AUTH_SECRET ?? '';
  const claims = token && secret ? await verifySessionToken(token, secret) : null;

  // Signed-in users should not see the login screen again.
  if (claims && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(new URL(ROLE_HOME[claims.role] ?? '/', request.url));
  }

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  if (!claims) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (!canAccessPath(claims.role, pathname)) {
    return NextResponse.redirect(new URL('/unauthorized', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Run on every route except Next.js internals, the public file routes and
     * static assets — keeps the edge invocation count (and latency) down.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp3|woff2?)$).*)',
  ],
};
