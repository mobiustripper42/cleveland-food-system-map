'use client';

import { Suspense, use } from 'react';
import { detailClasses } from '@/components/locations/location-details';
import { formatPhone } from '@/lib/format';
import type { Contact, EditorContacts } from '@/lib/types';

function ContactItem({ contact }: { contact: Contact }) {
  return (
    <li className="mb-2.5">
      {contact.name && (
        <div className="text-base font-semibold text-foreground md:text-sm">
          {contact.name}
        </div>
      )}
      {contact.phone && (
        <div className={detailClasses.field}>
          <a
            href={`tel:${contact.phone.split(' x')[0]}`}
            className={detailClasses.link}
          >
            {formatPhone(contact.phone)}
          </a>
        </div>
      )}
      {contact.email && (
        <div className={detailClasses.field}>
          <a
            href={`mailto:${contact.email}`}
            className={`${detailClasses.link} [overflow-wrap:anywhere]`}
          >
            {contact.email}
          </a>
        </div>
      )}
    </li>
  );
}

// Everything below the rule is editor-only, labelled as such so editors know
// the public doesn't see it. Suspends on the streamed contacts, which are
// null for non-editors.
function Inner({
  contacts,
  locationId,
}: {
  contacts: EditorContacts;
  locationId: string;
}) {
  const byLocation = use(contacts);
  if (byLocation === null) return null;
  const list = byLocation[locationId];
  return (
    <section
      className="mt-4 border-t border-border pt-3"
      aria-labelledby="editor-heading"
    >
      <h3
        id="editor-heading"
        className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        Editors only
      </h3>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Not shown to the public.
      </p>
      {list?.length ? (
        <div className="mt-3.5">
          <h4 className="mb-1.5 text-base font-semibold text-foreground md:text-sm">
            Contacts
          </h4>
          <ul className="list-none p-0">
            {list.map((c) => (
              <ContactItem key={c.id} contact={c} />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Editor-only extras (contacts) for a location — shared by the map panel and
 * /locations/<id>. Pass getEditorContacts() unawaited so cached pages render
 * first; renders nothing for non-editors.
 */
export default function EditorSection(props: {
  contacts: EditorContacts;
  locationId: string;
}) {
  return (
    <Suspense fallback={null}>
      <Inner {...props} />
    </Suspense>
  );
}
