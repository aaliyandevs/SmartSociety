'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import type { Role } from '@prisma/client';

import { BrandLogo } from '@/components/shared/brand';
import { SidebarNav } from '@/components/layout/sidebar-nav';

export function MobileNav({ role, subtitle }: { role: Role; subtitle?: string }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  // Close the drawer whenever the route changes.
  React.useEffect(() => setOpen(false), [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation menu">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="pr-12">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <BrandLogo href="/" subtitle={subtitle} />
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav role={role} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
