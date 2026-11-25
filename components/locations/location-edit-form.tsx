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
import { ConfirmDialog } from '@/components/ui/confirm-button';
import { FormStatus } from '@/components/ui/field-error';
import {
  focusFirstInvalid,
  useUnsavedChangesGuard,
} from '@/hooks/use-unsaved-changes-guard';
import {
  updateLocation,
  type UpdateLocationState,
} from '@/app/(site)/locations/actions';
import type { EditableLocation } from '@/lib/types';
import { LocationFields } from './location-fields';

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
  const formRef = useRef<HTMLFormElement>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState<FormData | null>(null);
  useUnsavedChangesGuard(dirty);
  useEffect(() => {
    if (state.status === 'saved') setDirty(false);
    if (state.status === 'error') focusFirstInvalid(formRef.current);
  }, [state]);

  const submit = (formData: FormData) =>
    startTransition(() => formAction(formData));

  // Submit manually: a plain `action={…}` resets the form after every
  // submit, which would revert unsaved input on a validation error.
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    // Archiving takes it off the map: confirm first.
    if (
      formData.get('status') === 'archived' &&
      location.status !== 'archived'
    ) {
      setConfirmArchive(formData);
      return;
    }
    submit(formData);
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      onChange={() => setDirty(true)}
      className="flex flex-col gap-4"
    >
      <ConfirmDialog
        open={confirmArchive !== null}
        onOpenChange={(open) => !open && setConfirmArchive(null)}
        title={`Archive ${location.name}?`}
        description="It comes off the public map and list. You can restore it later by changing the status back."
        confirmLabel="Archive"
        onConfirm={() => {
          if (confirmArchive) submit(confirmArchive);
          setConfirmArchive(null);
        }}
      />
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
        <FormStatus
          tone={state.status === 'saved' ? 'success' : 'error'}
          className="flex-1"
        >
          {!dirty && state.status === 'saved' && (
            <>
              {savedMessage(state)}{' '}
              <Link href={`/locations/${location.id}`} className="link">
                View
              </Link>
            </>
          )}
          {state.status === 'error' && state.message}
        </FormStatus>
      </div>
    </form>
  );
}
