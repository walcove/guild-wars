ALTER TABLE "ballot_deliveries" ADD COLUMN "navigation_ref" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "ballot_deliveries" ADD CONSTRAINT "ballot_deliveries_navigation_ref_unique" UNIQUE("navigation_ref");
--> statement-breakpoint
CREATE FUNCTION immutable_ballot_navigation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.navigation_ref IS DISTINCT FROM OLD.navigation_ref THEN RAISE EXCEPTION 'ballot navigation identity is immutable'; END IF; RETURN NEW; END $$;
--> statement-breakpoint
CREATE TRIGGER ballot_navigation_immutable BEFORE UPDATE ON ballot_deliveries FOR EACH ROW EXECUTE FUNCTION immutable_ballot_navigation();
