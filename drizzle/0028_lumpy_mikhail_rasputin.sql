CREATE TABLE "score_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"input_hash" text NOT NULL,
	"record" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "score_input_revision" UNIQUE("season_id","input_hash")
);
--> statement-breakpoint
ALTER TABLE "score_revisions" ADD CONSTRAINT "score_revisions_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "score_latest" ON "score_revisions" USING btree ("season_id","created_at","id");
--> statement-breakpoint
CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON score_revisions FOR EACH ROW EXECUTE FUNCTION reject_mutation();
