-- Audit trigger now records the BetterAuth user id set by asUser(). Null for
-- writes outside asUser() (KML import, scripts, SQL console).
create or replace function public.set_audit_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := public.current_user_id();
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  new.updated_at := now();
  new.updated_by := public.current_user_id();
  return new;
end;
$$;
--> statement-breakpoint
-- Table grants for app_user, mirroring schema.ts policies (RLS picks the rows).
grant usage on schema public to app_user;
--> statement-breakpoint
-- gen_ksuid() (the id default) calls extensions.gen_random_bytes as the caller.
grant usage on schema extensions to app_user;
--> statement-breakpoint
-- isEditor reads the caller's own row (editors_select_self). Writes to
-- editors stay owner-only (npm run add-editor).
grant select on public.editors to app_user;
--> statement-breakpoint
-- Public reads: published rows only. Editors: read all, insert/update everything.
grant select, insert, update on
  public.locations, public.market_schedules, public.contacts, public.location_contacts
  to app_user;
--> statement-breakpoint
-- Editors: delete schedules/contacts/links. No delete on locations — archive instead.
grant delete on public.market_schedules, public.contacts, public.location_contacts
  to app_user;
--> statement-breakpoint
-- user/session/account/verification: RLS on, no policies, no grants. Only the
-- owner role (BetterAuth via DATABASE_URL) touches them.
--
-- The app no longer talks to Supabase's Data API (PostgREST). Close it so the
-- public publishable key can't read sessions/tokens or anything else in public.
-- No-op on Postgres hosts without these roles.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon;
    revoke all on all functions in schema public from anon;
    alter default privileges in schema public revoke all on tables from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on all tables in schema public from authenticated;
    revoke all on all functions in schema public from authenticated;
    alter default privileges in schema public revoke all on tables from authenticated;
  end if;
end
$$;
