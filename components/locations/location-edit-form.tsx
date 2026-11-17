'use client';

import Link from 'next/link';
import { startTransition, useActionState } from 'react';
import { Button } from '@/components/ui/button';
import {
  updateLocation,
  type UpdateLocationState,
} from '@/app/(site)/locations/actions';
import type { EditableLocation } from '@/lib/types';
import { LocationFields } from './location-fields';

const LINK = { color: '#1d4ed8' };

function savedMessage(s: Extract<UpdateLocationState, { status: 'saved' }>) {
  const pin =
    s.geocoded === 'found'
      ? ' Coordinates were looked up from the address.'
      : s.geocoded === 'not-found'
        ? ' No coordinates found for the address, so it has no pin.'
        : '';
  return `Saved ${s.name}.${pin}`;
}

/**
 * Edit form for one location. Status is editor-only (owners edit content);
 * kept separate from the create form so it can grow schedules, contacts, etc.
 */
export function LocationEditForm({
  location,
  editor,
}: {
  location: EditableLocation['location'];
  editor: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updateLocation.bind(null, location.id),
    { status: 'idle' },
  );
  const errors = state.status === 'error' ? (state.errors ?? {}) : {};

  // Submit manually: a plain `action={…}` resets the form after every
  // submit, which would revert unsaved input on a validation error.
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <LocationFields
        // Remount on fresh server data (after a save) so the uncontrolled
        // inputs show the stored values.
        key={JSON.stringify(location)}
        defaults={location}
        errors={errors}
        showStatus={editor}
        locationId={location.id}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
        <p role="status" className="text-sm">
          {state.status === 'saved' && (
            <>
              {savedMessage(state)}{' '}
              <Link
                href={`/locations/${location.id}`}
                className="underline underline-offset-4"
                style={LINK}
              >
                View
              </Link>
            </>
          )}
          {state.status === 'error' && state.message}
        </p>
      </div>
    </form>
  );
}
