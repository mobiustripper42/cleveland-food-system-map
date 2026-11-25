import type { ReactNode } from 'react';
import { CategoryIcon } from '@/components/locations/category-icon';
import { directionsUrl, formatSchedule } from '@/lib/format';
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  CATEGORY_ON_COLORS,
} from '@/lib/locations';
import type { Location } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Shared with the panel's own extras (distance, contacts, edit link).
 * 16px on mobile (readable, no iOS zoom), 14px from md up.
 */
export const detailClasses = {
  field: 'my-1 text-base leading-normal text-muted-foreground md:text-sm',
  /** A standalone link on its own line: 44px tall on touch screens. */
  link: 'link inline-flex min-h-11 items-center md:min-h-8',
};

/**
 * Public details for one location. No hooks — renders inside the map's
 * client panel and on the server-rendered /locations/[id] page.
 * `meta` goes under the name; `children` after the notes.
 */
export default function LocationDetails({
  location,
  heading: Heading = 'h2',
  meta,
  children,
  bodyClassName,
}: {
  location: Location;
  heading?: 'h1' | 'h2';
  meta?: ReactNode;
  children?: ReactNode;
  bodyClassName?: string;
}) {
  const directions = directionsUrl(location);

  return (
    <>
      {location.image_url && (
        // Decorative here: the name heading follows. Fixed aspect box so
        // the text doesn't jump when the image loads.
        <img
          src={location.image_url}
          alt=""
          loading="lazy"
          decoding="async"
          className="block aspect-[16/9] max-h-[200px] w-full bg-muted object-cover"
        />
      )}

      <div className={cn('px-4 pb-5 pt-3.5', bodyClassName)}>
        <span
          className="mb-2 inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-semibold uppercase tracking-wide"
          style={{
            backgroundColor: CATEGORY_COLORS[location.category],
            color: CATEGORY_ON_COLORS[location.category],
          }}
        >
          <CategoryIcon category={location.category} className="size-3.5" />
          {CATEGORY_LABELS[location.category]}
        </span>

        {/* pr-12: clear of the panel's close button. */}
        <Heading className="mb-2 pr-12 text-lg font-semibold leading-snug text-foreground">
          {location.name}
        </Heading>

        {meta}

        {directions && (
          <p className={detailClasses.field}>
            <a
              href={directions}
              target="_blank"
              rel="noopener noreferrer"
              className={detailClasses.link}
            >
              {location.address ?? 'Get directions'}
            </a>
          </p>
        )}

        {location.website && (
          <p className={detailClasses.field}>
            <a
              href={location.website}
              target="_blank"
              rel="noopener noreferrer"
              className={detailClasses.link}
            >
              Website
            </a>
          </p>
        )}

        {location.schedules.length > 0 && (
          <ul className="mt-3 list-none p-0" aria-label="Hours">
            {location.schedules.map((s) => (
              <li key={s.id} className={detailClasses.field}>
                {formatSchedule(s)}
              </li>
            ))}
          </ul>
        )}

        {location.notes && (
          <p
            className={cn(
              detailClasses.field,
              'mt-3 whitespace-pre-line [overflow-wrap:anywhere]',
            )}
          >
            {location.notes}
          </p>
        )}

        {children}
      </div>
    </>
  );
}
