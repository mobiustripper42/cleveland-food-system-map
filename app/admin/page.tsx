import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { isEditor } from '@/lib/db/queries';
import { getSession } from '@/lib/session';

export const metadata = { title: 'Admin' };

const linkStyle = { color: '#1d4ed8' };

export default function AdminPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-10">
      <div>
        <Link
          href="/"
          className="text-sm underline underline-offset-4"
          style={linkStyle}
        >
          ← Back to the map
        </Link>
      </div>
      <h1 className="text-2xl font-semibold">Admin</h1>
      <Suspense fallback={<p className="text-sm">Loading…</p>}>
        <AdminLinks />
      </Suspense>
    </div>
  );
}

async function AdminLinks() {
  if (!(await getSession())) redirect('/login');
  if (!(await isEditor())) notFound();

  return (
    <ul className="flex flex-col gap-3">
      <li>
        <Link
          href="/admin/sections"
          className="underline underline-offset-4"
          style={linkStyle}
        >
          Site text
        </Link>
        <p className="text-sm">The HTML above the map and in the footer.</p>
      </li>
      <li>
        <Link
          href="/admin/editors"
          className="underline underline-offset-4"
          style={linkStyle}
        >
          Editors
        </Link>
        <p className="text-sm">Who can use these admin tools.</p>
      </li>
    </ul>
  );
}
