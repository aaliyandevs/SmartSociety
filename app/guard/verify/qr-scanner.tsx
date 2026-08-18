'use client';

import * as React from 'react';
import { Camera, CameraOff, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';

/**
 * Camera-based QR reader for the gate tablet.
 *
 * `@zxing/browser` is loaded lazily so the ~200 KB decoder is only fetched when
 * a guard actually switches to scan mode — the keypad path stays fast on a
 * low-powered tablet.
 */
export function QrScanner({ onResult }: { onResult: (value: string) => void }) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const controlsRef = React.useRef<{ stop: () => void } | null>(null);
  const [status, setStatus] = React.useState<'idle' | 'starting' | 'running' | 'error'>('idle');
  const [error, setError] = React.useState<string | null>(null);
  const [devices, setDevices] = React.useState<MediaDeviceInfo[]>([]);
  const [deviceIndex, setDeviceIndex] = React.useState(0);

  // Keep the latest callback without restarting the camera on every render.
  const onResultRef = React.useRef(onResult);
  React.useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const stop = React.useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setStatus('idle');
  }, []);

  const start = React.useCallback(async () => {
    setStatus('starting');
    setError(null);

    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      const reader = new BrowserQRCodeReader();

      const available = await BrowserQRCodeReader.listVideoInputDevices().catch(
        () => [] as MediaDeviceInfo[],
      );
      setDevices(available);

      // Prefer the rear camera on a tablet.
      const preferred =
        available.find((device) => /back|rear|environment/i.test(device.label)) ??
        available[deviceIndex] ??
        available[0];

      const controls = await reader.decodeFromVideoDevice(
        preferred?.deviceId,
        videoRef.current ?? undefined,
        (result) => {
          if (!result) return;
          const text = result.getText();
          if (!text) return;
          controls.stop();
          controlsRef.current = null;
          setStatus('idle');
          onResultRef.current(text);
        },
      );

      controlsRef.current = controls;
      setStatus('running');
    } catch (caught) {
      const message =
        caught instanceof Error && /permission|denied|NotAllowed/i.test(caught.message)
          ? 'Camera access was blocked. Allow camera permission in the browser, or use the keypad instead.'
          : 'Could not start the camera on this device. Use the keypad to type the gate code instead.';
      setError(message);
      setStatus('error');
    }
  }, [deviceIndex]);

  // Always release the camera when leaving the screen.
  React.useEffect(() => () => controlsRef.current?.stop(), []);

  return (
    <div className="space-y-3">
      <div className="relative aspect-4/3 w-full overflow-hidden rounded-xl border border-border bg-foreground/90">
        <video
          ref={videoRef}
          className="size-full object-cover"
          muted
          playsInline
          aria-label="Camera preview for QR scanning"
        />

        {status !== 'running' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-foreground/70 text-background">
            <CameraOff className="size-8 opacity-70" aria-hidden />
            <p className="text-sm opacity-90">
              {status === 'starting' ? 'Starting the camera…' : 'Camera is off'}
            </p>
          </div>
        ) : (
          // Reticle to help the guard frame the code.
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="size-48 rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
        )}
      </div>

      {error ? <Alert variant="warning">{error}</Alert> : null}

      <div className="flex flex-wrap gap-2">
        {status === 'running' ? (
          <Button type="button" variant="outline" onClick={stop} className="flex-1">
            <CameraOff className="size-4" />
            Stop camera
          </Button>
        ) : (
          <Button type="button" onClick={start} loading={status === 'starting'} className="flex-1">
            <Camera className="size-4" />
            Start camera
          </Button>
        )}

        {devices.length > 1 ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              stop();
              setDeviceIndex((index) => (index + 1) % devices.length);
              setTimeout(start, 120);
            }}
            aria-label="Switch camera"
          >
            <RefreshCw className="size-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
