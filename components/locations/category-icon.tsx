import { Leaf, ShoppingBasket, Tractor, type LucideIcon } from 'lucide-react';
import type { Category } from '@/lib/types';

/**
 * One glyph per category, so categories never rely on color alone (pins,
 * filter pills, tags, list rows). Lucide, so it matches the other icons.
 */
export const CATEGORY_ICONS: Record<Category, LucideIcon> = {
  garden: Leaf,
  farm: Tractor,
  market: ShoppingBasket,
};

export function CategoryIcon({
  category,
  className = 'size-4',
}: {
  category: Category;
  className?: string;
}) {
  const Icon = CATEGORY_ICONS[category];
  return <Icon aria-hidden className={`shrink-0 ${className}`} />;
}

/**
 * The same glyphs as raw SVG children (24×24 lucide coordinates), for Leaflet
 * DivIcon HTML where React components can't render. Keep in sync with
 * CATEGORY_ICONS (paths copied from lucide-react).
 */
export const CATEGORY_GLYPH_SVG: Record<Category, string> = {
  garden:
    '<path d="M11 20a10 10 0 0010-10 25.9 25.9 0 00-1.04-7.281 1 1 0 00-1.755-.325C15.833 5.5 13 5.5 9.8 6.1A7 7 0 0011 20"/>' +
    '<path d="M2 21a5 5 0 012.911-4.544C7.613 15.212 8.351 15.24 11 13"/>',
  farm:
    '<path d="m10 11 11 .9a1 1 0 0 1 .8 1.1l-.665 4.158a1 1 0 0 1-.988.842H20"/>' +
    '<path d="M16 18h-5"/><path d="M18 5a1 1 0 0 0-1 1v5.573"/>' +
    '<path d="M3 4h8.129a1 1 0 0 1 .99.863L13 11.246"/><path d="M4 11V4"/>' +
    '<path d="M7 15h.01"/><path d="M8 10.1V4"/>' +
    '<circle cx="18" cy="18" r="2"/><circle cx="7" cy="15" r="5"/>',
  market:
    '<path d="m15 11-1 9"/><path d="m19 11-4-7"/><path d="M2 11h20"/>' +
    '<path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4"/>' +
    '<path d="M4.5 15.5h15"/><path d="m5 11 4-7"/><path d="m9 11 1 9"/>',
};
