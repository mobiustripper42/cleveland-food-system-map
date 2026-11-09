'use server';

import { eq } from 'drizzle-orm';
import { refresh } from 'next/cache';
import { asUser, db } from '@/lib/db';
import { isEditor } from '@/lib/db/queries';
import { editors } from '@/lib/db/schema';
import { findOrCreateUserByEmail, normalizeEmail } from '@/lib/db/users';
import { getSession } from '@/lib/session';

export type EditorActionState =
  | { status: 'idle' }
  | { status: 'done'; message: string }
  | { status: 'error'; message: string };

export async function addEditor(
  _prev: EditorActionState,
  formData: FormData,
): Promise<EditorActionState> {
  const session = await getSession();
  if (!session) return { status: 'error', message: 'Sign in again.' };
  // Checked before touching `user`, which only the owner role can write.
  // The editors insert below is enforced again by RLS.
  if (!(await isEditor())) return { status: 'error', message: 'Not allowed.' };

  const email = normalizeEmail(formData.get('email'));
  if (!email) return { status: 'error', message: 'Enter a valid email.' };

  const { id, created } = await findOrCreateUserByEmail(db, email);
  const added = await asUser(session.user.id, (tx) =>
    tx
      .insert(editors)
      .values({ user_id: id })
      .onConflictDoNothing()
      .returning({ user_id: editors.user_id }),
  );

  refresh();
  if (!added.length) {
    return { status: 'done', message: `${email} is already an editor.` };
  }
  return {
    status: 'done',
    message: created
      ? `Added ${email}. They can sign in with an emailed code.`
      : `Added ${email}.`,
  };
}

export async function removeEditor(
  _prev: EditorActionState,
  formData: FormData,
): Promise<EditorActionState> {
  const session = await getSession();
  if (!session) return { status: 'error', message: 'Sign in again.' };

  const userId = formData.get('user_id');
  if (typeof userId !== 'string' || !userId) {
    return { status: 'error', message: 'Invalid editor.' };
  }
  if (userId === session.user.id) {
    return { status: 'error', message: "You can't remove yourself." };
  }

  // RLS decides: non-editors and self-removal match zero rows.
  const removed = await asUser(session.user.id, (tx) =>
    tx
      .delete(editors)
      .where(eq(editors.user_id, userId))
      .returning({ user_id: editors.user_id }),
  );
  if (!removed.length) return { status: 'error', message: 'Not allowed.' };

  refresh();
  return { status: 'done', message: 'Removed.' };
}
