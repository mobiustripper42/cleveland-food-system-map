'use client';

import Link from 'next/link';
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Button } from '@/components/ui/button';
import { FormStatus } from '@/components/ui/field-error';
import { focusFirstInvalid } from '@/hooks/use-unsaved-changes-guard';
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
  const formRef = useRef<HTMLFormElement>(null);
  // Hide the last result once the editor starts on the next one.
  const [stale, setStale] = useState(false);
  useEffect(() => {
    setStale(false);
    if (state.status === 'error') focusFirstInvalid(formRef.current);
  }, [state]);

  // Submit manually: a plain `action={…}` resets the form after every
  // submit, which would wipe the editor's input on a validation error.
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      onChange={() => setStale(true)}
      className="flex flex-col gap-4"
    >
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
        <FormStatus
          tone={state.status === 'saved' ? 'success' : 'error'}
          className="flex-1"
        >
          {!stale && state.status === 'saved' && (
            <>
              {savedMessage(state)}{' '}
              <Link href={`/locations/${state.id}/edit`} className="link">
                Add a photo
              </Link>
            </>
          )}
          {state.status === 'error' && state.message}
        </FormStatus>
      </div>
    </form>
  );
}
