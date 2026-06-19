ALTER TABLE "reservations" ADD CONSTRAINT "reservations_no_overlapping_confirmed_guest_dates_excl" EXCLUDE USING gist (
	"guest_id" WITH =,
	daterange("check_in_date", "check_out_date", '[)') WITH &&
) WHERE ("status" = 'confirmed');
