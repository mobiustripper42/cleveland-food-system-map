/**
 * Location file rules, shared by the upload UI (client) and its server
 * actions. Type-only schema import keeps Drizzle out of the client bundle.
 */
import type { locationFileType } from '@/lib/db/schema';

export type LocationFileType = (typeof locationFileType.enumValues)[number];

export const FILE_TYPE_LABELS: Record<LocationFileType, string> = {
  profile: 'Profile image',
};

/** Longest edge after browser-side scaling. */
export const PROFILE_MAX_PX = 1600;
export const THUMB_MAX_PX = 480;

/** Per object, after scaling. A 1600px WebP is typically 150–400 KB. */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

/** What the browser may hand back from canvas.toBlob → key extension. */
export const IMAGE_TYPES = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
} as const;
export type ImageType = keyof typeof IMAGE_TYPES;

export function isImageType(v: unknown): v is ImageType {
  return typeof v === 'string' && Object.hasOwn(IMAGE_TYPES, v);
}

/** R2 prefix for one location's files of one type (trailing slash). */
export function fileKeyPrefix(
  locationId: string,
  type: LocationFileType,
): string {
  return `locations/${locationId}/${type}/`;
}
