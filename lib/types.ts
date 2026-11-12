import type { locationCategory } from '@/lib/db/schema';
import type {
  getEditAccess,
  getEditorContacts,
  getLocationForEdit,
  getPublishedLocations,
} from '@/lib/db/queries';

export type Category = (typeof locationCategory.enumValues)[number];

/** A location as the public map receives it (see getPublishedLocations). */
export type Location = Awaited<
  ReturnType<typeof getPublishedLocations>
>[number];
export type MarketSchedule = Location['schedules'][number];
export type NewLocation = Omit<Location, 'id'>;

/** Resolves to null for anyone who isn't an editor. */
export type EditorContacts = ReturnType<typeof getEditorContacts>;
export type Contact = NonNullable<Awaited<EditorContacts>>[string][number];

/** Resolves to 'all' for editors, else the ids of locations the user owns. */
export type EditAccess = ReturnType<typeof getEditAccess>;

export type EditableLocation = NonNullable<
  Awaited<ReturnType<typeof getLocationForEdit>>
>;
export type LocationOwner = NonNullable<EditableLocation['owners']>[number];
