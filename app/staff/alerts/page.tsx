import type { Metadata } from 'next';

import { PageHeader } from '@/components/shared/page-header';
import { AlertHistory } from '@/components/shared/alert-history';
import { requireRole } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

export const metadata: Metadata = { title: 'Alerts' };

export default async function StaffAlertsPage() {
  await requireRole('MAINTENANCE_STAFF', 'ADMIN');

  const alerts = await prisma.emergencyAlert.findMany({
    orderBy: [{ status: 'asc' }, { startedAt: 'desc' }],
    take: 25,
    include: {
      raisedBy: { select: { fullName: true } },
      resolvedBy: { select: { fullName: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Awareness"
        title="Emergency alerts"
        description="Society-wide broadcasts. Suspend non-urgent work and follow the instructions during an active alert."
      />
      <AlertHistory alerts={alerts} />
    </div>
  );
}
