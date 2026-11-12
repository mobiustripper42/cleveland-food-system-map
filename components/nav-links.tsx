'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Map' },
  { href: '/locations', label: 'List' },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-3">
      {LINKS.map(({ href, label }) => {
        const current =
          href === '/' ? pathname === '/' : pathname.startsWith(href);
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
