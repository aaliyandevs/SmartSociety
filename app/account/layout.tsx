import type { Metadata } from 'next';

import { AppShell } from '@/components/layout/app-shell';
import { requireUser } from '@/lib/auth/session';

export const metadata: Metadata = { title: { default: 'My Account', template: '%s · Account' } };

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <AppShell user={user}>
      <div id="main-content">{children}</div>
    </AppShell>
  );
}
