import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  // The map was /map before it became the home page; keep old links working.
  async redirects() {
    return [{ source: '/map', destination: '/', permanent: true }];
  },
};

export default nextConfig;
