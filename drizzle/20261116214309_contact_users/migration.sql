-- contacts_update_owner needs it, so it comes before the policies. True when
-- the contact has at least one location and the caller owns all of them.
-- Security definer: under RLS an owner can't see the links to other sites,
-- which would make the check pass vacuously.
create or replace function public.owns_all_contact_locations(p_contact_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
      select 1 from public.location_contacts where contact_id = p_contact_id
    )
    and not exists (
      select 1 from public.location_contacts lc
      where lc.contact_id = p_contact_id
        and not exists (
          select 1 from public.location_owners o
          where o.location_id = lc.location_id
            and o.user_id = public.current_user_id()
        )
    )
$$;
--> statement-breakpoint
revoke all on function public.owns_all_contact_locations(text) from public;
--> statement-breakpoint
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.owns_all_contact_locations(text) from anon, authenticated;
  end if;
end
$$;
--> statement-breakpoint
grant execute on function public.owns_all_contact_locations(text) to app_user;
--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_user_id_key" UNIQUE("user_id");--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
CREATE POLICY "contacts_select_self" ON "contacts" AS PERMISSIVE FOR SELECT TO "app_user" USING ("contacts"."user_id" = (select public.current_user_id()));--> statement-breakpoint
CREATE POLICY "contacts_update_self" ON "contacts" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("contacts"."user_id" = (select public.current_user_id())) WITH CHECK ("contacts"."user_id" = (select public.current_user_id()));--> statement-breakpoint
CREATE POLICY "contacts_select_owner" ON "contacts" AS PERMISSIVE FOR SELECT TO "app_user" USING (exists (select 1 from public.location_contacts lc where lc.contact_id = "contacts"."id" and exists (select 1 from public.location_owners o where o.location_id = lc.location_id and o.user_id = (select public.current_user_id()))));--> statement-breakpoint
CREATE POLICY "contacts_update_owner" ON "contacts" AS PERMISSIVE FOR UPDATE TO "app_user" USING ("contacts"."user_id" is null and (select public.owns_all_contact_locations("contacts"."id"))) WITH CHECK ("contacts"."user_id" is null and (select public.owns_all_contact_locations("contacts"."id")));--> statement-breakpoint
CREATE POLICY "location_contacts_select_owner" ON "location_contacts" AS PERMISSIVE FOR SELECT TO "app_user" USING (exists (select 1 from public.location_owners o where o.location_id = "location_contacts"."location_id" and o.user_id = (select public.current_user_id())));--> statement-breakpoint
CREATE POLICY "location_contacts_insert_owner" ON "location_contacts" AS PERMISSIVE FOR INSERT TO "app_user" WITH CHECK (exists (select 1 from public.location_owners o where o.location_id = "location_contacts"."location_id" and o.user_id = (select public.current_user_id())));--> statement-breakpoint
CREATE POLICY "location_contacts_delete_owner" ON "location_contacts" AS PERMISSIVE FOR DELETE TO "app_user" USING (exists (select 1 from public.location_owners o where o.location_id = "location_contacts"."location_id" and o.user_id = (select public.current_user_id())));