import 'server-only';
import { and, asc, eq, ne, type SQL } from 'drizzle-orm';
import { cacheLife, cacheTag } from 'next/cache';
import { cache } from 'react';
import { formatAddress } from '@/lib/address';
import { publicFileUrl } from '@/lib/r2';
import { getSession } from '@/lib/session';
import { asUser, db, type Tx } from './index';
import {
  contacts,
  editors,
  locationContacts,
  locationFiles,
  locationOwners,
  locations,
  marketSchedules,
  siteSections,
  user,
} from './schema';
import {
  isSectionKey,
  sanitizeSectionHtml,
  SECTION_KEYS,
  type SectionKey,
} from '@/lib/sections';

/** Expire with updateTag() after any write that changes the public map. */
export const LOCATIONS_TAG = 'locations';

// Columns shared by the public and managed lists: no audit or PII columns.
const locationColumns = {
  id: locations.id,
  name: locations.name,
  category: locations.category,
  status: locations.status,
  lat: locations.lat,
  lng: locations.lng,
  street: locations.street,
  city: locations.city,
  state: locations.state,
  zip: locations.zip,
  website: locations.website,
  notes: locations.notes,
};

const scheduleColumns = {
  id: marketSchedules.id,
  location_id: marketSchedules.location_id,
  day_of_week: marketSchedules.day_of_week,
  opens_at: marketSchedules.opens_at,
  closes_at: marketSchedules.closes_at,
  season_start: marketSchedules.season_start,
  season_end: marketSchedules.season_end,
  notes: marketSchedules.notes,
};

const profileColumns = {
  location_id: locationFiles.location_id,
  path: locationFiles.path,
  thumb_path: locationFiles.thumb_path,
  width: locationFiles.width,
  height: locationFiles.height,
};

/** Public URLs for a profile row (thumb falls back to the full image). */
function profileUrls(
  p: { path: string; thumb_path: string | null } | undefined,
) {
  return {
    image_url: p ? publicFileUrl(p.path) : null,
    thumb_url: p ? publicFileUrl(p.thumb_path ?? p.path) : null,
  };
}

/** Selects locations + schedules + profile image matching `where`, shaped for the UI. */
async function selectLocations(q: Tx | typeof db, where: SQL) {
  const [rows, schedules, profiles] = await Promise.all([
    q
      .select(locationColumns)
      .from(locations)
      .where(where)
      .orderBy(asc(locations.name)),
    q
      .select(scheduleColumns)
      .from(marketSchedules)
      .innerJoin(locations, eq(marketSchedules.location_id, locations.id))
      .where(where)
      .orderBy(asc(marketSchedules.day_of_week), asc(marketSchedules.opens_at)),
    q
      .select(profileColumns)
      .from(locationFiles)
      .innerJoin(locations, eq(locationFiles.location_id, locations.id))
      .where(and(where, eq(locationFiles.type, 'profile'))),
  ]);

  const profileBy = new Map(profiles.map((p) => [p.location_id, p]));
  return rows.map(({ street, city, state, zip, ...loc }) => ({
    ...loc,
    address: formatAddress({ street, city, state, zip }),
    ...profileUrls(profileBy.get(loc.id)),
    schedules: schedules.filter((s) => s.location_id === loc.id),
  }));
}

/** Public map data: published locations + schedules, no audit or PII columns. */
export async function getPublishedLocations() {
  'use cache';
  cacheLife('minutes');
  cacheTag(LOCATIONS_TAG);
  return selectLocations(db, eq(locations.status, 'published'));
}

/**
 * Draft and archived locations the request may edit — all of them for
 * editors, their own for owners, [] when signed out. Read through asUser so
 * RLS decides. Reads the session: never call inside 'use cache'.
 */
export async function getManagedLocations() {
  const userId = (await getSession())?.user.id;
  if (!userId) return [];
  return asUser(userId, (tx) =>
    selectLocations(tx, ne(locations.status, 'published')),
  );
}

/** Expire with updateTag() after saving a site section. */
export const SECTIONS_TAG = 'site-sections';

/**
 * Sanitized HTML per page slot; missing or empty rows → ''. Public.
 * Cached for the max lifetime (30-day revalidate): saveSection() expires it
 * with updateTag(SECTIONS_TAG). Edits made outside the app (SQL console) won't
 * show until then — redeploy or save from /admin/sections to refresh.
 */
export async function getSiteSections(): Promise<Record<SectionKey, string>> {
  'use cache';
  cacheLife('max');
  cacheTag(SECTIONS_TAG);

  const rows = await db
    .select({ key: siteSections.key, html: siteSections.html })
    .from(siteSections);

  const out = Object.fromEntries(SECTION_KEYS.map((k) => [k, ''])) as Record<
    SectionKey,
    string
  >;
  for (const { key, html } of rows) {
    if (isSectionKey(key)) out[key] = sanitizeSectionHtml(html);
  }
  return out;
}

/** Raw (stored) section HTML for the editor form, or null unless an editor. */
export async function getEditorSections() {
  if (!(await isEditor())) return null;
  const rows = await db
    .select({ key: siteSections.key, html: siteSections.html })
    .from(siteSections);
  return Object.fromEntries(
    SECTION_KEYS.map((k) => [k, rows.find((r) => r.key === k)?.html ?? '']),
  ) as Record<SectionKey, string>;
}

/**
 * Whether the request comes from an editor. Reads the session cookie: never
 * call inside 'use cache'. Deduped per request.
 */
export const isEditor = cache(async (): Promise<boolean> => {
  const userId = (await getSession())?.user.id;
  if (!userId) return false;

  const [editor] = await db
    .select({ user_id: editors.user_id })
    .from(editors)
    .where(eq(editors.user_id, userId));
  return Boolean(editor);
});

/**
 * Manager contacts for published locations, keyed by location id — or null
 * unless the request comes from an editor. Mirrors the contacts RLS policy,
 * but `db` bypasses RLS, so this editor check is the only thing keeping PII
 * off the page.
 */
export async function getEditorContacts() {
  if (!(await isEditor())) return null;

  const rows = await db
    .select({
      location_id: locationContacts.location_id,
      id: contacts.id,
      name: contacts.name,
      phone: contacts.phone,
      email: contacts.email,
    })
    .from(locationContacts)
    .innerJoin(contacts, eq(locationContacts.contact_id, contacts.id))
    .innerJoin(
      locations,
      and(
        eq(locationContacts.location_id, locations.id),
        eq(locations.status, 'published'),
      ),
    )
    .orderBy(asc(contacts.name));

  const byLocation: Record<
    string,
    Omit<(typeof rows)[number], 'location_id'>[]
  > = {};
  for (const { location_id, ...contact } of rows) {
    (byLocation[location_id] ??= []).push(contact);
  }
  return byLocation;
}

/** Editors with their account name/email, or null unless an editor. */
export async function getEditors() {
  if (!(await isEditor())) return null;
  return db
    .select({
      user_id: editors.user_id,
      name: user.name,
      email: user.email,
      created_at: editors.created_at,
    })
    .from(editors)
    .innerJoin(user, eq(editors.user_id, user.id))
    .orderBy(asc(user.email));
}

/**
 * Which locations the request may edit: 'all' for editors, else the ids it
 * owns ([] when signed out). Reads the session: never call inside 'use cache'.
 * Hiding edit links is UX — the edit page and updateLocation check again.
 */
export const getEditAccess = cache(async (): Promise<'all' | string[]> => {
  const userId = (await getSession())?.user.id;
  if (!userId) return [];
  if (await isEditor()) return 'all';
  const rows = await db
    .select({ id: locationOwners.location_id })
    .from(locationOwners)
    .where(eq(locationOwners.user_id, userId));
  return rows.map((r) => r.id);
});

export async function canEditLocation(id: string): Promise<boolean> {
  const access = await getEditAccess();
  return access === 'all' || access.includes(id);
}

/**
 * The full row (any status) for the edit form, or null if the caller can't
 * edit it. Read through asUser so RLS (editor or owner) decides; owners are
 * listed for editors only.
 */
export async function getLocationForEdit(id: string) {
  const session = await getSession();
  if (!session) return null;

  const [[row], [profile]] = await asUser(session.user.id, (tx) =>
    Promise.all([
      tx
        .select({
          id: locations.id,
          name: locations.name,
          category: locations.category,
          status: locations.status,
          lat: locations.lat,
          lng: locations.lng,
          street: locations.street,
          city: locations.city,
          state: locations.state,
          zip: locations.zip,
          ward: locations.ward,
          website: locations.website,
          notes: locations.notes,
        })
        .from(locations)
        .where(eq(locations.id, id)),
      tx
        .select(profileColumns)
        .from(locationFiles)
        .where(
          and(
            eq(locationFiles.location_id, id),
            eq(locationFiles.type, 'profile'),
          ),
        ),
    ]),
  );
  if (!row) return null;

  const editor = await isEditor();
  // A row visible through RLS is editable: select and update policies match.
  // `user` has no app_user grants, hence db (owner) after the editor check.
  const owners = editor
    ? await db
        .select({ user_id: user.id, name: user.name, email: user.email })
        .from(locationOwners)
        .innerJoin(user, eq(locationOwners.user_id, user.id))
        .where(eq(locationOwners.location_id, id))
        .orderBy(asc(user.email))
    : null;

  const image = profile
    ? { ...profileUrls(profile), width: profile.width, height: profile.height }
    : null;
  return { location: row, image, editor, owners };
}

/**
 * The signed-in user's own contact (their profile), or null. Read through
 * asUser so the contacts_select_self policy decides.
 */
export async function getOwnContact(userId: string) {
  const [row] = await asUser(userId, (tx) =>
    tx
      .select({
        id: contacts.id,
        name: contacts.name,
        phone: contacts.phone,
        email: contacts.email,
      })
      .from(contacts)
      .where(eq(contacts.user_id, userId)),
  );
  return row ?? null;
}
