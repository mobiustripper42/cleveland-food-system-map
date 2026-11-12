/**
 * /locations URL state: ?category=garden&category=farm&q=oak&view=list.
 * Client + server safe. Defaults are omitted from the URL.
 */
import { CATEGORIES } from '@/lib/locations';
import type { Category } from '@/lib/types';

export const VIEWS = ['tiles', 'list'] as const;
export type BrowseView = (typeof VIEWS)[number];

export type BrowseState = {
  categories: Category[];
  q: string;
  view: BrowseView;
};

type Params = Record<string, string | string[] | undefined>;

const all = (v: string | string[] | undefined) =>
  v === undefined ? [] : Array.isArray(v) ? v : [v];

export function parseBrowseParams(params: Params): BrowseState {
  const picked = all(params.category).flatMap((c) => c.split(','));
  const categories = CATEGORIES.filter((c) => picked.includes(c));
  const view = all(params.view)[0];
  return {
    categories: categories.length ? categories : CATEGORIES,
    q: (all(params.q)[0] ?? '').slice(0, 200),
    view: VIEWS.includes(view as BrowseView) ? (view as BrowseView) : 'tiles',
  };
}

/** '?category=garden&q=oak' or '' when everything is default. */
export function browseQuery({ categories, q, view }: BrowseState): string {
  const sp = new URLSearchParams();
  if (categories.length < CATEGORIES.length) {
    for (const c of CATEGORIES)
      if (categories.includes(c)) sp.append('category', c);
  }
  if (q.trim()) sp.set('q', q.trim());
  if (view !== 'tiles') sp.set('view', view);
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** Name-only, case-insensitive match. */
export function matchesName(name: string, q: string): boolean {
  const needle = q.trim().toLowerCase();
  return !needle || name.toLowerCase().includes(needle);
}
