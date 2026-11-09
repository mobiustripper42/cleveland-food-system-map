import 'server-only';
import { headers } from 'next/headers';
import { cache } from 'react';
import { auth } from './auth';

/**
 * The verified BetterAuth session for this request, or null. Reads cookies:
 * never call inside 'use cache'. Deduped per request.
 */
export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);
