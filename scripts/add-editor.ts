/**
 * scripts/add-editor.ts — grant editor access by email.
 *
 * Usage:
 *   npm run add-editor -- someone@example.org [--name "Their Name"]
 *
 * Creates the BetterAuth user if it doesn't exist yet (already verified, so
 * any sign-in method works), then adds it to `editors`. Safe to re-run. Google
 * sign-ins with the same verified email link to this user automatically.
 *
 * Writes over DATABASE_URL (from .env.local), which bypasses RLS — that's how
 * `editors` rows are meant to be managed.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { editors } from '../lib/db/schema.ts';
import { findOrCreateUserByEmail, normalizeEmail } from '../lib/db/users.ts';

const ENV_FILE = path.resolve(import.meta.dirname, '../.env.local');
if (fs.existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

const args = process.argv.slice(2);
const email = normalizeEmail(args.find((a) => !a.startsWith('--')));
const nameIndex = args.indexOf('--name');
const name = nameIndex >= 0 ? args[nameIndex + 1] : undefined;

if (!email) {
  console.error(
    'Usage: npm run add-editor -- email@example.org [--name "Name"]',
  );
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set in .env.local');
  process.exit(1);
}

const client = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  const db = drizzle({ client });
  const { id: userId, created } = await findOrCreateUserByEmail(
    db,
    email,
    name,
  );
  if (created) console.log(`Created user ${email}`);

  const added = await db
    .insert(editors)
    .values({ user_id: userId })
    .onConflictDoNothing()
    .returning({ user_id: editors.user_id });
  console.log(
    added.length
      ? `${email} is now an editor`
      : `${email} was already an editor`,
  );
} finally {
  await client.end();
}
