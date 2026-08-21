'use client';

import * as React from 'react';
import { Siren, Volume2, VolumeX, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLiveFeed, type LiveAlert } from '@/hooks/use-live-feed';

/**
 * Society-wide emergency banner.
 *
 * The SRS calls for an "Interactive Emergency Siren/Alert". Browsers block
 * autoplaying audio until the user interacts with the page, so the siren is
 * offered as an explicit, clearly-labelled control rather than played silently
 * — and it is generated with the Web Audio API, so no audio asset is needed.
 */

const SEVERITY_STYLES = {
  CRITICAL: 'bg-destructive text-destructive-foreground',
  WARNING: 'bg-warning text-warning-foreground',
  INFO: 'bg-info text-info-foreground',
} as const;

function useSiren() {
  const contextRef = React.useRef<AudioContext | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const [playing, setPlaying] = React.useState(false);

  const stop = React.useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    contextRef.current?.close().catch(() => undefined);
    contextRef.current = null;
    setPlaying(false);
  }, []);

  const start = React.useCallback(() => {
    const AudioCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;

    const context = new AudioCtor();
    contextRef.current = context;
    setPlaying(true);

    // Two-tone rising/falling wail, one cycle every 1.4 s.
    const sweep = () => {
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(540, now);
      oscillator.frequency.linearRampToValueAtTime(940, now + 0.6);
      oscillator.frequency.linearRampToValueAtTime(540, now + 1.2);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.16, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.25);

      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 1.3);
    };

    sweep();
    timerRef.current = setInterval(sweep, 1400);
  }, []);

  React.useEffect(() => stop, [stop]);

  return { playing, start, stop };
}

function AlertBanner({ alert, onDismiss }: { alert: LiveAlert; onDismiss: () => void }) {
  const siren = useSiren();

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        'relative z-40 w-full px-4 py-3 animate-slide-up',
        SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.WARNING,
      )}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 sm:flex-row sm:items-center">
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-full bg-white/20',
            alert.severity === 'CRITICAL' && 'animate-pulse-alert',
          )}
        >
          <Siren className="size-5" aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">{alert.title}</p>
          <p className="mt-0.5 text-sm opacity-90">{alert.message}</p>
          {alert.instructions ? (
            <p className="mt-1 text-xs font-medium opacity-90">What to do: {alert.instructions}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {alert.sirenEnabled ? (
            <Button
              size="sm"
              variant="secondary"
              className="bg-white/20 text-current hover:bg-white/30"
              onClick={() => (siren.playing ? siren.stop() : siren.start())}
            >
              {siren.playing ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
              {siren.playing ? 'Silence siren' : 'Sound siren'}
            </Button>
          ) : null}
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-current hover:bg-white/20"
            onClick={() => {
              siren.stop();
              onDismiss();
            }}
            aria-label="Dismiss alert"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function EmergencyBanner() {
  const { activeAlert } = useLiveFeed();
  const [dismissedId, setDismissedId] = React.useState<string | null>(null);

  if (!activeAlert || activeAlert.id === dismissedId) return null;

  return <AlertBanner alert={activeAlert} onDismiss={() => setDismissedId(activeAlert.id)} />;
}
