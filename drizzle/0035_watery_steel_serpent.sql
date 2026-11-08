CREATE TABLE "worker_health" (
	"component" text PRIMARY KEY NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"metrics" jsonb NOT NULL
);

--> statement-breakpoint
REVOKE INSERT,UPDATE,DELETE ON worker_health FROM guild_wars_app;
