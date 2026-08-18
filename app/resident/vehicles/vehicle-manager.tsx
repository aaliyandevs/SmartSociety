'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { Bike, Car, CarFront, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmAction } from '@/components/shared/confirm-action';
import { Field, FormGrid, SubmitButton, fieldErrors, useActionFeedback } from '@/components/shared/form';
import { deleteVehicleAction, saveVehicleAction } from '@/actions/profile-actions';
import { idleState } from '@/lib/action-result';
import { humanise } from '@/lib/utils';

export interface VehicleView {
  id: string;
  registrationNo: string;
  vehicleType: string;
  make: string | null;
  model: string | null;
  color: string | null;
  parkingSlot: string | null;
}

const TYPE_ICONS: Record<string, typeof Car> = {
  CAR: Car,
  BIKE: Bike,
  SCOOTER: Bike,
  BICYCLE: Bike,
  OTHER: CarFront,
};

export function VehicleManager({ vehicles }: { vehicles: VehicleView[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<VehicleView | null>(null);
  const [state, formAction] = useActionState(saveVehicleAction, idleState);

  useActionFeedback(state, {
    onSuccess: () => {
      setOpen(false);
      setEditing(null);
      router.refresh();
    },
  });

  async function remove(id: string) {
    const result = await deleteVehicleAction(id);
    if (result.status === 'success') {
      toast.success(result.message);
      router.refresh();
    } else if (result.status === 'error') {
      toast.error(result.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" />
              Register a vehicle
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit vehicle' : 'Register a vehicle'}</DialogTitle>
              <DialogDescription>
                The registration number must be unique across the society.
              </DialogDescription>
            </DialogHeader>

            <form action={formAction} className="space-y-4">
              {editing ? <input type="hidden" name="vehicleId" value={editing.id} /> : null}

              <FormGrid>
                <Field
                  label="Registration number"
                  htmlFor="registrationNo"
                  required
                  hint="e.g. MH12AB1234"
                  errors={fieldErrors(state, 'registrationNo')}
                >
                  <Input
                    id="registrationNo"
                    name="registrationNo"
                    required
                    maxLength={14}
                    className="uppercase"
                    defaultValue={editing?.registrationNo}
                  />
                </Field>

                <Field
                  label="Vehicle type"
                  htmlFor="vehicleType"
                  required
                  errors={fieldErrors(state, 'vehicleType')}
                >
                  <Select name="vehicleType" defaultValue={editing?.vehicleType ?? 'CAR'}>
                    <SelectTrigger id="vehicleType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['CAR', 'BIKE', 'SCOOTER', 'BICYCLE', 'OTHER'].map((type) => (
                        <SelectItem key={type} value={type}>
                          {humanise(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </FormGrid>

              <FormGrid>
                <Field label="Make" htmlFor="make" errors={fieldErrors(state, 'make')}>
                  <Input
                    id="make"
                    name="make"
                    maxLength={40}
                    placeholder="Maruti Suzuki"
                    defaultValue={editing?.make ?? ''}
                  />
                </Field>
                <Field label="Model" htmlFor="model" errors={fieldErrors(state, 'model')}>
                  <Input
                    id="model"
                    name="model"
                    maxLength={40}
                    placeholder="Swift"
                    defaultValue={editing?.model ?? ''}
                  />
                </Field>
              </FormGrid>

              <FormGrid>
                <Field label="Colour" htmlFor="color" errors={fieldErrors(state, 'color')}>
                  <Input
                    id="color"
                    name="color"
                    maxLength={24}
                    placeholder="White"
                    defaultValue={editing?.color ?? ''}
                  />
                </Field>
                <Field
                  label="Parking slot"
                  htmlFor="parkingSlot"
                  hint="As allotted by the society"
                  errors={fieldErrors(state, 'parkingSlot')}
                >
                  <Input
                    id="parkingSlot"
                    name="parkingSlot"
                    maxLength={16}
                    placeholder="A-P07"
                    defaultValue={editing?.parkingSlot ?? ''}
                  />
                </Field>
              </FormGrid>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <SubmitButton>{editing ? 'Save changes' : 'Register vehicle'}</SubmitButton>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {vehicles.length === 0 ? (
        <EmptyState
          icon={CarFront}
          title="No vehicles registered"
          description="Register your car or two-wheeler so the security desk can identify it."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {vehicles.map((vehicle) => {
            const Icon = TYPE_ICONS[vehicle.vehicleType] ?? CarFront;
            return (
              <Card key={vehicle.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditing(vehicle);
                          setOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <ConfirmAction
                        title={`Remove ${vehicle.registrationNo}?`}
                        description="The vehicle will no longer be listed in the society register. Past gate records are kept."
                        confirmLabel="Remove"
                        onConfirm={() => remove(vehicle.id)}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove ${vehicle.registrationNo}`}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <Badge variant="outline" className="font-mono text-sm">
                      {vehicle.registrationNo}
                    </Badge>
                    <p className="mt-2 text-sm font-medium">
                      {[vehicle.make, vehicle.model].filter(Boolean).join(' ') ||
                        humanise(vehicle.vehicleType)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[humanise(vehicle.vehicleType), vehicle.color].filter(Boolean).join(' · ')}
                      {vehicle.parkingSlot ? ` · slot ${vehicle.parkingSlot}` : ''}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
