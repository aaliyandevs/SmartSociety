import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, TrendingDown, TrendingUp } from 'lucide-react';

import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ElementType;
  tone?: 'default' | 'success' | 'warning' | 'destructive' | 'info';
  trend?: { direction: 'up' | 'down'; label: string };
  href?: string;
  className?: string;
}

const TONE_STYLES = {
  default: 'bg-primary-soft text-primary',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/20 text-warning-foreground dark:text-warning',
  destructive: 'bg-destructive/15 text-destructive',
  info: 'bg-info/15 text-info',
} as const;

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
  trend,
  href,
  className,
}: StatCardProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {Icon ? (
          <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', TONE_STYLES[tone])}>
            <Icon className="size-4.5" aria-hidden />
          </span>
        ) : null}
      </div>

      <p className="tabular mt-3 text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{value}</p>

      <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
        {trend ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 font-medium',
              trend.direction === 'up' ? 'text-success' : 'text-destructive',
            )}
          >
            {trend.direction === 'up' ? (
              <TrendingUp className="size-3.5" aria-hidden />
            ) : (
              <TrendingDown className="size-3.5" aria-hidden />
            )}
            {trend.label}
          </span>
        ) : null}
        {hint ? <span className="min-w-0 truncate">{hint}</span> : null}
      </div>

      {href ? (
        <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
          View details
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      ) : null}
    </>
  );

  const classes = cn(
    'group rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow',
    href && 'hover:border-primary/40 hover:shadow-md',
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {body}
      </Link>
    );
  }

  return <div className={classes}>{body}</div>;
}
