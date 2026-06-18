ALTER TABLE "reservations" ALTER COLUMN "total_price" SET DATA TYPE integer USING round("total_price" * 100)::integer;--> statement-breakpoint
ALTER TABLE "rooms" ALTER COLUMN "nightly_price" SET DATA TYPE integer USING round("nightly_price" * 100)::integer;
