'use server';

import { updateTag } from 'next/cache';
import { type AddressParts, STATE_PATTERN, ZIP_PATTERN } from '@/lib/address';
import { asUser } from '@/lib/db';
import { isEditor, LOCATIONS_TAG } from '@/lib/db/queries';
import { locations } from '@/lib/db/schema';
import { geocodeAddress, outsideCleveland } from '@/lib/geocode';
import {
  LOCATION_LIMITS,
  type LocationField,
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

  // Blank coordinates + an address → try to pin it, never block the save.
  const values = { ...parsed.values };
  let geocoded: 'found' | 'not-found' | null = null;
  if (values.lat == null && values.street) {
    const match = await geocodeAddress(values as AddressParts).catch(
      () => null,
    );
    if (match) {
      values.lat = match.lat;
      values.lng = match.lng;
      geocoded = 'found';
    } else {
      geocoded = 'not-found';
    }
  }

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
): Promise<FindCoordinatesResult> {
  if (!(await getSession())) {
    return { status: 'error', message: 'Sign in again.' };
  }
  if (!(await isEditor())) return { status: 'error', message: 'Not allowed.' };

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
