import type { Metadata } from 'next';
import Link from 'next/link';
import { Lock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { BrandLogo } from '@/components/shared/brand';
import { getCurrentUser } from '@/lib/auth/session';
import { ROLE_HOME, ROLE_LABELS } from '@/lib/rbac';

export const metadata: Metadata = { title: 'Access denied' };

export default async function UnauthorizedPage() {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border px-5 py-4">
        <BrandLogo />
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-16">
        <div className="w-full max-w-md text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-warning/20 text-warning-foreground dark:text-warning">
            <Lock className="size-7" aria-hidden />
          </span>
          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.14em] text-primary">Error 403</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">You do not have access to this area</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {user
              ? `You are signed in as a ${ROLE_LABELS[user.role]}. This section is restricted to a different role.`
              : 'Sign in with an account that has permission to view this section.'}
          </p>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            {user ? (
              <Button asChild>
                <Link href={ROLE_HOME[user.role]}>Go to my dashboard</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/login">Sign in</Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
