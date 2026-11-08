CREATE TABLE "research_assignment_cycles" (
	"submission_id" uuid NOT NULL,
	"generation" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "research_assignment_cycles_submission_id_generation_pk" PRIMARY KEY("submission_id","generation")
);
--> statement-breakpoint
CREATE TABLE "research_conflicts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "declared_award_conflict" UNIQUE("submission_id","reviewer_id")
);
--> statement-breakpoint
ALTER TABLE "research_assignment_cycles" ADD CONSTRAINT "research_assignment_cycles_submission_id_research_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."research_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_conflicts" ADD CONSTRAINT "research_conflicts_submission_id_research_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."research_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_conflicts" ADD CONSTRAINT "research_conflicts_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
INSERT INTO research_assignment_cycles(submission_id,generation) SELECT s.id,COALESCE(max(a.generation),1) FROM research_submissions s LEFT JOIN research_assignments a ON a.submission_id=s.id GROUP BY s.id ON CONFLICT DO NOTHING;
--> statement-breakpoint
CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON research_assignment_cycles FOR EACH ROW EXECUTE FUNCTION reject_mutation();
--> statement-breakpoint
CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON research_conflicts FOR EACH ROW EXECUTE FUNCTION reject_mutation();
