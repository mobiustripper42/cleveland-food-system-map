create trigger location_files_set_audit_fields
  before insert or update on public.location_files
  for each row execute function public.set_audit_fields();
--> statement-breakpoint
-- Public reads (RLS: parent location visible); editors and owners insert and
-- delete. No update: replacing a file is delete + insert with new keys.
grant select, insert, delete on public.location_files to app_user;
--> statement-breakpoint
-- Supabase grants table privileges to its API roles by default; keep it closed.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.location_files from anon, authenticated;
  end if;
end
$$;
--> statement-breakpoint
-- Photos moved to R2; the Supabase Storage policies for the old
-- location-images bucket (location_images_storage migration) are dead.
-- Delete the bucket itself in the Supabase dashboard.
do $$
begin
  if to_regclass('storage.objects') is not null then
    drop policy if exists location_images_select_editor on storage.objects;
    drop policy if exists location_images_insert_editor on storage.objects;
    drop policy if exists location_images_delete_editor on storage.objects;
  end if;
end
$$;
