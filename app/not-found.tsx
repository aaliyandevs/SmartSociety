import Link from 'next/link';
import { Compass, Home } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { BrandLogo } from '@/components/shared/brand';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border px-5 py-4">
        <BrandLogo />
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-16">
        <div className="w-full max-w-md text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <Compass className="size-7" aria-hidden />
          </span>
          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.14em] text-primary">Error 404</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">This page does not exist</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The link may be out of date, or the record you are looking for has been removed. Head back to
            your dashboard and try again from there.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild>
              <Link href="/">
                <Home className="size-4" />
                Go to home page
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
