-- Portable replacement for Supabase's `authenticated` role + auth.uid().
-- asUser() (lib/db/index.ts) runs `set local role app_user` and sets
-- app.user_id to the verified BetterAuth user id; RLS policies and the audit
-- trigger read it through public.current_user_id().
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    create role app_user nologin noinherit;
  end if;
end
$$;
--> statement-breakpoint
-- The app's DATABASE_URL role must be able to SET ROLE app_user. Assumes it is
-- the same role that runs migrations; if not, grant app_user to it too.
grant app_user to current_user;
--> statement-breakpoint
create or replace function public.current_user_id()
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(current_setting('app.user_id', true), '')
$$;
--> statement-breakpoint
grant execute on function public.current_user_id() to app_user;
--> statement-breakpoint
-- Photo uploads are removed until they move to R2. These policies used
-- auth.uid() and depend on editors.user_id, which becomes text next.
do $$
begin
  if to_regclass('storage.objects') is not null then
    drop policy if exists location_images_select_editor on storage.objects;
    drop policy if exists location_images_insert_editor on storage.objects;
    drop policy if exists location_images_delete_editor on storage.objects;
  end if;
end
$$;
