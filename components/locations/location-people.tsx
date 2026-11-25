'use client';

import {
  startTransition,
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmButton, ConfirmDialog } from '@/components/ui/confirm-button';
import { FieldError, FormStatus } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { focusFirstInvalid } from '@/hooks/use-unsaved-changes-guard';
import {
  addPerson,
  type PeopleActionState,
  type PersonField,
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

/** Checkbox sized for touch, inside its label so the label is the hit area. */
const CHECKBOX = 'size-5 shrink-0 cursor-pointer accent-foreground';
const CHECK_LABEL =
  'flex min-h-11 cursor-pointer items-center gap-3 font-normal';

/** Marks an input invalid when the last error names it. */
function invalid(state: PeopleActionState, name: PersonField, id: string) {
  const bad = state.status === 'error' && state.field === name;
  return {
    'aria-invalid': bad || undefined,
    'aria-describedby': bad ? `${id}-error` : undefined,
  };
}

function PersonFieldError({
  state,
  name,
  id,
}: {
  state: PeopleActionState;
  name: PersonField;
  id: string;
}) {
  return (
    <FieldError id={`${id}-error`}>
      {state.status === 'error' && state.field === name && state.message}
    </FieldError>
  );
}

/** Form-level message, unless it's already shown under a field. */
const formMessage = (state: PeopleActionState) =>
  state.status === 'idle' || (state.status === 'error' && state.field)
    ? null
    : state.message;

/** A removed row takes focus with it: park focus on the section heading. */
const focusPeopleHeading = () =>
  document.getElementById('people-heading')?.focus();

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
        <h2
          id="people-heading"
          tabIndex={-1}
          className="text-lg font-semibold focus:outline-none"
        >
          {editor ? 'People' : 'Contacts'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {editor
            ? 'Contacts are the managers listed for editors. People who can edit may change this location’s details but not publish, unpublish, or archive it.'
            : 'Managers listed for editors. Not shown to the public.'}
        </p>
      </div>

      {people.length > 0 ? (
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
      ) : (
        <p className="text-sm text-muted-foreground">
          No one yet. Add someone below.
        </p>
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium break-words">{label}</p>
          {person.name && person.email && (
            <p className="text-sm break-all">{person.email}</p>
          )}
          {person.phone && (
            <p className="text-sm">{formatPhone(person.phone)}</p>
          )}
          {person.contact?.claimed && (
            <p className="text-sm text-muted-foreground">
              Linked account — they can also edit this on their account page.
            </p>
          )}
        </div>
        {/* gap-4: keep the destructive action clear of Edit. */}
        <div className="flex flex-wrap items-center gap-4">
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

      <div className="flex flex-wrap gap-x-6">
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
            confirmOff={{
              title: `Stop ${label} editing this location?`,
              description:
                'They lose edit access right away. You can give it back later.',
              confirmLabel: 'Remove access',
            }}
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
  confirmOff,
}: {
  locationId: string;
  action: Bound;
  checked: boolean;
  label: string;
  disabled?: boolean;
  title?: string;
  hidden: Record<string, string | undefined>;
  /** Ask before unchecking (it takes something away). */
  confirmOff?: { title: string; description: string; confirmLabel: string };
}) {
  const id = useId();
  const [state, formAction, pending] = useActionState(
    action.bind(null, locationId),
    idle,
  );
  const [confirming, setConfirming] = useState(false);

  function save(on: boolean) {
    const formData = new FormData();
    for (const [k, v] of Object.entries(hidden)) if (v) formData.set(k, v);
    formData.set('on', on ? '1' : '');
    startTransition(() => formAction(formData));
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const on = e.currentTarget.checked;
    if (!on && confirmOff) setConfirming(true);
    else save(on);
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3" title={title}>
      <Label htmlFor={id} className={CHECK_LABEL}>
        <input
          id={id}
          type="checkbox"
          className={CHECKBOX}
          checked={checked}
          disabled={disabled || pending}
          onChange={onChange}
        />
        {label}
      </Label>
      <FormStatus tone={state.status === 'error' ? 'error' : 'info'}>
        {pending ? 'Saving…' : state.status === 'error' && state.message}
      </FormStatus>
      {confirmOff && (
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          {...confirmOff}
          onConfirm={() => save(false)}
        />
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
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    async (prev: PeopleActionState, formData: FormData) => {
      const next = await updateContact(locationId, prev, formData);
      if (next.status === 'done') onSaved();
      return next;
    },
    idle,
  );
  useEffect(() => {
    if (state.status === 'error') focusFirstInvalid(formRef.current);
  }, [state]);

  // Manual submit so a validation error keeps what was typed.
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => formAction(formData));
  }

  const emailInvalid = invalid(state, 'email', emailId);

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-3">
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
          aria-invalid={emailInvalid['aria-invalid']}
          aria-describedby={
            claimed ? `${emailId}-note` : emailInvalid['aria-describedby']
          }
        />
        <PersonFieldError state={state} name="email" id={emailId} />
        {claimed && (
          <p id={`${emailId}-note`} className="text-sm text-muted-foreground">
            Locked: this contact is linked to an account, so its email follows
            their sign-in email.
          </p>
        )}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor={nameId}>Name</Label>
          <Input
            id={nameId}
            name="name"
            maxLength={200}
            defaultValue={name ?? ''}
            {...invalid(state, 'name', nameId)}
          />
          <PersonFieldError state={state} name="name" id={nameId} />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor={phoneId}>Phone</Label>
          <Input
            id={phoneId}
            name="phone"
            type="tel"
            autoComplete="off"
            defaultValue={phone ? formatPhone(phone) : ''}
            {...invalid(state, 'phone', phoneId)}
          />
          <PersonFieldError state={state} name="phone" id={phoneId} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save contact'}
        </Button>
        <FormStatus tone="error">{formMessage(state)}</FormStatus>
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
    async (prev: PeopleActionState, formData: FormData) => {
      const next = await removePerson(locationId, prev, formData);
      if (next.status === 'done') focusPeopleHeading();
      return next;
    },
    idle,
  );

  function remove() {
    const formData = new FormData();
    if (person.contact) formData.set('contact_id', person.contact.id);
    if (person.owner) formData.set('user_id', person.owner.user_id);
    startTransition(() => formAction(formData));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ConfirmButton
        size="sm"
        disabled={pending}
        aria-label={`Remove ${label}`}
        title={`Remove ${label} from this location?`}
        description={
          person.owner
            ? 'They stop being listed here and lose edit access.'
            : 'They stop being listed as a contact here. Their details stay on any other locations.'
        }
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
  useEffect(() => {
    if (state.status === 'error') focusFirstInvalid(formRef.current);
  }, [state]);

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
          {...invalid(state, 'email', 'person-email')}
        />
        <PersonFieldError state={state} name="email" id="person-email" />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor="person-name">Name</Label>
          <Input
            id="person-name"
            name="name"
            maxLength={200}
            autoComplete="off"
            {...invalid(state, 'name', 'person-name')}
          />
          <PersonFieldError state={state} name="name" id="person-name" />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor="person-phone">Phone</Label>
          <Input
            id="person-phone"
            name="phone"
            type="tel"
            autoComplete="off"
            {...invalid(state, 'phone', 'person-phone')}
          />
          <PersonFieldError state={state} name="phone" id="person-phone" />
        </div>
      </div>
      {editor ? (
        <fieldset className="flex flex-wrap gap-x-6">
          <legend className="sr-only">Roles</legend>
          <Label htmlFor="person-contact" className={CHECK_LABEL}>
            <input
              id="person-contact"
              name="contact"
              type="checkbox"
              className={CHECKBOX}
              defaultChecked
            />
            Contact
          </Label>
          <Label htmlFor="person-owner" className={CHECK_LABEL}>
            <input
              id="person-owner"
              name="owner"
              type="checkbox"
              className={CHECKBOX}
            />
            Can edit
          </Label>
        </fieldset>
      ) : (
        <input type="hidden" name="contact" value="on" />
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Adding…' : 'Add'}
        </Button>
        <FormStatus tone={state.status === 'done' ? 'success' : 'error'}>
          {formMessage(state)}
        </FormStatus>
      </div>
      <p className="text-sm text-muted-foreground">
        Entering an email of an existing contact will add them as a link with
        their existing details.
        {editor &&
          ' When a contact is added with "Can edit", an account is created if they don’t have one — they sign in with an emailed code or Google using that address.'}
      </p>
    </form>
  );
}
