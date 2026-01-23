ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "state_registration" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "state_registration_exempt" boolean DEFAULT false;