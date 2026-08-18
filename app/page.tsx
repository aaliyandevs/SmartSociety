import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Banknote,
  CalendarCheck,
  ClipboardCheck,
  Database,
  FileText,
  Gauge,
  HardHat,
  KeyRound,
  LifeBuoy,
  Lock,
  Megaphone,
  QrCode,
  ScrollText,
  ShieldCheck,
  Siren,
  Smartphone,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { BrandLogo, BrandMark } from '@/components/shared/brand';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DEMO_ACCOUNTS } from '@/lib/demo-accounts';
import { publicEnv } from '@/lib/env';
import { SITEMAP_PAGE_COUNT } from '@/lib/sitemap';
import { ROLE_DESCRIPTIONS } from '@/lib/rbac';

export const metadata: Metadata = {
  title: 'SmartSociety — Smart Society Management System',
  description:
    'One platform for housing-society administration: resident records, QR visitor gate passes, maintenance billing, complaint resolution, amenity bookings, notices, polls and emergency alerts.',
};

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'For each role', href: '#roles' },
  { label: 'Security', href: '#security' },
  { label: 'Sitemap', href: '/sitemap' },
];

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: QrCode,
    title: 'Visitor management & QR gate passes',
    body: 'Residents pre-approve guests, delivery drivers and cabs with a time-boxed pass. The guard scans the QR or types a 6-digit code and the entry is cleared and logged in seconds.',
  },
  {
    icon: ShieldCheck,
    title: 'Gate security & movement logs',
    body: 'Every entry, exit and refusal is recorded with the gate, the verification method and the guard on duty. Overstaying vendors are flagged automatically.',
  },
  {
    icon: Banknote,
    title: 'Maintenance billing & collection',
    body: 'Generate the monthly billing run for every occupied flat, itemise water, security and repair charges, apply overdue penalties and watch the collection rate move.',
  },
  {
    icon: LifeBuoy,
    title: 'Helpdesk with SLA tracking',
    body: 'Residents raise categorised tickets with photos. The office routes them to the right technician and everyone sees the same status history and service-level target.',
  },
  {
    icon: CalendarCheck,
    title: 'Amenity booking',
    body: 'Real-time availability for the clubhouse, pool, courts, party hall and gym. Double-booking is impossible — the database itself enforces one booking per slot.',
  },
  {
    icon: Megaphone,
    title: 'Notices, events & polling',
    body: 'Publish announcements with an event calendar, and put society decisions to a vote where each resident can vote exactly once.',
  },
  {
    icon: Siren,
    title: 'Emergency alerts',
    body: 'Broadcast a fire, security or utility alert society-wide. Every signed-in device shows a full-width banner with instructions and an optional audible siren.',
  },
  {
    icon: ScrollText,
    title: 'Immutable audit trail',
    body: 'Gate verifications, complaint status changes and administrative financial edits are all written to an append-only log that administrators can search.',
  },
];

const JOURNEY = [
  {
    step: '01',
    title: 'Resident pre-approves a visitor',
    body: 'A pass is created with a visit window, a QR code and a 6-digit gate code. Guards on duty are notified that a visitor is expected.',
  },
  {
    step: '02',
    title: 'Guard verifies at the gate',
    body: 'Scan or type the code. The console shows the visitor, the host flat and whether entry may be granted — or exactly why it may not.',
  },
  {
    step: '03',
    title: 'Entry is recorded and the host notified',
    body: 'The gate log captures the timestamp, gate, method and guard. The resident gets a notification the moment their visitor is cleared.',
  },
  {
    step: '04',
    title: 'Everything else follows the same loop',
    body: 'Bills, tickets, bookings and polls all work this way: an action, a permanent record, a notification, and an audit entry the committee can review.',
  },
];

const ROLE_CARDS = [
  {
    role: 'ADMIN' as const,
    icon: UserCog,
    title: 'Administrator',
    points: [
      'Onboard and offboard residents, maintain the flat occupancy map',
      'Run the monthly billing cycle and apply overdue penalties',
      'Route helpdesk tickets and monitor resolution SLAs',
      'Audit gate logs and broadcast emergency alerts',
    ],
  },
  {
    role: 'RESIDENT' as const,
    icon: Users,
    title: 'Resident',
    points: [
      'View bills with a full charge breakdown and download receipts',
      'Generate QR visitor passes with custom time windows',
      'Raise maintenance tickets with photos and track the SLA',
      'Book amenities, read notices and vote in community polls',
    ],
  },
  {
    role: 'GUARD' as const,
    icon: ShieldCheck,
    title: 'Security guard',
    points: [
      'Scan or key in a gate pass for instant clearance',
      'Log walk-in visitors, deliveries and vendors',
      'Record exits and act on overstay alerts',
      'Look up a vehicle registration or an emergency number',
    ],
  },
  {
    role: 'MAINTENANCE_STAFF' as const,
    icon: HardHat,
    title: 'Maintenance staff',
    points: [
      'A queue ordered by service-level deadline',
      'Update status with public or internal work notes',
      'Record how a problem was resolved',
      'See resident ratings on completed work',
    ],
  },
];

const SECURITY_POINTS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Lock,
    title: 'Passwords are never stored',
    body: 'Only a bcrypt hash is kept, at a cost factor tuned so a stolen database cannot be cracked offline in practical time.',
  },
  {
    icon: KeyRound,
    title: 'Revocable server-side sessions',
    body: 'Cookies are signed, HTTP-only and same-site. Every session is also a database row, so a logout or a suspension takes effect instantly.',
  },
  {
    icon: ShieldCheck,
    title: 'Authorisation enforced on the server',
    body: 'Hiding a menu item is a convenience. Every page and every action independently re-checks the role and the ownership of the record.',
  },
  {
    icon: Database,
    title: 'Validated at the boundary',
    body: 'Zod parses every input before it reaches the domain layer, and Prisma parameterises every query, so injection has nowhere to land.',
  },
  {
    icon: FileText,
    title: 'Private file handling',
    body: 'Complaint photos never live in a public folder. They are checked by magic bytes on upload and served through an authenticated route.',
  },
  {
    icon: Gauge,
    title: 'Rate-limited sensitive paths',
    body: 'Sign-in, gate verification and payment simulation are throttled, and repeated failed logins lock an account temporarily.',
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* ── Header ── */}
      <header className="glass-panel sticky top-0 z-40 border-b border-border">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <BrandLogo />

          <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label="Sections">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <ThemeToggle />
            <Button asChild>
              <Link href="/login">
                Sign in
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main id="main-content" className="flex-1">
        {/* ── Hero ── */}
        <section className="relative overflow-hidden border-b border-border">
          <div className="surface-grid absolute inset-0 opacity-40" aria-hidden />
          <div
            className="absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
            aria-hidden
          />

          <div className="relative mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div className="animate-slide-up">
                <Badge variant="soft" className="mb-5">
                  Smart Society Management System
                </Badge>

                <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.4rem]">
                  Run your housing society
                  <span className="block text-primary">without the paper register.</span>
                </h1>

                <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                  SmartSociety replaces gate registers, WhatsApp complaint threads and manual maintenance
                  collection with one auditable system — for administrators, residents, security guards and
                  maintenance staff.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button asChild size="lg">
                    <Link href="/login">
                      Explore the demo
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link href="/sitemap">See the sitemap</Link>
                  </Button>
                </div>

                <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-border pt-6">
                  {[
                    ['4', 'user roles'],
                    [`${SITEMAP_PAGE_COUNT}`, 'screens'],
                    ['< 2 s', 'gate clearance'],
                  ].map(([value, label]) => (
                    <div key={label}>
                      <dt className="tabular text-2xl font-semibold tracking-tight">{value}</dt>
                      <dd className="text-xs text-muted-foreground">{label}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Illustrative product frame */}
              <div className="relative animate-fade-in lg:pl-6">
                <div className="rounded-2xl border border-border bg-card p-4 shadow-lg">
                  <div className="flex items-center gap-2 border-b border-border pb-3">
                    <span className="size-2.5 rounded-full bg-destructive/60" aria-hidden />
                    <span className="size-2.5 rounded-full bg-warning/70" aria-hidden />
                    <span className="size-2.5 rounded-full bg-success/60" aria-hidden />
                    <span className="ml-2 text-xs text-muted-foreground">{publicEnv.societyName}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-4">
                    {[
                      { label: 'Outstanding dues', value: 'Rs 142K', tone: 'text-warning-foreground dark:text-warning' },
                      { label: 'Visitors today', value: '38', tone: 'text-foreground' },
                      { label: 'Open tickets', value: '12', tone: 'text-foreground' },
                      { label: 'Collection rate', value: '87%', tone: 'text-success' },
                    ].map((tile) => (
                      <div key={tile.label} className="rounded-lg border border-border p-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          {tile.label}
                        </p>
                        <p className={`tabular mt-1 text-xl font-semibold ${tile.tone}`}>{tile.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 rounded-lg border border-border p-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
                        <QrCode className="size-5" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">Gate pass verified</p>
                        <p className="text-xs text-muted-foreground">
                          Rahul Mehta → Flat A-101 · Main Gate
                        </p>
                      </div>
                      <Badge variant="success">Allowed</Badge>
                    </div>
                  </div>
                </div>

                <div className="pointer-events-none absolute -bottom-5 -left-5 hidden rounded-xl border border-border bg-card p-3 shadow-lg sm:block">
                  <div className="flex items-center gap-2">
                    <Smartphone className="size-4 text-primary" aria-hidden />
                    <span className="text-xs font-medium">Works on the gate tablet</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" className="border-b border-border py-16 sm:py-20">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Capabilities</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                Every daily society operation, in one place
              </h2>
              <p className="mt-3 text-muted-foreground">
                Eight modules that cover the full lifecycle — from a visitor arriving at the gate to a
                maintenance invoice being settled and receipted.
              </p>
            </div>

            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <Card
                    key={feature.title}
                    className="transition-shadow hover:border-primary/40 hover:shadow-md"
                  >
                    <CardContent className="p-5 sm:p-6">
                      <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <h3 className="mt-4 font-semibold leading-tight">{feature.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section id="how-it-works" className="border-b border-border bg-muted/30 py-16 sm:py-20">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">How it works</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                Follow a visitor from the gate to the flat
              </h2>
              <p className="mt-3 text-muted-foreground">
                The visitor journey shows the pattern the whole system follows.
              </p>
            </div>

            <ol className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {JOURNEY.map((item) => (
                <li
                  key={item.step}
                  className="relative rounded-xl border border-border bg-card p-5 transition-shadow hover:border-primary/40 hover:shadow-md"
                >
                  <span className="tabular text-3xl font-semibold text-primary/25">{item.step}</span>
                  <h3 className="mt-2 font-semibold leading-tight">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Roles ── */}
        <section id="roles" className="border-b border-border py-16 sm:py-20">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Role-based</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                A different console for each kind of user
              </h2>
              <p className="mt-3 text-muted-foreground">
                The guard&apos;s screen is built for a tablet and two large actions. The administrator&apos;s
                is built for depth. Nobody sees a screen they cannot use.
              </p>
            </div>

            <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {ROLE_CARDS.map((card) => {
                const Icon = card.icon;
                return (
                  <Card
                    key={card.role}
                    className="flex h-full flex-col transition-shadow hover:border-primary/40 hover:shadow-md"
                  >
                    <CardContent className="flex h-full flex-col p-5 sm:p-6">
                      <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <h3 className="mt-4 font-semibold">{card.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[card.role]}</p>
                      <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                        {card.points.map((point) => (
                          <li key={point} className="flex gap-2">
                            <ClipboardCheck
                              className="mt-0.5 size-4 shrink-0 text-primary"
                              aria-hidden
                            />
                            {point}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Security ── */}
        <section id="security" className="border-b border-border bg-muted/30 py-16 sm:py-20">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Security</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                Resident data is treated as sensitive
              </h2>
              <p className="mt-3 text-muted-foreground">
                Phone numbers, vehicle records and household details sit behind strict access control.
              </p>
            </div>

            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {SECURITY_POINTS.map((point) => {
                const Icon = point.icon;
                return (
                  <div
                    key={point.title}
                    className="rounded-xl border border-border bg-card p-5 transition-shadow hover:border-primary/40 hover:shadow-md"
                  >
                    <span className="flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <h3 className="mt-3.5 font-semibold leading-tight">{point.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{point.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Demo credentials + CTA ── */}
        <section className="py-16 sm:py-20">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="overflow-hidden rounded-2xl border border-border bg-primary text-primary-foreground">
              <div className="surface-grid relative opacity-20" aria-hidden />
              <div className="grid gap-8 p-8 sm:p-12 lg:grid-cols-2">
                <div>
                  <BrandMark className="size-10" />
                  <h2 className="mt-5 text-3xl font-semibold tracking-tight">
                    Try it as any of the four roles
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-primary-foreground/85">
                    The demo database is seeded with four towers, 48 flats, five months of billing history,
                    a live helpdesk queue, gate traffic, notices and polls — so every screen has real data
                    behind it.
                  </p>
                  <Button asChild size="lg" variant="secondary" className="mt-6">
                    <Link href="/login">
                      Sign in to the demo
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>

                <div className="space-y-2">
                  {DEMO_ACCOUNTS.map((account) => (
                    <div
                      key={account.email}
                      className="rounded-lg bg-white/10 p-3 backdrop-blur-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-semibold">{account.label}</span>
                        <code className="rounded bg-black/20 px-2 py-0.5 font-mono text-[11px]">
                          {account.password}
                        </code>
                      </div>
                      <p className="mt-0.5 break-all font-mono text-[11px] text-primary-foreground/80">
                        {account.email}
                      </p>
                      <p className="mt-1 text-[11px] text-primary-foreground/75">{account.blurb}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border bg-muted/30">
        <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-4">
            <div className="md:col-span-1">
              <BrandLogo />
              <p className="mt-3 max-w-xs text-sm text-muted-foreground">
                A web-based housing society management system covering administration, gate security,
                billing, helpdesk and community engagement.
              </p>
            </div>

            <div>
              <p className="text-sm font-semibold">Product</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} className="hover:text-foreground">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-sm font-semibold">Consoles</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/admin" className="hover:text-foreground">
                    Administrator
                  </Link>
                </li>
                <li>
                  <Link href="/resident" className="hover:text-foreground">
                    Resident
                  </Link>
                </li>
                <li>
                  <Link href="/guard" className="hover:text-foreground">
                    Security guard
                  </Link>
                </li>
                <li>
                  <Link href="/staff" className="hover:text-foreground">
                    Maintenance staff
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-sm font-semibold">Society</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>{publicEnv.societyName}</li>
                <li>office@smartsociety.local</li>
                <li>
                  <Link href="/sitemap" className="hover:text-foreground">
                    Sitemap
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="hover:text-foreground">
                    Sign in
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>SmartSociety · Smart Society Management System</p>
            <p>Built for the Full-Stack Application Development specification.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
