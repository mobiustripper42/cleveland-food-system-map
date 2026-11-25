import { SiteHeader } from '@/components/site-header';
import { SiteSection } from '@/components/site-section';
import { getSiteSections } from '@/lib/db/queries';

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
      <SiteHeader />
      <SiteSection html={sections.top} label="Introduction" />
      <main
        id="main"
        tabIndex={-1}
        className="flex flex-col focus:outline-none"
      >
        {children}
      </main>
      <SiteSection
        html={sections.footer}
        label="Site footer"
        as="footer"
        className="mt-auto border-t border-t-foreground/10"
      />
    </div>
  );
}
