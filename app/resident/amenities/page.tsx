import type { Metadata } from 'next';
import { CalendarCheck } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { AmenityBooking } from '@/app/resident/amenities/amenity-booking';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { CancelBookingButton } from '@/app/resident/amenities/cancel-booking-button';
import { requireResident } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { formatCurrency, formatDateTime, minutesToLabel, toDateInputValue } from '@/lib/utils';
import { completeElapsedBookings, getDaySlots } from '@/services/amenity-service';

export const metadata: Metadata = { title: 'Amenity Booking' };

export default async function ResidentAmenitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ amenity?: string; date?: string }>;
}) {
  const user = await requireResident();
  await completeElapsedBookings();

  const params = await searchParams;

  const amenities = await prisma.amenity.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
  });

  if (amenities.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Amenity booking" />
        <EmptyState
          icon={CalendarCheck}
          title="No amenities configured"
          description="The society office has not published any bookable amenities yet."
        />
      </div>
    );
  }

  const selected =
    amenities.find((amenity) => amenity.slug === params.amenity) ??
    amenities.find((amenity) => amenity.isActive) ??
    amenities[0];

  // Parse the requested day, defaulting to today, and clamp to the booking window.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const requested = params.date ? new Date(`${params.date}T00:00:00`) : today;
  const day = Number.isNaN(requested.getTime()) || requested < today ? today : requested;

  const [slots, myBookings] = await Promise.all([
    getDaySlots(selected, day, user.residentId),
    prisma.amenityBooking.findMany({
      where: { residentId: user.residentId },
      orderBy: { startsAt: 'desc' },
      take: 25,
      include: { amenity: { select: { name: true, location: true, minCancelHours: true } } },
    }),
  ]);

  const upcoming = myBookings.filter(
    (booking) => booking.startsAt > new Date() && booking.status !== 'CANCELLED',
  );
  const past = myBookings.filter(
    (booking) => booking.startsAt <= new Date() || booking.status === 'CANCELLED',
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Community"
        title="Amenity booking"
        description="Check real-time availability and reserve the clubhouse, pool, courts, party hall or gym."
      />

      <AmenityBooking
        amenities={amenities.map((amenity) => ({
          id: amenity.id,
          slug: amenity.slug,
          name: amenity.name,
          description: amenity.description,
          location: amenity.location,
          capacity: amenity.capacity,
          hours: `${minutesToLabel(amenity.openMinute)} – ${minutesToLabel(amenity.closeMinute)}`,
          slotMinutes: amenity.slotMinutes,
          fee: Number(amenity.bookingFee),
          feeLabel: Number(amenity.bookingFee) > 0 ? formatCurrency(amenity.bookingFee) : 'Free',
          requiresApproval: amenity.requiresApproval,
          maxSlotsPerBooking: amenity.maxSlotsPerBooking,
          maxAdvanceDays: amenity.maxAdvanceDays,
          minCancelHours: amenity.minCancelHours,
          isActive: amenity.isActive,
        }))}
        selectedSlug={selected.slug}
        date={toDateInputValue(day)}
        slots={slots.map((slot) => ({
          startsAt: slot.startsAt.toISOString(),
          label: `${minutesToLabel(slot.startsAt.getHours() * 60 + slot.startsAt.getMinutes())}`,
          endLabel: `${minutesToLabel(slot.endsAt.getHours() * 60 + slot.endsAt.getMinutes())}`,
          available: slot.available,
          bookedBy: slot.bookedBy,
          isPast: slot.isPast,
          mine: slot.mine,
        }))}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming bookings</CardTitle>
            <CardDescription>Reservations you can still cancel.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {upcoming.length === 0 ? (
              <EmptyState
                icon={CalendarCheck}
                title="No upcoming bookings"
                description="Pick a slot above to reserve an amenity."
                className="m-5 mt-0"
              />
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {upcoming.map((booking) => (
                  <li key={booking.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{booking.amenity.name}</p>
                        <StatusBadge status={booking.status} />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDateTime(booking.startsAt)} — {formatDateTime(booking.endsAt)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {booking.bookingCode} · {booking.guestsCount} guest(s)
                        {Number(booking.fee) > 0 ? ` · ${formatCurrency(booking.fee)}` : ''}
                      </p>
                    </div>
                    <CancelBookingButton
                      bookingId={booking.id}
                      amenityName={booking.amenity.name}
                      minCancelHours={booking.amenity.minCancelHours}
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Booking history</CardTitle>
            <CardDescription>Past and cancelled reservations.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {past.length === 0 ? (
              <EmptyState icon={CalendarCheck} title="Nothing here yet" className="m-5 mt-0" />
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {past.slice(0, 10).map((booking) => (
                  <li key={booking.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{booking.amenity.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(booking.startsAt)}
                        {booking.cancelReason ? ` · ${booking.cancelReason}` : ''}
                      </p>
                    </div>
                    <StatusBadge status={booking.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>House rules for amenities</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <li>Bookings open up to {selected.maxAdvanceDays} days in advance.</li>
            <li>Cancel at least {selected.minCancelHours} hours before the slot for a free cancellation.</li>
            <li>The Clubhouse and Party Hall need committee approval and carry a usage fee.</li>
            <li>Children under 12 must be accompanied by an adult at the pool and gym.</li>
            <li>Music must stop by 22:00 as per society rules.</li>
            <li>Leave the space clean — damages are recharged to the flat.</li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            {amenities.map((amenity) => (
              <Badge key={amenity.id} variant={amenity.isActive ? 'outline' : 'muted'}>
                {amenity.name}
                {!amenity.isActive ? ' · closed' : ''}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
