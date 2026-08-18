import 'server-only';

import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import type { Role } from '@prisma/client';

import prisma from '@/lib/prisma';
import { serverEnv } from '@/lib/env';
import { ROLE_HOME, type Permission, hasPermission } from '@/lib/rbac';
import { SESSION_COOKIE, hashToken, signSessionToken, verifySessionToken } from '@/lib/auth/jwt';

export interface CurrentUser {
  id: string;
  email: string;
  username: string;
  fullName: string;
  phone: string;
  avatarUrl: string | null;
  role: Role;
  sessionId: string;
  /** Present only for role RESIDENT. */
  residentId: string | null;
  flatId: string | null;
  flatLabel: string | null;
  /** Present only for GUARD / MAINTENANCE_STAFF. */
  staffId: string | null;
  department: string | null;
  gateAssignment: string | null;
}

/** Request metadata recorded on sessions and audit rows. */
export async function requestContext(): Promise<{ ipAddress: string | null; userAgent: string | null }> {
  const headerList = await headers();
  const forwarded = headerList.get('x-forwarded-for');
  return {
    ipAddress: forwarded?.split(',')[0]?.trim() ?? headerList.get('x-real-ip') ?? null,
    userAgent: headerList.get('user-agent'),
  };
}

/**
 * Issues a signed cookie *and* persists a session row so the credential can be
 * revoked immediately on logout.
 */
export async function createSession(user: {
  id: string;
  role: Role;
  fullName: string;
}): Promise<void> {
  const ttl = serverEnv.sessionTtlSeconds;
  const expiresAt = new Date(Date.now() + ttl * 1000);
  const { ipAddress, userAgent } = await requestContext();

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      // Replaced below with the digest of the real token.
      tokenHash: `pending:${crypto.randomUUID()}`,
      expiresAt,
      ipAddress,
      userAgent,
    },
    select: { id: true },
  });

  const token = await signSessionToken(
    { sub: user.id, sid: session.id, role: user.role, name: user.fullName },
    serverEnv.authSecret,
    ttl,
  );

  await prisma.session.update({
    where: { id: session.id },
    data: { tokenHash: await hashToken(token) },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax', // blocks cross-site form posts (CSRF) while keeping normal navigation working
    secure: serverEnv.isProduction,
    path: '/',
    maxAge: ttl,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    const claims = await verifySessionToken(token, serverEnv.authSecret);
    if (claims) {
      await prisma.session
        .updateMany({ where: { id: claims.sid, revokedAt: null }, data: { revokedAt: new Date() } })
        .catch(() => undefined);
    }
  }

  cookieStore.delete(SESSION_COOKIE);
}

/**
 * Resolves the signed-in user for the current request.
 *
 * Wrapped in React `cache` so that a page rendering ten server components only
 * performs one database round-trip (NFR: Performance & Speed).
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const claims = await verifySessionToken(token, serverEnv.authSecret);
  if (!claims) return null;

  const session = await prisma.session.findUnique({
    where: { id: claims.sid },
    select: {
      id: true,
      revokedAt: true,
      expiresAt: true,
      tokenHash: true,
      user: {
        select: {
          id: true,
          email: true,
          username: true,
          fullName: true,
          phone: true,
          avatarUrl: true,
          role: true,
          status: true,
          deletedAt: true,
          residentProfile: {
            select: {
              id: true,
              flatId: true,
              deletedAt: true,
              flat: { select: { flatNumber: true, block: { select: { name: true } } } },
            },
          },
          staffProfile: {
            select: { id: true, department: true, gateAssignment: true, deletedAt: true },
          },
        },
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  if (session.tokenHash !== (await hashToken(token))) return null;

  const { user } = session;
  if (!user || user.deletedAt || user.status !== 'ACTIVE') return null;

  const resident = user.residentProfile && !user.residentProfile.deletedAt ? user.residentProfile : null;
  const staff = user.staffProfile && !user.staffProfile.deletedAt ? user.staffProfile : null;

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    fullName: user.fullName,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    role: user.role,
    sessionId: session.id,
    residentId: resident?.id ?? null,
    flatId: resident?.flatId ?? null,
    flatLabel: resident ? `${resident.flat.block.name}-${resident.flat.flatNumber}` : null,
    staffId: staff?.id ?? null,
    department: staff?.department ?? null,
    gateAssignment: staff?.gateAssignment ?? null,
  };
});

/** Redirects to the login page when nobody is signed in. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

/**
 * Server-side authorisation gate. Route hiding in the UI is a convenience only —
 * every protected page and server action calls through here.
 */
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect('/unauthorized');
  return user;
}

export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireUser();
  if (!hasPermission(user.role, permission)) redirect('/unauthorized');
  return user;
}

/** A resident page also needs a linked resident profile to be usable. */
export async function requireResident(): Promise<CurrentUser & { residentId: string; flatId: string }> {
  const user = await requireRole('RESIDENT');
  if (!user.residentId || !user.flatId) redirect('/unauthorized');
  return user as CurrentUser & { residentId: string; flatId: string };
}

export async function requireStaff(): Promise<CurrentUser & { staffId: string }> {
  const user = await requireRole('MAINTENANCE_STAFF');
  if (!user.staffId) redirect('/unauthorized');
  return user as CurrentUser & { staffId: string };
}

export function homeForRole(role: Role): string {
  return ROLE_HOME[role];
}
