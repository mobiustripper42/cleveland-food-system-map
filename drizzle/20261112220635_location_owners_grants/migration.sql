-- Editors add/remove owners (RLS decides); owners read their own rows, which
-- is what the locations_*_owner policies subquery.
grant select, insert, delete on public.location_owners to app_user;
--> statement-breakpoint
-- Supabase grants table privileges to its API roles by default; keep it closed.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.location_owners from anon, authenticated;
  end if;
end
$$;
--> statement-breakpoint
-- Owners may edit a location's content, not publish/unpublish/archive it. RLS
-- can't compare old and new values, so a trigger does. Only app_user (asUser)
-- is checked: KML import, scripts, and the SQL console run as the owner role.
create or replace function public.locations_status_editor_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'app_user'
    and new.status is distinct from old.status
    and not public.is_editor()
  then
    raise exception 'only editors can change a location''s status'
      using errcode = '42501';
  end if;
  return new;
end
$$;
--> statement-breakpoint
create trigger locations_status_editor_only
  before update on public.locations
  for each row execute function public.locations_status_editor_only();
