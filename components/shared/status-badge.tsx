import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { humanise } from '@/lib/utils';

type BadgeVariant = React.ComponentProps<typeof Badge>['variant'];

/**
 * Single source of truth for how every status enum is coloured, so a "PAID"
 * bill looks the same on the admin table, the resident card and the receipt.
 */
const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  // Users / flats
  ACTIVE: 'success',
  INACTIVE: 'muted',
  SUSPENDED: 'destructive',
  OCCUPIED: 'success',
  VACANT: 'muted',
  UNDER_MAINTENANCE: 'warning',
  OWNER: 'info',
  TENANT: 'soft',

  // Bills & payments
  PAID: 'success',
  UNPAID: 'warning',
  PARTIALLY_PAID: 'info',
  OVERDUE: 'destructive',
  CANCELLED: 'muted',
  SUCCESS: 'success',
  FAILED: 'destructive',
  REFUNDED: 'info',

  // Complaints
  PENDING: 'warning',
  IN_PROGRESS: 'info',
  RESOLVED: 'success',
  CLOSED: 'muted',

  // Priorities
  LOW: 'muted',
  MEDIUM: 'info',
  HIGH: 'warning',
  CRITICAL: 'destructive',
  NORMAL: 'muted',
  URGENT: 'destructive',

  // Gate passes & logs
  SCHEDULED: 'info',
  USED: 'muted',
  EXPIRED: 'muted',
  REJECTED: 'destructive',
  INSIDE: 'info',
  EXITED: 'muted',
  DENIED: 'destructive',
  OVERSTAY: 'destructive',

  // Bookings
  CONFIRMED: 'success',
  COMPLETED: 'muted',

  // Polls & alerts
  DRAFT: 'muted',
  WARNING: 'warning',
  INFO: 'info',
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string | null | undefined;
  label?: string;
  className?: string;
}) {
  if (!status) return <Badge variant="muted" className={className}>—</Badge>;
  return (
    <Badge variant={STATUS_VARIANTS[status] ?? 'secondary'} className={className}>
      {label ?? humanise(status)}
    </Badge>
  );
}
