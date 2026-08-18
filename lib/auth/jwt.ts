import { SignJWT, jwtVerify } from 'jose';
import type { Role } from '@prisma/client';

/**
 * Edge-compatible JWT helpers.
 *
 * `middleware.ts` runs on the Edge runtime where Prisma is unavailable, so the
 * cookie itself has to carry enough information to make a coarse routing
 * decision. Every authoritative check still re-reads the session row from the
 * database in `lib/auth/session.ts`.
 */

export const SESSION_COOKIE = 'smartsociety_session';

export interface SessionClaims {
  /** User id */
  sub: string;
  /** Session row id — lets us revoke a cookie server-side. */
  sid: string;
  role: Role;
  name: string;
  exp?: number;
  iat?: number;
}

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(
  claims: Omit<SessionClaims, 'exp' | 'iat'>,
  secret: string,
  ttlSeconds: number,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ sid: claims.sid, role: claims.role, name: claims.name })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.sub)
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .setIssuer('smartsociety')
    .setAudience('smartsociety-app')
    .sign(secretKey(secret));
}

export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(secret), {
      issuer: 'smartsociety',
      audience: 'smartsociety-app',
      algorithms: ['HS256'],
    });
    if (!payload.sub || typeof payload.sid !== 'string' || typeof payload.role !== 'string') {
      return null;
    }
    return {
      sub: payload.sub,
      sid: payload.sid,
      role: payload.role as Role,
      name: typeof payload.name === 'string' ? payload.name : '',
      exp: payload.exp,
      iat: payload.iat,
    };
  } catch {
    return null;
  }
}

/**
 * SHA-256 of the raw token. Only the digest is persisted, so a database dump
 * cannot be replayed as a valid cookie.
 */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
