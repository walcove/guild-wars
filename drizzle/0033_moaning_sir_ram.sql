CREATE INDEX "operation_kind_intent" ON "operations" USING btree ("kind",("record"->>'intentId'));--> statement-breakpoint
CREATE INDEX "operation_reassessment_position" ON "operations" USING btree ("kind",("record"->>'positionId'),"created_at");--> statement-breakpoint
CREATE INDEX "fill_intent" ON "fills" USING btree ("intent_id");