import { useSyncExternalStore } from 'react';

const QUERY = '(min-width: 768px)';

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/**
 * Mobile-first: false during SSR and hydration, then the real value. Client
 * navigations read it synchronously, so there's no mobile-layout flash.
 * Prefer `md:` classes for layout; use this only where structure differs.
 */
export default function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
