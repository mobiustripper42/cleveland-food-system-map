/**
 * Shared by the app (/admin/editors) and scripts/add-editor.ts, so no
 * `server-only` and `.ts` imports (scripts run under plain Node).
 *
 * `user` is a BetterAuth table with no app_user grants: pass an owner-role
 * db/transaction, and only after verifying the caller may do this.
 */
import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { user } from './auth-schema.ts';

export const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+$/;
export const EMAIL_MAX_LENGTH = 254;

/** Trimmed, lowercased email, or null if it doesn't look like one. */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  return email.length <= EMAIL_MAX_LENGTH && EMAIL_PATTERN.test(email)
    ? email
    : null;
}

/**
 * Finds the user with this email (case-insensitive) or creates one, already
 * verified — we're vouching for the address, so any sign-in method works and
 * Google sign-ins link to it. `email` must already be normalized.
 */
export async function findOrCreateUserByEmail(
  db: Pick<PostgresJsDatabase, 'transaction'>,
  email: string,
  name?: string,
): Promise<{ id: string; created: boolean }> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: user.id })
      .from(user)
      .where(sql`lower(${user.email}) = ${email}`);
    if (existing) return { id: existing.id, created: false };

    const [created] = await tx
      .insert(user)
      .values({
        id: crypto.randomUUID(),
        email,
        name: name ?? email,
        emailVerified: true,
      })
      .returning({ id: user.id });
    return { id: created!.id, created: true };
  });
}
