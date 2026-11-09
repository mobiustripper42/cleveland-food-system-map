create trigger site_sections_set_audit_fields
  before insert or update on public.site_sections
  for each row execute function public.set_audit_fields();
--> statement-breakpoint
-- Public reads all rows; editors (RLS) insert/update. No delete — empty html hides a section.
grant select, insert, update on public.site_sections to app_user;
--> statement-breakpoint
-- Slots the app renders (SECTION_KEYS in lib/sections.ts).
insert into public.site_sections (key) values ('top'), ('footer') on conflict do nothing;
