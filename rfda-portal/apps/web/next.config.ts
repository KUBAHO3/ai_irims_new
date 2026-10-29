import type { NextConfig } from 'next';

const API_URL = process.env.API_URL || 'http://localhost:4100';

const nextConfig: NextConfig = {
  // The browser only talks to this origin; /api/* is proxied to the NestJS API so the session cookie stays first-party.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/:path*` }];
  },
  experimental: { proxyTimeout: 300_000 },
};

export default nextConfig;
