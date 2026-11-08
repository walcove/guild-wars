CREATE TABLE "simulation_bookings" (
	"round_id" uuid PRIMARY KEY NOT NULL,
	"state" text NOT NULL,
	"data_class" text NOT NULL,
	"strategy" text NOT NULL,
	"record" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulation_enrollments" (
	"season_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"policy_version" text NOT NULL,
	"consent" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "simulation_enrollments_season_id_user_id_pk" PRIMARY KEY("season_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "simulation_snapshots" (
	"round_id" uuid PRIMARY KEY NOT NULL,
	"booking_at" timestamp with time zone NOT NULL,
	"data_class" text NOT NULL,
	"record" jsonb NOT NULL,
	"record_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "simulation_bookings" ADD CONSTRAINT "simulation_bookings_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_enrollments" ADD CONSTRAINT "simulation_enrollments_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_enrollments" ADD CONSTRAINT "simulation_enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_snapshots" ADD CONSTRAINT "simulation_snapshots_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON simulation_snapshots FOR EACH ROW EXECUTE FUNCTION reject_mutation();
--> statement-breakpoint
CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON simulation_enrollments FOR EACH ROW EXECUTE FUNCTION reject_mutation();
--> statement-breakpoint
CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON simulation_bookings FOR EACH ROW EXECUTE FUNCTION reject_mutation();
