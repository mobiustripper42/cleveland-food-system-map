/**
 * /locations URL state: ?category=garden&status=draft&q=oak&view=list.
 * Client + server safe. Defaults are omitted from the URL. `status` only
 * matters to users with non-published rows; the list ignores it otherwise.
 */
import { CATEGORIES, STATUSES, type LocationStatus } from '@/lib/locations';
import type { Category } from '@/lib/types';

export const VIEWS = ['tiles', 'list'] as const;
export type BrowseView = (typeof VIEWS)[number];

export type BrowseState = {
  categories: Category[];
  statuses: LocationStatus[];
  q: string;
  view: BrowseView;
};

export const DEFAULT_STATUSES: LocationStatus[] = ['published'];

type Params = Record<string, string | string[] | undefined>;

const all = (v: string | string[] | undefined) =>
  v === undefined ? [] : Array.isArray(v) ? v : [v];

export function parseBrowseParams(params: Params): BrowseState {
  const picked = all(params.category).flatMap((c) => c.split(','));
  const categories = CATEGORIES.filter((c) => picked.includes(c));
  const pickedStatus = all(params.status).flatMap((s) => s.split(','));
  const statuses = STATUSES.filter((s) => pickedStatus.includes(s));
  const view = all(params.view)[0];
  return {
    categories: categories.length ? categories : CATEGORIES,
    statuses: statuses.length ? statuses : DEFAULT_STATUSES,
    q: (all(params.q)[0] ?? '').slice(0, 200),
    view: VIEWS.includes(view as BrowseView) ? (view as BrowseView) : 'tiles',
  };
}

/** '?category=garden&q=oak' or '' when everything is default. */
export function browseQuery({
  categories,
  statuses,
  q,
  view,
}: BrowseState): string {
  const sp = new URLSearchParams();
  if (categories.length < CATEGORIES.length) {
    for (const c of CATEGORIES)
      if (categories.includes(c)) sp.append('category', c);
  }
  if (
    statuses.length !== DEFAULT_STATUSES.length ||
    statuses.some((s) => !DEFAULT_STATUSES.includes(s))
  ) {
    for (const s of STATUSES) if (statuses.includes(s)) sp.append('status', s);
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
