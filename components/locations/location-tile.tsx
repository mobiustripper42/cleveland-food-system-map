import Link from 'next/link';
import { formatScheduleShort } from '@/lib/format';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '@/lib/locations';
import type { EditAccess, Location } from '@/lib/types';
import EditLink from './edit-link';

const LINK = { color: '#1d4ed8' };

export function CategoryLabel({ location }: { location: Location }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600">
      <span
        aria-hidden
        className="inline-block size-2.5 rounded-full shrink-0"
        style={{ backgroundColor: CATEGORY_COLORS[location.category] }}
      />
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
      className="relative flex flex-col overflow-hidden rounded-md border border-neutral-200 bg-white border-t-4 focus-within:ring-2 focus-within:ring-[#1d4ed8]"
      style={{ borderTopColor: CATEGORY_COLORS[location.category] }}
    >
      {location.image_url && (
        <img
          src={location.image_url}
          alt=""
          loading="lazy"
          className="aspect-[4/3] w-full object-cover"
        />
      )}
      <div className="flex flex-col gap-1.5 p-3">
        <CategoryLabel location={location} />
        <h2 className="text-base font-semibold leading-snug">
          <Link
            href={`/locations/${location.id}`}
            className="underline underline-offset-2 outline-none after:absolute after:inset-0"
            style={LINK}
          >
            {location.name}
          </Link>
        </h2>
        {location.address && (
          <p className="text-sm text-neutral-600">{location.address}</p>
        )}
        {location.schedules.length > 0 && (
          <p className="text-sm text-neutral-600">
            {location.schedules.map(formatScheduleShort).join(' · ')}
          </p>
        )}
        {/* relative z-10: above the name link's full-card click overlay. */}
        <EditLink
          access={editAccess}
          id={location.id}
          className="relative z-10 self-start text-sm underline-offset-2"
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
    <li className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-baseline sm:gap-4">
      <Link
        href={`/locations/${location.id}`}
        className="font-medium underline underline-offset-2 sm:w-1/3 sm:shrink-0"
        style={LINK}
      >
        {location.name}
      </Link>
      <span className="sm:w-56 sm:shrink-0">
        <CategoryLabel location={location} />
      </span>
      {location.address && (
        <span className="text-sm text-neutral-600">{location.address}</span>
      )}
      <EditLink
        access={editAccess}
        id={location.id}
        className="text-sm underline-offset-2 sm:ml-auto"
      />
    </li>
  );
}
