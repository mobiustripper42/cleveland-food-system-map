/**
 * Location form rules, shared by the admin form (client) and its server
 * action. Mirrors the DB checks on `locations` so editors get field errors
 * instead of constraint violations. Type-only schema imports keep Drizzle out
 * of the client bundle.
 */
import type { locations, locationStatus } from '@/lib/db/schema';
import type { Category } from '@/src/lib/types';
import { STATE_PATTERN, ZIP_PATTERN } from './address';

export type LocationStatus = (typeof locationStatus.enumValues)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  garden: 'Community Garden',
  farm: 'Urban Farm',
  market: 'Farmers Market / Farm Stand',
};

export const STATUS_LABELS: Record<LocationStatus, string> = {
  draft: 'Draft — hidden from the map',
  published: 'Published — on the map',
  archived: 'Archived',
};

export const LOCATION_FIELDS = [
  'name',
  'category',
  'status',
  'lat',
  'lng',
  'street',
  'city',
  'state',
  'zip',
  'ward',
  'website',
  'notes',
] as const;
export type LocationField = (typeof LOCATION_FIELDS)[number];

export const LOCATION_LIMITS = {
  name: 200,
  street: 200,
  city: 100,
  website: 500,
  notes: 5000,
} as const;

export type LocationInput = Pick<typeof locations.$inferInsert, LocationField>;

export type ParseResult =
  | { ok: true; values: LocationInput }
  | { ok: false; errors: Partial<Record<LocationField, string>> };

const isKey = <T extends string>(map: Record<T, string>, v: string): v is T =>
  Object.hasOwn(map, v);

export function parseLocationForm(formData: FormData): ParseResult {
  const errors: Partial<Record<LocationField, string>> = {};
  const str = (f: LocationField) => {
    const v = formData.get(f);
    return typeof v === 'string' ? v.trim() : '';
  };
  const optional = (f: keyof typeof LOCATION_LIMITS) => {
    const v = str(f);
    if (v.length > LOCATION_LIMITS[f]) {
      errors[f] = `Max ${LOCATION_LIMITS[f].toLocaleString()} characters.`;
    }
    return v || null;
  };
  const coord = (f: 'lat' | 'lng', max: number) => {
    const v = str(f);
    if (!v) return null;
    const n = Number(v);
    if (!Number.isFinite(n) || Math.abs(n) > max) {
      errors[f] = `Must be a number between -${max} and ${max}.`;
      return null;
    }
    return n;
  };

  const name = optional('name');
  if (!name) errors.name = 'Required.';

  const category = str('category');
  if (!isKey(CATEGORY_LABELS, category)) errors.category = 'Pick a category.';

  const status = str('status') || 'draft';
  if (!isKey(STATUS_LABELS, status)) errors.status = 'Pick a status.';

  const lat = coord('lat', 90);
  const lng = coord('lng', 180);
  if (!errors.lat && !errors.lng && (lat === null) !== (lng === null)) {
    errors[lat === null ? 'lat' : 'lng'] =
      'Enter both latitude and longitude, or neither.';
  }

  const wardRaw = str('ward');
  let ward: number | null = null;
  if (wardRaw) {
    ward = Number(wardRaw);
    if (!Number.isInteger(ward) || ward < 1 || ward > 32767) {
      errors.ward = 'Must be a whole number of 1 or more.';
    }
  }

  const website = optional('website');
  if (website && !errors.website) {
    let ok = false;
    try {
      ok = ['http:', 'https:'].includes(new URL(website).protocol);
    } catch {}
    if (!ok) errors.website = 'Must start with https:// or http://.';
  }

  const street = optional('street');
  const city = optional('city');
  const state = str('state').toUpperCase() || null;
  if (state && !STATE_PATTERN.test(state)) {
    errors.state = 'Two-letter code, e.g. OH.';
  }
  const zip = str('zip') || null;
  if (zip && !ZIP_PATTERN.test(zip)) errors.zip = '5 digits, e.g. 44113.';
  const notes = optional('notes');

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    values: {
      name: name!,
      category: category as Category,
      status: status as LocationStatus,
      lat,
      lng,
      street,
      city,
      state,
      zip,
      ward,
      website,
      notes,
    },
  };
}
