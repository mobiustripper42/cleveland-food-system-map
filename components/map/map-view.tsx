import 'leaflet/dist/leaflet.css';
import { LocateFixed, Minus, Plus } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DivIcon, type LatLngTuple } from 'leaflet';
import {
  Circle,
  CircleMarker,
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import { CATEGORY_GLYPH_SVG } from '@/components/locations/category-icon';
import type { UserPosition } from '@/lib/geo';
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  CATEGORY_ON_COLORS,
} from '@/lib/locations';
import type { Category, Location } from '@/lib/types';

/** 44px map control (touch target), with a visible focus ring. */
const CONTROL_BTN =
  'flex size-11 cursor-pointer touch-manipulation items-center justify-center rounded-md bg-background text-foreground shadow-[0_1px_5px_rgba(0,0,0,0.4)] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-50';

/** The "you are here" dot: link blue, the one non-category color on the map. */
const USER_DOT = 'hsl(224 76% 48%)';

function ZoomControl() {
  const map = useMap();
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-label="Zoom in"
        className={CONTROL_BTN}
        onClick={() => map.zoomIn()}
      >
        <Plus aria-hidden className="size-5" />
      </button>
      <button
        type="button"
        aria-label="Zoom out"
        className={CONTROL_BTN}
        onClick={() => map.zoomOut()}
      >
        <Minus aria-hidden className="size-5" />
      </button>
    </div>
  );
}

const GEO_ERRORS: Record<number, string> = {
  1: 'Location permission denied',
  2: 'Location unavailable',
  3: 'Location request timed out',
};

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// One-shot fix via the Geolocation API (needs HTTPS or localhost). Shows a dot
// plus accuracy radius; the position stays in the browser.
function LocateControl({
  position,
  onLocate,
}: {
  position: UserPosition | null;
  onLocate: (position: UserPosition) => void;
}) {
  const map = useMap();
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(t);
  }, [message]);

  // MapView is ssr:false, so `navigator` is safe here.
  if (!('geolocation' in navigator)) return null;

  const locate = () => {
    setLocating(true);
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const next = {
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: coords.accuracy,
        };
        onLocate(next);
        setLocating(false);
        const zoom = Math.max(map.getZoom(), 15);
        if (prefersReducedMotion()) map.setView([next.lat, next.lng], zoom);
        else map.flyTo([next.lat, next.lng], zoom);
      },
      (err) => {
        setMessage(GEO_ERRORS[err.code] ?? 'Could not get your location');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  return (
    <>
      <button
        type="button"
        aria-label="Show my location"
        title="Show my location"
        aria-busy={locating}
        disabled={locating}
        className={CONTROL_BTN}
        onClick={locate}
      >
        <LocateFixed aria-hidden className="size-5" />
      </button>
      {/* Always mounted so the message is announced. */}
      <p
        role="status"
        className={
          message
            ? 'm-0 max-w-[14rem] rounded-md bg-foreground px-2 py-1 text-right text-sm text-background'
            : 'sr-only'
        }
      >
        {message}
      </p>
      {position && (
        <>
          <Circle
            center={[position.lat, position.lng]}
            radius={position.accuracy}
            interactive={false}
            pathOptions={{ color: USER_DOT, weight: 1, fillOpacity: 0.1 }}
          />
          <CircleMarker
            center={[position.lat, position.lng]}
            radius={7}
            interactive={false}
            pathOptions={{
              color: '#fff',
              weight: 2,
              fillColor: USER_DOT,
              fillOpacity: 1,
            }}
          />
        </>
      )}
    </>
  );
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);

/**
 * Teardrop pin with the category glyph inside, so pins differ by shape as
 * well as color. One icon per marker: the visually hidden name is the
 * marker's accessible name (Leaflet makes the marker a role=button; an `alt`
 * only applies to <img> icons). Selected pins are larger with a dark outline.
 * 32×42 (36×48 selected) keeps the tap target near 44px.
 */
function makePinIcon(
  category: Category,
  name: string,
  selected: boolean,
): DivIcon {
  const color = CATEGORY_COLORS[category];
  const on = CATEGORY_ON_COLORS[category];
  const [w, h] = selected ? [36, 48] : [32, 42];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 42" width="${w}" height="${h}" aria-hidden="true" focusable="false">` +
    `<path d="M16 1C8.27 1 2 7.27 2 15c0 9.6 14 26 14 26s14-16.4 14-26C30 7.27 23.73 1 16 1z"` +
    ` fill="${color}" stroke="${selected ? '#171717' : 'rgba(0,0,0,0.35)'}" stroke-width="${selected ? 2.5 : 1}"/>` +
    `<svg x="7" y="6" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${on}" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">` +
    CATEGORY_GLYPH_SVG[category] +
    `</svg></svg>` +
    // Name comes from the DB: escaped (this is HTML, not React).
    `<span class="sr-only">${escapeHtml(name)}, ${CATEGORY_LABELS[category]}${selected ? ', selected' : ''}</span>`;
  return new DivIcon({
    html: svg,
    className: 'map-pin', // replaces leaflet-div-icon's white box
    iconSize: [w, h],
    iconAnchor: [w / 2, h], // tip of the pin sits on the coordinate
  });
}

const CLEVELAND: LatLngTuple = [41.482, -81.668];
const DEFAULT_ZOOM = 12;
const FOCUS_ZOOM = 15;

type View = { center: LatLngTuple; zoom: number };

// With cacheComponents, Next keeps the map page mounted in a hidden <Activity> when
// you navigate away, tearing down effects and re-running them on return.
// react-leaflet's MapContainer can't survive that: its cleanup removes the
// Leaflet map, and on return it never builds a new one (the map vanished and
// threw "Map container is being reused"). So every teardown bumps a key and
// the next show mounts a fresh MapContainer, restored to the last pan/zoom.
function useFreshInstance() {
  const view = useRef<View>({ center: CLEVELAND, zoom: DEFAULT_ZOOM });
  const [instance, setInstance] = useState({ key: 0, ...view.current });
  useLayoutEffect(
    () => () => setInstance((i) => ({ key: i.key + 1, ...view.current })),
    [],
  );
  return { ...instance, view };
}

// Records the current view so a remount can restore it.
function TrackView({ view }: { view: React.RefObject<View> }) {
  const map = useMapEvents({
    moveend: () => {
      const c = map.getCenter();
      view.current = { center: [c.lat, c.lng], zoom: map.getZoom() };
    },
  });
  return null;
}

// Brings a selection into view when it isn't already (e.g. picked from the
// "nearest" chip rather than by tapping its pin). A selection from the URL
// (deep link, Back/Forward: `focusRequest` changes) also zooms in to it.
function PanToSelected({
  location,
  focusRequest,
}: {
  location: Location | null;
  focusRequest: number;
}) {
  const map = useMap();
  const lastFocus = useRef(0);
  const lat = location?.lat;
  const lng = location?.lng;
  useEffect(() => {
    if (lat == null || lng == null) return;
    const target: [number, number] = [lat, lng];
    const animate = !prefersReducedMotion();
    if (focusRequest !== lastFocus.current) {
      lastFocus.current = focusRequest;
      map.setView(target, Math.max(map.getZoom(), FOCUS_ZOOM), { animate });
    } else if (!map.getBounds().contains(target)) {
      map.panTo(target, { animate });
    }
  }, [map, lat, lng, focusRequest]);
  return null;
}

interface Props {
  locations: Location[];
  activeCategories: Category[];
  selectedLocation: Location | null;
  /** Changes when a selection should zoom in (it came from the URL). */
  focusRequest: number;
  onSelectLocation: (location: Location) => void;
  userPosition: UserPosition | null;
  onLocate: (position: UserPosition) => void;
}

export default function MapView({
  locations,
  activeCategories,
  selectedLocation,
  focusRequest,
  onSelectLocation,
  userPosition,
  onLocate,
}: Props) {
  const instance = useFreshInstance();
  const selectedId = selectedLocation?.id ?? null;
  // ~100 small DivIcons; rebuilt only when the list or selection changes.
  const icons = useMemo(
    () =>
      new Map(
        locations.map((l) => [
          l.id,
          makePinIcon(l.category, l.name, l.id === selectedId),
        ]),
      ),
    [locations, selectedId],
  );

  return (
    <MapContainer
      key={instance.key}
      center={instance.center}
      zoom={instance.zoom}
      zoomControl={false}
      style={{ flex: 1, minHeight: 0, width: '100%' }}
      aria-label="Map of Cleveland food resources. Use arrow keys to pan; Tab reaches each location."
    >
      <TrackView view={instance.view} />
      {/* Top-right: clear of the location panel, which opens on the left. */}
      <div className="absolute right-3 top-3 z-[1000] flex flex-col items-end gap-2">
        <ZoomControl />
        <LocateControl position={userPosition} onLocate={onLocate} />
      </div>
      <PanToSelected location={selectedLocation} focusRequest={focusRequest} />
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {locations
        .filter(
          (loc) =>
            loc.lat !== null &&
            loc.lng !== null &&
            activeCategories.includes(loc.category),
        )
        .map((loc) => (
          <Marker
            key={loc.id}
            position={[loc.lat as number, loc.lng as number]}
            icon={icons.get(loc.id)!}
            title={loc.name}
            zIndexOffset={loc.id === selectedId ? 1000 : 0}
            eventHandlers={{
              click: () => onSelectLocation(loc),
              // Leaflet makes markers focusable buttons but never turns Enter
              // or Space into a click: do it, or keyboard users can't open one.
              keypress: (e) => {
                const key = (e.originalEvent as KeyboardEvent).key;
                if (key === 'Enter' || key === ' ') {
                  e.originalEvent.preventDefault();
                  onSelectLocation(loc);
                }
              },
            }}
          />
        ))}
    </MapContainer>
  );
}
