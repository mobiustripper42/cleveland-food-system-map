-- Hand-edited after drizzle-kit generate: policies can't survive a column
-- type change they reference (editors.user_id), and uuid = text wouldn't
-- typecheck mid-way, so drop all of them up front and recreate for app_user
-- at the end instead of ALTER POLICY.
DROP POLICY "contacts_select_editor" ON "contacts";
--> statement-breakpoint
DROP POLICY "contacts_insert_editor" ON "contacts";
--> statement-breakpoint
DROP POLICY "contacts_update_editor" ON "contacts";
--> statement-breakpoint
DROP POLICY "contacts_delete_editor" ON "contacts";
--> statement-breakpoint
DROP POLICY "editors_select_self" ON "editors";
--> statement-breakpoint
DROP POLICY "location_contacts_select_editor" ON "location_contacts";
--> statement-breakpoint
DROP POLICY "location_contacts_insert_editor" ON "location_contacts";
--> statement-breakpoint
DROP POLICY "location_contacts_update_editor" ON "location_contacts";
--> statement-breakpoint
DROP POLICY "location_contacts_delete_editor" ON "location_contacts";
--> statement-breakpoint
DROP POLICY "locations_select_public" ON "locations";
--> statement-breakpoint
DROP POLICY "locations_select_editor" ON "locations";
--> statement-breakpoint
DROP POLICY "locations_insert_editor" ON "locations";
--> statement-breakpoint
DROP POLICY "locations_update_editor" ON "locations";
--> statement-breakpoint
DROP POLICY "market_schedules_select_public" ON "market_schedules";
--> statement-breakpoint
DROP POLICY "market_schedules_select_editor" ON "market_schedules";
--> statement-breakpoint
DROP POLICY "market_schedules_insert_editor" ON "market_schedules";
--> statement-breakpoint
DROP POLICY "market_schedules_update_editor" ON "market_schedules";
--> statement-breakpoint
DROP POLICY "market_schedules_delete_editor" ON "market_schedules";
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL UNIQUE,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "session" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "verification" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Hand-written: carry Supabase Auth users and their OAuth identities over,
-- keeping ids, so existing editors rows and *_by audit values satisfy the new
-- FKs and GitHub/Google sign-in resolves to the same user. No-op off Supabase.
do $$
begin
  if to_regclass('auth.users') is not null then
    insert into public."user" (id, name, email, email_verified, image, created_at, updated_at)
    select u.id::text,
           coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name',
                    u.raw_user_meta_data->>'user_name', u.email),
           lower(u.email),
           u.email_confirmed_at is not null,
           u.raw_user_meta_data->>'avatar_url',
           coalesce(u.created_at, now()),
           coalesce(u.updated_at, now())
    from auth.users u
    where u.email is not null
    on conflict do nothing;

    insert into public.account (id, account_id, provider_id, user_id, created_at, updated_at)
    select i.id::text, i.provider_id, i.provider, i.user_id::text,
           coalesce(i.created_at, now()), coalesce(i.updated_at, now())
    from auth.identities i
    join public."user" u on u.id = i.user_id::text
    where i.provider <> 'email'
    on conflict do nothing;
  end if;
end
$$;
--> statement-breakpoint
ALTER TABLE "contacts" DROP CONSTRAINT "contacts_created_by_users_id_fkey";
--> statement-breakpoint
ALTER TABLE "contacts" DROP CONSTRAINT "contacts_updated_by_users_id_fkey";
--> statement-breakpoint
ALTER TABLE "editors" DROP CONSTRAINT "editors_user_id_users_id_fkey";
--> statement-breakpoint
ALTER TABLE "locations" DROP CONSTRAINT "locations_created_by_users_id_fkey";
--> statement-breakpoint
ALTER TABLE "locations" DROP CONSTRAINT "locations_updated_by_users_id_fkey";
--> statement-breakpoint
ALTER TABLE "market_schedules" DROP CONSTRAINT "market_schedules_created_by_users_id_fkey";
--> statement-breakpoint
ALTER TABLE "market_schedules" DROP CONSTRAINT "market_schedules_updated_by_users_id_fkey";
--> statement-breakpoint
ALTER TABLE "contacts" ALTER COLUMN "created_by" SET DATA TYPE text USING "created_by"::text;
--> statement-breakpoint
ALTER TABLE "contacts" ALTER COLUMN "updated_by" SET DATA TYPE text USING "updated_by"::text;
--> statement-breakpoint
ALTER TABLE "editors" ALTER COLUMN "user_id" SET DATA TYPE text USING "user_id"::text;
--> statement-breakpoint
ALTER TABLE "locations" ALTER COLUMN "created_by" SET DATA TYPE text USING "created_by"::text;
--> statement-breakpoint
ALTER TABLE "locations" ALTER COLUMN "updated_by" SET DATA TYPE text USING "updated_by"::text;
--> statement-breakpoint
ALTER TABLE "market_schedules" ALTER COLUMN "created_by" SET DATA TYPE text USING "created_by"::text;
--> statement-breakpoint
ALTER TABLE "market_schedules" ALTER COLUMN "updated_by" SET DATA TYPE text USING "updated_by"::text;
--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" ("user_id");
--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" ("user_id");
--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" ("identifier");
--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_created_by_user_id_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_updated_by_user_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "user"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "editors" ADD CONSTRAINT "editors_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_created_by_user_id_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_updated_by_user_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "user"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "market_schedules" ADD CONSTRAINT "market_schedules_created_by_user_id_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "market_schedules" ADD CONSTRAINT "market_schedules_updated_by_user_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "user"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;
--> statement-breakpoint
CREATE POLICY "contacts_select_editor" ON "contacts" AS PERMISSIVE FOR SELECT TO "app_user" USING (exists (select 1 from public.editors where user_id = (select public.current_user_id())));
--> statement-breakpoint
CREATE POLICY "contacts_insert_editor" ON "contacts" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK (exists (select 1 from public.editors where user_id = (select public.current_user_id())));
--> statement-breakpoint
CREATE POLICY "contacts_update_editor" ON "contacts" AS PERMISSIVE FOR UPDATE TO "app_user" USING (exists (select 1 from public.editors where user_id = (select public.current_user_id()))) WITH CHECK (exists (select 1 from public.editors where user_id = (select public.current_user_id())));
--> statement-breakpoint
CREATE POLICY "contacts_delete_editor" ON "contacts" AS PERMISSIVE FOR DELETE TO "app_user" USING (exists (select 1 from public.editors where user_id = (select public.current_user_id())));
--> statement-breakpoint
CREATE POLICY "editors_select_self" ON "editors" AS PERMISSIVE FOR SELECT TO "app_user" USING (user_id = (select public.current_user_id()));
--> statement-breakpoint
CREATE POLICY "location_contacts_select_editor" ON "location_contacts" AS PERMISSIVE FOR SELECT TO "app_user" USING (exists (select 1 from public.editors where user_id = (select public.current_user_id())));
--> statement-breakpoint
CREATE POLICY "location_contacts_insert_editor" ON "location_contacts" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK (exists (select 1 from public.editors where user_id = (select public.current_user_id())));
--> statement-breakpoint
CREATE POLICY "location_contacts_update_editor" ON "location_contacts" AS PERMISSIVE FOR UPDATE TO "app_user" USING (exists (select 1 from public.editors where user_id = (select public.current_user_id()))) WITH CHECK (exists (select 1 from public.editors where user_id = (select public.current_user_id())));
--> statement-breakpoint
CREATE POLICY "location_contacts_delete_editor" ON "location_contacts" AS PERMISSIVE FOR DELETE TO "app_user" USING (exists (select 1 from public.editors where user_id = (select public.current_user_id())));
--> statement-breakpoint
CREATE POLICY "locations_select_public" ON "locations" AS PERMISSIVE FOR SELECT TO "app_user" USING ("locations"."status" = 'published');
--> statement-breakpoint
CREATE POLICY "locations_select_editor" ON "locations" AS PERMISSIVE FOR SELECT TO "app_user" USING (exists (select 1 from public.editors where user_id = (select public.current_user_id())));
--> statement-breakpoint
CREATE POLICY "locations_insert_editor" ON "locations" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK (exists (select 1 from public.editors where user_id = (select public.current_user_id())));
--> statement-breakpoint
CREATE POLICY "locations_update_editor" ON "locations" AS PERMISSIVE FOR UPDATE TO "app_user" USING (exists (select 1 from public.editors where user_id = (select public.current_user_id()))) WITH CHECK (exists (select 1 from public.editors where user_id = (select public.current_user_id())));
--> statement-breakpoint
CREATE POLICY "market_schedules_select_public" ON "market_schedules" AS PERMISSIVE FOR SELECT TO "app_user" USING (exists (select 1 from public.locations l where l.id = "market_schedules"."location_id"));
--> statement-breakpoint
CREATE POLICY "market_schedules_select_editor" ON "market_schedules" AS PERMISSIVE FOR SELECT TO "app_user" USING (exists (select 1 from public.editors where user_id = (select public.current_user_id())));
--> statement-breakpoint
CREATE POLICY "market_schedules_insert_editor" ON "market_schedules" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK (exists (select 1 from public.editors where user_id = (select public.current_user_id())));
--> statement-breakpoint
CREATE POLICY "market_schedules_update_editor" ON "market_schedules" AS PERMISSIVE FOR UPDATE TO "app_user" USING (exists (select 1 from public.editors where user_id = (select public.current_user_id()))) WITH CHECK (exists (select 1 from public.editors where user_id = (select public.current_user_id())));
--> statement-breakpoint
CREATE POLICY "market_schedules_delete_editor" ON "market_schedules" AS PERMISSIVE FOR DELETE TO "app_user" USING (exists (select 1 from public.editors where user_id = (select public.current_user_id())));
