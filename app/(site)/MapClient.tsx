'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import CategoryFilter from '@/components/map/category-filter';
import SearchBar from '@/components/map/search-bar';
import LocationPanel from '@/components/map/location-panel';
import useIsDesktop from '@/hooks/use-is-desktop';
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
});

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
  const [debouncedQuery, setDebouncedQuery] = useState('');
  // Store the id, not the object, so the panel shows fresh server data after
  // an edit (e.g. a new photo) revalidates `locations`.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedLocation = locations.find((l) => l.id === selectedId) ?? null;
  const [userPosition, setUserPosition] = useState<UserPosition | null>(null);
  const isDesktop = useIsDesktop();

  // Deep link from /locations/[id] ("View on map"). Read on the client so the
  // home page stays cached instead of becoming request-dynamic.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('location');
    if (id && locations.some((l) => l.id === id)) setSelectedId(id);
  }, [locations]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  const filtered = debouncedQuery.trim()
    ? locations.filter((l) => {
        const q = debouncedQuery.toLowerCase();
        return (
          l.name.toLowerCase().includes(q) ||
          (l.notes ?? '').toLowerCase().includes(q)
        );
      })
    : locations;

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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
      }}
    >
      <SearchBar value={query} onChange={setQuery} />
      <CategoryFilter
        activeCategories={activeCategories}
        counts={counts}
        onChange={setActiveCategories}
      />
      {nearest && !isDesktop && (
        <button
          type="button"
          style={styles.nearest}
          onClick={() => setSelectedId(nearest.location.id)}
        >
          Nearest: <strong>{nearest.location.name}</strong> ·{' '}
          {formatMiles(nearest.miles)}
        </button>
      )}
      <div style={styles.mapArea}>
        {/* Desktop: a strip above a wide map is easy to miss — float a card
            over the map's top-right (zoom/locate controls sit top-left, the
            location panel opens on the left). */}
        {nearest && isDesktop && (
          <button
            type="button"
            style={styles.nearestCard}
            onClick={() => setSelectedId(nearest.location.id)}
          >
            <span style={styles.nearestLabel}>Nearest to you</span>
            <span style={styles.nearestName}>{nearest.location.name}</span>
            <span style={styles.nearestMeta}>
              {formatMiles(nearest.miles)} · straight line
            </span>
          </button>
        )}
        <MapView
          locations={filtered}
          activeCategories={activeCategories}
          selectedLocation={selectedLocation}
          onSelectLocation={(l) => setSelectedId(l.id)}
          userPosition={userPosition}
          onLocate={setUserPosition}
        />
      </div>
      <LocationPanel
        location={selectedLocation}
        contacts={contacts}
        editAccess={editAccess}
        userPosition={userPosition}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  mapArea: {
    position: 'relative',
    display: 'flex',
    flex: 1,
    minHeight: 0,
  },
  nearestCard: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1000, // above Leaflet panes, below the location panel (1200)
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    maxWidth: 280,
    padding: '10px 14px',
    background: '#fff',
    border: 'none',
    borderLeft: '4px solid #3a7d44',
    borderRadius: 6,
    boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
    textAlign: 'left',
    cursor: 'pointer',
  },
  nearestLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    color: '#6b6375',
  },
  nearestName: {
    fontSize: 16,
    fontWeight: 600,
    color: '#08060d',
  },
  nearestMeta: {
    fontSize: 13,
    color: '#6b6375',
  },
  nearest: {
    display: 'block',
    width: '100%',
    padding: '8px 12px',
    background: '#f4f4f5',
    border: 'none',
    borderBottom: '1px solid #e5e4e7',
    textAlign: 'left',
    fontSize: 14,
    color: '#08060d',
    cursor: 'pointer',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
};
