import type { Metadata } from 'next';

import { AppShell } from '@/components/layout/app-shell';
import { requireResident } from '@/lib/auth/session';

export const metadata: Metadata = { title: { default: 'My Home', template: '%s · Resident' } };

export default async function ResidentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireResident();
  return (
    <AppShell user={user}>
      <div id="main-content">{children}</div>
    </AppShell>
  );
}
