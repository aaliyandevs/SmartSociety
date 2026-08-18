import type { Metadata } from 'next';

import { AppShell } from '@/components/layout/app-shell';
import { requireRole } from '@/lib/auth/session';

export const metadata: Metadata = { title: { default: 'My Work', template: '%s · Maintenance' } };

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole('MAINTENANCE_STAFF', 'ADMIN');
  return (
    <AppShell user={user}>
      <div id="main-content">{children}</div>
    </AppShell>
  );
}
