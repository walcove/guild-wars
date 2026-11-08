CREATE TABLE "round_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"from_state" text NOT NULL,
	"to_state" text NOT NULL,
	"operation_id" text NOT NULL,
	"reason" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"record" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "round_events_operation_id_unique" UNIQUE("operation_id")
);
--> statement-breakpoint
CREATE TABLE "round_roster" (
	"round_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "round_roster_round_id_user_id_pk" PRIMARY KEY("round_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "round_events" ADD CONSTRAINT "round_events_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_roster" ADD CONSTRAINT "round_roster_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_roster" ADD CONSTRAINT "round_roster_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON seasons FOR EACH ROW EXECUTE FUNCTION reject_mutation();
--> statement-breakpoint
CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON round_roster FOR EACH ROW EXECUTE FUNCTION reject_mutation();
--> statement-breakpoint
CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON round_events FOR EACH ROW EXECUTE FUNCTION reject_mutation();
--> statement-breakpoint
CREATE FUNCTION immutable_round_schedule() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF NEW.schedule IS DISTINCT FROM OLD.schedule OR NEW.expires_at IS DISTINCT FROM OLD.expires_at OR NEW.season_id IS DISTINCT FROM OLD.season_id OR NEW.guild_id IS DISTINCT FROM OLD.guild_id OR NEW.number IS DISTINCT FROM OLD.number THEN RAISE EXCEPTION 'round schedule is immutable'; END IF; RETURN NEW; END $$;
--> statement-breakpoint
CREATE TRIGGER schedule_immutable BEFORE UPDATE ON rounds FOR EACH ROW EXECUTE FUNCTION immutable_round_schedule();
