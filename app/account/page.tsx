import { asc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { db } from '@/lib/db';
import { getOwnContact } from '@/lib/db/queries';
import { passkey } from '@/lib/db/schema';
import { getSession } from '@/lib/session';
import { Passkeys } from './Passkeys';
import { ProfileForm } from './ProfileForm';

export default function AccountPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 p-4 md:p-10">
      <div>
        <Link href="/" className="link inline-flex min-h-11 items-center">
          ← Back to the map
        </Link>
      </div>
      <h1 className="text-2xl font-semibold">Your account</h1>
      {/* The static shell prerenders; the session-dependent part streams. */}
      <Suspense fallback={<p className="text-sm">Loading…</p>}>
        <AccountDetails />
      </Suspense>
    </div>
  );
}

// Signed-in users only (proxy redirects optimistically; this is the real check).
async function AccountDetails() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [contact, passkeys] = await Promise.all([
    getOwnContact(session.user.id),
    db
      .select({
        id: passkey.id,
        name: passkey.name,
        createdAt: passkey.createdAt,
      })
      .from(passkey)
      .where(eq(passkey.userId, session.user.id))
      .orderBy(asc(passkey.createdAt)),
  ]);

  return (
    <>
      <p className="text-sm">
        Signed in as <strong>{session.user.email}</strong>
      </p>
      {session.user.emailVerified ? (
        <ProfileForm
          email={session.user.email}
          name={contact?.name ?? null}
          phone={contact?.phone ?? null}
        />
      ) : (
        <section
          aria-labelledby="profile-heading"
          className="flex flex-col gap-1"
        >
          <h2 id="profile-heading" className="text-lg font-semibold">
            Contact info
          </h2>
          <p className="text-sm">
            Verify your email to add a name and phone: sign out, then sign in
            with an emailed code. We only link contact details to proven
            addresses.
          </p>
        </section>
      )}
      <Passkeys
        passkeys={passkeys.map((p) => ({
          id: p.id,
          name: p.name,
          createdAt: p.createdAt?.toISOString() ?? null,
        }))}
      />
    </>
  );
}
