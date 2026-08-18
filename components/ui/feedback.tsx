import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';

import { cn } from '@/lib/utils';

/** Loading, empty, error and inline-alert states used across every module. */

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-pulse rounded-md bg-gradient-to-r from-muted via-muted/50 to-muted bg-[length:200%_100%]',
        className,
      )}
      style={{ animation: 'shimmer 1.6s linear infinite' }}
      {...props}
    />
  );
}

function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border" role="status" aria-label="Loading data">
      <div className="flex gap-4 border-b border-border bg-muted/40 px-4 py-3">
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={index} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 border-b border-border px-4 py-4 last:border-0">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} className="h-4 flex-1" />
          ))}
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" role="status" aria-label="Loading statistics">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-xl border border-border bg-card p-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-4 h-7 w-20" />
          <Skeleton className="mt-3 h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center',
        className,
      )}
    >
      {Icon ? (
        <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Icon className="size-6" aria-hidden />
        </span>
      ) : null}
      <div className="space-y-1">
        <p className="font-semibold">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

// ── Inline alert ──────────────────────────────────────────────────────────────

const alertVariants = cva('flex gap-3 rounded-lg border p-4 text-sm', {
  variants: {
    variant: {
      info: 'border-info/25 bg-info/10 text-foreground [&>svg]:text-info',
      success: 'border-success/25 bg-success/10 text-foreground [&>svg]:text-success',
      warning: 'border-warning/35 bg-warning/10 text-foreground [&>svg]:text-warning',
      destructive: 'border-destructive/25 bg-destructive/10 text-foreground [&>svg]:text-destructive',
    },
  },
  defaultVariants: { variant: 'info' },
});

const ALERT_ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  destructive: AlertCircle,
} as const;

interface AlertProps extends React.ComponentProps<'div'>, VariantProps<typeof alertVariants> {
  title?: string;
  hideIcon?: boolean;
}

function Alert({ className, variant = 'info', title, hideIcon, children, ...props }: AlertProps) {
  const Icon = ALERT_ICONS[variant ?? 'info'];
  return (
    <div role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      {hideIcon ? null : <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />}
      <div className="min-w-0 flex-1 space-y-1">
        {title ? <p className="font-medium leading-tight">{title}</p> : null}
        {children ? <div className="text-muted-foreground">{children}</div> : null}
      </div>
    </div>
  );
}

export { Skeleton, TableSkeleton, CardSkeleton, EmptyState, Alert };
