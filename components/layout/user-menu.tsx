'use client';

import Link from 'next/link';
import { LogOut } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/misc';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ACCOUNT_NAV } from '@/lib/navigation';
import { ROLE_LABELS } from '@/lib/rbac';
import { initials } from '@/lib/utils';
import { logoutAction } from '@/actions/auth-actions';
import type { Role } from '@prisma/client';

interface UserMenuProps {
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string | null;
  subtitle?: string | null;
}

export function UserMenu({ name, email, role, avatarUrl, subtitle }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-10 gap-2 px-1.5 sm:px-2" aria-label="Account menu">
          <Avatar className="size-7">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
            <AvatarFallback>{initials(name)}</AvatarFallback>
          </Avatar>
          <span className="hidden min-w-0 text-left sm:block">
            <span className="block max-w-32 truncate text-xs font-medium leading-tight">{name}</span>
            <span className="block text-[11px] leading-tight text-muted-foreground">
              {ROLE_LABELS[role]}
            </span>
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="normal-case tracking-normal">
          <span className="block truncate text-sm font-semibold text-foreground">{name}</span>
          <span className="block truncate text-xs font-normal text-muted-foreground">{email}</span>
          {subtitle ? (
            <span className="mt-1 block text-xs font-normal text-primary">{subtitle}</span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {ACCOUNT_NAV.map((item) => {
          const Icon = item.icon;
          return (
            <DropdownMenuItem key={item.href} asChild>
              <Link href={item.href}>
                <Icon className="size-4" />
                {item.label}
              </Link>
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />
        {/* Sign-out is a POST so it cannot be triggered by a stray link or prefetch. */}
        <form action={logoutAction}>
          <DropdownMenuItem
            variant="destructive"
            asChild
            onSelect={(event) => event.preventDefault()}
          >
            <button type="submit" className="w-full">
              <LogOut className="size-4" />
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
