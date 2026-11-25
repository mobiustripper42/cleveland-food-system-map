'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * "← All locations", back to the filtered list the visitor came from
 * (/locations keeps its filters in the URL). Falls back to the bare list.
 */
export function BackToList({ className }: { className?: string }) {
  const [href, setHref] = useState('/locations');
  useEffect(() => {
    if (!document.referrer) return;
    const from = new URL(document.referrer);
    if (
      from.origin === window.location.origin &&
      from.pathname === '/locations'
    ) {
      setHref(`/locations${from.search}`);
    }
  }, []);
  return (
    <Link href={href} className={className}>
      ← All locations
    </Link>
  );
}
