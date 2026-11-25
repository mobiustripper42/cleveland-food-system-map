import Link from 'next/link';
import { formatScheduleShort } from '@/lib/format';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '@/lib/locations';
import type { EditAccess, Location } from '@/lib/types';
import { CategoryIcon } from './category-icon';
import EditLink from './edit-link';

/** Non-published rows have no public page; their name opens the editor. */
const href = (l: Location) =>
  l.status === 'published' ? `/locations/${l.id}` : `/locations/${l.id}/edit`;

/** "Draft" / "Archived" tag; nothing for published. Neutral, no color cue. */
export function StatusBadge({ location }: { location: Location }) {
  if (location.status === 'published') return null;
  return (
    <span className="inline-block rounded border border-input px-1.5 text-xs font-medium text-foreground">
      {location.status === 'draft' ? 'Draft' : 'Archived'}
    </span>
  );
}

export function CategoryLabel({ location }: { location: Location }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
      {/* Glyph in the category color: shape + label, not color alone. */}
      <span style={{ color: CATEGORY_COLORS[location.category] }}>
        <CategoryIcon category={location.category} />
      </span>
      {CATEGORY_LABELS[location.category]}
    </span>
  );
}

/** Card for the tile view. The whole card is clickable via the name link. */
export function LocationTile({
  location,
  editAccess,
}: {
  location: Location;
  editAccess: EditAccess;
}) {
  return (
    <li
      className="relative flex flex-col overflow-hidden rounded-md border border-border bg-background border-t-4 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
      style={{ borderTopColor: CATEGORY_COLORS[location.category] }}
    >
      {location.thumb_url && (
        <img
          src={location.thumb_url}
          alt=""
          loading="lazy"
          className="aspect-[4/3] w-full bg-muted object-cover"
        />
      )}
      <div className="flex flex-col gap-1.5 p-3">
        <span className="flex flex-wrap items-center gap-2">
          <CategoryLabel location={location} />
          <StatusBadge location={location} />
        </span>
        <h2 className="text-base font-semibold leading-snug">
          <Link
            href={href(location)}
            className="link outline-none after:absolute after:inset-0"
          >
            {location.name}
          </Link>
        </h2>
        {location.address && (
          <p className="text-sm text-muted-foreground">{location.address}</p>
        )}
        {location.schedules.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {location.schedules.map(formatScheduleShort).join(' · ')}
          </p>
        )}
        {/* relative z-10: above the name link's full-card click overlay. */}
        <EditLink
          access={editAccess}
          id={location.id}
          className="relative z-10 inline-flex min-h-11 items-center self-start text-sm"
        />
      </div>
    </li>
  );
}

/** Compact row for the list view. */
export function LocationRow({
  location,
  editAccess,
}: {
  location: Location;
  editAccess: EditAccess;
}) {
  return (
    <li className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-center sm:gap-4">
      <Link
        href={href(location)}
        className="link inline-flex min-h-11 items-center font-medium sm:w-1/3 sm:shrink-0"
      >
        {location.name}
      </Link>
      <span className="flex items-center gap-2 sm:w-56 sm:shrink-0">
        <CategoryLabel location={location} />
        <StatusBadge location={location} />
      </span>
      {location.address && (
        <span className="text-sm text-muted-foreground">
          {location.address}
        </span>
      )}
      <EditLink
        access={editAccess}
        id={location.id}
        className="inline-flex min-h-11 items-center text-sm sm:ml-auto"
      />
    </li>
  );
}
