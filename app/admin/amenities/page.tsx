import type { Metadata } from 'next';
import { CalendarCheck, CalendarRange, Clock, IndianRupee } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { AmenityEditor, AmenityToggle } from '@/app/admin/amenities/amenity-editor';
import { BookingReview } from '@/app/admin/amenities/booking-review';
import { CancelBookingButton } from '@/app/resident/amenities/cancel-booking-button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, EmptyState } from '@/components/ui/feedback';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { requireRole } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { formatCurrency, formatDateTime, minutesToLabel } from '@/lib/utils';
import { completeElapsedBookings } from '@/services/amenity-service';

export const metadata: Metadata = { title: 'Amenities' };

export default async function AdminAmenitiesPage() {
  await requireRole('ADMIN');
  await completeElapsedBookings();

  const now = new Date();

  const [amenities, pending, upcoming, monthBookings, revenue] = await Promise.all([
    prisma.amenity.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { bookings: { where: { status: { in: ['CONFIRMED', 'PENDING'] } } } },
        },
      },
    }),
    prisma.amenityBooking.findMany({
      where: { status: 'PENDING' },
      orderBy: { startsAt: 'asc' },
      include: {
        amenity: { select: { name: true, minCancelHours: true } },
        flat: { include: { block: true } },
        resident: { include: { user: { select: { fullName: true, phone: true } } } },
      },
    }),
    prisma.amenityBooking.findMany({
      where: { status: 'CONFIRMED', startsAt: { gte: now } },
      orderBy: { startsAt: 'asc' },
      take: 25,
      include: {
        amenity: { select: { name: true, minCancelHours: true } },
        flat: { include: { block: true } },
        resident: { include: { user: { select: { fullName: true } } } },
      },
    }),
    prisma.amenityBooking.count({
      where: { createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) } },
    }),
    prisma.amenityBooking.aggregate({
      where: { status: { in: ['CONFIRMED', 'COMPLETED'] } },
      _sum: { fee: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Facilities"
        title="Amenities"
        description="Configure bookable facilities, approve requests and review the upcoming schedule."
        actions={<AmenityEditor />}
      />

      <section className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        <StatCard label="Amenities" value={amenities.length} icon={CalendarRange} />
        <StatCard
          label="Awaiting approval"
          value={pending.length}
          icon={Clock}
          tone={pending.length > 0 ? 'warning' : 'default'}
        />
        <StatCard label="Bookings this month" value={monthBookings} icon={CalendarCheck} tone="info" />
        <StatCard
          label="Booking fees"
          value={formatCurrency(revenue._sum.fee ?? 0)}
          hint="Confirmed and completed bookings"
          icon={IndianRupee}
          tone="success"
        />
      </section>

      <Tabs defaultValue={pending.length > 0 ? 'requests' : 'amenities'}>
        <TabsList>
          <TabsTrigger value="amenities">Amenities ({amenities.length})</TabsTrigger>
          <TabsTrigger value="requests">Requests ({pending.length})</TabsTrigger>
          <TabsTrigger value="schedule">Schedule ({upcoming.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="amenities">
          {amenities.length === 0 ? (
            <EmptyState
              icon={CalendarRange}
              title="No amenities configured"
              description="Add the clubhouse, pool, courts or gym so residents can book them."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {amenities.map((amenity) => (
                <Card key={amenity.id}>
                  <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                    <div className="min-w-0">
                      <CardTitle>{amenity.name}</CardTitle>
                      <CardDescription>{amenity.location ?? 'Location not set'}</CardDescription>
                    </div>
                    <Badge variant={amenity.isActive ? 'success' : 'muted'}>
                      {amenity.isActive ? 'Open' : 'Closed'}
                    </Badge>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {amenity.description ? (
                      <p className="line-clamp-2 text-sm text-muted-foreground">{amenity.description}</p>
                    ) : null}

                    <dl className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        ['Hours', `${minutesToLabel(amenity.openMinute)} – ${minutesToLabel(amenity.closeMinute)}`],
                        ['Slot length', `${amenity.slotMinutes} min`],
                        ['Capacity', `${amenity.capacity} people`],
                        [
                          'Fee',
                          Number(amenity.bookingFee) > 0 ? formatCurrency(amenity.bookingFee) : 'Free',
                        ],
                        ['Book ahead', `${amenity.maxAdvanceDays} days`],
                        ['Cancel window', `${amenity.minCancelHours} h`],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt className="text-muted-foreground">{label}</dt>
                          <dd className="mt-0.5 font-medium">{value}</dd>
                        </div>
                      ))}
                    </dl>

                    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                      {amenity.requiresApproval ? <Badge variant="warning">Needs approval</Badge> : null}
                      <span className="text-xs text-muted-foreground">
                        {amenity._count.bookings} upcoming booking(s)
                      </span>
                      <span className="ml-auto flex items-center gap-1">
                        <AmenityEditor
                          amenity={{
                            id: amenity.id,
                            name: amenity.name,
                            description: amenity.description,
                            location: amenity.location,
                            capacity: amenity.capacity,
                            openMinute: amenity.openMinute,
                            closeMinute: amenity.closeMinute,
                            slotMinutes: amenity.slotMinutes,
                            bookingFee: Number(amenity.bookingFee),
                            maxAdvanceDays: amenity.maxAdvanceDays,
                            minCancelHours: amenity.minCancelHours,
                            maxSlotsPerBooking: amenity.maxSlotsPerBooking,
                            requiresApproval: amenity.requiresApproval,
                            isActive: amenity.isActive,
                          }}
                        />
                        <AmenityToggle amenityId={amenity.id} isActive={amenity.isActive} name={amenity.name} />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="requests">
          {pending.length === 0 ? (
            <Alert variant="success" title="Nothing awaiting approval">
              All booking requests have been reviewed.
            </Alert>
          ) : (
            <div className="space-y-3">
              {pending.map((booking) => (
                <Card key={booking.id}>
                  <CardContent className="flex flex-wrap items-start gap-4 p-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{booking.amenity.name}</h3>
                        <StatusBadge status={booking.status} />
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDateTime(booking.startsAt)} — {formatDateTime(booking.endsAt)}
                      </p>
                      <p className="mt-0.5 text-sm">
                        Flat {booking.flat.block.name}-{booking.flat.flatNumber} ·{' '}
                        {booking.resident.user.fullName} · {booking.guestsCount} guest(s)
                      </p>
                      {booking.purpose ? (
                        <p className="mt-1 text-xs text-muted-foreground">{booking.purpose}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {booking.bookingCode}
                        {Number(booking.fee) > 0 ? ` · fee ${formatCurrency(booking.fee)}` : ''}
                      </p>
                    </div>
                    <BookingReview bookingId={booking.id} amenityName={booking.amenity.name} />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="schedule">
          {upcoming.length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title="No upcoming bookings"
              description="Confirmed reservations will appear here."
            />
          ) : (
            <div className="space-y-2">
              {upcoming.map((booking) => (
                <Card key={booking.id}>
                  <CardContent className="flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{booking.amenity.name}</p>
                        <StatusBadge status={booking.status} />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDateTime(booking.startsAt)} · Flat {booking.flat.block.name}-
                        {booking.flat.flatNumber} · {booking.resident.user.fullName}
                      </p>
                    </div>
                    <CancelBookingButton
                      bookingId={booking.id}
                      amenityName={booking.amenity.name}
                      minCancelHours={0}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
