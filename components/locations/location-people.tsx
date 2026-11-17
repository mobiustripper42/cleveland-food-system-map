'use client';

import {
  startTransition,
  useActionState,
  useId,
  useRef,
  useState,
} from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  addPerson,
  type PeopleActionState,
  removePerson,
  setContact,
  setOwner,
  updateContact,
} from '@/app/(site)/locations/people-actions';
import { formatPhone } from '@/lib/format';
import type { LocationPerson } from '@/lib/types';

const idle: PeopleActionState = { status: 'idle' };

type Bound = (
  locationId: string,
  prev: PeopleActionState,
  formData: FormData,
) => Promise<PeopleActionState>;

/**
 * Contacts and owners for one location as a single list of people. Editors
 * see both roles; a location's owners see and manage its contacts only.
 */
export function LocationPeople({
  locationId,
  people,
  editor,
}: {
  locationId: string;
  people: LocationPerson[];
  editor: boolean;
}) {
  return (
    <section aria-labelledby="people-heading" className="flex flex-col gap-3">
      <div>
        <h2 id="people-heading" className="text-lg font-semibold">
          {editor ? 'People' : 'Contacts'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {editor
            ? 'Contacts are the managers listed for editors. People who can edit may change this location’s details but not publish, unpublish, or archive it.'
            : 'Managers listed for editors. Not shown to the public.'}
        </p>
      </div>

      {people.length > 0 && (
        <ul className="flex flex-col divide-y divide-foreground/10 border-y border-foreground/10">
          {people.map((p) => (
            <PersonRow
              key={p.key}
              locationId={locationId}
              person={p}
              editor={editor}
            />
          ))}
        </ul>
      )}

      <AddPersonForm locationId={locationId} editor={editor} />
    </section>
  );
}

function PersonRow({
  locationId,
  person,
  editor,
}: {
  locationId: string;
  person: LocationPerson;
  editor: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const label = person.name ?? person.email ?? person.phone ?? 'Unnamed';

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium break-words">{label}</p>
          {person.name && person.email && (
            <p className="text-sm break-all">{person.email}</p>
          )}
          {person.phone && (
            <p className="text-sm">{formatPhone(person.phone)}</p>
          )}
          {person.contact?.claimed && (
            <p className="text-xs text-muted-foreground">
              Linked account — they can also edit this on their account page.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {person.contact?.editable && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-expanded={editing}
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? 'Close' : 'Edit'}
            </Button>
          )}
          <RemoveButton locationId={locationId} person={person} label={label} />
        </div>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Toggle
          locationId={locationId}
          action={setContact}
          checked={person.contact != null}
          label="Contact"
          // Only an owner row (editors) can gain a contact here.
          disabled={!person.contact && !person.owner}
          hidden={{
            contact_id: person.contact?.id,
            user_id: person.owner?.user_id,
          }}
        />
        {editor && (
          <Toggle
            locationId={locationId}
            action={setOwner}
            checked={person.owner != null}
            label="Can edit"
            disabled={!person.owner && !person.email}
            title={
              !person.owner && !person.email ? 'Needs an email' : undefined
            }
            hidden={{
              user_id: person.owner?.user_id,
              email: person.email ?? undefined,
            }}
          />
        )}
      </div>

      {editing && person.contact && (
        <EditContactForm
          locationId={locationId}
          contactId={person.contact.id}
          name={person.name}
          phone={person.phone}
          email={person.email}
          claimed={person.contact.claimed}
          onSaved={() => setEditing(false)}
        />
      )}
    </li>
  );
}

/** A checkbox that saves on change. */
function Toggle({
  locationId,
  action,
  checked,
  label,
  disabled,
  title,
  hidden,
}: {
  locationId: string;
  action: Bound;
  checked: boolean;
  label: string;
  disabled?: boolean;
  title?: string;
  hidden: Record<string, string | undefined>;
}) {
  const id = useId();
  const [state, formAction, pending] = useActionState(
    action.bind(null, locationId),
    idle,
  );

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formData = new FormData();
    for (const [k, v] of Object.entries(hidden)) if (v) formData.set(k, v);
    formData.set('on', e.currentTarget.checked ? '1' : '');
    startTransition(() => formAction(formData));
  }

  return (
    <div className="flex items-center gap-2" title={title}>
      <input
        id={id}
        type="checkbox"
        className="size-4"
        checked={checked}
        disabled={disabled || pending}
        onChange={onChange}
      />
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
      {pending && (
        <span className="text-xs text-muted-foreground">Saving…</span>
      )}
      {state.status === 'error' && (
        <span role="status" className="text-sm">
          {state.message}
        </span>
      )}
    </div>
  );
}

function EditContactForm({
  locationId,
  contactId,
  name,
  phone,
  email,
  claimed,
  onSaved,
}: {
  locationId: string;
  contactId: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  claimed: boolean;
  onSaved: () => void;
}) {
  const nameId = useId();
  const phoneId = useId();
  const emailId = useId();
  const [state, formAction, pending] = useActionState(
    async (prev: PeopleActionState, formData: FormData) => {
      const next = await updateContact(locationId, prev, formData);
      if (next.status === 'done') onSaved();
      return next;
    },
    idle,
  );

  // Manual submit so a validation error keeps what was typed.
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <input type="hidden" name="contact_id" value={contactId} />
      {/* A claimed email mirrors the account's sign-in email: not sent. */}
      <div className="flex flex-col gap-1">
        <Label htmlFor={emailId}>Email</Label>
        <Input
          id={emailId}
          name={claimed ? undefined : 'email'}
          type="email"
          maxLength={254}
          autoComplete="off"
          defaultValue={email ?? ''}
          // disabled (not readOnly) so it looks locked; with no name it
          // isn't submitted either way.
          disabled={claimed}
          aria-describedby={claimed ? `${emailId}-note` : undefined}
        />
        {claimed && (
          <p id={`${emailId}-note`} className="text-xs text-muted-foreground">
            Locked: this contact is linked to an account, so its email follows
            their sign-in email.
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor={nameId}>Name</Label>
          <Input
            id={nameId}
            name="name"
            maxLength={200}
            defaultValue={name ?? ''}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor={phoneId}>Phone</Label>
          <Input
            id={phoneId}
            name="phone"
            type="tel"
            defaultValue={phone ? formatPhone(phone) : ''}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Saving…' : 'Save contact'}
        </Button>
        <p role="status" className="text-sm">
          {state.status === 'error' && state.message}
        </p>
      </div>
    </form>
  );
}

function RemoveButton({
  locationId,
  person,
  label,
}: {
  locationId: string;
  person: LocationPerson;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(
    removePerson.bind(null, locationId),
    idle,
  );

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(`Remove ${label} from this location?`)) e.preventDefault();
      }}
      className="flex items-center gap-2"
    >
      {person.contact && (
        <input type="hidden" name="contact_id" value={person.contact.id} />
      )}
      {person.owner && (
        <input type="hidden" name="user_id" value={person.owner.user_id} />
      )}
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={pending}
        aria-label={`Remove ${label}`}
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

function AddPersonForm({
  locationId,
  editor,
}: {
  locationId: string;
  editor: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    async (prev: PeopleActionState, formData: FormData) => {
      const next = await addPerson(locationId, prev, formData);
      if (next.status === 'done') formRef.current?.reset();
      return next;
    },
    idle,
  );

  // Manual submit so a validation error keeps what was typed; reset on success.
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="flex flex-col gap-3"
      aria-labelledby="add-person-heading"
    >
      <h3 id="add-person-heading" className="font-medium">
        {editor ? 'Add a person' : 'Add a contact'}
      </h3>
      <div className="flex flex-col gap-1">
        <Label htmlFor="person-email">Email</Label>
        <Input
          id="person-email"
          name="email"
          type="email"
          maxLength={254}
          autoComplete="off"
          placeholder="someone@example.org"
        />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor="person-name">Name</Label>
          <Input
            id="person-name"
            name="name"
            maxLength={200}
            autoComplete="off"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor="person-phone">Phone</Label>
          <Input id="person-phone" name="phone" type="tel" autoComplete="off" />
        </div>
      </div>
      {editor ? (
        <fieldset className="flex flex-wrap gap-x-6 gap-y-2">
          <legend className="sr-only">Roles</legend>
          <div className="flex items-center gap-2">
            <input
              id="person-contact"
              name="contact"
              type="checkbox"
              className="size-4"
              defaultChecked
            />
            <Label htmlFor="person-contact" className="font-normal">
              Contact
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="person-owner"
              name="owner"
              type="checkbox"
              className="size-4"
            />
            <Label htmlFor="person-owner" className="font-normal">
              Can edit
            </Label>
          </div>
        </fieldset>
      ) : (
        <input type="hidden" name="contact" value="on" />
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Adding…' : 'Add'}
        </Button>
        <p role="status" className="text-sm">
          {state.status !== 'idle' && state.message}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Entering an email of an existing contact will add them as a link with
        their existing details.
        {editor &&
          ' When a contact is added with "Can edit", an account is created if they don’t have one — they sign in with an emailed code or Google using that address.'}
      </p>
    </form>
  );
}
