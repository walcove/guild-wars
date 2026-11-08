ALTER TABLE "cohort_week_claims" ADD COLUMN "provider_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "cohort_week_claims" ADD COLUMN "allocation_ref" text NOT NULL;--> statement-breakpoint
ALTER TABLE "cohort_week_claims" ADD CONSTRAINT "exclusive_provider_allocation_week" UNIQUE("provider_id","allocation_ref","week_key");