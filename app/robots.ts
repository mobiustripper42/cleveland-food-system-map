import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site-url';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', disallow: ['/admin', '/account', '/login'] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
