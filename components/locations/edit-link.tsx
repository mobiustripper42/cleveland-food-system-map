'use client';

import Link from 'next/link';
import { Suspense, use } from 'react';
import type { EditAccess } from '@/lib/types';

function Inner({
  access,
  id,
  className,
  style,
}: {
  access: EditAccess;
  id: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ids = use(access);
  if (ids !== 'all' && !ids.includes(id)) return null;
  return (
    <Link
      href={`/locations/${id}/edit`}
      className={className}
      style={{ color: '#1d4ed8', textDecoration: 'underline', ...style }}
    >
      Edit
    </Link>
  );
}

/**
 * "Edit" for editors and this location's owners; nothing for everyone else.
 * Suspends on the streamed access promise so cached pages render first.
 * Hiding it is UX — the edit page and updateLocation check again.
 */
export default function EditLink(props: {
  access: EditAccess;
  id: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <Suspense fallback={null}>
      <Inner {...props} />
    </Suspense>
  );
}
