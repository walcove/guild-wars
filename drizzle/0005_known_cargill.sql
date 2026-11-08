CREATE TABLE "guild_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"uses" integer DEFAULT 0 NOT NULL,
	"max_uses" integer DEFAULT 20 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guild_invitations_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "invitation_uses" CHECK ("guild_invitations"."uses" >= 0 and "guild_invitations"."uses" <= "guild_invitations"."max_uses" and "guild_invitations"."max_uses" between 1 and 1000)
);
--> statement-breakpoint
ALTER TABLE "group_bindings" ADD COLUMN "group_url" text;--> statement-breakpoint
ALTER TABLE "group_bindings" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "guild_invitations" ADD CONSTRAINT "guild_invitations_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guild_invitations" ADD CONSTRAINT "guild_invitations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;