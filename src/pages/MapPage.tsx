import { useState } from 'react';
import useLocations from '../hooks/useLocations';
import MapView from '../components/MapView';
import CategoryFilter from '../components/CategoryFilter';
import type { Category } from '../lib/types';

const ALL_CATEGORIES: Category[] = ['garden', 'farm', 'market'];

export default function MapPage() {
  const { locations, loading } = useLocations();
  const [activeCategories, setActiveCategories] = useState<Category[]>(ALL_CATEGORIES);

  const counts: Record<Category, number> = {
    garden: locations.filter((l) => l.category === 'garden').length,
    farm:   locations.filter((l) => l.category === 'farm').length,
    market: locations.filter((l) => l.category === 'market').length,
  };

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
