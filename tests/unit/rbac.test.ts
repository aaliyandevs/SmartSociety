import { describe, expect, it } from 'vitest';

import {
  ROLE_HOME,
  ROLE_PERMISSIONS,
  canAccessPath,
  hasPermission,
  isProtectedPath,
  resolveLoginDestination,
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

  it('routes each role to its own landing page after login', () => {
    expect(ROLE_HOME.ADMIN).toBe('/admin');
    expect(ROLE_HOME.RESIDENT).toBe('/resident');
    expect(ROLE_HOME.GUARD).toBe('/guard');
    expect(ROLE_HOME.MAINTENANCE_STAFF).toBe('/staff');
  });

  describe('resolveLoginDestination()', () => {
    it('sends a role to its own home when there is no requested destination', () => {
      expect(resolveLoginDestination('RESIDENT', undefined)).toBe('/resident');
      expect(resolveLoginDestination('RESIDENT', null)).toBe('/resident');
      expect(resolveLoginDestination('RESIDENT', '')).toBe('/resident');
    });

    it('honours a requested path within the role\'s own area', () => {
      expect(resolveLoginDestination('RESIDENT', '/resident/bills')).toBe('/resident/bills');
      expect(resolveLoginDestination('GUARD', '/guard/verify')).toBe('/guard/verify');
    });

    it("falls back to the role's own home instead of a stale next for another role's area", () => {
      // This is the bug this function fixes: any account signing in through a
      // login page still carrying `next=/guard` (left over from someone else
      // having been bounced there, or a stale bookmark) must land on its own
      // dashboard, not get diverted into another role's console just because
      // it happens to be technically permitted to view it — e.g. ADMIN can
      // browse /guard, but that is not the same as intending to land there
      // straight after signing in.
      expect(resolveLoginDestination('RESIDENT', '/guard')).toBe('/resident');
      expect(resolveLoginDestination('MAINTENANCE_STAFF', '/guard')).toBe('/staff');
      expect(resolveLoginDestination('GUARD', '/admin')).toBe('/guard');
      expect(resolveLoginDestination('ADMIN', '/guard')).toBe('/admin');
      expect(resolveLoginDestination('ADMIN', '/staff')).toBe('/admin');
    });

    it('refuses an off-origin or protocol-relative destination', () => {
      expect(resolveLoginDestination('ADMIN', 'https://evil.example/phish')).toBe('/admin');
      expect(resolveLoginDestination('ADMIN', '//evil.example/phish')).toBe('/admin');
    });
  });
});
