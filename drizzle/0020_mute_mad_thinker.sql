CREATE TABLE "cohort_verification_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"operation_id" text NOT NULL,
	"kind" text NOT NULL,
	"record" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cohort_verification_events_operation_id_unique" UNIQUE("operation_id")
);
--> statement-breakpoint
CREATE TABLE "cohort_week_claims" (
	"cohort_member_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"division_key" text NOT NULL,
	"week_key" text NOT NULL,
	"account_id" uuid NOT NULL,
	CONSTRAINT "cohort_week_claims_user_id_division_key_week_key_pk" PRIMARY KEY("user_id","division_key","week_key"),
	CONSTRAINT "exclusive_account_week" UNIQUE("account_id","week_key")
);
--> statement-breakpoint
CREATE TABLE "live_sleeve_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cohort_member_id" uuid NOT NULL,
	"guild_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"allocation_lamports" numeric(78, 0) NOT NULL,
	"reserve_lamports" numeric(78, 0) NOT NULL,
	"reference_lamports" numeric(78, 0) NOT NULL,
	"record" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registered_member_round" UNIQUE("user_id","round_id")
);
--> statement-breakpoint
ALTER TABLE "cohort_verification_events" ADD CONSTRAINT "cohort_verification_events_registration_id_live_sleeve_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."live_sleeve_registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort_week_claims" ADD CONSTRAINT "cohort_week_claims_cohort_member_id_cohort_members_id_fk" FOREIGN KEY ("cohort_member_id") REFERENCES "public"."cohort_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort_week_claims" ADD CONSTRAINT "cohort_week_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort_week_claims" ADD CONSTRAINT "cohort_week_claims_account_id_provider_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."provider_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_sleeve_registrations" ADD CONSTRAINT "live_sleeve_registrations_cohort_member_id_guild_id_user_id_season_id_cohort_members_id_guild_id_user_id_season_id_fk" FOREIGN KEY ("cohort_member_id","guild_id","user_id","season_id") REFERENCES "public"."cohort_members"("id","guild_id","user_id","season_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_sleeve_registrations" ADD CONSTRAINT "live_sleeve_registrations_round_id_guild_id_season_id_rounds_id_guild_id_season_id_fk" FOREIGN KEY ("round_id","guild_id","season_id") REFERENCES "public"."rounds"("id","guild_id","season_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_sleeve_registrations" ADD CONSTRAINT "live_sleeve_registrations_account_id_user_id_provider_accounts_id_user_id_fk" FOREIGN KEY ("account_id","user_id") REFERENCES "public"."provider_accounts"("id","user_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON live_sleeve_registrations FOR EACH ROW EXECUTE FUNCTION reject_mutation();
--> statement-breakpoint
CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON cohort_week_claims FOR EACH ROW EXECUTE FUNCTION reject_mutation();
--> statement-breakpoint
CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON cohort_verification_events FOR EACH ROW EXECUTE FUNCTION reject_mutation();
