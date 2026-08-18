'use client';

import * as React from 'react';
import Link from 'next/link';
import { RefreshCcw, ServerCrash } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * Global error boundary. Production users see a friendly message; the raw error
 * text is only rendered in development (SRS §25 — no stack traces for users).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[app] Unhandled error boundary:', error);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-16">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
          <ServerCrash className="size-7" aria-hidden />
        </span>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We hit an unexpected problem while loading this page. Your data is safe — please try again.
        </p>

        {process.env.NODE_ENV === 'development' ? (
          <pre className="mt-4 max-h-40 overflow-auto rounded-lg border border-border bg-muted p-3 text-left text-xs">
            {error.message}
          </pre>
        ) : null}

        {error.digest ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Reference code: <span className="font-mono">{error.digest}</span>
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={reset}>
            <RefreshCcw className="size-4" />
            Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
