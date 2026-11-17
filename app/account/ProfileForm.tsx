'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatPhone } from '@/lib/format';
import { type ProfileState, saveProfile } from './actions';

const idle: ProfileState = { status: 'idle' };

export function ProfileForm({
  email,
  name,
  phone,
}: {
  email: string;
  name: string | null;
  phone: string | null;
}) {
  const [state, formAction, pending] = useActionState(saveProfile, idle);
  const fieldError = (f: 'name' | 'phone') =>
    state.status === 'error' && state.field === f ? state.message : null;

  return (
    <section aria-labelledby="profile-heading" className="flex flex-col gap-3">
      <div>
        <h2 id="profile-heading" className="text-lg font-semibold">
          Contact info
        </h2>
        <p className="text-sm text-muted-foreground">
          Shown to site editors and to owners of locations that list you — never
          on the public map.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="profile-email">Email</Label>
          <Input id="profile-email" value={email} readOnly disabled />
          <p className="text-xs text-muted-foreground">Your sign-in email.</p>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="profile-name">Name</Label>
          <Input
            id="profile-name"
            name="name"
            defaultValue={name ?? ''}
            maxLength={200}
            autoComplete="name"
            aria-invalid={fieldError('name') ? true : undefined}
            aria-describedby={
              fieldError('name') ? 'profile-name-error' : undefined
            }
          />
          {fieldError('name') && (
            <p id="profile-name-error" className="text-sm">
              {fieldError('name')}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="profile-phone">Phone</Label>
          <Input
            id="profile-phone"
            name="phone"
            type="tel"
            defaultValue={phone ? formatPhone(phone) : ''}
            autoComplete="tel"
            placeholder="(216) 555-1234"
            aria-invalid={fieldError('phone') ? true : undefined}
            aria-describedby={
              fieldError('phone') ? 'profile-phone-error' : undefined
            }
          />
          {fieldError('phone') && (
            <p id="profile-phone-error" className="text-sm">
              {fieldError('phone')}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save'}
          </Button>
          <p role="status" className="text-sm">
            {state.status === 'saved' && state.message}
            {state.status === 'error' && !state.field && state.message}
          </p>
        </div>
      </form>
    </section>
  );
}
