import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { isEditor } from '@/lib/db/queries';
import { getSession } from '@/lib/session';
import { LocationForm } from './LocationForm';

export const metadata = { title: 'Add location' };

export default function NewLocationPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-10">
      <div>
        <Link
          href="/admin"
          className="text-sm underline underline-offset-4"
          style={{ color: '#1d4ed8' }}
        >
          ← Admin
        </Link>
      </div>
      <h1 className="text-2xl font-semibold">Add location</h1>
      <Suspense fallback={<p className="text-sm">Loading…</p>}>
        <Gate />
      </Suspense>
    </div>
  );
}

async function Gate() {
  if (!(await getSession())) redirect('/login');
  if (!(await isEditor())) notFound();
  return <LocationForm />;
}
