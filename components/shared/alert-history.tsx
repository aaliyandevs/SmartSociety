import { Siren } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, EmptyState } from '@/components/ui/feedback';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatDateTime, formatRelative, humanise } from '@/lib/utils';

export interface AlertRecord {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  instructions: string | null;
  status: string;
  startedAt: Date;
  resolvedAt: Date | null;
  resolutionNote: string | null;
  raisedBy?: { fullName: string } | null;
  resolvedBy?: { fullName: string } | null;
}

/** Read-only alert feed shared by the guard, staff and admin consoles. */
export function AlertHistory({ alerts, actions }: { alerts: AlertRecord[]; actions?: React.ReactNode }) {
  if (alerts.length === 0) {
    return (
      <EmptyState
        icon={Siren}
        title="No alerts on record"
        description="Emergency broadcasts raised by the society office will appear here."
      />
    );
  }

  const active = alerts.filter((alert) => alert.status === 'ACTIVE');
  const resolved = alerts.filter((alert) => alert.status !== 'ACTIVE');

  return (
    <div className="space-y-6">
      {active.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-destructive">
            Active now ({active.length})
          </h2>
          {active.map((alert) => (
            <Card key={alert.id} className="border-destructive/50">
              <CardContent className="space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{alert.title}</h3>
                      <StatusBadge status={alert.severity} />
                      <Badge variant="outline">{humanise(alert.type)}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Raised {formatRelative(alert.startedAt)}
                      {alert.raisedBy ? ` by ${alert.raisedBy.fullName}` : ''}
                    </p>
                  </div>
                  {actions}
                </div>

                <p className="text-sm">{alert.message}</p>
                {alert.instructions ? (
                  <Alert variant="warning" title="What to do">
                    {alert.instructions}
                  </Alert>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </section>
      ) : (
        <Alert variant="success" title="No active emergency">
          There is no emergency alert running right now. Resolved alerts from the past are listed below for
          reference.
        </Alert>
      )}

      {resolved.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Resolved ({resolved.length})
          </h2>
          <div className="space-y-3">
            {resolved.map((alert) => (
              <Card key={alert.id}>
                <CardContent className="space-y-2 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{alert.title}</h3>
                    <StatusBadge status={alert.severity} />
                    <Badge variant="outline">{humanise(alert.type)}</Badge>
                    <Badge variant="muted">Resolved</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{alert.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(alert.startedAt)} → {formatDateTime(alert.resolvedAt)}
                    {alert.resolvedBy ? ` · closed by ${alert.resolvedBy.fullName}` : ''}
                  </p>
                  {alert.resolutionNote ? (
                    <p className="text-xs text-muted-foreground">{alert.resolutionNote}</p>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
