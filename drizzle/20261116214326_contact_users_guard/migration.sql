-- Linking a contact to a user is proof-based (a verified user with that
-- email) and runs as the owner role only (lib/db/contacts.ts). For app_user
-- (asUser): user_id can't be set or changed, and a claimed contact's email
-- can't change — it mirrors user.email. KML import, scripts, and the SQL
-- console run as the owner role and aren't checked.
create or replace function public.contacts_link_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'app_user' then
    if tg_op = 'INSERT' then
      if new.user_id is not null then
        raise exception 'contacts are linked to users by sign-in, not by hand'
          using errcode = '42501';
      end if;
    else
      if new.user_id is distinct from old.user_id then
        raise exception 'contacts are linked to users by sign-in, not by hand'
          using errcode = '42501';
      end if;
      if old.user_id is not null and new.email is distinct from old.email then
        raise exception 'a claimed contact''s email follows its sign-in email'
          using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end
$$;
--> statement-breakpoint
create trigger contacts_link_guard
  before insert or update on public.contacts
  for each row execute function public.contacts_link_guard();
--> statement-breakpoint
-- Link existing contacts to existing verified users with the same email (one
-- contact per user, oldest wins if emails differ only by case).
update public.contacts c
set user_id = m.user_id
from (
  select distinct on (u.id) u.id as user_id, c2.id as contact_id
  from public."user" u
  join public.contacts c2 on lower(c2.email) = lower(u.email)
  where u.email_verified and c2.user_id is null
  order by u.id, c2.id
) m
where c.id = m.contact_id
  and not exists (select 1 from public.contacts x where x.user_id = m.user_id);
