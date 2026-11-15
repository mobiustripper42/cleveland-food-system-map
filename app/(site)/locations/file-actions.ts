'use server';

import { and, eq } from 'drizzle-orm';
import { refresh, updateTag } from 'next/cache';
import { asUser } from '@/lib/db';
import { pgCode } from '@/lib/db/errors';
import { canEditLocation, LOCATIONS_TAG } from '@/lib/db/queries';
import { locationFiles } from '@/lib/db/schema';
import {
  fileKeyPrefix,
  IMAGE_TYPES,
  type ImageType,
  isImageType,
  MAX_UPLOAD_BYTES,
  PROFILE_MAX_PX,
} from '@/lib/files';
import { getSession } from '@/lib/session';
import { deleteObjects, headObject, presignPut, sweepPrefix } from '@/lib/r2';

type Err = { status: 'error'; message: string };
const NOT_ALLOWED: Err = { status: 'error', message: 'Not allowed.' };

/** Session + edit access (editor or owner). RLS checks again on write. */
async function authorize(locationId: unknown): Promise<string | Err> {
  const session = await getSession();
  if (!session) return { status: 'error', message: 'Sign in again.' };
  if (typeof locationId !== 'string' || !(await canEditLocation(locationId))) {
    return NOT_ALLOWED;
  }
  return session.user.id;
}

type PresignedPut = {
  key: string;
  url: string;
  headers: Record<string, string>;
};

export type StartUploadResult =
  { status: 'ok'; full: PresignedPut; thumb: PresignedPut } | Err;

/**
 * Step 1: presigned PUTs for the browser-scaled image and its thumbnail. The
 * keys are generated here, under this location's prefix, so the client can't
 * choose where its bytes land.
 */
export async function startProfileUpload(
  locationId: string,
  file: { contentType: string; bytes: number; thumbBytes: number },
): Promise<StartUploadResult> {
  const auth = await authorize(locationId);
  if (typeof auth !== 'string') return auth;

  const contentType = file?.contentType;
  if (!isImageType(contentType)) {
    return { status: 'error', message: 'Unsupported image type.' };
  }
  // Client-reported; finishProfileUpload checks the stored objects for real.
  if (!(
    file.bytes > 0 &&
    file.bytes <= MAX_UPLOAD_BYTES &&
    file.thumbBytes > 0
  )) {
    return { status: 'error', message: 'Image is too large after scaling.' };
  }

  const ext = IMAGE_TYPES[contentType];
  const base = `${fileKeyPrefix(locationId, 'profile')}${crypto.randomUUID()}`;
  const fullKey = `${base}.${ext}`;
  const thumbKey = `${base}-thumb.${ext}`;
  const [full, thumb] = await Promise.all([
    presignPut(fullKey, contentType),
    presignPut(thumbKey, contentType),
  ]);
  return {
    status: 'ok',
    full: { key: fullKey, ...full },
    thumb: { key: thumbKey, ...thumb },
  };
}

export type FileActionState =
  { status: 'idle' } | { status: 'done'; message: string } | Err;

/** `locations/<id>/profile/<uuid>.<ext>` → its type, or null. */
function profileKeyType(
  locationId: string,
  key: unknown,
  thumb: boolean,
): ImageType | null {
  if (typeof key !== 'string') return null;
  const prefix = fileKeyPrefix(locationId, 'profile');
  if (!key.startsWith(prefix)) return null;
  const m = key
    .slice(prefix.length)
    .match(
      thumb
        ? /^[0-9a-f-]{36}-thumb\.(webp|jpg)$/
        : /^[0-9a-f-]{36}\.(webp|jpg)$/,
    );
  if (!m) return null;
  return m[1] === 'webp' ? 'image/webp' : 'image/jpeg';
}

const fileKeys = (r: { path: string; thumb_path: string | null }) =>
  r.thumb_path ? [r.path, r.thumb_path] : [r.path];

const validPx = (n: unknown): n is number =>
  Number.isInteger(n) && (n as number) > 0 && (n as number) <= PROFILE_MAX_PX;

/**
 * Step 2, after both PUTs: verify the objects, swap the location's profile
 * row, then remove the previous image (and stale strays) from R2.
 */
export async function finishProfileUpload(
  locationId: string,
  upload: { key: string; thumbKey: string; width: number; height: number },
): Promise<FileActionState> {
  const auth = await authorize(locationId);
  if (typeof auth !== 'string') return auth;

  const type = profileKeyType(locationId, upload?.key, false);
  const thumbType = profileKeyType(locationId, upload?.thumbKey, true);
  if (
    !type ||
    type !== thumbType ||
    upload.thumbKey !== upload.key.replace(/\.(webp|jpg)$/, '-thumb.$1') ||
    !validPx(upload.width) ||
    !validPx(upload.height)
  ) {
    return { status: 'error', message: 'Invalid upload.' };
  }
  const { key, thumbKey, width, height } = upload;

  const [full, thumb] = await Promise.all([
    headObject(key),
    headObject(thumbKey),
  ]);
  const ok = (o: typeof full) =>
    o && o.bytes > 0 && o.bytes <= MAX_UPLOAD_BYTES && o.contentType === type;
  if (!ok(full) || !ok(thumb)) {
    await deleteObjects([key, thumbKey]).catch(() => {});
    return {
      status: 'error',
      message: 'Upload failed or was too large. Try again.',
    };
  }

  let previous: string[];
  try {
    previous = await asUser(auth, async (tx) => {
      // RLS: editors or this location's owners; anyone else deletes nothing
      // and the insert raises 42501.
      const old = await tx
        .delete(locationFiles)
        .where(
          and(
            eq(locationFiles.location_id, locationId),
            eq(locationFiles.type, 'profile'),
          ),
        )
        .returning({
          path: locationFiles.path,
          thumb_path: locationFiles.thumb_path,
        });
      await tx.insert(locationFiles).values({
        location_id: locationId,
        type: 'profile',
        path: key,
        thumb_path: thumbKey,
        content_type: type,
        bytes: full!.bytes,
        width,
        height,
      });
      return old.flatMap(fileKeys);
    });
  } catch (err) {
    await deleteObjects([key, thumbKey]).catch(() => {});
    const { code } = pgCode(err);
    if (code === '42501') return NOT_ALLOWED;
    // Another upload for this location committed first (one-profile index).
    if (code === '23505') {
      return {
        status: 'error',
        message: 'Another image was just saved. Reload and try again.',
      };
    }
    throw err;
  }

  await sweepPrefix(fileKeyPrefix(locationId, 'profile'), {
    keep: [key, thumbKey],
    remove: previous,
  });
  updateTag(LOCATIONS_TAG);
  refresh();
  return { status: 'done', message: 'Image saved.' };
}

/** Removes the profile image: row first, then its objects in R2. */
export async function removeProfileImage(
  locationId: string,
): Promise<FileActionState> {
  const auth = await authorize(locationId);
  if (typeof auth !== 'string') return auth;

  const removed = await asUser(auth, (tx) =>
    tx
      .delete(locationFiles)
      .where(
        and(
          eq(locationFiles.location_id, locationId),
          eq(locationFiles.type, 'profile'),
        ),
      )
      .returning({
        path: locationFiles.path,
        thumb_path: locationFiles.thumb_path,
      }),
  );
  if (!removed.length)
    return { status: 'error', message: 'No image to remove.' };

  await sweepPrefix(fileKeyPrefix(locationId, 'profile'), {
    remove: removed.flatMap(fileKeys),
  });
  updateTag(LOCATIONS_TAG);
  refresh();
  return { status: 'done', message: 'Image removed.' };
}
