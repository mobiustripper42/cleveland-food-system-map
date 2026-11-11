import { AuthButton } from '@/components/auth-button';
import { SiteSection } from '@/components/site-section';
import { getSiteSections } from '@/lib/db/queries';
import Link from 'next/link';
import { Suspense } from 'react';

// Top / content / footer. Section HTML comes from site_sections (editors
// change it at /admin/sections); empty sections render nothing.
export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sections = await getSiteSections();

  return (
    <div className="min-h-dvh flex flex-col">
      <nav className="shrink-0 w-full flex justify-center border-b border-b-foreground/10 h-14">
        <div className="w-full flex justify-between items-center gap-3 px-4 text-sm">
          <Link href={'/'} className="font-semibold truncate">
            Cleveland Food System Map
          </Link>
          <Suspense>
            <AuthButton />
          </Suspense>
        </div>
      </nav>
      <SiteSection html={sections.top} label="Introduction" />
      <main className="flex flex-col">{children}</main>
      <SiteSection
        html={sections.footer}
        label="Site footer"
        as="footer"
        className="mt-auto border-t border-t-foreground/10"
      />
    </div>
  );
}
