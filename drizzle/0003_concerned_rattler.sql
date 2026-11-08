ALTER TABLE "link_challenges" ADD COLUMN "purpose" text DEFAULT 'sign_in' NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "telegram_proved_at" timestamp with time zone;