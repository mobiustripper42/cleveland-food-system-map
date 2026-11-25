'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import CategoryFilter from '@/components/map/category-filter';
import SearchBar from '@/components/map/search-bar';
import LocationPanel from '@/components/map/location-panel';
import { useDebounced } from '@/hooks/use-debounced';
import useIsDesktop from '@/hooks/use-is-desktop';
import { matchesQuery } from '@/lib/browse';
import { CATEGORIES } from '@/lib/locations';
import { distanceMiles, formatMiles, type UserPosition } from '@/lib/geo';
import type {
  Category,
  EditAccess,
  EditorContacts,
  Location,
} from '@/lib/types';

// Leaflet touches `window` at import time — client-only.
const MapView = dynamic(() => import('@/components/map/map-view'), {
  ssr: false,
  loading: () => (
    <div
      className="flex flex-1 items-center justify-center bg-muted text-sm text-muted-foreground"
      role="status"
    >
      Loading map…
    </div>
  ),
});

/** `?location=<id>` → that id if it's on the map, else null. */
function idFromUrl(locations: Location[]) {
  const id = new URLSearchParams(window.location.search).get('location');
  return id && locations.some((l) => l.id === id) ? id : null;
}

function urlWith(id: string | null) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set('location', id);
  else url.searchParams.delete('location');
  return url.pathname + url.search + url.hash;
}

export default function MapClient({
  locations,
  contacts,
  editAccess,
}: {
  locations: Location[];
  contacts: EditorContacts;
  editAccess: EditAccess;
}) {
  const [activeCategories, setActiveCategories] =
    useState<Category[]>(CATEGORIES);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounced(query);
  // Store the id, not the object, so the panel shows fresh server data after
  // an edit (e.g. a new photo) revalidates `locations`.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedLocation = locations.find((l) => l.id === selectedId) ?? null;
  // Bumped when a selection comes from the URL (deep link, Back/Forward):
  // the map zooms in to it instead of only panning.
  const [focusRequest, setFocusRequest] = useState(0);
  const [userPosition, setUserPosition] = useState<UserPosition | null>(null);
  const isDesktop = useIsDesktop();
  // Whether the current panel added its own history entry (so closing it
  // goes Back rather than leaving a dead entry).
  const pushed = useRef(false);

  // Deep link from /locations/[id] ("View on map") and Back/Forward. Read on
  // the client so the home page stays cached instead of request-dynamic.
  useEffect(() => {
    const fromUrl = () => {
      const id = idFromUrl(locations);
      pushed.current = false;
      setSelectedId(id);
      if (id) setFocusRequest((n) => n + 1);
    };
    fromUrl();
    window.addEventListener('popstate', fromUrl);
    return () => window.removeEventListener('popstate', fromUrl);
  }, [locations]);

  const select = useCallback(
    (id: string) => {
      if (id === selectedId) return;
      // Switching between locations replaces the entry: Back closes the
      // panel instead of walking through every pin tapped.
      if (selectedId) window.history.replaceState(null, '', urlWith(id));
      else {
        window.history.pushState(null, '', urlWith(id));
        pushed.current = true;
      }
      setSelectedId(id);
    },
    [selectedId],
  );

  const close = useCallback(() => {
    setSelectedId(null);
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else {
      window.history.replaceState(null, '', urlWith(null));
    }
  }, []);

  const filtered = locations.filter((l) => matchesQuery(l, debouncedQuery));

  const counts: Record<Category, number> = {
    garden: filtered.filter((l) => l.category === 'garden').length,
    farm: filtered.filter((l) => l.category === 'farm').length,
    market: filtered.filter((l) => l.category === 'market').length,
  };

  // Closest of what's currently on the map (search + category filters).
  // ~100 rows — a linear scan in the browser beats any server round-trip, and
  // the user's position never leaves the device.
  let nearest: { location: Location; miles: number } | null = null;
  if (userPosition) {
    for (const l of filtered) {
      if (l.lat === null || l.lng === null) continue;
      if (!activeCategories.includes(l.category)) continue;
      const miles = distanceMiles(userPosition, { lat: l.lat, lng: l.lng });
      if (!nearest || miles < nearest.miles) nearest = { location: l, miles };
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SearchBar value={query} onChange={setQuery} />
      <CategoryFilter
        activeCategories={activeCategories}
        counts={counts}
        onChange={setActiveCategories}
      />
      {nearest && !isDesktop && (
        <button
          type="button"
          className="block min-h-11 w-full cursor-pointer truncate border-b border-border bg-muted px-3 text-left text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          onClick={() => select(nearest.location.id)}
        >
          Nearest: <strong>{nearest.location.name}</strong> ·{' '}
          {formatMiles(nearest.miles)}
        </button>
      )}
      {/* Map area: the desktop panel is positioned inside it (left), the
          map controls sit top-right. */}
      <div className="relative flex min-h-0 flex-1">
        {/* Desktop: a strip above a wide map is easy to miss — float a card
            over the map, under the zoom/locate controls (top-right). */}
        {nearest && isDesktop && (
          <button
            type="button"
            className="absolute bottom-6 right-3 z-[1000] flex max-w-[280px] cursor-pointer flex-col gap-0.5 rounded-md border-l-4 border-l-brand bg-background px-3.5 py-2.5 text-left shadow-[0_2px_12px_rgba(0,0,0,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={() => select(nearest.location.id)}
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Nearest to you
            </span>
            <span className="text-base font-semibold text-foreground">
              {nearest.location.name}
            </span>
            <span className="text-sm text-muted-foreground">
              {formatMiles(nearest.miles)} · straight line
            </span>
          </button>
        )}
        <MapView
          locations={filtered}
          activeCategories={activeCategories}
          selectedLocation={selectedLocation}
          focusRequest={focusRequest}
          onSelectLocation={(l) => select(l.id)}
          userPosition={userPosition}
          onLocate={setUserPosition}
        />
        <LocationPanel
          location={selectedLocation}
          contacts={contacts}
          editAccess={editAccess}
          userPosition={userPosition}
          onClose={close}
        />
      </div>
    </div>
  );
}
