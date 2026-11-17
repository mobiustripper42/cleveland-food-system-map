import { useEffect, useRef } from 'react';
import useIsDesktop from '@/hooks/use-is-desktop';
import { distanceMiles, formatMiles, type UserPosition } from '@/lib/geo';
import EditLink from '@/components/locations/edit-link';
import EditorSection from '@/components/locations/editor-section';
import LocationDetails from '@/components/locations/location-details';
import type { EditAccess, EditorContacts, Location } from '@/lib/types';

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
          <EditorSection contacts={contacts} locationId={location.id} />
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
};
