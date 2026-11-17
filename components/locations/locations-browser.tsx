'use client';

import { useEffect, useState } from 'react';
import CategoryFilter from '@/components/map/category-filter';
import SearchBar from '@/components/map/search-bar';
import {
  browseQuery,
  DEFAULT_STATUSES,
  matchesName,
  type BrowseState,
  type BrowseView,
} from '@/lib/browse';
import { STATUSES, type LocationStatus } from '@/lib/locations';
import type { Category, EditAccess, Location } from '@/lib/types';
import { LocationRow, LocationTile } from './location-tile';

const STATUS_FILTER_LABELS: Record<LocationStatus, string> = {
  published: 'Published',
  draft: 'Drafts',
  archived: 'Archived',
};

const TOGGLE_GROUP =
  'inline-flex rounded-md border border-neutral-300 text-sm overflow-hidden';
const toggleClass = (on: boolean) =>
  on
    ? 'px-3 py-1 bg-neutral-900 text-white'
    : 'px-3 py-1 bg-white text-neutral-800 hover:bg-neutral-100';

/**
 * Filters locally (~100 rows) and mirrors state into the URL with
 * replaceState, so links are shareable without a server round-trip per
 * keystroke. The server renders the same filtered result from the URL.
 */
export default function LocationsBrowser({
  locations,
  managed,
  initial,
  editAccess,
}: {
  /** Published (public, cached). */
  locations: Location[];
  /** Draft/archived rows this user may edit; [] hides the status filter. */
  managed: Location[];
  initial: BrowseState;
  /** Streamed; resolves per request. Shows Edit links where allowed. */
  editAccess: EditAccess;
}) {
  const [categories, setCategories] = useState(initial.categories);
  const [statuses, setStatuses] = useState(initial.statuses);
  const [query, setQuery] = useState(initial.q);
  const [debouncedQuery, setDebouncedQuery] = useState(initial.q);
  const [view, setView] = useState<BrowseView>(initial.view);

  // Nothing but published to show: ignore ?status= (and drop it from the URL).
  const canFilterStatus = managed.length > 0;
  const activeStatuses = canFilterStatus ? statuses : DEFAULT_STATUSES;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const qs = browseQuery({
      categories,
      statuses: activeStatuses,
      q: debouncedQuery,
      view,
    });
    if (qs !== window.location.search) {
      window.history.replaceState(null, '', window.location.pathname + qs);
    }
  }, [categories, activeStatuses, debouncedQuery, view]);

  const byName = [...locations, ...managed].filter((l) =>
    matchesName(l.name, debouncedQuery),
  );
  const statusCounts = { published: 0, draft: 0, archived: 0 } as Record<
    LocationStatus,
    number
  >;
  for (const l of byName)
    if (categories.includes(l.category)) statusCounts[l.status]++;
  const byStatus = byName.filter((l) => activeStatuses.includes(l.status));
  const counts = { garden: 0, farm: 0, market: 0 } as Record<Category, number>;
  for (const l of byStatus) counts[l.category]++;
  const shown = byStatus
    .filter((l) => categories.includes(l.category))
    .sort((a, b) => a.name.localeCompare(b.name));

  function toggleStatus(s: LocationStatus) {
    const on = statuses.includes(s);
    if (on && statuses.length === 1) return; // keep at least one
    setStatuses(
      on
        ? statuses.filter((x) => x !== s)
        : STATUSES.filter((x) => x === s || statuses.includes(x)),
    );
  }

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

      {canFilterStatus && (
        <div className="flex flex-wrap items-center gap-2 px-3 pt-2">
          <span id="status-filter-label" className="text-sm text-neutral-600">
            Status
          </span>
          <div
            role="group"
            aria-labelledby="status-filter-label"
            className={TOGGLE_GROUP}
          >
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={statuses.includes(s)}
                onClick={() => toggleStatus(s)}
                className={toggleClass(statuses.includes(s))}
              >
                {STATUS_FILTER_LABELS[s]} {statusCounts[s]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <p className="text-sm text-neutral-600" aria-live="polite">
          {shown.length} {shown.length === 1 ? 'location' : 'locations'}
        </p>
        <div role="group" aria-label="Layout" className={TOGGLE_GROUP}>
          {(['tiles', 'list'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={toggleClass(view === v)}
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
