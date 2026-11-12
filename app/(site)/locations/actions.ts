'use server';

import { and, eq } from 'drizzle-orm';
import { refresh, updateTag } from 'next/cache';
import { type AddressParts, STATE_PATTERN, ZIP_PATTERN } from '@/lib/address';
import { asUser, db } from '@/lib/db';
import { canEditLocation, isEditor, LOCATIONS_TAG } from '@/lib/db/queries';
import { locationOwners, locations } from '@/lib/db/schema';
import { findOrCreateUserByEmail, normalizeEmail } from '@/lib/db/users';
import { geocodeAddress, outsideCleveland } from '@/lib/geocode';
import {
  LOCATION_LIMITS,
  type LocationField,
  type LocationInput,
  parseLocationForm,
} from '@/lib/locations';
import { getSession } from '@/lib/session';

export type CreateLocationState =
  | { status: 'idle' }
  | {
      status: 'saved';
      id: string;
      name: string;
      published: boolean;
      /** Set when coordinates were left blank and looked up on save. */
      geocoded: 'found' | 'not-found' | null;
    }
  | {
      status: 'error';
      message: string;
      errors?: Partial<Record<LocationField, string>>;
    };

// Postgres error codes surfaced through postgres-js (possibly wrapped by Drizzle).
function pgCode(err: unknown): { code?: string; constraint?: string } {
  const e = err as { code?: string; constraint_name?: string; cause?: unknown };
  if (e?.code) return { code: e.code, constraint: e.constraint_name };
  return e?.cause ? pgCode(e.cause) : {};
}

type ErrorState = Extract<CreateLocationState, { status: 'error' }>;

/** Maps RLS/trigger denials and the name+coords unique key; rethrows the rest. */
function writeError(err: unknown): ErrorState {
  const { code, constraint } = pgCode(err);
  if (code === '42501') return { status: 'error', message: 'Not allowed.' };
  if (code === '23505' && constraint === 'locations_name_lat_lng_key') {
    return {
      status: 'error',
      message: 'A location with this name and coordinates already exists.',
      errors: { name: 'Already used at these coordinates.' },
    };
  }
  throw err;
}

/**
 * Blank coordinates + an address → try to pin it, never block the save.
 * Mutates `values`. Callers must have checked edit access (geocoder gate).
 */
async function fillCoordinates(
  values: Pick<LocationInput, 'lat' | 'lng' | keyof AddressParts>,
): Promise<'found' | 'not-found' | null> {
  if (values.lat != null || !values.street) return null;
  // parseLocationForm sets every address field (null when blank).
  const match = await geocodeAddress(values as AddressParts).catch(() => null);
  if (!match) return 'not-found';
  values.lat = match.lat;
  values.lng = match.lng;
  return 'found';
}

export async function createLocation(
  _prev: CreateLocationState,
  formData: FormData,
): Promise<CreateLocationState> {
  const session = await getSession();
  if (!session) return { status: 'error', message: 'Sign in again.' };

  // Checked up front so non-editors can't use the geocoder through us; the
  // insert itself is enforced again by RLS.
  if (!(await isEditor())) return { status: 'error', message: 'Not allowed.' };

  const parsed = parseLocationForm(formData);
  if (!parsed.ok) {
    return {
      status: 'error',
      message: 'Fix the highlighted fields.',
      errors: parsed.errors,
    };
  }

  const values = { ...parsed.values };
  const geocoded = await fillCoordinates(values);

  try {
    // RLS (locations_insert_editor) decides; non-editors raise 42501.
    const [row] = await asUser(session.user.id, (tx) =>
      tx.insert(locations).values(values).returning({ id: locations.id }),
    );
    const published = values.status === 'published';
    if (published) updateTag(LOCATIONS_TAG);
    return {
      status: 'saved',
      id: row!.id,
      name: values.name,
      published,
      geocoded,
    };
  } catch (err) {
    return writeError(err);
  }
}

export type FindCoordinatesResult =
  | {
      status: 'found';
      lat: number;
      lng: number;
      matched: string;
      outside: boolean;
    }
  | { status: 'error'; message: string };

/** Looks up coordinates for the address typed into the location form. */
export async function findCoordinates(
  address: AddressParts,
  /** Lets an owner (non-editor) look up their own location's address. */
  locationId?: string,
): Promise<FindCoordinatesResult> {
  if (!(await getSession())) {
    return { status: 'error', message: 'Sign in again.' };
  }
  const allowed =
    typeof locationId === 'string'
      ? await canEditLocation(locationId)
      : await isEditor();
  if (!allowed) return { status: 'error', message: 'Not allowed.' };

  const clean = (v: unknown, max: number) =>
    typeof v === 'string' ? v.trim().slice(0, max) || null : null;
  const parts: AddressParts = {
    street: clean(address?.street, LOCATION_LIMITS.street),
    city: clean(address?.city, LOCATION_LIMITS.city),
    state: clean(address?.state, 2)?.toUpperCase() ?? null,
    zip: clean(address?.zip, 10),
  };
  if (!parts.street)
    return { status: 'error', message: 'Enter a street first.' };
  if (parts.state && !STATE_PATTERN.test(parts.state)) parts.state = null;
  if (parts.zip && !ZIP_PATTERN.test(parts.zip)) parts.zip = null;

  try {
    const match = await geocodeAddress(parts);
    if (!match) {
      return {
        status: 'error',
        message:
          'No match for that address. Check the street, or enter coordinates by hand.',
      };
    }
    return {
      status: 'found',
      ...match,
      outside: outsideCleveland(match.lat, match.lng),
    };
  } catch {
    return {
      status: 'error',
      message: 'The address lookup service is unavailable. Try again later.',
    };
  }
}

export type UpdateLocationState =
  | { status: 'idle' }
  | { status: 'saved'; name: string; geocoded: 'found' | 'not-found' | null }
  | ErrorState;

/** Edit form submit; bind the location id. Editors or that location's owners. */
export async function updateLocation(
  id: string,
  _prev: UpdateLocationState,
  formData: FormData,
): Promise<UpdateLocationState> {
  const session = await getSession();
  if (!session) return { status: 'error', message: 'Sign in again.' };
  // Checked up front so it also gates the geocoder; RLS enforces it again.
  if (typeof id !== 'string' || !(await canEditLocation(id))) {
    return { status: 'error', message: 'Not allowed.' };
  }

  const parsed = parseLocationForm(formData);
  if (!parsed.ok) {
    return {
      status: 'error',
      message: 'Fix the highlighted fields.',
      errors: parsed.errors,
    };
  }

  // Owners get no status field (it would parse as the 'draft' default), so
  // leave status alone for them. The locations_status_editor_only trigger
  // rejects a change regardless.
  const { status, ...content } = parsed.values;
  const values: Omit<LocationInput, 'status'> & Partial<LocationInput> =
    (await isEditor()) ? { ...content, status } : content;
  const geocoded = await fillCoordinates(values);

  try {
    // RLS (editor or owner update policy) decides; a filtered row → 0 rows.
    const updated = await asUser(session.user.id, (tx) =>
      tx
        .update(locations)
        .set(values)
        .where(eq(locations.id, id))
        .returning({ id: locations.id }),
    );
    if (!updated.length) return { status: 'error', message: 'Not allowed.' };
  } catch (err) {
    return writeError(err);
  }

  // Also covers publish/unpublish; cheap at this size. refresh() re-renders
  // the edit page so the form shows what was stored (geocoded coords etc.).
  updateTag(LOCATIONS_TAG);
  refresh();
  return { status: 'saved', name: values.name, geocoded };
}

export type OwnerActionState =
  | { status: 'idle' }
  | { status: 'done'; message: string }
  | { status: 'error'; message: string };

/** Editors only; bind the location id. Creates a verified user if missing. */
export async function addOwner(
  locationId: string,
  _prev: OwnerActionState,
  formData: FormData,
): Promise<OwnerActionState> {
  const session = await getSession();
  if (!session) return { status: 'error', message: 'Sign in again.' };
  // Checked before touching `user`, which only the owner role can write.
  // The insert below is enforced again by RLS.
  if (!(await isEditor())) return { status: 'error', message: 'Not allowed.' };

  const email = normalizeEmail(formData.get('email'));
  if (!email) return { status: 'error', message: 'Enter a valid email.' };

  const [location] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(eq(locations.id, locationId));
  if (!location) return { status: 'error', message: 'Location not found.' };

  const { id, created } = await findOrCreateUserByEmail(db, email);
  const added = await asUser(session.user.id, (tx) =>
    tx
      .insert(locationOwners)
      .values({ location_id: locationId, user_id: id })
      .onConflictDoNothing()
      .returning({ user_id: locationOwners.user_id }),
  );

  refresh();
  if (!added.length) {
    return { status: 'done', message: `${email} is already an owner.` };
  }
  return {
    status: 'done',
    message: created
      ? `Added ${email}. They can sign in with an emailed code.`
      : `Added ${email}.`,
  };
}

/** Editors only (enforced by RLS); bind the location id. */
export async function removeOwner(
  locationId: string,
  _prev: OwnerActionState,
  formData: FormData,
): Promise<OwnerActionState> {
  const session = await getSession();
  if (!session) return { status: 'error', message: 'Sign in again.' };

  const userId = formData.get('user_id');
  if (typeof userId !== 'string' || !userId) {
    return { status: 'error', message: 'Invalid owner.' };
  }

  // Non-editors match zero rows (owners can see their own row, not delete it).
  const removed = await asUser(session.user.id, (tx) =>
    tx
      .delete(locationOwners)
      .where(
        and(
          eq(locationOwners.location_id, locationId),
          eq(locationOwners.user_id, userId),
        ),
      )
      .returning({ user_id: locationOwners.user_id }),
  );
  if (!removed.length) return { status: 'error', message: 'Not allowed.' };

  refresh();
  return { status: 'done', message: 'Removed.' };
}
