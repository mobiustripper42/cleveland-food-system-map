CREATE TABLE "site_sections" (
	"key" text PRIMARY KEY,
	"html" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "site_sections_key_format" CHECK ("key" ~ '^[a-z][a-z0-9_-]*$')
);
--> statement-breakpoint
ALTER TABLE "site_sections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "site_sections" ADD CONSTRAINT "site_sections_created_by_user_id_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "site_sections" ADD CONSTRAINT "site_sections_updated_by_user_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
CREATE POLICY "site_sections_select_public" ON "site_sections" AS PERMISSIVE FOR SELECT TO "app_user" USING (true);--> statement-breakpoint
CREATE POLICY "site_sections_select_editor" ON "site_sections" AS PERMISSIVE FOR SELECT TO "app_user" USING (exists (select 1 from public.editors where user_id = (select public.current_user_id())));--> statement-breakpoint
CREATE POLICY "site_sections_insert_editor" ON "site_sections" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK (exists (select 1 from public.editors where user_id = (select public.current_user_id())));--> statement-breakpoint
CREATE POLICY "site_sections_update_editor" ON "site_sections" AS PERMISSIVE FOR UPDATE TO "app_user" USING (exists (select 1 from public.editors where user_id = (select public.current_user_id()))) WITH CHECK (exists (select 1 from public.editors where user_id = (select public.current_user_id())));