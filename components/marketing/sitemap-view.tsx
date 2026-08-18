import Link from 'next/link';
import {
  Building2,
  Globe,
  HardHat,
  Home,
  ShieldCheck,
  UserCog,
  type LucideIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SITEMAP, type SitemapSection } from '@/lib/sitemap';

/**
 * The visual sitemap required on the home page by the SRS.
 *
 * It is drawn as a proper tree — a root node, one branch per role area, then
 * grouped leaf pages — using CSS connectors rather than an image, so it stays
 * readable at every breakpoint and every link is real and clickable.
 */

const SECTION_META: Record<
  string,
  { icon: LucideIcon; accent: string; ring: string; dot: string }
> = {
  public: {
    icon: Globe,
    accent: 'text-slate-600 dark:text-slate-300',
    ring: 'border-slate-300 dark:border-slate-600',
    dot: 'bg-slate-400',
  },
  admin: {
    icon: UserCog,
    accent: 'text-[oklch(0.45_0.11_195)] dark:text-[oklch(0.78_0.11_195)]',
    ring: 'border-[oklch(0.62_0.11_195)]',
    dot: 'bg-[oklch(0.55_0.12_195)]',
  },
  resident: {
    icon: Home,
    accent: 'text-[oklch(0.48_0.13_285)] dark:text-[oklch(0.8_0.11_285)]',
    ring: 'border-[oklch(0.62_0.13_285)]',
    dot: 'bg-[oklch(0.55_0.13_285)]',
  },
  guard: {
    icon: ShieldCheck,
    accent: 'text-[oklch(0.48_0.15_255)] dark:text-[oklch(0.8_0.12_255)]',
    ring: 'border-[oklch(0.62_0.15_255)]',
    dot: 'bg-[oklch(0.55_0.15_255)]',
  },
  staff: {
    icon: HardHat,
    accent: 'text-[oklch(0.45_0.14_145)] dark:text-[oklch(0.78_0.12_145)]',
    ring: 'border-[oklch(0.6_0.14_145)]',
    dot: 'bg-[oklch(0.55_0.14_145)]',
  },
  account: {
    icon: Building2,
    accent: 'text-amber-700 dark:text-amber-300',
    ring: 'border-amber-400',
    dot: 'bg-amber-500',
  },
};

function SectionCard({ section }: { section: SitemapSection }) {
  const meta = SECTION_META[section.id] ?? SECTION_META.public;
  const Icon = meta.icon;
  const pageCount = section.groups.reduce((sum, group) => sum + group.links.length, 0);

  return (
    <div className={cn('rounded-xl border-2 bg-card shadow-sm transition-shadow hover:shadow-md', meta.ring)}>
      {/* Branch header */}
      <div className="flex items-start gap-3 border-b border-border p-4">
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted', meta.accent)}>
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold leading-tight">{section.title}</h3>
            <Badge variant="muted">{pageCount} pages</Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{section.audience}</p>
        </div>
      </div>

      <p className="px-4 pt-3 text-xs text-muted-foreground">{section.summary}</p>

      {/* Grouped leaves, drawn as a tree with CSS connectors */}
      <div className="space-y-4 p-4">
        {section.groups.map((group) => (
          <div key={group.title}>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {group.title}
            </p>

            <ul className="space-y-1 border-l border-dashed border-border pl-4">
              {group.links.map((link) => (
                <li key={link.href} className="relative">
                  {/* connector stub from the vertical trunk to the leaf */}
                  <span
                    className="absolute -left-4 top-3.5 h-px w-3 bg-border"
                    aria-hidden
                  />
                  <Link
                    href={link.href}
                    className="group flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent/60"
                  >
                    <span className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', meta.dot)} aria-hidden />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium leading-snug group-hover:underline">
                        {link.label}
                      </span>
                      <span className="block text-[11px] leading-snug text-muted-foreground">
                        {link.description}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SitemapView({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Root node */}
      <div className="flex flex-col items-center">
        <div className="rounded-xl border-2 border-primary bg-primary-soft px-6 py-3 text-center shadow-sm">
          <p className="text-sm font-semibold text-primary">SmartSociety</p>
          <p className="text-xs text-muted-foreground">Smart Society Management System</p>
        </div>
        {/* trunk down to the branches */}
        <span className="h-6 w-px bg-border" aria-hidden />
        <span className="hidden h-px w-full max-w-5xl bg-border lg:block" aria-hidden />
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {SITEMAP.map((section) => (
          <SectionCard key={section.id} section={section} />
        ))}
      </div>
    </div>
  );
}
