'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';

const LINKS = [
  { href: '/', label: 'Map' },
  { href: '/locations', label: 'List' },
];

function Links({ pathname }: { pathname: string | null }) {
  return (
    <div className="flex items-center gap-3">
      {LINKS.map(({ href, label }) => {
        const current =
          pathname !== null &&
          (href === '/' ? pathname === '/' : pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? 'page' : undefined}
            className={
              current
                ? 'font-semibold text-neutral-900 no-underline'
                : 'underline underline-offset-4'
            }
            style={current ? undefined : { color: '#1d4ed8' }}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}

function CurrentLinks() {
  return <Links pathname={usePathname()} />;
}

// Routes with params unknown at build (/locations/[id]/edit) can't read the
// pathname while prerendering: the fallback shows the links unhighlighted.
export function NavLinks() {
  return (
    <Suspense fallback={<Links pathname={null} />}>
      <CurrentLinks />
    </Suspense>
  );
}
