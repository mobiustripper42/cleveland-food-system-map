import 'server-only';
import sanitizeHtml from 'sanitize-html';

/** Page slots backed by site_sections rows (seeded by migration). */
export const SECTION_KEYS = ['top', 'footer'] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export const SECTION_LABELS: Record<SectionKey, string> = {
  top: 'Top of page',
  footer: 'Footer',
};

export const SECTION_MAX_LENGTH = 20_000;

export function isSectionKey(key: unknown): key is SectionKey {
  return SECTION_KEYS.includes(key as SectionKey);
}

// Editors are trusted, but accounts get phished: no scripts, iframes, styles,
// event handlers, or classes (styling stays ours, see .site-section in
// globals.css).
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'h2',
    'h3',
    'h4',
    'strong',
    'em',
    'b',
    'i',
    'u',
    'a',
    'ul',
    'ol',
    'li',
    'br',
    'hr',
    'img',
    'blockquote',
    'span',
    'div',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['https'] },
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs:
        attribs.target === '_blank'
          ? { ...attribs, rel: 'noopener noreferrer' }
          : attribs,
    }),
  },
};

export function sanitizeSectionHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS).trim();
}
