import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { isEditor } from '@/lib/db/queries';
import { getSession } from '@/lib/session';

export const metadata = { title: 'Admin' };

export default function AdminPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-10">
      <div>
        <Link href="/" className="link inline-flex min-h-11 items-center">
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
    <ul className="flex flex-col divide-y divide-foreground/10 border-y border-foreground/10">
      {[
        {
          href: '/admin/sections',
          title: 'Site text',
          about: 'The HTML above the map and in the footer.',
        },
        {
          href: '/admin/editors',
          title: 'Editors',
          about: 'Who can use these admin tools.',
        },
        {
          href: '/locations/new',
          title: 'New location',
          about: 'Add a garden, farm, or market.',
        },
      ].map((l) => (
        <li key={l.href}>
          {/* Whole row is the target (44px+). */}
          <Link
            href={l.href}
            className="flex min-h-14 flex-col justify-center py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="link font-medium">{l.title}</span>
            <span className="text-sm text-muted-foreground">{l.about}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
