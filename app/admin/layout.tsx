import type { Metadata } from 'next';

import { AppShell } from '@/components/layout/app-shell';
import { requireRole } from '@/lib/auth/session';

export const metadata: Metadata = { title: { default: 'Administration', template: '%s · Admin' } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Server-side gate. `middleware.ts` also blocks this prefix, but the page
  // itself must never rely on that alone.
  const user = await requireRole('ADMIN');
  return (
    <AppShell user={user}>
      <div id="main-content">{children}</div>
    </AppShell>
  );
}
