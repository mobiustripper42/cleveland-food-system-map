'use client';

import Link from 'next/link';
import { startTransition, useActionState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  addOwner,
  type OwnerActionState,
  removeOwner,
  updateLocation,
  type UpdateLocationState,
} from '@/app/(site)/locations/actions';
import type { EditableLocation, LocationOwner } from '@/lib/types';
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

const idle: OwnerActionState = { status: 'idle' };

/** Editors only: who besides editors may edit this location. */
export function LocationOwners({
  locationId,
  owners,
}: {
  locationId: string;
  owners: LocationOwner[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    async (prev: OwnerActionState, formData: FormData) => {
      const next = await addOwner(locationId, prev, formData);
      if (next.status === 'done') formRef.current?.reset();
      return next;
    },
    idle,
  );

  return (
    <section aria-labelledby="owners-heading" className="flex flex-col gap-3">
      <div>
        <h2 id="owners-heading" className="text-lg font-semibold">
          Owners
        </h2>
        <p className="text-sm text-muted-foreground">
          Owners can edit this location&apos;s details but not publish,
          unpublish, or archive it.
        </p>
      </div>

      {owners.length > 0 && (
        <ul className="flex flex-col divide-y divide-foreground/10 border-y border-foreground/10">
          {owners.map((o) => (
            <li
              key={o.user_id}
              className="flex flex-wrap items-center justify-between gap-2 py-3"
            >
              <div className="min-w-0">
                <p className="break-all">{o.email}</p>
                {o.name && o.name !== o.email && (
                  <p className="text-sm text-muted-foreground">{o.name}</p>
                )}
              </div>
              <RemoveOwnerButton
                locationId={locationId}
                userId={o.user_id}
                email={o.email}
              />
            </li>
          ))}
        </ul>
      )}

      <form ref={formRef} action={formAction} className="flex flex-col gap-2">
        <Label htmlFor="owner-email">Add an owner by email</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="owner-email"
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="off"
            placeholder="someone@example.org"
          />
          <Button type="submit" disabled={pending} className="sm:w-auto">
            {pending ? 'Adding…' : 'Add owner'}
          </Button>
        </div>
        <p role="status" className="text-sm">
          {state.status !== 'idle' && state.message}
        </p>
        <p className="text-xs text-muted-foreground">
          If they don&apos;t have an account yet, one is created — they sign in
          with an emailed code or Google using that address.
        </p>
      </form>
    </section>
  );
}

function RemoveOwnerButton({
  locationId,
  userId,
  email,
}: {
  locationId: string;
  userId: string;
  email: string;
}) {
  const [state, formAction, pending] = useActionState(
    removeOwner.bind(null, locationId),
    idle,
  );

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(`Remove ${email} as an owner?`)) e.preventDefault();
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="user_id" value={userId} />
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={pending}
        aria-label={`Remove ${email}`}
      >
        {pending ? 'Removing…' : 'Remove'}
      </Button>
      {state.status === 'error' && (
        <span role="status" className="text-sm">
          {state.message}
        </span>
      )}
    </form>
  );
}
