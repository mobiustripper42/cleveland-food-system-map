import { CATEGORIES, CATEGORY_COLORS as ACCENT } from '@/lib/locations';
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
    <div style={styles.strip}>
      {CATEGORIES.map((cat) => {
        const active = activeCategories.includes(cat);
        const isLast = active && activeCategories.length === 1;
        return (
          <button
            key={cat}
            onClick={() => toggle(cat)}
            aria-disabled={isLast}
            aria-pressed={active}
            style={{
              ...styles.btn,
              borderColor: ACCENT[cat],
              backgroundColor: active ? ACCENT[cat] : 'transparent',
              color: active ? '#fff' : ACCENT[cat],
              cursor: isLast ? 'default' : 'pointer',
              opacity: isLast ? 0.85 : 1,
            }}
          >
            {LABELS[cat]} <span style={styles.count}>{counts[cat]}</span>
          </button>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  strip: {
    display: 'flex',
    flexWrap: 'nowrap',
    overflowX: 'auto',
    gap: '8px',
    padding: '10px 12px',
    backgroundColor: '#fff',
    borderBottom: '1px solid #e5e4e7',
    // hide scrollbar on mobile while keeping scrollability
    msOverflowStyle: 'none',
    scrollbarWidth: 'none',
  },
  btn: {
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 14px',
    border: '2px solid',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: 500,
    lineHeight: 1,
    transition: 'background-color 0.15s, color 0.15s',
    whiteSpace: 'nowrap',
  },
  count: {
    fontSize: '12px',
    fontWeight: 600,
    opacity: 0.9,
  },
};
