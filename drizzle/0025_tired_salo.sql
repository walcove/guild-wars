CREATE TABLE "provider_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"intent_id" uuid NOT NULL,
	"provider_id" text NOT NULL,
	"account_id" text NOT NULL,
	"external_event_id" text NOT NULL,
	"provider_revision" text NOT NULL,
	"finality" text NOT NULL,
	"fingerprint" text NOT NULL,
	"record" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_observation_once" UNIQUE("provider_id","account_id","external_event_id","provider_revision","finality")
);
--> statement-breakpoint
CREATE TABLE "reconciliation_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"intent_id" uuid NOT NULL,
	"observation_id" uuid,
	"issue_key" text NOT NULL,
	"kind" text NOT NULL,
	"record" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reconciliation_issues_issue_key_unique" UNIQUE("issue_key")
);
--> statement-breakpoint
CREATE TABLE "reconciliation_resolutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_id" uuid NOT NULL,
	"source_reference" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reconciliation_resolutions_issue_id_unique" UNIQUE("issue_id")
);
--> statement-breakpoint
ALTER TABLE "provider_observations" ADD CONSTRAINT "provider_observations_intent_id_order_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."order_intents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_issues" ADD CONSTRAINT "reconciliation_issues_intent_id_order_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."order_intents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_issues" ADD CONSTRAINT "reconciliation_issues_observation_id_provider_observations_id_fk" FOREIGN KEY ("observation_id") REFERENCES "public"."provider_observations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_resolutions" ADD CONSTRAINT "reconciliation_resolutions_issue_id_reconciliation_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."reconciliation_issues"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON provider_observations FOR EACH ROW EXECUTE FUNCTION reject_mutation();
--> statement-breakpoint
CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON reconciliation_issues FOR EACH ROW EXECUTE FUNCTION reject_mutation();
--> statement-breakpoint
CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON reconciliation_resolutions FOR EACH ROW EXECUTE FUNCTION reject_mutation();
--> statement-breakpoint
CREATE UNIQUE INDEX provider_order_attribution ON order_intents(account_id,mode,external_order_id) WHERE external_order_id IS NOT NULL;
