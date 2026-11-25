import 'leaflet/dist/leaflet.css';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
import type { UserPosition } from '@/lib/geo';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '@/lib/locations';
import type { Category, Location } from '@/lib/types';

function ZoomControl() {
  const map = useMap();
  return (
    <div style={zoomStyles.group}>
      <button
        aria-label="Zoom in"
        style={zoomStyles.btn}
        onClick={() => map.zoomIn()}
      >
        +
      </button>
      <button
        aria-label="Zoom out"
        style={{ ...zoomStyles.btn, borderTop: '1px solid #ccc' }}
        onClick={() => map.zoomOut()}
      >
        −
      </button>
    </div>
  );
}

const GEO_ERRORS: Record<number, string> = {
  1: 'Location permission denied',
  2: 'Location unavailable',
  3: 'Location request timed out',
};

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
        map.flyTo([next.lat, next.lng], Math.max(map.getZoom(), 15));
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
      <div style={zoomStyles.group}>
        <button
          aria-label="Show my location"
          title="Show my location"
          aria-busy={locating}
          disabled={locating}
          style={{ ...zoomStyles.btn, opacity: locating ? 0.5 : 1 }}
          onClick={locate}
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="7" />
            <circle cx="12" cy="12" r="2" fill="currentColor" />
            <path d="M12 1v4M12 19v4M1 12h4M19 12h4" />
          </svg>
        </button>
      </div>
      <p role="status" style={zoomStyles.status} hidden={!message}>
        {message}
      </p>
      {position && (
        <>
          <Circle
            center={[position.lat, position.lng]}
            radius={position.accuracy}
            interactive={false}
            pathOptions={{ color: '#1d4ed8', weight: 1, fillOpacity: 0.1 }}
          />
          <CircleMarker
            center={[position.lat, position.lng]}
            radius={7}
            interactive={false}
            pathOptions={{
              color: '#fff',
              weight: 2,
              fillColor: '#1d4ed8',
              fillOpacity: 1,
            }}
          />
        </>
      )}
    </>
  );
}

const zoomStyles: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 10,
  },
  group: {
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 1px 5px rgba(0,0,0,0.4)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  btn: {
    width: 30,
    height: 30,
    background: '#fff',
    border: 'none',
    fontSize: 18,
    fontWeight: 700,
    lineHeight: 1,
    cursor: 'pointer',
    color: '#333',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  status: {
    margin: 0,
    padding: '4px 8px',
    background: '#111',
    color: '#fff',
    fontSize: 13,
    borderRadius: 4,
    whiteSpace: 'nowrap',
  },
};

function makePinIcon(category: Category): DivIcon {
  const color = CATEGORY_COLORS[category];
  const label = CATEGORY_LABELS[category];
  // Teardrop: circle body tapering to a downward point
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32" width="24" height="32" role="img" aria-label="${label}">` +
    `<path d="M12 0C7.58 0 4 3.58 4 8c0 5.25 8 16 8 16s8-10.75 8-16c0-4.42-3.58-8-8-8z"` +
    ` fill="${color}" stroke="rgba(0,0,0,0.25)" stroke-width="1"/>` +
    `</svg>`;
  return new DivIcon({
    html: svg,
    className: '', // suppress default leaflet-div-icon white box
    iconSize: [24, 32],
    iconAnchor: [12, 32], // tip of the pin sits on the coordinate
  });
}

// Pre-built — one icon instance per category, not per marker
const PIN_ICONS: Record<Category, DivIcon> = {
  garden: makePinIcon('garden'),
  farm: makePinIcon('farm'),
  market: makePinIcon('market'),
};

const CLEVELAND: LatLngTuple = [41.482, -81.668];
const DEFAULT_ZOOM = 12;

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
// "nearest" chip rather than by tapping its pin).
function PanToSelected({ location }: { location: Location | null }) {
  const map = useMap();
  useEffect(() => {
    if (location?.lat == null || location.lng == null) return;
    const target: [number, number] = [location.lat, location.lng];
    if (!map.getBounds().contains(target)) map.panTo(target);
  }, [map, location]);
  return null;
}

interface Props {
  locations: Location[];
  activeCategories: Category[];
  selectedLocation: Location | null;
  onSelectLocation: (location: Location) => void;
  userPosition: UserPosition | null;
  onLocate: (position: UserPosition) => void;
}

export default function MapView({
  locations,
  activeCategories,
  selectedLocation,
  onSelectLocation,
  userPosition,
  onLocate,
}: Props) {
  const instance = useFreshInstance();
  return (
    <MapContainer
      key={instance.key}
      center={instance.center}
      zoom={instance.zoom}
      zoomControl={false}
      style={{ flex: 1, minHeight: 0, width: '100%' }}
      aria-label="Map of Cleveland food resources"
    >
      <TrackView view={instance.view} />
      <div style={zoomStyles.wrap}>
        <ZoomControl />
        <LocateControl position={userPosition} onLocate={onLocate} />
      </div>
      <PanToSelected location={selectedLocation} />
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
            icon={PIN_ICONS[loc.category]}
            title={loc.name}
            alt={`${CATEGORY_LABELS[loc.category]}: ${loc.name}`}
            eventHandlers={{ click: () => onSelectLocation(loc) }}
          />
        ))}
    </MapContainer>
  );
}
