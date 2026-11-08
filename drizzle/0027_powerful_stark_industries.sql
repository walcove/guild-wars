CREATE INDEX "ledger_sleeve_sequence" ON "ledger_events" USING btree ("sleeve_id","sequence");--> statement-breakpoint
CREATE INDEX "valuation_latest" ON "valuation_events" USING btree ("sleeve_id","created_at","id");--> statement-breakpoint
CREATE INDEX "sleeve_round_mode" ON "sleeves" USING btree ("round_id","mode");