/**
 * Contact ↔ user linking. Shared by lib/auth.ts (BetterAuth hooks) and
 * scripts/import-kml.ts, so no `server-only` and `.ts` imports.
 *
 * Linking is proof-based: a contact joins a user only when that user's email
 * is verified and matches. Contacts never create users. Pass an owner-role db
 * — the contacts_link_guard trigger refuses user_id changes from app_user.
 */
import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { contacts } from './schema.ts';

type Db = Pick<PostgresJsDatabase, 'transaction' | 'execute'>;

const sameEmail = (email: string) =>
  sql`lower(${contacts.email}) = lower(${email})`;

/**
 * Brings a user's contact in line with their auth email: links the unclaimed
 * contact with that email if the user has none, or moves a claimed contact's
 * email to the new address (absorbing an unclaimed duplicate's locations).
 * No-op until the email is verified. Idempotent.
 */
export async function reconcileUserContact(
  db: Db,
  u: { id: string; email: string; emailVerified: boolean },
): Promise<void> {
  if (!u.emailVerified || !u.email) return;
  const email = u.email.trim().toLowerCase();

  await db.transaction(async (tx) => {
    const [linked] = await tx
      .select({ id: contacts.id, email: contacts.email })
      .from(contacts)
      .where(eq(contacts.user_id, u.id));

    if (!linked) {
      const [match] = await tx
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(sameEmail(email), isNull(contacts.user_id)))
        .orderBy(asc(contacts.id))
        .limit(1);
      if (match) {
        await tx
          .update(contacts)
          .set({ user_id: u.id })
          .where(eq(contacts.id, match.id));
      }
      return;
    }

    if (linked.email?.toLowerCase() === email) return;

    // Email changed: an unclaimed contact already holding the new address is
    // the same person — fold its locations in, then take over the address.
    const dupes = await tx
      .select({ id: contacts.id })
      .from(contacts)
      .where(
        and(
          sameEmail(email),
          isNull(contacts.user_id),
          ne(contacts.id, linked.id),
        ),
      );
    for (const dupe of dupes) {
      await tx.execute(sql`
        insert into public.location_contacts (location_id, contact_id)
        select location_id, ${linked.id} from public.location_contacts
        where contact_id = ${dupe.id}
        on conflict do nothing`);
      // Its old links cascade.
      await tx.delete(contacts).where(eq(contacts.id, dupe.id));
    }
    await tx.update(contacts).set({ email }).where(eq(contacts.id, linked.id));
  });
}

/**
 * Links every unclaimed contact to the verified user with its email (one
 * contact per user). For bulk writes that bypass the auth hooks: KML import.
 * Same statement as the contact_users_guard migration backfill.
 */
export async function linkContactsToVerifiedUsers(db: Db): Promise<number> {
  const rows = await db.execute(sql`
    update public.contacts c
    set user_id = m.user_id
    from (
      select distinct on (u.id) u.id as user_id, c2.id as contact_id
      from public."user" u
      join public.contacts c2 on lower(c2.email) = lower(u.email)
      where u.email_verified and c2.user_id is null
      order by u.id, c2.id
    ) m
    where c.id = m.contact_id
      and not exists (select 1 from public.contacts x where x.user_id = m.user_id)
    returning c.id`);
  return rows.length;
}

/**
 * The user's contact id — linking the unclaimed contact with their email, or
 * creating one, first. Owner-role db only (sets user_id); callers vouch for
 * the user (their own verified session, or an editor acting on them).
 */
export async function ensureUserContact(
  db: Db & Pick<PostgresJsDatabase, 'insert' | 'select'>,
  u: { id: string; email: string; emailVerified: boolean },
): Promise<string | null> {
  await reconcileUserContact(db, u);
  if (!u.emailVerified || !u.email) return null;
  await db
    .insert(contacts)
    .values({ email: u.email.trim().toLowerCase(), user_id: u.id })
    .onConflictDoNothing();
  const [row] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(eq(contacts.user_id, u.id));
  return row?.id ?? null;
}
