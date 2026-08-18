'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from '@/actions/notification-actions';
import { cn, formatDateTime, formatRelative, humanise } from '@/lib/utils';

export interface NotificationView {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  isUrgent: boolean;
  readAt: string | null;
  createdAt: string;
}

export function NotificationList({
  notifications,
  unreadCount,
}: {
  notifications: NotificationView[];
  unreadCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function markRead(id: string) {
    startTransition(async () => {
      const result = await markNotificationReadAction(id);
      if (result.status === 'error') toast.error(result.message);
      router.refresh();
    });
  }

  function markAll() {
    startTransition(async () => {
      const result = await markAllNotificationsReadAction();
      if (result.status === 'success') toast.success(result.message);
      else if (result.status === 'error') toast.error(result.message);
      router.refresh();
    });
  }

  const unread = notifications.filter((notification) => !notification.readAt);

  function render(list: NotificationView[], emptyLabel: string) {
    if (list.length === 0) {
      return (
        <EmptyState
          icon={Bell}
          title={emptyLabel}
          description="Notifications about your bills, visitors, tickets and bookings appear here."
        />
      );
    }

    return (
      <div className="space-y-2">
        {list.map((notification) => {
          const body = (
            <CardContent
              className={cn(
                'flex items-start gap-3 p-4',
                !notification.readAt && 'bg-primary-soft/40',
              )}
            >
              <span
                className={cn(
                  'mt-1.5 size-2 shrink-0 rounded-full',
                  notification.isUrgent
                    ? 'bg-destructive'
                    : notification.readAt
                      ? 'bg-border'
                      : 'bg-primary',
                )}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{notification.title}</span>
                  {notification.isUrgent ? <Badge variant="destructive">Urgent</Badge> : null}
                  <Badge variant="muted">{humanise(notification.type)}</Badge>
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">{notification.body}</span>
                <span
                  className="mt-1 block text-xs text-muted-foreground"
                  title={formatDateTime(notification.createdAt)}
                >
                  {formatRelative(notification.createdAt)}
                </span>
              </span>

              {!notification.readAt ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={(event) => {
                    event.preventDefault();
                    markRead(notification.id);
                  }}
                >
                  Mark read
                </Button>
              ) : null}
            </CardContent>
          );

          return notification.link ? (
            <Card key={notification.id} className="transition-colors hover:border-primary/40">
              <Link
                href={notification.link}
                onClick={() => !notification.readAt && markRead(notification.id)}
                className="block"
              >
                {body}
              </Link>
            </Card>
          ) : (
            <Card key={notification.id}>{body}</Card>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {unreadCount === 0
            ? 'You are all caught up.'
            : `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}.`}
        </p>
        {unreadCount > 0 ? (
          <Button variant="outline" size="sm" onClick={markAll} loading={pending}>
            <CheckCheck className="size-4" />
            Mark all as read
          </Button>
        ) : null}
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({notifications.length})</TabsTrigger>
          <TabsTrigger value="unread">Unread ({unread.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="all">{render(notifications, 'No notifications yet')}</TabsContent>
        <TabsContent value="unread">{render(unread, 'Nothing unread')}</TabsContent>
      </Tabs>
    </div>
  );
}
