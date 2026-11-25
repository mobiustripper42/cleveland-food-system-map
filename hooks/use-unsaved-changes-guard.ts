'use client';

import { useEffect } from 'react';

/**
 * Warn before closing or reloading the tab while `dirty`. Only the browser's
 * own prompt is possible here (in-app links aren't intercepted), and it never
 * fires when nothing changed.
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Legacy browsers need returnValue set to show the prompt.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);
}

/** Focus the first `[aria-invalid="true"]` control inside `form`. */
export function focusFirstInvalid(form: HTMLFormElement | null) {
  form
    ?.querySelector<HTMLElement>('[aria-invalid="true"]')
    ?.focus({ preventScroll: false });
}
