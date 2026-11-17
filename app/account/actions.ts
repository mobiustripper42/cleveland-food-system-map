'use server';

import { eq } from 'drizzle-orm';
import { asUser, db } from '@/lib/db';
import { ensureUserContact } from '@/lib/db/contacts';
import { pgCode } from '@/lib/db/errors';
import { contacts } from '@/lib/db/schema';
import { normalizePhone } from '@/lib/phone';
import { getSession } from '@/lib/session';

export type ProfileState =
  | { status: 'idle' }
  | { status: 'saved'; message: string }
  | { status: 'error'; message: string; field?: 'name' | 'phone' };

const NAME_MAX = 200;

/**
 * Saves the signed-in user's contact (name, phone). Email is never taken from
 * the form: it is the verified sign-in email. Creates the contact on first
 * save — after claiming an existing one with that email, if any.
 */
export async function saveProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const session = await getSession();
  if (!session) return { status: 'error', message: 'Sign in first.' };
  const { user } = session;
  if (!user.emailVerified) {
    return { status: 'error', message: 'Verify your email first.' };
  }

  const name = String(formData.get('name') ?? '').trim() || null;
  if (name && name.length > NAME_MAX) {
    return {
      status: 'error',
      field: 'name',
      message: `Name is limited to ${NAME_MAX} characters.`,
    };
  }
  const rawPhone = String(formData.get('phone') ?? '').trim();
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  if (rawPhone && !phone) {
    return {
      status: 'error',
      field: 'phone',
      message: 'Enter a 10-digit phone number, e.g. (216) 555-1234.',
    };
  }

  try {
    // Linking and creating set user_id, which only the owner role may do
    // (contacts_link_guard); the session above is the proof.
    await ensureUserContact(db, user);

    // The edit itself runs as the user: RLS (contacts_update_self) and the
    // audit trigger apply.
    const updated = await asUser(user.id, (tx) =>
      tx
        .update(contacts)
        .set({ name, phone })
        .where(eq(contacts.user_id, user.id))
        .returning({ id: contacts.id }),
    );
    if (updated.length === 0) {
      return { status: 'error', message: 'Could not save your contact info.' };
    }
  } catch (err) {
    if (pgCode(err).code === '42501') {
      return { status: 'error', message: 'Not allowed.' };
    }
    throw err;
  }
  return { status: 'saved', message: 'Saved.' };
}
