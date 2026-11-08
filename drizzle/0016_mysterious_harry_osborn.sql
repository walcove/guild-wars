CREATE TABLE "house_decisions" (
	"ballot_id" uuid PRIMARY KEY NOT NULL,
	"policy_version" text NOT NULL,
	"cutoff_at" timestamp with time zone NOT NULL,
	"precommitted_at" timestamp with time zone NOT NULL,
	"input_hash" text NOT NULL,
	"input" jsonb NOT NULL,
	"decision" jsonb NOT NULL,
	"inherited_from_ballot" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "house_decisions" ADD CONSTRAINT "house_decisions_ballot_id_ballots_id_fk" FOREIGN KEY ("ballot_id") REFERENCES "public"."ballots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "house_decisions" ADD CONSTRAINT "house_decisions_inherited_from_ballot_ballots_id_fk" FOREIGN KEY ("inherited_from_ballot") REFERENCES "public"."ballots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON house_decisions FOR EACH ROW EXECUTE FUNCTION reject_mutation();
