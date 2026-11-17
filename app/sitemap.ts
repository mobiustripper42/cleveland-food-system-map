import type { MetadataRoute } from 'next';
import { getPublishedLocations } from '@/lib/db/queries';
import { SITE_URL } from '@/lib/site-url';

// Sitemap URLs must be absolute (metadataBase doesn't apply here).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const locations = await getPublishedLocations();
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/locations`, changeFrequency: 'weekly', priority: 0.8 },
    ...locations.map((l) => ({
      url: `${SITE_URL}/locations/${l.id}`,
      changeFrequency: 'monthly' as const,
    })),
  ];
}
