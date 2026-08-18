import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Clock } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/feedback';
import { ComplaintForm } from '@/app/resident/complaints/new/complaint-form';
import { requireResident } from '@/lib/auth/session';
import { SLA_HOURS } from '@/lib/validations/complaint';

export const metadata: Metadata = { title: 'Raise a Ticket' };

export default async function NewComplaintPage() {
  const user = await requireResident();

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/resident/complaints">
          <ArrowLeft className="size-4" />
          Back to my complaints
        </Link>
      </Button>

      <PageHeader
        eyebrow={`Flat ${user.flatLabel}`}
        title="Raise a maintenance ticket"
        description="Describe the problem and add photos. The society office routes it to the right technician."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Ticket details</CardTitle>
            <CardDescription>
              The clearer the description, the better prepared the technician will be.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ComplaintForm />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Clock className="size-4 text-muted-foreground" aria-hidden />
                Response targets
              </CardTitle>
              <CardDescription>The service level applied by priority.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2.5 text-sm">
                {(
                  [
                    ['Critical', SLA_HOURS.CRITICAL, 'Lift entrapment, major leak, fire risk'],
                    ['High', SLA_HOURS.HIGH, 'No water, unsafe wiring, security issue'],
                    ['Medium', SLA_HOURS.MEDIUM, 'Blocked drain, corridor light out'],
                    ['Low', SLA_HOURS.LOW, 'Cosmetic repairs, minor requests'],
                  ] as const
                ).map(([label, hours, example]) => (
                  <div key={label} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <dt className="font-medium">{label}</dt>
                      <dd className="text-xs text-muted-foreground">{example}</dd>
                    </div>
                    <span className="tabular shrink-0 text-sm font-medium">{hours} h</span>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <Alert variant="warning" title="For an emergency">
            Do not wait on a ticket for a fire, lift entrapment or major water leak. Call the security desk
            immediately — the numbers are in your Emergency Contacts page.
          </Alert>
        </div>
      </div>
    </div>
  );
}
