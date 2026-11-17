import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { LocationEditForm } from '@/components/locations/location-edit-form';
import { LocationPeople } from '@/components/locations/location-people';
import { ProfileImageField } from '@/components/locations/profile-image-field';
import { getLocationForEdit } from '@/lib/db/queries';
import { getSession } from '@/lib/session';

export const metadata = { title: 'Edit location', robots: { index: false } };

type Params = Promise<{ id: string }>;

export default function EditLocationPage({ params }: { params: Params }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-10">
      <div>
        <Link
          href="/locations"
          className="text-sm underline underline-offset-4"
          style={{ color: '#1d4ed8' }}
        >
          ← All locations
        </Link>
      </div>
      {/* params + session are request data: resolve them under Suspense so
          the shell stays static. */}
      <Suspense fallback={<p className="text-sm">Loading…</p>}>
        <Gate params={params} />
      </Suspense>
    </div>
  );
}

// Editors, or owners of this location (RLS decides inside getLocationForEdit).
async function Gate({ params }: { params: Params }) {
  const { id } = await params;
  if (!(await getSession())) redirect('/login');
  const data = await getLocationForEdit(id);
  if (!data) notFound();
  const { location, image, editor, people } = data;

  return (
    <>
      <h1 className="text-2xl font-semibold">Edit {location.name}</h1>
      <ProfileImageField
        locationId={location.id}
        locationName={location.name}
        image={image}
      />
      <hr className="border-foreground/10" />
      <LocationEditForm location={location} editor={editor} />
      <hr className="border-foreground/10" />
      <LocationPeople
        locationId={location.id}
        people={people}
        editor={editor}
      />
    </>
  );
}
