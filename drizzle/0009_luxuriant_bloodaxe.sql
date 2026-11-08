CREATE TABLE "curated_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"title" text NOT NULL,
	"source_url" text NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"last_checked_at" timestamp with time zone NOT NULL,
	"relevance" text NOT NULL,
	"uncertainty" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_market_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"record" jsonb,
	"fetched_at" timestamp with time zone,
	"fresh_until" timestamp with time zone,
	"stale_until" timestamp with time zone,
	"retain_until" timestamp with time zone,
	"lease_token" text,
	"lease_until" timestamp with time zone,
	"retry_after" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "curated_events" ADD CONSTRAINT "curated_events_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curated_events" ADD CONSTRAINT "curated_events_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_by_guild_time" ON "curated_events" USING btree ("guild_id","scheduled_at");