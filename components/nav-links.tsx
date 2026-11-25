'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';

const LINKS = [
  { href: '/', label: 'Map' },
  { href: '/locations', label: 'All locations' },
];

function Links({ pathname }: { pathname: string | null }) {
  return (
    <div className="flex items-center gap-x-4">
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
                ? 'inline-flex min-h-11 items-center whitespace-nowrap font-semibold text-foreground no-underline'
                : 'link inline-flex min-h-11 items-center whitespace-nowrap'
            }
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
