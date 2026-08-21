import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, KeyRound, QrCode, ShieldCheck, Wrench } from 'lucide-react';

import { BrandLogo } from '@/components/shared/brand';
import { LoginForm } from '@/app/login/login-form';
import { publicEnv } from '@/lib/env';
import { getCurrentUser, homeForRole } from '@/lib/auth/session';

export const metadata: Metadata = {
  title: 'Login',
  description: 'Login to the SmartSociety housing society management system.',
};

const HIGHLIGHTS = [
  { icon: QrCode, label: 'QR gate passes verified in under two seconds' },
  { icon: ShieldCheck, label: 'Immutable audit trail on every gate and financial action' },
  { icon: Wrench, label: 'Helpdesk tickets routed to staff with SLA tracking' },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  // Belt-and-braces alongside the same check in middleware.ts: a signed-in
  // visitor should never see a bare sign-in form for the account they're
  // already in.
  const currentUser = await getCurrentUser();
  if (currentUser) redirect(homeForRole(currentUser.role));

  return (
    // `h-dvh` (not `min-h-dvh`) pins the grid row to exactly the viewport
    // height, so the teal panel and the form column are always the same
    // height as each other and as the viewport — a `min-h` here let the form
    // column's own content quietly grow the row taller than the screen,
    // which stretched the panel past the fold and left a strip of the plain
    // background peeking out below it.
    <div className="grid h-dvh lg:grid-cols-2">
      {/* Left — brand panel (hidden on small screens to keep the form above the fold) */}
      <section className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-10">
        <div className="surface-grid absolute inset-0 opacity-20" aria-hidden />
        <div className="relative">
          <BrandLogo href="/" className="text-primary-foreground [&_span]:text-primary-foreground" />
        </div>

        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Every gate, bill and ticket in one place.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-primary-foreground/80">
            SmartSociety replaces paper gate registers, WhatsApp complaint threads and manual maintenance
            collection with a single, auditable system for {publicEnv.societyName}.
          </p>

          <ul className="mt-8 space-y-4">
            {HIGHLIGHTS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-start gap-3 text-sm text-primary-foreground/90">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <Icon className="size-4" aria-hidden />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-primary-foreground/70">
          Smart Society Management System · Full-Stack Application Development
        </p>
      </section>

      {/* Right — login form. Scrolls internally on its own if the viewport
          is too short for its content, rather than growing the whole page. */}
      <section className="flex flex-col overflow-y-auto px-5 py-8 sm:px-8">
        <div className="flex items-center justify-between lg:hidden">
          <BrandLogo href="/" />
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Home
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <KeyRound className="size-5" aria-hidden />
              </span>
              <h1 className="text-2xl font-semibold tracking-tight">Login to SmartSociety</h1>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Use the email address or username registered with the society office.
            </p>

            <LoginForm next={next} />
          </div>
        </div>

        <p className="hidden text-center text-xs text-muted-foreground lg:block">
          Trouble logging in? Contact the society office at{' '}
          <span className="font-medium text-foreground">office@smartsociety.local</span>
        </p>
      </section>
    </div>
  );
}
