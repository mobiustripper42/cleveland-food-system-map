import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import LocationDetails, {
  detailStyles,
} from '@/components/locations/location-details';
import { getPublishedLocations } from '@/lib/db/queries';
import { CATEGORY_LABELS } from '@/lib/locations';

type Params = Promise<{ id: string }>;

// Cached list (~100 rows) — cheaper than a per-id query and shares the tag.
async function getLocation(id: string) {
  return (await getPublishedLocations()).find((l) => l.id === id);
}

export async function generateStaticParams() {
  const ids = (await getPublishedLocations()).map((l) => ({ id: l.id }));
  // Cache Components needs at least one param to validate the route.
  return ids.length ? ids : [{ id: 'none' }];
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const location = await getLocation((await params).id);
  if (!location) return {};
  const summary = `${CATEGORY_LABELS[location.category]} ${
    location.address ? `at ${location.address}` : 'in Cleveland'
  }`;
  const notes = location.notes?.replace(/\s+/g, ' ').trim();
  const description = notes
    ? `${summary}. ${notes.length > 155 ? `${notes.slice(0, 152)}…` : notes}`
    : summary;
  return {
    title: location.name,
    description,
    alternates: { canonical: `/locations/${location.id}` },
    openGraph: {
      title: location.name,
      description,
      images: location.image_url ? [location.image_url] : undefined,
    },
  };
}

export default async function LocationPage({ params }: { params: Params }) {
  const location = await getLocation((await params).id);
  if (!location) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: location.name,
    description: location.notes ?? undefined,
    address: location.address ?? undefined,
    url: location.website ?? undefined,
    image: location.image_url ?? undefined,
    geo:
      location.lat !== null && location.lng !== null
        ? {
            '@type': 'GeoCoordinates',
            latitude: location.lat,
            longitude: location.lng,
          }
        : undefined,
  };

  return (
    <article className="mx-auto w-full max-w-2xl">
      <script
        type="application/ld+json"
        // `<` escaped so notes can't close the script tag.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\u003c'),
        }}
      />
      <nav className="px-4 pt-4 text-sm">
        <Link href="/locations" style={detailStyles.link}>
          ← All locations
        </Link>
      </nav>
      <LocationDetails
        location={location}
        heading="h1"
        bodyStyle={{ padding: '12px 16px 32px' }}
      >
        {location.lat !== null && location.lng !== null && (
          <p style={{ ...detailStyles.field, marginTop: 16 }}>
            <Link href={`/?location=${location.id}`} style={detailStyles.link}>
              View on map
            </Link>
          </p>
        )}
      </LocationDetails>
    </article>
  );
}
