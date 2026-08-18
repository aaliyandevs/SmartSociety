import type { Metadata } from 'next';
import { Phone, ShieldAlert } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { EmergencyDirectory } from '@/components/shared/emergency-directory';
import { PersonalContacts } from '@/app/resident/emergency/personal-contacts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/feedback';
import { requireResident } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

export const metadata: Metadata = { title: 'Emergency Contacts' };

export default async function ResidentEmergencyPage() {
  const user = await requireResident();

  const [directory, personal] = await Promise.all([
    prisma.emergencyContact.findMany({
      where: { scope: 'SOCIETY_DIRECTORY', deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.emergencyContact.findMany({
      where: { residentId: user.residentId, scope: 'RESIDENT_PERSONAL', deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Safety"
        title="Emergency contacts"
        description="Society, civic and personal emergency numbers. Tap any number to dial it."
      />

      <Alert variant="destructive" title="In a life-threatening emergency">
        Call the fire brigade, ambulance or police directly, then inform the society office and the main
        gate so they can clear access for emergency vehicles.
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="size-4.5 text-primary" aria-hidden />
            Society & civic directory
          </CardTitle>
          <CardDescription>Maintained by the managing committee.</CardDescription>
        </CardHeader>
        <CardContent>
          <EmergencyDirectory
            contacts={directory}
            emptyTitle="Directory not configured"
            emptyDescription="The society office has not published emergency numbers yet."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="size-4.5 text-primary" aria-hidden />
            My emergency contacts
          </CardTitle>
          <CardDescription>
            People the society should reach if something happens at your flat while you are away.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PersonalContacts
            contacts={personal.map((contact) => ({
              id: contact.id,
              name: contact.name,
              relation: contact.relation,
              phone: contact.phone,
              altPhone: contact.altPhone,
              email: contact.email,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
