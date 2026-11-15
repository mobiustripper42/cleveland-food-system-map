'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { saveSection, type SaveSectionState } from './actions';

export function SectionForm({
  sectionKey,
  label,
  initialHtml,
  maxLength,
}: {
  sectionKey: string;
  label: string;
  initialHtml: string;
  maxLength: number;
}) {
  // Controlled so a failed save keeps what the editor typed; a successful
  // save swaps in the sanitized HTML so stripped markup is visible.
  const [html, setHtml] = useState(initialHtml);
  const [state, formAction, pending] = useActionState(
    async (prev: SaveSectionState, formData: FormData) => {
      const next = await saveSection(prev, formData);
      if (next.status === 'saved') setHtml(next.html);
      return next;
    },
    { status: 'idle' },
  );
  const id = `section-${sectionKey}`;

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="key" value={sectionKey} />
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      <textarea
        id={id}
        name="html"
        value={html}
        onChange={(e) => setHtml(e.target.value)}
        maxLength={maxLength}
        rows={8}
        spellCheck={false}
        className="w-full rounded-md border border-input bg-background p-2 font-mono text-xs"
      />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
        <p role="status" className="text-sm">
          {state.status === 'saved' && 'Saved.'}
          {state.status === 'error' && state.message}
        </p>
      </div>
    </form>
  );
}
