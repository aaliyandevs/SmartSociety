import type { Metadata } from 'next';
import { Siren } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { AlertHistory } from '@/components/shared/alert-history';
import { BroadcastDialog, ResolveAlertButton } from '@/app/admin/alerts/alert-controls';
import { Alert } from '@/components/ui/feedback';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireRole } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

export const metadata: Metadata = { title: 'Emergency Alerts' };

export default async function AdminAlertsPage() {
  await requireRole('ADMIN');

  const [alerts, blocks, activeAlert] = await Promise.all([
    prisma.emergencyAlert.findMany({
      orderBy: [{ status: 'asc' }, { startedAt: 'desc' }],
      take: 40,
      include: {
        raisedBy: { select: { fullName: true } },
        resolvedBy: { select: { fullName: true } },
      },
    }),
    prisma.block.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }),
    prisma.emergencyAlert.findFirst({ where: { status: 'ACTIVE' }, select: { id: true, title: true } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Safety"
        title="Emergency alerts"
        description="Broadcast an alert to every resident, guard and staff member instantly."
        actions={<BroadcastDialog blocks={blocks.map((b) => ({ id: b.id, name: b.name }))} />}
      />

      <Alert variant="warning" title="Broadcasting is immediate and society-wide">
        An alert shows as a full-width banner on every signed-in device, sends an urgent notification, and
        can sound an audible siren. Use it only for genuine emergencies and resolve it as soon as the
        situation is under control.
      </Alert>

      {activeAlert ? (
        <Card className="border-destructive/50">
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Siren className="size-4.5 animate-pulse-alert rounded-full" aria-hidden />
                An alert is currently active
              </CardTitle>
              <CardDescription>{activeAlert.title}</CardDescription>
            </div>
            <ResolveAlertButton alertId={activeAlert.id} title={activeAlert.title} />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Resolving the alert clears the banner for everyone and records the closure in the audit log.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <AlertHistory alerts={alerts} />
    </div>
  );
}
