'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Camera,
  CameraOff,
  CheckCircle2,
  Delete,
  Keyboard,
  Phone,
  ShieldX,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/shared/status-badge';
import { QrScanner } from '@/app/guard/verify/qr-scanner';
import {
  approveEntryAction,
  rejectEntryAction,
  verifyPassAction,
  type VerificationView,
} from '@/actions/gate-actions';
import { idleState } from '@/lib/action-result';
import { cn, formatDateTime, getPassDisplayStatus, humanise } from '@/lib/utils';

/**
 * Two-step gate clearance.
 *
 *   1. Resolve the code (scan or keypad) → the server decides GRANTED / DENIED
 *      and returns the visitor's details.
 *   2. The guard confirms entry, or refuses it with a reason.
 *
 * Step 1 never mutates anything, so an accidental scan cannot burn an entry.
 */

const DENIAL_REASONS: Record<string, string> = {
  NOT_FOUND: 'Code not recognised',
  EXPIRED: 'Pass expired',
  TOO_EARLY: 'Pass not valid yet',
  CANCELLED: 'Pass cancelled by the resident',
  REJECTED: 'Entry previously refused',
  ALREADY_USED: 'All entries used',
  ALREADY_INSIDE: 'Visitor already inside',
  INVALID: 'Invalid code',
};

export function VerifyConsole({ gates, defaultGate }: { gates: string[]; defaultGate: string }) {
  const router = useRouter();
  const [mode, setMode] = React.useState<'keypad' | 'scan'>('keypad');
  const [code, setCode] = React.useState('');
  const [gate, setGate] = React.useState(defaultGate);
  const [rejecting, setRejecting] = React.useState(false);

  const [verifyState, verifyAction] = useActionState(verifyPassAction, idleState);
  const [approveState, approveActionFn] = useActionState(approveEntryAction, idleState);
  const [rejectState, rejectActionFn] = useActionState(rejectEntryAction, idleState);

  const formRef = React.useRef<HTMLFormElement>(null);
  const result: VerificationView | undefined =
    verifyState.status === 'success' ? verifyState.data : undefined;

  // Surface the outcome of the confirm step and reset for the next visitor.
  React.useEffect(() => {
    if (approveState.status === 'success') {
      toast.success(approveState.message);
      setCode('');
      setRejecting(false);
      router.refresh();
    } else if (approveState.status === 'error') {
      toast.error(approveState.message);
    }
  }, [approveState, router]);

  React.useEffect(() => {
    if (rejectState.status === 'success') {
      toast.success(rejectState.message);
      setCode('');
      setRejecting(false);
      router.refresh();
    } else if (rejectState.status === 'error') {
      toast.error(rejectState.message);
    }
  }, [rejectState, router]);

  /** A successful scan submits immediately — no extra tap for the guard. */
  const onScan = React.useCallback((value: string) => {
    setCode(value);
    // Let React commit the value before the form reads it.
    requestAnimationFrame(() => formRef.current?.requestSubmit());
  }, []);

  function pressKey(digit: string) {
    setCode((current) => (current.length >= 12 ? current : current + digit));
  }

  const cleared = approveState.status === 'success' || rejectState.status === 'success';

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* ── Input ── */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Enter the pass</CardTitle>
              <CardDescription>Scan the QR code or type the gate code.</CardDescription>
            </div>
            <div className="flex rounded-lg bg-muted p-1">
              <button
                type="button"
                onClick={() => setMode('keypad')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                  mode === 'keypad' ? 'bg-card shadow-sm' : 'text-muted-foreground',
                )}
              >
                <Keyboard className="size-3.5" />
                Keypad
              </button>
              <button
                type="button"
                onClick={() => setMode('scan')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                  mode === 'scan' ? 'bg-card shadow-sm' : 'text-muted-foreground',
                )}
              >
                <Camera className="size-3.5" />
                Scan
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <form ref={formRef} action={verifyAction} className="space-y-4">
            <input type="hidden" name="method" value={mode === 'scan' ? 'QR_SCAN' : 'GATE_CODE'} />

            <div className="space-y-1.5">
              <Label htmlFor="code">Gate code or scanned pass</Label>
              <Input
                id="code"
                name="code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="123456"
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                className="tabular h-14 text-center font-mono text-2xl tracking-[0.3em]"
              />
            </div>

            {mode === 'scan' ? (
              <QrScanner onResult={onScan} />
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <Button
                    key={digit}
                    type="button"
                    variant="outline"
                    size="xl"
                    onClick={() => pressKey(digit)}
                    className="font-mono text-xl"
                  >
                    {digit}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="xl"
                  onClick={() => setCode('')}
                  className="text-sm"
                >
                  Clear
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="xl"
                  onClick={() => pressKey('0')}
                  className="font-mono text-xl"
                >
                  0
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xl"
                  onClick={() => setCode((c) => c.slice(0, -1))}
                  aria-label="Backspace"
                >
                  <Delete className="size-5" />
                </Button>
              </div>
            )}

            <Button type="submit" size="xl" className="w-full" disabled={code.trim().length < 4}>
              Verify pass
            </Button>
          </form>

          <div className="space-y-1.5 border-t border-border pt-4">
            <Label htmlFor="gate">Gate</Label>
            <Select value={gate} onValueChange={setGate}>
              <SelectTrigger id="gate">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {gates.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ── Result ── */}
      <div className="lg:col-span-3">
        {cleared ? (
          <Card className="border-success/40">
            <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
              <span className="flex size-16 items-center justify-center rounded-full bg-success/15 text-success">
                <CheckCircle2 className="size-8" aria-hidden />
              </span>
              <div>
                <p className="text-lg font-semibold">Recorded</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {approveState.status === 'success' ? approveState.message : (rejectState.status === 'success' ? rejectState.message : '')}
                </p>
              </div>
              <Button size="lg" onClick={() => window.location.reload()}>
                Verify the next visitor
              </Button>
            </CardContent>
          </Card>
        ) : !result ? (
          <Card className="h-full">
            <CardContent className="flex h-full flex-col items-center justify-center gap-3 py-20 text-center">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <CameraOff className="size-6" aria-hidden />
              </span>
              <p className="font-medium">Waiting for a pass</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Scan the visitor&apos;s QR code or type their 6-digit gate code, then press{' '}
                <span className="font-medium text-foreground">Verify pass</span>.
              </p>
            </CardContent>
          </Card>
        ) : result.outcome === 'DENIED' ? (
          <Card className="border-destructive/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
                  <ShieldX className="size-5" aria-hidden />
                </span>
                <div>
                  <CardTitle className="text-destructive">Do not admit</CardTitle>
                  <CardDescription>
                    {DENIAL_REASONS[result.reason ?? ''] ?? 'This pass cannot be accepted.'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">{result.detail}</Alert>

              {result.pass ? (
                <dl className="grid gap-x-6 gap-y-3 rounded-lg border border-border p-4 sm:grid-cols-2">
                  {[
                    ['Visitor', result.pass.visitor.name],
                    ['Phone', result.pass.visitor.phone],
                    ['Flat', result.pass.flat.label],
                    ['Host', result.pass.host.name],
                    ['Pass status', humanise(getPassDisplayStatus(result.pass))],
                    ['Window', `${formatDateTime(result.pass.validFrom)} — ${formatDateTime(result.pass.validUntil)}`],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
                      <dd className="mt-0.5 text-sm font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              <Alert variant="info">
                If the visitor is genuine, call the resident to confirm and then log them as a walk-in
                entry instead.
              </Alert>

              <div className="flex flex-wrap gap-2">
                {result.pass ? (
                  <Button asChild variant="outline">
                    <a href={`tel:${result.pass.host.phone}`}>
                      <Phone className="size-4" />
                      Call the resident
                    </a>
                  </Button>
                ) : null}
                <Button variant="outline" onClick={() => setCode('')}>
                  Try another code
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-success/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
                  <CheckCircle2 className="size-5" aria-hidden />
                </span>
                <div>
                  <CardTitle className="text-success">Pass is valid</CardTitle>
                  <CardDescription>Confirm the visitor and record the entry.</CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xl font-semibold">{result.pass!.visitor.name}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {humanise(result.pass!.visitorType)}
                      {result.pass!.visitor.company ? ` · ${result.pass!.visitor.company}` : ''} ·{' '}
                      {result.pass!.visitor.phone}
                    </p>
                  </div>
                  <StatusBadge status={getPassDisplayStatus(result.pass!)} />
                </div>

                <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  {[
                    ['Visiting flat', result.pass!.flat.label],
                    ['Host resident', `${result.pass!.host.name} · ${result.pass!.host.phone}`],
                    ['Vehicle', result.pass!.visitor.vehicleNumber ?? 'Not provided'],
                    ['Purpose', result.pass!.purpose ?? 'Not specified'],
                    ['Valid until', formatDateTime(result.pass!.validUntil)],
                    [
                      'Entries',
                      `${result.pass!.entriesUsed}/${result.pass!.maxEntries} used`,
                    ],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
                      <dd className="mt-0.5 text-sm font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Badge variant="soft" className="font-mono">
                    {result.pass!.passCode}
                  </Badge>
                  <Badge variant="outline">{gate}</Badge>
                </div>
              </div>

              {!rejecting ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <form action={approveActionFn} className="flex-1">
                    <input type="hidden" name="passId" value={result.pass!.id} />
                    <input type="hidden" name="gate" value={gate} />
                    <input type="hidden" name="method" value={mode === 'scan' ? 'QR_SCAN' : 'GATE_CODE'} />
                    <input
                      type="hidden"
                      name="vehicleNumber"
                      value={result.pass!.visitor.vehicleNumber ?? ''}
                    />
                    <Button type="submit" size="xl" variant="success" className="w-full">
                      <CheckCircle2 className="size-5" />
                      Allow entry
                    </Button>
                  </form>

                  <Button
                    type="button"
                    size="xl"
                    variant="outline"
                    className="sm:w-44"
                    onClick={() => setRejecting(true)}
                  >
                    <XCircle className="size-5" />
                    Refuse
                  </Button>
                </div>
              ) : (
                <form action={rejectActionFn} className="space-y-3 rounded-lg border border-destructive/40 p-4">
                  <input type="hidden" name="passId" value={result.pass!.id} />
                  <input type="hidden" name="gate" value={gate} />
                  <div className="space-y-1.5">
                    <Label htmlFor="reason">Why is entry being refused?</Label>
                    <Textarea
                      id="reason"
                      name="reason"
                      required
                      minLength={3}
                      rows={3}
                      placeholder="Visitor could not confirm the flat number; resident unreachable on intercom."
                    />
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="ghost" onClick={() => setRejecting(false)}>
                      Back
                    </Button>
                    <Button type="submit" variant="destructive">
                      Record refusal
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
