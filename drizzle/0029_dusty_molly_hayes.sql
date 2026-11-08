CREATE TABLE "forecast_registrations" (
	"forecast_id" uuid PRIMARY KEY NOT NULL,
	"author_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"terms_hash" text NOT NULL,
	"supersedes_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "forecast_request" UNIQUE("author_id","request_id")
);
--> statement-breakpoint
CREATE TABLE "forecast_resolutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"forecast_id" uuid NOT NULL,
	"revision" text NOT NULL,
	"record" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "forecast_resolution_revision" UNIQUE("forecast_id","revision")
);
--> statement-breakpoint
CREATE TABLE "research_appeals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outcome_id" uuid NOT NULL,
	"submission_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "research_appeals_outcome_id_unique" UNIQUE("outcome_id"),
	CONSTRAINT "research_appeals_submission_id_unique" UNIQUE("submission_id")
);
--> statement-breakpoint
CREATE TABLE "research_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"generation" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assigned_reviewer_generation" UNIQUE("submission_id","reviewer_id","generation")
);
--> statement-breakpoint
CREATE TABLE "research_digest_subscriptions" (
	"guild_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"bot_id" text NOT NULL,
	"active" boolean NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "research_digest_subscriptions_guild_id_user_id_bot_id_pk" PRIMARY KEY("guild_id","user_id","bot_id")
);
--> statement-breakpoint
CREATE TABLE "research_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"generation" integer NOT NULL,
	"accepted" boolean NOT NULL,
	"reason" text NOT NULL,
	"appeal_closes_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "award_generation_outcome" UNIQUE("submission_id","generation")
);
--> statement-breakpoint
CREATE TABLE "research_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"accept" boolean NOT NULL,
	"verified_useful" boolean NOT NULL,
	"reason" text NOT NULL,
	"verification" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "research_reviews_assignment_id_unique" UNIQUE("assignment_id")
);
--> statement-breakpoint
CREATE TABLE "research_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"bounty_id" uuid,
	"forecast_id" uuid,
	"request_id" uuid NOT NULL,
	"content_hash" text NOT NULL,
	"record" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "research_submission_request" UNIQUE("author_id","request_id"),
	CONSTRAINT "research_duplicate_work" UNIQUE("guild_id","content_hash")
);
--> statement-breakpoint
ALTER TABLE "forecast_registrations" ADD CONSTRAINT "forecast_registrations_forecast_id_forecasts_id_fk" FOREIGN KEY ("forecast_id") REFERENCES "public"."forecasts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecast_registrations" ADD CONSTRAINT "forecast_registrations_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecast_registrations" ADD CONSTRAINT "forecast_registrations_supersedes_id_forecasts_id_fk" FOREIGN KEY ("supersedes_id") REFERENCES "public"."forecasts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecast_resolutions" ADD CONSTRAINT "forecast_resolutions_forecast_id_forecasts_id_fk" FOREIGN KEY ("forecast_id") REFERENCES "public"."forecasts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_appeals" ADD CONSTRAINT "research_appeals_outcome_id_research_outcomes_id_fk" FOREIGN KEY ("outcome_id") REFERENCES "public"."research_outcomes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_appeals" ADD CONSTRAINT "research_appeals_submission_id_research_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."research_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_appeals" ADD CONSTRAINT "research_appeals_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_assignments" ADD CONSTRAINT "research_assignments_submission_id_research_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."research_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_assignments" ADD CONSTRAINT "research_assignments_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_digest_subscriptions" ADD CONSTRAINT "research_digest_subscriptions_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_digest_subscriptions" ADD CONSTRAINT "research_digest_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_outcomes" ADD CONSTRAINT "research_outcomes_submission_id_research_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."research_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_reviews" ADD CONSTRAINT "research_reviews_assignment_id_research_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."research_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_submissions" ADD CONSTRAINT "research_submissions_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_submissions" ADD CONSTRAINT "research_submissions_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_submissions" ADD CONSTRAINT "research_submissions_bounty_id_bounties_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "public"."bounties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_submissions" ADD CONSTRAINT "research_submissions_forecast_id_forecasts_id_fk" FOREIGN KEY ("forecast_id") REFERENCES "public"."forecasts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "submissions_guild_time" ON "research_submissions" USING btree ("guild_id","created_at","id");
--> statement-breakpoint
DO $$ DECLARE n text; BEGIN FOREACH n IN ARRAY ARRAY['forecast_registrations','forecast_resolutions','research_submissions','research_assignments','research_reviews','research_outcomes','research_appeals','bounties'] LOOP EXECUTE format('CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_mutation()',n); END LOOP; END $$;
--> statement-breakpoint
CREATE FUNCTION immutable_forecast_terms() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF (NEW.guild_id,NEW.author_id,NEW.terms,NEW.deadline,NEW.week) IS DISTINCT FROM (OLD.guild_id,OLD.author_id,OLD.terms,OLD.deadline,OLD.week) THEN RAISE EXCEPTION 'forecast terms are immutable; register a retained revision'; END IF; RETURN NEW; END $$;
--> statement-breakpoint
CREATE TRIGGER forecast_terms_immutable BEFORE UPDATE ON forecasts FOR EACH ROW EXECUTE FUNCTION immutable_forecast_terms();
