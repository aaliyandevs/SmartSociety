import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  ClipboardList,
  DoorOpen,
  LogOut,
  QrCode,
  ShieldAlert,
  Ticket,
  TriangleAlert,
  UserCheck,
  Users,
} from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, EmptyState } from '@/components/ui/feedback';
import { ExitButton } from '@/app/guard/exit-button';
import { requireRole } from '@/lib/auth/session';
import { formatDateTime, formatInTimeZone, formatRelative, formatTime, humanise } from '@/lib/utils';
import { getGuardDashboard } from '@/services/dashboard-service';
import { expireStalePasses } from '@/services/gate-service';

export const metadata: Metadata = { title: 'Gate Dashboard' };

/**
 * The gate console.
 *
 * Deliberately dense in information but simple in interaction: two large
 * primary actions at the top, then four lists a guard can scan without training
 * (SRS NFR: "Simplified interface tailored for effortless operation by
 * non-technical security staff").
 */
export default async function GuardDashboardPage() {
  const user = await requireRole('GUARD', 'ADMIN');
  await expireStalePasses();
  const data = await getGuardDashboard();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={user.gateAssignment ?? 'Security'}
        title="Gate console"
        description={`${formatInTimeZone(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })} · logged in as ${user.fullName}`}
      />

      {data.activeAlert ? (
        <Alert variant="destructive" title={data.activeAlert.title}>
          {data.activeAlert.message}{' '}
          <Link href="/guard/alerts" className="font-medium text-foreground underline underline-offset-2">
            View alert details
          </Link>
        </Alert>
      ) : null}

      {/* ── The two actions a guard needs most ── */}
      <section className="grid gap-3 sm:grid-cols-2">
        <Button
          asChild
          size="xl"
          className="h-24 justify-start gap-4 text-left transition-transform hover:-translate-y-0.5 hover:shadow-lg"
        >
          <Link href="/guard/verify">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <QrCode className="size-6" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-base font-semibold">Verify a gate pass</span>
              <span className="block text-xs font-normal opacity-85">
                Scan the QR code or type the 6-digit gate code
              </span>
            </span>
          </Link>
        </Button>

        <Button
          asChild
          size="xl"
          variant="outline"
          className="h-24 justify-start gap-4 text-left transition-transform hover:-translate-y-0.5 hover:shadow-lg"
        >
          <Link href="/guard/walk-in">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <DoorOpen className="size-6" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-base font-semibold">Log a walk-in visitor</span>
              <span className="block text-xs font-normal text-muted-foreground">
                No pass? Record the visitor manually
              </span>
            </span>
          </Link>
        </Button>
      </section>

      {/* ── Today at a glance ── */}
      <section className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Entries today"
          value={data.entriesToday}
          icon={UserCheck}
          tone="info"
          className="transition-shadow hover:border-primary/40 hover:shadow-md"
        />
        <StatCard
          label="Exits today"
          value={data.exitsToday}
          icon={LogOut}
          className="transition-shadow hover:border-primary/40 hover:shadow-md"
        />
        <StatCard
          label="Inside now"
          value={data.insideNow}
          icon={Users}
          tone={data.insideNow > 0 ? 'success' : 'default'}
          href="/guard/logs?status=INSIDE"
        />
        <StatCard
          label="Refused today"
          value={data.deniedToday}
          icon={ShieldAlert}
          tone={data.deniedToday > 0 ? 'destructive' : 'default'}
          className="transition-shadow hover:border-primary/40 hover:shadow-md"
        />
      </section>

      {/* ── Overstays first: they need action ── */}
      {data.overstays.length > 0 ? (
        <Card className="border-destructive/40 transition-shadow hover:border-destructive/60 hover:shadow-md">
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <TriangleAlert className="size-4.5" aria-hidden />
                Overstaying visitors
              </CardTitle>
              <CardDescription>
                These visitors are still inside past their expected exit time.
              </CardDescription>
            </div>
            <Badge variant="destructive">{data.overstays.length}</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border border-t border-border">
              {data.overstays.map((log) => (
                <li
                  key={log.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/40"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{log.visitor.name}</span>
                    <span className="block text-sm text-muted-foreground">
                      {log.visitor.company ? `${log.visitor.company} · ` : ''}
                      {humanise(log.visitor.visitorType)} → Flat {log.flat.block.name}-{log.flat.flatNumber}
                    </span>
                    <span className="mt-0.5 block text-xs text-destructive">
                      Expected out {formatRelative(log.expectedExitAt)} · entered{' '}
                      {formatDateTime(log.entryAt)}
                    </span>
                  </span>
                  <span className="flex shrink-0 gap-2">
                    <ExitButton gateLogId={log.id} visitorName={log.visitor.name} />
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        {/* ── Expected today ── */}
        <Card className="transition-shadow hover:border-primary/40 hover:shadow-md">
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle>Expected visitors</CardTitle>
              <CardDescription>Pre-approved passes valid right now or later today.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/guard/expected">
                All
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {data.expectedToday.length === 0 ? (
              <EmptyState
                icon={Ticket}
                title="No passes expected"
                description="Residents have not pre-approved any visitors for today."
                className="m-5 mt-0"
              />
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {data.expectedToday.slice(0, 6).map((pass) => (
                  <li
                    key={pass.id}
                    className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/40"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{pass.visitor.name}</span>
                      <span className="block text-sm text-muted-foreground">
                        Flat {pass.flat.block.name}-{pass.flat.flatNumber} ·{' '}
                        {pass.resident.user.fullName}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {humanise(pass.visitorType)}
                        {pass.visitor.vehicleNumber ? ` · ${pass.visitor.vehicleNumber}` : ''} · until{' '}
                        {formatTime(pass.validUntil)}
                      </span>
                    </span>
                    <Badge variant="soft" className="shrink-0 font-mono text-sm">
                      {pass.gateCode}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* ── Recent movements ── */}
        <Card className="transition-shadow hover:border-primary/40 hover:shadow-md">
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle>Recent gate movements</CardTitle>
              <CardDescription>The last ten entries, exits and refusals.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/guard/logs">
                Full log
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {data.recentActivity.length === 0 ? (
              <EmptyState icon={ClipboardList} title="No movements recorded yet" className="m-5 mt-0" />
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {data.recentActivity.map((log) => (
                  <li
                    key={log.id}
                    className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/40"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{log.visitor.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        Flat {log.flat.block.name}-{log.flat.flatNumber} · {log.gate} ·{' '}
                        {humanise(log.verificationMethod)}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {log.exitAt
                          ? `Exited ${formatDateTime(log.exitAt)}`
                          : log.entryAt
                            ? `Entered ${formatDateTime(log.entryAt)}`
                            : formatDateTime(log.createdAt)}
                      </span>
                    </span>
                    <span className="shrink-0 space-y-1 text-right">
                      <StatusBadge status={log.status} />
                      {log.status === 'INSIDE' || log.status === 'OVERSTAY' ? (
                        <ExitButton gateLogId={log.id} visitorName={log.visitor.name} compact />
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
