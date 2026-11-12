CREATE TABLE "location_owners" (
	"location_id" text,
	"user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "location_owners_pkey" PRIMARY KEY("location_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "location_owners" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "location_owners_user_id_idx" ON "location_owners" ("user_id");--> statement-breakpoint
ALTER TABLE "location_owners" ADD CONSTRAINT "location_owners_location_id_locations_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "location_owners" ADD CONSTRAINT "location_owners_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE POLICY "location_owners_select_self" ON "location_owners" AS PERMISSIVE FOR SELECT TO "app_user" USING ("location_owners"."user_id" = (select public.current_user_id()));--> statement-breakpoint
CREATE POLICY "location_owners_select_editor" ON "location_owners" AS PERMISSIVE FOR SELECT TO "app_user" USING (exists (select 1 from public.editors where user_id = (select public.current_user_id())));--> statement-breakpoint
CREATE POLICY "location_owners_insert_editor" ON "location_owners" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK (exists (select 1 from public.editors where user_id = (select public.current_user_id())));--> statement-breakpoint
CREATE POLICY "location_owners_delete_editor" ON "location_owners" AS PERMISSIVE FOR DELETE TO "app_user" USING (exists (select 1 from public.editors where user_id = (select public.current_user_id())));--> statement-breakpoint
CREATE POLICY "locations_select_owner" ON "locations" AS PERMISSIVE FOR SELECT TO "app_user" USING (exists (select 1 from public.location_owners o where o.location_id = "locations"."id" and o.user_id = (select public.current_user_id())));--> statement-breakpoint
CREATE POLICY "locations_update_owner" ON "locations" AS PERMISSIVE FOR UPDATE TO "app_user" USING (exists (select 1 from public.location_owners o where o.location_id = "locations"."id" and o.user_id = (select public.current_user_id()))) WITH CHECK (exists (select 1 from public.location_owners o where o.location_id = "locations"."id" and o.user_id = (select public.current_user_id())));