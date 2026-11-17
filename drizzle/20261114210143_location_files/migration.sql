CREATE TYPE "location_file_type" AS ENUM('profile');--> statement-breakpoint
CREATE TABLE "location_files" (
	"id" text PRIMARY KEY DEFAULT public.gen_ksuid(),
	"location_id" text NOT NULL,
	"type" "location_file_type" NOT NULL,
	"path" text NOT NULL,
	"thumb_path" text,
	"content_type" text NOT NULL,
	"bytes" integer NOT NULL,
	"width" smallint,
	"height" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "location_files_path_relative" CHECK ("path" !~ '^(/|[a-z]+://)'),
	CONSTRAINT "location_files_thumb_path_relative" CHECK ("thumb_path" !~ '^(/|[a-z]+://)'),
	CONSTRAINT "location_files_bytes_positive" CHECK ("bytes" > 0)
);
--> statement-breakpoint
ALTER TABLE "location_files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "locations" DROP CONSTRAINT "locations_image_path_relative";--> statement-breakpoint
ALTER TABLE "locations" DROP COLUMN "image_path";--> statement-breakpoint
CREATE INDEX "location_files_location_id_idx" ON "location_files" ("location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "location_files_one_profile_idx" ON "location_files" ("location_id") WHERE "type" = 'profile';--> statement-breakpoint
ALTER TABLE "location_files" ADD CONSTRAINT "location_files_location_id_locations_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "location_files" ADD CONSTRAINT "location_files_created_by_user_id_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "location_files" ADD CONSTRAINT "location_files_updated_by_user_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
CREATE POLICY "location_files_select_public" ON "location_files" AS PERMISSIVE FOR SELECT TO "app_user" USING (exists (select 1 from public.locations l where l.id = "location_files"."location_id"));--> statement-breakpoint
CREATE POLICY "location_files_insert_manager" ON "location_files" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK (exists (select 1 from public.editors where user_id = (select public.current_user_id())) or exists (select 1 from public.location_owners o where o.location_id = "location_files"."location_id" and o.user_id = (select public.current_user_id())));--> statement-breakpoint
CREATE POLICY "location_files_delete_manager" ON "location_files" AS PERMISSIVE FOR DELETE TO "app_user" USING (exists (select 1 from public.editors where user_id = (select public.current_user_id())) or exists (select 1 from public.location_owners o where o.location_id = "location_files"."location_id" and o.user_id = (select public.current_user_id())));