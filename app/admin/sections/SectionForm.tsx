'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormStatus } from '@/components/ui/field-error';
import { Label } from '@/components/ui/label';
import { fieldClass } from '@/components/ui/input';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
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
  const [savedHtml, setSavedHtml] = useState(initialHtml);
  const [state, formAction, pending] = useActionState(
    async (prev: SaveSectionState, formData: FormData) => {
      const next = await saveSection(prev, formData);
      if (next.status === 'saved') {
        setHtml(next.html);
        setSavedHtml(next.html);
      }
      return next;
    },
    { status: 'idle' },
  );
  const dirty = html !== savedHtml;
  useUnsavedChangesGuard(dirty);
  const id = `section-${sectionKey}`;

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="key" value={sectionKey} />
      <Label htmlFor={id} className="text-base font-semibold">
        {label}
      </Label>
      <textarea
        id={id}
        name="html"
        value={html}
        onChange={(e) => setHtml(e.target.value)}
        maxLength={maxLength}
        rows={8}
        spellCheck={false}
        aria-describedby={`${id}-count`}
        // 16px on mobile: smaller text makes iOS zoom on focus.
        className={`${fieldClass} font-mono`}
      />
      <p
        id={`${id}-count`}
        className="text-right text-sm tabular-nums text-muted-foreground"
      >
        {html.length.toLocaleString()} / {maxLength.toLocaleString()} characters
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
        <FormStatus
          tone={state.status === 'error' ? 'error' : dirty ? 'info' : 'success'}
        >
          {state.status === 'error'
            ? state.message
            : dirty
              ? 'Unsaved changes.'
              : state.status === 'saved' && 'Saved.'}
        </FormStatus>
      </div>
    </form>
  );
}
