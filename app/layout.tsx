import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import './globals.css';
import { Providers } from '@/app/providers';
import { publicEnv } from '@/lib/env';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'], display: 'swap' });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.appUrl),
  title: {
    default: 'SmartSociety — Smart Society Management System',
    template: '%s · SmartSociety',
  },
  description:
    'SmartSociety centralises housing-society administration: resident records, QR visitor gate passes, maintenance billing, complaints, amenity bookings, notices, polls and emergency alerts.',
  keywords: [
    'housing society management',
    'visitor management',
    'gate pass',
    'maintenance billing',
    'apartment management system',
  ],
  authors: [{ name: 'SmartSociety' }],
  openGraph: {
    title: 'SmartSociety — Smart Society Management System',
    description:
      'One platform for society administration, gate security, maintenance billing, complaints and community engagement.',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f9fa' },
    { media: '(prefers-color-scheme: dark)', color: '#14181d' },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Skip to main content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
