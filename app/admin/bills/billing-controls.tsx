'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Receipt, Trash2, TriangleAlert } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmAction } from '@/components/shared/confirm-action';
import { Field, FormGrid, SubmitButton, fieldErrors, useActionFeedback } from '@/components/shared/form';
import { applyPenaltiesAction, generateBillsAction } from '@/actions/billing-actions';
import { idleState } from '@/lib/action-result';
import { MONTH_NAMES, formatCurrency, humanise, toDateInputValue } from '@/lib/utils';

const CHARGE_TYPES = [
  'WATER',
  'SECURITY',
  'COMMON_ELECTRICITY',
  'REPAIRS',
  'SINKING_FUND',
  'PARKING',
  'OTHER',
];

interface ChargeRow {
  key: string;
  chargeType: string;
  label: string;
  amount: string;
}

/** The default common charges a society bills alongside the per-flat maintenance. */
const DEFAULT_CHARGES: ChargeRow[] = [
  { key: 'c1', chargeType: 'WATER', label: 'Water charges', amount: '420' },
  { key: 'c2', chargeType: 'SECURITY', label: 'Security services', amount: '850' },
  { key: 'c3', chargeType: 'COMMON_ELECTRICITY', label: 'Common area electricity', amount: '560' },
  { key: 'c4', chargeType: 'REPAIRS', label: 'Repairs & upkeep fund', amount: '300' },
  { key: 'c5', chargeType: 'SINKING_FUND', label: 'Sinking fund', amount: '250' },
];

export function BillingRunDialog({ blocks }: { blocks: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [charges, setCharges] = React.useState<ChargeRow[]>(DEFAULT_CHARGES);
  const [state, formAction] = useActionState(generateBillsAction, idleState);

  useActionFeedback(state, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });

  const now = new Date();
  const commonTotal = charges.reduce((sum, charge) => sum + (Number(charge.amount) || 0), 0);

  function updateCharge(key: string, patch: Partial<ChargeRow>) {
    setCharges((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Receipt className="size-4" />
          Generate bills
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Generate the monthly billing run</DialogTitle>
          <DialogDescription>
            One invoice is created for every occupied flat. Each flat&apos;s own maintenance charge is added
            automatically on top of the common charges below.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-5">
          {state.status === 'error' ? (
            <Alert variant="destructive" title="Could not generate the bills">
              {state.message}
            </Alert>
          ) : null}

          <FormGrid className="sm:grid-cols-3">
            <Field
              label="Month"
              htmlFor="periodMonth"
              required
              errors={fieldErrors(state, 'periodMonth')}
            >
              <Select name="periodMonth" defaultValue={String(now.getMonth() + 1)}>
                <SelectTrigger id="periodMonth">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((month, index) => (
                    <SelectItem key={month} value={String(index + 1)}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Year" htmlFor="periodYear" required errors={fieldErrors(state, 'periodYear')}>
              <Input
                id="periodYear"
                name="periodYear"
                type="number"
                min={2020}
                max={2100}
                required
                defaultValue={now.getFullYear()}
              />
            </Field>

            <Field label="Due date" htmlFor="dueDate" required errors={fieldErrors(state, 'dueDate')}>
              <Input
                id="dueDate"
                name="dueDate"
                type="date"
                required
                defaultValue={toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 15))}
              />
            </Field>
          </FormGrid>

          <Field
            label="Limit to a block"
            htmlFor="blockId"
            hint="Leave blank to bill every occupied flat"
          >
            <Select name="blockId" defaultValue="">
              <SelectTrigger id="blockId">
                <SelectValue placeholder="All blocks" />
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

          {/* ── Common charge lines ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Common charges (applied to every flat)</Label>
              <span className="tabular text-sm font-medium">{formatCurrency(commonTotal)}</span>
            </div>

            <div className="space-y-2 rounded-lg border border-border p-3">
              {charges.map((charge) => (
                <div key={charge.key} className="grid grid-cols-12 gap-2">
                  <div className="col-span-4">
                    <Select
                      name="chargeType"
                      value={charge.chargeType}
                      onValueChange={(value) => updateCharge(charge.key, { chargeType: value })}
                    >
                      <SelectTrigger size="sm" aria-label="Charge type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CHARGE_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {humanise(type)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Input
                    className="col-span-5 h-8 text-xs"
                    name="chargeLabel"
                    value={charge.label}
                    onChange={(event) => updateCharge(charge.key, { label: event.target.value })}
                    placeholder="Description"
                    aria-label="Charge description"
                  />

                  <Input
                    className="col-span-2 h-8 text-xs"
                    name="chargeAmount"
                    type="number"
                    min={0}
                    step="0.01"
                    value={charge.amount}
                    onChange={(event) => updateCharge(charge.key, { amount: event.target.value })}
                    aria-label="Charge amount"
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="col-span-1"
                    onClick={() => setCharges((rows) => rows.filter((row) => row.key !== charge.key))}
                    aria-label={`Remove ${charge.label}`}
                    disabled={charges.length <= 1}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setCharges((rows) => [
                    ...rows,
                    { key: `c${Date.now()}`, chargeType: 'OTHER', label: '', amount: '0' },
                  ])
                }
                disabled={charges.length >= 11}
              >
                <Plus className="size-4" />
                Add a charge line
              </Button>
            </div>

            {fieldErrors(state, 'charges') ? (
              <p className="text-xs font-medium text-destructive">{fieldErrors(state, 'charges')?.[0]}</p>
            ) : null}
          </div>

          <Field label="Note on every invoice" htmlFor="notes" errors={fieldErrors(state, 'notes')}>
            <Textarea
              id="notes"
              name="notes"
              rows={2}
              maxLength={300}
              placeholder="Includes the revised security charge approved in the last general body meeting."
            />
          </Field>

          <Alert variant="info">
            Flats that already have an invoice for this period are skipped, so re-running the cycle is
            safe.
          </Alert>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton>Generate invoices</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ApplyPenaltiesButton() {
  const router = useRouter();

  async function apply() {
    const formData = new FormData();
    formData.set('billId', '');
    const result = await applyPenaltiesAction({ status: 'idle' }, formData);

    if (result.status === 'success') {
      toast.success(result.message);
      router.refresh();
    } else if (result.status === 'error') {
      toast.error(result.message);
    }
  }

  return (
    <ConfirmAction
      variant="default"
      title="Apply late-payment penalties?"
      description="Every invoice past its due date plus the grace period, and not already penalised, gets the society's penalty added. This is recorded in the audit log."
      confirmLabel="Apply penalties"
      onConfirm={apply}
      trigger={
        <Button variant="outline">
          <TriangleAlert className="size-4" />
          Apply penalties
        </Button>
      }
    />
  );
}
