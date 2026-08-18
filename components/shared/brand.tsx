import Link from 'next/link';

import { cn } from '@/lib/utils';

/** The SmartSociety mark — a stylised tower block inside a shield. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label="SmartSociety"
      className={cn('size-8', className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M16 1.5 28 5.7v10c0 7.4-5 12.9-12 15.8C9 28.6 4 23.1 4 15.7v-10L16 1.5Z"
        fill="currentColor"
        opacity="0.14"
      />
      <path
        d="M16 1.5 28 5.7v10c0 7.4-5 12.9-12 15.8C9 28.6 4 23.1 4 15.7v-10L16 1.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M11 22V12.5l5-3 5 3V22" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14 22v-4h4v4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="16" cy="13.6" r="1.1" fill="currentColor" />
    </svg>
  );
}

export function BrandLogo({
  href = '/',
  className,
  showWordmark = true,
  subtitle,
}: {
  href?: string;
  className?: string;
  showWordmark?: boolean;
  subtitle?: string;
}) {
  return (
    <Link href={href} className={cn('flex items-center gap-2.5 outline-none', className)}>
      <BrandMark className="size-8 shrink-0 text-primary" />
      {showWordmark ? (
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold leading-tight tracking-tight">
            Smart<span className="text-primary">Society</span>
          </span>
          {subtitle ? (
            <span className="block truncate text-[11px] leading-tight text-muted-foreground">{subtitle}</span>
          ) : null}
        </span>
      ) : null}
    </Link>
  );
}
