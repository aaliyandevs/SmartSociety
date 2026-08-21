'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, Building, Pencil, Plus } from 'lucide-react';
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
import { ConfirmAction } from '@/components/shared/confirm-action';
import { Field, FormGrid, SubmitButton, fieldErrors, useActionFeedback } from '@/components/shared/form';
import { archiveFlatAction, createBlockAction, saveFlatAction } from '@/actions/society-actions';
import { idleState } from '@/lib/action-result';
import { humanise, pluralize } from '@/lib/utils';

export interface BlockOption {
  id: string;
  name: string;
  totalFloors: number;
}

export interface FlatFormValues {
  id: string;
  blockId: string;
  flatNumber: string;
  floor: number;
  flatType: string;
  carpetAreaSqft: number | null;
  occupancyStatus: string;
  parkingSlots: number;
  baseMaintenance: number;
  residentCount: number;
}

const FLAT_TYPES = ['STUDIO', 'ONE_BHK', 'TWO_BHK', 'THREE_BHK', 'FOUR_BHK', 'PENTHOUSE'];
const OCCUPANCY = ['OCCUPIED', 'VACANT', 'UNDER_MAINTENANCE'];

/**
 * Renders either the "add unit" toolbar (with a block creator) or the per-row
 * edit/archive controls, depending on whether a `flat` is supplied.
 */
export function FlatManager({ blocks, flat }: { blocks: BlockOption[]; flat?: FlatFormValues }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [blockOpen, setBlockOpen] = React.useState(false);
  const [state, formAction] = useActionState(saveFlatAction, idleState);
  const [blockState, blockAction] = useActionState(createBlockAction, idleState);

  useActionFeedback(state, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });
  useActionFeedback(blockState, {
    onSuccess: () => {
      setBlockOpen(false);
      router.refresh();
    },
  });

  async function archive() {
    if (!flat) return;
    const result = await archiveFlatAction(flat.id);
    if (result.status === 'success') {
      toast.success(result.message);
      router.refresh();
    } else if (result.status === 'error') {
      toast.error(result.message);
    }
  }

  const dialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {flat ? (
          <Button variant="ghost" size="sm">
            <Pencil className="size-4" />
            Edit
          </Button>
        ) : (
          <Button>
            <Plus className="size-4" />
            Add unit
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{flat ? `Edit flat ${flat.flatNumber}` : 'Add a unit'}</DialogTitle>
          <DialogDescription>
            The base maintenance amount is used as the per-flat charge when bills are generated.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {flat ? <input type="hidden" name="flatId" value={flat.id} /> : null}

          {state.status === 'error' && !state.fieldErrors ? (
            <Alert variant="destructive">{state.message}</Alert>
          ) : null}

          <FormGrid>
            <Field label="Block" htmlFor="blockId" required errors={fieldErrors(state, 'blockId')}>
              <Select name="blockId" defaultValue={flat?.blockId ?? blocks[0]?.id} disabled={Boolean(flat)}>
                <SelectTrigger id="blockId">
                  <SelectValue placeholder="Select a block" />
                </SelectTrigger>
                <SelectContent>
                  {blocks.map((block) => (
                    <SelectItem key={block.id} value={block.id}>
                      Block {block.name} ({block.totalFloors} floors)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {flat ? (
                <input type="hidden" name="blockId" value={flat.blockId} />
              ) : null}
            </Field>

            <Field
              label="Flat number"
              htmlFor="flatNumber"
              required
              errors={fieldErrors(state, 'flatNumber')}
            >
              <Input
                id="flatNumber"
                name="flatNumber"
                required
                maxLength={12}
                className="uppercase"
                placeholder="101"
                defaultValue={flat?.flatNumber}
              />
            </Field>
          </FormGrid>

          <FormGrid>
            <Field label="Floor" htmlFor="floor" required errors={fieldErrors(state, 'floor')}>
              <Input
                id="floor"
                name="floor"
                type="number"
                min={0}
                max={80}
                required
                defaultValue={flat?.floor ?? 1}
              />
            </Field>

            <Field label="Unit type" htmlFor="flatType" required errors={fieldErrors(state, 'flatType')}>
              <Select name="flatType" defaultValue={flat?.flatType ?? 'TWO_BHK'}>
                <SelectTrigger id="flatType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FLAT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {humanise(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FormGrid>

          <FormGrid>
            <Field
              label="Carpet area (sq ft)"
              htmlFor="carpetAreaSqft"
              errors={fieldErrors(state, 'carpetAreaSqft')}
            >
              <Input
                id="carpetAreaSqft"
                name="carpetAreaSqft"
                type="number"
                min={100}
                max={20000}
                defaultValue={flat?.carpetAreaSqft ?? undefined}
              />
            </Field>

            <Field
              label="Parking slots"
              htmlFor="parkingSlots"
              required
              errors={fieldErrors(state, 'parkingSlots')}
            >
              <Input
                id="parkingSlots"
                name="parkingSlots"
                type="number"
                min={0}
                max={10}
                required
                defaultValue={flat?.parkingSlots ?? 1}
              />
            </Field>
          </FormGrid>

          <FormGrid>
            <Field
              label="Monthly maintenance"
              htmlFor="baseMaintenance"
              required
              hint="Base charge before common charges"
              errors={fieldErrors(state, 'baseMaintenance')}
            >
              <Input
                id="baseMaintenance"
                name="baseMaintenance"
                type="number"
                min={0}
                step="0.01"
                required
                defaultValue={flat?.baseMaintenance ?? 3000}
              />
            </Field>

            <Field
              label="Occupancy status"
              htmlFor="occupancyStatus"
              required
              errors={fieldErrors(state, 'occupancyStatus')}
            >
              <Select name="occupancyStatus" defaultValue={flat?.occupancyStatus ?? 'VACANT'}>
                <SelectTrigger id="occupancyStatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OCCUPANCY.map((status) => (
                    <SelectItem key={status} value={status}>
                      {humanise(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FormGrid>

          {flat && flat.residentCount > 0 ? (
            <Alert variant="info">
              This unit has {pluralize(flat.residentCount, 'resident')} on record. Offboard them from the Residents
              page before marking it vacant.
            </Alert>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton>{flat ? 'Save changes' : 'Create unit'}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  if (flat) {
    return (
      <div className="flex items-center justify-end gap-1">
        {dialog}
        <ConfirmAction
          title={`Archive flat ${flat.flatNumber}?`}
          description="The unit is hidden from lists but its billing and gate history is preserved. It must have no residents and no unsettled invoices."
          confirmLabel="Archive unit"
          onConfirm={archive}
          trigger={
            <Button variant="ghost" size="icon-sm" aria-label={`Archive flat ${flat.flatNumber}`}>
              <Archive className="size-4 text-destructive" />
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <Building className="size-4" />
            Add block
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a block or tower</DialogTitle>
            <DialogDescription>Blocks group the flats and appear in every filter.</DialogDescription>
          </DialogHeader>

          <form action={blockAction} className="space-y-4">
            {blockState.status === 'error' && !blockState.fieldErrors ? (
              <Alert variant="destructive">{blockState.message}</Alert>
            ) : null}

            <Field
              label="Block name"
              htmlFor="blockName"
              required
              hint="Short identifier, e.g. “A” or “Tower 3”"
              errors={fieldErrors(blockState, 'name')}
            >
              <Input id="blockName" name="name" required maxLength={30} />
            </Field>

            <Field label="Display label" htmlFor="blockLabel" errors={fieldErrors(blockState, 'label')}>
              <Input id="blockLabel" name="label" maxLength={80} placeholder="Tower A — Garden View" />
            </Field>

            <Field
              label="Number of floors"
              htmlFor="totalFloors"
              required
              errors={fieldErrors(blockState, 'totalFloors')}
            >
              <Input
                id="totalFloors"
                name="totalFloors"
                type="number"
                min={1}
                max={80}
                required
                defaultValue={6}
              />
            </Field>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBlockOpen(false)}>
                Cancel
              </Button>
              <SubmitButton>Create block</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {dialog}
    </div>
  );
}
