import { SiteHeader } from '@/components/site-header';

/**
 * Layout for routes outside `(site)` (admin, account, login): the same header
 * as the public pages, without the editor-authored top/footer sections.
 */
export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col">
      <SiteHeader />
      <main
        id="main"
        tabIndex={-1}
        className="flex flex-1 flex-col focus:outline-none"
      >
        {children}
      </main>
    </div>
  );
}
