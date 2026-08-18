import type { Metadata } from 'next';

import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/feedback';
import { WalkInForm } from '@/app/guard/walk-in/walk-in-form';
import { requireRole } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

export const metadata: Metadata = { title: 'Walk-in Entry' };

const GATES = ['Main Gate', 'Service Gate'];

export default async function WalkInPage() {
  const user = await requireRole('GUARD', 'ADMIN');

  // The whole flat list is small enough to filter in the browser, which keeps
  // the lookup instant on a gate tablet with a poor network.
  const flats = await prisma.flat.findMany({
    where: { deletedAt: null },
    orderBy: [{ block: { name: 'asc' } }, { flatNumber: 'asc' }],
    select: {
      id: true,
      flatNumber: true,
      block: { select: { name: true } },
      residents: {
        where: { deletedAt: null },
        orderBy: { isPrimary: 'desc' },
        take: 1,
        select: { user: { select: { fullName: true, phone: true } } },
      },
    },
  });

  const options = flats.map((flat) => ({
    id: flat.id,
    label: `${flat.block.name}-${flat.flatNumber}`,
    resident: flat.residents[0]?.user.fullName ?? 'Vacant',
    phone: flat.residents[0]?.user.phone ?? null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Gate entry"
        title="Log a walk-in visitor"
        description="Use this when a visitor arrives without a pre-approved gate pass."
      />

      <Alert variant="info" title="Before you admit an unannounced visitor">
        Confirm with the resident on the intercom or by phone. After 10:00 PM, society rules require a valid
        gate pass — call the flat before allowing entry.
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Visitor details</CardTitle>
          <CardDescription>
            The entry is time-stamped now and recorded against your name ({user.fullName}).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WalkInForm flats={options} gates={GATES} defaultGate={user.gateAssignment ?? GATES[0]} />
        </CardContent>
      </Card>
    </div>
  );
}
