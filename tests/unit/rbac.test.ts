import { describe, expect, it } from 'vitest';

import {
  ROLE_HOME,
  ROLE_PERMISSIONS,
  canAccessPath,
  hasPermission,
  isProtectedPath,
  rolesForPath,
} from '@/lib/rbac';

describe('role-based access control', () => {
  it('marks every dashboard prefix as protected and the public pages as open', () => {
    for (const path of ['/admin', '/resident', '/guard', '/staff', '/account']) {
      expect(isProtectedPath(path)).toBe(true);
      expect(isProtectedPath(`${path}/anything/deep`)).toBe(true);
    }
    for (const path of ['/', '/login', '/sitemap', '/unauthorized']) {
      expect(isProtectedPath(path)).toBe(false);
    }
  });

  it('does not treat a lookalike prefix as protected', () => {
    // "/administration" must not match the "/admin" rule.
    expect(isProtectedPath('/administration')).toBe(false);
    expect(rolesForPath('/administration')).toBeNull();
  });

  it('lets each role into its own area and keeps it out of the others', () => {
    expect(canAccessPath('ADMIN', '/admin/bills')).toBe(true);
    expect(canAccessPath('RESIDENT', '/admin/bills')).toBe(false);
    expect(canAccessPath('GUARD', '/admin')).toBe(false);
    expect(canAccessPath('MAINTENANCE_STAFF', '/resident')).toBe(false);

    expect(canAccessPath('RESIDENT', '/resident/bills')).toBe(true);
    expect(canAccessPath('GUARD', '/guard/verify')).toBe(true);
    expect(canAccessPath('MAINTENANCE_STAFF', '/staff/tickets')).toBe(true);
  });

  it('lets an administrator observe the guard and staff consoles', () => {
    expect(canAccessPath('ADMIN', '/guard/logs')).toBe(true);
    expect(canAccessPath('ADMIN', '/staff/tickets')).toBe(true);
    // ...but not impersonate a resident's private area.
    expect(canAccessPath('ADMIN', '/resident/bills')).toBe(false);
  });

  it('gives the administrator every permission', () => {
    expect(ROLE_PERMISSIONS.ADMIN).toContain('audit:view');
    expect(ROLE_PERMISSIONS.ADMIN).toContain('bill:generate');
    expect(ROLE_PERMISSIONS.ADMIN).toContain('alert:broadcast');
  });

  it('scopes non-admin permissions tightly', () => {
    expect(hasPermission('RESIDENT', 'bill:view-own')).toBe(true);
    expect(hasPermission('RESIDENT', 'bill:view-all')).toBe(false);
    expect(hasPermission('RESIDENT', 'audit:view')).toBe(false);

    expect(hasPermission('GUARD', 'visitor:verify')).toBe(true);
    expect(hasPermission('GUARD', 'bill:generate')).toBe(false);

    expect(hasPermission('MAINTENANCE_STAFF', 'complaint:update-status')).toBe(true);
    expect(hasPermission('MAINTENANCE_STAFF', 'complaint:view-all')).toBe(false);
  });

  it('routes each role to its own landing page after sign-in', () => {
    expect(ROLE_HOME.ADMIN).toBe('/admin');
    expect(ROLE_HOME.RESIDENT).toBe('/resident');
    expect(ROLE_HOME.GUARD).toBe('/guard');
    expect(ROLE_HOME.MAINTENANCE_STAFF).toBe('/staff');
  });
});
