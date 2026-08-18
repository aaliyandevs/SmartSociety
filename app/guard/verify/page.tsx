import type { Metadata } from 'next';

import { PageHeader } from '@/components/shared/page-header';
import { VerifyConsole } from '@/app/guard/verify/verify-console';
import { requireRole } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Verify Pass' };

const GATES = ['Main Gate', 'Service Gate'];

export default async function VerifyPage() {
  const user = await requireRole('GUARD', 'ADMIN');

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Gate clearance"
        title="Verify a visitor pass"
        description="Scan the visitor's QR code, or type the 6-digit gate code they were given."
      />
      <VerifyConsole gates={GATES} defaultGate={user.gateAssignment ?? GATES[0]} />
    </div>
  );
}
