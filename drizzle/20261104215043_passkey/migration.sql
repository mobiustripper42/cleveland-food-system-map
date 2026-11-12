CREATE TABLE "passkey" (
	"id" text PRIMARY KEY,
	"name" text,
	"public_key" text NOT NULL,
	"user_id" text NOT NULL,
	"credential_id" text NOT NULL,
	"counter" integer NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean NOT NULL,
	"transports" text,
	"created_at" timestamp,
	"aaguid" text
);
--> statement-breakpoint
ALTER TABLE "passkey" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "passkey_userId_idx" ON "passkey" ("user_id");--> statement-breakpoint
CREATE INDEX "passkey_credentialID_idx" ON "passkey" ("credential_id");--> statement-breakpoint
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
-- Hand-added: belt and braces on top of auth_finish's default-privilege
-- revoke — passkey credentials stay off Supabase's Data API.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.passkey from anon, authenticated;
  end if;
end
$$;
