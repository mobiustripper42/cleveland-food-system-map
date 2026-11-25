import {
  getEditAccess,
  getEditorContacts,
  getPublishedLocations,
} from '@/lib/db/queries';
import MapClient from './MapClient';

export default async function HomePage() {
  return (
    // Explicit height: MapClient's root is flex: 1 and the page scrolls.
    // Mobile: 60dvh, so a one-finger drag outside the map still scrolls the
    // page (on the map it pans). Desktop: one viewport under the header.
    <div className="flex flex-col h-[60dvh] md:h-[calc(100dvh-3.5rem)]">
      <h1 className="sr-only">Cleveland Food System Map</h1>
      <MapClient
        locations={await getPublishedLocations()}
        // Not awaited: the cached map renders immediately and contacts stream in
        // for editors only (read with use() inside LocationPanel).
        contacts={getEditorContacts()}
        // Same: streams in, shows Edit in the panel for editors and owners.
        editAccess={getEditAccess()}
      />
    </div>
  );
}
