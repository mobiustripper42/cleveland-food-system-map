/** Postgres error code + constraint surfaced through postgres-js (possibly wrapped by Drizzle). */
export function pgCode(err: unknown): { code?: string; constraint?: string } {
  const e = err as { code?: string; constraint_name?: string; cause?: unknown };
  if (e?.code) return { code: e.code, constraint: e.constraint_name };
  return e?.cause ? pgCode(e.cause) : {};
}
