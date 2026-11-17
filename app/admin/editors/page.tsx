import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getEditors } from '@/lib/db/queries';
import { getSession } from '@/lib/session';
import { AddEditorForm, RemoveEditorButton } from './EditorForms';

export const metadata = { title: 'Editors' };

export default function EditorsPage() {
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
      <h1 className="text-2xl font-semibold">Editors</h1>
      <p className="text-sm">
        Editors can change site text, add and edit locations, see manager
        contacts, and manage other editors.
      </p>
      <Suspense fallback={<p className="text-sm">Loading…</p>}>
        <Editors />
      </Suspense>
    </div>
  );
}

async function Editors() {
  const session = await getSession();
  if (!session) redirect('/login');
  const editors = await getEditors();
  if (!editors) notFound();

  return (
    <>
      <AddEditorForm />
      <ul className="flex flex-col divide-y divide-foreground/10 border-y border-foreground/10">
        {editors.map((e) => (
          <li
            key={e.user_id}
            className="flex flex-wrap items-center justify-between gap-2 py-3"
          >
            <div className="min-w-0">
              <p className="break-all">
                {e.email}
                {e.user_id === session.user.id && (
                  <span className="text-sm text-muted-foreground"> (you)</span>
                )}
              </p>
              {e.name && e.name !== e.email && (
                <p className="text-sm text-muted-foreground">{e.name}</p>
              )}
            </div>
            {e.user_id !== session.user.id && (
              <RemoveEditorButton userId={e.user_id} email={e.email} />
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
