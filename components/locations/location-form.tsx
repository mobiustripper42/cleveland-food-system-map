'use client';

import { startTransition, useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  createLocation,
  type CreateLocationState,
} from '@/app/(site)/locations/actions';
import { LocationFields } from './location-fields';

function savedMessage(s: Extract<CreateLocationState, { status: 'saved' }>) {
  const pin =
    s.geocoded === 'found'
      ? ' Coordinates were looked up from the address.'
      : s.geocoded === 'not-found'
        ? ' No coordinates found for the address, so it has no pin yet.'
        : '';
  const where = s.published
    ? ' It’s on the map.'
    : ' It won’t be on the map until it’s published.';
  return `Created ${s.name}.${pin}${where}`;
}

const NEW_DEFAULTS = { city: 'Cleveland', state: 'OH' };

/** Create form: the basics only. Editing lives at /locations/[id]/edit. */
export function LocationForm() {
  // Bumped after a save to remount (reset) the fields.
  const [formKey, setFormKey] = useState(0);
  const [state, formAction, pending] = useActionState(
    async (prev: CreateLocationState, formData: FormData) => {
      const next = await createLocation(prev, formData);
      if (next.status === 'saved') setFormKey((k) => k + 1);
      return next;
    },
    { status: 'idle' },
  );
  const errors = state.status === 'error' ? (state.errors ?? {}) : {};

  // Submit manually: a plain `action={…}` resets the form after every
  // submit, which would wipe the editor's input on a validation error.
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <LocationFields
        key={formKey}
        defaults={NEW_DEFAULTS}
        errors={errors}
        showStatus
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create location'}
        </Button>
        <p role="status" className="text-sm">
          {state.status === 'saved' && savedMessage(state)}
          {state.status === 'error' && state.message}
        </p>
      </div>
    </form>
  );
}
