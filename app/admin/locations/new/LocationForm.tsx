'use client';

import {
  startTransition,
  useActionState,
  useRef,
  useState,
  useTransition,
} from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  CATEGORY_LABELS,
  LOCATION_LIMITS,
  type LocationField,
  STATUS_LABELS,
} from '@/lib/locations';
import {
  createLocation,
  type CreateLocationState,
  findCoordinates,
  type FindCoordinatesResult,
} from './actions';

function savedMessage(s: Extract<CreateLocationState, { status: 'saved' }>) {
  const pin =
    s.geocoded === 'found'
      ? ' Coordinates were looked up from the address.'
      : s.geocoded === 'not-found'
        ? ' No coordinates found for the address, so it has no pin yet.'
        : '';
  const where = s.published
    ? ' It’s on the map.'
    : ' It won’t be on the map until it’s published.';
  return `Created ${s.name}.${pin}${where}`;
}

const fieldClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm';

export function LocationForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    async (prev: CreateLocationState, formData: FormData) => {
      const next = await createLocation(prev, formData);
      if (next.status === 'saved') {
        formRef.current?.reset();
        setLookup(null);
      }
      return next;
    },
    { status: 'idle' },
  );
  const errors = state.status === 'error' ? (state.errors ?? {}) : {};

  const [lookup, setLookup] = useState<FindCoordinatesResult | null>(null);
  const [looking, startLookup] = useTransition();
  function lookUp() {
    const form = formRef.current!;
    const data = new FormData(form);
    const get = (k: string) => (data.get(k) as string | null) ?? null;
    startLookup(async () => {
      const result = await findCoordinates({
        street: get('street'),
        city: get('city'),
        state: get('state'),
        zip: get('zip'),
      });
      if (result.status === 'found') {
        // Uncontrolled inputs: write straight to the DOM so typed values in
        // other fields are untouched.
        (form.elements.namedItem('lat') as HTMLInputElement).value = String(
          result.lat,
        );
        (form.elements.namedItem('lng') as HTMLInputElement).value = String(
          result.lng,
        );
      }
      setLookup(result);
    });
  }

  // Submit manually: a plain `action={…}` resets the form after every
  // submit, which would wipe the editor's input on a validation error.
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => formAction(formData));
  }

  const field = (name: LocationField) => ({
    id: `loc-${name}`,
    name,
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `loc-${name}-error` : undefined,
  });
  const error = (name: LocationField) =>
    errors[name] && (
      <p id={`loc-${name}-error`} className="text-sm font-medium">
        {errors[name]}
      </p>
    );

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor="loc-name">Name *</Label>
        <Input {...field('name')} required maxLength={LOCATION_LIMITS.name} />
        {error('name')}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor="loc-category">Category *</Label>
          <select
            {...field('category')}
            required
            defaultValue=""
            className={fieldClass}
          >
            <option value="" disabled>
              Choose…
            </option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {error('category')}
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor="loc-status">Status</Label>
          <select
            {...field('status')}
            defaultValue="draft"
            className={fieldClass}
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {error('status')}
        </div>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">Address</legend>
        <div className="flex flex-col gap-1">
          <Label htmlFor="loc-street">Street</Label>
          <Input
            {...field('street')}
            maxLength={LOCATION_LIMITS.street}
            autoComplete="off"
            placeholder="1200 Starkweather Ave"
          />
          {error('street')}
        </div>
        <div className="grid grid-cols-[1fr_4.5rem] gap-3 sm:grid-cols-[1fr_4.5rem_7rem]">
          <div className="flex flex-col gap-1">
            <Label htmlFor="loc-city">City</Label>
            <Input
              {...field('city')}
              maxLength={LOCATION_LIMITS.city}
              defaultValue="Cleveland"
            />
            {error('city')}
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="loc-state">State</Label>
            <Input
              {...field('state')}
              maxLength={2}
              defaultValue="OH"
              autoCapitalize="characters"
            />
            {error('state')}
          </div>
          <div className="col-span-2 flex flex-col gap-1 sm:col-span-1">
            <Label htmlFor="loc-zip">ZIP</Label>
            <Input
              {...field('zip')}
              inputMode="numeric"
              maxLength={10}
              placeholder="44113"
            />
            {error('zip')}
          </div>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Coordinates</legend>
        <div className="flex flex-col gap-1">
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={lookUp}
              disabled={looking}
            >
              {looking ? 'Looking up…' : 'Find coordinates from address'}
            </Button>
          </div>
          <p role="status" className="text-sm">
            {lookup?.status === 'error' && lookup.message}
            {lookup?.status === 'found' && (
              <>
                Matched {lookup.matched}.{' '}
                {lookup.outside && 'That’s outside Cleveland — double-check. '}
                <a
                  href={`https://www.openstreetmap.org/?mlat=${lookup.lat}&mlon=${lookup.lng}#map=18/${lookup.lat}/${lookup.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4"
                  style={{ color: '#1d4ed8' }}
                >
                  Check the pin
                </a>
              </>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            Left blank, they&apos;re looked up from the address on save. Without
            coordinates the location won&apos;t show on the map.
          </p>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex flex-1 flex-col gap-1">
            <Label htmlFor="loc-lat">Latitude</Label>
            <Input
              {...field('lat')}
              type="number"
              inputMode="decimal"
              step="any"
              min={-90}
              max={90}
              placeholder="41.4993"
            />
            {error('lat')}
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <Label htmlFor="loc-lng">Longitude</Label>
            <Input
              {...field('lng')}
              type="number"
              inputMode="decimal"
              step="any"
              min={-180}
              max={180}
              placeholder="-81.6944"
            />
            {error('lng')}
          </div>
        </div>
      </fieldset>

      <div className="flex flex-col gap-1 sm:w-32">
        <Label htmlFor="loc-ward">Ward</Label>
        <Input
          {...field('ward')}
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
        />
        {error('ward')}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="loc-website">Website</Label>
        <Input
          {...field('website')}
          type="url"
          maxLength={LOCATION_LIMITS.website}
          placeholder="https://"
        />
        {error('website')}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="loc-notes">Notes</Label>
        <textarea
          {...field('notes')}
          rows={4}
          maxLength={LOCATION_LIMITS.notes}
          className={fieldClass}
        />
        {error('notes')}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create location'}
        </Button>
        <p role="status" className="text-sm">
          {state.status === 'saved' && savedMessage(state)}
          {state.status === 'error' && state.message}
        </p>
      </div>
    </form>
  );
}
