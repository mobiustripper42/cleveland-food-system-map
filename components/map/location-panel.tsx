import { Suspense, use, useEffect, useRef } from 'react';
import useIsDesktop from '@/hooks/use-is-desktop';
import { distanceMiles, formatMiles, type UserPosition } from '@/lib/geo';
import EditLink from '@/components/locations/edit-link';
import LocationDetails from '@/components/locations/location-details';
import { formatPhone } from '@/lib/format';
import type {
  Contact,
  EditAccess,
  EditorContacts,
  Location,
} from '@/lib/types';

function ContactItem({ contact }: { contact: Contact }) {
  return (
    <li style={styles.contact}>
      {contact.name && <div style={styles.contactName}>{contact.name}</div>}
      {contact.phone && (
        <div style={styles.field}>
          <a href={`tel:${contact.phone.split(' x')[0]}`} style={styles.link}>
            {formatPhone(contact.phone)}
          </a>
        </div>
      )}
      {contact.email && (
        <div style={styles.field}>
          <a href={`mailto:${contact.email}`} style={styles.link}>
            {contact.email}
          </a>
        </div>
      )}
    </li>
  );
}

// Suspends on the streamed promise; renders nothing for non-editors (null).
function Contacts({
  contacts,
  locationId,
}: {
  contacts: EditorContacts;
  locationId: string;
}) {
  const list = use(contacts)?.[locationId];
  if (!list?.length) return null;
  return (
    <div style={styles.subsection}>
      <h4 style={styles.subheading}>Contacts</h4>
      <ul style={styles.list}>
        {list.map((c) => (
          <ContactItem key={c.id} contact={c} />
        ))}
      </ul>
    </div>
  );
}

// Everything below the rule is editor-only, labelled as such so editors know
// the public doesn't see it. Suspends on the streamed contacts, which are
// null for non-editors.
function EditorSection({
  contacts,
  location,
}: {
  contacts: EditorContacts;
  location: Location;
}) {
  if (use(contacts) === null) return null;
  return (
    <section style={styles.section} aria-labelledby="editor-heading">
      <h3 id="editor-heading" style={styles.sectionHeading}>
        Editors only
      </h3>
      <p style={styles.sectionNote}>Not shown to the public.</p>
      <Contacts contacts={contacts} locationId={location.id} />
    </section>
  );
}

interface Props {
  location: Location | null;
  contacts: EditorContacts;
  editAccess: EditAccess;
  userPosition: UserPosition | null;
  onClose: () => void;
}

export default function LocationPanel({
  location,
  contacts,
  editAccess,
  userPosition,
  onClose,
}: Props) {
  const isDesktop = useIsDesktop();
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    if (location) {
      previousFocusRef.current = document.activeElement;
      closeRef.current?.focus();
    } else if (previousFocusRef.current instanceof HTMLElement) {
      previousFocusRef.current.focus();
    }
  }, [location]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && location) onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [location, onClose]);

  if (!location) return null;

  const distance =
    userPosition && location.lat !== null && location.lng !== null
      ? distanceMiles(userPosition, { lat: location.lat, lng: location.lng })
      : null;

  const panelStyle: React.CSSProperties = isDesktop
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: 320,
        zIndex: 1200,
        backgroundColor: '#fff',
        overflowY: 'auto',
        boxShadow: '2px 0 16px rgba(0,0,0,0.15)',
      }
    : {
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        maxHeight: '50dvh',
        zIndex: 1200,
        backgroundColor: '#fff',
        overflowY: 'auto',
        borderRadius: '12px 12px 0 0',
        boxShadow: '0 -2px 16px rgba(0,0,0,0.15)',
      };

  return (
    <>
      {/* Mobile only: tap backdrop to close */}
      {!isDesktop && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1100 }}
          onClick={onClose}
          aria-hidden
        />
      )}

      <div
        style={panelStyle}
        role="dialog"
        aria-modal="true"
        aria-label={location.name}
      >
        <button
          ref={closeRef}
          style={styles.close}
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        <LocationDetails
          location={location}
          meta={
            distance !== null && (
              <p style={styles.field}>
                {formatMiles(distance)} away (straight line)
              </p>
            )
          }
        >
          {/* Outside EditorSection: owners can edit but aren't editors. */}
          <EditLink
            access={editAccess}
            id={location.id}
            style={{ ...styles.field, display: 'inline-block', marginTop: 12 }}
          />
          <Suspense fallback={null}>
            <EditorSection contacts={contacts} location={location} />
          </Suspense>
        </LocationDetails>
      </div>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  close: {
    position: 'absolute',
    top: 10,
    right: 12,
    background: 'none',
    border: 'none',
    fontSize: 24,
    lineHeight: 1,
    cursor: 'pointer',
    color: '#6b6375',
    padding: '0 4px',
    zIndex: 1,
  },
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
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  section: {
    marginTop: 16,
    paddingTop: 12,
    borderTop: '1px solid #e5e4e7',
  },
  sectionHeading: {
    margin: 0,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    color: '#6b6375',
  },
  sectionNote: {
    margin: '2px 0 0',
    fontSize: 12,
    color: '#6b6375',
  },
  subsection: {
    marginTop: 14,
  },
  subheading: {
    margin: '0 0 6px',
    fontSize: 14,
    fontWeight: 600,
    color: '#08060d',
  },
  contact: {
    marginBottom: 10,
  },
  contactName: {
    fontSize: 14,
    fontWeight: 600,
    color: '#08060d',
  },
};
