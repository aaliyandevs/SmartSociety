import type { Role } from '@prisma/client';

/**
 * Role-based access control.
 *
 * This module is deliberately free of database and Node-only imports so that it
 * can also run inside `middleware.ts` on the Edge runtime.
 *
 * NFR "Role-Based Security": granular privilege management distinguishing
 * Resident, Guard, Staff and Administrator roles.
 */

export const ROLES = ['ADMIN', 'RESIDENT', 'GUARD', 'MAINTENANCE_STAFF'] as const;

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrator',
  RESIDENT: 'Resident',
  GUARD: 'Security Guard',
  MAINTENANCE_STAFF: 'Maintenance Staff',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: 'Society management board — full operational and financial control.',
  RESIDENT: 'Home owners and tenants living in the society.',
  GUARD: 'Gate security personnel verifying visitors and logging movements.',
  MAINTENANCE_STAFF: 'Technicians resolving assigned helpdesk tickets.',
};

/** Landing page for each role immediately after login. */
export const ROLE_HOME: Record<Role, string> = {
  ADMIN: '/admin',
  RESIDENT: '/resident',
  GUARD: '/guard',
  MAINTENANCE_STAFF: '/staff',
};

/** Every route segment below these prefixes is restricted to the listed roles. */
export const ROUTE_ROLES: { prefix: string; roles: Role[] }[] = [
  { prefix: '/admin', roles: ['ADMIN'] },
  { prefix: '/resident', roles: ['RESIDENT'] },
  { prefix: '/guard', roles: ['GUARD', 'ADMIN'] },
  { prefix: '/staff', roles: ['MAINTENANCE_STAFF', 'ADMIN'] },
];

/** Routes that require *any* authenticated user. */
export const AUTHENTICATED_PREFIXES = ['/admin', '/resident', '/guard', '/staff', '/account'];

export function isProtectedPath(pathname: string): boolean {
  return AUTHENTICATED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Which roles may access `pathname`; `null` means "no role restriction". */
export function rolesForPath(pathname: string): Role[] | null {
  const match = ROUTE_ROLES.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  return match ? match.roles : null;
}

export function canAccessPath(role: Role, pathname: string): boolean {
  const allowed = rolesForPath(pathname);
  return allowed === null || allowed.includes(role);
}

// ── Fine-grained permissions ──────────────────────────────────────────────────

export const PERMISSIONS = [
  'flat:manage',
  'resident:manage',
  'staff:manage',
  'bill:generate',
  'bill:view-all',
  'bill:view-own',
  'payment:simulate',
  'complaint:create',
  'complaint:view-own',
  'complaint:view-all',
  'complaint:view-assigned',
  'complaint:assign',
  'complaint:update-status',
  'visitor:create-pass',
  'visitor:verify',
  'visitor:log',
  'gate:view-logs',
  'amenity:manage',
  'amenity:book',
  'notice:manage',
  'notice:view',
  'poll:manage',
  'poll:vote',
  'alert:broadcast',
  'alert:view',
  'audit:view',
  'report:view',
  'settings:manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const RESIDENT_PERMISSIONS: Permission[] = [
  'bill:view-own',
  'payment:simulate',
  'complaint:create',
  'complaint:view-own',
  'visitor:create-pass',
  'amenity:book',
  'notice:view',
  'poll:vote',
  'alert:view',
];

const GUARD_PERMISSIONS: Permission[] = [
  'visitor:verify',
  'visitor:log',
  'gate:view-logs',
  'notice:view',
  'alert:view',
];

const STAFF_PERMISSIONS: Permission[] = [
  'complaint:view-assigned',
  'complaint:update-status',
  'notice:view',
  'alert:view',
];

/** The administrator holds every permission (SRS §1.6, "For Society Administration"). */
const ADMIN_PERMISSIONS: Permission[] = [...PERMISSIONS];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: ADMIN_PERMISSIONS,
  RESIDENT: RESIDENT_PERMISSIONS,
  GUARD: GUARD_PERMISSIONS,
  MAINTENANCE_STAFF: STAFF_PERMISSIONS,
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}
