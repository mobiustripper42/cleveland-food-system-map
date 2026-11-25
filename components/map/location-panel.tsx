import Link from 'next/link';
import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import useIsDesktop from '@/hooks/use-is-desktop';
import { distanceMiles, formatMiles, type UserPosition } from '@/lib/geo';
import EditLink from '@/components/locations/edit-link';
import EditorSection from '@/components/locations/editor-section';
import LocationDetails, {
  detailClasses,
} from '@/components/locations/location-details';
import { SEARCH_INPUT_ID } from '@/components/map/search-bar';
import type { EditAccess, EditorContacts, Location } from '@/lib/types';

interface Props {
  location: Location | null;
  contacts: EditorContacts;
  editAccess: EditAccess;
  userPosition: UserPosition | null;
  onClose: () => void;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Mobile: a modal bottom sheet (backdrop, focus trapped, Escape closes).
 * Desktop: a sidebar over the map's left edge, inside the map area, so it
 * covers neither the header nor the map controls (top-right). Not modal —
 * the map stays usable beside it.
 */
export default function LocationPanel({
  location,
  contacts,
  editAccess,
  userPosition,
  onClose,
}: Props) {
  const isDesktop = useIsDesktop();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<Element | null>(null);
  const open = location !== null;

  useEffect(() => {
    if (open) {
      // Keep the original opener when switching between locations.
      if (!panelRef.current?.contains(document.activeElement)) {
        previousFocusRef.current = document.activeElement;
      }
      closeRef.current?.focus();
      return;
    }
    const prev = previousFocusRef.current;
    previousFocusRef.current = null;
    // The opener (a pin) may have been filtered off the map since.
    if (prev instanceof HTMLElement && prev.isConnected) prev.focus();
    else if (prev) document.getElementById(SEARCH_INPUT_ID)?.focus();
  }, [open, location?.id]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      // Mobile sheet is modal: keep Tab inside it.
      if (e.key !== 'Tab' || isDesktop || !panelRef.current) return;
      const items = [
        ...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, isDesktop, onClose]);

  if (!location) return null;

  const distance =
    userPosition && location.lat !== null && location.lng !== null
      ? distanceMiles(userPosition, { lat: location.lat, lng: location.lng })
      : null;

  return (
    <>
      {/* Mobile only: dimmed backdrop, tap to close. */}
      <div
        className="fixed inset-0 z-[1100] bg-black/30 md:hidden"
        onClick={onClose}
        aria-hidden
      />

      <div
        ref={panelRef}
        {...(isDesktop
          ? { role: 'complementary', 'aria-label': `Details: ${location.name}` }
          : {
              role: 'dialog',
              'aria-modal': true,
              'aria-label': location.name,
            })}
        className="fixed inset-x-0 bottom-0 z-[1200] max-h-[60dvh] overflow-y-auto rounded-t-xl bg-background pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_16px_rgba(0,0,0,0.15)] md:absolute md:inset-y-0 md:left-0 md:right-auto md:max-h-none md:w-80 md:rounded-none md:pb-0 md:shadow-[2px_0_16px_rgba(0,0,0,0.15)]"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-1 top-1 z-[1] flex size-11 cursor-pointer items-center justify-center rounded-md bg-background/80 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X aria-hidden className="size-6" />
        </button>

        <LocationDetails
          location={location}
          meta={
            distance !== null && (
              <p className={detailClasses.field}>
                {formatMiles(distance)} away (straight line)
              </p>
            )
          }
        >
          <div className="mt-3 flex flex-wrap gap-x-6">
            <Link
              href={`/locations/${location.id}`}
              className={detailClasses.link}
            >
              Full page
            </Link>
            {/* Outside EditorSection: owners can edit but aren't editors. */}
            <EditLink
              access={editAccess}
              id={location.id}
              className={detailClasses.link}
            />
          </div>
          <EditorSection contacts={contacts} locationId={location.id} />
        </LocationDetails>
      </div>
    </>
  );
}
