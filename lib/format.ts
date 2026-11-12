/** Display formatters for location data. Client + server safe. */
import type { Location, MarketSchedule } from '@/lib/types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// 'HH:MM:SS' → '8 AM' / '12:30 PM'
export function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const suffix = h < 12 ? 'AM' : 'PM';
  const hour = h % 12 || 12;
  return m
    ? `${hour}:${String(m).padStart(2, '0')} ${suffix}`
    : `${hour} ${suffix}`;
}

// 'YYYY-MM-DD' → 'Jun 7'. UTC so the date doesn't shift with the viewer's zone.
export function formatDate(d: string): string {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** 'Sat 8 AM–12 PM (Jun 7 – Oct 25) · notes' */
export function formatSchedule(s: MarketSchedule): string {
  const hours = `${DAYS[s.day_of_week]} ${formatTime(s.opens_at)}–${formatTime(s.closes_at)}`;
  const season =
    s.season_start && s.season_end
      ? ` (${formatDate(s.season_start)} – ${formatDate(s.season_end)})`
      : '';
  return hours + season + (s.notes ? ` · ${s.notes}` : '');
}

/** 'Sat 8 AM–12 PM' — hours only, for compact cards. */
export function formatScheduleShort(s: MarketSchedule): string {
  return `${DAYS[s.day_of_week]} ${formatTime(s.opens_at)}–${formatTime(s.closes_at)}`;
}

// Import stores '2162834400' or '2162834400 x2705'.
export function formatPhone(phone: string): string {
  const [digits, ext] = phone.split(' x');
  const m = digits.match(/^(\d{3})(\d{3})(\d{4})$/);
  const base = m ? `(${m[1]}) ${m[2]}-${m[3]}` : digits;
  return ext ? `${base} ext. ${ext}` : base;
}

// Google Maps' cross-platform URL: opens the app on phones, the site elsewhere.
// Coordinates are exact; fall back to the address for markets without them.
export function directionsUrl(location: Location): string | null {
  const destination =
    location.lat !== null && location.lng !== null
      ? `${location.lat},${location.lng}`
      : location.address;
  if (!destination) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}
