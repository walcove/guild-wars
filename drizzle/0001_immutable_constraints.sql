CREATE FUNCTION reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'append-only record: append a correction instead'; END $$;
--> statement-breakpoint
CREATE FUNCTION immutable_mode() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF NEW.mode IS DISTINCT FROM OLD.mode THEN RAISE EXCEPTION 'mode is immutable'; END IF; RETURN NEW; END $$;
--> statement-breakpoint
DO $$ DECLARE name text; BEGIN
 FOREACH name IN ARRAY ARRAY['ledger_events','vote_events','audit_events','proposal_versions','research_revisions','fill_revisions','valuation_events','result_snapshots','recognition_events','ballot_roster','cohort_members'] LOOP
  EXECUTE format('CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_mutation()',name);
 END LOOP;
 FOREACH name IN ARRAY ARRAY['seasons','rounds','sleeves','quotes','order_intents','positions','reservations'] LOOP
  EXECUTE format('CREATE TRIGGER mode_immutable BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION immutable_mode()',name);
 END LOOP;
END $$;
--> statement-breakpoint
ALTER TABLE users ADD CONSTRAINT telegram_id_decimal CHECK (telegram_id ~ '^[1-9][0-9]{0,19}$');
--> statement-breakpoint
ALTER TABLE sleeves ADD CONSTRAINT nonnegative_sleeve CHECK (allocation_lamports >= 0 AND reserve_lamports >= 0 AND reserve_lamports <= allocation_lamports);
--> statement-breakpoint
ALTER TABLE reservations ADD CONSTRAINT positive_reservation CHECK (covered_lamports > 0);
--> statement-breakpoint
ALTER TABLE ballots ADD CONSTRAINT ballot_window CHECK (closes_at > opens_at);
--> statement-breakpoint
ALTER TABLE votes ADD CONSTRAINT positive_vote_revision CHECK (revision > 0);
--> statement-breakpoint
ALTER TABLE recognition_events ADD CONSTRAINT recognition_kind CHECK (kind IN ('learning_xp','research_reputation','season_points'));
