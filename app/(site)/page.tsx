import { getEditorContacts, getPublishedLocations } from '@/lib/db/queries';
import MapClient from './MapClient';

export default async function HomePage() {
  return (
    // Explicit height: MapClient's root is flex: 1 and the page now scrolls.
    // Mobile leaves room above/below to scroll past the map; desktop fills
    // the viewport under the nav.
    <div className="flex flex-col h-[75dvh] md:h-[calc(100dvh-3.5rem)]">
      <MapClient
        locations={await getPublishedLocations()}
        // Not awaited: the cached map renders immediately and contacts stream in
        // for editors only (read with use() inside LocationPanel).
        contacts={getEditorContacts()}
      />
    </div>
  );
}
