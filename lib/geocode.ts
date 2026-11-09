/**
 * US Census geocoder: free, no key, US addresses only. Shared by the admin
 * location form (server action) and scripts/import-kml.ts, so no
 * `server-only` and no `@/` imports.
 *
 * Tolerates venue prefixes in one-line input; misses bare place names
 * ("Shaker Square…"), which stay unpinned for an editor to fix.
 */
import { type AddressParts, formatAddress } from './address.ts';

export type GeocodeMatch = { lat: number; lng: number; matched: string };

const BASE = 'https://geocoding.geo.census.gov/geocoder/locations';

async function census(
  endpoint: 'onelineaddress' | 'address',
  params: Record<string, string>,
): Promise<GeocodeMatch | null> {
  const url = new URL(`${BASE}/${endpoint}`);
  url.search = new URLSearchParams({
    ...params,
    benchmark: 'Public_AR_Current',
    format: 'json',
  }).toString();
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`geocoder HTTP ${res.status}`);
  const body = (await res.json()) as {
    result: {
      addressMatches: {
        matchedAddress: string;
        coordinates: { x: number; y: number };
      }[];
    };
  };
  const match = body.result.addressMatches[0];
  return match
    ? {
        lat: match.coordinates.y,
        lng: match.coordinates.x,
        matched: match.matchedAddress,
      }
    : null;
}

export function geocodeOneLine(address: string) {
  return census('onelineaddress', { address });
}

/** Structured lookup; falls back to one-line when only the street is set. */
export function geocodeAddress(a: AddressParts) {
  if (!a.street) return Promise.resolve(null);
  if (!a.city && !a.zip) return geocodeOneLine(formatAddress(a)!);
  return census('address', {
    street: a.street,
    ...(a.city && { city: a.city }),
    ...(a.state && { state: a.state }),
    ...(a.zip && { zip: a.zip }),
  });
}

// Rough Cleveland-area box, for "is this pin plausible?" warnings.
export function outsideCleveland(lat: number, lng: number): boolean {
  return lat < 41.35 || lat > 41.6 || lng < -82.0 || lng > -81.45;
}
