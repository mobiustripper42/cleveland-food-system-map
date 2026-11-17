'use client';

import { useActionState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addEditor, removeEditor, type EditorActionState } from './actions';

const idle: EditorActionState = { status: 'idle' };

export function AddEditorForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    async (prev: EditorActionState, formData: FormData) => {
      const next = await addEditor(prev, formData);
      if (next.status === 'done') formRef.current?.reset();
      return next;
    },
    idle,
  );

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <Label htmlFor="editor-email">Add an editor by email</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="editor-email"
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="off"
          placeholder="someone@example.org"
        />
        <Button type="submit" disabled={pending} className="sm:w-auto">
          {pending ? 'Adding…' : 'Add editor'}
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
  );
}

export function RemoveEditorButton({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const [state, formAction, pending] = useActionState(removeEditor, idle);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(`Remove ${email} as an editor?`)) e.preventDefault();
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
