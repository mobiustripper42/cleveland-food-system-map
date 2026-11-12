-- Editors manage editors from /admin/editors (asUser → app_user, RLS decides).
-- A policy on public.editors can't subquery public.editors (infinite
-- recursion), so the editor check runs as the owner via security definer.
create or replace function public.is_editor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.editors where user_id = public.current_user_id()
  )
$$;
--> statement-breakpoint
revoke all on function public.is_editor() from public;
--> statement-breakpoint
-- Supabase grants function execute to its API roles by default; keep it closed.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.is_editor() from anon, authenticated;
  end if;
end
$$;
--> statement-breakpoint
grant execute on function public.is_editor() to app_user;
--> statement-breakpoint
-- Insert/delete gated by editors_insert_editor / editors_delete_editor.
grant insert, delete on public.editors to app_user;
