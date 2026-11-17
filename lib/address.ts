/**
 * Street address parts, as stored on `locations` (street/city/state/zip).
 * No imports: shared by client forms, server code, and scripts/ (plain Node).
 */

export type AddressParts = {
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
};

export const STATE_PATTERN = /^[A-Z]{2}$/;
export const ZIP_PATTERN = /^\d{5}(-\d{4})?$/;

/** "1200 Starkweather Ave, Cleveland, OH 44113" — skips missing parts. */
export function formatAddress(a: AddressParts): string | null {
  const stateZip = [a.state, a.zip].filter(Boolean).join(' ');
  return [a.street, a.city, stateZip].filter(Boolean).join(', ') || null;
}

/**
 * Best-effort split of a one-line Ohio address (KML data). Keep in sync with
 * the backfill in drizzle/*_split_address. Drops venue prefixes before the
 * house number ("Lincoln Park 1200 Starkweather Ave" → "1200 Starkweather
 * Ave"). Anything unrecognized lands whole in `street` for an editor to fix.
 */
export function parseOneLineAddress(raw: string | null): AddressParts {
  const empty = { street: null, city: null, state: null, zip: null };
  const s = raw?.trim();
  if (!s) return empty;

  const m = s.match(/^(.*),\s*(OH|Ohio)\s+(\d{5}(?:-\d{4})?)$/i);
  if (!m) return { ...empty, street: s };
  const head = m[1]!.trim();
  const zip = m[3]!;

  let street = head;
  let city: string | null = null;
  const comma = head.lastIndexOf(',');
  if (comma >= 0) {
    street = head.slice(0, comma).trim();
    city = head.slice(comma + 1).trim() || null;
  } else if (/\sCleveland$/i.test(head)) {
    street = head.replace(/\s+Cleveland$/i, '');
    city = 'Cleveland';
  }
  street = street.match(/\b\d+[A-Za-z]?\s+\S.*$/)?.[0] ?? street;

  return { street: street || null, city, state: 'OH', zip };
}
