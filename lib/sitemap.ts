import type { Role } from '@prisma/client';

/**
 * The application sitemap.
 *
 * The SRS requires a sitemap on the home page so users can understand the flow
 * of the application. Keeping it as data (rather than markup) lets the landing
 * page, the standalone /sitemap page and the documentation all render the same
 * structure from one source.
 */

export interface SitemapLink {
  label: string;
  href: string;
  description: string;
}

export interface SitemapGroup {
  title: string;
  description: string;
  links: SitemapLink[];
}

export interface SitemapSection {
  id: string;
  title: string;
  audience: string;
  /** Null for the public area, which has no role. */
  role: Role | null;
  entryPoint: string;
  summary: string;
  groups: SitemapGroup[];
}

export const PUBLIC_SECTION: SitemapSection = {
  id: 'public',
  title: 'Public area',
  audience: 'Anyone',
  role: null,
  entryPoint: '/',
  summary: 'What visitors see before signing in.',
  groups: [
    {
      title: 'Pages',
      description: 'Open to everyone.',
      links: [
        { label: 'Home', href: '/', description: 'Product overview, features and this sitemap.' },
        { label: 'Sitemap', href: '/sitemap', description: 'Full map of every screen in the system.' },
        { label: 'Sign in', href: '/login', description: 'Role-based sign-in with demo accounts.' },
      ],
    },
  ],
};

export const ADMIN_SECTION: SitemapSection = {
  id: 'admin',
  title: 'Administrator',
  audience: 'Society management committee',
  role: 'ADMIN',
  entryPoint: '/admin',
  summary: 'Full operational and financial control of the society.',
  groups: [
    {
      title: 'Overview',
      description: 'Live operational picture.',
      links: [
        { label: 'Dashboard', href: '/admin', description: 'Occupancy, collection, security and helpdesk at a glance.' },
        { label: 'Reports', href: '/admin/reports', description: 'Collection by block, technician performance, amenity and gate analytics.' },
      ],
    },
    {
      title: 'Community',
      description: 'The people and the property.',
      links: [
        { label: 'Flats & units', href: '/admin/flats', description: 'Unit register, occupancy map and per-flat maintenance charges.' },
        { label: 'Residents', href: '/admin/residents', description: 'Onboard, edit and offboard owners and tenants.' },
        { label: 'Maintenance staff', href: '/admin/staff', description: 'Guards and technicians, departments and workload.' },
      ],
    },
    {
      title: 'Security',
      description: 'Gate oversight and emergencies.',
      links: [
        { label: 'Visitors', href: '/admin/visitors', description: 'Every gate pass issued, with status and usage.' },
        { label: 'Gate logs', href: '/admin/security', description: 'Entry/exit records, overstays and refusals across all gates.' },
        { label: 'Emergency alerts', href: '/admin/alerts', description: 'Broadcast and resolve society-wide alerts.' },
      ],
    },
    {
      title: 'Operations',
      description: 'Money and services.',
      links: [
        { label: 'Maintenance bills', href: '/admin/bills', description: 'Monthly billing run, penalties and collection tracking.' },
        { label: 'Payments', href: '/admin/payments', description: 'Payment ledger with downloadable receipts.' },
        { label: 'Complaints', href: '/admin/complaints', description: 'Route helpdesk tickets to staff and monitor SLAs.' },
        { label: 'Amenities', href: '/admin/amenities', description: 'Configure facilities and approve booking requests.' },
      ],
    },
    {
      title: 'Communication',
      description: 'Reaching the community.',
      links: [
        { label: 'Notices', href: '/admin/notices', description: 'Publish and schedule announcements.' },
        { label: 'Polls', href: '/admin/polls', description: 'Run community votes and publish results.' },
      ],
    },
    {
      title: 'System',
      description: 'Governance and configuration.',
      links: [
        { label: 'Audit log', href: '/admin/audit', description: 'Immutable record of security, financial and admin actions.' },
        { label: 'Settings', href: '/admin/settings', description: 'Society identity, billing policy, guidelines and emergency directory.' },
      ],
    },
  ],
};

export const RESIDENT_SECTION: SitemapSection = {
  id: 'resident',
  title: 'Resident',
  audience: 'Owners and tenants',
  role: 'RESIDENT',
  entryPoint: '/resident',
  summary: 'Everything a household needs, from bills to visitor passes.',
  groups: [
    {
      title: 'My home',
      description: 'Household records.',
      links: [
        { label: 'Dashboard', href: '/resident', description: 'Dues, tickets, passes, bookings, notices and polls.' },
        { label: 'My flat', href: '/resident/flat', description: 'Unit details, household members and co-residents.' },
        { label: 'Vehicles', href: '/resident/vehicles', description: 'Register vehicles so security can identify them.' },
      ],
    },
    {
      title: 'Money',
      description: 'Maintenance dues.',
      links: [
        { label: 'Maintenance bills', href: '/resident/bills', description: 'Current and historical invoices with a full breakdown.' },
        { label: 'Payment history', href: '/resident/payments', description: 'Past payments and downloadable PDF receipts.' },
      ],
    },
    {
      title: 'Services',
      description: 'Day-to-day requests.',
      links: [
        { label: 'Visitor passes', href: '/resident/visitors', description: 'Generate QR gate passes with custom time windows.' },
        { label: 'Complaints', href: '/resident/complaints', description: 'Raise tickets with photos and track them against the SLA.' },
        { label: 'Amenity booking', href: '/resident/amenities', description: 'Check availability and reserve shared facilities.' },
      ],
    },
    {
      title: 'Community',
      description: 'Society life.',
      links: [
        { label: 'Notice board', href: '/resident/notices', description: 'Announcements and the event calendar.' },
        { label: 'Polls & voting', href: '/resident/polls', description: 'Cast one vote per community poll.' },
        { label: 'Guidelines', href: '/resident/guidelines', description: 'The society rulebook.' },
        { label: 'Emergency contacts', href: '/resident/emergency', description: 'Society directory plus your own contacts.' },
      ],
    },
  ],
};

export const GUARD_SECTION: SitemapSection = {
  id: 'guard',
  title: 'Security guard',
  audience: 'Gate personnel',
  role: 'GUARD',
  entryPoint: '/guard',
  summary: 'A gate console built for speed on a tablet.',
  groups: [
    {
      title: 'Gate',
      description: 'The two actions used most.',
      links: [
        { label: 'Gate dashboard', href: '/guard', description: 'Today’s traffic, overstays and recent movements.' },
        { label: 'Verify pass', href: '/guard/verify', description: 'Scan a QR code or type the 6-digit gate code.' },
        { label: 'Walk-in entry', href: '/guard/walk-in', description: 'Log a visitor who arrives without a pass.' },
      ],
    },
    {
      title: 'Records',
      description: 'Reference and history.',
      links: [
        { label: 'Visitor log', href: '/guard/logs', description: 'Every entry, exit and refusal, with exit recording.' },
        { label: 'Expected today', href: '/guard/expected', description: 'Pre-approved passes valid now or later today.' },
        { label: 'Vehicle register', href: '/guard/vehicles', description: 'Look up which flat a registration belongs to.' },
      ],
    },
    {
      title: 'Awareness',
      description: 'Safety information.',
      links: [
        { label: 'Alerts', href: '/guard/alerts', description: 'Active and past emergency broadcasts.' },
        { label: 'Directory', href: '/guard/directory', description: 'One-tap emergency numbers.' },
      ],
    },
  ],
};

export const STAFF_SECTION: SitemapSection = {
  id: 'staff',
  title: 'Maintenance staff',
  audience: 'Technicians',
  role: 'MAINTENANCE_STAFF',
  entryPoint: '/staff',
  summary: 'A focused queue of assigned work.',
  groups: [
    {
      title: 'Work',
      description: 'Assigned tickets.',
      links: [
        { label: 'My dashboard', href: '/staff', description: 'Queue ordered by service-level deadline.' },
        { label: 'Assigned tickets', href: '/staff/tickets', description: 'Update status, add work notes, record resolution.' },
        { label: 'Completed work', href: '/staff/history', description: 'Resolved tickets and resident ratings.' },
      ],
    },
    {
      title: 'Society',
      description: 'Staying informed.',
      links: [
        { label: 'Notices', href: '/staff/notices', description: 'Announcements relevant to staff.' },
        { label: 'Alerts', href: '/staff/alerts', description: 'Emergency broadcasts.' },
      ],
    },
  ],
};

export const ACCOUNT_SECTION: SitemapSection = {
  id: 'account',
  title: 'My account',
  audience: 'Every signed-in user',
  role: null,
  entryPoint: '/account',
  summary: 'Shared by all four roles.',
  groups: [
    {
      title: 'Account',
      description: 'Personal settings.',
      links: [
        { label: 'My profile', href: '/account', description: 'Name, email, phone and occupation.' },
        { label: 'Notifications', href: '/account/notifications', description: 'Every alert sent to you.' },
        { label: 'Security', href: '/account/security', description: 'Change password and review active sessions.' },
      ],
    },
  ],
};

export const SITEMAP: SitemapSection[] = [
  PUBLIC_SECTION,
  ADMIN_SECTION,
  RESIDENT_SECTION,
  GUARD_SECTION,
  STAFF_SECTION,
  ACCOUNT_SECTION,
];

/** Total number of distinct screens, quoted on the landing page. */
export const SITEMAP_PAGE_COUNT = SITEMAP.reduce(
  (sum, section) => sum + section.groups.reduce((groupSum, group) => groupSum + group.links.length, 0),
  0,
);
