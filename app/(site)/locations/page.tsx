import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import LocationsBrowser from '@/components/locations/locations-browser';
import { Button } from '@/components/ui/button';
import { browseQuery, parseBrowseParams } from '@/lib/browse';
import {
  getEditAccess,
  getPublishedLocations,
  isEditor,
} from '@/lib/db/queries';

export const metadata: Metadata = {
  title: 'All locations',
  description:
    'Browse every community garden, urban farm, and farmers market on the Cleveland Food System Map.',
  alternates: { canonical: '/locations' },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function LocationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="flex items-center justify-between gap-3 px-3 pt-4">
        <h1 className="text-xl font-semibold">All locations</h1>
        {/* Reads the session: streams in, keeps the shell static. */}
        <Suspense fallback={null}>
          <NewLocationButton />
        </Suspense>
      </div>
      {/* searchParams is request data: read it under Suspense so the heading
          stays in the static shell. */}
      <Suspense
        fallback={<p className="px-3 py-8 text-neutral-600">Loading…</p>}
      >
        <Browser searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

// Editors only. Hiding it is UX; /locations/new and createLocation check
// editor membership themselves.
async function NewLocationButton() {
  if (!(await isEditor())) return null;
  return (
    <Button asChild size="sm">
      <Link href="/locations/new">New location</Link>
    </Button>
  );
}

async function Browser({ searchParams }: { searchParams: SearchParams }) {
  const initial = parseBrowseParams(await searchParams);
  return (
    <LocationsBrowser
      // Remount when a link changes the URL (state is seeded from it once).
      key={browseQuery(initial)}
      locations={await getPublishedLocations()}
      initial={initial}
      // Not awaited: the list renders, Edit links stream in.
      editAccess={getEditAccess()}
    />
  );
}
