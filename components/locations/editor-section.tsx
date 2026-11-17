'use client';

import { Suspense, use } from 'react';
import { detailStyles } from '@/components/locations/location-details';
import { formatPhone } from '@/lib/format';
import type { Contact, EditorContacts } from '@/lib/types';

function ContactItem({ contact }: { contact: Contact }) {
  return (
    <li style={styles.contact}>
      {contact.name && <div style={styles.contactName}>{contact.name}</div>}
      {contact.phone && (
        <div style={detailStyles.field}>
          <a
            href={`tel:${contact.phone.split(' x')[0]}`}
            style={detailStyles.link}
          >
            {formatPhone(contact.phone)}
          </a>
        </div>
      )}
      {contact.email && (
        <div style={detailStyles.field}>
          <a href={`mailto:${contact.email}`} style={detailStyles.link}>
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
    <section style={styles.section} aria-labelledby="editor-heading">
      <h3 id="editor-heading" style={styles.sectionHeading}>
        Editors only
      </h3>
      <p style={styles.sectionNote}>Not shown to the public.</p>
      {list?.length ? (
        <div style={styles.subsection}>
          <h4 style={styles.subheading}>Contacts</h4>
          <ul style={styles.list}>
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

const styles: Record<string, React.CSSProperties> = {
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  section: {
    marginTop: 16,
    paddingTop: 12,
    borderTop: '1px solid #e5e4e7',
  },
  sectionHeading: {
    margin: 0,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    color: '#6b6375',
  },
  sectionNote: {
    margin: '2px 0 0',
    fontSize: 12,
    color: '#6b6375',
  },
  subsection: {
    marginTop: 14,
  },
  subheading: {
    margin: '0 0 6px',
    fontSize: 14,
    fontWeight: 600,
    color: '#08060d',
  },
  contact: {
    marginBottom: 10,
  },
  contactName: {
    fontSize: 14,
    fontWeight: 600,
    color: '#08060d',
  },
};
