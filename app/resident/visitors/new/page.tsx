import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Info } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/feedback';
import { GatePassForm } from '@/app/resident/visitors/new/gate-pass-form';
import { requireResident } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'New Visitor Pass' };

export default async function NewGatePassPage() {
  const user = await requireResident();

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/resident/visitors">
          <ArrowLeft className="size-4" />
          Back to visitor passes
        </Link>
      </Button>

      <PageHeader
        eyebrow={`Flat ${user.flatLabel}`}
        title="Create a visitor pass"
        description="The pass generates a QR code and a 6-digit gate code. Share either with your visitor."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Visitor details</CardTitle>
            <CardDescription>
              The security desk will see these details when the pass is scanned.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GatePassForm />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Alert variant="info" title="How the pass works">
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>Your visitor shows the QR code, or reads out the 6-digit gate code.</li>
              <li>The guard verifies it and records the entry — usually in under two seconds.</li>
              <li>You are notified the moment your visitor is cleared at the gate.</li>
              <li>The pass stops working automatically once the window closes.</li>
            </ul>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Info className="size-4 text-muted-foreground" aria-hidden />
                Society rules
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Visitors arriving after 10:00 PM are admitted only against a valid gate pass.</p>
              <p>Delivery and cab drivers are permitted up to the tower lobby unless you approve otherwise.</p>
              <p>A pass can stay valid for up to 30 days; use multiple entries for recurring vendors.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
