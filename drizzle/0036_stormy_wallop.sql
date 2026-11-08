CREATE TABLE "comparison_publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"division_key" text NOT NULL,
	"revision" text NOT NULL,
	"input_hash" text NOT NULL,
	"record" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comparison_publication_revision" UNIQUE("season_id","kind","revision"),
	CONSTRAINT "comparison_kind" CHECK ("comparison_publications"."kind" in ('normalized_plan','cohort'))
);
--> statement-breakpoint
CREATE TABLE "paper_comparisons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"revision" text NOT NULL,
	"input_hash" text NOT NULL,
	"record" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "paper_source_revision" UNIQUE("round_id","kind","revision"),
	CONSTRAINT "paper_kind" CHECK ("paper_comparisons"."kind" in ('normalized_plan','house'))
);
--> statement-breakpoint
ALTER TABLE "comparison_publications" ADD CONSTRAINT "comparison_publications_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper_comparisons" ADD CONSTRAINT "paper_comparisons_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comparison_division_latest" ON "comparison_publications" USING btree ("division_key","kind","season_id","created_at","id");--> statement-breakpoint
CREATE INDEX "paper_latest" ON "paper_comparisons" USING btree ("round_id","kind","created_at","id");
--> statement-breakpoint
CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON paper_comparisons FOR EACH ROW EXECUTE FUNCTION reject_mutation();
CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON comparison_publications FOR EACH ROW EXECUTE FUNCTION reject_mutation();
