import 'server-only';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// DATABASE_URL connects as a role that bypasses RLS — every query must apply
// its own visibility rules (see queries.ts). Behind a transaction pooler (e.g.
// Supabase port 6543) prepared statements aren't supported, hence prepare: false.
const globalForDb = globalThis as { pgClient?: postgres.Sql };

// Reuse across dev HMR reloads instead of leaking a pool per edit.
// Build prerenders every /locations/[id] across many workers; one connection
// each keeps a session-mode pooler (Supabase: 15 clients) from running out.
const isBuild = process.env.NEXT_PHASE === 'phase-production-build';
const client = (globalForDb.pgClient ??= postgres(process.env.DATABASE_URL!, {
  prepare: false,
  max: isBuild ? 1 : 10,
}));

export const db = drizzle({ client });

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Runs `fn` in a transaction as the `app_user` role with `app.user_id` set, so
 * RLS applies and public.current_user_id() resolves (the audit trigger records
 * who wrote). Use for every user-initiated write. `userId` must come from a
 * verified session (`getSession()` in lib/session.ts), never from client input.
 */
export function asUser<T>(
  userId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
    await tx.execute(sql`set local role app_user`);
    return fn(tx);
  });
}
