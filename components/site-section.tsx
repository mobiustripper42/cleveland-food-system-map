import { cn } from '@/lib/utils';

/**
 * Renders a site_sections slot. `html` must already be sanitized
 * (getSiteSections() does it) — this is the only dangerouslySetInnerHTML.
 */
export function SiteSection({
  html,
  label,
  as: Tag = 'section',
  className,
}: {
  html: string;
  label: string;
  as?: 'section' | 'footer';
  className?: string;
}) {
  if (!html) return null;
  return (
    <Tag aria-label={label} className={cn('w-full', className)}>
      <div
        className="site-section mx-auto max-w-3xl px-4 py-4"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </Tag>
  );
}
