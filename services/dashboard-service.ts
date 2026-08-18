import 'server-only';

import prisma from '@/lib/prisma';
import { getCollectionSummary, getMonthlyCollectionTrend } from '@/services/billing-service';
import { getComplaintStats } from '@/services/complaint-service';

/**
 * Aggregated read models for the four role dashboards.
 *
 * Each function issues its queries through a single `Promise.all` so a
 * dashboard costs one database round-trip's worth of latency rather than one
 * per tile (NFR: page response under 1.5 s).
 */

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

// ── Administrator ─────────────────────────────────────────────────────────────

export async function getAdminDashboard() {
  const todayStart = startOfToday();
  const tomorrowStart = new Date(todayStart.getTime() + 86_400_000);

  const [
    flatCounts,
    residentCount,
    visitorsToday,
    activePasses,
    insideNow,
    complaints,
    collection,
    trend,
    activeBookings,
    staffCount,
    activeAlert,
    recentComplaints,
    recentGateLogs,
    topDefaulters,
  ] = await Promise.all([
    prisma.flat.groupBy({
      by: ['occupancyStatus'],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    prisma.residentProfile.count({ where: { deletedAt: null } }),
    prisma.gateLog.count({ where: { entryAt: { gte: todayStart, lt: tomorrowStart } } }),
    prisma.gatePass.count({ where: { status: 'ACTIVE', validUntil: { gt: new Date() } } }),
    prisma.gateLog.count({ where: { status: 'INSIDE' } }),
    getComplaintStats(),
    getCollectionSummary(),
    getMonthlyCollectionTrend(6),
    prisma.amenityBooking.count({
      where: { status: { in: ['CONFIRMED', 'PENDING'] }, endsAt: { gte: new Date() } },
    }),
    prisma.staffProfile.count({ where: { deletedAt: null, user: { status: 'ACTIVE' } } }),
    prisma.emergencyAlert.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { startedAt: 'desc' },
      select: { id: true, title: true, severity: true, type: true, startedAt: true },
    }),
    prisma.complaint.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true,
        ticketNumber: true,
        title: true,
        status: true,
        priority: true,
        category: true,
        createdAt: true,
        slaDueAt: true,
        flat: { select: { flatNumber: true, block: { select: { name: true } } } },
      },
    }),
    prisma.gateLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true,
        status: true,
        entryAt: true,
        exitAt: true,
        gate: true,
        verificationMethod: true,
        visitor: { select: { name: true, visitorType: true } },
        flat: { select: { flatNumber: true, block: { select: { name: true } } } },
      },
    }),
    prisma.maintenanceBill.findMany({
      where: { status: { in: ['OVERDUE', 'PARTIALLY_PAID'] } },
      orderBy: { dueDate: 'asc' },
      take: 5,
      select: {
        id: true,
        billNumber: true,
        totalAmount: true,
        paidAmount: true,
        dueDate: true,
        status: true,
        flat: { select: { flatNumber: true, block: { select: { name: true } } } },
      },
    }),
  ]);

  const occupancy = { OCCUPIED: 0, VACANT: 0, UNDER_MAINTENANCE: 0 };
  for (const row of flatCounts) occupancy[row.occupancyStatus] = row._count._all;
  const totalFlats = occupancy.OCCUPIED + occupancy.VACANT + occupancy.UNDER_MAINTENANCE;

  return {
    flats: {
      total: totalFlats,
      occupied: occupancy.OCCUPIED,
      vacant: occupancy.VACANT,
      underMaintenance: occupancy.UNDER_MAINTENANCE,
      occupancyRate: totalFlats > 0 ? Math.round((occupancy.OCCUPIED / totalFlats) * 100) : 0,
    },
    residentCount,
    staffCount,
    visitorsToday,
    activePasses,
    insideNow,
    activeBookings,
    complaints,
    collection,
    trend,
    activeAlert,
    recentComplaints,
    recentGateLogs,
    topDefaulters,
  };
}

// ── Resident ──────────────────────────────────────────────────────────────────

export async function getResidentDashboard(residentId: string, flatId: string) {
  const now = new Date();
  const todayStart = startOfToday();

  const [
    outstandingBills,
    latestBill,
    openComplaints,
    activePasses,
    upcomingBookings,
    pinnedNotices,
    openPolls,
    votedPollIds,
    recentVisitors,
    unreadNotifications,
  ] = await Promise.all([
    prisma.maintenanceBill.aggregate({
      where: { flatId, status: { in: ['UNPAID', 'OVERDUE', 'PARTIALLY_PAID'] } },
      _sum: { totalAmount: true, paidAmount: true },
      _count: true,
    }),
    prisma.maintenanceBill.findFirst({
      where: { flatId, status: { not: 'CANCELLED' } },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
      include: { charges: { orderBy: { amount: 'desc' } } },
    }),
    prisma.complaint.findMany({
      where: { residentId, deletedAt: null, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      orderBy: { createdAt: 'desc' },
      take: 4,
      select: {
        id: true,
        ticketNumber: true,
        title: true,
        status: true,
        priority: true,
        category: true,
        slaDueAt: true,
        createdAt: true,
        resolvedAt: true,
        assignedStaff: { select: { user: { select: { fullName: true } } } },
      },
    }),
    prisma.gatePass.findMany({
      where: { residentId, status: 'ACTIVE', validUntil: { gt: now } },
      orderBy: { validFrom: 'asc' },
      take: 4,
      include: { visitor: true },
    }),
    prisma.amenityBooking.findMany({
      where: { residentId, status: { in: ['CONFIRMED', 'PENDING'] }, startsAt: { gte: now } },
      orderBy: { startsAt: 'asc' },
      take: 4,
      include: { amenity: { select: { name: true, location: true, slug: true } } },
    }),
    prisma.notice.findMany({
      where: {
        deletedAt: null,
        isPublished: true,
        publishAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ isPinned: 'desc' }, { publishAt: 'desc' }],
      take: 4,
      select: {
        id: true,
        title: true,
        category: true,
        priority: true,
        publishAt: true,
        isPinned: true,
        eventDate: true,
      },
    }),
    prisma.poll.findMany({
      where: { deletedAt: null, status: 'ACTIVE', startsAt: { lte: now }, endsAt: { gt: now } },
      orderBy: { endsAt: 'asc' },
      take: 3,
      select: { id: true, title: true, endsAt: true },
    }),
    prisma.pollVote.findMany({ where: { residentId }, select: { pollId: true } }),
    prisma.gateLog.findMany({
      where: { flatId, entryAt: { not: null } },
      orderBy: { entryAt: 'desc' },
      take: 5,
      select: {
        id: true,
        status: true,
        entryAt: true,
        exitAt: true,
        visitor: { select: { name: true, visitorType: true, company: true } },
      },
    }),
    prisma.notification.count({ where: { user: { residentProfile: { id: residentId } }, readAt: null } }),
  ]);

  const voted = new Set(votedPollIds.map((vote) => vote.pollId));
  const billed = Number(outstandingBills._sum.totalAmount ?? 0);
  const paid = Number(outstandingBills._sum.paidAmount ?? 0);

  return {
    outstanding: {
      amount: Number((billed - paid).toFixed(2)),
      billCount: outstandingBills._count,
    },
    latestBill,
    openComplaints,
    activePasses,
    upcomingBookings,
    pinnedNotices,
    openPolls: openPolls.map((poll) => ({ ...poll, hasVoted: voted.has(poll.id) })),
    recentVisitors,
    unreadNotifications,
    visitorsToday: recentVisitors.filter((log) => log.entryAt && log.entryAt >= todayStart).length,
  };
}

// ── Security guard ────────────────────────────────────────────────────────────

export async function getGuardDashboard() {
  const now = new Date();
  const todayStart = startOfToday();
  const tomorrowStart = new Date(todayStart.getTime() + 86_400_000);

  const [
    entriesToday,
    exitsToday,
    insideNow,
    expectedToday,
    overstays,
    recentActivity,
    deniedToday,
    activeAlert,
  ] = await Promise.all([
    prisma.gateLog.count({ where: { entryAt: { gte: todayStart, lt: tomorrowStart } } }),
    prisma.gateLog.count({ where: { exitAt: { gte: todayStart, lt: tomorrowStart } } }),
    prisma.gateLog.count({ where: { status: 'INSIDE' } }),
    prisma.gatePass.findMany({
      where: {
        status: 'ACTIVE',
        validFrom: { lt: tomorrowStart },
        validUntil: { gt: now },
      },
      orderBy: { validFrom: 'asc' },
      take: 12,
      include: {
        visitor: true,
        flat: { select: { flatNumber: true, block: { select: { name: true } } } },
        resident: { select: { user: { select: { fullName: true, phone: true } } } },
      },
    }),
    prisma.gateLog.findMany({
      where: { status: 'INSIDE', expectedExitAt: { lt: now } },
      orderBy: { expectedExitAt: 'asc' },
      take: 10,
      include: {
        visitor: true,
        flat: { select: { flatNumber: true, block: { select: { name: true } } } },
      },
    }),
    prisma.gateLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        visitor: true,
        flat: { select: { flatNumber: true, block: { select: { name: true } } } },
        guard: { select: { fullName: true } },
      },
    }),
    prisma.gateLog.count({ where: { status: 'DENIED', createdAt: { gte: todayStart } } }),
    prisma.emergencyAlert.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { startedAt: 'desc' },
      select: { id: true, title: true, message: true, severity: true, type: true, startedAt: true },
    }),
  ]);

  return {
    entriesToday,
    exitsToday,
    insideNow,
    deniedToday,
    expectedToday,
    overstays,
    recentActivity,
    activeAlert,
  };
}

// ── Maintenance staff ─────────────────────────────────────────────────────────

export async function getStaffDashboard(staffId: string) {
  const now = new Date();
  const soon = new Date(now.getTime() + 4 * 3_600_000);

  const [byStatus, dueSoon, queue, resolvedThisWeek, recentUpdates] = await Promise.all([
    prisma.complaint.groupBy({
      by: ['status'],
      where: { assignedStaffId: staffId, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.complaint.count({
      where: {
        assignedStaffId: staffId,
        deletedAt: null,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        slaDueAt: { lt: soon },
      },
    }),
    prisma.complaint.findMany({
      where: { assignedStaffId: staffId, deletedAt: null, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      orderBy: [{ slaDueAt: 'asc' }],
      take: 8,
      select: {
        id: true,
        ticketNumber: true,
        title: true,
        category: true,
        priority: true,
        status: true,
        slaDueAt: true,
        createdAt: true,
        resolvedAt: true,
        location: true,
        flat: { select: { flatNumber: true, block: { select: { name: true } } } },
        resident: { select: { user: { select: { fullName: true, phone: true } } } },
      },
    }),
    prisma.complaint.count({
      where: {
        assignedStaffId: staffId,
        resolvedAt: { gte: new Date(now.getTime() - 7 * 86_400_000) },
      },
    }),
    prisma.complaintUpdate.findMany({
      where: { complaint: { assignedStaffId: staffId } },
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: {
        complaint: { select: { id: true, ticketNumber: true, title: true } },
        author: { select: { fullName: true } },
      },
    }),
  ]);

  const counts = { PENDING: 0, IN_PROGRESS: 0, RESOLVED: 0, CLOSED: 0 };
  for (const row of byStatus) counts[row.status] = row._count._all;

  return {
    counts,
    open: counts.PENDING + counts.IN_PROGRESS,
    dueSoon,
    queue,
    resolvedThisWeek,
    recentUpdates,
  };
}
