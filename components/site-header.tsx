import Link from 'next/link';
import { Suspense } from 'react';
import { AuthButton } from '@/components/auth-button';
import { NavLinks } from '@/components/nav-links';

/**
 * Site header + skip link, shared by every page shell so navigation stays in
 * the same place everywhere. Pages put their content in `<main id="main">`.
 * Wraps at 320px instead of overflowing: title on its own row if needed.
 */
export function SiteHeader() {
  return (
    <>
      <a
        href="#main"
        className="sr-only-focusable fixed left-2 top-2 z-[1300] rounded-md bg-background px-4 py-3 font-medium shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Skip to content
      </a>
      <header className="w-full shrink-0 border-b border-b-foreground/10">
        <div className="flex min-h-14 w-full flex-wrap items-center justify-between gap-x-4 px-4 text-sm">
          <Link
            href="/"
            className="inline-flex min-h-11 min-w-0 items-center font-semibold"
          >
            <span className="truncate">Cleveland Food System Map</span>
          </Link>
          <nav
            aria-label="Main"
            className="flex min-w-0 flex-wrap items-center gap-x-4"
          >
            <NavLinks />
            <Suspense>
              <AuthButton />
            </Suspense>
          </nav>
        </div>
      </header>
    </>
  );
}
