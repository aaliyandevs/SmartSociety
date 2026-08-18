'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { Role } from '@prisma/client';

import { cn } from '@/lib/utils';
import { NAV_BY_ROLE, isNavItemActive } from '@/lib/navigation';

interface SidebarNavProps {
  /**
   * The role, not the sections themselves: navigation items carry Lucide
   * *component references*, which cannot cross the server → client boundary.
   * Looking them up here keeps the payload serialisable.
   */
  role: Role;
  onNavigate?: () => void;
  /** Larger hit targets for the gate tablet. */
  size?: 'default' | 'comfortable';
}

export function SidebarNav({ role, onNavigate, size = 'default' }: SidebarNavProps) {
  const pathname = usePathname();
  const sections = NAV_BY_ROLE[role];

  return (
    <nav className="flex flex-col gap-6 px-3 py-4" aria-label="Main">
      {sections.map((section) => (
        <div key={section.title} className="space-y-1">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {section.title}
          </p>
          {section.items.map((item) => {
            const active = isNavItemActive(item, pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
                  size === 'comfortable' ? 'py-3' : 'py-2',
                  active
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                )}
              >
                <Icon className={cn('shrink-0', size === 'comfortable' ? 'size-5' : 'size-4.5')} aria-hidden />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
