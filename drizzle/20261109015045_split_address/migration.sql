ALTER TABLE "locations" ADD COLUMN "street" text;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "state" text;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "zip" text;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_state_format" CHECK ("state" ~ '^[A-Z]{2}$');--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_zip_format" CHECK ("zip" ~ '^[0-9]{5}(-[0-9]{4})?$');--> statement-breakpoint
-- Hand-added backfill: split the one-line KML addresses. Mirrors
-- parseOneLineAddress() in lib/address.ts. `address` is dropped next migration.
with parsed as (
  select id, btrim(address) as a,
    regexp_match(btrim(address), '^(.*),\s*(OH|Ohio)\s+(\d{5}(?:-\d{4})?)$', 'i') as m
  from public.locations
  where nullif(btrim(address), '') is not null
), split as (
  select id, a, m,
    case
      when m is null then null
      when position(',' in m[1]) > 0 then btrim(regexp_replace(m[1], ',[^,]*$', ''))
      when btrim(m[1]) ~* '\sCleveland$' then regexp_replace(btrim(m[1]), '\s+Cleveland$', '', 'i')
      else btrim(m[1])
    end as street,
    case
      when m is null then null
      when position(',' in m[1]) > 0 then nullif(btrim(substring(m[1] from ',([^,]*)$')), '')
      when btrim(m[1]) ~* '\sCleveland$' then 'Cleveland'
    end as city
  from parsed
)
update public.locations l set
  street = case
    when s.m is null then s.a
    else nullif(coalesce(substring(s.street from '\m\d+[A-Za-z]?\s+\S.*$'), s.street), '')
  end,
  city = s.city,
  state = case when s.m is null then null else 'OH' end,
  zip = s.m[3]
from split s
where l.id = s.id;
