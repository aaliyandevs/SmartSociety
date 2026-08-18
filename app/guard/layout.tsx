import type { Metadata } from 'next';
import Link from 'next/link';
import { QrCode } from 'lucide-react';

import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { requireRole } from '@/lib/auth/session';

export const metadata: Metadata = { title: { default: 'Gate Console', template: '%s · Gate' } };

export default async function GuardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole('GUARD', 'ADMIN');

  return (
    <AppShell
      user={user}
      // Larger touch targets: the SRS calls for effortless operation by
      // non-technical security staff on a gate tablet.
      density="comfortable"
      headerActions={
        <Button asChild size="sm" className="gap-1.5">
          <Link href="/guard/verify">
            <QrCode className="size-4" />
            <span className="hidden sm:inline">Quick scan</span>
            <span className="sm:hidden">Scan</span>
          </Link>
        </Button>
      }
    >
      <div id="main-content">{children}</div>
    </AppShell>
  );
}
