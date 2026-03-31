import { useEffect, useState } from 'react';
import useLocations from '../hooks/useLocations';
import MapView from '../components/MapView';
import CategoryFilter from '../components/CategoryFilter';
import type { Category } from '../lib/types';

const ALL_CATEGORIES: Category[] = ['garden', 'farm', 'market'];

export default function MapPage() {
  const { locations, loading } = useLocations();
  const [activeCategories, setActiveCategories] = useState<Category[]>(ALL_CATEGORIES);

  // Leaflet zoom buttons are <a href="#"> elements. On mobile, tapping one
  // triggers a hashchange navigation which React Router treats as a location
  // change, remounting this component and resetting loading state. Strip the
  // hash immediately so the router never sees it as a navigation.
  useEffect(() => {
    function clearHash() {
      window.history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search
      );
    }
    window.addEventListener('hashchange', clearHash);
    return () => window.removeEventListener('hashchange', clearHash);
  }, []);

  const counts: Record<Category, number> = {
    garden: locations.filter((l) => l.category === 'garden').length,
    farm:   locations.filter((l) => l.category === 'farm').length,
    market: locations.filter((l) => l.category === 'market').length,
  };

  // Do not gate the entire render on loading — if this component remounts
  // for any reason, the filter strip must stay visible immediately.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <CategoryFilter
        activeCategories={activeCategories}
        counts={counts}
        onChange={setActiveCategories}
      />
      {!loading && (
        <MapView locations={locations} activeCategories={activeCategories} />
      )}
    </div>
  );
}
