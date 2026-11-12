import type { ReactNode } from 'react';
import { directionsUrl, formatSchedule } from '@/lib/format';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '@/lib/locations';
import type { Location } from '@/lib/types';

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
  bodyStyle,
}: {
  location: Location;
  heading?: 'h1' | 'h2';
  meta?: ReactNode;
  children?: ReactNode;
  bodyStyle?: React.CSSProperties;
}) {
  const directions = directionsUrl(location);

  return (
    <>
      {location.image_url && (
        <img
          src={location.image_url}
          alt={location.name}
          style={styles.image}
        />
      )}

      <div style={{ ...styles.body, ...bodyStyle }}>
        <span
          style={{
            ...styles.tag,
            backgroundColor: CATEGORY_COLORS[location.category],
          }}
        >
          {CATEGORY_LABELS[location.category]}
        </span>

        <Heading style={styles.name}>{location.name}</Heading>

        {meta}

        {directions && (
          <p style={styles.field}>
            <a
              href={directions}
              target="_blank"
              rel="noopener noreferrer"
              style={detailStyles.link}
            >
              {location.address ?? 'Get directions'}
            </a>
          </p>
        )}

        {location.website && (
          <p style={styles.field}>
            <a
              href={location.website}
              target="_blank"
              rel="noopener noreferrer"
              style={detailStyles.link}
            >
              Website
            </a>
          </p>
        )}

        {location.schedules.length > 0 && (
          <ul style={styles.hours} aria-label="Hours">
            {location.schedules.map((s) => (
              <li key={s.id} style={styles.field}>
                {formatSchedule(s)}
              </li>
            ))}
          </ul>
        )}

        {location.notes && (
          <p style={{ ...styles.field, marginTop: 12, whiteSpace: 'pre-line' }}>
            {location.notes}
          </p>
        )}

        {children}
      </div>
    </>
  );
}

/** Shared with the panel's own extras (distance, contacts). */
export const detailStyles = {
  field: {
    margin: '4px 0',
    fontSize: 14,
    color: '#6b6375',
    lineHeight: 1.5,
  },
  // Tailwind preflight strips link color + underline; restore both.
  // #1d4ed8 on white is ~6.7:1, passes WCAG AA for body text.
  link: {
    color: '#1d4ed8',
    textDecoration: 'underline',
    textUnderlineOffset: 2,
  },
} satisfies Record<string, React.CSSProperties>;

const styles: Record<string, React.CSSProperties> = {
  image: {
    width: '100%',
    maxHeight: 180,
    objectFit: 'cover',
    display: 'block',
  },
  body: {
    padding: '14px 16px 20px',
  },
  tag: {
    display: 'inline-block',
    color: '#fff',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    padding: '3px 8px',
    borderRadius: 4,
    marginBottom: 8,
  },
  name: {
    margin: '0 0 8px',
    fontSize: 18,
    fontWeight: 600,
    color: '#08060d',
    paddingRight: 24,
  },
  field: detailStyles.field,
  hours: {
    listStyle: 'none',
    margin: '12px 0 0',
    padding: 0,
  },
};
