'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Pencil, UserPlus } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Field, FormGrid, SubmitButton, fieldErrors, useActionFeedback } from '@/components/shared/form';
import { onboardStaffAction, updateStaffAction } from '@/actions/society-actions';
import { idleState } from '@/lib/action-result';
import { humanise } from '@/lib/utils';

export interface StaffFormValues {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  designation: string;
  shift: string | null;
  gateAssignment: string | null;
  skills: string[];
  status: string;
}

const DEPARTMENTS = [
  'PLUMBING',
  'ELECTRICAL',
  'ELEVATOR',
  'HOUSEKEEPING',
  'GARDENING',
  'SECURITY',
  'GENERAL',
];

export function StaffManager({ staff }: { staff?: StaffFormValues }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [tempPassword, setTempPassword] = React.useState<string | null>(null);
  const [role, setRole] = React.useState(staff?.role ?? 'MAINTENANCE_STAFF');

  const [createState, createAction] = useActionState(onboardStaffAction, idleState);
  const [updateState, updateAction] = useActionState(updateStaffAction, idleState);

  useActionFeedback(createState, {
    onSuccess: (data) => {
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

  const state = staff ? updateState : createState;
  const action = staff ? updateAction : createAction;
  const isGuard = role === 'GUARD';

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTempPassword(null);
      }}
    >
      <DialogTrigger asChild>
        {staff ? (
          <Button variant="ghost" size="sm">
            <Pencil className="size-4" />
            Edit
          </Button>
        ) : (
          <Button>
            <UserPlus className="size-4" />
            Add staff
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{staff ? `Edit ${staff.fullName}` : 'Add a staff member'}</DialogTitle>
          <DialogDescription>
            {staff
              ? 'Update the staff record. Setting the status to inactive signs them out immediately.'
              : 'Creates a login with the chosen role. Leave the password blank to generate a temporary one.'}
          </DialogDescription>
        </DialogHeader>

        {tempPassword ? (
          <div className="space-y-4">
            <Alert variant="success" title="Staff member added">
              Share these credentials once — the password is hashed and cannot be shown again.
            </Alert>
            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Temporary password</p>
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
            {staff ? <input type="hidden" name="staffId" value={staff.id} /> : null}

            {state.status === 'error' && !state.fieldErrors ? (
              <Alert variant="destructive">{state.message}</Alert>
            ) : null}

            <FormGrid>
              <Field label="Full name" htmlFor="fullName" required errors={fieldErrors(state, 'fullName')}>
                <Input
                  id="fullName"
                  name="fullName"
                  required
                  maxLength={80}
                  defaultValue={staff?.fullName}
                />
              </Field>

              {staff ? (
                <Field label="Email address" htmlFor="staffEmailDisplay">
                  <Input id="staffEmailDisplay" value={staff.email} disabled readOnly />
                </Field>
              ) : (
                <Field
                  label="Email address"
                  htmlFor="email"
                  required
                  errors={fieldErrors(state, 'email')}
                >
                  <Input id="email" name="email" type="email" required />
                </Field>
              )}
            </FormGrid>

            <FormGrid>
              <Field label="Mobile number" htmlFor="phone" required errors={fieldErrors(state, 'phone')}>
                <Input
                  id="phone"
                  name="phone"
                  inputMode="numeric"
                  required
                  maxLength={10}
                  defaultValue={staff?.phone}
                />
              </Field>

              {staff ? (
                <Field label="Role" htmlFor="roleDisplay">
                  <Input id="roleDisplay" value={humanise(staff.role)} disabled readOnly />
                </Field>
              ) : (
                <Field label="Role" htmlFor="role" required errors={fieldErrors(state, 'role')}>
                  <Select name="role" value={role} onValueChange={setRole}>
                    <SelectTrigger id="role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MAINTENANCE_STAFF">Maintenance staff</SelectItem>
                      <SelectItem value="GUARD">Security guard</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </FormGrid>

            <FormGrid>
              <Field
                label="Department"
                htmlFor="department"
                required
                errors={fieldErrors(state, 'department')}
              >
                <Select
                  name="department"
                  defaultValue={staff?.department ?? (isGuard ? 'SECURITY' : 'GENERAL')}
                >
                  <SelectTrigger id="department">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((department) => (
                      <SelectItem key={department} value={department}>
                        {humanise(department)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field
                label="Designation"
                htmlFor="designation"
                required
                errors={fieldErrors(state, 'designation')}
              >
                <Input
                  id="designation"
                  name="designation"
                  required
                  maxLength={60}
                  placeholder={isGuard ? 'Security Guard' : 'Senior Plumber'}
                  defaultValue={staff?.designation}
                />
              </Field>
            </FormGrid>

            <FormGrid>
              <Field label="Shift" htmlFor="shift" errors={fieldErrors(state, 'shift')}>
                <Input
                  id="shift"
                  name="shift"
                  maxLength={40}
                  placeholder="Morning (06:00 – 14:00)"
                  defaultValue={staff?.shift ?? ''}
                />
              </Field>

              <Field
                label="Gate posting"
                htmlFor="gateAssignment"
                hint="Applies to security guards"
                errors={fieldErrors(state, 'gateAssignment')}
              >
                <Input
                  id="gateAssignment"
                  name="gateAssignment"
                  maxLength={40}
                  placeholder="Main Gate"
                  defaultValue={staff?.gateAssignment ?? ''}
                />
              </Field>
            </FormGrid>

            <Field
              label="Skills"
              htmlFor="skills"
              hint="Comma-separated, e.g. “Leak repair, Pipe fitting”"
              errors={fieldErrors(state, 'skills')}
            >
              <Input
                id="skills"
                name="skills"
                maxLength={200}
                defaultValue={staff?.skills.join(', ') ?? ''}
              />
            </Field>

            {staff ? (
              <Field label="Account status" htmlFor="status" required>
                <Select name="status" defaultValue={staff.status}>
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
                htmlFor="staffPassword"
                hint="Leave blank to generate a temporary password"
                errors={fieldErrors(state, 'password')}
              >
                <Input id="staffPassword" name="password" type="text" minLength={8} autoComplete="off" />
              </Field>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <SubmitButton>{staff ? 'Save changes' : 'Add staff member'}</SubmitButton>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
