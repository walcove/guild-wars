CREATE TYPE "public"."trading_mode" AS ENUM('simulation', 'live');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"guild_id" uuid,
	"kind" text NOT NULL,
	"record_id" text NOT NULL,
	"reason" text NOT NULL,
	"record" jsonb NOT NULL,
	"corrects_event_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ballot_choices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ballot_id" uuid NOT NULL,
	"guild_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"proposal_version_id" uuid,
	"label" text NOT NULL,
	CONSTRAINT "choice_ballot" UNIQUE("id","ballot_id")
);
--> statement-breakpoint
CREATE TABLE "ballot_roster" (
	"ballot_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "ballot_roster_ballot_id_user_id_pk" PRIMARY KEY("ballot_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "ballots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"state" text NOT NULL,
	"kind" text NOT NULL,
	"opens_at" timestamp with time zone NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"outcome" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ballot_tenant" UNIQUE("id","guild_id","round_id")
);
--> statement-breakpoint
CREATE TABLE "callback_tokens" (
	"token" text PRIMARY KEY NOT NULL,
	"ballot_id" uuid NOT NULL,
	"choice_id" uuid NOT NULL,
	"chat_id" text NOT NULL,
	"proposal_version_id" uuid
);
--> statement-breakpoint
CREATE TABLE "consumed_updates" (
	"bot_id" text NOT NULL,
	"update_id" text NOT NULL,
	"receipt" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consumed_updates_bot_id_update_id_pk" PRIMARY KEY("bot_id","update_id")
);
--> statement-breakpoint
CREATE TABLE "vote_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ballot_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"choice_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"saved_at" timestamp with time zone NOT NULL,
	CONSTRAINT "vote_event_revision" UNIQUE("ballot_id","user_id","revision")
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"ballot_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"choice_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"saved_at" timestamp with time zone NOT NULL,
	CONSTRAINT "votes_ballot_id_user_id_pk" PRIMARY KEY("ballot_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "group_bindings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"chat_id" text NOT NULL,
	"topic_id" text,
	"administrator_id" uuid NOT NULL,
	"method" text NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_bindings_guild_id_unique" UNIQUE("guild_id"),
	CONSTRAINT "group_bindings_chat_id_unique" UNIQUE("chat_id"),
	CONSTRAINT "binding_guild_id" UNIQUE("id","guild_id")
);
--> statement-breakpoint
CREATE TABLE "guilds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"guild_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_guild_id_user_id_pk" PRIMARY KEY("guild_id","user_id"),
	CONSTRAINT "membership_role" CHECK ("memberships"."role" in ('member','captain','administrator')),
	CONSTRAINT "membership_status" CHECK ("memberships"."status" in ('active','suspended','departed'))
);
--> statement-breakpoint
CREATE TABLE "link_challenges" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"session_hash" text NOT NULL,
	"telegram_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"return_path" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"csrf_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"telegram_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_telegram_id_unique" UNIQUE("telegram_id")
);
--> statement-breakpoint
CREATE TABLE "operations" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"state" text NOT NULL,
	"record" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" text NOT NULL,
	"proposal_version_id" uuid NOT NULL,
	"chat_id" text NOT NULL,
	"topic_id" text,
	"message_id" text,
	"state" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"replaces_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_deliveries_operation_id_unique" UNIQUE("operation_id")
);
--> statement-breakpoint
CREATE TABLE "ledger_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sleeve_id" uuid NOT NULL,
	"operation_id" text NOT NULL,
	"kind" text NOT NULL,
	"record" jsonb NOT NULL,
	"corrects_event_id" uuid,
	"observed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_events_operation_id_unique" UNIQUE("operation_id")
);
--> statement-breakpoint
CREATE TABLE "result_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sleeve_id" uuid NOT NULL,
	"revision" text NOT NULL,
	"input_hash" text NOT NULL,
	"record" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "result_revision" UNIQUE("sleeve_id","revision")
);
--> statement-breakpoint
CREATE TABLE "valuation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sleeve_id" uuid NOT NULL,
	"revision" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"record" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "valuation_revision" UNIQUE("sleeve_id","observed_at","revision")
);
--> statement-breakpoint
CREATE TABLE "proposal_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"guild_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"content" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "version_number" UNIQUE("proposal_id","version"),
	CONSTRAINT "version_tenant" UNIQUE("id","guild_id","round_id")
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"draft" jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposal_tenant" UNIQUE("id","guild_id","round_id")
);
--> statement-breakpoint
CREATE TABLE "award_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"submission_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"state" text NOT NULL,
	"appeal_deadline" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bounties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"week" text NOT NULL,
	"criteria" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "one_bounty_week" UNIQUE("guild_id","week")
);
--> statement-breakpoint
CREATE TABLE "forecasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"terms" jsonb NOT NULL,
	"deadline" timestamp with time zone NOT NULL,
	"week" text NOT NULL,
	"state" text NOT NULL,
	"outcome" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recognition_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"units" integer NOT NULL,
	"reason" text NOT NULL,
	"operation_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recognition_events_operation_id_unique" UNIQUE("operation_id")
);
--> statement-breakpoint
CREATE TABLE "research_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"proposal_version_id" uuid,
	"source_url" text NOT NULL,
	"claim" text NOT NULL,
	"uncertainty" text NOT NULL,
	"disclosures" text NOT NULL,
	"opposing_view" text,
	"revision" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" uuid NOT NULL,
	"content" jsonb NOT NULL,
	"revision" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "note_revision" UNIQUE("note_id","revision")
);
--> statement-breakpoint
CREATE TABLE "rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"mode" "trading_mode" NOT NULL,
	"number" integer NOT NULL,
	"state" text NOT NULL,
	"schedule" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "round_tenant" UNIQUE("id","guild_id"),
	CONSTRAINT "round_tenant_mode" UNIQUE("id","guild_id","mode"),
	CONSTRAINT "round_season_number" UNIQUE("season_id","number"),
	CONSTRAINT "four_rounds" CHECK ("rounds"."number" between 1 and 4)
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"mode" "trading_mode" NOT NULL,
	"division" text NOT NULL,
	"rules_version" text NOT NULL,
	"rules" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "season_tenant" UNIQUE("id","guild_id"),
	CONSTRAINT "season_tenant_mode" UNIQUE("id","guild_id","mode")
);
--> statement-breakpoint
CREATE TABLE "cohort_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"guild_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"division" text NOT NULL,
	"consents" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_division_season" UNIQUE("user_id","division","season_id"),
	CONSTRAINT "cohort_tenant" UNIQUE("id","guild_id")
);
--> statement-breakpoint
CREATE TABLE "fill_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fill_id" uuid NOT NULL,
	"provider_revision" text NOT NULL,
	"fingerprint" text NOT NULL,
	"record" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fill_revision_once" UNIQUE("fill_id","provider_revision")
);
--> statement-breakpoint
CREATE TABLE "fills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"intent_id" uuid NOT NULL,
	"provider_id" text NOT NULL,
	"account_id" text NOT NULL,
	"external_fill_id" text NOT NULL,
	"record" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "external_fill_once" UNIQUE("provider_id","account_id","external_fill_id")
);
--> statement-breakpoint
CREATE TABLE "order_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"sleeve_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid,
	"mode" "trading_mode" NOT NULL,
	"state" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"review" jsonb,
	"review_hash" text,
	"review_revision" integer DEFAULT 0 NOT NULL,
	"preparation_token_hash" text,
	"token_consumed_at" timestamp with time zone,
	"external_order_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "intent_owner_key" UNIQUE("user_id","idempotency_key"),
	CONSTRAINT "intent_owner_mode" UNIQUE("id","user_id","mode")
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"intent_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"mode" "trading_mode" NOT NULL,
	"provider_id" text NOT NULL,
	"account_id" text NOT NULL,
	"external_position_id" text NOT NULL,
	"state" text NOT NULL,
	"record" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "position_attribution_once" UNIQUE("provider_id","account_id","external_position_id")
);
--> statement-breakpoint
CREATE TABLE "provider_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider_id" text NOT NULL,
	"external_account_id" text NOT NULL,
	"verified_at" timestamp with time zone,
	"read_authorization_ref" text,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_account_once" UNIQUE("provider_id","external_account_id"),
	CONSTRAINT "provider_account_owner" UNIQUE("id","user_id")
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"owner_id" uuid,
	"mode" "trading_mode" NOT NULL,
	"instrument_id" text NOT NULL,
	"record" jsonb NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"intent_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"mode" "trading_mode" NOT NULL,
	"covered_lamports" numeric(78, 0) NOT NULL,
	"state" text NOT NULL,
	"provider_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservations_intent_id_unique" UNIQUE("intent_id")
);
--> statement-breakpoint
CREATE TABLE "sleeves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"mode" "trading_mode" NOT NULL,
	"account_id" uuid,
	"cohort_member_id" uuid,
	"allocation_lamports" numeric(78, 0) NOT NULL,
	"reserve_lamports" numeric(78, 0) NOT NULL,
	"verification" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sleeve_member_round" UNIQUE("user_id","round_id"),
	CONSTRAINT "sleeve_tenant_mode" UNIQUE("id","guild_id","mode")
);
--> statement-breakpoint
ALTER TABLE "ballot_choices" ADD CONSTRAINT "ballot_choices_ballot_id_guild_id_round_id_ballots_id_guild_id_round_id_fk" FOREIGN KEY ("ballot_id","guild_id","round_id") REFERENCES "public"."ballots"("id","guild_id","round_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ballot_choices" ADD CONSTRAINT "ballot_choices_proposal_version_id_guild_id_round_id_proposal_versions_id_guild_id_round_id_fk" FOREIGN KEY ("proposal_version_id","guild_id","round_id") REFERENCES "public"."proposal_versions"("id","guild_id","round_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ballot_roster" ADD CONSTRAINT "ballot_roster_ballot_id_ballots_id_fk" FOREIGN KEY ("ballot_id") REFERENCES "public"."ballots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ballot_roster" ADD CONSTRAINT "ballot_roster_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_round_id_guild_id_rounds_id_guild_id_fk" FOREIGN KEY ("round_id","guild_id") REFERENCES "public"."rounds"("id","guild_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "callback_tokens" ADD CONSTRAINT "callback_tokens_ballot_id_ballots_id_fk" FOREIGN KEY ("ballot_id") REFERENCES "public"."ballots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "callback_tokens" ADD CONSTRAINT "callback_tokens_choice_id_ballot_choices_id_fk" FOREIGN KEY ("choice_id") REFERENCES "public"."ballot_choices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "callback_tokens" ADD CONSTRAINT "callback_tokens_proposal_version_id_proposal_versions_id_fk" FOREIGN KEY ("proposal_version_id") REFERENCES "public"."proposal_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_events" ADD CONSTRAINT "vote_events_ballot_id_ballots_id_fk" FOREIGN KEY ("ballot_id") REFERENCES "public"."ballots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_events" ADD CONSTRAINT "vote_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_events" ADD CONSTRAINT "vote_events_choice_id_ballot_choices_id_fk" FOREIGN KEY ("choice_id") REFERENCES "public"."ballot_choices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_ballot_id_user_id_ballot_roster_ballot_id_user_id_fk" FOREIGN KEY ("ballot_id","user_id") REFERENCES "public"."ballot_roster"("ballot_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_choice_id_ballot_id_ballot_choices_id_ballot_id_fk" FOREIGN KEY ("choice_id","ballot_id") REFERENCES "public"."ballot_choices"("id","ballot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_bindings" ADD CONSTRAINT "group_bindings_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_bindings" ADD CONSTRAINT "group_bindings_administrator_id_users_id_fk" FOREIGN KEY ("administrator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guilds" ADD CONSTRAINT "guilds_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_challenges" ADD CONSTRAINT "link_challenges_session_hash_sessions_token_hash_fk" FOREIGN KEY ("session_hash") REFERENCES "public"."sessions"("token_hash") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_deliveries" ADD CONSTRAINT "telegram_deliveries_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_deliveries" ADD CONSTRAINT "telegram_deliveries_proposal_version_id_proposal_versions_id_fk" FOREIGN KEY ("proposal_version_id") REFERENCES "public"."proposal_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_events" ADD CONSTRAINT "ledger_events_sleeve_id_sleeves_id_fk" FOREIGN KEY ("sleeve_id") REFERENCES "public"."sleeves"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_snapshots" ADD CONSTRAINT "result_snapshots_sleeve_id_sleeves_id_fk" FOREIGN KEY ("sleeve_id") REFERENCES "public"."sleeves"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valuation_events" ADD CONSTRAINT "valuation_events_sleeve_id_sleeves_id_fk" FOREIGN KEY ("sleeve_id") REFERENCES "public"."sleeves"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_versions" ADD CONSTRAINT "proposal_versions_proposal_id_guild_id_round_id_proposals_id_guild_id_round_id_fk" FOREIGN KEY ("proposal_id","guild_id","round_id") REFERENCES "public"."proposals"("id","guild_id","round_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_round_id_guild_id_rounds_id_guild_id_fk" FOREIGN KEY ("round_id","guild_id") REFERENCES "public"."rounds"("id","guild_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_decisions" ADD CONSTRAINT "award_decisions_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_decisions" ADD CONSTRAINT "award_decisions_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounties" ADD CONSTRAINT "bounties_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecasts" ADD CONSTRAINT "forecasts_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecasts" ADD CONSTRAINT "forecasts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recognition_events" ADD CONSTRAINT "recognition_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_notes" ADD CONSTRAINT "research_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_notes" ADD CONSTRAINT "research_notes_round_id_guild_id_rounds_id_guild_id_fk" FOREIGN KEY ("round_id","guild_id") REFERENCES "public"."rounds"("id","guild_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_revisions" ADD CONSTRAINT "research_revisions_note_id_research_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."research_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_season_id_guild_id_mode_seasons_id_guild_id_mode_fk" FOREIGN KEY ("season_id","guild_id","mode") REFERENCES "public"."seasons"("id","guild_id","mode") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort_members" ADD CONSTRAINT "cohort_members_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort_members" ADD CONSTRAINT "cohort_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort_members" ADD CONSTRAINT "cohort_members_season_id_guild_id_seasons_id_guild_id_fk" FOREIGN KEY ("season_id","guild_id") REFERENCES "public"."seasons"("id","guild_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fill_revisions" ADD CONSTRAINT "fill_revisions_fill_id_fills_id_fk" FOREIGN KEY ("fill_id") REFERENCES "public"."fills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fills" ADD CONSTRAINT "fills_intent_id_order_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."order_intents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_intents" ADD CONSTRAINT "order_intents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_intents" ADD CONSTRAINT "order_intents_account_id_provider_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."provider_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_intents" ADD CONSTRAINT "order_intents_sleeve_id_guild_id_mode_sleeves_id_guild_id_mode_fk" FOREIGN KEY ("sleeve_id","guild_id","mode") REFERENCES "public"."sleeves"("id","guild_id","mode") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_intent_id_user_id_mode_order_intents_id_user_id_mode_fk" FOREIGN KEY ("intent_id","user_id","mode") REFERENCES "public"."order_intents"("id","user_id","mode") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_accounts" ADD CONSTRAINT "provider_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_round_id_guild_id_mode_rounds_id_guild_id_mode_fk" FOREIGN KEY ("round_id","guild_id","mode") REFERENCES "public"."rounds"("id","guild_id","mode") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_intent_id_order_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."order_intents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_account_id_provider_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."provider_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sleeves" ADD CONSTRAINT "sleeves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sleeves" ADD CONSTRAINT "sleeves_account_id_provider_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."provider_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sleeves" ADD CONSTRAINT "sleeves_cohort_member_id_cohort_members_id_fk" FOREIGN KEY ("cohort_member_id") REFERENCES "public"."cohort_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sleeves" ADD CONSTRAINT "sleeves_round_id_guild_id_mode_rounds_id_guild_id_mode_fk" FOREIGN KEY ("round_id","guild_id","mode") REFERENCES "public"."rounds"("id","guild_id","mode") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "one_pending_link_per_session" ON "link_challenges" USING btree ("session_hash");--> statement-breakpoint
CREATE INDEX "ledger_sleeve_time" ON "ledger_events" USING btree ("sleeve_id","observed_at");--> statement-breakpoint
CREATE INDEX "research_cursor" ON "research_notes" USING btree ("guild_id","created_at","id");--> statement-breakpoint
CREATE INDEX "round_guild_state" ON "rounds" USING btree ("guild_id","state");--> statement-breakpoint
CREATE INDEX "position_owner_mode_state" ON "positions" USING btree ("user_id","mode","state");--> statement-breakpoint
CREATE INDEX "quote_instrument_time" ON "quotes" USING btree ("instrument_id","observed_at");