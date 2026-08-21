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
import {
  Field,
  FormGrid,
  PasswordField,
  SubmitButton,
  fieldErrors,
  useActionFeedback,
  useFormValues,
} from '@/components/shared/form';
import {
  offboardResidentAction,
  onboardResidentAction,
  updateResidentAction,
} from '@/actions/society-actions';
import { idleState } from '@/lib/action-result';
import { pluralize, toDateInputValue } from '@/lib/utils';

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

  const blankForm = React.useMemo(
    () => ({
      fullName: '',
      email: '',
      phone: '',
      alternatePhone: '',
      flatId: '',
      residentType: 'OWNER',
      moveInDate: toDateInputValue(new Date()),
      occupation: '',
      password: '',
      isPrimary: true,
    }),
    [],
  );
  const formInitial = resident
    ? {
        fullName: resident.fullName,
        email: resident.email,
        phone: resident.phone,
        alternatePhone: resident.alternatePhone ?? '',
        flatId: resident.flatId,
        residentType: resident.residentType,
        moveInDate: resident.moveInDate,
        occupation: resident.occupation ?? '',
        password: '',
        isPrimary: resident.isPrimary,
      }
    : blankForm;
  // Preserves what was typed across a failed submission (React otherwise
  // resets every uncontrolled field once the action call resolves, error or
  // not), and clears a field's error the moment it's edited.
  const form = useFormValues(state, formInitial);

  return (
    <div className="flex items-center justify-end gap-1">
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setTempPassword(null);
          else form.reset(formInitial);
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
                  errors={form.errors('fullName')}
                >
                  <Input
                    id="fullName"
                    name="fullName"
                    required
                    maxLength={80}
                    value={form.values.fullName}
                    onChange={(e) => form.set('fullName', e.target.value)}
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
                    hint="Used as the login identifier"
                    errors={form.errors('email')}
                  >
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={form.values.email}
                      onChange={(e) => form.set('email', e.target.value)}
                    />
                  </Field>
                )}
              </FormGrid>

              <FormGrid>
                <Field
                  label="Mobile number"
                  htmlFor="phone"
                  required
                  errors={form.errors('phone')}
                >
                  <Input
                    id="phone"
                    name="phone"
                    inputMode="numeric"
                    required
                    maxLength={11}
                    value={form.values.phone}
                    onChange={(e) => form.set('phone', e.target.value)}
                  />
                </Field>

                <Field
                  label="Alternate number"
                  htmlFor="alternatePhone"
                  errors={form.errors('alternatePhone')}
                >
                  <Input
                    id="alternatePhone"
                    name="alternatePhone"
                    inputMode="numeric"
                    maxLength={11}
                    value={form.values.alternatePhone}
                    onChange={(e) => form.set('alternatePhone', e.target.value)}
                  />
                </Field>
              </FormGrid>

              <FormGrid>
                <Field label="Flat" htmlFor="flatId" required errors={form.errors('flatId')}>
                  <Select
                    name="flatId"
                    value={form.values.flatId}
                    onValueChange={(value) => value && form.set('flatId', value)}
                  >
                    <SelectTrigger id="flatId">
                      <SelectValue placeholder="Select a flat" />
                    </SelectTrigger>
                    <SelectContent>
                      {flats.map((flat) => (
                        <SelectItem key={flat.id} value={flat.id}>
                          {flat.label}
                          {flat.residentCount > 0 ? ` · ${pluralize(flat.residentCount, 'resident')}` : ' · vacant'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field
                  label="Resident type"
                  htmlFor="residentType"
                  required
                  errors={form.errors('residentType')}
                >
                  <Select
                    name="residentType"
                    value={form.values.residentType}
                    onValueChange={(value) => value && form.set('residentType', value)}
                  >
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
                  errors={form.errors('moveInDate')}
                >
                  <Input
                    id="moveInDate"
                    name="moveInDate"
                    type="date"
                    required
                    value={form.values.moveInDate}
                    onChange={(e) => form.set('moveInDate', e.target.value)}
                  />
                </Field>

                <Field label="Occupation" htmlFor="occupation" errors={form.errors('occupation')}>
                  <Input
                    id="occupation"
                    name="occupation"
                    maxLength={80}
                    value={form.values.occupation}
                    onChange={(e) => form.set('occupation', e.target.value)}
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
                  errors={form.errors('password')}
                >
                  <PasswordField
                    id="password"
                    name="password"
                    minLength={8}
                    autoComplete="off"
                    value={form.values.password}
                    onChange={(e) => form.set('password', e.target.value)}
                  />
                </Field>
              )}

              <div className="flex items-center gap-2">
                <Checkbox
                  id="isPrimary"
                  name="isPrimary"
                  value="true"
                  checked={form.values.isPrimary}
                  onCheckedChange={(checked) => form.set('isPrimary', checked === true)}
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
