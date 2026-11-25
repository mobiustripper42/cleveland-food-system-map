import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { isEditor } from '@/lib/db/queries';
import { getSession } from '@/lib/session';
import { LocationForm } from '@/components/locations/location-form';

export const metadata = { title: 'Add location' };

export default function NewLocationPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-10">
      <div>
        <Link
          href="/locations"
          className="link inline-flex min-h-11 items-center"
        >
          ← All locations
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
