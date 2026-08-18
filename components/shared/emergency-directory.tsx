import { Phone, PhoneCall } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';

export interface DirectoryEntry {
  id: string;
  name: string;
  designation: string | null;
  relation?: string | null;
  phone: string;
  altPhone: string | null;
}

/**
 * Emergency contact directory (SRS §1.6, Common Features).
 *
 * Every number is a real `tel:` link so it can be dialled with one tap from a
 * phone during an actual emergency.
 */
export function EmergencyDirectory({
  contacts,
  emptyTitle = 'No contacts listed',
  emptyDescription,
}: {
  contacts: DirectoryEntry[];
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (contacts.length === 0) {
    return <EmptyState icon={Phone} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {contacts.map((contact) => (
        <Card key={contact.id}>
          <CardContent className="flex h-full flex-col gap-3 p-4">
            <div className="min-w-0">
              <p className="truncate font-semibold">{contact.name}</p>
              {contact.designation || contact.relation ? (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {contact.designation ?? contact.relation}
                </p>
              ) : null}
            </div>

            <div className="mt-auto space-y-2">
              <Button asChild className="w-full justify-start" variant="outline">
                <a href={`tel:${contact.phone}`}>
                  <PhoneCall className="size-4" />
                  <span className="tabular font-mono">{contact.phone}</span>
                </a>
              </Button>
              {contact.altPhone ? (
                <Button asChild className="w-full justify-start" variant="ghost" size="sm">
                  <a href={`tel:${contact.altPhone}`}>
                    <Phone className="size-4" />
                    <span className="tabular font-mono">{contact.altPhone}</span>
                  </a>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
