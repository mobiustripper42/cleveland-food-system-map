import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { SiteSection } from '@/components/site-section';
import { getEditorSections } from '@/lib/db/queries';
import {
  sanitizeSectionHtml,
  SECTION_KEYS,
  SECTION_LABELS,
  SECTION_MAX_LENGTH,
} from '@/lib/sections';
import { getSession } from '@/lib/session';
import { SectionForm } from './SectionForm';

export const metadata = { title: 'Site text' };

export default function SectionsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-10">
      <div>
        <Link
          href="/admin"
          className="text-sm underline underline-offset-4"
          style={{ color: '#1d4ed8' }}
        >
          ← Admin
        </Link>
      </div>
      <h1 className="text-2xl font-semibold">Site text</h1>
      <p className="text-sm">
        HTML shown above the map and in the footer. Allowed: headings,
        paragraphs, lists, links, images (https), bold/italic. Anything else is
        removed on save. Leave a section empty to hide it.
      </p>
      <Suspense fallback={<p className="text-sm">Loading…</p>}>
        <Sections />
      </Suspense>
    </div>
  );
}

async function Sections() {
  if (!(await getSession())) redirect('/login');
  const sections = await getEditorSections();
  if (!sections) notFound();

  return SECTION_KEYS.map((key) => (
    <div key={key} className="flex flex-col gap-3">
      <SectionForm
        sectionKey={key}
        label={SECTION_LABELS[key]}
        initialHtml={sections[key]}
        maxLength={SECTION_MAX_LENGTH}
      />
      <div className="rounded-md border border-dashed border-foreground/20">
        <p className="px-4 pt-2 text-xs text-muted-foreground">
          Live preview (as saved)
        </p>
        <SiteSection
          html={sanitizeSectionHtml(sections[key])}
          label={`${SECTION_LABELS[key]} preview`}
        />
      </div>
    </div>
  ));
}
