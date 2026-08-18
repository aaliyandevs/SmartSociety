import * as React from 'react';

import { BrandLogo } from '@/components/shared/brand';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { EmergencyBanner } from '@/components/layout/emergency-banner';
import { MobileNav } from '@/components/layout/mobile-nav';
import { NotificationBell } from '@/components/layout/notification-bell';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { UserMenu } from '@/components/layout/user-menu';
import type { CurrentUser } from '@/lib/auth/session';
import { ROLE_LABELS } from '@/lib/rbac';
import { publicEnv } from '@/lib/env';
import { cn } from '@/lib/utils';

interface AppShellProps {
  user: CurrentUser;
  children: React.ReactNode;
  /** Extra controls rendered in the top bar (e.g. the guard's quick-scan button). */
  headerActions?: React.ReactNode;
  /** Comfortable spacing + bigger targets for the gate tablet. */
  density?: 'default' | 'comfortable';
}

/**
 * The signed-in application frame: fixed sidebar on large screens, a slide-over
 * drawer below `lg`, sticky top bar, and the society-wide emergency banner.
 */
export function AppShell({ user, children, headerActions, density = 'default' }: AppShellProps) {
  const subtitle =
    user.role === 'RESIDENT' && user.flatLabel
      ? `Flat ${user.flatLabel}`
      : user.role === 'GUARD' && user.gateAssignment
        ? user.gateAssignment
        : ROLE_LABELS[user.role];

  return (
    <div data-role={user.role} className="min-h-dvh bg-background">
      <EmergencyBanner />

      <div className="flex min-h-dvh">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
          <div className="flex h-16 items-center border-b border-sidebar-border px-5">
            <BrandLogo href={`/${user.role.toLowerCase()}`} subtitle={publicEnv.societyName} />
          </div>
          <div className="flex-1 overflow-y-auto">
            <SidebarNav role={user.role} size={density} />
          </div>
          <div className="border-t border-sidebar-border px-5 py-3">
            <p className="text-[11px] text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{ROLE_LABELS[user.role]}</span>
            </p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <header className="glass-panel sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border px-3 sm:px-5">
            <MobileNav role={user.role} subtitle={publicEnv.societyName} />
            <div className="lg:hidden">
              <BrandLogo href={`/${user.role.toLowerCase()}`} showWordmark={false} />
            </div>

            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              {headerActions}
              <NotificationBell />
              <ThemeToggle />
              <UserMenu
                name={user.fullName}
                email={user.email}
                role={user.role}
                avatarUrl={user.avatarUrl}
                subtitle={subtitle}
              />
            </div>
          </header>

          <main
            className={cn(
              'mx-auto w-full max-w-7xl flex-1 px-3 py-5 sm:px-5 sm:py-6 lg:px-8',
              density === 'comfortable' && 'max-w-6xl',
            )}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
