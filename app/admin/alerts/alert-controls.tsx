'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Siren } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert } from '@/components/ui/feedback';
import { Checkbox } from '@/components/ui/misc';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Field, FormGrid, SubmitButton, fieldErrors, useActionFeedback } from '@/components/shared/form';
import { broadcastAlertAction, resolveAlertAction } from '@/actions/community-actions';
import { idleState } from '@/lib/action-result';
import { cn, humanise } from '@/lib/utils';

const ALERT_TYPES = [
  { value: 'FIRE', label: 'Fire', severity: 'CRITICAL' },
  { value: 'SECURITY', label: 'Security threat', severity: 'CRITICAL' },
  { value: 'MEDICAL', label: 'Medical emergency', severity: 'CRITICAL' },
  { value: 'GAS_LEAK', label: 'Gas leak', severity: 'CRITICAL' },
  { value: 'NATURAL_DISASTER', label: 'Natural disaster', severity: 'CRITICAL' },
  { value: 'WATER_SHUTDOWN', label: 'Water shutdown', severity: 'WARNING' },
  { value: 'POWER_OUTAGE', label: 'Power outage', severity: 'WARNING' },
  { value: 'GENERAL', label: 'General announcement', severity: 'INFO' },
] as const;

/** Pre-written text so an administrator can broadcast in seconds under pressure. */
const TEMPLATES: Record<string, { title: string; message: string; instructions: string }> = {
  FIRE: {
    title: 'Fire emergency — evacuate immediately',
    message:
      'A fire has been reported in the society. The fire brigade has been called. Evacuate your flat now.',
    instructions:
      'Use the staircase, never the lift. Assemble on the central lawn. Do not re-enter until cleared.',
  },
  SECURITY: {
    title: 'Security alert — stay indoors',
    message: 'A security incident is being handled at the society. Please remain inside your flat.',
    instructions: 'Lock your doors. Do not admit anyone. Call the main gate if you see anything unusual.',
  },
  MEDICAL: {
    title: 'Medical emergency — keep access clear',
    message: 'An ambulance is on its way into the society. Please keep the driveway and lift lobby clear.',
    instructions: 'Move vehicles away from the tower entrance and hold the lift on the ground floor.',
  },
  GAS_LEAK: {
    title: 'Gas leak reported — do not use any flame',
    message: 'A gas leak has been reported. The supply is being shut off.',
    instructions:
      'Do not light a flame or operate electrical switches. Open your windows and move to open ground.',
  },
  WATER_SHUTDOWN: {
    title: 'Water supply shut down',
    message: 'The water supply is suspended while urgent repairs are carried out.',
    instructions: 'Store water for essential use. Tankers will be arranged if the outage extends.',
  },
  POWER_OUTAGE: {
    title: 'Power outage in progress',
    message: 'A power outage is affecting the society. Lifts are running on the DG backup.',
    instructions: 'Avoid using the lift if you can take the stairs. Keep a torch handy.',
  },
  NATURAL_DISASTER: {
    title: 'Severe weather warning',
    message: 'Severe weather is expected. Please take precautions.',
    instructions: 'Secure balcony items, close windows and avoid the terrace and open areas.',
  },
  GENERAL: {
    title: '',
    message: '',
    instructions: '',
  },
};

export function BroadcastDialog({ blocks }: { blocks: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [type, setType] = React.useState<string>('GENERAL');
  const [severity, setSeverity] = React.useState<string>('INFO');
  const [state, formAction] = useActionState(broadcastAlertAction, idleState);

  useActionFeedback(state, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });

  const template = TEMPLATES[type] ?? TEMPLATES.GENERAL;

  function chooseType(value: string) {
    setType(value);
    const preset = ALERT_TYPES.find((entry) => entry.value === value);
    if (preset) setSeverity(preset.severity);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <Siren className="size-4" />
          Broadcast alert
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Broadcast an emergency alert</DialogTitle>
          <DialogDescription>
            Everyone signed in sees a full-width banner immediately and receives an urgent notification.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="severity" value={severity} />

          {state.status === 'error' && !state.fieldErrors ? (
            <Alert variant="destructive">{state.message}</Alert>
          ) : null}

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              Alert type <span className="text-destructive">*</span>
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {ALERT_TYPES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => chooseType(option.value)}
                  aria-pressed={type === option.value}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                    type === option.value
                      ? 'border-primary bg-primary-soft text-primary'
                      : 'border-border hover:bg-accent/60',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>

          <Field label="Severity" htmlFor="severity" required>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger id="severity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['INFO', 'WARNING', 'CRITICAL'].map((value) => (
                  <SelectItem key={value} value={value}>
                    {humanise(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Headline" htmlFor="title" required errors={fieldErrors(state, 'title')}>
            <Input
              id="title"
              name="title"
              required
              maxLength={120}
              key={`title-${type}`}
              defaultValue={template.title}
              placeholder="Fire emergency — evacuate immediately"
            />
          </Field>

          <Field label="Message" htmlFor="message" required errors={fieldErrors(state, 'message')}>
            <Textarea
              id="message"
              name="message"
              required
              minLength={10}
              rows={3}
              key={`message-${type}`}
              defaultValue={template.message}
            />
          </Field>

          <Field
            label="What people should do"
            htmlFor="instructions"
            hint="Short, direct instructions shown under the message"
            errors={fieldErrors(state, 'instructions')}
          >
            <Textarea
              id="instructions"
              name="instructions"
              rows={2}
              maxLength={1000}
              key={`instructions-${type}`}
              defaultValue={template.instructions}
            />
          </Field>

          <FormGrid>
            <Field
              label="Limit to a block"
              htmlFor="targetBlockId"
              hint="Leave blank to alert the whole society"
            >
              <Select name="targetBlockId" defaultValue="">
                <SelectTrigger id="targetBlockId">
                  <SelectValue placeholder="Society-wide" />
                </SelectTrigger>
                <SelectContent>
                  {blocks.map((block) => (
                    <SelectItem key={block.id} value={block.id}>
                      Block {block.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="flex items-end pb-2">
              <div className="flex items-center gap-2">
                <Checkbox id="sirenEnabled" name="sirenEnabled" value="true" defaultChecked />
                <Label htmlFor="sirenEnabled" className="font-normal">
                  Offer an audible siren
                </Label>
              </div>
            </div>
          </FormGrid>

          <Alert variant="warning">
            Browsers block sound until someone interacts with the page, so the siren appears as a clearly
            labelled button on the banner rather than playing on its own.
          </Alert>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton variant="destructive">Broadcast now</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ResolveAlertButton({ alertId, title }: { alertId: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = useActionState(resolveAlertAction, idleState);

  useActionFeedback(state, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="success">
          <CheckCircle2 className="size-4" />
          Resolve alert
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolve this alert?</DialogTitle>
          <DialogDescription>
            “{title}” is marked resolved and the banner clears for everyone.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="alertId" value={alertId} />

          {state.status === 'error' ? <Alert variant="destructive">{state.message}</Alert> : null}

          <Field
            label="Closing note"
            htmlFor="resolutionNote"
            hint="Recorded in the alert history and the audit log"
          >
            <Textarea
              id="resolutionNote"
              name="resolutionNote"
              rows={3}
              maxLength={500}
              placeholder="Pump replaced and supply restored at 4:20 PM."
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton variant="success">Resolve alert</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
