CREATE TABLE "ballot_deliveries" (
	"operation_id" text PRIMARY KEY NOT NULL,
	"ballot_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"user_id" uuid,
	"bot_id" text NOT NULL,
	"chat_id" text NOT NULL,
	"topic_id" text,
	"message_id" text,
	"state" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bot_starts" (
	"bot_id" text NOT NULL,
	"telegram_id" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"blocked_at" timestamp with time zone,
	CONSTRAINT "bot_starts_bot_id_telegram_id_pk" PRIMARY KEY("bot_id","telegram_id")
);
--> statement-breakpoint
ALTER TABLE "ballot_deliveries" ADD CONSTRAINT "ballot_deliveries_operation_id_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."operations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ballot_deliveries" ADD CONSTRAINT "ballot_deliveries_ballot_id_ballots_id_fk" FOREIGN KEY ("ballot_id") REFERENCES "public"."ballots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ballot_deliveries" ADD CONSTRAINT "ballot_deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;