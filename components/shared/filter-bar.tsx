'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface FilterDefinition {
  name: string;
  label: string;
  options: { value: string; label: string }[];
}

interface FilterBarProps {
  searchPlaceholder?: string;
  filters?: FilterDefinition[];
  className?: string;
  children?: React.ReactNode;
}

/**
 * Search + dropdown filters that write into the URL. Because the state lives in
 * the query string, the list itself stays a server component and results are
 * shareable and back-button friendly.
 */
export function FilterBar({
  searchPlaceholder = 'Search…',
  filters = [],
  className,
  children,
}: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [term, setTerm] = React.useState(searchParams.get('q') ?? '');
  const [isPending, startTransition] = React.useTransition();

  const activeCount =
    (searchParams.get('q') ? 1 : 0) +
    filters.filter((filter) => searchParams.get(filter.name)).length;

  const apply = React.useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (!value || value === 'ALL') params.delete(key);
        else params.set(key, value);
      }
      // Any filter change resets to the first page.
      params.delete('page');
      const query = params.toString();
      startTransition(() => {
        router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  // Debounce typing so we do not push a route on every keystroke.
  React.useEffect(() => {
    const current = searchParams.get('q') ?? '';
    if (term === current) return;
    const timer = setTimeout(() => apply({ q: term.trim() || null }), 350);
    return () => clearTimeout(timer);
  }, [term, apply, searchParams]);

  return (
    <div className={cn('flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative w-full sm:w-64">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9"
            aria-label={searchPlaceholder}
          />
        </div>

        {filters.map((filter) => (
          <Select
            key={filter.name}
            value={searchParams.get(filter.name) ?? 'ALL'}
            onValueChange={(value) => apply({ [filter.name]: value })}
          >
            <SelectTrigger className="w-full sm:w-44" aria-label={filter.label}>
              <SelectValue placeholder={filter.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All {filter.label.toLowerCase()}</SelectItem>
              {filter.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}

        {activeCount > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setTerm('');
              startTransition(() => router.push(pathname, { scroll: false }));
            }}
          >
            <X className="size-4" />
            Clear
          </Button>
        ) : null}

        {isPending ? <span className="text-xs text-muted-foreground">Updating…</span> : null}
      </div>

      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}
