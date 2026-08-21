'use client';

import * as React from 'react';

export interface LiveNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  isUrgent: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface LiveAlert {
  id: string;
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  instructions: string | null;
  sirenEnabled: boolean;
  startedAt: string;
}

interface LiveFeed {
  unreadCount: number;
  notifications: LiveNotification[];
  activeAlert: LiveAlert | null;
}

const EMPTY: LiveFeed = { unreadCount: 0, notifications: [], activeAlert: null };

interface LiveFeedState extends LiveFeed {
  loading: boolean;
  refresh: () => Promise<void>;
}

const LiveFeedContext = React.createContext<LiveFeedState | null>(null);

/**
 * Shares one poller across every consumer on the page. `NotificationBell` and
 * `EmergencyBanner` both need this feed and are mounted together on every
 * dashboard layout — each calling its own `useLiveFeed()` used to mean two
 * independent polling loops (and two `/api/notifications` requests firing on
 * every load), doubling a request that only needs to happen once.
 */
export function LiveFeedProvider({ children }: { children: React.ReactNode }) {
  const feed = useLiveFeedPoller(30_000);
  return React.createElement(LiveFeedContext.Provider, { value: feed }, children);
}

export function useLiveFeed(): LiveFeedState {
  const context = React.useContext(LiveFeedContext);
  if (!context) {
    throw new Error('useLiveFeed must be used within a LiveFeedProvider');
  }
  return context;
}

/**
 * Polls the notification endpoint on a fixed interval.
 *
 * Polling (rather than websockets) keeps the deployment a single Node process,
 * which is what the SRS hardware section describes. The interval pauses while
 * the tab is hidden so a gate tablet left on standby does not burn requests.
 */
function useLiveFeedPoller(intervalMs = 45_000) {
  const [feed, setFeed] = React.useState<LiveFeed>(EMPTY);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    try {
      const response = await fetch('/api/notifications', { cache: 'no-store' });
      if (!response.ok) return;
      setFeed((await response.json()) as LiveFeed);
    } catch {
      // Network hiccup — keep the last known state rather than clearing the bell.
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      void refresh();
      timer = setInterval(refresh, intervalMs);
    };
    const stop = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    };

    const onVisibility = () => (document.visibilityState === 'visible' ? start() : stop());

    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs, refresh]);

  return { ...feed, loading, refresh };
}
