'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Banknote,
  CreditCard,
  Landmark,
  Smartphone,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Field, SubmitButton, fieldErrors, useActionFeedback } from '@/components/shared/form';
import { simulatePaymentAction } from '@/actions/billing-actions';
import { idleState } from '@/lib/action-result';
import { cn, formatCurrency } from '@/lib/utils';

const METHODS: { value: string; label: string; icon: LucideIcon; hint: string }[] = [
  { value: 'UPI', label: 'UPI', icon: Smartphone, hint: 'GPay, PhonePe, Paytm' },
  { value: 'CARD', label: 'Card', icon: CreditCard, hint: 'Debit or credit' },
  { value: 'NETBANKING', label: 'Net banking', icon: Landmark, hint: 'Any Indian bank' },
  { value: 'WALLET', label: 'Wallet', icon: Wallet, hint: 'Prepaid balance' },
  { value: 'CASH', label: 'Cash', icon: Banknote, hint: 'At the society office' },
];

/**
 * Simulated payment.
 *
 * The SRS scopes real gateway integration and bank reconciliation out (§1.4),
 * so this is labelled clearly as a simulation rather than pretending to charge
 * a card.
 */
export function PaymentPanel({
  billId,
  outstanding,
  billNumber,
}: {
  billId: string;
  outstanding: number;
  billNumber: string;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(simulatePaymentAction, idleState);
  const [method, setMethod] = React.useState('UPI');
  const [partial, setPartial] = React.useState(false);

  useActionFeedback(state, { onSuccess: () => router.refresh() });

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle>Pay this invoice</CardTitle>
        <CardDescription>
          {formatCurrency(outstanding)} outstanding on {billNumber}.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="billId" value={billId} />
          <input type="hidden" name="method" value={method} />

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Payment method</legend>
            <div className="grid grid-cols-2 gap-2">
              {METHODS.map((option) => {
                const Icon = option.icon;
                const selected = method === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setMethod(option.value)}
                    aria-pressed={selected}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border p-2.5 text-left transition-colors',
                      selected
                        ? 'border-primary bg-primary-soft text-primary'
                        : 'border-border hover:bg-accent/60',
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span className="min-w-0">
                      <span className="block text-xs font-medium">{option.label}</span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {option.hint}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="flex items-center gap-2">
            <input
              id="partial"
              type="checkbox"
              checked={partial}
              onChange={(event) => setPartial(event.target.checked)}
              className="size-4 rounded border-input accent-[var(--primary)]"
            />
            <Label htmlFor="partial" className="font-normal">
              Pay a part of the amount
            </Label>
          </div>

          {partial ? (
            <Field
              label="Amount to pay"
              htmlFor="amount"
              hint={`Maximum ${formatCurrency(outstanding)}`}
              errors={fieldErrors(state, 'amount')}
            >
              <Input
                id="amount"
                name="amount"
                type="number"
                min={1}
                max={outstanding}
                step="0.01"
                defaultValue={Math.round(outstanding / 2)}
                required
              />
            </Field>
          ) : (
            <input type="hidden" name="amount" value="" />
          )}

          <Alert variant="info" hideIcon className="text-xs">
            Payment gateway processing and bank reconciliation are <strong>simulated</strong> in this build,
            as scoped by the requirements specification. A receipt with a transaction reference is generated
            exactly as it would be with a live gateway.
          </Alert>

          <SubmitButton size="lg" className="w-full">
            Pay {partial ? 'selected amount' : formatCurrency(outstanding)}
          </SubmitButton>
        </form>

        {state.status === 'success' && state.data?.receiptNumber ? (
          <div className="mt-4 rounded-lg border border-success/40 bg-success/10 p-3">
            <p className="text-sm font-medium">Payment successful</p>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">
              Receipt {state.data.receiptNumber}
            </p>
            <Button asChild variant="outline" size="sm" className="mt-2 w-full">
              <a href={`/api/bills/${billId}/receipt?payment=${state.data.paymentId}`} download>
                Download receipt
              </a>
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
