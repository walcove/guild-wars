CREATE TABLE "membership_history" (
	"sequence" bigserial PRIMARY KEY NOT NULL,
	"guild_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	CONSTRAINT "membership_history_status" CHECK ("membership_history"."status" in ('active','suspended','departed'))
);
--> statement-breakpoint
CREATE TABLE "membership_history_coverage" (
	"singleton" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	CONSTRAINT "membership_history_singleton" CHECK ("membership_history_coverage"."singleton" = true)
);
--> statement-breakpoint
ALTER TABLE "membership_history" ADD CONSTRAINT "membership_history_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_history" ADD CONSTRAINT "membership_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "membership_history_opening" ON "membership_history" USING btree ("guild_id","user_id","effective_at","sequence");
--> statement-breakpoint
LOCK TABLE memberships IN ACCESS EXCLUSIVE MODE;
INSERT INTO membership_history_coverage(singleton,started_at) VALUES(true,clock_timestamp());
INSERT INTO membership_history(guild_id,user_id,status,effective_at)
 SELECT m.guild_id,m.user_id,m.status,c.started_at FROM memberships m CROSS JOIN membership_history_coverage c;
CREATE FUNCTION capture_membership_history() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('membership-roster:'||NEW.guild_id::text,0));
 IF TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
  INSERT INTO public.membership_history(guild_id,user_id,status,effective_at)
  VALUES(NEW.guild_id,NEW.user_id,NEW.status,clock_timestamp());
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION capture_membership_history() FROM PUBLIC;
CREATE TRIGGER record_membership_history BEFORE INSERT OR UPDATE OF status ON memberships
 FOR EACH ROW EXECUTE FUNCTION capture_membership_history();
CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON membership_history FOR EACH ROW EXECUTE FUNCTION reject_mutation();
CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON membership_history_coverage FOR EACH ROW EXECUTE FUNCTION reject_mutation();
REVOKE INSERT,UPDATE,DELETE ON membership_history,membership_history_coverage FROM guild_wars_app;
DO $$ BEGIN IF EXISTS(SELECT FROM pg_roles WHERE rolname='guild_wars_worker') THEN REVOKE INSERT,UPDATE,DELETE ON membership_history,membership_history_coverage FROM guild_wars_worker; END IF; END $$;
