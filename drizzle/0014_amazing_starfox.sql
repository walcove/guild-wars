ALTER TABLE "ballots" ADD COLUMN "rules" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "ballots" ADD COLUMN "cancel_reason" text;--> statement-breakpoint
ALTER TABLE "ballots" ADD COLUMN "superseded_by" uuid;--> statement-breakpoint
ALTER TABLE "callback_tokens" ADD CONSTRAINT "callback_tokens_choice_id_ballot_id_ballot_choices_id_ballot_id_fk" FOREIGN KEY ("choice_id","ballot_id") REFERENCES "public"."ballot_choices"("id","ballot_id") ON DELETE no action ON UPDATE no action;