import type { Metadata } from 'next';
import { KeyRound, Monitor, ShieldCheck } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { ChangePasswordForm } from '@/app/account/security/change-password-form';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/feedback';
import { requireUser } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { formatDateTime, formatRelative, truncate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Security' };

export default async function AccountSecurityPage() {
  const user = await requireUser();

  const [sessions, recentActivity] = await Promise.all([
    prisma.session.findMany({
      where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.auditLog.findMany({
      where: { userId: user.id, action: { startsWith: 'auth.' } },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Security"
        description="Change your password and review where your account is signed in."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-4.5 text-primary" aria-hidden />
              Change password
            </CardTitle>
            <CardDescription>
              Changing your password signs you out of every other device.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Monitor className="size-4 text-muted-foreground" aria-hidden />
                Active sessions
              </CardTitle>
              <CardDescription>Devices currently logged in as you.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-border border-t border-border">
                {sessions.map((session) => (
                  <li key={session.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">
                        {session.id === user.sessionId ? 'This device' : 'Another device'}
                      </p>
                      {session.id === user.sessionId ? (
                        <Badge variant="success">Current</Badge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {session.ipAddress ?? 'Unknown address'} · started{' '}
                      {formatRelative(session.createdAt)}
                    </p>
                    {session.userAgent ? (
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {truncate(session.userAgent, 60)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldCheck className="size-4 text-muted-foreground" aria-hidden />
                Recent login activity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {recentActivity.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-muted-foreground">No activity recorded yet.</p>
              ) : (
                <ul className="divide-y divide-border border-t border-border">
                  {recentActivity.map((entry) => (
                    <li key={entry.id} className="px-5 py-3">
                      <p className="text-sm">{entry.description}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDateTime(entry.createdAt)}
                        {entry.ipAddress ? ` · ${entry.ipAddress}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Alert variant="info" title="Keeping your account safe">
            Never share your password or gate codes. The society office will never ask you for your
            password.
          </Alert>
        </div>
      </div>
    </div>
  );
}
