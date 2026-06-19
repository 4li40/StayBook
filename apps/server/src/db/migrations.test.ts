import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const initialMigration = readFileSync(
  new URL("../../../../packages/db/src/migrations/0000_chief_bucky.sql", import.meta.url),
  "utf8",
);

const guestOverlapMigration = readFileSync(
  new URL("../../../../packages/db/src/migrations/0002_guest_no_overlapping_confirmed_dates.sql", import.meta.url),
  "utf8",
);

describe("database migrations", () => {
  it("enforces non-overlapping confirmed reservations with a half-open GiST exclusion constraint", () => {
    expect(initialMigration).toContain('CREATE EXTENSION IF NOT EXISTS "btree_gist"');
    expect(initialMigration).toContain(
      'ALTER TABLE "reservations" ADD CONSTRAINT "reservations_no_overlapping_confirmed_room_dates_excl"',
    );
    expect(initialMigration).toContain("EXCLUDE USING gist");
    expect(initialMigration).toContain('"room_id" WITH =');
    expect(initialMigration).toContain(
      'daterange("check_in_date", "check_out_date", \'[)\') WITH &&',
    );
    expect(initialMigration).toContain('WHERE ("status" = \'confirmed\')');
  });

  it("prevents a single guest from holding overlapping confirmed reservations across rooms", () => {
    expect(guestOverlapMigration).toContain(
      'ALTER TABLE "reservations" ADD CONSTRAINT "reservations_no_overlapping_confirmed_guest_dates_excl"',
    );
    expect(guestOverlapMigration).toContain("EXCLUDE USING gist");
    expect(guestOverlapMigration).toContain('"guest_id" WITH =');
    expect(guestOverlapMigration).toContain(
      'daterange("check_in_date", "check_out_date", \'[)\') WITH &&',
    );
    expect(guestOverlapMigration).toContain('WHERE ("status" = \'confirmed\')');
  });

  it("keeps date order and supporting availability indexes in the migration", () => {
    expect(initialMigration).toContain("reservations_date_order_chk");
    expect(initialMigration).toContain("reservations_room_dates_status_idx");
    expect(initialMigration).toContain("reservations_guest_id_idx");
    expect(initialMigration).toContain("rooms_active_capacity_idx");
  });
});
