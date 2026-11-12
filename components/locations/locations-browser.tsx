'use client';

import { useEffect, useState } from 'react';
import CategoryFilter from '@/components/map/category-filter';
import SearchBar from '@/components/map/search-bar';
import {
  browseQuery,
  matchesName,
  type BrowseState,
  type BrowseView,
} from '@/lib/browse';
import type { Category, EditAccess, Location } from '@/lib/types';
import { LocationRow, LocationTile } from './location-tile';

/**
 * Filters locally (~100 rows) and mirrors state into the URL with
 * replaceState, so links are shareable without a server round-trip per
 * keystroke. The server renders the same filtered result from the URL.
 */
export default function LocationsBrowser({
  locations,
  initial,
  editAccess,
}: {
  locations: Location[];
  initial: BrowseState;
  /** Streamed; resolves per request. Shows Edit links where allowed. */
  editAccess: EditAccess;
}) {
  const [categories, setCategories] = useState(initial.categories);
  const [query, setQuery] = useState(initial.q);
  const [debouncedQuery, setDebouncedQuery] = useState(initial.q);
  const [view, setView] = useState<BrowseView>(initial.view);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const qs = browseQuery({ categories, q: debouncedQuery, view });
    if (qs !== window.location.search) {
      window.history.replaceState(null, '', window.location.pathname + qs);
    }
  }, [categories, debouncedQuery, view]);

  const byName = locations.filter((l) => matchesName(l.name, debouncedQuery));
  const counts = { garden: 0, farm: 0, market: 0 } as Record<Category, number>;
  for (const l of byName) counts[l.category]++;
  const shown = byName.filter((l) => categories.includes(l.category));

  return (
    <div className="flex flex-col">
      <SearchBar
        value={query}
        onChange={setQuery}
        placeholder="Search by name…"
      />
      <CategoryFilter
        activeCategories={categories}
        counts={counts}
        onChange={setCategories}
      />

      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <p className="text-sm text-neutral-600" aria-live="polite">
          {shown.length} {shown.length === 1 ? 'location' : 'locations'}
        </p>
        <div
          role="group"
          aria-label="Layout"
          className="inline-flex rounded-md border border-neutral-300 text-sm overflow-hidden"
        >
          {(['tiles', 'list'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={
                view === v
                  ? 'px-3 py-1 bg-neutral-900 text-white'
                  : 'px-3 py-1 bg-white text-neutral-800 hover:bg-neutral-100'
              }
            >
              {v === 'tiles' ? 'Tiles' : 'List'}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="px-3 py-8 text-center text-neutral-600">
          No locations match.
        </p>
      ) : view === 'tiles' ? (
        <ul className="grid grid-cols-1 gap-3 px-3 pb-6 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((l) => (
            <LocationTile key={l.id} location={l} editAccess={editAccess} />
          ))}
        </ul>
      ) : (
        <ul className="divide-y divide-neutral-200 px-3 pb-6">
          {shown.map((l) => (
            <LocationRow key={l.id} location={l} editAccess={editAccess} />
          ))}
        </ul>
      )}
    </div>
  );
}
