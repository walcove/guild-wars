ALTER TABLE "reservations" ADD COLUMN "fee_reserve_lamports" numeric(78, 0) DEFAULT '0' NOT NULL;
--> statement-breakpoint
ALTER TABLE reservations ADD CONSTRAINT reservation_fee_reserve_nonnegative CHECK (fee_reserve_lamports>=0);
--> statement-breakpoint
CREATE UNIQUE INDEX exclusive_provider_reservation_ref ON reservations(account_id,mode,provider_ref) WHERE provider_ref IS NOT NULL;
