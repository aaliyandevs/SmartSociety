import type { Metadata } from 'next';
import { Building2, Phone } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { SocietySettingsForm } from '@/app/admin/settings/society-settings-form';
import { DirectoryManager } from '@/app/admin/settings/directory-manager';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/feedback';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { requireRole } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { getSociety } from '@/services/society-service';

export const metadata: Metadata = { title: 'Settings' };

export default async function AdminSettingsPage() {
  await requireRole('ADMIN');

  const [society, directory] = await Promise.all([
    getSociety(),
    prisma.emergencyContact.findMany({
      where: { scope: 'SOCIETY_DIRECTORY', deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="System"
        title="Society settings"
        description="Society identity, billing policy, house rules and the emergency directory."
      />

      <Tabs defaultValue="society">
        <TabsList>
          <TabsTrigger value="society">Society & billing</TabsTrigger>
          <TabsTrigger value="guidelines">Guidelines</TabsTrigger>
          <TabsTrigger value="directory">Emergency directory</TabsTrigger>
        </TabsList>

        <TabsContent value="society">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="size-4.5 text-primary" aria-hidden />
                Society details
              </CardTitle>
              <CardDescription>
                These appear on generated invoices, receipts and gate passes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SocietySettingsForm
                defaults={{
                  name: society.name,
                  addressLine1: society.addressLine1,
                  addressLine2: society.addressLine2 ?? '',
                  city: society.city,
                  state: society.state,
                  postalCode: society.postalCode,
                  contactEmail: society.contactEmail,
                  contactPhone: society.contactPhone,
                  penaltyPercent: Number(society.penaltyPercent),
                  penaltyGraceDays: society.penaltyGraceDays,
                  guidelines: society.guidelines ?? '',
                }}
                section="society"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guidelines">
          <Card>
            <CardHeader>
              <CardTitle>Society guidelines</CardTitle>
              <CardDescription>
                Published to residents on their Guidelines page. Markdown headings, lists and **bold** are
                rendered.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SocietySettingsForm
                defaults={{
                  name: society.name,
                  addressLine1: society.addressLine1,
                  addressLine2: society.addressLine2 ?? '',
                  city: society.city,
                  state: society.state,
                  postalCode: society.postalCode,
                  contactEmail: society.contactEmail,
                  contactPhone: society.contactPhone,
                  penaltyPercent: Number(society.penaltyPercent),
                  penaltyGraceDays: society.penaltyGraceDays,
                  guidelines: society.guidelines ?? '',
                }}
                section="guidelines"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="directory" className="space-y-4">
          <Alert variant="info" title="Visible to residents, guards and staff">
            These numbers appear on the resident Emergency Contacts page and the guard&apos;s directory, so
            keep them accurate and in a sensible order.
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="size-4.5 text-primary" aria-hidden />
                Emergency directory
              </CardTitle>
              <CardDescription>Society office, security desk and civic emergency numbers.</CardDescription>
            </CardHeader>
            <CardContent>
              <DirectoryManager
                contacts={directory.map((contact) => ({
                  id: contact.id,
                  name: contact.name,
                  designation: contact.designation,
                  phone: contact.phone,
                  altPhone: contact.altPhone,
                  sortOrder: contact.sortOrder,
                }))}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
