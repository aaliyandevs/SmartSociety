import { NextResponse, type NextRequest } from 'next/server';

import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth/jwt';
import { canAccessPath, isProtectedPath } from '@/lib/rbac';

/**
 * Edge-runtime routing guard.
 *
 * This is the *first* of two layers. It gives fast redirects and keeps
 * unauthenticated users out of the dashboards, but it is not the security
 * boundary — every page and server action independently re-validates the
 * session against the database (see lib/auth/session.ts).
 *
 * Deliberately does *not* redirect a signed-in visitor away from `/login`
 * here — that check lives in `app/login/page.tsx` instead, where it can
 * confirm the session against the database. A cookie can carry a
 * cryptographically valid JWT for a session that's since been revoked
 * (password changed on another device, admin-deactivated, a dev database
 * reset) — checking only the signature here, the way the protected-route
 * checks below correctly do for *blocking* access, would bounce that visitor
 * to their "own dashboard", which would then bounce them straight back to
 * `/login` for failing the real (database-backed) check — an infinite
 * redirect loop instead of just showing them the sign-in form.
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const secret = process.env.AUTH_SECRET ?? '';
  const claims = token && secret ? await verifySessionToken(token, secret) : null;

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  if (!claims) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (!canAccessPath(claims.role, pathname)) {
    // Carry the path they were actually after through to the 403 page, so
    // neither the visitor nor whoever they call for help is left guessing
    // what they were trying to reach.
    const unauthorizedUrl = new URL('/unauthorized', request.url);
    unauthorizedUrl.searchParams.set('from', `${pathname}${search}`);
    return NextResponse.redirect(unauthorizedUrl);
  }

  // Authenticated pages must never be served from the browser's back/forward
  // cache — otherwise signing out and pressing "back" can flash the previous
  // account's page, and (the bug actually reported) pressing "back" into a
  // still-valid session can look indistinguishable from being logged out.
  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'no-store');
  return response;
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
