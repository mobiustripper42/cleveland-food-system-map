import { X } from 'lucide-react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/** `id` lets the panel return focus here if its opener disappeared. */
export const SEARCH_INPUT_ID = 'map-search';

export default function SearchBar({
  value,
  onChange,
  placeholder = 'Search by name or notes…',
}: Props) {
  return (
    <div className="relative bg-background px-3 pt-2">
      <input
        id={SEARCH_INPUT_ID}
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Search locations"
        // 16px on mobile: smaller makes iOS zoom on focus. The native cancel
        // button is hidden; ours below is bigger.
        className="h-11 w-full appearance-none rounded-md border border-input bg-background pl-3 pr-12 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute bottom-0 right-3 flex size-11 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X aria-hidden className="size-5" />
        </button>
      )}
    </div>
  );
}
