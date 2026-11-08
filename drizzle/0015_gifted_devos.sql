CREATE UNIQUE INDEX "one_active_ballot" ON "ballots" USING btree ("round_id","kind") WHERE "ballots"."state" in ('prepared','voting');--> statement-breakpoint
CREATE FUNCTION freeze_ballot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.state IN ('closed','cancelled','superseded') AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'closed ballot is immutable'; END IF;
 IF NEW.guild_id IS DISTINCT FROM OLD.guild_id OR NEW.round_id IS DISTINCT FROM OLD.round_id OR NEW.kind IS DISTINCT FROM OLD.kind OR NEW.opens_at IS DISTINCT FROM OLD.opens_at OR NEW.closes_at IS DISTINCT FROM OLD.closes_at THEN RAISE EXCEPTION 'ballot timetable is immutable'; END IF;
 IF NEW.rules IS DISTINCT FROM OLD.rules AND OLD.rules<>'{}'::jsonb THEN RAISE EXCEPTION 'ballot rules are immutable'; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER immutable_ballot BEFORE UPDATE ON ballots FOR EACH ROW EXECUTE FUNCTION freeze_ballot();
--> statement-breakpoint
CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON ballot_choices FOR EACH ROW EXECUTE FUNCTION reject_mutation();
--> statement-breakpoint
CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON callback_tokens FOR EACH ROW EXECUTE FUNCTION reject_mutation();
--> statement-breakpoint
CREATE FUNCTION freeze_ballot_input() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE b ballots;
BEGIN SELECT * INTO b FROM ballots WHERE id=NEW.ballot_id FOR SHARE;
 IF TG_TABLE_NAME='ballot_choices' AND b.rules<>'{}'::jsonb THEN RAISE EXCEPTION 'ballot choices are locked'; END IF;
 IF TG_TABLE_NAME='ballot_roster' AND b.state<>'prepared' THEN RAISE EXCEPTION 'ballot roster is locked'; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER frozen_input BEFORE INSERT ON ballot_choices FOR EACH ROW EXECUTE FUNCTION freeze_ballot_input();
--> statement-breakpoint
CREATE TRIGGER frozen_input BEFORE INSERT ON ballot_roster FOR EACH ROW EXECUTE FUNCTION freeze_ballot_input();
