CREATE INDEX "assignment_reviewer_time" ON "research_assignments" USING btree ("reviewer_id","created_at");--> statement-breakpoint
CREATE INDEX "forecast_author_week" ON "forecasts" USING btree ("author_id","week");--> statement-breakpoint
CREATE INDEX "forecast_guild_cursor" ON "forecasts" USING btree ("guild_id","created_at","id");--> statement-breakpoint
CREATE INDEX "recognition_owner_kind" ON "recognition_events" USING btree ("user_id","kind");