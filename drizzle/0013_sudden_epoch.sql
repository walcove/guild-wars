ALTER TABLE "group_bindings" ADD COLUMN "bot_id" text;--> statement-breakpoint
UPDATE group_bindings SET active=false WHERE bot_id IS NULL;
