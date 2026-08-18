'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
} from '@/components/ui/misc';
import { EmptyState } from '@/components/ui/feedback';
import { cn, formatRelative } from '@/lib/utils';
import { useLiveFeed } from '@/hooks/use-live-feed';
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from '@/actions/notification-actions';

export function NotificationBell() {
  const router = useRouter();
  const { unreadCount, notifications, refresh } = useLiveFeed();
  const [open, setOpen] = React.useState(false);
  const [, startTransition] = React.useTransition();

  function openNotification(id: string, link: string | null) {
    startTransition(async () => {
      await markNotificationReadAction(id);
      await refresh();
      setOpen(false);
      if (link) router.push(link);
      else router.refresh();
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        >
          <Bell className="size-4.5" />
          {unreadCount > 0 ? (
            <span className="tabular absolute -right-0.5 -top-0.5 flex min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4.5 text-destructive-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {unreadCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() =>
                startTransition(async () => {
                  await markAllNotificationsReadAction();
                  await refresh();
                })
              }
            >
              <CheckCheck className="size-3.5" />
              Mark all read
            </Button>
          ) : null}
        </div>
        <Separator />

        <div className="max-h-[22rem] overflow-y-auto">
          {notifications.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="Nothing new"
              description="Alerts about your bills, visitors and tickets will appear here."
              className="border-0 bg-transparent py-10"
            />
          ) : (
            <ul className="divide-y divide-border">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => openNotification(notification.id, notification.link)}
                    className={cn(
                      'flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/60',
                      !notification.readAt && 'bg-primary-soft/40',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-1.5 size-2 shrink-0 rounded-full',
                        notification.isUrgent
                          ? 'bg-destructive'
                          : notification.readAt
                            ? 'bg-transparent'
                            : 'bg-primary',
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{notification.title}</span>
                      <span className="mt-0.5 block line-clamp-2 text-xs text-muted-foreground">
                        {notification.body}
                      </span>
                      <span className="mt-1 block text-[11px] text-muted-foreground">
                        {formatRelative(notification.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Separator />
        <div className="p-2">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link href="/account/notifications" onClick={() => setOpen(false)}>
              View all notifications
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
