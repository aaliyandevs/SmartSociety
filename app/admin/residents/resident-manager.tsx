'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, LogOut, Pencil, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

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
import {
  offboardResidentAction,
  onboardResidentAction,
  updateResidentAction,
} from '@/actions/society-actions';
import { idleState } from '@/lib/action-result';
import { toDateInputValue } from '@/lib/utils';

export interface FlatChoice {
  id: string;
  label: string;
  occupancyStatus: string;
  residentCount: number;
}

export interface ResidentFormValues {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  flatId: string;
  flatLabel: string;
  residentType: string;
  isPrimary: boolean;
  moveInDate: string;
  occupation: string | null;
  alternatePhone: string | null;
  status: string;
}

export function ResidentManager({
  flats,
  resident,
}: {
  flats: FlatChoice[];
  resident?: ResidentFormValues;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [offboardOpen, setOffboardOpen] = React.useState(false);
  const [tempPassword, setTempPassword] = React.useState<string | null>(null);

  const [createState, createAction] = useActionState(onboardResidentAction, idleState);
  const [updateState, updateAction] = useActionState(updateResidentAction, idleState);
  const [offboardState, offboardAction] = useActionState(offboardResidentAction, idleState);

  useActionFeedback(createState, {
    onSuccess: (data) => {
      // The temporary password is shown once and never stored in plain text.
      if (data?.temporaryPassword) setTempPassword(data.temporaryPassword);
      else setOpen(false);
      router.refresh();
    },
  });
  useActionFeedback(updateState, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });
  useActionFeedback(offboardState, {
    onSuccess: () => {
      setOffboardOpen(false);
      router.refresh();
    },
  });

  const state = resident ? updateState : createState;
  const action = resident ? updateAction : createAction;

  return (
    <div className="flex items-center justify-end gap-1">
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setTempPassword(null);
        }}
      >
        <DialogTrigger asChild>
          {resident ? (
            <Button variant="ghost" size="sm">
              <Pencil className="size-4" />
              Edit
            </Button>
          ) : (
            <Button>
              <UserPlus className="size-4" />
              Onboard resident
            </Button>
          )}
        </DialogTrigger>

        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{resident ? `Edit ${resident.fullName}` : 'Onboard a resident'}</DialogTitle>
            <DialogDescription>
              {resident
                ? 'Update the resident record. Changing the flat moves them and re-evaluates occupancy.'
                : 'Creates a login and links the person to a flat. Leave the password blank to generate a temporary one.'}
            </DialogDescription>
          </DialogHeader>

          {tempPassword ? (
            <div className="space-y-4">
              <Alert variant="success" title="Resident onboarded">
                Share these credentials once — the password is hashed and cannot be shown again.
              </Alert>
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Temporary password
                </p>
                <p className="mt-1 font-mono text-lg font-semibold">{tempPassword}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={async () => {
                    await navigator.clipboard.writeText(tempPassword);
                    toast.success('Password copied.');
                  }}
                >
                  <Copy className="size-4" />
                  Copy password
                </Button>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => {
                    setTempPassword(null);
                    setOpen(false);
                  }}
                >
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form action={action} className="space-y-4">
              {resident ? <input type="hidden" name="residentId" value={resident.id} /> : null}

              {state.status === 'error' && !state.fieldErrors ? (
                <Alert variant="destructive">{state.message}</Alert>
              ) : null}

              <FormGrid>
                <Field
                  label="Full name"
                  htmlFor="fullName"
                  required
                  errors={fieldErrors(state, 'fullName')}
                >
                  <Input
                    id="fullName"
                    name="fullName"
                    required
                    maxLength={80}
                    defaultValue={resident?.fullName}
                  />
                </Field>

                {resident ? (
                  <Field label="Email address" htmlFor="emailDisplay">
                    <Input id="emailDisplay" value={resident.email} disabled readOnly />
                  </Field>
                ) : (
                  <Field
                    label="Email address"
                    htmlFor="email"
                    required
                    hint="Used as the sign-in identifier"
                    errors={fieldErrors(state, 'email')}
                  >
                    <Input id="email" name="email" type="email" required />
                  </Field>
                )}
              </FormGrid>

              <FormGrid>
                <Field
                  label="Mobile number"
                  htmlFor="phone"
                  required
                  errors={fieldErrors(state, 'phone')}
                >
                  <Input
                    id="phone"
                    name="phone"
                    inputMode="numeric"
                    required
                    maxLength={10}
                    defaultValue={resident?.phone}
                  />
                </Field>

                <Field
                  label="Alternate number"
                  htmlFor="alternatePhone"
                  errors={fieldErrors(state, 'alternatePhone')}
                >
                  <Input
                    id="alternatePhone"
                    name="alternatePhone"
                    inputMode="numeric"
                    maxLength={10}
                    defaultValue={resident?.alternatePhone ?? ''}
                  />
                </Field>
              </FormGrid>

              <FormGrid>
                <Field label="Flat" htmlFor="flatId" required errors={fieldErrors(state, 'flatId')}>
                  <Select name="flatId" defaultValue={resident?.flatId ?? ''}>
                    <SelectTrigger id="flatId">
                      <SelectValue placeholder="Select a flat" />
                    </SelectTrigger>
                    <SelectContent>
                      {flats.map((flat) => (
                        <SelectItem key={flat.id} value={flat.id}>
                          {flat.label}
                          {flat.residentCount > 0 ? ` · ${flat.residentCount} resident(s)` : ' · vacant'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field
                  label="Resident type"
                  htmlFor="residentType"
                  required
                  errors={fieldErrors(state, 'residentType')}
                >
                  <Select name="residentType" defaultValue={resident?.residentType ?? 'OWNER'}>
                    <SelectTrigger id="residentType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OWNER">Owner</SelectItem>
                      <SelectItem value="TENANT">Tenant</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </FormGrid>

              <FormGrid>
                <Field
                  label="Move-in date"
                  htmlFor="moveInDate"
                  required
                  errors={fieldErrors(state, 'moveInDate')}
                >
                  <Input
                    id="moveInDate"
                    name="moveInDate"
                    type="date"
                    required
                    defaultValue={resident?.moveInDate ?? toDateInputValue(new Date())}
                  />
                </Field>

                <Field label="Occupation" htmlFor="occupation" errors={fieldErrors(state, 'occupation')}>
                  <Input
                    id="occupation"
                    name="occupation"
                    maxLength={80}
                    defaultValue={resident?.occupation ?? ''}
                  />
                </Field>
              </FormGrid>

              {resident ? (
                <Field label="Account status" htmlFor="status" required>
                  <Select name="status" defaultValue={resident.status}>
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                      <SelectItem value="SUSPENDED">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              ) : (
                <Field
                  label="Password"
                  htmlFor="password"
                  hint="Leave blank to generate a temporary password"
                  errors={fieldErrors(state, 'password')}
                >
                  <Input id="password" name="password" type="text" minLength={8} autoComplete="off" />
                </Field>
              )}

              <div className="flex items-center gap-2">
                <Checkbox
                  id="isPrimary"
                  name="isPrimary"
                  value="true"
                  defaultChecked={resident?.isPrimary ?? true}
                />
                <Label htmlFor="isPrimary" className="font-normal">
                  Primary contact for this flat (receives billing notifications)
                </Label>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <SubmitButton>{resident ? 'Save changes' : 'Onboard resident'}</SubmitButton>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {resident ? (
        <Dialog open={offboardOpen} onOpenChange={setOffboardOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Offboard ${resident.fullName}`}>
              <LogOut className="size-4 text-destructive" />
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Offboard {resident.fullName}</DialogTitle>
              <DialogDescription>
                Their login is deactivated, active gate passes are cancelled, and flat{' '}
                {resident.flatLabel} is re-evaluated. Billing history is preserved.
              </DialogDescription>
            </DialogHeader>

            <form action={offboardAction} className="space-y-4">
              <input type="hidden" name="residentId" value={resident.id} />

              {offboardState.status === 'error' ? (
                <Alert variant="destructive">{offboardState.message}</Alert>
              ) : null}

              <Field
                label="Move-out date"
                htmlFor="moveOutDate"
                required
                errors={fieldErrors(offboardState, 'moveOutDate')}
              >
                <Input
                  id="moveOutDate"
                  name="moveOutDate"
                  type="date"
                  required
                  defaultValue={toDateInputValue(new Date())}
                />
              </Field>

              <Field label="Reason" htmlFor="reason" errors={fieldErrors(offboardState, 'reason')}>
                <Textarea
                  id="reason"
                  name="reason"
                  rows={3}
                  maxLength={300}
                  placeholder="Lease ended; flat handed back to the owner."
                />
              </Field>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOffboardOpen(false)}>
                  Cancel
                </Button>
                <SubmitButton variant="destructive">Offboard resident</SubmitButton>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
