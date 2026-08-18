import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ['@prisma/client', 'bcryptjs', 'pdf-lib'],
  experimental: {
    // Trim client bundles: only the icons/charts actually referenced get shipped.
    optimizePackageImports: ['lucide-react', 'recharts', 'date-fns'],
  },
  eslint: {
    dirs: ['app', 'components', 'lib', 'services', 'hooks', 'types', 'scripts', 'tests'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
