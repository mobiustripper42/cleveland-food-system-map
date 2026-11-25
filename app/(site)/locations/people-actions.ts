'use server';

/**
 * People on /locations/<id>/edit: contacts (location_contacts) and owners
 * (location_owners), shown as one list. Editors manage both; a location's
 * owners manage its contacts (RLS decides what they can touch).
 */
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { refresh } from 'next/cache';
import { asUser, db, type Tx } from '@/lib/db';
import { ensureUserContact, reconcileUserContact } from '@/lib/db/contacts';
import { pgCode } from '@/lib/db/errors';
import { canEditLocation, isEditor } from '@/lib/db/queries';
import {
  contacts,
  locationContacts,
  locationOwners,
  user,
} from '@/lib/db/schema';
import { findOrCreateUserByEmail, normalizeEmail } from '@/lib/db/users';
import { normalizePhone } from '@/lib/phone';
import { getSession } from '@/lib/session';

export type PeopleActionState =
  | { status: 'idle' }
  | { status: 'done'; message: string }
  /** `field` names the input at fault, so the form can mark it. */
  | { status: 'error'; message: string; field?: PersonField };

export type PersonField = 'email' | 'name' | 'phone';

const NAME_MAX = 200;
const NOT_ALLOWED: PeopleActionState = {
  status: 'error',
  message: 'Not allowed.',
};

type Who = { userId: string; editor: boolean };

/** Session + edit access to this location, or an error state. */
async function access(locationId: string): Promise<Who | PeopleActionState> {
  const session = await getSession();
  if (!session) return { status: 'error', message: 'Sign in again.' };
  if (typeof locationId !== 'string' || !(await canEditLocation(locationId))) {
    return NOT_ALLOWED;
  }
  return { userId: session.user.id, editor: await isEditor() };
}

const isError = (x: Who | PeopleActionState): x is PeopleActionState =>
  'status' in x;

/** Maps RLS denials; rethrows the rest. */
function writeError(err: unknown): PeopleActionState {
  if (pgCode(err).code === '42501') return NOT_ALLOWED;
  throw err;
}

const field = (formData: FormData, name: string) => {
  const v = formData.get(name);
  return typeof v === 'string' ? v : '';
};

/** Fills a contact's blank name/phone (never overwrites). RLS may skip it. */
async function fillBlanks(
  tx: Tx,
  contactId: string,
  name: string | null,
  phone: string | null,
) {
  if (!name && !phone) return;
  await tx
    .update(contacts)
    .set({
      name: sql`coalesce(${contacts.name}, ${name})`,
      phone: sql`coalesce(${contacts.phone}, ${phone})`,
    })
    .where(eq(contacts.id, contactId));
}

async function link(tx: Tx, locationId: string, contactId: string) {
  return tx
    .insert(locationContacts)
    .values({ location_id: locationId, contact_id: contactId })
    .onConflictDoNothing()
    .returning({ contact_id: locationContacts.contact_id });
}

/** Account row (owner db) for proof-based contact linking. */
async function userById(id: string) {
  const [u] = await db
    .select({
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
    })
    .from(user)
    .where(eq(user.id, id));
  return u ?? null;
}

/**
 * Editors only (caller checks). Finds or creates the account, links its
 * contact if the email is verified, and makes it an owner.
 */
async function grantOwner(who: Who, locationId: string, email: string) {
  const { id, created } = await findOrCreateUserByEmail(db, email);
  // Existing accounts may be unverified: pass the real flag, so an unproven
  // account never claims a contact.
  const account = (await userById(id))!;
  await reconcileUserContact(db, account);
  const added = await asUser(who.userId, (tx) =>
    tx
      .insert(locationOwners)
      .values({ location_id: locationId, user_id: id })
      .onConflictDoNothing()
      .returning({ user_id: locationOwners.user_id }),
  );
  return { account, created, added: added.length > 0 };
}

/**
 * Attaches the contact with this email (reused across locations — emails are
 * unique), or a new one. New contacts are created as the caller, so owners
 * go through contacts_insert_owner.
 */
async function attachContact(
  who: Who,
  locationId: string,
  c: { email: string | null; name: string | null; phone: string | null },
): Promise<{ added: boolean; reused: boolean }> {
  // Owner db: the existing contact may be on locations the caller can't see.
  const [existing] = c.email
    ? await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(sql`lower(${contacts.email}) = ${c.email}`)
    : [];

  const added = await asUser(who.userId, async (tx) => {
    if (existing) {
      const rows = await link(tx, locationId, existing.id);
      await fillBlanks(tx, existing.id, c.name, c.phone);
      return rows.length > 0;
    }
    // Not visible to an owner until linked, so no RETURNING: take the id first.
    const [{ id }] = await tx.execute<{ id: string }>(
      sql`select public.gen_ksuid() as id`,
    );
    await tx.insert(contacts).values({ id, ...c });
    return (await link(tx, locationId, id)).length > 0;
  });

  if (!existing && c.email) await claimByEmail(c.email);
  return { added, reused: Boolean(existing) };
}

/**
 * A verified account with this email claims its unclaimed contact (no-op if
 * none, or unverified). Owner db; `email` must be normalized.
 */
async function claimByEmail(email: string) {
  const [account] = await db
    .select({
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
    })
    .from(user)
    .where(sql`lower(${user.email}) = ${email}`);
  if (account) await reconcileUserContact(db, account);
}

/** Add form: email/name/phone + "Contact" and (editors) "Can edit" boxes. */
export async function addPerson(
  locationId: string,
  _prev: PeopleActionState,
  formData: FormData,
): Promise<PeopleActionState> {
  const who = await access(locationId);
  if (isError(who)) return who;

  const rawEmail = field(formData, 'email').trim();
  const email = rawEmail ? normalizeEmail(rawEmail) : null;
  if (rawEmail && !email) {
    return { status: 'error', message: 'Enter a valid email.', field: 'email' };
  }
  const name = field(formData, 'name').trim() || null;
  if (name && name.length > NAME_MAX) {
    return {
      status: 'error',
      message: `Name is limited to ${NAME_MAX} characters.`,
      field: 'name',
    };
  }
  const rawPhone = field(formData, 'phone').trim();
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  if (rawPhone && !phone) {
    return {
      status: 'error',
      message: 'Enter a 10-digit phone number, e.g. (216) 555-1234.',
      field: 'phone',
    };
  }
  const asContact = formData.get('contact') === 'on';
  const asOwner = formData.get('owner') === 'on';

  if (!asContact && !asOwner) {
    return { status: 'error', message: 'Choose Contact, Can edit, or both.' };
  }
  if (asOwner && !who.editor) return NOT_ALLOWED;
  if (asOwner && !email) {
    return {
      status: 'error',
      message: 'Can edit needs an email.',
      field: 'email',
    };
  }
  if (asContact && !email && !name && !phone) {
    return { status: 'error', message: 'Enter an email, name, or phone.' };
  }

  const label = email ?? name ?? phone;
  const notes: string[] = [];
  try {
    if (asOwner) {
      const { account, created, added } = await grantOwner(
        who,
        locationId,
        email!,
      );
      notes.push(
        added
          ? `${label} can edit this location.`
          : `${label} could already edit.`,
      );
      if (created) notes.push('They can sign in with an emailed code.');

      if (asContact && account.emailVerified) {
        // Their own profile contact (linked above, or created now).
        const contactId = await ensureUserContact(db, account);
        const linked = await asUser(who.userId, async (tx) => {
          const rows = await link(tx, locationId, contactId!);
          await fillBlanks(tx, contactId!, name, phone);
          return rows.length > 0;
        });
        notes.push(linked ? 'Added as a contact.' : 'Already a contact.');
        refresh();
        return { status: 'done', message: notes.join(' ') };
      }
    }
    if (asContact) {
      const { added, reused } = await attachContact(who, locationId, {
        email,
        name,
        phone,
      });
      notes.push(
        !added
          ? `${label} is already a contact.`
          : reused
            ? `Added existing contact ${label}.`
            : `Added contact ${label}.`,
      );
    }
  } catch (err) {
    return writeError(err);
  }

  refresh();
  return { status: 'done', message: notes.join(' ') };
}

/**
 * Contact checkbox on a row. Off detaches (the contact stays — it may be on
 * other locations). On for an owner-only row creates/links their contact.
 */
export async function setContact(
  locationId: string,
  _prev: PeopleActionState,
  formData: FormData,
): Promise<PeopleActionState> {
  const who = await access(locationId);
  if (isError(who)) return who;
  const on = formData.get('on') === '1';
  const contactId = field(formData, 'contact_id');
  const ownerId = field(formData, 'user_id');

  try {
    if (!on) {
      if (!contactId) return { status: 'error', message: 'Invalid contact.' };
      const removed = await asUser(who.userId, (tx) =>
        tx
          .delete(locationContacts)
          .where(
            and(
              eq(locationContacts.location_id, locationId),
              eq(locationContacts.contact_id, contactId),
            ),
          )
          .returning({ contact_id: locationContacts.contact_id }),
      );
      if (!removed.length) return NOT_ALLOWED;
    } else {
      // Only owner rows lack a contact, and only editors see owner rows.
      if (!who.editor || !ownerId) return NOT_ALLOWED;
      const account = await userById(ownerId);
      if (!account) return { status: 'error', message: 'Account not found.' };
      const id = await ensureUserContact(db, account);
      if (!id) {
        return {
          status: 'error',
          message: 'They need to verify their email first.',
        };
      }
      await asUser(who.userId, (tx) => link(tx, locationId, id));
    }
  } catch (err) {
    return writeError(err);
  }
  refresh();
  return { status: 'done', message: on ? 'Added.' : 'Removed.' };
}

/** "Can edit" checkbox on a row. Editors only. */
export async function setOwner(
  locationId: string,
  _prev: PeopleActionState,
  formData: FormData,
): Promise<PeopleActionState> {
  const who = await access(locationId);
  if (isError(who)) return who;
  if (!who.editor) return NOT_ALLOWED;
  const on = formData.get('on') === '1';

  try {
    if (on) {
      const email = normalizeEmail(formData.get('email'));
      if (!email) return { status: 'error', message: 'Needs an email.' };
      const { created } = await grantOwner(who, locationId, email);
      refresh();
      return {
        status: 'done',
        message: created
          ? 'Added. They can sign in with an emailed code.'
          : 'Added.',
      };
    }
    const userId = field(formData, 'user_id');
    if (!userId) return { status: 'error', message: 'Invalid owner.' };
    const removed = await asUser(who.userId, (tx) =>
      tx
        .delete(locationOwners)
        .where(
          and(
            eq(locationOwners.location_id, locationId),
            eq(locationOwners.user_id, userId),
          ),
        )
        .returning({ user_id: locationOwners.user_id }),
    );
    if (!removed.length) return NOT_ALLOWED;
  } catch (err) {
    return writeError(err);
  }
  refresh();
  return { status: 'done', message: 'Removed.' };
}

/**
 * Name/phone (and, if unclaimed, email) of a contact on this location.
 * Editors: any. Owners: unclaimed contacts on only their locations
 * (contacts_update_owner). A claimed email mirrors the account's sign-in
 * email, so it's only changed from the account (contacts_link_guard).
 */
export async function updateContact(
  locationId: string,
  _prev: PeopleActionState,
  formData: FormData,
): Promise<PeopleActionState> {
  const who = await access(locationId);
  if (isError(who)) return who;
  const contactId = field(formData, 'contact_id');
  if (!contactId) return { status: 'error', message: 'Invalid contact.' };

  const name = field(formData, 'name').trim() || null;
  if (name && name.length > NAME_MAX) {
    return {
      status: 'error',
      message: `Name is limited to ${NAME_MAX} characters.`,
      field: 'name',
    };
  }
  const rawPhone = field(formData, 'phone').trim();
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  if (rawPhone && !phone) {
    return {
      status: 'error',
      message: 'Enter a 10-digit phone number, e.g. (216) 555-1234.',
      field: 'phone',
    };
  }
  // Sent only for unclaimed contacts; blank clears it.
  const setsEmail = formData.has('email');
  const rawEmail = field(formData, 'email').trim();
  const email = rawEmail ? normalizeEmail(rawEmail) : null;
  if (rawEmail && !email) {
    return { status: 'error', message: 'Enter a valid email.', field: 'email' };
  }

  try {
    const updated = await asUser(who.userId, (tx) =>
      tx
        .update(contacts)
        .set(setsEmail ? { name, phone, email } : { name, phone })
        .where(
          and(
            eq(contacts.id, contactId),
            setsEmail ? isNull(contacts.user_id) : undefined,
            inArray(
              contacts.id,
              tx
                .select({ id: locationContacts.contact_id })
                .from(locationContacts)
                .where(eq(locationContacts.location_id, locationId)),
            ),
          ),
        )
        .returning({ id: contacts.id }),
    );
    if (!updated.length) {
      return {
        status: 'error',
        message:
          'Not allowed — this contact is on other locations or linked to an account.',
      };
    }
  } catch (err) {
    const { code, constraint } = pgCode(err);
    if (code === '23505' && constraint === 'contacts_email_key') {
      return {
        status: 'error',
        message:
          'Another contact already has that email — add it with the form below instead.',
      };
    }
    return writeError(err);
  }
  if (setsEmail && email) await claimByEmail(email);
  refresh();
  return { status: 'done', message: 'Saved.' };
}

/** Clears both roles for a row (the contact itself is kept). */
export async function removePerson(
  locationId: string,
  _prev: PeopleActionState,
  formData: FormData,
): Promise<PeopleActionState> {
  const who = await access(locationId);
  if (isError(who)) return who;
  const contactId = field(formData, 'contact_id');
  const ownerId = field(formData, 'user_id');
  if (ownerId && !who.editor) return NOT_ALLOWED;
  if (!contactId && !ownerId) {
    return { status: 'error', message: 'Invalid person.' };
  }

  try {
    const removed = await asUser(who.userId, async (tx) => {
      let n = 0;
      if (contactId) {
        n += (
          await tx
            .delete(locationContacts)
            .where(
              and(
                eq(locationContacts.location_id, locationId),
                eq(locationContacts.contact_id, contactId),
              ),
            )
            .returning({ id: locationContacts.contact_id })
        ).length;
      }
      if (ownerId) {
        n += (
          await tx
            .delete(locationOwners)
            .where(
              and(
                eq(locationOwners.location_id, locationId),
                eq(locationOwners.user_id, ownerId),
              ),
            )
            .returning({ id: locationOwners.user_id })
        ).length;
      }
      return n;
    });
    if (!removed) return NOT_ALLOWED;
  } catch (err) {
    return writeError(err);
  }
  refresh();
  return { status: 'done', message: 'Removed.' };
}
