import 'leaflet/dist/leaflet.css';
import { DivIcon } from 'leaflet';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import useLocations from '../hooks/useLocations';
import type { Category } from '../lib/types';

const CATEGORY_COLOR: Record<Category, string> = {
  garden: '#3a7d44',
  farm:   '#c0392b',
  market: '#7b2d8b',
};

function makePinIcon(category: Category): DivIcon {
  const color = CATEGORY_COLOR[category];
  // Teardrop: circle body tapering to a downward point
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32" width="24" height="32">` +
    `<path d="M12 0C7.58 0 4 3.58 4 8c0 5.25 8 16 8 16s8-10.75 8-16c0-4.42-3.58-8-8-8z"` +
    ` fill="${color}" stroke="rgba(0,0,0,0.25)" stroke-width="1"/>` +
    `</svg>`;
  return new DivIcon({
    html: svg,
    className: '',        // suppress default leaflet-div-icon white box
    iconSize: [24, 32],
    iconAnchor: [12, 32], // tip of the pin sits on the coordinate
  });
}

// Pre-built — one icon instance per category, not per marker
const PIN_ICONS: Record<Category, DivIcon> = {
  garden: makePinIcon('garden'),
  farm:   makePinIcon('farm'),
  market: makePinIcon('market'),
};

const CLEVELAND: [number, number] = [41.482, -81.668];

export default function MapView() {
  const { locations, loading } = useLocations();

  if (loading) return null;

  return (
    <MapContainer
      center={CLEVELAND}
      zoom={12}
      style={{ height: 'calc(100vh - 56px)', width: '100%' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {locations
        .filter((loc) => loc.lat !== null && loc.lng !== null)
        .map((loc) => (
          <Marker
            key={loc.id}
            position={[loc.lat as number, loc.lng as number]}
            icon={PIN_ICONS[loc.category]}
          />
        ))}
    </MapContainer>
  );
}
