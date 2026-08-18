import type { ElementType } from 'react';
import type { Role } from '@prisma/client';
import {
  Banknote,
  Bell,
  Building2,
  CalendarCheck,
  CalendarRange,
  CarFront,
  ClipboardList,
  Contact,
  CreditCard,
  DoorOpen,
  FileText,
  Gauge,
  Home,
  IdCard,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  Megaphone,
  Phone,
  QrCode,
  ScrollText,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Ticket,
  Users,
  Vote,
  Wrench,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: ElementType;
  /** Match child routes too (e.g. /admin/complaints/abc). */
  exact?: boolean;
  description?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/**
 * Sidebar structure per role. Hiding links here is a usability affordance only —
 * `middleware.ts` and every page's `requireRole()` call are what actually
 * enforce access.
 */
export const ADMIN_NAV: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', href: '/admin', icon: LayoutDashboard, exact: true },
      { label: 'Reports', href: '/admin/reports', icon: Gauge },
    ],
  },
  {
    title: 'Community',
    items: [
      { label: 'Flats & Units', href: '/admin/flats', icon: Building2 },
      { label: 'Residents', href: '/admin/residents', icon: Users },
      { label: 'Maintenance Staff', href: '/admin/staff', icon: Wrench },
    ],
  },
  {
    title: 'Security',
    items: [
      { label: 'Visitors', href: '/admin/visitors', icon: IdCard },
      { label: 'Gate Logs', href: '/admin/security', icon: ShieldCheck },
      { label: 'Emergency Alerts', href: '/admin/alerts', icon: Siren },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Maintenance Bills', href: '/admin/bills', icon: Banknote },
      { label: 'Payments', href: '/admin/payments', icon: CreditCard },
      { label: 'Complaints', href: '/admin/complaints', icon: LifeBuoy },
      { label: 'Amenities', href: '/admin/amenities', icon: CalendarRange },
    ],
  },
  {
    title: 'Communication',
    items: [
      { label: 'Notices', href: '/admin/notices', icon: Megaphone },
      { label: 'Polls', href: '/admin/polls', icon: Vote },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Audit Logs', href: '/admin/audit', icon: ScrollText },
      { label: 'Settings', href: '/admin/settings', icon: Settings },
    ],
  },
];

export const RESIDENT_NAV: NavSection[] = [
  {
    title: 'My Home',
    items: [
      { label: 'Dashboard', href: '/resident', icon: LayoutDashboard, exact: true },
      { label: 'My Flat', href: '/resident/flat', icon: Home },
      { label: 'Vehicles', href: '/resident/vehicles', icon: CarFront },
    ],
  },
  {
    title: 'Money',
    items: [
      { label: 'Maintenance Bills', href: '/resident/bills', icon: Banknote },
      { label: 'Payment History', href: '/resident/payments', icon: CreditCard },
    ],
  },
  {
    title: 'Services',
    items: [
      { label: 'Visitor Passes', href: '/resident/visitors', icon: QrCode },
      { label: 'Complaints', href: '/resident/complaints', icon: LifeBuoy },
      { label: 'Amenity Booking', href: '/resident/amenities', icon: CalendarCheck },
    ],
  },
  {
    title: 'Community',
    items: [
      { label: 'Notice Board', href: '/resident/notices', icon: Megaphone },
      { label: 'Polls & Voting', href: '/resident/polls', icon: Vote },
      { label: 'Guidelines', href: '/resident/guidelines', icon: FileText },
      { label: 'Emergency Contacts', href: '/resident/emergency', icon: Phone },
    ],
  },
];

export const GUARD_NAV: NavSection[] = [
  {
    title: 'Gate',
    items: [
      { label: 'Gate Dashboard', href: '/guard', icon: LayoutDashboard, exact: true },
      { label: 'Verify Pass', href: '/guard/verify', icon: QrCode },
      { label: 'Walk-in Entry', href: '/guard/walk-in', icon: DoorOpen },
    ],
  },
  {
    title: 'Records',
    items: [
      { label: 'Visitor Log', href: '/guard/logs', icon: ClipboardList },
      { label: 'Expected Today', href: '/guard/expected', icon: Ticket },
      { label: 'Vehicles', href: '/guard/vehicles', icon: CarFront },
    ],
  },
  {
    title: 'Awareness',
    items: [
      { label: 'Alerts', href: '/guard/alerts', icon: ShieldAlert },
      { label: 'Directory', href: '/guard/directory', icon: Contact },
    ],
  },
];

export const STAFF_NAV: NavSection[] = [
  {
    title: 'Work',
    items: [
      { label: 'My Dashboard', href: '/staff', icon: LayoutDashboard, exact: true },
      { label: 'Assigned Tickets', href: '/staff/tickets', icon: ListChecks },
      { label: 'Completed Work', href: '/staff/history', icon: ClipboardList },
    ],
  },
  {
    title: 'Society',
    items: [
      { label: 'Notices', href: '/staff/notices', icon: Megaphone },
      { label: 'Alerts', href: '/staff/alerts', icon: ShieldAlert },
    ],
  },
];

export const NAV_BY_ROLE: Record<Role, NavSection[]> = {
  ADMIN: ADMIN_NAV,
  RESIDENT: RESIDENT_NAV,
  GUARD: GUARD_NAV,
  MAINTENANCE_STAFF: STAFF_NAV,
};

/** Shown in the account dropdown for every role. */
export const ACCOUNT_NAV: NavItem[] = [
  { label: 'My Profile', href: '/account', icon: Contact, exact: true },
  { label: 'Notifications', href: '/account/notifications', icon: Bell },
  { label: 'Security', href: '/account/security', icon: ShieldCheck },
];

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
