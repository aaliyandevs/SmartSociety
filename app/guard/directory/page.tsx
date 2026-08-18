import type { Metadata } from 'next';

import { PageHeader } from '@/components/shared/page-header';
import { EmergencyDirectory } from '@/components/shared/emergency-directory';
import { Alert } from '@/components/ui/feedback';
import { requireRole } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

export const metadata: Metadata = { title: 'Emergency Directory' };

export default async function GuardDirectoryPage() {
  await requireRole('GUARD', 'ADMIN');

  const contacts = await prisma.emergencyContact.findMany({
    where: { scope: 'SOCIETY_DIRECTORY', deletedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reference"
        title="Emergency directory"
        description="Society and civic emergency numbers. Tap any number to dial it."
      />

      <Alert variant="warning" title="In a life-threatening emergency">
        Call the fire brigade, ambulance or police first, then inform the society office. Open the main gate
        barrier immediately so emergency vehicles can enter.
      </Alert>

      <EmergencyDirectory contacts={contacts} />
    </div>
  );
}
