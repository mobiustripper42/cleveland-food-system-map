/**
 * Phone storage format: 10 digits, plus " x<ext>" when present
 * ('2162834400', '2162834400 x2705'). formatPhone (lib/format.ts) displays it.
 * Client + server + scripts (no alias imports).
 */

// Matches:
//   (216) 555-1234  216-555-1234  216.555.1234  2165551234  2165551234ext.,2705
const PHONE_RE =
  /\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})(?:\s*(?:ext|x)[.,\s]*(\d+))?/i;

/** First phone number found in `text`, normalized; null if none. */
export function normalizePhone(text: string): string | null {
  const m = text.match(PHONE_RE);
  if (!m) return null;
  return `${m[1]}${m[2]}${m[3]}${m[4] ? ` x${m[4]}` : ''}`;
}
