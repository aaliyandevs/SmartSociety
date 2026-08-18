import type { Metadata } from 'next';
import { FileText } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { MarkdownBlock } from '@/components/shared/markdown-block';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { requireResident } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { formatDate, humanise } from '@/lib/utils';
import { getSociety } from '@/services/society-service';

export const metadata: Metadata = { title: 'Society Guidelines' };

export default async function GuidelinesPage() {
  await requireResident();

  const [society, guidelineNotices] = await Promise.all([
    getSociety(),
    prisma.notice.findMany({
      where: { deletedAt: null, isPublished: true, category: 'GUIDELINE' },
      orderBy: { publishAt: 'desc' },
      take: 10,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reference"
        title="Society guidelines"
        description={`House rules adopted by the managing committee of ${society.name}.`}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            {society.guidelines ? (
              <MarkdownBlock content={society.guidelines} />
            ) : (
              <EmptyState
                icon={FileText}
                title="Guidelines not published yet"
                description="The managing committee has not uploaded the society rulebook."
              />
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Society details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {[
                ['Name', society.name],
                ['Registration', society.registrationNo ?? '—'],
                [
                  'Address',
                  [society.addressLine1, society.addressLine2, society.city, society.postalCode]
                    .filter(Boolean)
                    .join(', '),
                ],
                ['Office email', society.contactEmail],
                ['Office phone', society.contactPhone],
                ['Late payment penalty', `${Number(society.penaltyPercent)}%`],
                ['Grace period', `${society.penaltyGraceDays} days after the due date`],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <span className="shrink-0 text-muted-foreground">{label}</span>
                  <span className="text-right font-medium">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {guidelineNotices.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Rule updates</CardTitle>
                <CardDescription>Notices that amend or clarify the guidelines.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-border border-t border-border">
                  {guidelineNotices.map((notice) => (
                    <li key={notice.id} className="px-5 py-3">
                      <p className="text-sm font-medium">{notice.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {humanise(notice.category)} · {formatDate(notice.publishAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
