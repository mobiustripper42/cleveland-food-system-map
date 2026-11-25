import { CircleAlert, CircleCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A field's error, under the field. Icon + bold so it doesn't rely on color
 * (there is no red). Wire the field with `aria-invalid` and
 * `aria-describedby={id}`.
 */
export function FieldError({
  id,
  children,
  className,
}: {
  id?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <p
      id={id}
      className={cn(
        'flex items-start gap-1.5 text-sm font-semibold',
        className,
      )}
    >
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/**
 * A form-level status line that is always mounted, so screen readers announce
 * its changes (a live region that mounts with its content often isn't read).
 * `tone` picks the icon: errors and successes look different without color.
 */
export function FormStatus({
  tone,
  children,
  className,
  id,
}: {
  tone?: 'error' | 'success' | 'info';
  children?: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const Icon =
    tone === 'error' ? CircleAlert : tone === 'success' ? CircleCheck : null;
  return (
    <p
      id={id}
      role="status"
      className={cn(
        'flex min-h-5 items-start gap-1.5 text-sm',
        tone === 'error' && 'font-semibold',
        className,
      )}
    >
      {children && Icon && (
        <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      )}
      {children && <span>{children}</span>}
    </p>
  );
}
