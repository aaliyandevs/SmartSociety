import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { BrandLogo } from '@/components/shared/brand';
import { SitemapView } from '@/components/marketing/sitemap-view';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { Button } from '@/components/ui/button';
import { SITEMAP, SITEMAP_PAGE_COUNT } from '@/lib/sitemap';

export const metadata: Metadata = {
  title: 'Sitemap',
  description:
    'Complete map of every screen in SmartSociety, grouped by the role that can reach it.',
};

export default function SitemapPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="glass-panel sticky top-0 z-40 border-b border-border">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <BrandLogo />
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Button asChild variant="outline">
              <Link href="/">
                <ArrowLeft className="size-4" />
                Home
              </Link>
            </Button>
            <Button asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Navigation</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Application sitemap</h1>
          <p className="mt-3 text-muted-foreground">
            {SITEMAP_PAGE_COUNT} screens across {SITEMAP.length} areas. Links open the real page — sign in
            first, or the app will redirect you to the sign-in screen.
          </p>
        </div>

        <SitemapView className="mt-8" />
      </main>

      <footer className="border-t border-border py-6">
        <div className="mx-auto w-full max-w-7xl px-4 text-xs text-muted-foreground sm:px-6 lg:px-8">
          SmartSociety · Smart Society Management System
        </div>
      </footer>
    </div>
  );
}
