import { asc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { db } from '@/lib/db';
import { passkey } from '@/lib/db/schema';
import { getSession } from '@/lib/session';
import { Passkeys } from './Passkeys';

export default function AccountPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 p-4 md:p-10">
      <div>
        <Link
          href="/"
          className="text-sm underline underline-offset-4"
          style={{ color: '#1d4ed8' }}
        >
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

  const passkeys = await db
    .select({
      id: passkey.id,
      name: passkey.name,
      createdAt: passkey.createdAt,
    })
    .from(passkey)
    .where(eq(passkey.userId, session.user.id))
    .orderBy(asc(passkey.createdAt));

  return (
    <>
      <p className="text-sm">
        Signed in as <strong>{session.user.email}</strong>
      </p>
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
