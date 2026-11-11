'use server';

import { eq } from 'drizzle-orm';
import { updateTag } from 'next/cache';
import { asUser } from '@/lib/db';
import { SECTIONS_TAG } from '@/lib/db/queries';
import { siteSections } from '@/lib/db/schema';
import {
  isSectionKey,
  sanitizeSectionHtml,
  SECTION_MAX_LENGTH,
} from '@/lib/sections';
import { getSession } from '@/lib/session';

export type SaveSectionState =
  | { status: 'idle' }
  | { status: 'saved'; html: string }
  | { status: 'error'; message: string };

export async function saveSection(
  _prev: SaveSectionState,
  formData: FormData,
): Promise<SaveSectionState> {
  const session = await getSession();
  if (!session) return { status: 'error', message: 'Sign in again.' };

  const key = formData.get('key');
  const raw = formData.get('html');
  if (!isSectionKey(key) || typeof raw !== 'string') {
    return { status: 'error', message: 'Invalid section.' };
  }
  if (raw.length > SECTION_MAX_LENGTH) {
    return {
      status: 'error',
      message: `Too long (max ${SECTION_MAX_LENGTH.toLocaleString()} characters).`,
    };
  }

  const html = sanitizeSectionHtml(raw);
  // RLS (editors only) decides; a non-editor's update matches zero rows.
  const updated = await asUser(session.user.id, (tx) =>
    tx
      .update(siteSections)
      .set({ html })
      .where(eq(siteSections.key, key))
      .returning({ key: siteSections.key }),
  );
  if (updated.length === 0) {
    return { status: 'error', message: 'Not allowed.' };
  }

  updateTag(SECTIONS_TAG);
  return { status: 'saved', html };
}
