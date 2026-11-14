import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/db/schema.ts',
  out: './drizzle',
  // Only diff public (hosts like Supabase add their own schemas). Roles
  // (app_user) are created in a custom migration, not managed by Drizzle.
  schemaFilter: ['public'],
  dbCredentials: { url: process.env.DATABASE_URL! },
});
