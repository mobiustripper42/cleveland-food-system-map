'use client';

import { startTransition, useActionState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { FieldError, FormStatus } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addEditor, removeEditor, type EditorActionState } from './actions';

const idle: EditorActionState = { status: 'idle' };

export function AddEditorForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, formAction, pending] = useActionState(
    async (prev: EditorActionState, formData: FormData) => {
      const next = await addEditor(prev, formData);
      if (next.status === 'done') formRef.current?.reset();
      return next;
    },
    idle,
  );
  const error = state.status === 'error' ? state.message : null;
  useEffect(() => {
    if (state.status === 'error') inputRef.current?.focus();
  }, [state]);

  // Submit manually: a plain `action={…}` resets the form after every
  // submit, which would wipe the typed email on an error.
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-2">
      <Label htmlFor="editor-email">Add an editor by email</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          ref={inputRef}
          id="editor-email"
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="off"
          placeholder="someone@example.org"
          aria-invalid={error ? true : undefined}
          aria-describedby={
            error ? 'editor-email-error editor-email-help' : 'editor-email-help'
          }
        />
        <Button type="submit" disabled={pending} className="sm:w-auto">
          {pending ? 'Adding…' : 'Add editor'}
        </Button>
      </div>
      <FieldError id="editor-email-error">{error}</FieldError>
      <FormStatus tone="success">
        {state.status === 'done' && state.message}
      </FormStatus>
      <p id="editor-email-help" className="text-sm text-muted-foreground">
        If they don&apos;t have an account yet, one is created — they sign in
        with an emailed code or Google using that address.
      </p>
    </form>
  );
}

export function RemoveEditorButton({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const [state, formAction, pending] = useActionState(
    async (prev: EditorActionState, formData: FormData) => {
      const next = await removeEditor(prev, formData);
      // The row is about to disappear with focus in it.
      if (next.status === 'done') {
        document.getElementById('editors-heading')?.focus();
      }
      return next;
    },
    idle,
  );

  function remove() {
    const formData = new FormData();
    formData.set('user_id', userId);
    startTransition(() => formAction(formData));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ConfirmButton
        size="sm"
        disabled={pending}
        aria-label={`Remove ${email}`}
        title={`Remove ${email} as an editor?`}
        description="They keep their account but lose access to the admin tools right away."
        onConfirm={remove}
      >
        {pending ? 'Removing…' : 'Remove'}
      </ConfirmButton>
      <FormStatus tone="error">
        {state.status === 'error' && state.message}
      </FormStatus>
    </div>
  );
}
