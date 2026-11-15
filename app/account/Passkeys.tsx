'use client';

import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

type Passkey = { id: string; name: string | null; createdAt: string | null };

export function Passkeys({ passkeys }: { passkeys: Passkey[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const run = (call: () => Promise<{ error: { message?: string } | null }>) => {
    setMessage(null);
    startTransition(async () => {
      const { error } = await call();
      if (error) setMessage(error.message ?? 'Something went wrong');
      else router.refresh();
    });
  };

  const add = () => {
    // Cancel = don't open the browser's passkey dialog; blank = no name.
    const name = window.prompt('Name this passkey (e.g. "My phone")', '');
    if (name === null) return;
    run(() =>
      authClient.passkey.addPasskey({ name: name.trim() || undefined }),
    );
  };

  const remove = (p: Passkey) => {
    if (!window.confirm(`Remove passkey "${p.name ?? 'Unnamed'}"?`)) return;
    run(() => authClient.passkey.deletePasskey({ id: p.id }));
  };

  return (
    <section aria-labelledby="passkeys-heading" className="flex flex-col gap-3">
      <h2 id="passkeys-heading" className="text-lg font-semibold">
        Passkeys
      </h2>
      <p className="text-sm">
        Sign in with your fingerprint, face, or device PIN instead of an email
        code.
      </p>
      {passkeys.length > 0 && (
        <ul className="flex flex-col gap-2">
          {passkeys.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"
            >
              <span>
                {p.name ?? 'Unnamed passkey'}
                {p.createdAt && (
                  <span className="block text-xs opacity-70">
                    Added {new Date(p.createdAt).toLocaleDateString()}
                  </span>
                )}
              </span>
              {/* Destructive = dark, never red (CLAUDE.md design rules). */}
              <Button size="sm" disabled={pending} onClick={() => remove(p)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button
        variant="outline"
        className="w-full"
        disabled={pending}
        onClick={add}
      >
        {pending ? 'Working…' : 'Add a passkey'}
      </Button>
      {message && (
        <p role="alert" className="text-sm font-medium">
          {message}
        </p>
      )}
    </section>
  );
}
