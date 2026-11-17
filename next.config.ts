import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  // The map was /map before it became the home page; keep old links working.
  async redirects() {
    return [
      { source: '/map', destination: '/', permanent: true },
      // Add-location moved next to the list it adds to.
      {
        source: '/admin/locations/new',
        destination: '/locations/new',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
