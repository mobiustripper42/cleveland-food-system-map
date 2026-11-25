import { CategoryIcon } from '@/components/locations/category-icon';
import {
  CATEGORIES,
  CATEGORY_COLORS as ACCENT,
  CATEGORY_ON_COLORS,
} from '@/lib/locations';
import type { Category } from '@/lib/types';

const LABELS: Record<Category, string> = {
  garden: 'Gardens',
  farm: 'Farms',
  market: 'Markets',
};

interface Props {
  activeCategories: Category[];
  counts: Record<Category, number>;
  onChange: (categories: Category[]) => void;
}

/**
 * Category toggles, doubling as the map legend: each pill shows the same
 * glyph as its pins. On = filled, off = outline (fill, not hue, carries the
 * state). Wraps instead of scrolling sideways.
 */
export default function CategoryFilter({
  activeCategories,
  counts,
  onChange,
}: Props) {
  function toggle(cat: Category) {
    const isActive = activeCategories.includes(cat);
    // Prevent deselecting the last active button
    if (isActive && activeCategories.length === 1) return;
    const next = isActive
      ? activeCategories.filter((c) => c !== cat)
      : [...activeCategories, cat];
    onChange(next);
  }

  return (
    <div
      role="group"
      aria-label="Show categories"
      className="flex flex-wrap gap-2 border-b border-border bg-background px-3 py-2"
    >
      {CATEGORIES.map((cat) => {
        const active = activeCategories.includes(cat);
        const isLast = active && activeCategories.length === 1;
        return (
          <button
            key={cat}
            type="button"
            onClick={() => toggle(cat)}
            aria-disabled={isLast}
            aria-pressed={active}
            title={isLast ? 'At least one category stays on' : undefined}
            className={`inline-flex min-h-11 shrink-0 touch-manipulation items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none ${
              isLast ? 'cursor-default' : 'cursor-pointer'
            }`}
            style={{
              borderColor: ACCENT[cat],
              backgroundColor: active ? ACCENT[cat] : 'transparent',
              // Off: dark text (amber text on white is under 4.5:1).
              color: active ? CATEGORY_ON_COLORS[cat] : undefined,
            }}
          >
            <CategoryIcon category={cat} className="size-4" />
            {LABELS[cat]}
            <span className="text-xs font-semibold tabular-nums">
              {counts[cat]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
